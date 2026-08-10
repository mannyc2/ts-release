import { readText, releaseWorkflowPath, report } from "./self-release-facts.js"

const workflow = readText(releaseWorkflowPath)
const failures: Array<string> = []
if (!workflow.includes("uses: ./apps/ts-release-action")) failures.push("The release workflow does not invoke the first-party Action.")
if (!workflow.includes("config: apps/release-ts/release.config.json")) failures.push("The release workflow does not pass the self-release configuration.")
for (const command of ["prepare", "inspect", "publish"]) if (!workflow.includes(`command: ${command}`)) failures.push(`The release workflow does not invoke ${command}.`)
if (!workflow.includes("actions/upload-artifact@v4") || !workflow.includes("actions/download-artifact@v4")) failures.push("The release workflow does not persist the prepared bundle across jobs.")
if (/\benvironment:/u.test(workflow)) failures.push("The automatic self-release workflow must not impose a host review gate.")
if (/\b(?:plan|apply|doctor|ship)\b/u.test(workflow)) failures.push("The release workflow retains an obsolete lifecycle command.")
report("self-release-readiness-report/v4", failures, { networkChecks: 0 })
