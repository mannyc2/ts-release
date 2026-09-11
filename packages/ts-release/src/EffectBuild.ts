import { Effect, FileSystem, Path, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import { AdoptionError, Content, OwnedFile, OwnedTree } from "./internal/ArtifactModel.js"
import type { Producer } from "./internal/ArtifactModel.js"
import { adoptData } from "./internal/BundleFinalize.js"
import { captureContentOwner, readVerifiedContent, type ContentOwner } from "./internal/Content.js"
import { decodeOwned } from "./internal/Identity.js"
import { checkTree } from "./internal/TreeLayout.js"

const Regular = Schema.Union([Artifact.File, Artifact.Executable])
const regularKeys = ["kind", "path", "bytes", "sha256", "producedBy", "target", "format"] as const
const directoryKeys = [
  "kind",
  "path",
  "bytes",
  "sha256",
  "producedBy",
  "rootMode",
  "entries",
] as const

/**
 * Copy the core artifact fields out of a producer record without invoking
 * accessors. Provider refinements (signatures, tickets, runtimes) stay with the
 * provider's own schema; the release system owns only the core identity.
 */
const coreRecord = (input: unknown, keys: readonly string[]) => {
  if (typeof input !== "object" || input === null)
    throw new AdoptionError({ reason: "Expected a producer artifact record" })
  const record: Record<string, unknown> = {}
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (descriptor === undefined) continue
    if (!("value" in descriptor))
      throw new AdoptionError({ reason: `Artifact field ${key} must be plain data` })
    record[key] = descriptor.value
  }
  return record
}
/** The producer identity retained durably: the tool's path is a host detail. */
const producerOf = ({ name, version, sha256 }: Artifact.Producer): Producer => ({
  name,
  version,
  ...(sha256 === undefined ? {} : { sha256 }),
})
const sameIdentity = (content: Content, expected: { bytes: number; sha256: string }) =>
  content.bytes === expected.bytes && content.sha256 === expected.sha256
const admitTree = (logicalName: string, source: Artifact.Directory) =>
  adoptData(() => {
    const tree = decodeOwned(OwnedTree, {
      _tag: "OwnedTree",
      logicalName,
      bytes: source.bytes,
      sha256: source.sha256,
      rootMode: source.rootMode,
      entries: source.entries,
      producedBy: producerOf(source.producedBy),
    })
    checkTree(tree)
    return tree
  })

/** Copy a produced file into release ownership; the record's borrowed path is not retained. */
export const adoptFile = Effect.fn("ts-release.adoptFile")(function* (
  contentOwner: ContentOwner,
  logicalName: string,
  artifact: Artifact.Regular,
) {
  const owner = captureContentOwner(contentOwner)
  const source = yield* adoptData(() => decodeOwned(Regular, coreRecord(artifact, regularKeys)))
  const file = yield* adoptData(() =>
    decodeOwned(OwnedFile, {
      _tag: "OwnedFile",
      logicalName,
      content: { bytes: source.bytes, sha256: source.sha256 },
      deliveryMode: source.kind === "executable" ? 0o755 : 0o644,
      executable:
        source.kind === "executable" ? { target: source.target, format: source.format } : null,
      producedBy: producerOf(source.producedBy),
    }),
  )
  const content = yield* owner.putFileOwned(source)
  if (!sameIdentity(content, file.content))
    return yield* new AdoptionError({ reason: "Adopted file identity differs from its producer" })
  return file
})

/** Own every file of a produced directory; each copy is checked against its manifest entry. */
export const adoptTree = Effect.fn("ts-release.adoptTree")(function* (
  contentOwner: ContentOwner,
  logicalName: string,
  artifact: Artifact.Directory,
) {
  const owner = captureContentOwner(contentOwner)
  const source = yield* adoptData(() =>
    decodeOwned(Artifact.Directory, coreRecord(artifact, directoryKeys)),
  )
  const tree = yield* admitTree(logicalName, source)
  const path = yield* Path.Path
  for (const entry of tree.entries) {
    if (entry.kind !== "file") continue
    const content = yield* owner.putFileOwned({
      path: path.join(source.path, ...entry.path.split("/")),
      bytes: entry.bytes,
      sha256: entry.sha256,
    })
    if (!sameIdentity(content, entry))
      return yield* new AdoptionError({ reason: "Adopted tree file differs from its manifest" })
  }
  return tree
})

/**
 * Recreate an owned tree at `outdir` from owned content, then re-observe it with
 * effect-build so the result carries the recorded identity. The destination must
 * not exist. After verification, an exclusive mkdir claims the destination;
 * the complete tree then replaces that owned empty reservation in one rename.
 * Callers must wait for success before using the destination. Hosts that cannot
 * rename over an empty directory fail without a replacement fallback. A failed
 * rename leaves the reservation for the caller to inspect, never delete blindly.
 */
export const restoreTree = Effect.fn("ts-release.restoreTree")(function* (
  contentOwner: ContentOwner,
  tree: OwnedTree,
  outdir: string,
) {
  const owner = captureContentOwner(contentOwner)
  const source = yield* adoptData(() => {
    const value = decodeOwned(OwnedTree, tree)
    checkTree(value)
    return value
  })
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const destination = path.resolve(outdir)
  const occupied = () =>
    new AdoptionError({ reason: `Restore destination already exists: ${destination}` })
  if (yield* fs.exists(destination)) return yield* occupied()
  const ownedBytes = (entry: { bytes: number; sha256: string }) =>
    readVerifiedContent(owner.read, new Content(entry), entry.bytes).pipe(
      Effect.mapError(
        () => new AdoptionError({ reason: "Restored content differs from its owned identity" }),
      ),
    )
  const write = (root: string) =>
    Effect.gen(function* () {
      const at = (entry: Artifact.Entry) => path.join(root, ...entry.path.split("/"))
      for (const entry of source.entries) {
        if (entry.kind === "directory") yield* fs.makeDirectory(at(entry))
        else if (entry.kind === "symlink") yield* fs.symlink(entry.linkTarget, at(entry))
        else {
          yield* fs.writeFile(at(entry), yield* ownedBytes(entry))
          yield* fs.chmod(at(entry), entry.mode)
        }
      }
      // Directory modes last and deepest first: a read-only directory would block its children.
      for (const entry of [...source.entries].reverse())
        if (entry.kind === "directory") yield* fs.chmod(at(entry), entry.mode)
      yield* fs.chmod(root, source.rootMode)
      const restored = yield* Artifact.directory(root, source.producedBy)
      if (
        restored.bytes !== source.bytes ||
        restored.sha256 !== source.sha256 ||
        restored.rootMode !== source.rootMode
      )
        return yield* new AdoptionError({
          reason: "Restored tree differs from its recorded identity",
        })
      return restored
    })
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const parent = path.dirname(destination)
      yield* fs.makeDirectory(parent, { recursive: true })
      const staging = yield* Effect.acquireRelease(
        fs.makeTempDirectory({ directory: parent, prefix: ".ts-release-restore-" }),
        (root) =>
          Effect.gen(function* () {
            if (!(yield* fs.exists(root))) return
            // Failed commits may leave verified read-only directories in staging.
            yield* fs.chmod(root, 0o700)
            for (const entry of source.entries) {
              if (entry.kind !== "directory") continue
              yield* fs
                .chmod(path.join(root, ...entry.path.split("/")), 0o700)
                .pipe(
                  Effect.catch((error) =>
                    error.reason._tag === "NotFound" ? Effect.void : Effect.fail(error),
                  ),
                )
            }
            yield* fs.remove(root, { recursive: true, force: true })
          }).pipe(Effect.orDie),
      )
      const restored = yield* write(staging)
      yield* Effect.uninterruptible(
        Effect.gen(function* () {
          // mkdir, unlike exists, refuses every occupied path in one operation,
          // including an empty directory or dangling symlink created during restoration.
          yield* fs
            .makeDirectory(destination, { mode: 0o700 })
            .pipe(
              Effect.mapError((error) =>
                error.reason._tag === "AlreadyExists" ? occupied() : error,
              ),
            )
          // A writer may have populated the reservation. A plain directory rename
          // refuses that conflict; never move it aside or remove it on failure.
          yield* fs.rename(staging, destination)
        }),
      )
      return { ...restored, path: destination }
    }),
  )
})
