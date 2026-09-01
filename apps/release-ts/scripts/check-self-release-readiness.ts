import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import {
  candidateActionReference, packagePath, readJson, readText, releaseWorkflowPath,
  report, root, selfReleaseConfigs, stringField
} from "./self-release-facts.js"

interface WorkflowStep {
  readonly id?: string
  readonly name?: string
  readonly if?: string
  readonly "continue-on-error"?: boolean
  readonly uses?: string
  readonly run?: string
  readonly env?: Readonly<Record<string, unknown>>
  readonly with?: Readonly<Record<string, unknown>>
}
interface WorkflowJob {
  readonly if?: string
  readonly needs?: string | ReadonlyArray<string>
  readonly environment?: string
  readonly permissions?: Readonly<Record<string, string>>
  readonly outputs?: Readonly<Record<string, string>>
  readonly "runs-on"?: string
  readonly steps?: ReadonlyArray<WorkflowStep>
}
interface WorkflowDocument {
  readonly permissions?: Readonly<Record<string, string>>
  readonly on?: Readonly<Record<string, {
    readonly inputs?: Readonly<Record<string, {
      readonly required?: boolean
      readonly default?: unknown
      readonly type?: string
      readonly options?: ReadonlyArray<string>
    }>>
  } | null>>
  readonly jobs?: Readonly<Record<string, WorkflowJob>>
}

const failures: Array<string> = []
const actionReference = candidateActionReference()
const version = stringField(readJson(packagePath), "version")
const publicDocuments = [
  "README.md", "templates/github-actions/release.yml", "templates/github-actions/reviewed-release.yml"
]
for (const path of publicDocuments) {
  const text = readText(path)
  if (!text.includes(actionReference)) failures.push(`${path} does not bind ${actionReference}.`)
  if (text.includes(["__TS_RELEASE_ACTION_", "REF__"].join(""))) failures.push(`${path} retains the Action candidate placeholder.`)
}

const workflow = readText(releaseWorkflowPath)
const parsed = Bun.YAML.parse(workflow) as WorkflowDocument
if (Object.keys(parsed.on ?? {}).join("\0") !== "workflow_dispatch") failures.push("Self-release must remain manual-only.")
if (Object.keys(parsed.permissions ?? {}).length !== 0) failures.push("Self-release top-level permissions must be empty.")
const inputs = parsed.on?.workflow_dispatch?.inputs
if (inputs?.candidate_sha?.required !== true || inputs.candidate_sha.type !== "string") failures.push("Self-release must require candidate_sha.")
if (inputs?.prepared_ref?.required !== false || inputs.prepared_ref.default !== "" || inputs.prepared_ref.type !== "string") {
  failures.push("Self-release must expose one optional empty-by-default prepared_ref.")
}
if (inputs?.npm_prepared_ref?.required !== false || inputs.npm_prepared_ref.default !== "" || inputs.npm_prepared_ref.type !== "string") {
  failures.push("Self-release must expose one optional empty-by-default npm_prepared_ref.")
}
if (inputs?.mode?.required !== true || inputs.mode.type !== "choice" ||
    inputs.mode.options?.join(",") !== "prepare-exact-sha,certify-npm-oidc,create-tag,publish-npm,publish-github") {
  failures.push("Self-release must expose only the five hard-cut authority modes.")
}

const jobs = parsed.jobs ?? {}
if (Object.keys(jobs).join(",") !== "admit,prepare,create-tag,certify-npm-oidc,publish-npm,preflight-github,publish-github") {
  failures.push("Self-release must contain one mandatory admission job, one read-only GitHub preflight, and exactly five authority jobs.")
}
const admission = jobs.admit
const admissionStep = admission?.steps?.[0]
if (admission?.if !== undefined || admission?.environment !== undefined || admission?.permissions !== undefined ||
    admission?.["runs-on"] !== "ubuntu-24.04" || admission?.steps?.length !== 1 ||
    JSON.stringify(admission.outputs) !== JSON.stringify({ selected_job: "${{ steps.admit.outputs.selected_job }}" }) ||
    admissionStep?.id !== "admit" || typeof admissionStep.run !== "string") {
  failures.push("Self-release admission must be one unconditional fixed-runner job with one selected_job output.")
}
for (const required of [
  "GITHUB_REPOSITORY_ID", "GITHUB_REPOSITORY_OWNER_ID", "GITHUB_WORKFLOW_REF", "GITHUB_WORKFLOW_SHA",
  "prepare-exact-sha", "certify-npm-oidc", "create-tag", "publish-npm", "publish-github", "admit_prepared",
  "selected_job=%s"
]) {
  if (!admissionStep?.run?.includes(required)) failures.push(`Self-release admission omits ${required}.`)
}
const admissions = {
  prepare: "${{ needs.admit.outputs.selected_job == 'prepare' }}",
  "create-tag": "${{ needs.admit.outputs.selected_job == 'create-tag' }}",
  "certify-npm-oidc": "${{ needs.admit.outputs.selected_job == 'certify-npm-oidc' }}",
  "publish-npm": "${{ needs.admit.outputs.selected_job == 'publish-npm' }}",
  "preflight-github": "${{ needs.admit.outputs.selected_job == 'publish-github' }}",
  "publish-github": "${{ needs.admit.outputs.selected_job == 'publish-github' && needs.preflight-github.result == 'success' }}"
} as const
for (const [name, expected] of Object.entries(admissions)) {
  if (jobs[name]?.if !== expected) failures.push(`${name} does not fail closed at the exact repository/ref/SHA/mode boundary.`)
  const expectedNeeds = name === "publish-github" ? ["admit", "preflight-github"] : "admit"
  if (JSON.stringify(jobs[name]?.needs) !== JSON.stringify(expectedNeeds)) {
    failures.push(`${name} does not require its exact admission/preflight result set.`)
  }
  if (jobs[name]?.["runs-on"] !== "ubuntu-24.04") failures.push(`${name} does not use the fixed runner image.`)
}
if (jobs.prepare?.environment !== undefined || JSON.stringify(jobs.prepare?.permissions) !== JSON.stringify({ contents: "read" })) {
  failures.push("Preparation must be environment-free and contents-read-only.")
}
if (jobs["create-tag"]?.environment !== "github-tag" ||
    JSON.stringify(jobs["create-tag"]?.permissions) !== JSON.stringify({ contents: "write" })) {
  failures.push("Tag creation must use only the github-tag environment and contents-write authority.")
}
if (jobs["publish-github"]?.environment !== "github-release" ||
    JSON.stringify(jobs["publish-github"]?.permissions) !== JSON.stringify({ actions: "read", contents: "write" })) {
  failures.push("GitHub publication must use only the github-release environment and GitHub mutation authority.")
}
if (jobs["preflight-github"]?.environment !== undefined ||
    JSON.stringify(jobs["preflight-github"]?.permissions) !== JSON.stringify({ actions: "read", contents: "read" }) ||
    JSON.stringify(jobs["preflight-github"]?.outputs) !== JSON.stringify({
      "artifact-name": "${{ steps.npm-inspect-report.outputs.artifact-name }}",
      "artifact-id": "${{ steps.npm-inspect-report.outputs.artifact-id }}",
      "artifact-digest": "${{ steps.npm-inspect-report.outputs.artifact-digest }}",
      "report-sha256": "${{ steps.npm-inspect-report.outputs.report-sha256 }}"
    })) {
  failures.push("GitHub npm preflight must be environment-free, read-only, and hand off one exact retained receipt identity.")
}
if (jobs["publish-npm"]?.environment !== "npm" ||
    JSON.stringify(jobs["publish-npm"]?.permissions) !== JSON.stringify({ actions: "read", contents: "read", "id-token": "write" })) {
  failures.push("npm publication must use only the npm environment, prepared-store read, and OIDC authority.")
}
if (jobs["certify-npm-oidc"]?.environment !== "npm" ||
    JSON.stringify(jobs["certify-npm-oidc"]?.permissions) !== JSON.stringify({ actions: "read", contents: "read", "id-token": "write" })) {
  failures.push("npm OIDC certification must use only the npm environment, prepared-store read, and OIDC authority.")
}

const expectedPins = new Map([
  ["actions/checkout", "11d5960a326750d5838078e36cf38b85af677262"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
  ["oven-sh/setup-bun", "0c5077e51419868618aeaa5fe8019c62421857d6"],
  ["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"]
])
const actionSteps: Array<{ readonly job: string, readonly step: WorkflowStep }> = []
const retainedReportSteps: Array<{ readonly job: string, readonly step: WorkflowStep }> = []
let reportUploads = 0
for (const [job, definition] of Object.entries(jobs)) for (const step of definition.steps ?? []) {
  if (step.uses === "./apps/ts-release-action" || step.uses === "mannyc2/ts-release/apps/ts-release-action@v0.3.0") {
    actionSteps.push({ job, step })
  }
  if (step.uses === "./apps/ts-release-action/report-retainer") retainedReportSteps.push({ job, step })
  if (typeof step.uses === "string" && step.uses.startsWith("actions/upload-artifact@")) reportUploads += 1
  if (typeof step.uses === "string" && !step.uses.startsWith("./")) {
    const [ownerRepository, ref] = step.uses.split("@")
    const expected = expectedPins.get(ownerRepository!)
    if (expected !== undefined && ref !== expected) failures.push(`${step.uses} is not the admitted full-SHA pin.`)
  }
}
const retainedReportShape = retainedReportSteps.map(({ job, step }) => ({
  job,
  id: step.id,
  if: step.if,
  kind: step.with?.kind,
  candidateSha: step.with?.["candidate-sha"],
  prepared: step.with?.prepared,
  env: step.env,
  continueOnError: step["continue-on-error"]
}))
const expectedRetainedReportShape = [
  {
    job: "create-tag", id: undefined, if: "${{ always() && steps.tag.outcome != 'skipped' }}", kind: "tag",
    candidateSha: "${{ inputs.candidate_sha }}", prepared: "", env: undefined, continueOnError: undefined
  },
  {
    job: "certify-npm-oidc", id: undefined, if: "${{ always() && steps.npm-oidc-certification.outcome != 'skipped' }}",
    kind: "npm-oidc-certification", candidateSha: "${{ inputs.candidate_sha }}",
    prepared: "${{ inputs.prepared_ref }}", env: {
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "", ACTIONS_ID_TOKEN_REQUEST_URL: ""
    }, continueOnError: undefined
  },
  {
    job: "publish-npm", id: undefined, if: "${{ always() && steps.npm-publish.outcome != 'skipped' }}", kind: "npm-publish",
    candidateSha: "${{ inputs.candidate_sha }}", prepared: "${{ inputs.prepared_ref }}", env: {
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "", ACTIONS_ID_TOKEN_REQUEST_URL: ""
    }, continueOnError: undefined
  },
  {
    job: "preflight-github", id: "npm-inspect-report", if: "${{ always() && steps.npm-inspect.outcome != 'skipped' }}", kind: "npm-inspect",
    candidateSha: "${{ inputs.candidate_sha }}", prepared: "${{ inputs.npm_prepared_ref }}", env: undefined, continueOnError: undefined
  },
  {
    job: "publish-github", id: undefined, if: "${{ always() && steps.github-publish.outcome != 'skipped' }}", kind: "github-publish",
    candidateSha: "${{ inputs.candidate_sha }}", prepared: "${{ inputs.prepared_ref }}", env: undefined, continueOnError: undefined
  }
]
if (JSON.stringify(retainedReportShape) !== JSON.stringify(expectedRetainedReportShape)) {
  failures.push("Every credentialed producer must always retain and exact-reread its run-bound report without a credential environment.")
}
const actionShape = actionSteps.map(({ job, step }) => ({
  job,
  command: step.with?.command,
  config: step.with?.config,
  prepared: step.with?.prepared
}))
const expectedActionShape = [
  { job: "prepare", command: "prepare", config: "apps/release-ts/github-release.config.json", prepared: undefined },
  { job: "prepare", command: "prepare", config: "apps/release-ts/npm-release.config.json", prepared: undefined },
  { job: "publish-npm", command: "publish", config: undefined, prepared: "${{ inputs.prepared_ref }}" },
  { job: "preflight-github", command: "inspect", config: undefined, prepared: "${{ inputs.npm_prepared_ref }}" },
  { job: "publish-github", command: "publish", config: undefined, prepared: "${{ inputs.prepared_ref }}" }
]
if (JSON.stringify(actionShape) !== JSON.stringify(expectedActionShape)) failures.push("Self-release Action invocations do not preserve the two-config/five-boundary hard cut.")
for (const { job, step } of actionSteps) {
  if (job === "prepare" && step.env?.GITHUB_TOKEN !== undefined) failures.push("Credential-free preparation received GITHUB_TOKEN.")
  if (job !== "prepare" && step.env?.GITHUB_TOKEN !== "${{ github.token }}") failures.push(`${job} does not receive only its job-scoped GitHub token.`)
  if (job !== "prepare" && step.uses !== "./apps/ts-release-action") {
    failures.push(`${job} does not execute the exact detached candidate's local Action.`)
  }
}
if ((workflow.match(/node-version: "22\.22\.2"/gu)?.length ?? 0) !== 1 ||
    (workflow.match(/bun-version: 1\.3\.14/gu)?.length ?? 0) !== 1 ||
    (workflow.match(/install-self-release-npm\.ts/gu)?.length ?? 0) !== 1 ||
    (workflow.match(/bootstrap-self-release-tools\.sh/gu)?.length ?? 0) !== 5) {
  failures.push("Preparation must pin setup tools once and each credentialed authority/read-only preflight must use the exact native bootstrap.")
}
if (workflow.includes("bun add --global npm@")) failures.push("Repository self-release bypasses the audited npm archive installer.")
if ((workflow.match(/check-self-release-dispatch\.ts/gu)?.length ?? 0) !== 2 ||
    (workflow.match(/TS_RELEASE_DISPATCH_BIN/gu)?.length ?? 0) !== 5) {
  failures.push("Every adoption/mutation boundary needs immediate exact-main reauthentication.")
}
if ((workflow.match(/TS_RELEASE_NPM_VERIFIER_BIN/gu)?.length ?? 0) !== 2 ||
    !workflow.includes('action-report "$ACTION_REPORT"') || !workflow.includes("published-run") ||
    !workflow.includes("ACTION_REPORT: ${{ steps.npm-publish.outputs.report-ref }}")) {
  failures.push("npm publication and recovery must select provenance verification from the exact Action report; later GitHub publication must verify the authenticated publishing run.")
}
if (reportUploads !== 2 || (workflow.match(/path: \$\{\{ steps\.[a-z-]+\.outputs\.report-ref \}\}/gu)?.length ?? 0) !== 2) {
  failures.push("Credential-free preparation must upload only its two redacted Action reports.")
}
if (/(?:\bNPM_(?:TOKEN|ID_TOKEN)\b|\bNODE_AUTH_TOKEN\b)/u.test(workflow)) failures.push("Self-release workflow contains an ambient npm credential channel.")
if (workflow.includes("${{ false }}") || workflow.includes("__ts_release_quarantined__") ||
    /(?:name|path):[^\n]*(?:prepared-ref|ts-release-prepared)/u.test(workflow)) {
    failures.push("Self-release retains a dead path or duplicates the content-addressed prepared store.")
}
const certifierSteps = jobs["certify-npm-oidc"]?.steps?.filter((step) =>
  typeof step.run === "string" && step.run.includes("TS_RELEASE_NPM_OIDC_CERTIFIER_BIN")) ?? []
if (certifierSteps.length !== 1 || certifierSteps[0]?.env?.GITHUB_TOKEN !== "${{ github.token }}" ||
    certifierSteps[0]?.env?.PREPARED_REF !== "${{ inputs.prepared_ref }}") {
  failures.push("npm OIDC certification must execute one exact repository-owned certifier against the adopted reference.")
}
const githubHandoff = jobs["publish-github"]?.steps?.find((step) =>
  step.name === "Admit exact retained npm preflight evidence")
if (JSON.stringify(githubHandoff?.env) !== JSON.stringify({
  NPM_INSPECT_ARTIFACT_NAME: "${{ needs.preflight-github.outputs.artifact-name }}",
  NPM_INSPECT_ARTIFACT_ID: "${{ needs.preflight-github.outputs.artifact-id }}",
  NPM_INSPECT_ARTIFACT_DIGEST: "${{ needs.preflight-github.outputs.artifact-digest }}",
  NPM_INSPECT_REPORT_SHA256: "${{ needs.preflight-github.outputs.report-sha256 }}"
}) || typeof githubHandoff?.run !== "string" ||
    !githubHandoff.run.includes("ts-release-npm-inspect-report-$GITHUB_RUN_ATTEMPT") ||
    !githubHandoff.run.includes("^sha256:[a-f0-9]{64}$")) {
  failures.push("GitHub publication does not fail closed on the exact retained npm preflight identity.")
}
for (const jobName of ["create-tag", "certify-npm-oidc", "publish-npm", "preflight-github", "publish-github"] as const) {
  for (const step of jobs[jobName]?.steps ?? []) {
    if (typeof step.uses === "string" && step.uses !== "./apps/ts-release-action" &&
        step.uses !== "./apps/ts-release-action/report-retainer") {
      failures.push(`${jobName} exposes mutation authority to non-repository Action ${step.uses}.`)
    }
  }
}
for (const jobName of ["certify-npm-oidc", "publish-npm"] as const) {
  const authorityStep = jobName === "certify-npm-oidc" ? "npm-oidc-certification" : "npm-publish"
  for (const step of jobs[jobName]?.steps ?? []) {
    if (step.id === authorityStep) {
      if (step.env?.ACTIONS_ID_TOKEN_REQUEST_URL !== undefined ||
          step.env?.ACTIONS_ID_TOKEN_REQUEST_TOKEN !== undefined) {
        failures.push(`${jobName} overrides OIDC coordinates on its sole authority step.`)
      }
    } else if (step.env?.ACTIONS_ID_TOKEN_REQUEST_URL !== "" ||
        step.env?.ACTIONS_ID_TOKEN_REQUEST_TOKEN !== "") {
      failures.push(`${jobName} exposes OIDC request credentials outside its sole authority step.`)
    }
  }
}

const api = makeReleaseApi(NodeReleaseLayer)
try {
  for (const { lane, config } of selfReleaseConfigs()) {
    const inspection = await api.inspect({ config, workspace: root })
    if (!("preparations" in inspection) || inspection.publications.length !== 1 ||
        inspection.publications[0]?.destination !== lane) {
      failures.push(`${lane} readiness inspection is not one isolated provider-native publication.`)
    }
  }
} catch (cause) {
  failures.push(`Readiness inspection failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`)
} finally {
  await api.dispose()
}

report("self-release-readiness-report/v2", failures, {
  actionReference,
  selectedCoordinates: { npmVersion: version, githubTag: version === undefined ? undefined : `v${version}`, action: actionReference },
  exactToolchain: { node: "22.22.2", bun: "1.3.14", npm: "11.11.0" },
  remoteAuthority: {
    npmTrustedPublisher: "LAST-OBSERVED-2026-09-01; EXACT release.yml / mannyc2/ts-release / npm; REQUERY-REQUIRED",
    githubTagEnvironment: {
      state: "LAST-OBSERVED-2026-09-01; REQUERY-REQUIRED",
      id: "20986778371",
      reviewer: "mannyc2",
      branch: "main",
      secrets: 0,
      variables: 0
    },
    npmEnvironment: {
      state: "LAST-OBSERVED-2026-09-01; REQUERY-REQUIRED",
      id: "20985327992",
      reviewer: "mannyc2",
      branch: "main",
      secrets: 0,
      variables: 0
    },
    githubReleaseEnvironment: {
      state: "LAST-OBSERVED-2026-09-01; REQUERY-REQUIRED",
      id: "20985328229",
      reviewer: "mannyc2",
      branch: "main",
      secrets: 0,
      variables: 0
    },
    githubReleaseImmutability: {
      state: "LAST-OBSERVED-2026-09-01; REQUERY-REQUIRED",
      enabled: true,
      enforcedByOwner: false
    },
    githubOidcSubjectPolicy: {
      state: "LAST-OBSERVED-2026-09-01; DOES-NOT-PROVE-NPM-TRUST",
      useDefault: true,
      useImmutableSubject: true,
      prefix: "repo:mannyc2@126291407/ts-release@1271545637"
    }
  },
  evidenceState: "source-derived; no remote authority inferred",
  readOnlyNetworkChecks: 0
})
