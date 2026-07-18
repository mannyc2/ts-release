import { readFileSync } from "node:fs"
import { stdin, stderr, stdout, argv, exit } from "node:process"
import { decodeReleasePlanSync, type ReleasePlan } from "../src/pipeline/plan.js"

export const planOperationSnapshotLines = (plan: ReleasePlan): ReadonlyArray<string> =>
  plan.operations.map((operation) => `${operation.id}\t${operation.risk}`).sort()

export const formatPlanOperationSnapshot = (plan: ReleasePlan): string => {
  const lines = planOperationSnapshotLines(plan)
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
    const plan = decodeReleasePlanSync(JSON.parse(await readInput(planPath)))
    stdout.write(formatPlanOperationSnapshot(plan))
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    exit(1)
  }
}

if (import.meta.main) {
  await main()
}
