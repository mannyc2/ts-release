import { createHash } from "node:crypto"
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
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
    producerJob: "create-tag",
    retentionJob: "create-tag",
    command: undefined,
    reportPath: ".release/ts-release/tag-report.json",
    remoteSubject: undefined
  },
  "npm-oidc-certification": {
    producerJob: "certify-npm-oidc",
    retentionJob: "retain-npm-oidc-certification",
    command: undefined,
    reportPath: ".release/ts-release/npm-oidc-certification.json",
    remoteSubject: undefined
  },
  "npm-publish": {
    producerJob: "publish-npm",
    retentionJob: "retain-npm-publication",
    command: "publish",
    reportPath: ".release/ts-release/action-report.json",
    remoteSubject: "npm:@mannyc1/ts-release@0.3.0"
  },
  "npm-inspect": {
    producerJob: "preflight-github",
    retentionJob: "preflight-github",
    command: "inspect",
    reportPath: ".release/ts-release/action-report.json",
    remoteSubject: undefined
  },
  "github-publish": {
    producerJob: "publish-github",
    retentionJob: "publish-github",
    command: "publish",
    reportPath: ".release/ts-release/action-report.json",
    remoteSubject: "github:mannyc2/ts-release#v0.3.0"
  }
} as const satisfies Record<SelfReleaseReportKind, {
  readonly producerJob: string
  readonly retentionJob: string
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
  readonly handoff?: SelfReleaseReportHandoffReference
  readonly producerResult?: "success" | "failure"
  readonly temporaryRoot?: string
}

export interface SelfReleaseReportHandoffReference {
  readonly artifactName: string
  readonly artifactId: string
  readonly artifactDigest: string
  readonly reportSha256: string
}

export interface SelfReleaseReportHandoffInput {
  readonly kind: SelfReleaseReportKind
  readonly candidateSha: string
  readonly prepared: string
  readonly workspace: string
  readonly environment: SelfReleaseReportRetentionEnvironment
  readonly sourceProof: {
    readonly reportBytes: string
    readonly reportSha256: string
  }
  readonly artifacts: ActionArtifactTransport
  readonly temporaryRoot?: string
}

export interface SelfReleaseReportHandoffResult {
  readonly schemaVersion: "ts-release/report-handoff/v1"
  readonly status: "uploaded-and-verified" | "recovered-after-upload-response-loss"
  readonly artifactName: string
  readonly artifactId: number
  readonly artifactDigest: string
  readonly reportSha256: string
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
  readonly producerJob: string
  readonly retentionJob: string
}

export type SelfReleaseReportFailureCode =
  | "admission"
  | "handoff"
  | "source"
  | "schema"
  | "artifact"

export class SelfReleaseReportRefusal extends Error {
  constructor(readonly code: SelfReleaseReportFailureCode, reason: string) {
    super(`Self-release report retention refused: ${reason}`)
    this.name = "SelfReleaseReportRefusal"
  }
}

const fail = (reason: string, code: SelfReleaseReportFailureCode = "schema"): never => {
  throw new SelfReleaseReportRefusal(code, reason)
}

export const selfReleaseReportFailureCode = (cause: unknown): SelfReleaseReportFailureCode | "unexpected" =>
  cause instanceof SelfReleaseReportRefusal ? cause.code : "unexpected"

const required = (
  environment: SelfReleaseReportRetentionEnvironment,
  name: string
): string => {
  const value = environment[name]?.trim()
  return value === undefined || value.length === 0 ? fail(`${name} is absent`, "admission") : value
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
  if (!inside(root, path)) return fail("report path escapes GITHUB_WORKSPACE", "source")
  let current = root
  for (const segment of relative(root, path).split(sep)) {
    current = join(current, segment)
    const metadata = lstatSync(current)
    if (metadata.isSymbolicLink()) return fail("report path contains a symbolic link", "source")
    if (current !== path && !metadata.isDirectory()) return fail("report parent is not a directory", "source")
  }
  const metadata = lstatSync(path)
  if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size <= 0 || metadata.size > maximumReportBytes) {
    return fail("report must be one bounded unlinked regular file", "source")
  }
  if (options.requirePrivateMode && (metadata.mode & 0o077) !== 0) {
    return fail("source report permissions are not private", "source")
  }
  if (realpathSync(path) !== path) return fail("report path is not canonical", "source")
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = fstatSync(descriptor)
    if (!before.isFile() || before.nlink !== 1 || before.size <= 0 || before.size > maximumReportBytes ||
        metadata.dev !== before.dev || metadata.ino !== before.ino ||
        (options.requirePrivateMode && (before.mode & 0o077) !== 0)) {
      return fail("opened report does not match the admitted bounded private file", "source")
    }
    const bytes = new Uint8Array(before.size)
    let offset = 0
    while (offset < bytes.length) {
      const read = readSync(descriptor, bytes, offset, bytes.length - offset, null)
      if (read === 0) return fail("report ended before its admitted byte count", "source")
      offset += read
    }
    const extra = new Uint8Array(1)
    const extraBytes = readSync(descriptor, extra, 0, 1, null)
    const after = fstatSync(descriptor)
    if (extraBytes !== 0 || before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      return fail("report changed while it was being retained", "source")
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

type ReportCoordinateInput = Pick<
  SelfReleaseReportRetentionInput,
  "kind" | "candidateSha" | "prepared" | "workspace" | "environment"
>

const admit = (
  input: ReportCoordinateInput,
  expectedJob: string
): AdmittedRetentionContext => {
  if (!(selfReleaseReportKinds as ReadonlyArray<string>).includes(input.kind)) return fail("report kind is unknown")
  const contract = kindContract[input.kind]
  if (!gitSha.test(input.candidateSha)) {
    return fail("candidate-sha is not one lowercase 40-hex commit", "admission")
  }
  const environment = input.environment
  for (const name of publicationAuthorityEnvironmentNames) {
    if ((environment[name] ?? "").length > 0) {
      return fail(`${name} must be absent from the report-retention process`, "admission")
    }
  }
  const runId = required(environment, "GITHUB_RUN_ID")
  const runAttempt = required(environment, "GITHUB_RUN_ATTEMPT")
  if (!positiveDecimal.test(runId) || !positiveDecimal.test(runAttempt)) {
    return fail("run coordinates are not canonical positive decimals", "admission")
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
      environment.GITHUB_JOB !== expectedJob) {
    return fail("GitHub run identity does not bind exact canonical main", "admission")
  }
  if (input.kind === "tag") {
    if (input.prepared !== "") return fail("tag report rejects prepared references", "admission")
  } else if (preparedReference.exec(input.prepared) === null) {
    return fail("Action report requires one canonical repository-owned prepared reference", "admission")
  }
  return {
    kind: input.kind,
    candidateSha: input.candidateSha,
    prepared: input.prepared,
    runId,
    runAttempt,
    artifactName: `ts-release-${input.kind}-report-${runAttempt}`,
    reportPath: contract.reportPath,
    producerJob: contract.producerJob,
    retentionJob: contract.retentionJob
  }
}

const validateReportBytes = (
  context: AdmittedRetentionContext,
  reportBytes: Uint8Array,
  environment: SelfReleaseReportRetentionEnvironment
): string => {
  if (reportBytes.length === 0 || reportBytes.length > maximumReportBytes) {
    return fail("report bytes are outside the admitted bound", "source")
  }
  if (reportBytes[0] === 0xef && reportBytes[1] === 0xbb && reportBytes[2] === 0xbf) {
    return fail("report UTF-8 must not contain a byte-order mark", "schema")
  }
  let reportText: string
  let reportValue: JsonValue
  try {
    reportText = new TextDecoder("utf-8", { fatal: true }).decode(reportBytes)
    rejectSecretMaterial(reportText, environment)
    reportValue = parseStrictJson(reportText)
  } catch (cause) {
    if (cause instanceof SelfReleaseReportRefusal) throw cause
    return fail("report is not strict redacted UTF-8 JSON", "schema")
  }
  if (context.kind === "tag") validateTagReport(reportValue, context.candidateSha)
  else if (context.kind === "npm-oidc-certification") {
    try {
      decodeNpmOidcCertificationReceipt(reportValue, {
        candidateSha: context.candidateSha,
        prepared: context.prepared
      })
    } catch {
      return fail("npm OIDC certification receipt is not exact", "schema")
    }
  } else validateActionReport(reportValue, context.kind, context.prepared)
  return createHash("sha256").update(reportBytes).digest("hex")
}

const canonicalHandoffReceipt = (
  context: AdmittedRetentionContext,
  artifactName: string,
  reportSha256: string
): Uint8Array => new TextEncoder().encode(`${JSON.stringify({
  schemaVersion: "ts-release/report-handoff/v1",
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
  producerJob: context.producerJob,
  artifactName,
  candidateSha: context.candidateSha,
  prepared: context.prepared,
  reportSha256
}, null, 2)}\n`)

interface HandoffArtifactIdentity {
  readonly artifactName: string
  readonly artifactId: number
  readonly artifactDigest: string
}

const canonicalReceipt = (
  context: AdmittedRetentionContext,
  reportSha256: string,
  handoff: HandoffArtifactIdentity | undefined,
  producerResult: "same-job" | "success" | "failure"
): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify({
    schemaVersion: "ts-release/retained-report/v2",
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
    producerJob: context.producerJob,
    producerResult,
    retentionJob: context.retentionJob,
    artifactName: context.artifactName,
    candidateSha: context.candidateSha,
    prepared: context.prepared,
    sourceTransport: handoff === undefined ? "same-job-private-file" : "verified-actions-handoff",
    handoffArtifactName: handoff?.artifactName ?? null,
    handoffArtifactId: handoff?.artifactId ?? null,
    handoffArtifactDigest: handoff?.artifactDigest ?? null,
    reportSha256
  }, null, 2)}\n`)

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

interface ExactArtifactCommitResult extends HandoffArtifactIdentity {
  readonly status: "uploaded-and-verified" | "recovered-after-upload-response-loss"
}

const exactDownloadedArtifact = async (input: {
  readonly artifacts: ActionArtifactTransport
  readonly artifactName: string
  readonly destination: string
  readonly uploadId?: number
  readonly uploadDigest?: string
  readonly readbackFailureReason?: string
}): Promise<HandoffArtifactIdentity> => {
  let downloaded: Awaited<ReturnType<ActionArtifactTransport["download"]>>
  try {
    downloaded = await input.artifacts.download({
      name: input.artifactName,
      destination: input.destination
    })
  } catch {
    return fail(input.readbackFailureReason ?? "artifact exact readback failed", "artifact")
  }
  const lookupDigest = artifactLookupDigest.exec(downloaded.digest ?? "")
  if (!Number.isSafeInteger(downloaded.id) || downloaded.id! <= 0 || lookupDigest === null ||
      downloaded.digestMismatch !== false || downloaded.path === undefined ||
      realpathSync(downloaded.path) !== realpathSync(input.destination)) {
    return fail("artifact readback returned noncanonical identity metadata", "artifact")
  }
  if (input.uploadId !== undefined &&
      (downloaded.id !== input.uploadId || lookupDigest[1] !== input.uploadDigest)) {
    return fail("artifact upload and readback identities differ", "artifact")
  }
  return {
    artifactName: input.artifactName,
    artifactId: downloaded.id!,
    artifactDigest: downloaded.digest!
  }
}

const exactDownloadedFiles = (
  directory: string,
  names: ReadonlyArray<string>
): Readonly<Record<string, Uint8Array>> => {
  const canonicalNames = [...names].sort()
  if (new Set(canonicalNames).size !== canonicalNames.length ||
      canonicalNames.some((name) => !/^[a-z][a-z0-9.-]*$/u.test(name))) {
    return fail("expected artifact file names are not canonical", "artifact")
  }
  const entries = readdirSync(directory, { withFileTypes: true })
  if (entries.length !== canonicalNames.length || entries.some((entry) => !entry.isFile()) ||
      entries.map((entry) => entry.name).sort().join("\0") !== canonicalNames.join("\0")) {
    return fail("artifact readback contains an unexpected file set", "artifact")
  }
  return Object.fromEntries(canonicalNames.map((name) => [
    name,
    privateRegularBytes(directory, name, { requirePrivateMode: false })
  ]))
}

const commitExactArtifact = async (input: {
  readonly artifacts: ActionArtifactTransport
  readonly artifactName: string
  readonly files: Readonly<Record<string, Uint8Array>>
  readonly temporaryRoot: string
}): Promise<ExactArtifactCommitResult> => {
  const staging = mkdtempSync(join(input.temporaryRoot, "ts-release-artifact-stage-"))
  const download = mkdtempSync(join(input.temporaryRoot, "ts-release-artifact-readback-"))
  try {
    const names = Object.keys(input.files).sort()
    for (const name of names) {
      writeFileSync(join(staging, name), input.files[name]!, { mode: 0o400, flag: "wx" })
    }
    let uploadId: number | undefined
    let uploadDigest: string | undefined
    let uploadResponseUnknown = false
    try {
      const uploaded = await input.artifacts.upload({
        name: input.artifactName,
        files: names.map((name) => join(staging, name)),
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
    const identity = await exactDownloadedArtifact({
      artifacts: input.artifacts,
      artifactName: input.artifactName,
      destination: download,
      readbackFailureReason: "artifact upload outcome is unknown and exact readback failed",
      ...(uploadId === undefined ? {} : { uploadId, uploadDigest: uploadDigest! })
    })
    const reread = exactDownloadedFiles(download, names)
    if (names.some((name) => !sameBytes(reread[name]!, input.files[name]!))) {
      return fail("artifact readback bytes differ from the committed files", "artifact")
    }
    return {
      ...identity,
      status: uploadResponseUnknown
        ? "recovered-after-upload-response-loss"
        : "uploaded-and-verified"
    }
  } finally {
    rmSync(staging, { recursive: true, force: true })
    rmSync(download, { recursive: true, force: true })
  }
}

export const stageSelfReleaseReportHandoff = async (
  input: SelfReleaseReportHandoffInput
): Promise<SelfReleaseReportHandoffResult> => {
  const contract = kindContract[input.kind]
  if (contract.producerJob === contract.retentionJob) {
    return fail("this report kind does not cross a no-authority job boundary", "handoff")
  }
  const context = admit(input, contract.producerJob)
  const reportBytes = privateRegularBytes(input.workspace, context.reportPath, { requirePrivateMode: true })
  const reportSha256 = validateReportBytes(context, reportBytes, input.environment)
  if (input.sourceProof.reportBytes !== String(reportBytes.length) ||
      input.sourceProof.reportSha256 !== reportSha256) {
    return fail("report changed after the authority-dropping bootstrap scan", "handoff")
  }
  const artifactName = `ts-release-${context.kind}-handoff-${context.runAttempt}`
  const receiptBytes = canonicalHandoffReceipt(context, artifactName, reportSha256)
  const committed = await commitExactArtifact({
    artifacts: input.artifacts,
    artifactName,
    files: { "handoff.json": receiptBytes, "report.json": reportBytes },
    temporaryRoot: input.temporaryRoot ?? tmpdir()
  })
  return {
    schemaVersion: "ts-release/report-handoff/v1",
    status: committed.status,
    artifactName: committed.artifactName,
    artifactId: committed.artifactId,
    artifactDigest: committed.artifactDigest,
    reportSha256
  }
}

const handoffReportBytes = async (
  input: SelfReleaseReportRetentionInput,
  context: AdmittedRetentionContext,
  handoff: SelfReleaseReportHandoffReference
): Promise<{ readonly reportBytes: Uint8Array, readonly identity: HandoffArtifactIdentity }> => {
  const expectedName = `ts-release-${context.kind}-handoff-${context.runAttempt}`
  const artifactId = Number(handoff.artifactId)
  if (handoff.artifactName !== expectedName || !positiveDecimal.test(handoff.artifactId) ||
      !Number.isSafeInteger(artifactId) || artifactId <= 0 ||
      artifactLookupDigest.exec(handoff.artifactDigest) === null ||
      !/^[a-f0-9]{64}$/u.test(handoff.reportSha256)) {
    return fail("handoff artifact reference is not canonical", "handoff")
  }
  const download = mkdtempSync(join(input.temporaryRoot ?? tmpdir(), "ts-release-handoff-readback-"))
  try {
    const identity = await exactDownloadedArtifact({
      artifacts: input.artifacts,
      artifactName: expectedName,
      destination: download
    })
    if (identity.artifactId !== artifactId || identity.artifactDigest !== handoff.artifactDigest) {
      return fail("handoff output identity differs from exact artifact lookup", "handoff")
    }
    const files = exactDownloadedFiles(download, ["handoff.json", "report.json"])
    const reportBytes = files["report.json"]!
    const reportSha256 = createHash("sha256").update(reportBytes).digest("hex")
    let receipt: ReturnType<typeof expectObject>
    try {
      receipt = expectObject(parseStrictJson(
        new TextDecoder("utf-8", { fatal: true }).decode(files["handoff.json"]!)
      ), "report handoff receipt")
      exactKeys(receipt, [
        "schemaVersion", "repository", "repositoryId", "repositoryOwnerId", "workflow", "workflowRef",
        "workflowSha", "ref", "runId", "runAttempt", "reportKind", "producerJob", "artifactName",
        "candidateSha", "prepared", "reportSha256"
      ])
    } catch (cause) {
      if (cause instanceof SelfReleaseReportRefusal) throw cause
      return fail("handoff receipt is not strict exact JSON", "handoff")
    }
    if (receipt.schemaVersion !== "ts-release/report-handoff/v1" ||
        receipt.repository !== exactRepository || receipt.repositoryId !== exactRepositoryId ||
        receipt.repositoryOwnerId !== exactOwnerId || receipt.workflow !== exactWorkflow ||
        receipt.workflowRef !== exactWorkflowRef || receipt.workflowSha !== context.candidateSha ||
        receipt.ref !== exactRef || receipt.runId !== context.runId ||
        receipt.runAttempt !== context.runAttempt || receipt.reportKind !== context.kind ||
        receipt.producerJob !== context.producerJob || receipt.artifactName !== expectedName ||
        receipt.candidateSha !== context.candidateSha || receipt.prepared !== context.prepared ||
        receipt.reportSha256 !== reportSha256 || reportSha256 !== handoff.reportSha256) {
      return fail("handoff receipt does not bind exact producer report bytes", "handoff")
    }
    return { reportBytes, identity }
  } finally {
    rmSync(download, { recursive: true, force: true })
  }
}

export const retainSelfReleaseReport = async (
  input: SelfReleaseReportRetentionInput
): Promise<SelfReleaseReportRetentionResult> => {
  const contract = kindContract[input.kind]
  const splitRetention = contract.producerJob !== contract.retentionJob
  if (splitRetention !== (input.handoff !== undefined)) {
    return fail("report transport does not match the exact job topology", "handoff")
  }
  if (splitRetention !== (input.producerResult === "success" || input.producerResult === "failure")) {
    return fail("producer result does not match the exact job topology", "handoff")
  }
  const context = admit(input, contract.retentionJob)
  const source = input.handoff === undefined
    ? {
        reportBytes: privateRegularBytes(input.workspace, context.reportPath, { requirePrivateMode: true }),
        identity: undefined
      }
    : await handoffReportBytes(input, context, input.handoff)
  const reportBytes = source.reportBytes
  const reportSha256 = validateReportBytes(context, reportBytes, input.environment)
  if (input.handoff !== undefined && reportSha256 !== input.handoff.reportSha256) {
    return fail("validated report digest differs from the handoff artifact", "handoff")
  }
  const receiptBytes = canonicalReceipt(
    context,
    reportSha256,
    source.identity,
    input.producerResult ?? "same-job"
  )
  const committed = await commitExactArtifact({
    artifacts: input.artifacts,
    artifactName: context.artifactName,
    files: { "receipt.json": receiptBytes, "report.json": reportBytes },
    temporaryRoot: input.temporaryRoot ?? tmpdir()
  })
  return {
    schemaVersion: "ts-release/report-retention-result/v1",
    status: committed.status,
    artifactName: committed.artifactName,
    artifactId: committed.artifactId,
    artifactDigest: committed.artifactDigest,
    reportSha256
  }
}
