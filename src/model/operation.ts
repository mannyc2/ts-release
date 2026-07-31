import * as Schema from "effect/Schema"
import { CheckpointId, CredentialName, OperationId, OutputId, ProfileId, SafeRelativePath } from "./primitives.js"

export class OutputDeclaration extends Schema.Class<OutputDeclaration>("OutputDeclaration")({
  id: OutputId, path: SafeRelativePath,
  kind: Schema.Literals([
    "file", "directory", "executable", "archive", "digest",
    "package", "wheel", "checksum-file", "catalog-file",
    "container-metadata", "sbom", "signature", "notarized", "attestation"
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
export class ReviewedNoteTransform extends Schema.TaggedClass<ReviewedNoteTransform>()("ReviewedNoteTransform", {
  ...row, profileId: Schema.Literal("changelog.reviewed-transform/v1"),
  policyDigest: Schema.NonEmptyString, maximumOutputBytes: Schema.Number,
  credential: ReadCredential, contractFixtureId: Schema.Literal("contract.changelog.reviewed-transform/v1")
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
export class PackageStoreTarget extends Schema.Class<PackageStoreTarget>("PackageStoreTarget")({
  name: Schema.NonEmptyString, channel: Schema.optionalKey(Schema.NonEmptyString),
  version: Schema.optionalKey(Schema.NonEmptyString)
}) {}
export class PackageStorePublish
  extends Schema.TaggedClass<PackageStorePublish>()("PackageStorePublish", {
    ...row,
    profileId: Schema.Literals(["package.store-snap.v1", "package.store-chocolatey.v1"]),
    target: PackageStoreTarget, credential: PublishCredential,
    contractFixtureId: Schema.NonEmptyString
  })
{}
export const SupplyChainVariant = Schema.Literals([
  "RegistryImage", "RegistryManifest", "RegistrySignature",
  "CredentialedArtifactSignature", "AppleNotarization", "RemoteAttestation"
])
export class SupplyChainPublish
  extends Schema.TaggedClass<SupplyChainPublish>()("SupplyChainPublish", {
    ...row, variant: SupplyChainVariant, profileId: ProfileId,
    target: Schema.Record(Schema.String, Schema.NonEmptyString),
    credential: PublishCredential, contractFixtureId: Schema.NonEmptyString
  })
{}
const ProviderVariant = Schema.Literals(["ForgeRelease", "ForgeCatalogPullRequest", "MilestoneClose",
  "ObjectStorePublish", "GenericHttp", "RepositoryPublish", "RegistryMetadata"])
export class ProviderPublish extends Schema.TaggedClass<ProviderPublish>()("ProviderPublish", {
  ...row, profileId: ProfileId, variant: ProviderVariant,
  target: Schema.Record(Schema.String, Schema.NonEmptyString),
  options: Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Boolean])),
  dnsScope: Schema.Literals(["PublicOnly", "PrivateNetwork"]),
  checkpoints: Schema.NonEmptyArray(CheckpointId), credential: PublishCredential,
  contractFixtureId: Schema.NonEmptyString }) {}
export class AnnouncementPublish extends Schema.TaggedClass<AnnouncementPublish>()("AnnouncementPublish", {
  ...row, profileId: ProfileId, target: Schema.Struct({ destination: Schema.NonEmptyString }),
  credential: PublishCredential, contractFixtureId: Schema.NonEmptyString }) {}
export class SmtpPublish extends Schema.TaggedClass<SmtpPublish>()("SmtpPublish", {
  ...row, profileId: Schema.Literal("announce.smtp/v1"), target: Schema.Struct({ destination: Schema.NonEmptyString }),
  credential: PublishCredential, contractFixtureId: Schema.Literal("contract.announce.smtp/v1") }) {}
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
export const ValidateOp = Schema.Union([Check, Exec, HttpRead, ReviewedNoteTransform])
export type ValidateOp = typeof ValidateOp.Type
export const PublishOp = Schema.Union([
  Exec, HttpPublish, ForgeRelease, PackageRegistryRelease,
  PackageStorePublish, SupplyChainPublish, ProviderPublish, OpaquePublish
])
export type PublishOp = typeof PublishOp.Type
export const AnnounceOp = Schema.Union([HttpPublish, AnnouncementPublish, SmtpPublish])
export type AnnounceOp = typeof AnnounceOp.Type
export const VerifyOp = Schema.Union([Check, HttpRead])
export type VerifyOp = typeof VerifyOp.Type

export const Operation = Schema.Union([
  Check, Write, Pack, DigestOp, Exec, HttpRead, ReviewedNoteTransform,
  HttpPublish, ForgeRelease, PackageRegistryRelease, AnnouncementPublish, SmtpPublish,
  PackageStorePublish, SupplyChainPublish, ProviderPublish, OpaquePublish
])
export type Operation = typeof Operation.Type
export const mechanismTags = [
  "Check", "Write", "Pack", "Digest", "Exec", "HttpRead", "ReviewedNoteTransform",
  "HttpPublish", "ForgeRelease", "PackageRegistryRelease", "AnnouncementPublish", "SmtpPublish",
  "PackageStorePublish", "SupplyChainPublish", "ProviderPublish", "OpaquePublish"
] as const
export type Authority = "LocalRead" | "LocalWrite" | "LocalExec" | "RemoteRead" | "RemotePublish"

export type RemotePublishOp =
  | HttpPublish | ForgeRelease | PackageRegistryRelease | PackageStorePublish
  | SupplyChainPublish | ProviderPublish | AnnouncementPublish | SmtpPublish | OpaquePublish

export const isRemotePublish = (operation: Operation): operation is RemotePublishOp =>
  operationAuthority(operation) === "RemotePublish"

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
    case "ReviewedNoteTransform":
      return "RemoteRead"
    case "HttpPublish":
    case "ForgeRelease":
    case "PackageRegistryRelease":
    case "PackageStorePublish":
    case "SupplyChainPublish":
    case "ProviderPublish":
    case "AnnouncementPublish":
    case "SmtpPublish":
    case "OpaquePublish":
      return "RemotePublish"
  }
}
