import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type {
  CanonicalAudience,
  CredentialPurpose,
  CredentialRef,
  CredentialRequest,
  EnvironmentName,
  ProviderId,
  SubjectId
} from "../model/authority.js"
import type { MutationDecision } from "./report.js"

const CredentialGrantTypeId: unique symbol = Symbol("ts-release/CredentialGrant")

interface CredentialGrantBase<Tag extends string> {
  readonly [CredentialGrantTypeId]: Tag
  readonly _tag: Tag
  readonly subject: SubjectId
  readonly provider: ProviderId
  readonly audience: CanonicalAudience
  readonly purposes: ReadonlySet<CredentialPurpose>
}

/** Observe-only capability. It carries no credential or credential accessor. */
export interface AnonymousAccess extends CredentialGrantBase<"AnonymousAccess"> {}

/** Capability backed by a host-owned credential reference, never its value. */
export interface ScopedSecret extends CredentialGrantBase<"ScopedSecret"> {
  readonly ref: CredentialRef
}

/** Certified workload identity names; token material remains host-owned. */
export interface WorkloadIdentity extends CredentialGrantBase<"WorkloadIdentity"> {
  readonly names: ReadonlySet<EnvironmentName>
}

export type CredentialGrant = AnonymousAccess | ScopedSecret | WorkloadIdentity
export type MutationCredentialGrant = ScopedSecret | WorkloadIdentity

export type NonEmptyPurposes = readonly [CredentialPurpose, ...Array<CredentialPurpose>]
export type NonEmptyEnvironmentNames = readonly [EnvironmentName, ...Array<EnvironmentName>]

/**
 * Metadata returned by a host acquirer. Secret values never cross this seam.
 * `makeCredentialProvider` validates it against the exact prepared request
 * before privately minting an opaque grant.
 */
export type CredentialGrantDescriptor =
  | { readonly _tag: "AnonymousAccess", readonly purposes: readonly ["observe"] }
  | { readonly _tag: "ScopedSecret", readonly purposes: NonEmptyPurposes, readonly ref: CredentialRef }
  | { readonly _tag: "WorkloadIdentity", readonly purposes: NonEmptyPurposes, readonly names: NonEmptyEnvironmentNames }

export class CredentialUnavailable
  extends Schema.TaggedErrorClass<CredentialUnavailable>()("CredentialUnavailable", {
    subject: Schema.String,
    provider: Schema.String,
    purpose: Schema.String,
    reason: Schema.String
  }) {}

export class CredentialAudienceMismatch
  extends Schema.TaggedErrorClass<CredentialAudienceMismatch>()("CredentialAudienceMismatch", {
    subject: Schema.String,
    expected: Schema.String,
    observed: Schema.String
  }) {}

export class CredentialPurposeMismatch
  extends Schema.TaggedErrorClass<CredentialPurposeMismatch>()("CredentialPurposeMismatch", {
    subject: Schema.String,
    required: Schema.String,
    granted: Schema.Array(Schema.String)
  }) {}

export class CredentialStrategyUnsupported
  extends Schema.TaggedErrorClass<CredentialStrategyUnsupported>()("CredentialStrategyUnsupported", {
    subject: Schema.String,
    provider: Schema.String,
    strategy: Schema.String,
    reason: Schema.String
  }) {}

export class CredentialSubjectMismatch
  extends Schema.TaggedErrorClass<CredentialSubjectMismatch>()("CredentialSubjectMismatch", {
    expected: Schema.String,
    observed: Schema.String
  }) {}

export class PublisherDispatchError
  extends Schema.TaggedErrorClass<PublisherDispatchError>()("PublisherDispatchError", {
    subject: Schema.String,
    reason: Schema.String
  }) {}

export type CredentialAuthorityError =
  | CredentialUnavailable
  | CredentialAudienceMismatch
  | CredentialPurposeMismatch
  | CredentialStrategyUnsupported
  | CredentialSubjectMismatch

export interface CredentialGrantAcquirer {
  readonly acquire: (
    request: CredentialRequest
  ) => Effect.Effect<CredentialGrantDescriptor, CredentialUnavailable | CredentialStrategyUnsupported>
}

export interface CredentialProviderShape {
  readonly acquireForObservation: (
    request: CredentialRequest
  ) => Effect.Effect<CredentialGrant, CredentialAuthorityError>
  readonly acquireForMutation: (
    request: CredentialRequest,
    decision: MutationDecision
  ) => Effect.Effect<MutationCredentialGrant, CredentialAuthorityError>
}

export class CredentialProvider
  extends Context.Service<CredentialProvider, CredentialProviderShape>()(
    "ts-release/CredentialProvider"
  ) {}

type GrantMetadata = {
  readonly subject: SubjectId
  readonly provider: ProviderId
  readonly audience: CanonicalAudience
  readonly purposes: ReadonlySet<CredentialPurpose>
}

const grantMetadata = new WeakMap<CredentialGrant, GrantMetadata>()

const purposeSet = (purposes: NonEmptyPurposes): ReadonlySet<CredentialPurpose> =>
  new Set(purposes)

const remember = <Grant extends CredentialGrant>(grant: Grant): Grant => {
  grantMetadata.set(grant, {
    subject: grant.subject,
    provider: grant.provider,
    audience: grant.audience,
    purposes: new Set(grant.purposes)
  })
  return grant
}

class AnonymousAccessGrant implements AnonymousAccess {
  readonly [CredentialGrantTypeId] = "AnonymousAccess" as const
  readonly _tag = "AnonymousAccess" as const
  readonly purposes = purposeSet(["observe"])

  constructor(
    readonly subject: SubjectId,
    readonly provider: ProviderId,
    readonly audience: CanonicalAudience
  ) {
    Object.freeze(this)
  }
}

class ScopedSecretGrant implements ScopedSecret {
  readonly [CredentialGrantTypeId] = "ScopedSecret" as const
  readonly _tag = "ScopedSecret" as const
  readonly purposes: ReadonlySet<CredentialPurpose>

  constructor(
    readonly subject: SubjectId,
    readonly provider: ProviderId,
    readonly audience: CanonicalAudience,
    purposes: NonEmptyPurposes,
    readonly ref: CredentialRef
  ) {
    this.purposes = purposeSet(purposes)
    Object.freeze(this)
  }
}

class WorkloadIdentityGrant implements WorkloadIdentity {
  readonly [CredentialGrantTypeId] = "WorkloadIdentity" as const
  readonly _tag = "WorkloadIdentity" as const
  readonly purposes: ReadonlySet<CredentialPurpose>
  readonly names: ReadonlySet<EnvironmentName>

  constructor(
    readonly subject: SubjectId,
    readonly provider: ProviderId,
    readonly audience: CanonicalAudience,
    purposes: NonEmptyPurposes,
    names: NonEmptyEnvironmentNames
  ) {
    this.purposes = purposeSet(purposes)
    this.names = new Set(names)
    Object.freeze(this)
  }
}

const unsupported = (request: CredentialRequest, reason: string) =>
  new CredentialStrategyUnsupported({
    subject: request.subject,
    provider: request.provider,
    strategy: request.strategy.kind,
    reason
  })

const validatePurposes = (
  request: CredentialRequest,
  purposes: NonEmptyPurposes
): Effect.Effect<ReadonlySet<CredentialPurpose>, CredentialPurposeMismatch | CredentialStrategyUnsupported> => {
  const unique = new Set(purposes)
  if (unique.size !== purposes.length) {
    return Effect.fail(unsupported(request, "The host returned duplicate credential purposes."))
  }
  if (!unique.has(request.purpose)) {
    return Effect.fail(new CredentialPurposeMismatch({
      subject: request.subject,
      required: request.purpose,
      granted: [...unique]
    }))
  }
  return Effect.succeed(unique)
}

const mintGrant = Effect.fn("CredentialProvider.mintGrant")(function*(
  request: CredentialRequest,
  descriptor: CredentialGrantDescriptor
) {
  yield* validatePurposes(request, descriptor.purposes)
  switch (descriptor._tag) {
    case "AnonymousAccess":
      if (request.strategy.kind !== "anonymous" || request.purpose !== "observe") {
        return yield* unsupported(request, "Anonymous access is valid only for anonymous observation.")
      }
      return remember(new AnonymousAccessGrant(request.subject, request.provider, request.audience))
    case "ScopedSecret":
      if (request.strategy.kind !== "token" || descriptor.ref !== request.strategy.credential) {
        return yield* unsupported(request, "The scoped-secret descriptor does not match the exact token strategy and credential reference.")
      }
      return remember(new ScopedSecretGrant(
        request.subject,
        request.provider,
        request.audience,
        descriptor.purposes,
        descriptor.ref
      ))
    case "WorkloadIdentity":
      if (request.strategy.kind !== "trusted-publishing") {
        return yield* unsupported(request, "Workload identity requires the prepared trusted-publishing strategy.")
      }
      if (new Set(descriptor.names).size !== descriptor.names.length) {
        return yield* unsupported(request, "The certified workload environment-name set contains duplicates.")
      }
      return remember(new WorkloadIdentityGrant(
        request.subject,
        request.provider,
        request.audience,
        descriptor.purposes,
        descriptor.names
      ))
  }
})

/** Builds a host-friendly provider without exposing a grant constructor. */
export const makeCredentialProvider = (host: CredentialGrantAcquirer): CredentialProviderShape => {
  const acquire = Effect.fn("CredentialProvider.acquire")(function*(request: CredentialRequest) {
    const descriptor = yield* host.acquire(request)
    return yield* mintGrant(request, descriptor)
  })

  return {
    acquireForObservation: Effect.fn("CredentialProvider.acquireForObservation")(function*(request) {
      if (request.purpose !== "observe") {
        return yield* new CredentialPurposeMismatch({
          subject: request.subject,
          required: "observe",
          granted: [request.purpose]
        })
      }
      return yield* acquire(request)
    }),
    acquireForMutation: Effect.fn("CredentialProvider.acquireForMutation")(function*(request, decision) {
      if (request.purpose === "observe") {
        return yield* new CredentialPurposeMismatch({
          subject: request.subject,
          required: "publish-or-correct",
          granted: [request.purpose]
        })
      }
      if (decision.subject !== request.subject) {
        return yield* new CredentialSubjectMismatch({
          expected: request.subject,
          observed: decision.subject
        })
      }
      const grant = yield* acquire(request)
      if (grant._tag === "AnonymousAccess") {
        return yield* unsupported(request, "Anonymous access cannot authorize mutation.")
      }
      return grant
    })
  }
}

export type PublisherOperation =
  | {
    readonly _tag: "PublishOperation"
    readonly subject: SubjectId
    readonly provider: ProviderId
    readonly audience: CanonicalAudience
    readonly purpose: "publish"
    readonly decision: MutationDecision
  }
  | {
    readonly _tag: "CorrectionOperation"
    readonly subject: SubjectId
    readonly provider: ProviderId
    readonly audience: CanonicalAudience
    readonly purpose: "correct"
    readonly decision: MutationDecision
  }

/**
 * The publisher is a host-owned elimination boundary. Provider adapters pass
 * only typed operation data and a capability; no generic command accepts one.
 */
export interface PublisherSinkShape {
  readonly dispatch: (
    operation: PublisherOperation,
    grant: MutationCredentialGrant
  ) => Effect.Effect<void, CredentialAuthorityError | PublisherDispatchError>
}

export class PublisherSink
  extends Context.Service<PublisherSink, PublisherSinkShape>()(
    "ts-release/PublisherSink"
  ) {}

/** Shared sink-side recheck. It trusts private issuance metadata, not fields. */
export const validateGrantForOperation = Effect.fn("validateGrantForOperation")(function*(
  operation: PublisherOperation,
  grant: MutationCredentialGrant
) {
  const issued = grantMetadata.get(grant)
  if (issued === undefined) {
    return yield* new CredentialUnavailable({
      subject: operation.subject,
      provider: operation.provider,
      purpose: operation.purpose,
      reason: "The supplied grant was not issued by this authority boundary."
    })
  }
  if (issued.subject !== operation.subject) {
    return yield* new CredentialSubjectMismatch({
      expected: operation.subject,
      observed: issued.subject
    })
  }
  if (operation.decision.subject !== operation.subject) {
    return yield* new CredentialSubjectMismatch({
      expected: operation.subject,
      observed: operation.decision.subject
    })
  }
  if (issued.provider !== operation.provider || issued.audience !== operation.audience) {
    return yield* new CredentialAudienceMismatch({
      subject: operation.subject,
      expected: `${operation.provider}:${operation.audience}`,
      observed: `${issued.provider}:${issued.audience}`
    })
  }
  if (!issued.purposes.has(operation.purpose)) {
    return yield* new CredentialPurposeMismatch({
      subject: operation.subject,
      required: operation.purpose,
      granted: [...issued.purposes]
    })
  }
})

export interface PublisherDispatcher {
  readonly dispatch: (
    operation: PublisherOperation,
    grant: MutationCredentialGrant
  ) => Effect.Effect<void, PublisherDispatchError>
}

/** Wraps a host dispatcher so every mutation rechecks opaque authority first. */
export const makePublisherSink = (host: PublisherDispatcher): PublisherSinkShape => ({
  dispatch: Effect.fn("PublisherSink.dispatch")(function*(operation, grant) {
    yield* validateGrantForOperation(operation, grant)
    yield* host.dispatch(operation, grant)
  })
})
