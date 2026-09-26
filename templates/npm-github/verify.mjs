import { readFile } from "node:fs/promises"
import { Schema } from "effect"
import {
  BoundedObservationOptions,
  runApplication,
  runInterruptibleProcess,
} from "@mannyc1/ts-release/node"

// Registry acceptance can precede public visibility. Refresh only native provider
// observations; no iteration can dispatch a publication or authorize a retry.
const [application, inputFile] = process.argv.slice(2)
const input = JSON.parse(await readFile(inputFile, "utf8"))
// Importing the policy Schema also refuses an older executor before invocation;
// old runners do not understand the bounded observation mode object.
const policy = Schema.decodeUnknownSync(BoundedObservationOptions)({
  mode: "observe",
  definitionIds: ["npm.publish", "github.publish"],
  budgetMilliseconds: Number(process.env.TS_RELEASE_OBSERVATION_BUDGET_MS ?? 300000),
  initialDelayMilliseconds: 10000,
  maximumDelayMilliseconds: 10000,
})
process.exitCode = await runInterruptibleProcess(async (signal, exitCode) => {
  try {
    const report = await runApplication(application, { ...input, authorize: false }, signal, policy)
    const { visibility } = report
    if (!visibility) throw new Error("Executor did not return bounded observation state")
    if (visibility.status === "Conflict")
      throw new Error("Published content conflicts with the retained release")
    if (visibility.status === "Satisfied") {
      console.log(
        JSON.stringify({
          planId: report.plan.planId,
          journalRevision: report.journal.revision,
          status: "publication-visible",
          operations: visibility.operations.length,
        }),
      )
      return 0
    }
    console.log(
      JSON.stringify({
        planId: report.plan.planId,
        journalRevision: report.journal.revision,
        status: "publication-pending",
        visibility,
      }),
    )
    process.stderr.write(
      "Publication visibility is unconfirmed. Retain the original Bundle, Plan and journal; continue observation before any further publication.\n",
    )
    return 2
  } catch (error) {
    if (signal.aborted) return exitCode()
    throw error
  }
})
