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
interface WorkflowDocument {
  readonly on?: Readonly<Record<string, {
    readonly inputs?: Readonly<Record<string, {
      readonly required?: boolean
      readonly default?: unknown
      readonly type?: string
    }>>
  } | null>>
  readonly jobs?: Readonly<Record<string, {
    readonly if?: string
    readonly permissions?: Readonly<Record<string, string>>
    readonly steps?: ReadonlyArray<{
      readonly name?: string
      readonly if?: string
      readonly run?: string
      readonly uses?: string
      readonly env?: Readonly<Record<string, unknown>>
      readonly with?: Readonly<Record<string, unknown>>
    }>
  }>>
}
const parsedWorkflow = Bun.YAML.parse(workflow) as WorkflowDocument
if (Object.keys(parsedWorkflow.on ?? {}).join("\0") !== "workflow_dispatch") {
  failures.push("The automatic release workflow must expose workflow_dispatch as its only trigger.")
}
const dispatchInputs = parsedWorkflow.on?.workflow_dispatch?.inputs
if (dispatchInputs?.candidate_sha?.required !== true || dispatchInputs.candidate_sha.type !== "string") {
  failures.push("The automatic release workflow must require the canonical candidate_sha input.")
}
if (dispatchInputs?.prepared_ref?.required !== false || dispatchInputs.prepared_ref.type !== "string" ||
    dispatchInputs.prepared_ref.default !== "") {
  failures.push("The automatic release workflow must expose an optional empty-by-default prepared_ref recovery input.")
}
const jobs = Object.entries(parsedWorkflow.jobs ?? {})
if (jobs.length !== 1 || jobs[0]?.[0] !== "release") failures.push("The automatic release workflow must remain one job.")
const releaseJob = parsedWorkflow.jobs?.release
const repositoryAdmission = "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha }}"
if (releaseJob?.if !== repositoryAdmission) {
  failures.push("The automatic release job must reject a repository, main-ref, or exact candidate SHA mismatch before checkout.")
}
if (releaseJob?.permissions?.actions !== "read") {
  failures.push("The automatic release job must grant actions: read for exact prepared-ref recovery.")
}
const actionSteps = (releaseJob?.steps ?? []).filter((step) => step.uses === "./apps/ts-release-action")
if (actionSteps.length !== 1) failures.push("The automatic release workflow must invoke the first-party Action exactly once.")
const actionInputs = actionSteps[0]?.with
if (actionSteps[0]?.env?.GITHUB_TOKEN !== "${{ github.token }}") {
  failures.push("The automatic release Action must receive the job-scoped GITHUB_TOKEN for provider and recovery authentication.")
}
if (actionInputs?.command !== "${{ inputs.prepared_ref == '' && 'release' || 'publish' }}") {
  failures.push("The automatic release Action must select release only when prepared_ref is empty and publish otherwise.")
}
if (actionInputs?.config !== `\${{ inputs.prepared_ref == '' && '${releaseConfigPath}' || '' }}` ||
    actionInputs.prepared !== "${{ inputs.prepared_ref }}") {
  failures.push("The automatic release Action must pass config and prepared inputs mutually exclusively.")
}
const releaseSteps = releaseJob?.steps ?? []
const actionIndex = releaseSteps.findIndex((step) => step.uses === "./apps/ts-release-action")
const beforeAction = actionIndex < 0 ? [] : releaseSteps.slice(0, actionIndex)
const primeSteps = beforeAction.filter((step) => step.name === "Prime isolated Bun dependency cache")
const expectedPrimeRun = [
  "bun install --frozen-lockfile --ignore-scripts --no-save --linker=hoisted",
  "bun --no-env-file --no-install -e 'await (await import(\"node:fs/promises\")).rm(\"node_modules\", { recursive: true, force: true })'"
].join("\n")
if (primeSteps.length !== 1 || primeSteps[0]?.if !== "${{ inputs.prepared_ref == '' }}" ||
    primeSteps[0]?.run !== expectedPrimeRun) {
  failures.push("The automatic release workflow must prime Bun's cache once, remove root node_modules, and skip both operations during recovery.")
}
if (!beforeAction.some((step) => step.uses === "actions/setup-node@v4") ||
    !beforeAction.some((step) => step.run === "bun add --global npm@11.5.1")) {
  failures.push("The automatic release workflow must provision the pinned Node and npm tools before preparation.")
}
if (beforeAction.filter((step) => step.run?.includes("bun install")).length !== 1) {
  failures.push("The automatic release workflow must contain exactly one dependency install, confined to cache priming.")
}
if (workflow.includes("${{ false }}") || workflow.includes("__ts_release_quarantined__")) {
  failures.push("The automatic release workflow retains a dead trigger or false guard.")
}
const reportUploads = workflow.match(/uses: actions\/upload-artifact@v4/gu)?.length ?? 0
if (reportUploads !== 1 ||
    !workflow.includes("path: ${{ steps.release.outputs.report-ref }}") ||
    !workflow.includes("always() && steps.release.outputs.report-ref != ''")) {
  failures.push("The automatic release workflow must upload exactly one redacted Action report artifact.")
}
if (workflow.includes("actions/download-artifact@v4") ||
    /(?:name|path):[^\n]*(?:prepared-ref|ts-release-prepared)/u.test(workflow)) {
  failures.push("The automatic release workflow duplicates the Action's durable prepared store.")
}
if (!workflow.includes("persist-credentials: false")) failures.push("The automatic release checkout retains Git credentials.")
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
