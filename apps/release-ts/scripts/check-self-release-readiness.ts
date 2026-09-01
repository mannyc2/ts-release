import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import {
  candidateActionReference, packagePath, readJson, readText, releaseWorkflowPath,
  report, root, selfReleaseConfigs, stringField
} from "./self-release-facts.js"

interface WorkflowStep {
  readonly name?: string
  readonly uses?: string
  readonly run?: string
  readonly env?: Readonly<Record<string, unknown>>
  readonly with?: Readonly<Record<string, unknown>>
}
interface WorkflowJob {
  readonly if?: string
  readonly environment?: string
  readonly permissions?: Readonly<Record<string, string>>
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
    inputs.mode.options?.join(",") !== "prepare-exact-sha,create-tag,publish-npm,publish-github") {
  failures.push("Self-release must expose only the four hard-cut authority modes.")
}

const jobs = parsed.jobs ?? {}
if (Object.keys(jobs).join(",") !== "prepare,create-tag,publish-npm,publish-github") failures.push("Self-release must contain exactly the four authority jobs.")
const admissions = {
  prepare: "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha && inputs.mode == 'prepare-exact-sha' }}",
  "create-tag": "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha && inputs.mode == 'create-tag' }}",
  "publish-npm": "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha && inputs.mode == 'publish-npm' }}",
  "publish-github": "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha && inputs.mode == 'publish-github' }}"
} as const
for (const [name, expected] of Object.entries(admissions)) {
  if (jobs[name]?.if !== expected) failures.push(`${name} does not fail closed at the exact repository/ref/SHA/mode boundary.`)
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
if (jobs["publish-npm"]?.environment !== "npm" ||
    JSON.stringify(jobs["publish-npm"]?.permissions) !== JSON.stringify({ actions: "read", contents: "read", "id-token": "write" })) {
  failures.push("npm publication must use only the npm environment, prepared-store read, and OIDC authority.")
}

const expectedPins = new Map([
  ["actions/checkout", "11d5960a326750d5838078e36cf38b85af677262"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
  ["oven-sh/setup-bun", "0c5077e51419868618aeaa5fe8019c62421857d6"],
  ["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"]
])
const actionSteps: Array<{ readonly job: string, readonly step: WorkflowStep }> = []
let reportUploads = 0
for (const [job, definition] of Object.entries(jobs)) for (const step of definition.steps ?? []) {
  if (step.uses === "./apps/ts-release-action" || step.uses === "mannyc2/ts-release/apps/ts-release-action@v0.3.0") {
    actionSteps.push({ job, step })
  }
  if (typeof step.uses === "string" && step.uses.startsWith("actions/upload-artifact@")) reportUploads += 1
  if (typeof step.uses === "string" && !step.uses.startsWith("./")) {
    const [ownerRepository, ref] = step.uses.split("@")
    const expected = expectedPins.get(ownerRepository!)
    if (expected !== undefined && ref !== expected) failures.push(`${step.uses} is not the admitted full-SHA pin.`)
  }
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
  { job: "publish-github", command: "inspect", config: undefined, prepared: "${{ inputs.npm_prepared_ref }}" },
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
    (workflow.match(/bootstrap-self-release-tools\.sh/gu)?.length ?? 0) !== 3) {
  failures.push("Preparation must pin setup tools once and each credentialed authority must use the exact native bootstrap.")
}
if (workflow.includes("bun add --global npm@")) failures.push("Repository self-release bypasses the audited npm archive installer.")
if ((workflow.match(/check-self-release-dispatch\.ts/gu)?.length ?? 0) !== 2 ||
    (workflow.match(/TS_RELEASE_DISPATCH_BIN/gu)?.length ?? 0) !== 4) {
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
for (const jobName of ["create-tag", "publish-npm", "publish-github"] as const) {
  for (const step of jobs[jobName]?.steps ?? []) {
    if (typeof step.uses === "string" && step.uses !== "./apps/ts-release-action") {
      failures.push(`${jobName} exposes mutation authority to non-repository Action ${step.uses}.`)
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
    npmTrustedPublisher: "UNVERIFIED",
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
      useImmutableSubject: false,
      prefix: "repo:mannyc2/ts-release"
    }
  },
  evidenceState: "source-derived; no remote authority inferred",
  readOnlyNetworkChecks: 0
})
