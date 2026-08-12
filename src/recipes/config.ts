import * as Schema from "effect/Schema"
import * as Semver from "semver"
import { CredentialRef } from "../model/authority.js"
import { NonEmptyName, OutputId, SafeArchivePattern, SafeRelativePath, Version } from "../model/primitives.js"

const optional = Schema.optionalKey
const nonempty = Schema.NonEmptyString
const target = Schema.Literals([
  "linux-x64", "linux-arm64", "linux-x64-musl", "linux-arm64-musl",
  "darwin-x64", "darwin-arm64", "windows-x64", "windows-arm64"
])
const os = Schema.Literals(["linux", "darwin", "windows"])
const arch = Schema.Literals(["x64", "arm64"])

export class CandidateProject extends Schema.Class<CandidateProject>("CandidateProject")({
  name: NonEmptyName,
  packageName: optional(nonempty),
  version: Version,
  repository: optional(nonempty),
  packagePath: optional(SafeRelativePath),
  commit: optional(nonempty),
  tag: NonEmptyName,
  notes: optional(Schema.String),
  description: optional(nonempty),
  summary: optional(nonempty),
  homepage: optional(nonempty),
  license: optional(nonempty)
}) {}

export class CandidatePlatform extends Schema.Class<CandidatePlatform>("CandidatePlatform")({
  os,
  arch,
  libc: optional(Schema.Literals(["glibc", "musl"])),
  binaryName: optional(nonempty),
  executableExtension: optional(nonempty),
  installPath: optional(nonempty),
  targetTriple: optional(nonempty)
}) {}

export class CandidateArtifact extends Schema.Class<CandidateArtifact>("CandidateArtifact")({
  id: OutputId,
  path: SafeRelativePath,
  format: Schema.Literals(["tarball", "zip", "file", "directory", "executable", "binary"]),
  checksum: optional(Schema.Struct({
    algorithm: Schema.Literals(["sha256", "sha512"]),
    value: Schema.String
  })),
  variant: optional(CandidatePlatform)
}) {}

const checksumName = SafeRelativePath.check(Schema.makeFilter((value: string) => {
  const literal = value.replaceAll("{version}", "").replaceAll("{name}", "")
  return literal.includes("{") || literal.includes("}")
    ? "Checksum name supports only the {name} and {version} tokens."
    : undefined
}))

export class CandidateChecksum extends Schema.Class<CandidateChecksum>("CandidateChecksum")({
  algorithm: optional(Schema.Literals(["sha256", "sha512"])),
  nameTemplate: optional(checksumName)
}) {}

const build = {
  id: optional(Schema.String),
  targets: Schema.Array(target),
  output: optional(SafeRelativePath),
  binary: optional(Schema.String)
}

export class CandidateBunBuild extends Schema.Class<CandidateBunBuild>("CandidateBunBuild")({
  ...build,
  builder: Schema.Literal("bun"),
  entry: SafeRelativePath,
  binaryName: optional(Schema.String),
  installPath: optional(Schema.String),
  cpu: optional(Schema.Literals(["baseline", "modern"])),
  minify: optional(Schema.Boolean)
}) {}

export class CandidateCommandBuild extends Schema.Class<CandidateCommandBuild>("CandidateCommandBuild")({
  ...build,
  builder: Schema.Literal("command"),
  output: SafeRelativePath,
  run: Schema.NonEmptyArray(Schema.String)
}) {}

export class CandidatePrebuiltBuild extends Schema.Class<CandidatePrebuiltBuild>("CandidatePrebuiltBuild")({
  ...build,
  builder: Schema.Literal("prebuilt"),
  output: SafeRelativePath
}) {}

export const CandidateBuild = Schema.Union([
  CandidateBunBuild,
  CandidateCommandBuild,
  CandidatePrebuiltBuild
])

export class CandidateArchive extends Schema.Class<CandidateArchive>("CandidateArchive")({
  id: optional(nonempty),
  ids: optional(Schema.Array(nonempty)),
  nameTemplate: optional(nonempty),
  formats: optional(Schema.Array(Schema.Literals(["tar.gz", "zip"]))),
  files: optional(Schema.NonEmptyArray(SafeArchivePattern)),
  wrapInDirectory: optional(Schema.Union([Schema.Boolean, Schema.String]))
}) {}

const preparationBase = {
  id: NonEmptyName,
  run: Schema.NonEmptyArray(Schema.String),
  cwd: optional(SafeRelativePath),
  environmentNames: optional(Schema.Array(nonempty)),
  inputs: optional(Schema.Array(OutputId))
}

export class CandidateCheckPreparation extends Schema.Class<CandidateCheckPreparation>("CandidateCheckPreparation")({
  kind: Schema.Literal("check"), ...preparationBase
}) {}

export class CandidateArtifactPreparation extends Schema.Class<CandidateArtifactPreparation>("CandidateArtifactPreparation")({
  kind: Schema.Literal("artifact"), ...preparationBase,
  outputs: Schema.NonEmptyArray(Schema.Struct({
    id: OutputId, path: SafeRelativePath,
    kind: optional(Schema.Literals(["file", "archive", "executable", "digest", "catalog-file"])),
    mediaType: optional(nonempty)
  }))
}) {}

export const CandidatePreparation = Schema.Union([
  CandidateCheckPreparation, CandidateArtifactPreparation
])

export class CandidateContentHole extends Schema.Class<CandidateContentHole>("CandidateContentHole")({
  fact: Schema.Literals(["sha256", "downloadUrl", "assetName"]),
  artifact: OutputId
}) {}

export class CandidateCatalog extends Schema.Class<CandidateCatalog>("CandidateCatalog")({
  id: nonempty,
  repository: Schema.String,
  file: SafeRelativePath,
  content: Schema.Union([
    Schema.String,
    Schema.Array(Schema.Union([Schema.String, CandidateContentHole]))
  ])
}) {}

export interface NpmRegistryEndpointPolicy {
  /** Test servers must opt in; production-authored config never enables this. */
  readonly allowInsecureLoopback?: true
}

/** Parse and normalize the complete npm credential audience, including base path. */
export const canonicalizeNpmRegistryEndpoint = (
  value: string,
  policy: NpmRegistryEndpointPolicy = {}
): string => {
  let endpoint: URL
  try { endpoint = new URL(value) } catch {
    throw new Error("npm registry must be an absolute HTTPS URL.")
  }
  const loopback = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1" ||
    endpoint.hostname === "[::1]"
  if (endpoint.host.length === 0 || (endpoint.protocol !== "https:" &&
      !(policy.allowInsecureLoopback === true && loopback && endpoint.protocol === "http:"))) {
    throw new Error("npm registry must be HTTPS; HTTP is reserved for explicitly enabled loopback tests.")
  }
  if (endpoint.username.length > 0 || endpoint.password.length > 0) {
    throw new Error("npm registry must not contain credentials.")
  }
  if (endpoint.search.length > 0 || endpoint.hash.length > 0) {
    throw new Error("npm registry must not contain a query or fragment.")
  }
  endpoint.pathname = endpoint.pathname.replace(/\/{2,}/gu, "/").replace(/\/+$/u, "") || "/"
  return `${endpoint.origin}${endpoint.pathname === "/" ? "/" : `${endpoint.pathname}/`}`
}

/** Canonical npm registry audience, including its normalized base path. */
export const CanonicalNpmRegistryEndpoint = Schema.NonEmptyString.check(
  Schema.makeFilter((value: string) => {
    try {
      return canonicalizeNpmRegistryEndpoint(value) === value
        ? undefined
        : "npm registry endpoint must be canonical."
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause)
    }
  })
).pipe(Schema.brand("CanonicalNpmRegistryEndpoint"))
export type CanonicalNpmRegistryEndpoint = typeof CanonicalNpmRegistryEndpoint.Type

/** npm distribution tags are URI-safe names that do not parse as SemVer ranges. */
export const NpmDistTag = Schema.NonEmptyString.check(Schema.makeFilter((value: string) => {
  if (Semver.validRange(value) !== null) {
    return "npm dist-tag must not be a valid SemVer range."
  }
  if (value.trim() !== value || encodeURIComponent(value) !== value) {
    return "npm dist-tag must be a nonempty URI-safe name without surrounding whitespace."
  }
  return undefined
})).pipe(Schema.brand("NpmDistTag"))
export type NpmDistTag = typeof NpmDistTag.Type

export const NpmAccess = Schema.Literals(["public", "restricted"])
export type NpmAccess = typeof NpmAccess.Type

export const NpmProvenancePolicy = Schema.Literals(["automatic", "required", "disabled"])
export type NpmProvenancePolicy = typeof NpmProvenancePolicy.Type

export const NpmPublicationMode = Schema.Literal("direct")
export type NpmPublicationMode = typeof NpmPublicationMode.Type

export class NpmTokenAuthentication
  extends Schema.Class<NpmTokenAuthentication>("NpmTokenAuthentication")({
    strategy: Schema.Literal("token"),
    credential: CredentialRef.check(Schema.makeFilter((value: string) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)
        ? undefined
        : "npm token credential must be a portable environment variable name."))
  }) {}

export const NpmTrustedPublisherRepository = Schema.NonEmptyString.check(Schema.makeFilter(
  (value: string) => /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(value)
    ? undefined
    : "npm trusted-publisher repository must be an owner/repository coordinate."
))

export const NpmTrustedPublisherWorkflow = Schema.NonEmptyString.check(Schema.makeFilter(
  (value: string) => /^[A-Za-z0-9_.-]+\.ya?ml$/u.test(value)
    ? undefined
    : "npm trusted-publisher workflow must be one YAML filename from .github/workflows/."
))

/** Operator-attested npm package trust relationship for one GitHub workflow. */
export class NpmTrustedPublisherAttestation
  extends Schema.Class<NpmTrustedPublisherAttestation>("NpmTrustedPublisherAttestation")({
    provider: Schema.Literal("github-actions"),
    runner: Schema.Literal("github-hosted"),
    repository: NpmTrustedPublisherRepository,
    workflow: NpmTrustedPublisherWorkflow,
    allowedAction: Schema.Literal("npm-publish-direct")
  }) {}

export class NpmTrustedPublishingAuthentication
  extends Schema.Class<NpmTrustedPublishingAuthentication>("NpmTrustedPublishingAuthentication")({
    strategy: Schema.Literal("trusted-publishing"),
    attestation: NpmTrustedPublisherAttestation
  }) {}

export const NpmAuthentication = Schema.Union([
  NpmTokenAuthentication,
  NpmTrustedPublishingAuthentication
])
export type NpmAuthentication = typeof NpmAuthentication.Type

/** Fully resolved npm intent. Every field is durable and behavior-affecting. */
export class CandidateNpmPublish extends Schema.Class<CandidateNpmPublish>("CandidateNpmPublish")({
  packageArtifact: OutputId,
  packageName: NonEmptyName,
  registry: CanonicalNpmRegistryEndpoint,
  distTag: NpmDistTag,
  access: NpmAccess,
  authentication: NpmAuthentication,
  provenance: NpmProvenancePolicy,
  publicationMode: NpmPublicationMode
}) {}

const trusted = {
  provider: optional(Schema.Literal("github-actions")),
  workflow: optional(nonempty)
}

export class CandidatePyPiPublish extends Schema.Class<CandidatePyPiPublish>("CandidatePyPiPublish")({
  repositoryUrl: optional(Schema.String),
  pythonExecutable: optional(Schema.String),
  trustedPublishing: optional(Schema.Struct({
    ...trusted,
    publisherConfigured: optional(Schema.Literal(true))
  })),
  ids: optional(Schema.NonEmptyArray(OutputId))
}) {}

export class CandidateGitHubPublish extends Schema.Class<CandidateGitHubPublish>("CandidateGitHubPublish")({
  repository: optional(Schema.String),
  tokenEnv: optional(Schema.String),
  draft: optional(Schema.Boolean),
  prerelease: optional(Schema.Union([Schema.Boolean, Schema.Literal("auto")])),
  bodyArtifact: optional(OutputId),
  ids: optional(Schema.Array(OutputId))
}) {}

const catalogPreset = {
  repository: Schema.String,
  ids: optional(Schema.NonEmptyArray(OutputId)),
  url: optional(Schema.String),
  formulaName: optional(Schema.String),
  manifestName: optional(Schema.String),
  formulaPath: optional(SafeRelativePath),
  manifestPath: optional(SafeRelativePath),
  installPath: optional(Schema.String),
  bin: optional(Schema.Union([Schema.String, Schema.Array(Schema.String)]))
}

export class CandidateHomebrew extends Schema.Class<CandidateHomebrew>("CandidateHomebrew")(
  catalogPreset
) {}
export class CandidateScoop extends Schema.Class<CandidateScoop>("CandidateScoop")(
  catalogPreset
) {}

export class CandidatePublish extends Schema.Class<CandidatePublish>("CandidatePublish")({
  npm: optional(CandidateNpmPublish),
  github: optional(CandidateGitHubPublish),
  homebrew: optional(CandidateHomebrew),
  scoop: optional(CandidateScoop),
  pypi: optional(CandidatePyPiPublish)
}) {}

export class CandidateConfig extends Schema.Class<CandidateConfig>("CandidateConfig")({
  "$schema": optional(Schema.String),
  project: CandidateProject,
  builds: optional(Schema.Array(CandidateBuild)),
  preparations: optional(Schema.Array(CandidatePreparation)),
  npmPackage: optional(Schema.Struct({ path: optional(SafeRelativePath) })),
  artifacts: optional(Schema.Array(CandidateArtifact)),
  archives: optional(Schema.Array(CandidateArchive)),
  checksum: optional(CandidateChecksum),
  catalogs: optional(Schema.Array(CandidateCatalog)),
  publish: optional(CandidatePublish)
}) {}
