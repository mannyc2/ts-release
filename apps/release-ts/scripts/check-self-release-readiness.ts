import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import {
  candidateActionReference, readText, report, releaseConfigPath, releaseWorkflowPath,
  root, selfReleaseConfig
} from "./self-release-facts.js"

const failures: Array<string> = []
const actionReference = candidateActionReference()
const candidatePlaceholder = ["__TS_RELEASE_ACTION_", "REF__"].join("")
const publicDocuments = [
  "README.md", "templates/github-actions/release.yml", "templates/github-actions/reviewed-release.yml"
]
for (const path of publicDocuments) {
  const text = readText(path)
  if (!text.includes(actionReference)) failures.push(`${path} does not bind the exact candidate Action reference ${actionReference}.`)
  if (text.includes(candidatePlaceholder)) failures.push(`${path} retains the Action candidate placeholder.`)
}
const workflow = readText(releaseWorkflowPath)
if (!workflow.includes("uses: ./apps/ts-release-action")) failures.push("The automatic release workflow does not invoke the first-party Action.")
if (!workflow.includes(`config: ${releaseConfigPath}`)) failures.push("The automatic release workflow does not pass the self-release configuration.")
for (const command of ["prepare", "inspect", "publish"]) if (!workflow.includes(`command: ${command}`)) failures.push(`The automatic release workflow does not invoke ${command}.`)
if (!workflow.includes("actions/upload-artifact@v4") || !workflow.includes("actions/download-artifact@v4")) failures.push("The automatic release workflow does not persist the prepared bundle across jobs.")
if (/\benvironment:/u.test(workflow)) failures.push("The automatic self-release workflow imposes a host review gate.")
if (/\b(?:plan|apply|doctor|ship)\b/u.test(workflow)) failures.push("The automatic self-release workflow retains a retired lifecycle command.")

const api = makeReleaseApi(NodeReleaseLayer)
try {
  const inspection = await api.inspect({ config: selfReleaseConfig(), workspace: root })
  if (!("preparations" in inspection)) failures.push("Readiness inspection did not return the authored graph projection.")
  else if (inspection.publications.length !== 2) failures.push(`Readiness expected npm and GitHub publication intents, found ${inspection.publications.length}.`)
} catch (cause) {
  failures.push(`Readiness inspection failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`)
} finally {
  await api.dispose()
}

const npmState = process.env.NPM_TOKEN === undefined ? "UNVERIFIED: NPM_TOKEN unavailable; no registry read attempted." : "UNVERIFIED: credential present; remote read is reserved for the operator packet."
const githubState = process.env.GITHUB_TOKEN === undefined && process.env.GH_TOKEN === undefined
  ? "UNVERIFIED: GITHUB_TOKEN/GH_TOKEN unavailable; no GitHub read attempted."
  : "UNVERIFIED: credential present; remote read is reserved for the operator packet."
report("self-release-readiness-report/v1", failures, {
  actionReference, npm: npmState, github: githubState,
  selectedCoordinates: { npmVersion: "0.2.0", githubTag: "v0.2.0", action: actionReference },
  evidenceState: "UNVERIFIED", readOnlyNetworkChecks: 0
})
