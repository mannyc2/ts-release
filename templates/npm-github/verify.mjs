import { readFile } from "node:fs/promises"
import { setTimeout } from "node:timers/promises"
import { runApplication, runInterruptibleProcess } from "@mannyc1/ts-release/node"

// Registry acceptance can precede public visibility. Refresh only native provider
// observations; no iteration can dispatch a publication or authorize a retry.
const [application, inputFile] = process.argv.slice(2)
const input = JSON.parse(await readFile(inputFile, "utf8"))
process.exitCode = await runInterruptibleProcess(async (signal, exitCode) => {
  try {
    for (let attempt = 0; attempt < 31; attempt++) {
      const report = await runApplication(application, input, signal, "observe")
      const required = report.plan.operations.filter((operation) =>
        ["npm.publish", "github.publish"].includes(operation.definitionId),
      )
      if (required.length === 0)
        throw new Error("Visibility verification requires a nonempty release")
      const observed = new Map()
      for (const event of report.journal.events) {
        if (
          event.planId === report.plan.planId &&
          event.body._tag === "ObservationRecorded" &&
          event.body.evidenceKind === "Observation"
        )
          observed.set(event.body.operationId, event.body.status)
      }
      if (required.some((operation) => observed.get(operation.operationId) === "Conflict"))
        throw new Error("Published content conflicts with the retained release")
      if (required.every((operation) => observed.get(operation.operationId) === "Satisfied")) {
        console.log(
          JSON.stringify({
            planId: report.plan.planId,
            journalRevision: report.journal.revision,
            status: "publication-visible",
            operations: required.length,
          }),
        )
        return 0
      }
      if (attempt < 30) await setTimeout(10000, undefined, { signal })
    }
    process.stderr.write(
      "Publication visibility is unconfirmed. Retain the original Bundle, Plan and journal; continue observation before any further publication.\n",
    )
    return 2
  } catch (error) {
    if (signal.aborted) return exitCode()
    throw error
  }
})
