import { createHash } from "node:crypto"
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join, relative, resolve, sep } from "node:path"
import * as Schema from "effect/Schema"
import { ReleaseReport } from "../../../src/publication/report.js"
import type { JsonValue } from "../../../scripts/lib/canonical-json.js"
import { expectExactKeys, expectObject, parseStrictJson } from "../../../scripts/lib/strict-json.js"
import { decodeNpmOidcCertificationReceipt } from "../../release-ts/scripts/npm-oidc-certification-contract.js"
import type { ActionArtifactTransport } from "./artifact-client.js"

export const selfReleaseReportKinds = [
  "tag",
  "npm-oidc-certification",
  "npm-publish",
  "npm-inspect",
  "github-publish"
] as const
export type SelfReleaseReportKind = typeof selfReleaseReportKinds[number]

const exactRepository = "mannyc2/ts-release"
const exactRepositoryId = "1271545637"
const exactOwnerId = "126291407"
const exactRef = "refs/heads/main"
const exactWorkflow = "Release"
const exactWorkflowRef = `${exactRepository}/.github/workflows/release.yml@${exactRef}`
const gitSha = /^[a-f0-9]{40}$/u
const positiveDecimal = /^[1-9][0-9]*$/u
const artifactUploadDigest = /^[a-f0-9]{64}$/u
const artifactLookupDigest = /^sha256:([a-f0-9]{64})$/u
const maximumReportBytes = 1024 * 1024
const preparedReference = /^prepared:gha:mannyc2\/ts-release\/runs\/([1-9][0-9]*)\/attempts\/([1-9][0-9]*)\/artifacts\/ts-release-prepared-\2-([a-f0-9]{64})#sha256-\3$/u
const tokenShape = /(?:npm|ghp|ghs|github_pat)_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._~+/-]+=*/iu
const sensitiveEnvironmentNames = new Set([
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "NPM_TOKEN",
  "NPM_ID_TOKEN",
  "NODE_AUTH_TOKEN"
])
const publicationAuthorityEnvironmentNames = [
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "NPM_TOKEN",
  "NPM_ID_TOKEN",
  "NODE_AUTH_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
] as const
const actionsTokenEnvironmentName = /^ACTIONS_[A-Z0-9_]*_TOKEN$/u

const kindContract = {
  tag: {
    job: "create-tag",
    command: undefined,
    reportPath: ".release/ts-release/tag-report.json",
    remoteSubject: undefined
  },
  "npm-oidc-certification": {
    job: "certify-npm-oidc",
    command: undefined,
    reportPath: ".release/ts-release/npm-oidc-certification.json",
    remoteSubject: undefined
  },
  "npm-publish": {
    job: "publish-npm",
    command: "publish",
    reportPath: ".release/ts-release/action-report.json",
    remoteSubject: "npm:@mannyc1/ts-release@0.3.0"
  },
  "npm-inspect": {
    job: "preflight-github",
    command: "inspect",
    reportPath: ".release/ts-release/action-report.json",
    remoteSubject: undefined
  },
  "github-publish": {
    job: "publish-github",
    command: "publish",
    reportPath: ".release/ts-release/action-report.json",
    remoteSubject: "github:mannyc2/ts-release#v0.3.0"
  }
} as const satisfies Record<SelfReleaseReportKind, {
  readonly job: string
  readonly command: "publish" | "inspect" | undefined
  readonly reportPath: string
  readonly remoteSubject: string | undefined
}>

export interface SelfReleaseReportRetentionEnvironment {
  readonly [name: string]: string | undefined
}

export interface SelfReleaseReportRetentionInput {
  readonly kind: SelfReleaseReportKind
  readonly candidateSha: string
  readonly prepared: string
  readonly workspace: string
  readonly environment: SelfReleaseReportRetentionEnvironment
  readonly artifacts: ActionArtifactTransport
  readonly temporaryRoot?: string
}

export interface SelfReleaseReportRetentionResult {
  readonly schemaVersion: "ts-release/report-retention-result/v1"
  readonly status: "uploaded-and-verified" | "recovered-after-upload-response-loss"
  readonly artifactName: string
  readonly artifactId: number
  readonly artifactDigest: string
  readonly reportSha256: string
}

interface AdmittedRetentionContext {
  readonly kind: SelfReleaseReportKind
  readonly candidateSha: string
  readonly prepared: string
  readonly runId: string
  readonly runAttempt: string
  readonly artifactName: string
  readonly reportPath: string
}

const fail = (reason: string): never => {
  throw new Error(`Self-release report retention refused: ${reason}`)
}

const required = (
  environment: SelfReleaseReportRetentionEnvironment,
  name: string
): string => {
  const value = environment[name]?.trim()
  return value === undefined || value.length === 0 ? fail(`${name} is absent`) : value
}

const inside = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

const exactKeys = (
  value: ReturnType<typeof expectObject>,
  requiredKeys: ReadonlyArray<string>,
  optionalKeys: ReadonlyArray<string> = []
): void => {
  try {
    expectExactKeys(value, requiredKeys, optionalKeys)
  } catch {
    fail("report object keys are not exact")
  }
}

const text = (value: unknown, name: string, maximum = 4096): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    return fail(`${name} is not one bounded nonempty string`)
  }
  return value
}

const privateRegularBytes = (
  workspace: string,
  relativePath: string,
  options: { readonly requirePrivateMode: boolean }
): Uint8Array => {
  const root = realpathSync(workspace)
  const path = resolve(root, relativePath)
  if (!inside(root, path)) return fail("report path escapes GITHUB_WORKSPACE")
  let current = root
  for (const segment of relative(root, path).split(sep)) {
    current = join(current, segment)
    const metadata = lstatSync(current)
    if (metadata.isSymbolicLink()) return fail("report path contains a symbolic link")
    if (current !== path && !metadata.isDirectory()) return fail("report parent is not a directory")
  }
  const metadata = lstatSync(path)
  if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size <= 0 || metadata.size > maximumReportBytes) {
    return fail("report must be one bounded unlinked regular file")
  }
  if (options.requirePrivateMode && (metadata.mode & 0o077) !== 0) {
    return fail("source report permissions are not private")
  }
  if (realpathSync(path) !== path) return fail("report path is not canonical")
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = fstatSync(descriptor)
    const bytes = new Uint8Array(readFileSync(descriptor))
    const after = fstatSync(descriptor)
    if (bytes.length !== before.size || before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      return fail("report changed while it was being retained")
    }
    return bytes
  } finally {
    closeSync(descriptor)
  }
}

const rejectSecretMaterial = (
  textValue: string,
  environment: SelfReleaseReportRetentionEnvironment
): void => {
  if (tokenShape.test(textValue)) return fail("report contains token-shaped material")
  for (const [name, value] of Object.entries(environment)) {
    if (!sensitiveEnvironmentNames.has(name) && !actionsTokenEnvironmentName.test(name)) continue
    if (value !== undefined && value.length >= 8 && textValue.includes(value)) {
      return fail("report contains live credential material")
    }
  }
}

const validateTagReport = (value: JsonValue, candidateSha: string): void => {
  const report = expectObject(value, "tag report")
  exactKeys(report, ["schemaVersion", "status", "result", "tag", "candidateSha", "mutationAttempts"])
  if (report.schemaVersion !== "ts-release/tag-convergence/v1" || report.tag !== "v0.3.0" ||
      report.candidateSha !== candidateSha || (report.mutationAttempts !== 0 && report.mutationAttempts !== 1)) {
    return fail("tag report does not bind exact v0.3.0 and candidate_sha")
  }
  const admittedResults = {
    complete: new Set(["already-equivalent", "created-and-observed", "converged-after-conflict"]),
    conflict: new Set(["present-different", "provider-rejected"]),
    uncertain: new Set(["outcome-unknown", "observation-inconclusive"])
  } as const
  if (typeof report.status !== "string" || typeof report.result !== "string" ||
      !(report.status in admittedResults) ||
      !admittedResults[report.status as keyof typeof admittedResults].has(report.result as never)) {
    return fail("tag report status/result correlation is invalid")
  }
  const admittedMutationAttempts = {
    "already-equivalent": [0],
    "created-and-observed": [1],
    "converged-after-conflict": [1],
    "present-different": [0, 1],
    "provider-rejected": [1],
    "outcome-unknown": [1],
    "observation-inconclusive": [0]
  } as const
  if (!(admittedMutationAttempts[report.result as keyof typeof admittedMutationAttempts] as ReadonlyArray<number>)
    .includes(report.mutationAttempts as number)) {
    return fail("tag report result/mutation-attempt correlation is invalid")
  }
}

const validateActionReport = (
  value: JsonValue,
  kind: Exclude<SelfReleaseReportKind, "tag" | "npm-oidc-certification">,
  expectedPrepared: string
): void => {
  const contract = kindContract[kind]
  const report = expectObject(value, "Action report")
  const status = report.status
  if (status === "failed") {
    exactKeys(report, ["schemaVersion", "command", "status", "prepared", "error"])
    text(report.error, "Action failure", 8192)
  } else if (contract.command === "inspect") {
    exactKeys(report, ["schemaVersion", "command", "status", "prepared"])
    if (status !== "complete") return fail("inspect report is neither complete nor failed")
  } else {
    exactKeys(report, ["schemaVersion", "command", "status", "prepared", "report"])
  }
  if (report.schemaVersion !== "ts-release-action-report/v2" || report.command !== contract.command ||
      report.prepared !== expectedPrepared) {
    return fail("Action report does not bind its exact command and prepared reference")
  }
  if (status === "failed" || contract.command === "inspect") return
  let release: typeof ReleaseReport.Type
  try {
    release = Schema.decodeUnknownSync(ReleaseReport, { onExcessProperty: "error" })(report.report)
  } catch {
    return fail("publish report does not satisfy the exact ReleaseReport schema")
  }
  if (release.status !== status || release.subjects.length !== 2 ||
      release.subjects[0]?.subject.toString() !== expectedPrepared ||
      release.subjects[0]?._tag !== "AlreadyEquivalent" ||
      release.subjects[1]?.subject.toString() !== contract.remoteSubject) {
    return fail("publish report does not bind the prepared and remote subjects")
  }
}

const admit = (input: SelfReleaseReportRetentionInput): AdmittedRetentionContext => {
  if (!(selfReleaseReportKinds as ReadonlyArray<string>).includes(input.kind)) return fail("report kind is unknown")
  const contract = kindContract[input.kind]
  if (!gitSha.test(input.candidateSha)) return fail("candidate-sha is not one lowercase 40-hex commit")
  const environment = input.environment
  for (const name of publicationAuthorityEnvironmentNames) {
    if ((environment[name] ?? "").length > 0) {
      return fail(`${name} must be absent from the report-retention process`)
    }
  }
  const runId = required(environment, "GITHUB_RUN_ID")
  const runAttempt = required(environment, "GITHUB_RUN_ATTEMPT")
  if (!positiveDecimal.test(runId) || !positiveDecimal.test(runAttempt)) {
    return fail("run coordinates are not canonical positive decimals")
  }
  const workspace = realpathSync(input.workspace)
  if (realpathSync(required(environment, "GITHUB_WORKSPACE")) !== workspace ||
      environment.GITHUB_REPOSITORY !== exactRepository ||
      environment.GITHUB_REPOSITORY_ID !== exactRepositoryId ||
      environment.GITHUB_REPOSITORY_OWNER_ID !== exactOwnerId ||
      environment.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      environment.GITHUB_REF !== exactRef ||
      environment.GITHUB_SHA !== input.candidateSha ||
      environment.GITHUB_WORKFLOW !== exactWorkflow ||
      environment.GITHUB_WORKFLOW_REF !== exactWorkflowRef ||
      environment.GITHUB_WORKFLOW_SHA !== input.candidateSha ||
      environment.GITHUB_JOB !== contract.job) {
    return fail("GitHub run identity does not bind exact canonical main")
  }
  if (input.kind === "tag") {
    if (input.prepared !== "") return fail("tag report rejects prepared references")
  } else if (preparedReference.exec(input.prepared) === null) {
    return fail("Action report requires one canonical repository-owned prepared reference")
  }
  return {
    kind: input.kind,
    candidateSha: input.candidateSha,
    prepared: input.prepared,
    runId,
    runAttempt,
    artifactName: `ts-release-${input.kind}-report-${runAttempt}`,
    reportPath: contract.reportPath
  }
}

const canonicalReceipt = (context: AdmittedRetentionContext, reportSha256: string): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify({
    schemaVersion: "ts-release/retained-report/v1",
    repository: exactRepository,
    repositoryId: exactRepositoryId,
    repositoryOwnerId: exactOwnerId,
    workflow: exactWorkflow,
    workflowRef: exactWorkflowRef,
    workflowSha: context.candidateSha,
    ref: exactRef,
    runId: context.runId,
    runAttempt: context.runAttempt,
    reportKind: context.kind,
    artifactName: context.artifactName,
    candidateSha: context.candidateSha,
    prepared: context.prepared,
    reportSha256
  }, null, 2)}\n`)

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

export const retainSelfReleaseReport = async (
  input: SelfReleaseReportRetentionInput
): Promise<SelfReleaseReportRetentionResult> => {
  const context = admit(input)
  const reportBytes = privateRegularBytes(input.workspace, context.reportPath, { requirePrivateMode: true })
  if (reportBytes[0] === 0xef && reportBytes[1] === 0xbb && reportBytes[2] === 0xbf) {
    return fail("report UTF-8 must not contain a byte-order mark")
  }
  let reportText: string
  let reportValue: JsonValue
  try {
    reportText = new TextDecoder("utf-8", { fatal: true }).decode(reportBytes)
    rejectSecretMaterial(reportText, input.environment)
    reportValue = parseStrictJson(reportText)
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Self-release report retention refused:")) throw cause
    return fail("report is not strict redacted UTF-8 JSON")
  }
  if (context.kind === "tag") validateTagReport(reportValue, context.candidateSha)
  else if (context.kind === "npm-oidc-certification") {
    try {
      decodeNpmOidcCertificationReceipt(reportValue, {
        candidateSha: context.candidateSha,
        prepared: context.prepared
      })
    } catch {
      return fail("npm OIDC certification receipt is not exact")
    }
  } else validateActionReport(reportValue, context.kind, context.prepared)

  const reportSha256 = createHash("sha256").update(reportBytes).digest("hex")
  const receiptBytes = canonicalReceipt(context, reportSha256)
  const temporaryRoot = input.temporaryRoot ?? tmpdir()
  const staging = mkdtempSync(join(temporaryRoot, "ts-release-report-stage-"))
  const download = mkdtempSync(join(temporaryRoot, "ts-release-report-readback-"))
  try {
    const stagedReport = join(staging, "report.json")
    const stagedReceipt = join(staging, "receipt.json")
    writeFileSync(stagedReport, reportBytes, { mode: 0o400, flag: "wx" })
    writeFileSync(stagedReceipt, receiptBytes, { mode: 0o400, flag: "wx" })

    let uploadId: number | undefined
    let uploadDigest: string | undefined
    let uploadResponseUnknown = false
    try {
      const uploaded = await input.artifacts.upload({
        name: context.artifactName,
        files: [stagedReport, stagedReceipt],
        rootDirectory: staging
      })
      if (!Number.isSafeInteger(uploaded.id) || uploaded.id! <= 0 ||
          uploaded.digest === undefined || !artifactUploadDigest.test(uploaded.digest)) {
        uploadResponseUnknown = true
      } else {
        uploadId = uploaded.id
        uploadDigest = uploaded.digest
      }
    } catch {
      // The upload may have committed before response loss. Resolve by one
      // exact readback only; never resubmit the artifact mutation.
      uploadResponseUnknown = true
    }

    let downloaded: Awaited<ReturnType<ActionArtifactTransport["download"]>>
    try {
      downloaded = await input.artifacts.download({
        name: context.artifactName,
        destination: download
      })
    } catch {
      return fail("artifact upload outcome is unknown and exact readback failed")
    }
    const lookupDigest = artifactLookupDigest.exec(downloaded.digest ?? "")
    if (!Number.isSafeInteger(downloaded.id) || downloaded.id! <= 0 || lookupDigest === null ||
        downloaded.digestMismatch === true || downloaded.path === undefined ||
        realpathSync(downloaded.path) !== realpathSync(download)) {
      return fail("artifact readback returned noncanonical identity metadata")
    }
    if (uploadId !== undefined && (downloaded.id !== uploadId || lookupDigest[1] !== uploadDigest)) {
      return fail("artifact upload and readback identities differ")
    }
    const entries = readdirSync(download, { withFileTypes: true })
    if (entries.length !== 2 || entries.some((entry) => !entry.isFile()) ||
        entries.map((entry) => entry.name).sort().join("\0") !== "receipt.json\0report.json") {
      return fail("artifact readback contains an unexpected file set")
    }
    const downloadedReport = privateRegularBytes(download, "report.json", { requirePrivateMode: false })
    const downloadedReceipt = privateRegularBytes(download, "receipt.json", { requirePrivateMode: false })
    if (!sameBytes(downloadedReport, reportBytes) || !sameBytes(downloadedReceipt, receiptBytes)) {
      return fail("artifact readback bytes differ from the retained report and receipt")
    }
    return {
      schemaVersion: "ts-release/report-retention-result/v1",
      status: uploadResponseUnknown
        ? "recovered-after-upload-response-loss"
        : "uploaded-and-verified",
      artifactName: context.artifactName,
      artifactId: downloaded.id!,
      artifactDigest: downloaded.digest!,
      reportSha256
    }
  } finally {
    rmSync(staging, { recursive: true, force: true })
    rmSync(download, { recursive: true, force: true })
  }
}
