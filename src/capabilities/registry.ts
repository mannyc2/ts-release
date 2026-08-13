import { makeGithubSubjects } from "../publication/github.js"
import { makeNpmSubject } from "../publication/npm.js"
import { makePyPiSubjects } from "../publication/pypi.js"
import { makeCatalogPublicationSubject } from "../publication/catalog-git.js"
import { installedPublicationProfiles } from "../publication/profiles.js"
import {
  contributeGitHubPublication,
  contributeNpmPublication,
  contributePyPiPublication,
  contributeCatalogPublications,
  contributeCatalogRendering,
  contributePackages,
  contributeSourceArtifacts
} from "../release/capabilities.js"
import { resolveConfig } from "../resolve/resolve.js"
import type {
  CapabilityModule,
  CatalogPublicationCapability,
  GitHubPublicationCapability,
  NpmPublicationCapability,
  PyPiPublicationCapability,
  OwnedConfigField,
  PreparationCapability,
  ResolutionCapability
} from "./module.js"
import { bunArtifactTargetIds } from "./bun-targets.js"

const graphFields = (paths: ReadonlyArray<string>): ReadonlyArray<OwnedConfigField> =>
  paths.map((path) => ({ path, effect: "graph" as const }))

const resolvedFields = (paths: ReadonlyArray<string>): ReadonlyArray<OwnedConfigField> =>
  paths.map((path) => ({ path, effect: "resolved-intent" as const }))

// Linux is the only execution host with a clean candidate run. Cross-compiled
// Mach-O artifacts certify targets, not a macOS execution host.
const hosts = ["linux"] as const
export const releaseIdentityCapability = Object.freeze({
  _tag: "ResolutionCapability",
  id: "release.identity",
  fields: resolvedFields([
    "project", "project.name", "project.packageName",
    "project.repository", "project.tag", "project.tagTemplate", "project.version",
    "publish", "versionFrom"
  ]),
  requirements: {
    executionHosts: hosts,
    nativeTools: ["git"],
    artifactTargets: [],
    credentialStrategies: []
  },
  certification: {
    boundary: "root-api",
    tests: ["test/api-plan224-authority.test.ts", "test/core/release-context.test.ts"]
  },
  resolve: resolveConfig
} satisfies ResolutionCapability)

export const sourcePreparationCapability = Object.freeze({
  _tag: "PreparationCapability",
  id: "prepare.source",
  phase: "source",
  fields: graphFields([
    "artifacts", "artifacts[].format", "artifacts[].id", "artifacts[].path",
    "builds", "builds[].binary", "builds[].builder", "builds[].entry",
    "builds[].id", "builds[].minify", "builds[].output", "builds[].run",
    "builds[].targets", "npmPackage", "npmPackage.build", "npmPackage.build.outputRoots",
    "npmPackage.build.run", "npmPackage.path", "preparations",
    "preparations[].cwd", "preparations[].id", "preparations[].inputs",
    "preparations[].kind", "preparations[].outputs",
    "preparations[].collection", "preparations[].collection.artifactKind",
    "preparations[].collection.cardinality", "preparations[].collection.cardinality.kind",
    "preparations[].collection.cardinality.maximum", "preparations[].collection.cardinality.minimum",
    "preparations[].collection.mediaType", "preparations[].collection.pathSuffix",
    "preparations[].collection.root",
    "preparations[].outputs[].id", "preparations[].outputs[].kind",
    "preparations[].outputs[].mediaType", "preparations[].outputs[].path",
    "preparations[].run"
  ]),
  requirements: {
    executionHosts: hosts,
    nativeTools: ["bun", "libseccomp.so.2", "declared-command"],
    artifactTargets: bunArtifactTargetIds,
    credentialStrategies: []
  },
  certification: {
    boundary: "root-api",
    tests: [
      "test/core/artifact-collection.test.ts",
      "test/core/release-graph.test.ts",
      "test/core/preparation.test.ts"
    ]
  },
  contribute: ({ config, context }) => contributeSourceArtifacts(config, context)
} satisfies PreparationCapability)

export const packagePreparationCapability = Object.freeze({
  _tag: "PreparationCapability",
  id: "prepare.package",
  phase: "package",
  fields: graphFields([
    "archives", "archives[].formats", "archives[].id", "archives[].ids",
    "archives[].nameTemplate", "checksum", "checksum.algorithm"
  ]),
  requirements: {
    executionHosts: hosts,
    nativeTools: [],
    artifactTargets: [],
    credentialStrategies: []
  },
  certification: {
    boundary: "root-api",
    tests: ["test/core/prepared-release.test.ts", "test/core/preparation.test.ts"]
  },
  contribute: ({ config, availableArtifacts, context }) =>
    contributePackages(config, availableArtifacts, context)
} satisfies PreparationCapability)

export const homebrewRenderCapability = Object.freeze({
  _tag: "PreparationCapability",
  id: "render.homebrew",
  phase: "render",
  fields: graphFields([
    "catalogs", "catalogs.homebrew", "catalogs.homebrew[].description",
    "catalogs.homebrew[].formulaName", "catalogs.homebrew[].homepage",
    "catalogs.homebrew[].id", "catalogs.homebrew[].installPath",
    "catalogs.homebrew[].license", "catalogs.homebrew[].sources",
    "catalogs.homebrew[].sources[].architecture", "catalogs.homebrew[].sources[].artifact"
  ]),
  requirements: {
    executionHosts: hosts,
    nativeTools: [],
    artifactTargets: [],
    credentialStrategies: []
  },
  certification: {
    boundary: "root-api",
    tests: ["test/core/catalog-rendering.test.ts"]
  },
  contribute: ({ config, availableArtifacts }) =>
    contributeCatalogRendering(config, availableArtifacts, "homebrew")
} satisfies PreparationCapability)

export const scoopRenderCapability = Object.freeze({
  _tag: "PreparationCapability",
  id: "render.scoop",
  phase: "render",
  fields: graphFields([
    "catalogs.scoop", "catalogs.scoop[].bin", "catalogs.scoop[].description",
    "catalogs.scoop[].homepage", "catalogs.scoop[].id", "catalogs.scoop[].license",
    "catalogs.scoop[].manifestName", "catalogs.scoop[].sources",
    "catalogs.scoop[].sources[].architecture", "catalogs.scoop[].sources[].artifact"
  ]),
  requirements: {
    executionHosts: hosts,
    nativeTools: [],
    artifactTargets: [],
    credentialStrategies: []
  },
  certification: {
    boundary: "root-api",
    tests: ["test/core/catalog-rendering.test.ts"]
  },
  contribute: ({ config, availableArtifacts }) =>
    contributeCatalogRendering(config, availableArtifacts, "scoop")
} satisfies PreparationCapability)

export const npmPublicationCapability = Object.freeze({
  _tag: "PublicationCapability",
  id: "publish.npm",
  preparedTag: "PreparedNpmPublication",
  profile: installedPublicationProfiles.npm,
  fields: [
    ...resolvedFields([
      "publish.npm", "publish.npm.access", "publish.npm.authentication",
      "publish.npm.authentication.attestation",
      "publish.npm.authentication.attestation.allowedAction",
      "publish.npm.authentication.attestation.provider",
      "publish.npm.authentication.attestation.repository",
      "publish.npm.authentication.attestation.runner",
      "publish.npm.authentication.attestation.workflow",
      "publish.npm.authentication.attestation.workflowRef",
      "publish.npm.authentication.credential",
      "publish.npm.authentication.strategy", "publish.npm.distTag",
      "publish.npm.provenance", "publish.npm.registry"
    ])
  ],
  requirements: {
    executionHosts: hosts,
    nativeTools: ["npm"],
    artifactTargets: [],
    credentialStrategies: ["token", "trusted-publishing"]
  },
  certification: {
    boundary: "provider-protocol",
    tests: [
      "test/api-plan224-authority.test.ts",
      "test/protocol/npm/npm-provider-protocol.test.ts"
    ]
  },
  contribute: ({ config, context }) => contributeNpmPublication(config, context),
  subjects: (bundle, publication, services) => [
    makeNpmSubject(bundle, publication, services.http, services.userConfigs, services.publisher)
  ] as const
} satisfies NpmPublicationCapability)

export const githubPublicationCapability = Object.freeze({
  _tag: "PublicationCapability",
  id: "publish.github",
  preparedTag: "PreparedGitHubPublication",
  profile: installedPublicationProfiles.github,
  fields: graphFields([
    "publish.github", "publish.github.body", "publish.github.bodyArtifact",
    "publish.github.collections", "publish.github.collections[].cardinality",
    "publish.github.collections[].cardinality.kind", "publish.github.collections[].cardinality.maximum",
    "publish.github.collections[].cardinality.minimum", "publish.github.collections[].artifactKind",
    "publish.github.collections[].collection", "publish.github.collections[].mediaType",
    "publish.github.collections[].pathSuffix",
    "publish.github.draft", "publish.github.ids", "publish.github.prerelease",
    "publish.github.repository", "publish.github.tokenEnv"
  ]),
  requirements: {
    executionHosts: hosts,
    nativeTools: [],
    artifactTargets: [],
    credentialStrategies: ["token"]
  },
  certification: {
    boundary: "provider-protocol",
    tests: [
      "test/api-plan224-authority.test.ts",
      "test/core/artifact-collection.test.ts",
      "test/protocol/github/github-protocol.test.ts"
    ]
  },
  contribute: ({ config, availableArtifacts }) =>
    contributeGitHubPublication(config, availableArtifacts),
  subjects: (bundle, publication, services) =>
    makeGithubSubjects(bundle, publication, services.http, services.mutationHttp)
} satisfies GitHubPublicationCapability)

export const pyPiPublicationCapability = Object.freeze({
  _tag: "PublicationCapability",
  id: "publish.pypi",
  preparedTag: "PreparedPyPiPublication",
  profile: installedPublicationProfiles.pypi,
  fields: [
    ...resolvedFields([
      "publish.pypi", "publish.pypi.artifacts", "publish.pypi.authentication",
      "publish.pypi.authentication.action", "publish.pypi.authentication.credential",
      "publish.pypi.authentication.environment", "publish.pypi.authentication.owner",
      "publish.pypi.authentication.projects", "publish.pypi.authentication.repository",
      "publish.pypi.authentication.scope", "publish.pypi.authentication.strategy",
      "publish.pypi.authentication.workflow", "publish.pypi.authentication.workflowRef",
      "publish.pypi.repository"
    ])
  ],
  requirements: {
    executionHosts: hosts,
    nativeTools: [],
    artifactTargets: [],
    credentialStrategies: ["project-token", "external-pypa-action"]
  },
  certification: {
    boundary: "provider-protocol",
    tests: [
      "test/core/pypi-preparation.test.ts",
      "test/protocol/pypi/pypi-provider-protocol.test.ts"
    ]
  },
  contribute: ({ config, context, availableArtifacts }) =>
    contributePyPiPublication(config, context, availableArtifacts),
  subjects: (bundle, publication, services) =>
    makePyPiSubjects(bundle, publication, services.http, services.mutationHttp, services.claims)
} satisfies PyPiPublicationCapability)

export const catalogPublicationCapability = Object.freeze({
  _tag: "PublicationCapability",
  id: "publish.catalog-git",
  preparedTag: "PreparedCatalogPublication",
  profile: installedPublicationProfiles.catalogGit,
  fields: graphFields([
    "publish.catalogGit", "publish.catalogGit[].branch", "publish.catalogGit[].catalog",
    "publish.catalogGit[].repository", "publish.catalogGit[].statePath",
    "publish.catalogGit[].targetPath", "publish.catalogGit[].tokenEnv"
  ]),
  requirements: {
    executionHosts: hosts,
    nativeTools: [],
    artifactTargets: [],
    credentialStrategies: ["token"]
  },
  certification: {
    boundary: "provider-protocol",
    tests: ["test/core/catalog-rendering.test.ts", "test/protocol/catalog/catalog-git-protocol.test.ts"]
  },
  contribute: ({ config, availableArtifacts }) =>
    contributeCatalogPublications(config, availableArtifacts),
  subjects: (bundle, publication, services) => [
    makeCatalogPublicationSubject(bundle, publication, services.http, services.mutationHttp)
  ] as const
} satisfies CatalogPublicationCapability)

/**
 * The only installed capability registry. There are no support booleans and
 * no symbol-path strings: deleting a module value deletes support.
 */
export const capabilityModules = Object.freeze([
  releaseIdentityCapability,
  sourcePreparationCapability,
  packagePreparationCapability,
  homebrewRenderCapability,
  scoopRenderCapability,
  npmPublicationCapability,
  pyPiPublicationCapability,
  githubPublicationCapability,
  catalogPublicationCapability
] as const satisfies ReadonlyArray<CapabilityModule>)

export const preparationCapabilities = Object.freeze([
  sourcePreparationCapability,
  packagePreparationCapability,
  homebrewRenderCapability,
  scoopRenderCapability
] as const satisfies ReadonlyArray<PreparationCapability>)

export const publicationCapabilities = Object.freeze([
  npmPublicationCapability,
  pyPiPublicationCapability,
  githubPublicationCapability,
  catalogPublicationCapability
] as const)

export const capabilityIds = Object.freeze(capabilityModules.map((module) => module.id))
