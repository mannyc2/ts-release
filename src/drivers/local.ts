import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import {
  existsSync,
  lstatSync,
  readdirSync,
  realpathSync,
  statSync,
  type Dirent
} from "node:fs"
import { basename, join, resolve } from "node:path"
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
import { contained } from "./contain.js"
import { makeNodeWorkspaceStore, secureRead, secureWrite } from "./workspace.js"
import { tarGz, zip, type ArchiveEntry } from "./archive.js"
import { matchGlob } from "./glob.js"
import { readOptionalEnv } from "./environment.js"
import { makeRunCommand, type RunCommand } from "./process.js"
import { makeCatalog } from "./remote.js"
import { failure, sha256 } from "./utils.js"

const pathOf = (root: string, path: string): string => resolve(root, path)
const outputFacts = (root: string, output: OutputDeclaration): MaterializedOutput => {
  const path = pathOf(root, output.path)
  // A symlink at a declared output path refuses: the recorded digest must
  // attest the workspace file itself, never a link target.
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !statSync(path).isFile()) {
    throw failure(`Declared output ${output.id} was not materialized.`)
  }
  const source = secureRead(root, output.path)
  const digest = sha256(source.bytes)
  return MaterializedOutput.make({
    outputId: output.id,
    snapshotId: SnapshotId.make(digest),
    digest: Digest.make(digest),
    size: source.bytes.length,
    inode: source.inode
  })
}
const input = (request: CatalogStructuredRequest, id: string): OutputDeclaration => {
  const found = request.availableOutputs.find((output) => output.id === id)
  if (found === undefined) throw failure(`Operation references unavailable output ${id}.`)
  return found
}
// One byte ordering for every archive path: plain codepoint comparison, so
// release bytes cannot depend on the host locale.
const byCodepoint = (left: ArchiveEntry, right: ArchiveEntry): number =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0
const entries = (request: CatalogStructuredRequest): ReadonlyArray<ArchiveEntry> =>
  request.operation.inputs.map((id) => {
    const output = input(request, id)
    const mode = output.kind === "executable" ? 0o100755 : 0o100644
    return { path: basename(output.path), data: secureRead(request.root, output.path).bytes, mode }
  }).sort(byCodepoint)
const normalizeSlashes = (value: string): string => value.replaceAll("\\", "/")
const containedRealPath = (realRoot: string, child: string, relative: string): string => {
  const real = realpathSync(child)
  if (contained(realRoot, real)) return real
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
  if (wildcard >= 0) {
    const prefix = segments.slice(0, wildcard).join("/")
    if (prefix.length > 0 && existsSync(join(realRoot, prefix))) {
      containedRealPath(realRoot, join(realRoot, prefix), prefix)
    }
    return walkFiles(realRoot, prefix, new Set())
  }
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
  let combined: ReadonlyArray<ArchiveEntry> = declared
  if (patterns.length > 0) {
    const realRoot = realpathSync(request.root)
    const excluded = new Set(operation.outputs.map((output) => normalizeSlashes(output.path)))
    const matched = matchedWorkspaceFiles(realRoot, patterns, excluded)
    if (matched.length === 0) throw failure(`Archive ${operation.id} patterns matched no workspace files.`)
    combined = [...declared, ...matched.map((path) => ({
      path, data: secureRead(realRoot, path).bytes, mode: 0o100644
    }))]
  }
  if (combined.length === 0) throw failure(`Archive ${operation.id} has zero entries.`)
  const duplicate = combined.map((entry) => entry.path).find((path, index, all) => all.indexOf(path) !== index)
  if (duplicate !== undefined) throw failure(`Archive ${operation.id} has duplicate entry ${duplicate}.`)
  return [...combined].sort(byCodepoint)
}
const content = (request: CatalogStructuredRequest): string => {
  const operation = request.operation
  if (operation._tag !== "Write") throw failure("Expected Write operation.")
  if (typeof operation.content === "string") return operation.content
  return operation.content.map((part) => {
    if (typeof part === "string") return part
    const output = input(request, part.outputId)
    if (part.fact === "assetName") return basename(output.path)
    if (part.fact === "sha256") return sha256(secureRead(request.root, output.path).bytes)
    throw failure(
      "downloadUrl facts require a product-owned preset value (lowered plans resolve this at plan time)."
    )
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
    case "Check": {
      // lstat-based: a symlink (dangling or not) is never "present" — the
      // required path must be the workspace entry itself.
      const path = pathOf(request.root, operation.path)
      let present = false
      try {
        present = !lstatSync(path).isSymbolicLink()
      } catch {
        present = false
      }
      if (!present) throw failure(`Required path ${operation.path} is absent.`)
      break
    }
    case "Write": {
      secureWrite(request.root, operation.path, content(request))
      break
    }
    case "Pack": {
      const archive = packEntries(request, operation)
      secureWrite(request.root, operation.outputs[0]!.path,
        operation.format === "zip" ? zip(archive) : tarGz(archive))
      break
    }
    case "Digest": {
      secureWrite(request.root, operation.outputs[0]!.path, operation.inputs.map((id) => {
        const output = input(request, id)
        return `${sha256(secureRead(request.root, output.path).bytes)}  ${basename(output.path)}`
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
