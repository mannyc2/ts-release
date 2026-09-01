import { parseStrictJson } from "../../../scripts/lib/strict-json.js"

export const npmOidcCertificationSchemaVersion = "ts-release/npm-oidc-certification/v1" as const
export const npmOidcCertificationStatus = "certified-no-upload" as const
export const npmOidcCertificationScope = "oidc-dry-run-only-no-upload" as const

const gitSha = /^[a-f0-9]{40}$/u
const sha1 = /^[a-f0-9]{40}$/u
const sha256 = /^[a-f0-9]{64}$/u
const sha512Sri = /^sha512-[A-Za-z0-9+/]{86}==$/u
const positiveDecimal = /^[1-9][0-9]*$/u
const preparedReference = /^prepared:gha:mannyc2\/ts-release\/runs\/([1-9][0-9]*)\/attempts\/([1-9][0-9]*)\/artifacts\/ts-release-prepared-\2-([a-f0-9]{64})#sha256-\3$/u

export interface NpmOidcRegistrySnapshot {
  readonly packumentStatus: 200
  readonly packumentSha256: string
  readonly distTagsStatus: 200
  readonly distTagsSha256: string
  readonly latest: string
  readonly versionStatus: 404
  readonly versionSha256: string
  readonly attestationsStatus: 404
  readonly attestationsSha256: string
}

export interface NpmOidcCertificationReceipt {
  readonly schemaVersion: typeof npmOidcCertificationSchemaVersion
  readonly status: typeof npmOidcCertificationStatus
  readonly scope: typeof npmOidcCertificationScope
  readonly candidateSha: string
  readonly prepared: string
  readonly package: {
    readonly name: "@mannyc1/ts-release"
    readonly version: "0.3.0"
    readonly preparedDigest: string
    readonly tarballSize: number
    readonly tarballSha1: string
    readonly tarballSha256: string
    readonly tarballIntegrity: string
  }
  readonly toolchain: {
    readonly node: "22.22.2"
    readonly bun: "1.3.14"
    readonly npm: "11.11.0"
  }
  readonly github: {
    readonly repository: "mannyc2/ts-release"
    readonly repositoryId: "1271545637"
    readonly repositoryOwner: "mannyc2"
    readonly repositoryOwnerId: "126291407"
    readonly repositoryVisibility: "public"
    readonly actor: "mannyc2"
    readonly actorId: "126291407"
    readonly refProtected: "true"
    readonly workflow: "Release"
    readonly workflowRef: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main"
    readonly workflowSha: string
    readonly directJobWorkflowClaims: "absent"
    readonly ref: "refs/heads/main"
    readonly eventName: "workflow_dispatch"
    readonly environment: "npm"
    readonly runnerEnvironment: "github-hosted"
    readonly runId: string
    readonly runAttempt: string
  }
  readonly oidc: {
    readonly issuer: "https://token.actions.githubusercontent.com"
    readonly audience: "npm:registry.npmjs.org"
    readonly subject: "repo:mannyc2@126291407/ts-release@1271545637:environment:npm"
    readonly algorithm: "RS256"
  }
  readonly registry: {
    readonly before: NpmOidcRegistrySnapshot
    readonly after: NpmOidcRegistrySnapshot
    readonly unchanged: true
  }
  readonly npmDryRun: {
    readonly command: "npm publish exact.tgz --dry-run --ignore-scripts --registry https://registry.npmjs.org/ --tag latest --access public --json --loglevel verbose"
    readonly tokenExchangeMarkers: 1
    readonly packageId: "@mannyc1/ts-release@0.3.0"
    readonly packageSize: number
    readonly claim: typeof npmOidcCertificationScope
    readonly provenance: "not-certified"
  }
}

type ObjectValue = Readonly<Record<string, unknown>>

const fail = (reason: string): never => {
  throw new Error(`npm OIDC certification receipt refused: ${reason}`)
}

const object = (value: unknown, name: string): ObjectValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${name} is not an object`)
  return value as ObjectValue
}

const exactKeys = (value: ObjectValue, expected: ReadonlyArray<string>, name: string): void => {
  if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) {
    fail(`${name} keys are not exact`)
  }
}

const boundedText = (value: unknown, name: string, maximum = 4096): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    return fail(`${name} is not one bounded nonempty string`)
  }
  return value
}

const safePositiveInteger = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return fail(`${name} is not one positive safe integer`)
  }
  return value
}

const decodeSnapshot = (value: unknown, name: string): NpmOidcRegistrySnapshot => {
  const snapshot = object(value, name)
  exactKeys(snapshot, [
    "packumentStatus", "packumentSha256", "distTagsStatus", "distTagsSha256", "latest",
    "versionStatus", "versionSha256", "attestationsStatus", "attestationsSha256"
  ], name)
  if (snapshot.packumentStatus !== 200 || snapshot.distTagsStatus !== 200 ||
      snapshot.versionStatus !== 404 || snapshot.attestationsStatus !== 404) {
    return fail(`${name} does not prove the required public absence baseline`)
  }
  for (const field of [
    "packumentSha256", "distTagsSha256", "versionSha256", "attestationsSha256"
  ] as const) {
    if (typeof snapshot[field] !== "string" || !sha256.test(snapshot[field])) {
      fail(`${name}.${field} is not canonical SHA-256`)
    }
  }
  const latest = boundedText(snapshot.latest, `${name}.latest`, 128)
  if (latest === "0.3.0") fail(`${name}.latest already selects the release candidate`)
  return snapshot as unknown as NpmOidcRegistrySnapshot
}

export const decodeNpmOidcCertificationReceipt = (
  value: unknown,
  expected?: { readonly candidateSha?: string, readonly prepared?: string }
): NpmOidcCertificationReceipt => {
  const receipt = object(value, "receipt")
  exactKeys(receipt, [
    "schemaVersion", "status", "scope", "candidateSha", "prepared", "package", "toolchain",
    "github", "oidc", "registry", "npmDryRun"
  ], "receipt")
  if (receipt.schemaVersion !== npmOidcCertificationSchemaVersion ||
      receipt.status !== npmOidcCertificationStatus || receipt.scope !== npmOidcCertificationScope) {
    return fail("schema, status, or no-upload scope is not exact")
  }
  const candidateSha = boundedText(receipt.candidateSha, "candidateSha", 40)
  const prepared = boundedText(receipt.prepared, "prepared")
  const reference = preparedReference.exec(prepared)
  if (!gitSha.test(candidateSha) || reference === null ||
      (expected?.candidateSha !== undefined && expected.candidateSha !== candidateSha) ||
      (expected?.prepared !== undefined && expected.prepared !== prepared)) {
    return fail("candidate or prepared reference is not exact")
  }

  const packageValue = object(receipt.package, "package")
  exactKeys(packageValue, [
    "name", "version", "preparedDigest", "tarballSize", "tarballSha1", "tarballSha256", "tarballIntegrity"
  ], "package")
  if (packageValue.name !== "@mannyc1/ts-release" || packageValue.version !== "0.3.0" ||
      packageValue.preparedDigest !== reference[3] || !sha1.test(String(packageValue.tarballSha1)) ||
      !sha256.test(String(packageValue.tarballSha256)) || !sha512Sri.test(String(packageValue.tarballIntegrity))) {
    return fail("package bytes or coordinate is not canonical")
  }
  const tarballSize = safePositiveInteger(packageValue.tarballSize, "package.tarballSize")

  const toolchain = object(receipt.toolchain, "toolchain")
  exactKeys(toolchain, ["node", "bun", "npm"], "toolchain")
  if (toolchain.node !== "22.22.2" || toolchain.bun !== "1.3.14" || toolchain.npm !== "11.11.0") {
    return fail("toolchain is not the certified pin")
  }

  const github = object(receipt.github, "github")
  exactKeys(github, [
    "repository", "repositoryId", "repositoryOwner", "repositoryOwnerId", "repositoryVisibility",
    "actor", "actorId", "refProtected", "workflow", "workflowRef", "workflowSha",
    "directJobWorkflowClaims", "ref", "eventName",
    "environment", "runnerEnvironment", "runId", "runAttempt"
  ], "github")
  if (github.repository !== "mannyc2/ts-release" || github.repositoryId !== "1271545637" ||
      github.repositoryOwner !== "mannyc2" || github.repositoryOwnerId !== "126291407" ||
      github.repositoryVisibility !== "public" || github.actor !== "mannyc2" ||
      github.actorId !== "126291407" || github.refProtected !== "true" || github.workflow !== "Release" ||
      github.workflowRef !== "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main" ||
      github.workflowSha !== candidateSha || github.directJobWorkflowClaims !== "absent" ||
      github.ref !== "refs/heads/main" || github.eventName !== "workflow_dispatch" ||
      github.environment !== "npm" || github.runnerEnvironment !== "github-hosted" ||
      typeof github.runId !== "string" || !positiveDecimal.test(github.runId) ||
      typeof github.runAttempt !== "string" || !positiveDecimal.test(github.runAttempt)) {
    return fail("GitHub identity is not exact direct release.yml on current main")
  }

  const oidc = object(receipt.oidc, "oidc")
  exactKeys(oidc, ["issuer", "audience", "subject", "algorithm"], "oidc")
  if (oidc.issuer !== "https://token.actions.githubusercontent.com" ||
      oidc.audience !== "npm:registry.npmjs.org" ||
      oidc.subject !== "repo:mannyc2@126291407/ts-release@1271545637:environment:npm" ||
      oidc.algorithm !== "RS256") {
    return fail("OIDC identity is not the exact immutable npm environment subject")
  }

  const registry = object(receipt.registry, "registry")
  exactKeys(registry, ["before", "after", "unchanged"], "registry")
  const before = decodeSnapshot(registry.before, "registry.before")
  const after = decodeSnapshot(registry.after, "registry.after")
  if (registry.unchanged !== true || JSON.stringify(before) !== JSON.stringify(after)) {
    return fail("registry state changed during certification")
  }

  const npmDryRun = object(receipt.npmDryRun, "npmDryRun")
  exactKeys(npmDryRun, [
    "command", "tokenExchangeMarkers", "packageId", "packageSize", "claim", "provenance"
  ], "npmDryRun")
  if (npmDryRun.command !== "npm publish exact.tgz --dry-run --ignore-scripts --registry https://registry.npmjs.org/ --tag latest --access public --json --loglevel verbose" ||
      npmDryRun.tokenExchangeMarkers !== 1 || npmDryRun.packageId !== "@mannyc1/ts-release@0.3.0" ||
      npmDryRun.packageSize !== tarballSize || npmDryRun.claim !== npmOidcCertificationScope ||
      npmDryRun.provenance !== "not-certified") {
    return fail("npm result does not prove one exact OIDC dry-run without upload")
  }
  return receipt as unknown as NpmOidcCertificationReceipt
}

export const parseNpmOidcCertificationReceipt = (
  text: string,
  expected?: { readonly candidateSha?: string, readonly prepared?: string }
): NpmOidcCertificationReceipt => decodeNpmOidcCertificationReceipt(parseStrictJson(text), expected)
