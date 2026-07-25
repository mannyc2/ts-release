import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { stdin, stderr, stdout, argv, exit } from "node:process"
import {
  deferredContentArtifactIds,
  renderDeferredContent
} from "../src/run/content.js"
import type { DeferredFileContent } from "../src/grammar/content.js"
import { decodeReleasePlanSync, type ReleasePlan } from "../src/grammar/plan.js"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isDeferredFileContent = (value: unknown): value is DeferredFileContent =>
  isRecord(value) &&
  value._tag === "file-parts"

const digestFile = (path: string, algorithm: "sha256" | "sha512"): string =>
  createHash(algorithm).update(readFileSync(path)).digest("hex")

export const planOperationContents = (plan: ReleasePlan, operationId: string): string => {
  const operation = plan.operations.find((candidate) => candidate.id === operationId)
  if (operation === undefined) {
    throw new Error(`Operation ${operationId} was not found.`)
  }
  if (operation.action._tag !== "write-file") {
    throw new Error(`Operation ${operationId} does not contain render contents.`)
  }
  const contents = operation.action.contents
  if (typeof contents === "string") {
    return contents
  }
  if (!isDeferredFileContent(contents)) {
    return `${JSON.stringify(contents, null, 2)}\n`
  }

  // v5 plans no longer carry a root (plan 169.1, D3). This script is invoked from the
  // workspace whose plan it was handed, so deferred content resolves against the cwd.
  const root = "."
  const hashes = new Map<string, string>()
  const outputPath = operation.action.path
  const outputArtifact = plan.artifacts.find((artifact) =>
    artifact.path === outputPath && artifact.extra?._tag === "checksum-file"
  )
  const algorithm = outputArtifact?.extra?._tag === "checksum-file"
    ? outputArtifact.extra.algorithm
    : "sha256"
  for (const artifactId of deferredContentArtifactIds(contents)) {
    const artifact = plan.artifacts.find((candidate) => candidate.id === artifactId)
    if (artifact === undefined) {
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
    const plan = decodeReleasePlanSync(JSON.parse(await readInput(planPath)))
    stdout.write(planOperationContents(plan, operationId))
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    exit(1)
  }
}

if (import.meta.main) {
  await main()
}
