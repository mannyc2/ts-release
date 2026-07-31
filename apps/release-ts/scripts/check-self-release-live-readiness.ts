import { plan, reviewExecution } from "@mannyc1/ts-release"
import {
  readJson, readText, releaseConfigPath, releaseWorkflowPath, report, root
} from "./self-release-facts.js"

const failures: Array<string> = []
const planned = await plan({ config: readJson(releaseConfigPath), workspace: root })
const review = await reviewExecution({
  planBytes: planned.bytes,
  expectedPlanId: planned.planId,
  scope: "all"
})
const workflow = readText(releaseWorkflowPath)

for (const command of ["plan", "apply"]) {
  if (!workflow.includes(`command: ${command}`) && !workflow.includes(` ${command} `)) {
    failures.push(`The release workflow does not contain the ${command} boundary.`)
  }
}
for (const removed of ["command: build", "command: release", "command: verify"]) {
  if (workflow.includes(removed)) failures.push(`The release workflow retains ${removed}.`)
}
if (!workflow.includes("environment: release")) {
  failures.push("The publish job is not protected by the release environment.")
}

report("self-release-readiness-report/v2", failures, {
  planId: planned.planId,
  executionReviewId: review.executionReviewId,
  operationCount: review.scope.operationIds.length,
  networkChecks: 0
})
