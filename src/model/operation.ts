import * as Schema from "effect/Schema"
import { CredentialName, OperationId, OutputId, ProfileId, SafeRelativePath } from "./primitives.js"

export class OutputDeclaration extends Schema.Class<OutputDeclaration>("OutputDeclaration")({
  id: OutputId, path: SafeRelativePath,
  kind: Schema.Literals([
    "file", "directory", "executable", "archive", "digest",
    "package", "wheel", "checksum-file", "catalog-file"
  ]),
  provenance: Schema.optionalKey(Schema.Literals(["build", "import", "process", "catalog", "internal"])),
  platform: Schema.optionalKey(Schema.Struct({
    os: Schema.Literals(["linux", "darwin", "windows"]), arch: Schema.Literals(["x64", "arm64"]),
    libc: Schema.optionalKey(Schema.Literals(["glibc", "musl"])),
    binaryName: Schema.optionalKey(Schema.NonEmptyString), targetTriple: Schema.optionalKey(Schema.NonEmptyString)
  }))
}) {}

const row = {
  id: OperationId, inputs: Schema.Array(OutputId), outputs: Schema.Array(OutputDeclaration),
  description: Schema.optionalKey(Schema.NonEmptyString)
}

export class ReadCredential extends Schema.Class<ReadCredential>("ReadCredential")({ name: CredentialName }) {}
export class PublishCredential
  extends Schema.Class<PublishCredential>("PublishCredential")({ name: CredentialName }) {}

export class WireContract extends Schema.Class<WireContract>("WireContract")({
  profileId: ProfileId, contractFixtureId: Schema.NonEmptyString,
  baseUrl: Schema.NonEmptyString, pathTemplate: Schema.NonEmptyString,
  responseShapeId: Schema.Literals(["json-object-v1", "empty-v1"]),
  pagination: Schema.Literals(["none", "link-header"]), commitment: Schema.Literals(["read-only", "status-2xx"]),
  reconciliation: Schema.Literals(["none", "get-same-resource"])
}) {}

export class ContentHole extends Schema.Class<ContentHole>("ContentHole")({
  fact: Schema.Literals(["sha256", "downloadUrl", "assetName"]), outputId: OutputId
}) {}
export const ContentValue = Schema.Union([Schema.String, Schema.Array(Schema.Union([Schema.String, ContentHole]))])
export type ContentValue = typeof ContentValue.Type

export class Check extends Schema.TaggedClass<Check>()("Check", { ...row, path: SafeRelativePath }) {}
export class Write extends Schema.TaggedClass<Write>()("Write", {
  ...row, path: SafeRelativePath, content: ContentValue
}) {}
export class Pack extends Schema.TaggedClass<Pack>()("Pack", {
  ...row, format: Schema.Literals(["tar.gz", "zip"])
}) {}
export class DigestOp extends Schema.TaggedClass<DigestOp>()("Digest", {
  ...row, algorithm: Schema.Literals(["sha256", "sha512"])
}) {}
export class Exec extends Schema.TaggedClass<Exec>()("Exec", {
  ...row, contractFixtureId: Schema.NonEmptyString, argv: Schema.NonEmptyArray(Schema.String),
  cwd: SafeRelativePath,
  environmentNames: Schema.Array(Schema.NonEmptyString)
}) {}
export class HttpRead extends Schema.TaggedClass<HttpRead>()("HttpRead", {
  ...row, method: Schema.Literals(["GET", "HEAD"]), wire: WireContract,
  credential: Schema.optionalKey(ReadCredential)
}) {}
export class HttpPublish extends Schema.TaggedClass<HttpPublish>()("HttpPublish", {
  ...row, method: Schema.Literals(["POST", "PUT", "PATCH", "DELETE"]), wire: WireContract,
  credential: PublishCredential
}) {}
export class ForgeRelease extends Schema.TaggedClass<ForgeRelease>()("ForgeRelease", {
  ...row, repository: Schema.NonEmptyString, tag: Schema.NonEmptyString,
  title: Schema.NonEmptyString, draft: Schema.Boolean, prerelease: Schema.Boolean,
  assets: Schema.Array(Schema.Struct({
    outputId: OutputId, path: SafeRelativePath, name: Schema.NonEmptyString,
    contentType: Schema.NonEmptyString
  })),
  credential: PublishCredential, readCredential: Schema.optionalKey(ReadCredential),
  contractFixtureId: Schema.NonEmptyString
}) {}
export class PackageRegistryRelease
  extends Schema.TaggedClass<PackageRegistryRelease>()("PackageRegistryRelease", {
    ...row, registryKind: Schema.Literals(["npm", "pypi"]), packageName: Schema.NonEmptyString,
    version: Schema.NonEmptyString, registryUrl: Schema.NonEmptyString, packagePath: SafeRelativePath,
    artifactPaths: Schema.Array(SafeRelativePath), clientExecutable: Schema.NonEmptyString,
    publishArgv: Schema.NonEmptyArray(Schema.String), probeUrl: Schema.NonEmptyString,
    trustedPublishing: Schema.Boolean,
    trustedProvider: Schema.optionalKey(Schema.Literal("github-actions")),
    trustedWorkflow: Schema.optionalKey(Schema.NonEmptyString),
    verifyPackageExists: Schema.Boolean, verifyPublished: Schema.Boolean,
    access: Schema.optionalKey(Schema.Literals(["public", "restricted"])),
    provenance: Schema.optionalKey(Schema.Boolean), environmentNames: Schema.Array(Schema.NonEmptyString),
    credential: PublishCredential, readCredential: Schema.optionalKey(ReadCredential),
    contractFixtureId: Schema.NonEmptyString
  })
{}
export class OpaquePublish extends Schema.TaggedClass<OpaquePublish>()("OpaquePublish", {
  ...row, argv: Schema.NonEmptyArray(Schema.String), cwd: SafeRelativePath,
  environmentNames: Schema.Array(Schema.NonEmptyString),
  credential: PublishCredential, contractFixtureId: Schema.NonEmptyString,
  reconciliation: Schema.Literal("manual-only"),
  irreversible: Schema.Boolean
}) {}

export const BuildOp = Schema.Union([Check, Write, Exec])
export type BuildOp = typeof BuildOp.Type
export const ProcessOp = Schema.Union([Check, Write, Pack, DigestOp, Exec])
export type ProcessOp = typeof ProcessOp.Type
export const CatalogOp = Schema.Union([Check, Write, Exec])
export type CatalogOp = typeof CatalogOp.Type
export const ValidateOp = Schema.Union([Check, Exec, HttpRead])
export type ValidateOp = typeof ValidateOp.Type
export const PublishOp = Schema.Union([Exec, HttpPublish, ForgeRelease, PackageRegistryRelease, OpaquePublish])
export type PublishOp = typeof PublishOp.Type
export const AnnounceOp = Schema.Union([HttpPublish])
export type AnnounceOp = typeof AnnounceOp.Type
export const VerifyOp = Schema.Union([Check, HttpRead])
export type VerifyOp = typeof VerifyOp.Type

export const Operation = Schema.Union([
  Check, Write, Pack, DigestOp, Exec, HttpRead,
  HttpPublish, ForgeRelease, PackageRegistryRelease, OpaquePublish
])
export type Operation = typeof Operation.Type
export const mechanismTags = [
  "Check", "Write", "Pack", "Digest", "Exec", "HttpRead",
  "HttpPublish", "ForgeRelease", "PackageRegistryRelease", "OpaquePublish"
] as const
export type Authority = "LocalRead" | "LocalWrite" | "LocalExec" | "RemoteRead" | "RemotePublish"

export const operationAuthority = (operation: Operation): Authority => {
  switch (operation._tag) {
    case "Check":
      return "LocalRead"
    case "Write":
    case "Pack":
    case "Digest":
      return "LocalWrite"
    case "Exec":
      return "LocalExec"
    case "HttpRead":
      return "RemoteRead"
    case "HttpPublish":
    case "ForgeRelease":
    case "PackageRegistryRelease":
    case "OpaquePublish":
      return "RemotePublish"
  }
}
