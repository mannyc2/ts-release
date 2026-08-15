import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  symlinkSync
} from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { secureRead } from "../drivers/workspace.js"
import { encodeCanonicalJson } from "../model/canonical.js"
import { sha256Digest, type Sha256Digest } from "../model/digest.js"
import { SafeRelativePath } from "../model/primitives.js"
import {
  ExplicitInputSnapshot,
  StagingEntry,
  StagingSnapshot
} from "./context.js"

const utf8 = new TextEncoder()
const byCodepoint = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0

const fail = (reason: string): never => { throw new Error(reason) }

/** Paths in staging manifests are portable POSIX-style relative paths. */
export const canonicalStagingPath = (value: string): SafeRelativePath => {
  const path = value.split(sep).join("/")
  if (path === "." || path.includes("\\") || path.includes("\0") ||
      path.split("/").some((part) => part.length === 0 || part === "." || part === "..")) {
    return fail(`Staging path ${JSON.stringify(value)} is not canonical and portable.`)
  }
  return SafeRelativePath.make(path)
}

const lexicalContainment = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate)
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
}

const relativePath = (root: string, path: string): SafeRelativePath => canonicalStagingPath(relative(root, path))

const entryDigest = (kind: StagingEntry["kind"], path: string): { readonly digest: ReturnType<typeof sha256Digest>, readonly size: number } => {
  if (kind === "directory") return { digest: sha256Digest(utf8.encode("")), size: 0 }
  const bytes = kind === "symlink" ? utf8.encode(readlinkSync(path)) : new Uint8Array(readFileSync(path))
  return { digest: sha256Digest(bytes), size: bytes.length }
}

const assertSafeSymlink = (root: string, path: string): void => {
  const target = readlinkSync(path)
  if (target.length === 0 || isAbsolute(target)) fail(`Staging symlink ${relative(root, path)} has an absolute or empty target.`)
  const landed = resolve(dirname(path), target)
  if (!lexicalContainment(root, landed)) fail(`Staging symlink ${relative(root, path)} escapes the private root.`)
  if (!existsSync(landed)) fail(`Staging symlink ${relative(root, path)} is dangling.`)
  const real = realpathSync(path)
  if (!lexicalContainment(root, real)) fail(`Staging symlink ${relative(root, path)} resolves outside the private root.`)
}

const isExcluded = (path: string, excluded: ReadonlyArray<string>): boolean =>
  excluded.some((root) => path === root || path.startsWith(`${root}/`))

const isExcludedAncestor = (path: string, excluded: ReadonlyArray<string>): boolean =>
  excluded.some((root) => root.startsWith(`${path}/`))

export interface SnapshotOptions {
  /** Canonical roots omitted from a mutation comparison (declared outputs and scratch only). */
  readonly exclude?: ReadonlyArray<SafeRelativePath | string>
}

/** Canonical path/type/digest manifest for a private staging tree. */
export const snapshotStaging = (rootValue: string, options: SnapshotOptions = {}): StagingSnapshot => {
  const root = realpathSync(rootValue)
  if (lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory()) fail("Staging root must be a real directory.")
  const excluded = (options.exclude ?? []).map(String).sort(byCodepoint)
  const entries: StagingEntry[] = []
  const folded = new Map<string, string>()
  const walk = (directory: string): void => {
    for (const child of readdirSync(directory, { withFileTypes: true }).sort((left, right) => byCodepoint(left.name, right.name))) {
      const path = join(directory, child.name)
      const name = relativePath(root, path).toString()
      if (isExcluded(name, excluded)) continue
      const collision = folded.get(name.toLocaleLowerCase("en-US"))
      if (collision !== undefined && collision !== name) fail(`Staging paths ${collision} and ${name} collide under case folding.`)
      folded.set(name.toLocaleLowerCase("en-US"), name)
      const stat = lstatSync(path)
      const kind: StagingEntry["kind"] = stat.isSymbolicLink()
        ? "symlink"
        : stat.isDirectory()
        ? "directory"
        : stat.isFile()
        ? (stat.mode & 0o111) === 0 ? "file" : "executable"
        : fail(`Staging path ${name} has an unsupported filesystem kind.`)
      if (kind === "symlink") assertSafeSymlink(root, path)
      const value = entryDigest(kind, path)
      // Ancestor directories of an excluded writable root are traversal-only:
      // creating `.release` in order to create `.release/assets` must not look
      // like an undeclared mutation, while siblings under `.release` remain
      // fully snapshotted and protected.
      if (!(kind === "directory" && isExcludedAncestor(name, excluded))) {
        entries.push(StagingEntry.make({
          path: canonicalStagingPath(name),
          kind,
          mode: kind === "executable" ? 0o755 : kind === "directory" ? 0o755 : kind === "symlink" ? 0o777 : 0o644,
          size: value.size,
          digest: value.digest
        }))
      }
      if (kind === "directory") walk(path)
    }
  }
  walk(root)
  const canonical = encodeCanonicalJson(entries.map((entry) => ({
    path: entry.path.toString(), kind: entry.kind, mode: entry.mode, size: entry.size,
    digest: entry.digest.hex
  })))
  return StagingSnapshot.make({ entries, digest: sha256Digest(utf8.encode(canonical)) })
}

export const snapshotsEqual = (left: StagingSnapshot, right: StagingSnapshot): boolean =>
  left.digest.hex === right.digest.hex

const snapshotDigest = (entries: ReadonlyArray<StagingEntry>): Sha256Digest => sha256Digest(utf8.encode(encodeCanonicalJson(
  entries.map((entry) => ({
    path: entry.path.toString(), kind: entry.kind, mode: entry.mode, size: entry.size,
    digest: entry.digest.hex
  }))
)))

/** Select canonical roots from a whole-stage snapshot without following links again. */
export const selectStagingSnapshot = (
  snapshot: StagingSnapshot,
  roots: ReadonlyArray<SafeRelativePath | string>
): StagingSnapshot => {
  const names = roots.map(String)
  const selected = snapshot.entries.map((entry) => {
    const root = names.find((candidate) => entry.path.toString().startsWith(`${candidate}/`))
    if (root === undefined) return undefined
    const path = canonicalStagingPath(entry.path.toString().slice(root.length + 1))
    return StagingEntry.make({ ...entry, path })
  }).filter((entry): entry is StagingEntry => entry !== undefined)
  return StagingSnapshot.make({ entries: selected, digest: snapshotDigest(selected) })
}

export const snapshotDifference = (before: StagingSnapshot, after: StagingSnapshot): string => {
  const left = new Map(before.entries.map((entry) => [entry.path.toString(), entry]))
  const right = new Map(after.entries.map((entry) => [entry.path.toString(), entry]))
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort(byCodepoint)
  const changed = paths.filter((path) => {
    const a = left.get(path); const b = right.get(path)
    return a === undefined || b === undefined || a.kind !== b.kind || a.mode !== b.mode ||
      a.size !== b.size || a.digest.hex !== b.digest.hex
  })
  return changed.slice(0, 8).join(", ") + (changed.length > 8 ? ` (+${changed.length - 8} more)` : "")
}

export const assertSnapshotPresent = (
  root: string,
  expected: StagingSnapshot,
  label: string,
  options: SnapshotOptions = {}
): void => {
  const current = snapshotStaging(root, options)
  const available = new Map(current.entries.map((entry) => [entry.path.toString(), entry]))
  const excluded = (options.exclude ?? []).map(String)
  for (const entry of expected.entries) {
    if (isExcluded(entry.path.toString(), excluded)) continue
    const actual = available.get(entry.path.toString())
    if (actual === undefined || actual.kind !== entry.kind || actual.mode !== entry.mode ||
        actual.size !== entry.size || actual.digest.hex !== entry.digest.hex) {
      fail(`${label} changed at ${entry.path}.`)
    }
  }
}

const copyPrivateTree = (sourceRoot: string, destinationRoot: string): void => {
  const source = realpathSync(sourceRoot)
  const walk = (from: string, to: string): void => {
    const stat = lstatSync(from)
    if (stat.isSymbolicLink()) {
      const landed = realpathSync(from)
      if (!lexicalContainment(source, landed)) fail(`Explicit input symlink ${from} escapes its declared root.`)
      const target = readlinkSync(from)
      symlinkSync(target, to, stat.isDirectory() ? "dir" : "file")
      return
    }
    if (stat.isDirectory()) {
      mkdirSync(to, { recursive: false, mode: 0o700 })
      for (const child of readdirSync(from).sort(byCodepoint)) walk(join(from, child), join(to, child))
      return
    }
    if (!stat.isFile()) fail(`Explicit input ${from} has an unsupported filesystem kind.`)
    copyFileSync(from, to, constants.COPYFILE_FICLONE)
  }
  walk(sourceRoot, destinationRoot)
  // Re-snapshot to reject copied links that only appeared safe in the source topology.
  if (lstatSync(destinationRoot).isDirectory()) snapshotStaging(destinationRoot)
}

/**
 * Copy/reflink one declared non-Git input into private staging and return the
 * digest that becomes part of prepared provenance. The destination must not
 * already exist; source bytes can therefore never overwrite verified Git
 * materialization.
 */
export interface MaterializedExplicitInput {
  readonly snapshot: ExplicitInputSnapshot
  readonly bytes?: Uint8Array
}

export const materializeExplicitInput = (input: {
  readonly id: string
  readonly sourceWorkspace: string
  readonly stageRoot: string
  readonly path: SafeRelativePath
  readonly maxFileBytes?: number
  readonly readFile?: typeof secureRead
}): MaterializedExplicitInput => {
  const sourceRoot = realpathSync(input.sourceWorkspace)
  const source = join(sourceRoot, input.path.toString())
  const destination = join(input.stageRoot, input.path.toString())
  if (!lexicalContainment(sourceRoot, source) || !lexicalContainment(realpathSync(input.stageRoot), destination)) {
    return fail(`Explicit input ${input.id} escapes its declared root.`)
  }
  if (!existsSync(source)) return fail(`Explicit input ${input.id} does not exist at ${input.path}.`)
  if (existsSync(destination)) return fail(`Explicit input ${input.id} overlaps verified source at ${input.path}.`)
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
  const sourceStat = lstatSync(source)
  if (sourceStat.isSymbolicLink()) return fail(`Explicit input ${input.id} cannot be a symlink.`)
  if (input.maxFileBytes !== undefined && sourceStat.isFile() && sourceStat.size > input.maxFileBytes) {
    return fail(`Explicit input ${input.id} size ${sourceStat.size} exceeds the ${input.maxFileBytes}-byte limit.`)
  }
  copyPrivateTree(source, destination)
  const kind = sourceStat.isDirectory() ? "directory" : "file"
  const snapshot = sourceStat.isDirectory() ? snapshotStaging(destination) : undefined
  const fileBytes = sourceStat.isDirectory()
    ? undefined
    : (input.readFile ?? secureRead)(input.stageRoot, input.path.toString(), {
      ...(input.maxFileBytes === undefined ? {} : { maxBytes: input.maxFileBytes })
    }).bytes
  const size = sourceStat.isDirectory()
    ? snapshot!.entries.filter((entry) => entry.kind !== "directory").reduce((sum, entry) => sum + entry.size, 0)
    : fileBytes!.length
  const digest = sourceStat.isDirectory()
    ? snapshot!.digest
    : sha256Digest(fileBytes!)
  return {
    snapshot: ExplicitInputSnapshot.make({
      id: input.id,
      path: input.path,
      kind,
      size,
      digest,
      materializer: "private-copy-or-reflink/v1",
      materializationBasis: [digest]
    }),
    ...(fileBytes === undefined ? {} : { bytes: fileBytes })
  }
}

/** Digest a set of preparation influences without asserting reproducibility. */
export const preparationBasisDigest = (
  source: StagingSnapshot,
  inputs: ReadonlyArray<ExplicitInputSnapshot>,
  execution: Readonly<Record<string, string>>
) => sha256Digest(utf8.encode(encodeCanonicalJson({
  source: source.digest.hex,
  inputs: [...inputs].sort((left, right) => byCodepoint(left.id, right.id)).map((input) => ({
    id: input.id, path: input.path.toString(), kind: input.kind, size: input.size, digest: input.digest.hex,
    materializer: input.materializer,
    materializationBasis: input.materializationBasis.map((digest) => digest.hex)
  })),
  execution
})))
