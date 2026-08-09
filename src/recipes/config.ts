import * as Schema from "effect/Schema"
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

const trusted = {
  provider: optional(Schema.Literal("github-actions")),
  workflow: optional(nonempty)
}

export class CandidateNpmPublish extends Schema.Class<CandidateNpmPublish>("CandidateNpmPublish")({
  registry: optional(Schema.String),
  packageName: optional(nonempty),
  packagePath: optional(SafeRelativePath),
  tokenEnv: optional(Schema.String),
  trustedPublishing: optional(Schema.Struct({
    ...trusted,
    verifyPackageExists: optional(Schema.Boolean)
  })),
  access: optional(Schema.Literals(["public", "restricted"])),
  provenance: optional(Schema.Boolean)
}) {}

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
  prerelease: optional(Schema.Union([Schema.Boolean, Schema.Literal("auto")]))
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
  npmPackage: optional(Schema.Struct({ path: optional(SafeRelativePath) })),
  artifacts: optional(Schema.Array(CandidateArtifact)),
  archives: optional(Schema.Array(CandidateArchive)),
  checksum: optional(CandidateChecksum),
  catalogs: optional(Schema.Array(CandidateCatalog)),
  publish: optional(CandidatePublish)
}) {}
