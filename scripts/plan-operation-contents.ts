import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { stdin, stderr, stdout, argv, exit } from "node:process"
import {
  deferredContentArtifactIds,
  deferredContentDigestAlgorithm,
  renderDeferredContent
} from "../src/engine/content.js"
import type { DeferredFileContent } from "../src/pipeline/operation.js"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isOperationArray = (value: unknown): value is ReadonlyArray<Record<string, unknown>> =>
  Array.isArray(value) && value.every(isRecord)

const isDeferredFileContent = (value: unknown): value is DeferredFileContent =>
  isRecord(value) &&
  (value._tag === "homebrew-formula" || value._tag === "scoop-manifest" || value._tag === "checksum-file")

const documentRoot = (document: Record<string, unknown>): string => {
  const source = document.source
  if (isRecord(source) && typeof source.root === "string") {
    return source.root
  }
  return "."
}

const readArtifactCatalog = (document: Record<string, unknown>): ReadonlyArray<Record<string, unknown>> => {
  const state = document.state
  if (isRecord(state) && isRecord(state.artifacts) && isOperationArray(state.artifacts.artifacts)) {
    return state.artifacts.artifacts
  }
  const artifacts = document.artifacts
  if (isOperationArray(artifacts)) {
    return artifacts
  }
  return []
}

const readOperations = (document: unknown): ReadonlyArray<Record<string, unknown>> | undefined => {
  if (!isRecord(document)) {
    return undefined
  }
  if (isOperationArray(document.operations)) {
    return document.operations
  }
  if (document.schemaVersion === "release-plan/v2" && isRecord(document.state) && isOperationArray(document.state.operations)) {
    return document.state.operations
  }
  return undefined
}

const operationContents = (operation: Record<string, unknown>): unknown => {
  if ("contents" in operation) {
    return operation.contents
  }
  const action = operation.action
  if (!isRecord(action)) {
    return undefined
  }
  if ("contents" in action) {
    return action.contents
  }
  if ("content" in action) {
    return action.content
  }
  return undefined
}

const digestFile = (path: string, algorithm: "sha256" | "sha512"): string =>
  createHash(algorithm).update(readFileSync(path)).digest("hex")

export const planOperationContents = (document: unknown, operationId: string): string => {
  if (!isRecord(document)) {
    throw new Error("Plan document must be an object.")
  }
  const operations = readOperations(document)
  if (operations === undefined) {
    throw new Error("Plan document must have v1 operations or v2 state.operations.")
  }

  const operation = operations.find((candidate) => candidate.id === operationId)
  if (operation === undefined) {
    throw new Error(`Operation ${operationId} was not found.`)
  }
  const contents = operationContents(operation)
  if (contents === undefined) {
    throw new Error(`Operation ${operationId} does not contain render contents.`)
  }
  if (typeof contents === "string") {
    return contents
  }
  if (!isDeferredFileContent(contents)) {
    return `${JSON.stringify(contents, null, 2)}\n`
  }

  const root = documentRoot(document)
  const artifacts = readArtifactCatalog(document)
  const hashes = new Map<string, string>()
  const algorithm = deferredContentDigestAlgorithm(contents)
  for (const artifactId of deferredContentArtifactIds(contents)) {
    const artifact = artifacts.find((candidate) => candidate.id === artifactId)
    if (artifact === undefined || typeof artifact.path !== "string") {
      throw new Error(`Artifact ${artifactId} was not found for operation ${operationId}.`)
    }
    hashes.set(artifactId, digestFile(join(root, artifact.path), algorithm))
  }
  return renderDeferredContent(contents, hashes).contents
}

const readStdin = async (): Promise<string> => {
  const chunks: Array<Buffer> = []
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf8")
}

const readInput = async (path: string): Promise<string> =>
  path === "-" ? readStdin() : readFileSync(path, "utf8")

const main = async (): Promise<void> => {
  const planPath = argv[2]
  const operationId = argv[3]
  if (planPath === undefined || operationId === undefined) {
    stderr.write("usage: bun run scripts/plan-operation-contents.ts <plan.json> <operationId>\n")
    exit(1)
  }

  try {
    const document: unknown = JSON.parse(await readInput(planPath))
    stdout.write(planOperationContents(document, operationId))
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    exit(1)
  }
}

if (import.meta.main) {
  await main()
}
