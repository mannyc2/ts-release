import { readText, releaseWorkflowPath, report } from "./self-release-facts.js"

const workflow = readText(releaseWorkflowPath)
const failures: Array<string> = []
if (!workflow.includes("apps/ts-release-action")) failures.push("The release workflow does not invoke the first-party Action.")
if (!workflow.includes("config: apps/release-ts/release.config.json")) failures.push("The release workflow does not pass the self-release configuration.")
if (!workflow.includes("environment: release")) failures.push("The publish job is not protected by the release environment.")
if (/\b(?:plan|apply|doctor|ship)\b/u.test(workflow)) failures.push("The release workflow retains an obsolete lifecycle command.")
report("self-release-readiness-report/v3", failures, { networkChecks: 0 })
