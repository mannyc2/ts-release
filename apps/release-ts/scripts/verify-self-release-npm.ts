import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { spawnSync } from "node:child_process"
import { decodePreparedRelease } from "../../../src/release/prepared.js"
import { parseStrictJson } from "../../../scripts/lib/strict-json.js"
import { assertNoForbiddenNpmEnvironment } from "./check-self-release-dispatch.js"
import {
  assertNoToolTransportEnvironment,
  pinnedNpmExecutable,
  pinnedNpmClosedEnvironment,
  reauthenticatePinnedNpm,
  releaseNodeExecutable
} from "./install-self-release-npm.js"

const packageName = "@mannyc1/ts-release"
const version = "0.3.0"
const registry = "https://registry.npmjs.org"
const metadataUrl = `${registry}/@mannyc1%2fts-release/${version}`
const distTagsUrl = `${registry}/-/package/@mannyc1%2fts-release/dist-tags`
const tarballUrl = `${registry}/@mannyc1/ts-release/-/ts-release-${version}.tgz`
const attestationsUrl = `${registry}/-/npm/v1/attestations/@mannyc1%2fts-release@${version}`
const purl = `pkg:npm/%40mannyc1/ts-release@${version}`
const provenanceType = "https://slsa.dev/provenance/v1"
const statementType = "https://in-toto.io/Statement/v1"
const buildType = "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1"
const workflowRepository = "https://github.com/mannyc2/ts-release"
const workflowPath = ".github/workflows/release.yml"
const workflowRef = "refs/heads/main"
const certificateIdentityUri = `${workflowRepository}/${workflowPath}@${workflowRef}`
const certificateIssuer = "https://token.actions.githubusercontent.com"
const pinnedSigstoreVersion = "4.1.0"
const sourceRepositorySubject = "repo:mannyc2@126291407/ts-release@1271545637:environment:npm"
const builderId = "https://github.com/actions/runner/github-hosted"
const gitSha = /^[a-f0-9]{40}$/u
const positiveDecimal = /^[1-9][0-9]*$/u
const digestHex = /^[a-f0-9]{128}$/u
const preparedRef = /^prepared:gha:mannyc2\/ts-release\/runs\/[1-9][0-9]*\/attempts\/[1-9][0-9]*\/artifacts\/ts-release-prepared-[1-9][0-9]*-([a-f0-9]{64})#sha256-\1$/u
const canonicalInvocation = /^https:\/\/github\.com\/mannyc2\/ts-release\/actions\/runs\/([1-9][0-9]*)\/attempts\/([1-9][0-9]*)$/u
const actionReportPath = ".release/ts-release/action-report.json"

type ObjectValue = Readonly<Record<string, unknown>>
const object = (value: unknown, name: string): ObjectValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`)
  }
  return value as ObjectValue
}
const array = (value: unknown, name: string): ReadonlyArray<unknown> => {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array.`)
  return value
}
const string = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a nonempty string.`)
  return value
}
const exactKeys = (value: ObjectValue, name: string, keys: ReadonlyArray<string>): void => {
  if (Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new Error(`${name} has an unexpected shape.`)
  }
}
const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

const decodeBase64Json = (value: unknown): ObjectValue => {
  const encoded = string(value, "provenance payload")
  if (encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
    throw new Error("Provenance payload is not canonical base64.")
  }
  const bytes = Buffer.from(encoded, "base64")
  if (bytes.toString("base64") !== encoded) throw new Error("Provenance payload changed during base64 decoding.")
  return object(parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), "provenance statement")
}

export interface SelfReleaseNpmEvidenceInput {
  readonly candidateBytes: Uint8Array
  readonly tarballBytes: Uint8Array
  readonly candidateSha: string
  readonly invocationMode: "current-run" | "published-run"
  readonly runId: string
  readonly runAttempt: string
  readonly repositoryId: string
  readonly repositoryOwnerId: string
  readonly distTags: unknown
  readonly metadata: unknown
  readonly attestations: unknown
}

export interface VerifiedSelfReleaseNpmEvidence {
  readonly packageName: string
  readonly version: string
  readonly sha512: string
  readonly sourceSha: string
  readonly workflow: string
  readonly invocation: string
}

export type SelfReleaseNpmInvocationMode = "current-run" | "published-run"

const fulcioExtensionNames = [
  "workflowTrigger",
  "workflowSha",
  "workflowName",
  "workflowRepository",
  "workflowRef",
  "buildSignerUri",
  "buildSignerDigest",
  "runnerEnvironment",
  "sourceRepositoryUri",
  "sourceRepositoryDigest",
  "sourceRepositoryRef",
  "sourceRepositoryIdentifier",
  "sourceRepositoryOwnerUri",
  "sourceRepositoryOwnerIdentifier",
  "buildConfigUri",
  "buildConfigDigest",
  "trigger",
  "runInvocationUri",
  "sourceRepositoryVisibility",
  "sourceRepositorySubject"
] as const

export interface SelfReleaseFulcioEvidence {
  readonly sigstoreVersion: string
  readonly certificateIdentityUri: string
  readonly certificateIssuer: string
  readonly extensions: Readonly<Record<string, unknown>>
}

/** Authenticates the actual certificate identity returned only after pinned
 * Sigstore verification. A signed statement cannot self-assert these facts. */
export const verifySelfReleaseFulcioEvidence = (
  input: SelfReleaseFulcioEvidence,
  candidateSha: string,
  invocation: string
): void => {
  if (!gitSha.test(candidateSha) || canonicalInvocation.exec(invocation) === null ||
      input.sigstoreVersion !== pinnedSigstoreVersion ||
      input.certificateIdentityUri !== certificateIdentityUri ||
      input.certificateIssuer !== certificateIssuer) {
    throw new Error("Fulcio signer identity does not bind the exact self-release workflow.")
  }
  const expected: Readonly<Record<typeof fulcioExtensionNames[number], string>> = {
    workflowTrigger: "workflow_dispatch",
    workflowSha: candidateSha,
    workflowName: "Release",
    workflowRepository: "mannyc2/ts-release",
    workflowRef,
    buildSignerUri: certificateIdentityUri,
    buildSignerDigest: candidateSha,
    runnerEnvironment: "github-hosted",
    sourceRepositoryUri: workflowRepository,
    sourceRepositoryDigest: candidateSha,
    sourceRepositoryRef: workflowRef,
    sourceRepositoryIdentifier: "1271545637",
    sourceRepositoryOwnerUri: "https://github.com/mannyc2",
    sourceRepositoryOwnerIdentifier: "126291407",
    buildConfigUri: certificateIdentityUri,
    buildConfigDigest: candidateSha,
    trigger: "workflow_dispatch",
    runInvocationUri: invocation,
    sourceRepositoryVisibility: "public",
    sourceRepositorySubject
  }
  exactKeys(input.extensions, "Fulcio GitHub certificate extensions", fulcioExtensionNames)
  for (const name of fulcioExtensionNames) {
    if (input.extensions[name] !== expected[name]) {
      throw new Error(`Fulcio certificate extension ${name} does not bind the exact self-release run.`)
    }
  }
}

/** A fresh mutation must prove same-run provenance; an exact no-op recovery
 * verifies the original canonical publishing run instead. */
export const selectSelfReleaseNpmInvocationMode = (
  value: unknown,
  expectedPrepared: string
): SelfReleaseNpmInvocationMode => {
  const action = object(value, "npm Action report")
  exactKeys(action, "npm Action report", ["schemaVersion", "command", "status", "prepared", "report"])
  if (action.schemaVersion !== "ts-release-action-report/v2" || action.command !== "publish" ||
      action.status !== "complete" || action.prepared !== expectedPrepared) {
    throw new Error("npm Action report does not bind one complete publish of the adopted reference.")
  }
  const release = object(action.report, "npm release report")
  exactKeys(release, "npm release report", ["status", "subjects"])
  if (release.status !== "complete") throw new Error("npm release report is not complete.")
  const subjects = array(release.subjects, "npm release subjects")
  if (subjects.length !== 2) throw new Error("npm release report must contain only prepared and npm subjects.")
  const local = object(subjects[0], "prepared release subject")
  const remote = object(subjects[1], "npm release subject")
  if (local._tag !== "AlreadyEquivalent" || local.subject !== expectedPrepared ||
      remote.subject !== `npm:${packageName}@${version}`) {
    throw new Error("npm release report names a different publication subject.")
  }
  if (remote._tag === "ConvergedAfterMutation") return "current-run"
  if (remote._tag === "AlreadyEquivalent") return "published-run"
  throw new Error("npm release report neither mutated in this run nor proved exact prior equivalence.")
}

export const verifyPublishedInvocationRun = (input: {
  readonly invocation: string
  readonly candidateSha: string
  readonly response: unknown
}): { readonly runId: string, readonly runAttempt: string } => {
  const match = canonicalInvocation.exec(input.invocation)
  if (match === null || !gitSha.test(input.candidateSha)) {
    throw new Error("Published npm provenance invocation is not canonical.")
  }
  const runId = match[1]!
  const runAttempt = match[2]!
  const run = object(input.response, "GitHub publishing run attempt")
  const repository = object(run.repository, "GitHub publishing repository")
  const headRepository = object(run.head_repository, "GitHub publishing head repository")
  const path = string(run.path, "GitHub publishing workflow path")
  const canonicalPath = path.startsWith("mannyc2/ts-release/")
    ? path.slice("mannyc2/ts-release/".length)
    : path
  if (typeof run.id !== "number" || !Number.isSafeInteger(run.id) || String(run.id) !== runId ||
      typeof run.run_attempt !== "number" || !Number.isSafeInteger(run.run_attempt) || String(run.run_attempt) !== runAttempt ||
      run.head_sha !== input.candidateSha || run.head_branch !== "main" ||
      canonicalPath !== workflowPath || run.event !== "workflow_dispatch" || run.status !== "completed" ||
      repository.full_name !== "mannyc2/ts-release" || headRepository.full_name !== "mannyc2/ts-release") {
    throw new Error("GitHub did not authenticate the exact provenance publishing run attempt.")
  }
  return { runId, runAttempt }
}

export const verifySelfReleaseNpmEvidence = (
  input: SelfReleaseNpmEvidenceInput
): VerifiedSelfReleaseNpmEvidence => {
  if (!gitSha.test(input.candidateSha) ||
      (input.invocationMode === "current-run" &&
        (!positiveDecimal.test(input.runId) || !positiveDecimal.test(input.runAttempt))) ||
      !positiveDecimal.test(input.repositoryId) ||
      !positiveDecimal.test(input.repositoryOwnerId)) {
    throw new Error("Expected source and GitHub identities are not canonical.")
  }
  if (!equalBytes(input.candidateBytes, input.tarballBytes)) {
    throw new Error("Published tarball bytes differ from the adopted prepared artifact.")
  }
  const distTags = object(input.distTags, "package dist-tags")
  if (distTags.latest !== version) throw new Error("Registry latest does not select the exact published candidate.")
  const sha512 = createHash("sha512").update(input.candidateBytes).digest("hex")
  const integrity = `sha512-${createHash("sha512").update(input.candidateBytes).digest("base64")}`
  const shasum = createHash("sha1").update(input.candidateBytes).digest("hex")

  const metadata = object(input.metadata, "package metadata")
  const dist = object(metadata.dist, "package metadata dist")
  const distAttestations = object(dist.attestations, "package metadata attestations")
  const advertisedProvenance = object(distAttestations.provenance, "package metadata provenance")
  if (metadata.name !== packageName || metadata.version !== version || dist.integrity !== integrity ||
      dist.shasum !== shasum || dist.tarball !== tarballUrl || distAttestations.url !== attestationsUrl ||
      advertisedProvenance.predicateType !== provenanceType) {
    throw new Error("Registry metadata does not bind the exact adopted package bytes and provenance endpoint.")
  }

  const envelope = object(input.attestations, "attestations response")
  exactKeys(envelope, "attestations response", ["attestations"])
  const entries = array(envelope.attestations, "attestations")
  const candidates = entries.filter((entry) => object(entry, "attestation").predicateType === provenanceType)
  if (candidates.length !== 1) throw new Error("Registry must expose exactly one SLSA v1 provenance attestation.")
  const attestation = object(candidates[0], "provenance attestation")
  const attestationKeys = Object.keys(attestation).sort().join("\0")
  if (attestationKeys !== ["bundle", "predicateType"].join("\0") &&
      attestationKeys !== ["bundle", "predicateType", "signedAccessSignatureUrl"].join("\0")) {
    throw new Error("Provenance attestation has an unexpected shape.")
  }
  if (attestation.signedAccessSignatureUrl !== undefined && attestation.signedAccessSignatureUrl !== "") {
    throw new Error("Public provenance verification rejects a signed-access URL.")
  }
  const bundle = object(attestation.bundle, "provenance bundle")
  if (bundle.mediaType !== "application/vnd.dev.sigstore.bundle.v0.3+json") {
    throw new Error("Provenance bundle has the wrong Sigstore media type.")
  }
  const verification = object(bundle.verificationMaterial, "provenance verification material")
  const certificate = object(verification.certificate, "provenance certificate")
  if (string(certificate.rawBytes, "provenance certificate bytes").length === 0 ||
      array(verification.tlogEntries, "provenance transparency entries").length !== 1) {
    throw new Error("Provenance bundle lacks one certificate-backed transparency entry.")
  }
  const dsse = object(bundle.dsseEnvelope, "provenance DSSE envelope")
  if (dsse.payloadType !== "application/vnd.in-toto+json") {
    throw new Error("Provenance DSSE envelope has the wrong payload type.")
  }
  const signatures = array(dsse.signatures, "provenance signatures")
  if (signatures.length !== 1) throw new Error("Provenance DSSE envelope must carry exactly one signature.")
  const signature = object(signatures[0], "provenance signature")
  if (string(signature.sig, "provenance signature bytes").length === 0 || signature.keyid !== "") {
    throw new Error("Provenance signature must be the one keyless Fulcio identity.")
  }

  const statement = decodeBase64Json(dsse.payload)
  exactKeys(statement, "provenance statement", ["_type", "subject", "predicateType", "predicate"])
  if (statement._type !== statementType || statement.predicateType !== provenanceType) {
    throw new Error("Provenance statement type is not exact SLSA v1.")
  }
  const subjects = array(statement.subject, "provenance subjects")
  if (subjects.length !== 1) throw new Error("Provenance statement must carry one package subject.")
  const subject = object(subjects[0], "provenance subject")
  exactKeys(subject, "provenance subject", ["name", "digest"])
  const subjectDigest = object(subject.digest, "provenance subject digest")
  exactKeys(subjectDigest, "provenance subject digest", ["sha512"])
  if (subject.name !== purl || subjectDigest.sha512 !== sha512 || !digestHex.test(sha512)) {
    throw new Error("Provenance subject does not bind the exact package PURL and adopted bytes.")
  }

  const predicate = object(statement.predicate, "provenance predicate")
  exactKeys(predicate, "provenance predicate", ["buildDefinition", "runDetails"])
  const definition = object(predicate.buildDefinition, "provenance build definition")
  exactKeys(definition, "provenance build definition", [
    "buildType", "externalParameters", "internalParameters", "resolvedDependencies"
  ])
  const external = object(definition.externalParameters, "provenance external parameters")
  exactKeys(external, "provenance external parameters", ["workflow"])
  const workflow = object(external.workflow, "provenance workflow")
  exactKeys(workflow, "provenance workflow", ["ref", "repository", "path"])
  if (definition.buildType !== buildType || workflow.ref !== workflowRef ||
      workflow.repository !== workflowRepository || workflow.path !== workflowPath) {
    throw new Error("Provenance workflow identity is not the exact main release workflow.")
  }
  const internal = object(definition.internalParameters, "provenance internal parameters")
  exactKeys(internal, "provenance internal parameters", ["github"])
  const github = object(internal.github, "provenance GitHub identity")
  exactKeys(github, "provenance GitHub identity", ["event_name", "repository_id", "repository_owner_id"])
  if (github.event_name !== "workflow_dispatch" || github.repository_id !== input.repositoryId ||
      github.repository_owner_id !== input.repositoryOwnerId) {
    throw new Error("Provenance GitHub repository/event identity is not exact.")
  }
  const dependencies = array(definition.resolvedDependencies, "provenance resolved dependencies")
  if (dependencies.length !== 1) throw new Error("Provenance must bind one resolved source dependency.")
  const dependency = object(dependencies[0], "provenance resolved dependency")
  exactKeys(dependency, "provenance resolved dependency", ["uri", "digest"])
  const sourceDigest = object(dependency.digest, "provenance source digest")
  exactKeys(sourceDigest, "provenance source digest", ["gitCommit"])
  if (dependency.uri !== `git+${workflowRepository}@${workflowRef}` || sourceDigest.gitCommit !== input.candidateSha) {
    throw new Error("Provenance resolved dependency does not bind exact current main.")
  }
  const details = object(predicate.runDetails, "provenance run details")
  exactKeys(details, "provenance run details", ["builder", "metadata"])
  const builder = object(details.builder, "provenance builder")
  const runMetadata = object(details.metadata, "provenance run metadata")
  exactKeys(builder, "provenance builder", ["id"])
  exactKeys(runMetadata, "provenance run metadata", ["invocationId"])
  const invocation = string(runMetadata.invocationId, "provenance invocation")
  const invocationMatch = canonicalInvocation.exec(invocation)
  if (builder.id !== builderId || invocationMatch === null ||
      (input.invocationMode === "current-run" &&
        (invocationMatch[1] !== input.runId || invocationMatch[2] !== input.runAttempt))) {
    throw new Error("Provenance builder/invocation does not bind an admitted GitHub-hosted release run attempt.")
  }
  return {
    packageName,
    version,
    sha512,
    sourceSha: input.candidateSha,
    workflow: `mannyc2/ts-release/${workflowPath}@${workflowRef}`,
    invocation
  }
}

const boundedResponse = async (url: string, maximumBytes: number): Promise<Uint8Array> => {
  const response = await fetch(url, {
    headers: { accept: url.endsWith(".tgz") ? "application/octet-stream" : "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok || response.url !== url || response.headers.has("location")) {
    throw new Error(`Public verification did not receive one terminal response from ${url}.`)
  }
  const declaredText = response.headers.get("content-length")
  if (declaredText !== null) {
    const declared = Number(declaredText)
    if (!Number.isSafeInteger(declared) || declared <= 0 || declared > maximumBytes) {
      throw new Error(`Public verification response from ${url} has an invalid length.`)
    }
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length === 0 || bytes.length > maximumBytes ||
      (declaredText !== null && Number(declaredText) !== bytes.length)) {
    throw new Error(`Public verification response from ${url} is empty, truncated, or oversized.`)
  }
  return bytes
}

const authenticatePublishedInvocation = async (
  invocation: string,
  candidateSha: string,
  token: string
): Promise<void> => {
  const match = canonicalInvocation.exec(invocation)
  if (match === null || token.length === 0) {
    throw new Error("Published-run verification requires one step-scoped GitHub token and canonical invocation.")
  }
  const url = `https://api.github.com/repos/mannyc2/ts-release/actions/runs/${match[1]}/attempts/${match[2]}`
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28"
    },
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok || response.url !== url || response.headers.has("location")) {
    throw new Error("GitHub did not return the exact provenance publishing run attempt.")
  }
  const declared = response.headers.get("content-length")
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024 ||
      (declared !== null && Number(declared) !== bytes.length)) {
    throw new Error("GitHub publishing run-attempt response was empty, truncated, or oversized.")
  }
  verifyPublishedInvocationRun({
    invocation,
    candidateSha,
    response: parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  })
}

const readPublicEvidence = async (): Promise<{
  readonly metadata: unknown
  readonly distTags: unknown
  readonly attestations: unknown
  readonly tarballBytes: Uint8Array
}> => {
  let last: unknown
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const [metadataBytes, distTagsBytes] = await Promise.all([
        boundedResponse(metadataUrl, 4 * 1024 * 1024),
        boundedResponse(distTagsUrl, 256 * 1024)
      ])
      const metadata = parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(metadataBytes))
      const [tarballBytes, attestationBytes] = await Promise.all([
        boundedResponse(tarballUrl, 32 * 1024 * 1024),
        boundedResponse(attestationsUrl, 8 * 1024 * 1024)
      ])
      return {
        metadata,
        distTags: parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(distTagsBytes)),
        attestations: parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(attestationBytes)),
        tarballBytes
      }
    } catch (cause) {
      last = cause
      if (attempt < 12) await Bun.sleep(5_000)
    }
  }
  throw new Error(`Published npm evidence did not converge within the bounded reread window: ${last instanceof Error ? last.message : String(last)}`)
}

const pinnedSigstoreVerifier = String.raw`
const fs = require("node:fs")
const path = require("node:path")
const sigstoreRoot = process.argv[1]
const bundlePath = process.argv[2]
const tufCachePath = process.argv[3]
const candidateSha = process.argv[4]
const invocation = process.argv[5]
const manifest = JSON.parse(fs.readFileSync(path.join(sigstoreRoot, "package.json"), "utf8"))
if (manifest.name !== "sigstore" || manifest.version !== "4.1.0" || manifest.main !== "dist/index.js") {
  throw new Error("Pinned npm archive does not contain exact Sigstore 4.1.0.")
}
const sigstore = require(sigstoreRoot)
const { X509Certificate } = require(path.join(sigstoreRoot, "..", "@sigstore", "core"))
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"))
const expectedIdentity = "https://github.com/mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main"
const expectedIssuer = "https://token.actions.githubusercontent.com"
const extension = (certificate, oid, nested) => {
  const value = certificate.extension(oid)
  if (value === undefined) throw new Error("Fulcio certificate omitted required extension " + oid + ".")
  const bytes = nested ? value.valueObj.subs?.[0]?.value : value.value
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new Error("Fulcio certificate extension is malformed: " + oid + ".")
  return bytes.toString("utf8")
}
;(async () => {
  await sigstore.verify(bundle, {
    tufCachePath,
    tufForceCache: true,
    certificateIdentityURI: expectedIdentity,
    certificateIssuer: expectedIssuer,
    retry: { retries: 0 },
    timeout: 10000
  })
  const raw = bundle?.verificationMaterial?.certificate?.rawBytes
  if (typeof raw !== "string" || raw.length === 0) throw new Error("Sigstore bundle has no certificate.")
  const certificate = X509Certificate.parse(Buffer.from(raw, "base64"))
  const report = {
    sigstoreVersion: manifest.version,
    certificateIdentityUri: certificate.subjectAltName,
    certificateIssuer: extension(certificate, "1.3.6.1.4.1.57264.1.8", true),
    extensions: {
      workflowTrigger: extension(certificate, "1.3.6.1.4.1.57264.1.2", false),
      workflowSha: extension(certificate, "1.3.6.1.4.1.57264.1.3", false),
      workflowName: extension(certificate, "1.3.6.1.4.1.57264.1.4", false),
      workflowRepository: extension(certificate, "1.3.6.1.4.1.57264.1.5", false),
      workflowRef: extension(certificate, "1.3.6.1.4.1.57264.1.6", false),
      buildSignerUri: extension(certificate, "1.3.6.1.4.1.57264.1.9", true),
      buildSignerDigest: extension(certificate, "1.3.6.1.4.1.57264.1.10", true),
      runnerEnvironment: extension(certificate, "1.3.6.1.4.1.57264.1.11", true),
      sourceRepositoryUri: extension(certificate, "1.3.6.1.4.1.57264.1.12", true),
      sourceRepositoryDigest: extension(certificate, "1.3.6.1.4.1.57264.1.13", true),
      sourceRepositoryRef: extension(certificate, "1.3.6.1.4.1.57264.1.14", true),
      sourceRepositoryIdentifier: extension(certificate, "1.3.6.1.4.1.57264.1.15", true),
      sourceRepositoryOwnerUri: extension(certificate, "1.3.6.1.4.1.57264.1.16", true),
      sourceRepositoryOwnerIdentifier: extension(certificate, "1.3.6.1.4.1.57264.1.17", true),
      buildConfigUri: extension(certificate, "1.3.6.1.4.1.57264.1.18", true),
      buildConfigDigest: extension(certificate, "1.3.6.1.4.1.57264.1.19", true),
      trigger: extension(certificate, "1.3.6.1.4.1.57264.1.20", true),
      runInvocationUri: extension(certificate, "1.3.6.1.4.1.57264.1.21", true),
      sourceRepositoryVisibility: extension(certificate, "1.3.6.1.4.1.57264.1.22", true),
      sourceRepositorySubject: extension(certificate, "1.3.6.1.4.1.57264.1.24", true)
    }
  }
  process.stdout.write(JSON.stringify(report))
})().catch(() => process.exit(1))
`

const auditSignatures = (
  npmExecutable: string,
  nodeExecutable: string,
  bundle: unknown,
  candidateSha: string,
  invocation: string
): void => {
  const closedPath = `${dirname(nodeExecutable)}:${dirname(npmExecutable)}:/usr/bin:/bin`
  const npmVersion = spawnSync(npmExecutable, ["--version"], {
    encoding: "utf8", stdio: "pipe",
    env: pinnedNpmClosedEnvironment(process.cwd(), closedPath)
  })
  if (npmVersion.status !== 0 || npmVersion.stdout.trim() !== "11.11.0") {
    throw new Error("Cryptographic npm verification requires exact npm 11.11.0.")
  }
  const directory = mkdtempSync(join(tmpdir(), "ts-release-npm-audit-"))
  try {
    const userConfig = join(directory, "npmrc")
    const globalConfig = join(directory, "global-npmrc")
    writeFileSync(userConfig, "registry=https://registry.npmjs.org/\nignore-scripts=true\n", { mode: 0o600 })
    writeFileSync(globalConfig, "", { mode: 0o600 })
    writeFileSync(join(directory, "package.json"), `${JSON.stringify({ name: "ts-release-public-verifier", private: true })}\n`)
    const environment = {
      HOME: directory,
      LANG: "C.UTF-8",
      NPM_CONFIG_USERCONFIG: userConfig,
      NPM_CONFIG_GLOBALCONFIG: globalConfig,
      PATH: closedPath
    }
    const install = spawnSync(npmExecutable, [
      "install", "--ignore-scripts", "--package-lock=true", "--save-exact", "--audit=false", "--fund=false",
      "--registry", `${registry}/`, `${packageName}@${version}`
    ], { cwd: directory, env: environment, encoding: "utf8", stdio: "pipe" })
    if (install.status !== 0) throw new Error("Exact published package could not be installed for signature verification.")
    const audit = spawnSync(npmExecutable, ["audit", "signatures", "--registry", `${registry}/`], {
      cwd: directory, env: environment, encoding: "utf8", stdio: "pipe"
    })
    if (audit.status !== 0 || !/verified attestation/iu.test(`${audit.stdout}\n${audit.stderr}`)) {
      throw new Error("npm 11.11.0 did not cryptographically verify the published provenance attestation.")
    }
    const bundlePath = join(directory, "provenance-bundle.json")
    writeFileSync(bundlePath, `${JSON.stringify(bundle)}\n`, { mode: 0o600, flag: "wx" })
    const sigstoreRoot = join(dirname(dirname(npmExecutable)), "package", "node_modules", "sigstore")
    const identity = spawnSync(nodeExecutable, [
      "-e",
      pinnedSigstoreVerifier,
      sigstoreRoot,
      bundlePath,
      join(directory, ".npm", "_tuf"),
      candidateSha,
      invocation
    ], {
      cwd: directory,
      env: environment,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024
    })
    if (identity.status !== 0 || identity.stdout.length === 0 || identity.stdout.length > 256 * 1024) {
      throw new Error("Pinned Sigstore 4.1.0 did not verify the exact Fulcio workflow identity.")
    }
    const evidence = object(parseStrictJson(identity.stdout), "Fulcio identity verification")
    exactKeys(evidence, "Fulcio identity verification", [
      "sigstoreVersion", "certificateIdentityUri", "certificateIssuer", "extensions"
    ])
    verifySelfReleaseFulcioEvidence({
      sigstoreVersion: string(evidence.sigstoreVersion, "Sigstore version"),
      certificateIdentityUri: string(evidence.certificateIdentityUri, "Fulcio certificate identity"),
      certificateIssuer: string(evidence.certificateIssuer, "Fulcio certificate issuer"),
      extensions: object(evidence.extensions, "Fulcio certificate extensions")
    }, candidateSha, invocation)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const main = async (): Promise<void> => {
  assertNoForbiddenNpmEnvironment(process.env)
  assertNoToolTransportEnvironment(process.env)
  const [reference, candidateSha, requestedMode, reportPath] = process.argv.slice(2)
  const matched = preparedRef.exec(reference ?? "")
  if (matched === null || !gitSha.test(candidateSha ?? "") ||
      (requestedMode !== "current-run" && requestedMode !== "published-run" && requestedMode !== "action-report")) {
    throw new Error("Usage: verify-self-release-npm.ts <canonical prepared:gha reference> <candidate sha> <current-run|published-run|action-report> [report path]")
  }
  let invocationMode: SelfReleaseNpmInvocationMode
  if (requestedMode === "action-report") {
    if (reportPath !== actionReportPath) {
      throw new Error("Report-aware npm verification requires the exact Action report path.")
    }
    invocationMode = selectSelfReleaseNpmInvocationMode(
      parseStrictJson(readFileSync(join(process.cwd(), actionReportPath), "utf8")),
      reference!
    )
  } else {
    invocationMode = requestedMode
  }
  const nodeExecutable = releaseNodeExecutable(process.env)
  reauthenticatePinnedNpm(process.cwd(), nodeExecutable)
  const manifestDigest = matched[1]!
  const directory = join(process.cwd(), ".release", "ts-release", "prepared", manifestDigest)
  const manifest = decodePreparedRelease(new Uint8Array(readFileSync(join(directory, "prepared-release.json"))))
  const publications = manifest.publications.filter((publication) => publication._tag === "PreparedNpmPublication")
  if (manifest.source.commit.toString() !== candidateSha || manifest.project.version.toString() !== version ||
      publications.length !== 1 || manifest.publications.length !== 1) {
    throw new Error("Adopted prepared bundle is not the exact npm-only 0.3.0 candidate.")
  }
  const publication = publications[0]!
  const artifact = manifest.artifacts.find((candidate) => candidate.id.toString() === publication.artifactId.toString())
  if (publication.packageName.toString() !== packageName || publication.registryUrl.toString() !== `${registry}/` ||
      publication.access !== "public" || publication.provenance !== "automatic" || artifact === undefined) {
    throw new Error("Adopted prepared bundle has the wrong npm publication contract.")
  }
  const candidateBytes = new Uint8Array(readFileSync(join(directory, "blobs", artifact.blob.hex)))
  if (candidateBytes.length !== artifact.size ||
      createHash("sha256").update(candidateBytes).digest("hex") !== artifact.digest.hex) {
    throw new Error("Adopted npm artifact failed its prepared size/digest contract.")
  }
  const publicEvidence = await readPublicEvidence()
  const verified = verifySelfReleaseNpmEvidence({
    candidateBytes,
    tarballBytes: publicEvidence.tarballBytes,
    candidateSha,
    invocationMode,
    runId: process.env.GITHUB_RUN_ID ?? "",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
    repositoryId: process.env.GITHUB_REPOSITORY_ID ?? "",
    repositoryOwnerId: process.env.GITHUB_REPOSITORY_OWNER_ID ?? "",
    distTags: publicEvidence.distTags,
    metadata: publicEvidence.metadata,
    attestations: publicEvidence.attestations
  })
  if (invocationMode === "published-run") {
    await authenticatePublishedInvocation(
      verified.invocation,
      candidateSha!,
      process.env.GITHUB_TOKEN?.trim() ?? ""
    )
  }
  const attestationEnvelope = object(publicEvidence.attestations, "attestations response")
  const provenanceEntries = array(attestationEnvelope.attestations, "attestations")
    .map((entry) => object(entry, "attestation"))
    .filter((entry) => entry.predicateType === provenanceType)
  if (provenanceEntries.length !== 1) throw new Error("Public evidence lost its unique provenance bundle.")
  auditSignatures(
    pinnedNpmExecutable(),
    nodeExecutable,
    provenanceEntries[0]!.bundle,
    candidateSha,
    verified.invocation
  )
  console.log(JSON.stringify({
    schemaVersion: "ts-release/npm-public-verification/v1",
    status: "verified",
    ...verified,
    cryptographicVerification: "npm-audit-signatures-11.11.0+sigstore-4.1.0-exact-fulcio-identity"
  }))
}

if (import.meta.main) await main()
