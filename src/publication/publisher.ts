import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import type { NonEmptyName, Version } from "../model/primitives.js"
import type { PreparedNpmPublication } from "../release/prepared.js"
import type { CredentialAuthorityError, MutationCredentialGrant, ScopedSecret, WorkloadIdentity } from "./authority.js"
import type { HttpAuthorizationError } from "./http.js"
import type { PublisherOperation } from "./authority.js"

const NpmUserConfigTypeId: unique symbol = Symbol("ts-release/NpmUserConfig")

/** Opaque handle: only CertifiedPublisherSpawn can eliminate it to a path. */
export interface NpmUserConfig {
  readonly _tag: "NpmUserConfig"
  readonly [NpmUserConfigTypeId]: typeof NpmUserConfigTypeId
}

export const makeNpmUserConfigHandle = (): NpmUserConfig => Object.freeze({
  _tag: "NpmUserConfig" as const,
  [NpmUserConfigTypeId]: NpmUserConfigTypeId
} as NpmUserConfig)

export type NpmPublishOperation = Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>

export interface NpmUserConfigInput {
  readonly operation: NpmPublishOperation
  readonly registryUrl: string
}

export interface NpmUserConfigResourceShape {
  readonly acquire: (
    input: NpmUserConfigInput,
    grant: ScopedSecret
  ) => Effect.Effect<NpmUserConfig, CredentialAuthorityError | HttpAuthorizationError, Scope.Scope>
}

export class NpmUserConfigResource
  extends Context.Service<NpmUserConfigResource, NpmUserConfigResourceShape>()(
    "ts-release/NpmUserConfigResource"
  ) {}

interface CertifiedPublisherSpecBase {
  readonly operation: NpmPublishOperation
  readonly cwd: string
  readonly tarballPath: string
  readonly packageName: NonEmptyName
  readonly version: Version
  readonly registryUrl: PreparedNpmPublication["registryUrl"]
  readonly distTag: PreparedNpmPublication["distTag"]
  readonly access: PreparedNpmPublication["access"]
  readonly provenance: PreparedNpmPublication["provenance"]
}

export interface NpmPublisherSpec extends CertifiedPublisherSpecBase {
  readonly _tag: "NpmPublisherSpec"
  readonly operation: NpmPublishOperation
  readonly userConfig: NpmUserConfig
}

export interface WorkloadPublisherSpec extends CertifiedPublisherSpecBase {
  readonly _tag: "WorkloadPublisherSpec"
}

export type CertifiedPublisherSpec = NpmPublisherSpec | WorkloadPublisherSpec

/** The credential-bearing host owns the only admitted npm mutation argv. */
export const npmPublishArgv = (
  spec: CertifiedPublisherSpec
): readonly [string, ...Array<string>] => [
  "npm",
  "publish",
  spec.tarballPath,
  "--ignore-scripts",
  "--registry",
  spec.registryUrl,
  "--tag",
  spec.distTag,
  "--access",
  spec.access,
  ...(spec.provenance === "required"
    ? ["--provenance"]
    : spec.provenance === "disabled"
      ? ["--provenance=false"]
      : []),
  "--json"
]

export class RejectedBeforeStart
  extends Schema.TaggedClass<RejectedBeforeStart>()("RejectedBeforeStart", {
    commitment: Schema.Literal("before-dispatch"),
    reason: Schema.NonEmptyString
  }) {}

export class PublisherExited
  extends Schema.TaggedClass<PublisherExited>()("PublisherExited", {
    commitment: Schema.Literal("started"),
    exitCode: Schema.Int,
    stdout: Schema.String,
    stderr: Schema.String
  }) {}

export class PublisherOutcomeUnknown
  extends Schema.TaggedClass<PublisherOutcomeUnknown>()("PublisherOutcomeUnknown", {
    commitment: Schema.Literal("unknown"),
    reason: Schema.NonEmptyString
  }) {}

export const CertifiedPublisherResult = Schema.Union([
  RejectedBeforeStart,
  PublisherExited,
  PublisherOutcomeUnknown
])
export type CertifiedPublisherResult = typeof CertifiedPublisherResult.Type

export interface CertifiedPublisherSpawnShape {
  readonly preflightTrustedNpm: (
    operation: NpmPublishOperation,
    grant: WorkloadIdentity
  ) => Effect.Effect<void, CredentialAuthorityError | HttpAuthorizationError>
  readonly spawn: (
    spec: CertifiedPublisherSpec,
    grant: MutationCredentialGrant
  ) => Effect.Effect<CertifiedPublisherResult, CredentialAuthorityError | HttpAuthorizationError>
}

export class CertifiedPublisherSpawn
  extends Context.Service<CertifiedPublisherSpawn, CertifiedPublisherSpawnShape>()(
    "ts-release/CertifiedPublisherSpawn"
  ) {}
