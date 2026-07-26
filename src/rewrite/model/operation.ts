import * as Schema from "effect/Schema"
import {
  CredentialName,
  OperationId,
  OutputId,
  ProfileId,
  SafeRelativePath
} from "./primitives.js"

export class OutputDeclaration extends Schema.Class<OutputDeclaration>("OutputDeclaration")({
  id: OutputId,
  path: SafeRelativePath,
  kind: Schema.Literals(["file", "directory", "executable", "archive", "digest"])
}) {}

const row = {
  id: OperationId,
  inputs: Schema.Array(OutputId),
  outputs: Schema.Array(OutputDeclaration)
}

export class ReadCredential extends Schema.Class<ReadCredential>("ReadCredential")({
  name: CredentialName
}) {}
export class PublishCredential extends Schema.Class<PublishCredential>("PublishCredential")({
  name: CredentialName
}) {}

export class WireContract extends Schema.Class<WireContract>("WireContract")({
  profileId: ProfileId,
  contractFixtureId: Schema.NonEmptyString,
  baseUrl: Schema.NonEmptyString,
  pathTemplate: Schema.NonEmptyString,
  responseShapeId: Schema.Literals(["json-object-v1", "empty-v1"]),
  pagination: Schema.Literals(["none", "link-header"]),
  commitment: Schema.Literals(["read-only", "status-2xx"]),
  reconciliation: Schema.Literals(["none", "get-same-resource"])
}) {}

export class Check extends Schema.TaggedClass<Check>()("Check", {
  ...row,
  path: SafeRelativePath
}) {}
export class Write extends Schema.TaggedClass<Write>()("Write", {
  ...row,
  path: SafeRelativePath,
  content: Schema.String
}) {}
export class Pack extends Schema.TaggedClass<Pack>()("Pack", {
  ...row,
  format: Schema.Literals(["tar.gz", "zip"])
}) {}
export class DigestOp extends Schema.TaggedClass<DigestOp>()("Digest", {
  ...row,
  algorithm: Schema.Literals(["sha256", "sha512"])
}) {}
export class Exec extends Schema.TaggedClass<Exec>()("Exec", {
  ...row,
  contractFixtureId: Schema.NonEmptyString,
  argv: Schema.NonEmptyArray(Schema.String),
  cwd: SafeRelativePath,
  environmentNames: Schema.Array(Schema.NonEmptyString)
}) {}
export class HttpRead extends Schema.TaggedClass<HttpRead>()("HttpRead", {
  ...row,
  method: Schema.Literals(["GET", "HEAD"]),
  wire: WireContract,
  credential: Schema.optionalKey(ReadCredential)
}) {}
export class HttpPublish extends Schema.TaggedClass<HttpPublish>()("HttpPublish", {
  ...row,
  method: Schema.Literals(["POST", "PUT", "PATCH", "DELETE"]),
  wire: WireContract,
  credential: PublishCredential
}) {}
export class ForgeRelease extends Schema.TaggedClass<ForgeRelease>()("ForgeRelease", {
  ...row,
  repository: Schema.NonEmptyString,
  tag: Schema.NonEmptyString,
  credential: PublishCredential,
  contractFixtureId: Schema.NonEmptyString
}) {}

export const BuildOp = Schema.Union([Check, Write, Exec])
export type BuildOp = typeof BuildOp.Type
export const ProcessOp = Schema.Union([Check, Write, Pack, DigestOp, Exec])
export type ProcessOp = typeof ProcessOp.Type
export const CatalogOp = Schema.Union([Check, Write, Exec])
export type CatalogOp = typeof CatalogOp.Type
export const ValidateOp = Schema.Union([Check, Exec, HttpRead])
export type ValidateOp = typeof ValidateOp.Type
export const PublishOp = Schema.Union([HttpPublish, ForgeRelease])
export type PublishOp = typeof PublishOp.Type
export const AnnounceOp = Schema.Union([HttpPublish])
export type AnnounceOp = typeof AnnounceOp.Type
export const VerifyOp = Schema.Union([Check, HttpRead])
export type VerifyOp = typeof VerifyOp.Type

export const Operation = Schema.Union([
  Check,
  Write,
  Pack,
  DigestOp,
  Exec,
  HttpRead,
  HttpPublish,
  ForgeRelease
])
export type Operation = typeof Operation.Type
export const mechanismTags = [
  "Check",
  "Write",
  "Pack",
  "Digest",
  "Exec",
  "HttpRead",
  "HttpPublish",
  "ForgeRelease"
] as const
export type Authority =
  | "LocalRead"
  | "LocalWrite"
  | "LocalExec"
  | "RemoteRead"
  | "RemotePublish"

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
      return "RemotePublish"
  }
}
