export type {} from "./internal/EffectTypes.js"
import { Effect, FileSystem, Path, PlatformError, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import * as Tree from "effect-build/Author/Tree"
import {
  AdoptionError,
  Content,
  OwnedFile,
  OwnedTree,
  TreeDirectory,
  TreeFile,
  TreeLink,
} from "./internal/ArtifactModel.js"
import { adoptData, finalize } from "./internal/BundleFinalize.js"
import { captureContentOwner, type ContentOwner } from "./internal/Content.js"
import { encodeBundle, loadBundle } from "./internal/BundleCodec.js"
import { copyData, decodeOwned, freeze, sha256 } from "./internal/Identity.js"

/** Producer subtypes may carry native class-valued evidence. Own the public
 * artifact contract only; signatures/tickets stay in their provider's evidence.
 * Never invoke accessors, even on a field outside this projection. */
const artifactData = (input: unknown, fields: readonly string[]) => {
  if (!input || typeof input !== "object")
    throw new AdoptionError({ reason: "Expected producer artifact data" })
  const descriptors = Object.getOwnPropertyDescriptors(input)
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!
    if (typeof key !== "string" || !descriptor.enumerable || !("value" in descriptor))
      throw new AdoptionError({ reason: "Artifact data could not be admitted" })
  }
  const selected =
    descriptors._tag?.value === "HashedExecutable"
      ? [...fields, "nativeFormat", "runtime", "target"]
      : fields
  return freeze(
    copyData(
      Object.fromEntries(
        selected
          .filter((key) => Object.hasOwn(descriptors, key))
          .map((key) => [key, descriptors[key]!.value]),
      ),
    ),
  )
}
const fileFields = ["_tag", "path", "bytes", "digest", "provenance", "publication"]
const treeFields = [
  "_tag",
  "root",
  "rootMode",
  "entries",
  "totalBytes",
  "manifestDigest",
  "provenance",
  "publication",
]

/** Recreate an owned tree through the real producer finalizer. effect-build
 * 0.6.3 publishes 0755 roots; other root modes reject before I/O. Nested modes
 * are preserved. The application owns the destination lifetime. */
export const restoreTree = Effect.fn("ts-release.restoreTree")(function* (
  contentOwner: ContentOwner,
  tree: OwnedTree,
  outdir: string,
  provenance: Artifact.Provenance,
) {
  const owner = captureContentOwner(contentOwner)
  const input = yield* adoptData(() => {
    const source = decodeOwned(OwnedTree, tree)
    if (source.rootMode !== 0o755)
      throw new AdoptionError({ reason: "effect-build 0.6.3 restores only 0755 tree roots" })
    return { source, provenance: decodeOwned(Artifact.ProvenanceSchema, provenance) }
  })
  const source = input.source
  const bundle = yield* finalize([source])
  yield* loadBundle(owner, encodeBundle(bundle))
  const fs = yield* FileSystem.FileSystem,
    path = yield* Path.Path
  const artifact = yield* Tree.publish(
    { outdir, observation: "hashed", provenance: input.provenance },
    (candidate) =>
      Effect.gen(function* () {
        for (const entry of source.entries) {
          const destination = path.join(candidate, ...entry.relativePath.split("/"))
          if (entry._tag === "TreeDirectory") yield* fs.makeDirectory(destination)
          else if (entry._tag === "TreeFile") {
            const bytes = new Uint8Array(yield* owner.read(entry.content))
            if (
              String(bytes.length) !== entry.content.bytes ||
              (yield* sha256(bytes)) !== entry.content.sha256
            )
              return yield* new AdoptionError({
                reason: "Restored content differs from its immutable identity",
              })
            yield* fs.writeFile(destination, bytes)
            yield* fs.chmod(destination, entry.mode)
          } else yield* fs.symlink(entry.target, destination)
        }
        for (const entry of [...source.entries].reverse())
          if (entry._tag === "TreeDirectory")
            yield* fs.chmod(path.join(candidate, ...entry.relativePath.split("/")), entry.mode)
        yield* fs.chmod(candidate, source.rootMode)
      }),
    (candidate) =>
      adoptData(() => {
        if (
          candidate.totalBytes !== source.totalBytes ||
          candidate.manifestDigest.value !== source.upstreamManifestSha256
        )
          throw new AdoptionError({
            reason: "Restored candidate differs from its immutable manifest",
          })
      }),
  )
  if (
    artifact.totalBytes !== source.totalBytes ||
    artifact.manifestDigest.value !== source.upstreamManifestSha256
  )
    return yield* new AdoptionError({ reason: "Restored tree differs from its immutable manifest" })
  return artifact
})

/** Copy finalized producer bytes into release ownership; retain no borrowed path. */
export const adoptFile = Effect.fn("ts-release.adoptFile")(function* (
  owner: ContentOwner,
  logicalName: string,
  input: Artifact.HashedFile | Artifact.HashedExecutable,
) {
  const put = owner.putFileOwned.bind(owner)
  const source = yield* adoptData(() => {
    const value = artifactData(input, fileFields)
    if (!Artifact.isHashedFile(value) && !Artifact.isHashedExecutable(value))
      throw new AdoptionError({ reason: "Expected a finalized hashed file or executable" })
    return value
  })
  const file = yield* adoptData(() =>
    decodeOwned(OwnedFile, {
      logicalName,
      _tag: "OwnedFile",
      content: { bytes: source.bytes, sha256: source.digest.value },
      deliveryMode: Artifact.isHashedExecutable(source) ? 0o755 : 0o644,
      executable: Artifact.isHashedExecutable(source)
        ? { nativeFormat: source.nativeFormat, runtime: source.runtime, target: source.target }
        : null,
      provenance: source.provenance,
    }),
  )
  const content = yield* put(source)
  if (content.bytes !== file.content.bytes || content.sha256 !== file.content.sha256)
    return yield* new AdoptionError({ reason: "Adopted file identity differs from its producer" })
  return file
})

/** Verify the producer's exact private snapshot, then own each regular file. */
export const adoptTree = Effect.fn("ts-release.adoptTree")(function* (
  owner: ContentOwner,
  logicalName: string,
  input: Artifact.HashedTree,
) {
  const put = owner.putFileOwned.bind(owner)
  const read = owner.read.bind(owner)
  const readDirectory = owner.readDirectoryBounded.bind(owner)
  const source = yield* adoptData(() => {
    const value = artifactData(input, treeFields)
    if (!Artifact.isHashedTree(value))
      throw new AdoptionError({ reason: "Expected a finalized hashed tree" })
    return value
  })
  const tree = yield* adoptData(() =>
    decodeOwned(OwnedTree, {
      _tag: "OwnedTree",
      logicalName,
      rootMode: source.rootMode,
      totalBytes: source.totalBytes,
      upstreamManifestSha256: source.manifestDigest.value,
      entries: source.entries.map((entry) =>
        entry.kind === "file"
          ? new TreeFile({
              relativePath: entry.relativePath,
              mode: entry.mode,
              content: new Content({ bytes: entry.bytes, sha256: entry.digest.value }),
            })
          : entry.kind === "directory"
            ? new TreeDirectory(entry)
            : new TreeLink(entry),
      ),
      provenance: source.provenance,
    }),
  )
  // Reuse the Bundle's one manifest/graph/capacity law before any filesystem work.
  yield* finalize([tree])
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const reads = new Map<string, Artifact.HashedTreeFileEntry>()
  const register = (root: string) => {
    for (const entry of source.entries)
      if (entry.kind === "file") reads.set(path.join(root, ...entry.relativePath.split("/")), entry)
  }
  register(source.root)
  let temporary: string | undefined
  let remainingEntries = 3 * source.entries.length
  // The owner iterates source names within the remaining two-capture/cleanup
  // budget. Never call the platform's unbounded complete-array enumeration.
  const bounded: FileSystem.FileSystem = {
    ...fs,
    makeTempDirectory: (options) =>
      fs.makeTempDirectory(options).pipe(
        Effect.tap((root) =>
          Effect.sync(() => {
            temporary = root
          }),
        ),
      ),
    realPath: (name) =>
      fs.realPath(name).pipe(
        Effect.tap((root) =>
          Effect.sync(() => {
            if (name === temporary) register(path.normalize(root))
          }),
        ),
      ),
    readDirectory: (directory) =>
      Effect.gen(function* () {
        const names = yield* readDirectory(directory, remainingEntries).pipe(
          Effect.mapError(() =>
            PlatformError.badArgument({
              module: "artifact-adoption",
              method: "readDirectory",
              description: "Tree directory exceeded its entry budget or could not be read",
            }),
          ),
        )
        remainingEntries -= names.length
        if (remainingEntries < 0)
          return yield* PlatformError.badArgument({
            module: "artifact-adoption",
            method: "readDirectory",
            description: "Directory reader exceeded its bound",
          })
        return [...names]
      }),
    readFile: (name) =>
      Effect.gen(function* () {
        const entry = reads.get(name)
        if (!entry) return yield* new AdoptionError({ reason: "Unrecorded tree file" })
        // Byte ingestion needs no invented publication marker for the private
        // snapshot. The owner opens a nonblocking, no-follow regular descriptor.
        const content = yield* put(
          freeze({
            path: yield* Schema.decodeUnknownEffect(Artifact.AbsolutePath)(name),
            bytes: entry.bytes,
            digest: entry.digest,
          }),
        )
        if (content.bytes !== entry.bytes || content.sha256 !== entry.digest.value)
          return yield* new AdoptionError({ reason: "Adopted tree file differs from its manifest" })
        const bytes = new Uint8Array(yield* read(content))
        if (String(bytes.length) !== entry.bytes || (yield* sha256(bytes)) !== entry.digest.value)
          return yield* new AdoptionError({ reason: "Owned tree bytes differ from the manifest" })
        return bytes
      }).pipe(
        Effect.mapError(() =>
          PlatformError.badArgument({
            module: "artifact-adoption",
            method: "readFile",
            description: "Exact regular tree file could not be admitted",
          }),
        ),
      ),
  }
  // Failed tree admission can leave unreferenced immutable blobs; those blobs
  // are derived storage and cannot produce a Bundle or dispatch permission.
  return yield* Tree.withVerifiedSnapshot(source, () => Effect.succeed(tree)).pipe(
    Effect.provideService(FileSystem.FileSystem, bounded),
  )
})
