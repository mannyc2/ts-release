import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
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
  type CredentialStoreShape,
  type DriverCatalogShape
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
import type { Exec, OutputDeclaration, Pack } from "../model/operation.js"
import { makeNodeWorkspaceStore } from "./workspace.js"
import { tarGz, zip, type ArchiveEntry } from "./archive.js"
import { matchGlob } from "./glob.js"
import { readOptionalEnv } from "./environment.js"
import { makeRunCommand, type RunCommand } from "./process.js"
import { makeCatalog } from "./remote.js"
import { failure, sha256 } from "./utils.js"

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
  if (real === realRoot || real.startsWith(realRoot + sep)) return real
  throw failure(`Archive enumeration refused symlink escaping the workspace: ${relative}.`)
}
const entryKind = (realRoot: string, entry: Dirent, relative: string, visited: Set<string>) => {
  if (!entry.isSymbolicLink()) return entry
  const real = containedRealPath(realRoot, join(realRoot, relative), relative)
  if (visited.has(real)) return undefined
  visited.add(real)
  return statSync(join(realRoot, relative))
}
const walkFiles = (realRoot: string, directory: string, visited: Set<string>): Array<string> => {
  const absolute = directory === "" ? realRoot : join(realRoot, directory)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = directory === "" ? entry.name : `${directory}/${entry.name}`
    const kind = entryKind(realRoot, entry, relative, visited)
    if (kind?.isDirectory() === true) return walkFiles(realRoot, relative, visited)
    return kind?.isFile() === true ? [relative] : []
  })
}
const patternCandidates = (realRoot: string, pattern: string): ReadonlyArray<string> => {
  const segments = pattern.split("/").filter((segment) => segment.length > 0)
  const wildcard = segments.findIndex((segment) => /[*?[\]{}]/u.test(segment))
  if (wildcard >= 0) return walkFiles(realRoot, segments.slice(0, wildcard).join("/"), new Set())
  const absolute = join(realRoot, pattern)
  if (!existsSync(absolute)) return []
  containedRealPath(realRoot, absolute, pattern)
  return statSync(absolute).isFile() ? [pattern] : []
}
const matchedWorkspaceFiles = (
  realRoot: string, patterns: ReadonlyArray<string>, excluded: ReadonlySet<string>
): ReadonlyArray<string> => [...new Set(patterns.flatMap((raw) => {
  const pattern = normalizeSlashes(raw)
  if (!isSafeRelativePath(pattern)) throw failure(`Archive pattern must stay inside the workspace: ${raw}.`)
  const matches = matchGlob(pattern)
  return patternCandidates(realRoot, pattern).filter((path) => matches(path) && !excluded.has(path))
}))]
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
  const duplicate = combined.map((entry) => entry.path).find((path, index, all) => all.indexOf(path) !== index)
  if (duplicate !== undefined) throw failure(`Archive ${operation.id} has duplicate entry ${duplicate}.`)
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
const observed = (request: CatalogStructuredRequest) => ({
  outcome: "observed",
  outputs: request.operation.outputs.map((output) => outputFacts(request.root, output))
})
const attempt = <A>(body: () => A) => Effect.try({
  try: body,
  catch: (cause) => cause instanceof DriverError ? cause : failure(String(cause))
})
const executed = (run: RunCommand, request: CatalogStructuredRequest, operation: Exec) =>
  run({
    argv: operation.argv,
    cwd: pathOf(request.root, operation.cwd),
    environmentNames: operation.environmentNames
  }).pipe(Effect.flatMap((result) => result.exitCode === 0
    ? attempt(() => observed(request))
    : Effect.fail(failure(`Command exited ${result.exitCode}: ${result.stderr.trim()}`))))
const materialized = (request: CatalogStructuredRequest) => attempt(() => {
  const operation = request.operation
  switch (operation._tag) {
    case "Check":
      if (!existsSync(pathOf(request.root, operation.path))) {
        throw failure(`Required path ${operation.path} is absent.`)
      }
      break
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
  return observed(request)
})
const structured = (run: RunCommand): DriverCatalogShape["structured"] => (request) =>
  request.operation._tag === "Exec"
    ? executed(run, request, request.operation)
    : materialized(request)
const credentials: CredentialStoreShape = {
  getRead: (slot) => readOptionalEnv(slot.name).pipe(Effect.map((value) => value ?? "")),
  getPublish: (slot) => readOptionalEnv(slot.name).pipe(Effect.flatMap((value) =>
    value === undefined || value.length === 0
      ? Effect.fail(failure(`Credential ${slot.name} is unavailable.`))
      : Effect.succeed(value)))
}
// The live drivers are written once and parameterized by the two capabilities
// that actually differ across hosts. Spawning and HTTP are acquired here, at
// layer construction, so every DriverCatalog method keeps R = never and a fake
// stays a plain shape behind Layer.succeed.
export const LiveDriversLayer: Layer.Layer<
  WorkspaceStore | DriverCatalog | CredentialStore,
  never,
  ChildProcessSpawner | HttpClient.HttpClient
> = Layer.mergeAll(
  Layer.succeed(WorkspaceStore)(makeNodeWorkspaceStore()),
  Layer.effect(DriverCatalog)(Effect.gen(function*() {
    const run = yield* makeRunCommand
    const client = yield* HttpClient.HttpClient
    return makeCatalog(structured(run), { client, run })
  })),
  Layer.succeed(CredentialStore)(credentials)
)
export const normalizeWorkspaceRoot = (path: string): string => realpathSync(path)
