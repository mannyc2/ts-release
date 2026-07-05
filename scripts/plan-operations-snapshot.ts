import { readFileSync } from "node:fs"
import { stdin, stderr, stdout, argv, exit } from "node:process"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isOperationArray = (value: unknown): value is ReadonlyArray<Record<string, unknown>> =>
  Array.isArray(value) && value.every(isRecord)

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

export const planOperationSnapshotLines = (document: unknown): ReadonlyArray<string> => {
  const operations = readOperations(document)
  if (operations === undefined) {
    throw new Error("Plan document must have v1 operations or v2 state.operations.")
  }

  const lines: Array<string> = []
  for (const operation of operations) {
    const id = operation.id
    const risk = operation.risk
    if (typeof id !== "string" || typeof risk !== "string") {
      throw new Error("Every operation must have string id and risk fields.")
    }
    lines.push(`${id}\t${risk}`)
  }
  return lines.sort()
}

export const formatPlanOperationSnapshot = (document: unknown): string => {
  const lines = planOperationSnapshotLines(document)
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`
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
  if (planPath === undefined) {
    stderr.write("usage: bun run scripts/plan-operations-snapshot.ts <plan.json>\n")
    exit(1)
  }

  try {
    const document: unknown = JSON.parse(await readInput(planPath))
    stdout.write(formatPlanOperationSnapshot(document))
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    exit(1)
  }
}

if (import.meta.main) {
  await main()
}
