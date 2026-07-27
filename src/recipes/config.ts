import * as Schema from "effect/Schema"
import { NonEmptyName, OutputId, ProfileId, SafeRelativePath, Version } from "../model/primitives.js"
import { ProjectScope } from "./projects.js"
import { CandidateSelection } from "./selection.js"
import { CandidateEnvironment } from "./environment.js"
import { CandidateGitPolicy } from "./git-policy.js"
import { CandidateNightly } from "./nightly.js"

const optional = Schema.optionalKey
const nonempty = Schema.NonEmptyString
const target = Schema.Literals([
  "linux-x64", "linux-arm64", "linux-x64-musl", "linux-arm64-musl",
  "darwin-x64", "darwin-arm64", "windows-x64", "windows-arm64"
])
const command = Schema.Union([Schema.String, Schema.Array(Schema.String)])
const submit = Schema.Literals(["push", "pull-request"])
const risk = Schema.Literals(["writes-local", "externally-visible", "irreversible"])
const os = Schema.Literals(["linux", "darwin", "windows"])
const arch = Schema.Literals(["x64", "arm64"])

export class CandidateProject extends Schema.Class<CandidateProject>("CandidateProject")({
  name: NonEmptyName, packageName: optional(nonempty), version: Version,
  repository: optional(nonempty), packagePath: optional(SafeRelativePath),
  commit: optional(nonempty), tag: NonEmptyName, tagTemplate: optional(nonempty),
  notes: optional(Schema.String), description: optional(nonempty), summary: optional(nonempty),
  homepage: optional(nonempty), license: optional(nonempty)
}) {}
export class CandidatePlatform extends Schema.Class<CandidatePlatform>("CandidatePlatform")({
  os, arch, libc: optional(Schema.Literals(["glibc", "musl"])),
  binaryName: optional(nonempty), executableExtension: optional(nonempty),
  installPath: optional(nonempty), targetTriple: optional(nonempty) }) {}
export class CandidateArtifact extends Schema.Class<CandidateArtifact>("CandidateArtifact")({
  id: OutputId, path: SafeRelativePath,
  format: Schema.Literals(["tarball", "zip", "file", "directory", "oci-image", "executable", "binary"]),
  checksum: optional(Schema.Struct({
    algorithm: Schema.Literals(["sha256", "sha512"]), value: Schema.String })),
  variant: optional(CandidatePlatform)
}) {}

const checksumName = SafeRelativePath.check(Schema.makeFilter((value: string) => {
  const literal = value.replaceAll("{version}", "").replaceAll("{name}", "")
  return literal.includes("{") || literal.includes("}")
    ? "Checksum name supports only the {name} and {version} tokens."
    : undefined
}))
export class CandidateChecksum extends Schema.Class<CandidateChecksum>("CandidateChecksum")({
  algorithm: optional(Schema.Literals(["sha256", "sha512"])), nameTemplate: optional(checksumName)
}) {}

const build = { id: optional(Schema.String), targets: Schema.Array(target),
  output: optional(SafeRelativePath), binary: optional(Schema.String) }
export class CandidateBunBuild extends Schema.Class<CandidateBunBuild>("CandidateBunBuild")({
  ...build, builder: Schema.Literal("bun"), entry: SafeRelativePath,
  binaryName: optional(Schema.String), installPath: optional(Schema.String),
  cpu: optional(Schema.Literals(["baseline", "modern"])), minify: optional(Schema.Boolean)
}) {}
export class CandidateCommandBuild extends Schema.Class<CandidateCommandBuild>("CandidateCommandBuild")({
  ...build, builder: Schema.Literal("command"), output: SafeRelativePath, run: command }) {}
export class CandidatePrebuiltBuild extends Schema.Class<CandidatePrebuiltBuild>("CandidatePrebuiltBuild")({
  ...build, builder: Schema.Literal("prebuilt"), output: SafeRelativePath }) {}
export class CandidateProfileOutput
  extends Schema.Class<CandidateProfileOutput>("CandidateProfileOutput")({ id: OutputId, path: SafeRelativePath }) {}
export class CandidateProfileBuild extends Schema.Class<CandidateProfileBuild>("CandidateProfileBuild")({
  builder: Schema.Literal("profile"), id: nonempty, profileId: ProfileId,
  inputs: Schema.Array(OutputId), outputs: Schema.NonEmptyArray(CandidateProfileOutput),
  options: Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Number, Schema.Boolean]))
}) {}
export const CandidateBuild = Schema.Union(
  [CandidateBunBuild, CandidateCommandBuild, CandidatePrebuiltBuild, CandidateProfileBuild])

export class CandidateWheelBinary extends Schema.Class<CandidateWheelBinary>("CandidateWheelBinary")({
  os, arch, sourcePath: SafeRelativePath, wheelPath: Schema.String }) {}
export class CandidateWheel extends Schema.Class<CandidateWheel>("CandidateWheel")({
  id: OutputId, path: SafeRelativePath, wheelTag: Schema.String, binaries: Schema.Array(CandidateWheelBinary)
}) {}
export class CandidateWheelBuild extends Schema.Class<CandidateWheelBuild>("CandidateWheelBuild")({
  packageName: Schema.String, moduleName: Schema.String, consoleScript: Schema.String,
  requiresPython: Schema.String, wheels: Schema.NonEmptyArray(CandidateWheel) }) {}
const format = Schema.Literals(["tar.gz", "zip"])
export class CandidateArchive extends Schema.Class<CandidateArchive>("CandidateArchive")({
  id: optional(nonempty), ids: optional(Schema.Array(nonempty)), nameTemplate: optional(nonempty),
  formats: optional(Schema.Array(format)), formatOverrides: optional(Schema.Struct({
    linux: optional(Schema.Array(format)), darwin: optional(Schema.Array(format)),
    windows: optional(Schema.Array(format)) })),
  files: optional(Schema.Array(nonempty)), wrapInDirectory: optional(Schema.Union([Schema.Boolean, Schema.String]))
}) {}

export class CandidateContentHole extends Schema.Class<CandidateContentHole>("CandidateContentHole")({
  fact: Schema.Literals(["sha256", "downloadUrl", "assetName"]), artifact: OutputId }) {}
export class CandidateCatalog extends Schema.Class<CandidateCatalog>("CandidateCatalog")({
  id: nonempty, repository: Schema.String, file: SafeRelativePath,
  directory: optional(SafeRelativePath), content: Schema.Union([
    Schema.String, Schema.Array(Schema.Union([Schema.String, CandidateContentHole]))
  ]),
  commitMessage: optional(Schema.String), submit: optional(submit), validate: optional(command) }) {}

const hook = { id: nonempty, run: Schema.NonEmptyArray(nonempty),
  cwd: optional(SafeRelativePath), env: optional(Schema.Array(nonempty)) }
export class CandidateBeforeHook extends Schema.Class<CandidateBeforeHook>("CandidateBeforeHook")(hook) {}
export class CandidateRiskHook extends Schema.Class<CandidateRiskHook>("CandidateRiskHook")({
  ...hook, risk: optional(risk), ids: optional(Schema.NonEmptyArray(OutputId)) }) {}
export class CandidateBeforePublish extends Schema.Class<CandidateBeforePublish>("CandidateBeforePublish")({
  kind: Schema.Literals(["check", "transform"]), run: Schema.NonEmptyArray(nonempty)
}) {}
export class CandidateHooks extends Schema.Class<CandidateHooks>("CandidateHooks")({
  before: optional(Schema.Array(CandidateBeforeHook)), after: optional(Schema.Array(CandidateRiskHook)),
  beforePublish: optional(Schema.Array(CandidateBeforePublish)) }) {}

const trusted = { provider: optional(Schema.Literal("github-actions")), workflow: optional(nonempty) }
export class CandidateNpmPublish extends Schema.Class<CandidateNpmPublish>("CandidateNpmPublish")({
  registry: optional(Schema.String), packageName: optional(nonempty),
  packagePath: optional(SafeRelativePath), tokenEnv: optional(Schema.String),
  trustedPublishing: optional(Schema.Struct({ ...trusted, verifyPackageExists: optional(Schema.Boolean) })),
  access: optional(Schema.Literals(["public", "restricted"])), provenance: optional(Schema.Boolean)
}) {}
export class CandidatePyPiPublish extends Schema.Class<CandidatePyPiPublish>("CandidatePyPiPublish")({
  repositoryUrl: optional(Schema.String), pythonExecutable: optional(Schema.String),
  trustedPublishing: optional(Schema.Struct({ ...trusted, publisherConfigured: optional(Schema.Literal(true)) })),
  ids: optional(Schema.NonEmptyArray(OutputId))
}) {}
export class CandidateGitHubPublish
  extends Schema.Class<CandidateGitHubPublish>("CandidateGitHubPublish")({
    repository: optional(Schema.String), tokenEnv: optional(Schema.String),
    draft: optional(Schema.Boolean), prerelease: optional(Schema.Union([Schema.Boolean, Schema.Literal("auto")])) })
{}
const preset = { repository: Schema.String, ids: optional(Schema.NonEmptyArray(OutputId)),
  url: optional(Schema.String), submit: optional(submit), validate: optional(command) }
export class CandidateHomebrew extends Schema.Class<CandidateHomebrew>("CandidateHomebrew")({
  ...preset, formulaName: optional(Schema.String), formulaPath: optional(SafeRelativePath),
  tapDirectory: optional(SafeRelativePath), installPath: optional(Schema.String) }) {}
export class CandidateScoop extends Schema.Class<CandidateScoop>("CandidateScoop")({
  ...preset, manifestName: optional(Schema.String), manifestPath: optional(SafeRelativePath),
  bucketDirectory: optional(SafeRelativePath), bin: optional(Schema.String) }) {}
export class CandidatePackageStore
  extends Schema.Class<CandidatePackageStore>("CandidatePackageStore")({
    profileId: Schema.Literals(["package.store-snap.v1", "package.store-chocolatey.v1"]),
    input: OutputId, target: Schema.Struct({
      name: nonempty, channel: optional(nonempty), version: optional(nonempty)
    })
  })
{}
export class CandidateSupplyOutput
  extends Schema.Class<CandidateSupplyOutput>("CandidateSupplyOutput")({
    id: OutputId, path: SafeRelativePath
  }) {}
const supply = {
  id: nonempty, inputs: Schema.NonEmptyArray(OutputId),
  outputs: Schema.NonEmptyArray(CandidateSupplyOutput)
}
export class CandidateSupplyProfile
  extends Schema.Class<CandidateSupplyProfile>("CandidateSupplyProfile")({
    ...supply, kind: Schema.Literal("profile"), profileId: ProfileId,
    target: Schema.Record(Schema.String, nonempty)
  }) {}
export class CandidateSupplyMeasure
  extends Schema.Class<CandidateSupplyMeasure>("CandidateSupplyMeasure")({
    ...supply, kind: Schema.Literal("measure-size")
  }) {}
export const CandidateSupplyAction = Schema.Union([CandidateSupplyProfile, CandidateSupplyMeasure])
const providerId = Schema.Literals(["forge.gitlab-release/v1","forge.gitea-release/v1","forge.gitlab-catalog-pr/v1",
  "forge.gitea-catalog-pr/v1", "forge.milestone-close/v1", "object.s3-put/v1", "object.gcs-put/v1",
  "object.azure-blob-put/v1", "repository.artifactory-upload/v1", "repository.cloudsmith-upload/v1",
  "repository.gemfury-upload/v1", "registry.dockerhub-description/v1", "registry.npm-publish/v1"])
const scope = Schema.Literals(["PublicOnly", "PrivateNetwork"]), checkbox = Schema.Literals(["preserve", "check"])
const providerOptions = Schema.Struct({ baseUrl: optional(nonempty), dnsScope: optional(scope),
  contentType: optional(nonempty), draft: optional(Schema.Boolean), prerelease: optional(Schema.Boolean),
  title: optional(nonempty), checkboxPolicy: optional(checkbox),
  summary: optional(nonempty), description: optional(nonempty), wrapper: optional(Schema.Literal(true)),
  access: optional(Schema.Literals(["public", "restricted"])), provenance: optional(Schema.Boolean) })
const CandidateNamedProvider = Schema.Struct({ id: nonempty, profileId: providerId, ids: Schema.Array(OutputId),
  destination: Schema.Record(Schema.String, nonempty), credential: nonempty, options: providerOptions })
const CandidateGenericProvider = Schema.Struct({
  id: nonempty, profileId: Schema.Literal("http.generic-upload/v1"), ids: Schema.NonEmptyArray(OutputId),
  endpoint: nonempty, method: Schema.Literals(["PATCH", "POST", "PUT"]), headerNames: Schema.Array(nonempty),
  bodyMapping: Schema.Literal("raw-artifact"), credential: nonempty, dnsScope: scope })
export const CandidateProvider = Schema.Union([CandidateNamedProvider, CandidateGenericProvider, Schema.Struct({
  id: nonempty, profileId: Schema.Literal("policy.catalog-checkbox/v1"), ids: Schema.Array(OutputId),
  destination: Schema.Struct({ file: SafeRelativePath }), options: Schema.Struct({ checkboxPolicy: checkbox }) })])
export class CandidatePublish extends Schema.Class<CandidatePublish>("CandidatePublish")({
  npm: optional(CandidateNpmPublish), github: optional(CandidateGitHubPublish),
  homebrew: optional(CandidateHomebrew), scoop: optional(CandidateScoop),
  pypi: optional(CandidatePyPiPublish), custom: optional(Schema.Array(CandidateRiskHook)),
  packageStores: optional(Schema.Array(CandidatePackageStore)), providers: optional(Schema.Array(CandidateProvider)),
  selection: optional(CandidateSelection), nightly: optional(CandidateNightly) }) {}

export class CandidateConfig extends Schema.Class<CandidateConfig>("CandidateConfig")({
  "$schema": optional(Schema.String), project: CandidateProject,
  environment: optional(CandidateEnvironment),
  git: optional(CandidateGitPolicy),
  projects: optional(Schema.NonEmptyArray(ProjectScope)),
  versionFrom: optional(Schema.Literals(["manifest", "git-tag"])),
  builds: optional(Schema.Array(CandidateBuild)), npmPackage: optional(Schema.Struct({
    path: optional(SafeRelativePath) })),
  pypiWheel: optional(CandidateWheelBuild), artifacts: optional(Schema.Array(CandidateArtifact)),
  archives: optional(Schema.Array(CandidateArchive)), checksum: optional(CandidateChecksum),
  catalogs: optional(Schema.Array(CandidateCatalog)), hooks: optional(CandidateHooks),
  supplyChain: optional(Schema.Array(CandidateSupplyAction)),
  publish: CandidatePublish, retry: optional(Schema.Struct({
    attempts: Schema.Number, delayMillis: Schema.Number })),
  evidence: optional(Schema.Union([SafeRelativePath, Schema.Struct({ directory: SafeRelativePath })]))
}) {}
