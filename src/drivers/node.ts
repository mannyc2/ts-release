import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
  type Dirent
} from "node:fs"
import { basename, dirname, join, resolve, sep } from "node:path"
import {
  CredentialStore,
  DriverCatalog,
  WorkspaceStore,
  type CatalogStructuredRequest,
} from "./services.js"
import {
  Digest,
  SnapshotId,
  isSafeRelativePath
} from "../model/primitives.js"
import {
  DriverError,
  MaterializedOutput
} from "../model/run.js"
import type { OutputDeclaration, Pack } from "../model/operation.js"
import { makeNodeWorkspaceStore } from "./workspace.js"
import { tarGz, zip, type ArchiveEntry } from "./archive.js"
import { makeNodeCatalog } from "./remote.js"
import { failure, selectedEnvironment, sha256 } from "./utils.js"

const pathOf = (root: string, path: string): string => resolve(root, path)
const outputFacts = (root: string, output: OutputDeclaration): MaterializedOutput => {
  const path = pathOf(root, output.path)
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw failure(`Declared output ${output.id} was not materialized.`)
  }
  const bytes = readFileSync(path)
  const digest = sha256(bytes)
  return MaterializedOutput.make({
    outputId: output.id,
    snapshotId: SnapshotId.make(digest),
    digest: Digest.make(digest),
    size: bytes.length,
    inode: statSync(path).ino
  })
}
const input = (request: CatalogStructuredRequest, id: string): OutputDeclaration => {
  const found = request.availableOutputs.find((output) => output.id === id)
  if (found === undefined) throw failure(`Operation references unavailable output ${id}.`)
  return found
}
const entries = (request: CatalogStructuredRequest): ReadonlyArray<ArchiveEntry> =>
  request.operation.inputs.map((id) => {
    const output = input(request, id)
    const path = pathOf(request.root, output.path)
    const mode = output.kind === "executable" ? 0o100755 : 0o100644
    return { path: basename(output.path), data: readFileSync(path), mode }
  }).sort((left, right) => left.path.localeCompare(right.path))
const normalizeSlashes = (value: string): string => value.replaceAll("\\", "/")
const containedRealPath = (realRoot: string, child: string, relative: string): string => {
  const real = realpathSync(child)
  if (real !== realRoot && !real.startsWith(realRoot + sep)) {
    throw failure(`Archive enumeration refused symlink escaping the workspace: ${relative}.`)
  }
  return real
}
type WalkKind = "file" | "directory" | "skip"
const statKind = (stats: { isDirectory(): boolean; isFile(): boolean }): WalkKind =>
  stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "skip"
const entryKind = (realRoot: string, entry: Dirent, relative: string, visited: Set<string>): WalkKind => {
  if (!entry.isSymbolicLink()) return statKind(entry)
  const real = containedRealPath(realRoot, join(realRoot, relative), relative)
  if (visited.has(real)) return "skip"
  visited.add(real)
  return statKind(statSync(join(realRoot, relative)))
}
const walkFiles = (realRoot: string, directory: string, collect: Array<string>, visited: Set<string>): void => {
  const absolute = directory === "" ? realRoot : join(realRoot, directory)
  if (!existsSync(absolute)) return
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const relative = directory === "" ? entry.name : `${directory}/${entry.name}`
    const kind = entryKind(realRoot, entry, relative, visited)
    if (kind === "directory") walkFiles(realRoot, relative, collect, visited)
    if (kind === "file") collect.push(relative)
  }
}
const patternCandidates = (realRoot: string, pattern: string): ReadonlyArray<string> => {
  const segments = pattern.split("/").filter((segment) => segment.length > 0)
  const wildcard = segments.findIndex((segment) => /[*?[\]{}]/u.test(segment))
  if (wildcard >= 0) {
    const collect: Array<string> = []
    walkFiles(realRoot, segments.slice(0, wildcard).join("/"), collect, new Set())
    return collect
  }
  const absolute = join(realRoot, pattern)
  if (!existsSync(absolute)) return []
  containedRealPath(realRoot, absolute, pattern)
  return statSync(absolute).isFile() ? [pattern] : []
}
const matchedWorkspaceFiles = (
  realRoot: string, patterns: ReadonlyArray<string>, excluded: ReadonlySet<string>
): ReadonlyArray<string> => {
  const matched = new Set<string>()
  for (const raw of patterns) {
    const pattern = normalizeSlashes(raw)
    if (!isSafeRelativePath(pattern)) throw failure(`Archive pattern must stay inside the workspace: ${raw}.`)
    const glob = new Bun.Glob(pattern)
    for (const candidate of patternCandidates(realRoot, pattern)) {
      if (glob.match(candidate) && !excluded.has(candidate)) matched.add(candidate)
    }
  }
  return [...matched]
}
const packEntries = (request: CatalogStructuredRequest, operation: Pack): ReadonlyArray<ArchiveEntry> => {
  const patterns = operation.files ?? []
  const declared = entries(request)
  if (patterns.length === 0) {
    if (declared.length === 0) throw failure(`Archive ${operation.id} has zero entries.`)
    return declared
  }
  const realRoot = realpathSync(request.root)
  const excluded = new Set(operation.outputs.map((output) => normalizeSlashes(output.path)))
  const matched = matchedWorkspaceFiles(realRoot, patterns, excluded)
  if (matched.length === 0) throw failure(`Archive ${operation.id} patterns matched no workspace files.`)
  const combined = [...declared, ...matched.map((path) => ({
    path, data: new Uint8Array(readFileSync(join(realRoot, path))), mode: 0o100644
  }))]
  const seen = new Set<string>()
  for (const entry of combined) {
    if (seen.has(entry.path)) throw failure(`Archive ${operation.id} has duplicate entry ${entry.path}.`)
    seen.add(entry.path)
  }
  return combined.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
}
const content = (request: CatalogStructuredRequest): string => {
  const operation = request.operation
  if (operation._tag !== "Write") throw failure("Expected Write operation.")
  if (typeof operation.content === "string") return operation.content
  return operation.content.map((part) => {
    if (typeof part === "string") return part
    const output = input(request, part.outputId)
    if (part.fact === "assetName") return basename(output.path)
    if (part.fact === "sha256") return sha256(readFileSync(pathOf(request.root, output.path)))
    throw failure("downloadUrl facts require a product-owned preset value.")
  }).join("")
}
const structured = (request: CatalogStructuredRequest) => Effect.try({
  try: () => {
    const operation = request.operation
    switch (operation._tag) {
      case "Check":
        if (!existsSync(pathOf(request.root, operation.path))) {
          throw failure(`Required path ${operation.path} is absent.`)
        }
        break
      case "Exec": {
        const result = Bun.spawnSync([...operation.argv], {
          cwd: pathOf(request.root, operation.cwd),
          env: selectedEnvironment(operation.environmentNames),
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe"
        })
        if (result.exitCode !== 0) {
          throw failure(`Command exited ${result.exitCode}: ${result.stderr.toString().trim()}`)
        }
        break
      }
      case "Write": {
        const path = pathOf(request.root, operation.path)
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, content(request))
        break
      }
      case "Pack": {
        const path = pathOf(request.root, operation.outputs[0]!.path)
        const archive = packEntries(request, operation)
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, operation.format === "zip" ? zip(archive) : tarGz(archive))
        break
      }
      case "Digest": {
        const path = pathOf(request.root, operation.outputs[0]!.path)
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, operation.inputs.map((id) => {
          const output = input(request, id)
          return `${sha256(readFileSync(pathOf(request.root, output.path)))}  ${basename(output.path)}`
        }).join("\n") + "\n")
        break
      }
      case "HttpRead":
      case "ReviewedNoteTransform":
        throw failure("Remote reads are not structured local operations.")
      default:
        throw failure(`Unsupported structured operation ${operation._tag}.`)
    }
    return {
      outcome: "observed",
      outputs: operation.outputs.map((output) => outputFacts(request.root, output))
    }
  },
  catch: (cause) => cause instanceof DriverError ? cause : failure(String(cause))
})
const catalog = makeNodeCatalog(structured)
const credentials = {
  getRead: (slot: { readonly name: string }) => Effect.try({
    try: () => process.env[slot.name] ?? "",
    catch: (cause) => failure(String(cause))
  }),
  getPublish: (slot: { readonly name: string }) => Effect.try({
    try: () => {
      const value = process.env[slot.name]
      if (value === undefined || value.length === 0) throw failure(`Credential ${slot.name} is unavailable.`)
      return value
    },
    catch: (cause) => cause instanceof DriverError ? cause : failure(String(cause))
  })
}
export const NodeDriverLayer = Layer.mergeAll(
  Layer.succeed(WorkspaceStore)(makeNodeWorkspaceStore()),
  Layer.succeed(DriverCatalog)(catalog),
  Layer.succeed(CredentialStore)(credentials)
)
export const normalizeNodeWorkspace = (path: string): string => realpathSync(path)
