import { makeGithubSubjects } from "../publication/github.js"
import { makeNpmSubject } from "../publication/npm.js"
import { installedPublicationProfiles } from "../publication/profiles.js"
import {
  contributeGitHubPublication,
  contributeNpmPublication,
  contributePackages,
  contributeSourceArtifacts
} from "../release/capabilities.js"
import { resolveConfig } from "../resolve/resolve.js"
import type {
  CapabilityModule,
  GitHubPublicationCapability,
  NpmPublicationCapability,
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

/**
 * The only installed capability registry. There are no support booleans and
 * no symbol-path strings: deleting a module value deletes support.
 */
export const capabilityModules = Object.freeze([
  releaseIdentityCapability,
  sourcePreparationCapability,
  packagePreparationCapability,
  npmPublicationCapability,
  githubPublicationCapability
] as const satisfies ReadonlyArray<CapabilityModule>)

export const preparationCapabilities = Object.freeze([
  sourcePreparationCapability,
  packagePreparationCapability
] as const satisfies ReadonlyArray<PreparationCapability>)

export const publicationCapabilities = Object.freeze([
  npmPublicationCapability,
  githubPublicationCapability
] as const)

export const capabilityIds = Object.freeze(capabilityModules.map((module) => module.id))
