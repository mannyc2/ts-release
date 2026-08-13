import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { spawnSync } from "node:child_process"
import { sha256Digest } from "../model/digest.js"
import { SafeRelativePath } from "../model/primitives.js"
import {
  makeSourceObserver,
  SourceMaterializationError,
  SourceObserver,
  type SourceObserverRuntime,
  type StagingEntry,
  type VerifiedSource
} from "../release/context.js"
import { canonicalStagingPath, snapshotStaging } from "../release/staging.js"

const materializationFailure = (field: string, reason: string): SourceMaterializationError =>
  new SourceMaterializationError({ field, reason })

const gitBytes = (workspace: string, argv: ReadonlyArray<string>, input?: Uint8Array): Uint8Array => {
  const result = spawnSync("git", [...argv], {
    cwd: workspace,
    encoding: null,
    stdio: ["pipe", "pipe", "pipe"],
    ...(input === undefined ? {} : { input }),
    maxBuffer: 1024 * 1024 * 1024
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(Buffer.from(result.stderr ?? []).toString("utf8").trim() || `git ${argv[0]} exited ${result.status}.`)
  }
  return new Uint8Array(result.stdout ?? [])
}

const gitText = (workspace: string, argv: ReadonlyArray<string>, input?: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(gitBytes(workspace, argv, input))

const contained = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate)
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
}

interface GitTreeEntry {
  readonly mode: "100644" | "100755" | "120000"
  readonly object: string
  readonly path: SafeRelativePath
  readonly bytes: Uint8Array
}

const parseTree = (workspace: string, source: VerifiedSource): ReadonlyArray<GitTreeEntry> => {
  const raw = gitBytes(workspace, ["ls-tree", "-r", "-z", "--full-tree", source.commit.toString()])
  const decoded = new TextDecoder("utf-8", { fatal: true })
  const entries: GitTreeEntry[] = []
  let cursor = 0
  while (cursor < raw.length) {
    const end = raw.indexOf(0, cursor)
    if (end < 0) throw materializationFailure("source.tree", "Git tree output omitted its NUL terminator.")
    const record = raw.slice(cursor, end)
    cursor = end + 1
    const tab = record.indexOf(9)
    if (tab < 0) throw materializationFailure("source.tree", "Git tree output omitted its pathname separator.")
    const header = decoded.decode(record.slice(0, tab))
    const match = /^(100644|100755|120000) blob ([a-f0-9]+)$/u.exec(header)
    if (match === null) {
      const unsupported = /^(\d+) (\w+) /u.exec(header)
      throw materializationFailure(
        "source.tree",
        unsupported?.[2] === "commit"
          ? "Verified source contains a submodule; declare and verify it as a separate input before preparation."
          : `Verified source contains unsupported Git entry ${header}.`
      )
    }
    const pathText = decoded.decode(record.slice(tab + 1))
    const path = canonicalStagingPath(pathText)
    const bytes = gitBytes(workspace, ["cat-file", "blob", match[2]!])
    const observedObject = gitText(workspace, ["hash-object", "--stdin"], bytes).trim()
    if (observedObject !== match[2]) {
      throw materializationFailure("source.tree", `Git object ${match[2]} failed content verification.`)
    }
    entries.push({ mode: match[1] as GitTreeEntry["mode"], object: match[2]!, path, bytes })
  }
  return entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
}

const assertTrackedSourceStable = (workspace: string, source: VerifiedSource): void => {
  const head = gitText(workspace, ["rev-parse", "HEAD"]).trim()
  const tree = gitText(workspace, ["rev-parse", `${source.commit}^{tree}`]).trim()
  const status = gitText(workspace, ["status", "--porcelain=v1", "--untracked-files=no"]).trim()
  if (head !== source.commit.toString()) {
    throw materializationFailure("source.commit", `Verified commit ${source.commit} drifted to ${head} before materialization.`)
  }
  if (tree !== source.tree.toString()) {
    throw materializationFailure("source.tree", `Verified tree ${source.tree} disagrees with commit tree ${tree}.`)
  }
  if (status.length > 0) {
    throw materializationFailure("source.clean", "Tracked source changed after verification and before materialization.")
  }
}

export const materializeGitSource = (
  workspaceValue: string,
  source: VerifiedSource,
  destinationValue: string
) => {
  const workspace = realpathSync(workspaceValue)
  const destination = realpathSync(destinationValue)
  if (lstatSync(destination).isSymbolicLink() || !lstatSync(destination).isDirectory() || readdirSync(destination).length > 0) {
    throw materializationFailure("source.destination", "Exact source materialization requires a fresh real directory.")
  }
  assertTrackedSourceStable(workspace, source)
  const entries = parseTree(workspace, source)
  const folded = new Map<string, string>()
  for (const entry of entries) {
    const portablePath = entry.path.toString()
    const collision = folded.get(portablePath.toLocaleLowerCase("en-US"))
    if (collision !== undefined && collision !== portablePath) {
      throw materializationFailure("source.path", `Git paths ${collision} and ${portablePath} collide under case folding.`)
    }
    folded.set(portablePath.toLocaleLowerCase("en-US"), portablePath)
    const target = join(destination, portablePath)
    if (!contained(destination, target)) throw materializationFailure("source.path", `Git path ${portablePath} escapes staging.`)
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
    if (entry.mode === "120000") {
      const link = new TextDecoder("utf-8", { fatal: true }).decode(entry.bytes)
      const landed = resolve(dirname(target), link)
      if (link.length === 0 || isAbsolute(link) || !contained(destination, landed)) {
        throw materializationFailure("source.symlink", `Git symlink ${portablePath} escapes private staging.`)
      }
      symlinkSync(link, target)
    } else {
      writeFileSync(target, entry.bytes, { mode: entry.mode === "100755" ? 0o755 : 0o644, flag: "wx" })
      chmodSync(target, entry.mode === "100755" ? 0o755 : 0o644)
    }
  }
  const snapshot = snapshotStaging(destination)
  const files = snapshot.entries.filter((entry) => entry.kind !== "directory")
  if (files.length !== entries.length) {
    throw materializationFailure("source.tree", "Materialized tree has an unexpected file or symlink set.")
  }
  const actual = new Map<string, StagingEntry>(files.map((entry) => [entry.path.toString(), entry]))
  for (const expected of entries) {
    const entry = actual.get(expected.path.toString())
    const kind = expected.mode === "120000" ? "symlink" : expected.mode === "100755" ? "executable" : "file"
    if (entry === undefined || entry.kind !== kind || entry.size !== expected.bytes.length ||
        entry.digest.hex !== sha256Digest(expected.bytes).hex) {
      throw materializationFailure("source.tree", `Materialized path ${expected.path} failed byte or mode verification.`)
    }
  }
  const packageBytes = new Uint8Array(readFileSync(join(destination, source.packageManifestPath.toString())))
  if (sha256Digest(packageBytes).hex !== source.packageManifestDigest.hex) {
    throw materializationFailure("source.packageManifestDigest", "Materialized package manifest disagrees with verified source facts.")
  }
  assertTrackedSourceStable(workspace, source)
  return snapshot
}

const runtime: SourceObserverRuntime = {
  canonicalRoot: (workspace) => Effect.try({
    try: () => realpathSync(workspace), catch: (cause) => cause
  }),
  read: (workspace, path) => Effect.try({
    try: () => new Uint8Array(readFileSync(join(workspace, path))), catch: (cause) => cause
  }),
  command: (workspace, argv) => Effect.try({
    try: () => {
      const result = spawnSync("git", [...argv], { cwd: workspace, encoding: "utf8", stdio: "pipe" })
      if (result.error !== undefined) throw result.error
      if (result.status !== 0) throw new Error(result.stderr.trim() || `Command exited ${result.status}.`)
      return result.stdout
    },
    catch: (cause) => cause
  }),
  digest: (bytes) => Effect.sync(() => sha256Digest(bytes)),
  materialize: (workspace, source, destination) => Effect.try({
    try: () => materializeGitSource(workspace, source, destination),
    catch: (cause) => cause
  })
}

// Both supported runtimes use the same observation contract; only this host
// layer closes its filesystem/process primitives. The observer itself remains
// shared with tests and future library hosts.
export const SourceObserverLive = Layer.succeed(SourceObserver, makeSourceObserver(runtime))
