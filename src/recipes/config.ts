import * as Schema from "effect/Schema"
import * as Semver from "semver"
import { bunArtifactTargetIds } from "../model/bun-targets.js"
import { CredentialRef } from "../model/authority.js"
import {
  ArtifactCollectionContract,
  ArtifactCollectionSelector
} from "../model/artifact-collection.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../model/primitives.js"
import { Sha256Hex } from "../model/digest.js"
import {
  PyPiProjectName,
  PyPiRepository,
  normalizePyPiProjectName,
  pypiRepositoryEndpoints
} from "../model/pypi.js"
import {
  CatalogArchitecture,
  CatalogRepositoryPath,
  GitBranchName,
  GitHubRepositoryCoordinate
} from "../model/catalog.js"
export {
  PyPiProjectName,
  PyPiRepository,
  normalizePyPiProjectName,
  pypiRepositoryEndpoints
} from "../model/pypi.js"
export type { PyPiRepositoryEndpoints } from "../model/pypi.js"

const optional = Schema.optionalKey
const nonempty = Schema.NonEmptyString
const target = Schema.Literals(bunArtifactTargetIds)

export class CandidateProject extends Schema.Class<CandidateProject>("CandidateProject")({
  name: NonEmptyName,
  packageName: optional(nonempty),
  version: Version,
  repository: optional(nonempty),
  tag: NonEmptyName
}) {}

export class CandidateArtifact extends Schema.Class<CandidateArtifact>("CandidateArtifact")({
  id: OutputId,
  path: SafeRelativePath,
  format: Schema.Literals(["tarball", "zip", "file", "executable"])
}) {}

export class CandidateChecksum extends Schema.Class<CandidateChecksum>("CandidateChecksum")({
  algorithm: Schema.Literals(["sha256", "sha512"])
}) {}

const build = {
  id: optional(nonempty),
  targets: Schema.NonEmptyArray(target),
  output: optional(SafeRelativePath),
  binary: optional(NonEmptyName)
}

export class CandidateBunBuild extends Schema.Class<CandidateBunBuild>("CandidateBunBuild")({
  ...build,
  builder: Schema.Literal("bun"),
  entry: SafeRelativePath,
  minify: optional(Schema.Literal(true))
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
  ids: optional(Schema.NonEmptyArray(OutputId)),
  nameTemplate: optional(nonempty),
  formats: optional(Schema.NonEmptyArray(Schema.Literals(["tar.gz", "zip"])))
}) {}

const preparationBase = {
  id: NonEmptyName,
  run: Schema.NonEmptyArray(Schema.String),
  cwd: optional(SafeRelativePath),
  inputs: optional(Schema.Array(OutputId))
}

export class CandidateCheckPreparation extends Schema.Class<CandidateCheckPreparation>("CandidateCheckPreparation")({
  kind: Schema.Literal("check"), ...preparationBase
}) {}

export class CandidateArtifactPreparation extends Schema.Class<CandidateArtifactPreparation>("CandidateArtifactPreparation")({
  kind: Schema.Literal("artifact"), ...preparationBase,
  outputs: Schema.NonEmptyArray(Schema.Struct({
    id: OutputId, path: SafeRelativePath,
    kind: optional(Schema.Literals(["file", "archive", "executable", "digest"])),
    mediaType: optional(nonempty)
  }))
}) {}

const {
  id: _collectionId,
  producer: _collectionProducer,
  ...candidateCollectionFields
} = ArtifactCollectionContract.fields

/** Runtime-discovered outputs for one CommandArtifact preparation. */
export class CandidateArtifactCollection
  extends Schema.Class<CandidateArtifactCollection>("CandidateArtifactCollection")({
    ...candidateCollectionFields
  }) {}

export class CandidateCollectionPreparation
  extends Schema.Class<CandidateCollectionPreparation>("CandidateCollectionPreparation")({
    kind: Schema.Literal("artifact"), ...preparationBase,
    collection: CandidateArtifactCollection
  }) {}

export const CandidatePreparation = Schema.Union([
  CandidateCheckPreparation, CandidateArtifactPreparation, CandidateCollectionPreparation
])

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

const environmentName = Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
  /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)
    ? undefined
    : "Credential references must be portable environment variable names."))

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

export const NpmTrustedPublisherWorkflowRef = Schema.NonEmptyString.check(Schema.makeFilter(
  (value: string) => {
    if (/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(value)) return undefined
    if (!/^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(value) ||
      value.endsWith("/") || value.endsWith(".") || value.endsWith(".lock") ||
      value.includes("..") || value.includes("//") || value.includes("@{")) {
      return "npm trusted-publisher workflowRef must be an exact heads/tags ref or lowercase 40/64-hex commit SHA."
    }
    return undefined
  }
))

/** Operator-attested npm package trust relationship for one GitHub workflow. */
export class NpmTrustedPublisherAttestation
  extends Schema.Class<NpmTrustedPublisherAttestation>("NpmTrustedPublisherAttestation")({
    provider: Schema.Literal("github-actions"),
    runner: Schema.Literal("github-hosted"),
    repository: NpmTrustedPublisherRepository,
    workflow: NpmTrustedPublisherWorkflow,
    workflowRef: NpmTrustedPublisherWorkflowRef,
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
  provenance: NpmProvenancePolicy
}) {}

/** One exact already-packed npm tarball. Collection position is release order. */
export class CandidatePrepackedNpmPublication
  extends Schema.Class<CandidatePrepackedNpmPublication>("CandidatePrepackedNpmPublication")({
    id: NonEmptyName,
    path: SafeRelativePath.check(Schema.makeFilter((value: string) => {
      const segments = value.split("/")
      return value.endsWith(".tgz") && !value.includes("\\") && !value.includes("//") &&
          segments.every((segment) => segment.length > 0 && segment !== ".")
        ? undefined
        : "Prepacked npm path must name one normalized relative .tgz file."
    })),
    packageName: Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
      value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(value)
        ? undefined
        : "Prepacked npm packageName must be one canonical lowercase npm package name.")),
    version: Version,
    sha256: Sha256Hex,
    registry: CanonicalNpmRegistryEndpoint,
    distTag: NpmDistTag,
    access: NpmAccess,
    authentication: NpmAuthentication,
    provenance: NpmProvenancePolicy
  }) {}

/** Closed PyPI destination set with standards-defined Simple and upload APIs. */
export class PyPiTokenAuthentication
  extends Schema.Class<PyPiTokenAuthentication>("PyPiTokenAuthentication")({
    strategy: Schema.Literal("token"),
    credential: CredentialRef.check(Schema.makeFilter((value: string) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)
        ? undefined
        : "PyPI token credential must be a portable environment variable name.")),
    /** PyPI project-scoped tokens are the only token authority admitted here. */
    scope: Schema.Literal("project")
  }) {}

/**
 * Durable description of the supported external Trusted Publisher owner.
 * ts-release observes these publications but never exchanges OIDC assertions
 * or dispatches their upload itself.
 */
export class PyPiExternalTrustedPublishingAuthentication
  extends Schema.Class<PyPiExternalTrustedPublishingAuthentication>("PyPiExternalTrustedPublishingAuthentication")({
    strategy: Schema.Literal("trusted-publishing"),
    owner: Schema.Literal("external"),
    action: Schema.Literal("pypa/gh-action-pypi-publish@release/v1"),
    repository: NpmTrustedPublisherRepository,
    workflow: NpmTrustedPublisherWorkflow,
    workflowRef: NpmTrustedPublisherWorkflowRef,
    environment: nonempty,
    /** Complete bundled authority set for the configured publisher identity. */
    projects: Schema.NonEmptyArray(nonempty)
  }) {}

export const PyPiAuthentication = Schema.Union([
  PyPiTokenAuthentication,
  PyPiExternalTrustedPublishingAuthentication
])
export type PyPiAuthentication = typeof PyPiAuthentication.Type

/** Fully resolved prebuilt-distribution publication intent. */
export class CandidatePyPiPublish extends Schema.Class<CandidatePyPiPublish>("CandidatePyPiPublish")({
  artifacts: Schema.NonEmptyArray(OutputId),
  project: PyPiProjectName,
  version: Version,
  repository: PyPiRepository,
  authentication: PyPiAuthentication
}) {}

export class CandidateCatalogSource extends Schema.Class<CandidateCatalogSource>("CandidateCatalogSource")({
  artifact: OutputId,
  architecture: CatalogArchitecture
}) {}

const catalogRendererFields = {
  id: NonEmptyName,
  description: nonempty,
  homepage: nonempty,
  license: optional(nonempty),
  sources: Schema.NonEmptyArray(CandidateCatalogSource)
}

export class CandidateHomebrewCatalog extends Schema.Class<CandidateHomebrewCatalog>("CandidateHomebrewCatalog")({
  ...catalogRendererFields,
  formulaName: NonEmptyName,
  installPath: NonEmptyName
}) {}

export class CandidateScoopCatalog extends Schema.Class<CandidateScoopCatalog>("CandidateScoopCatalog")({
  ...catalogRendererFields,
  manifestName: NonEmptyName,
  bin: NonEmptyName
}) {}

export class CandidateCatalogs extends Schema.Class<CandidateCatalogs>("CandidateCatalogs")({
  homebrew: optional(Schema.NonEmptyArray(CandidateHomebrewCatalog)),
  scoop: optional(Schema.NonEmptyArray(CandidateScoopCatalog))
}) {}

export class CandidateCatalogGitDestination
  extends Schema.Class<CandidateCatalogGitDestination>("CandidateCatalogGitDestination")({
    catalog: NonEmptyName,
    repository: GitHubRepositoryCoordinate,
    branch: GitBranchName,
    targetPath: CatalogRepositoryPath,
    statePath: CatalogRepositoryPath,
    tokenEnv: environmentName
  }) {}

export class CandidateGitHubPublish extends Schema.Class<CandidateGitHubPublish>("CandidateGitHubPublish")({
  repository: optional(nonempty),
  tokenEnv: optional(environmentName),
  draft: optional(Schema.Boolean),
  prerelease: optional(Schema.Union([Schema.Boolean, Schema.Literal("auto")])),
  body: optional(Schema.String),
  bodyArtifact: optional(OutputId),
  ids: optional(Schema.Array(OutputId)),
  collections: optional(Schema.NonEmptyArray(ArtifactCollectionSelector))
}) {}

export class CandidatePublish extends Schema.Class<CandidatePublish>("CandidatePublish")({
  npm: optional(CandidateNpmPublish),
  prepackedNpm: optional(Schema.NonEmptyArray(CandidatePrepackedNpmPublication)),
  pypi: optional(CandidatePyPiPublish),
  catalogGit: optional(Schema.NonEmptyArray(CandidateCatalogGitDestination)),
  github: optional(CandidateGitHubPublish)
}) {}

/** Closed package build performed in private verified staging before npm pack. */
export class CandidateNpmPackageBuild
  extends Schema.Class<CandidateNpmPackageBuild>("CandidateNpmPackageBuild")({
    run: Schema.NonEmptyArray(Schema.NonEmptyString),
    outputRoots: Schema.NonEmptyArray(SafeRelativePath)
  }) {}

export class CandidateNpmPackage
  extends Schema.Class<CandidateNpmPackage>("CandidateNpmPackage")({
    path: optional(SafeRelativePath),
    build: optional(CandidateNpmPackageBuild)
  }) {}

export class CandidateConfig extends Schema.Class<CandidateConfig>("CandidateConfig")({
  "$schema": optional(Schema.String),
  project: CandidateProject,
  builds: optional(Schema.NonEmptyArray(CandidateBuild)),
  preparations: optional(Schema.NonEmptyArray(CandidatePreparation)),
  npmPackage: optional(CandidateNpmPackage),
  artifacts: optional(Schema.NonEmptyArray(CandidateArtifact)),
  archives: optional(Schema.NonEmptyArray(CandidateArchive)),
  checksum: optional(CandidateChecksum),
  catalogs: optional(CandidateCatalogs),
  publish: optional(CandidatePublish)
}) {}
