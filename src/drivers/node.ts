import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import {
  CredentialStore,
  DriverCatalog,
  WorkspaceStore,
  type CatalogStructuredRequest,
} from "./services.js"
import {
  Digest,
  SnapshotId
} from "../model/primitives.js"
import {
  DriverError,
  MaterializedOutput
} from "../model/run.js"
import type { OutputDeclaration } from "../model/operation.js"
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
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, operation.format === "zip" ? zip(entries(request)) : tarGz(entries(request)))
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
