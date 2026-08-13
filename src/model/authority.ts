import * as Schema from "effect/Schema"

const identifier = <const Name extends string>(name: Name) =>
  Schema.NonEmptyString.pipe(Schema.brand(name))

/** Stable identity of one remotely observable publication/correction subject. */
export const SubjectId = identifier("SubjectId")
export type SubjectId = typeof SubjectId.Type

export const ProviderId = identifier("ProviderId")
export type ProviderId = typeof ProviderId.Type

/** Canonical provider audience, including any authority-relevant base path. */
export const CanonicalAudience = identifier("CanonicalAudience")
export type CanonicalAudience = typeof CanonicalAudience.Type

/** A host-owned secret reference. It is a name/handle, never secret material. */
export const CredentialRef = identifier("CredentialRef")
export type CredentialRef = typeof CredentialRef.Type

export const EnvironmentName = Schema.String.check(
  Schema.makeFilter((value: string) => /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)
    ? undefined
    : "EnvironmentName must be a portable environment variable name.")
).pipe(Schema.brand("EnvironmentName"))
export type EnvironmentName = typeof EnvironmentName.Type

export const CredentialPurpose = Schema.Literals(["observe", "publish", "correct"])
export type CredentialPurpose = typeof CredentialPurpose.Type

/** Exact verified source revision projected into npm's GitHub provenance statement. */
export const TrustedPublishingSourceCommit = Schema.String.check(
  Schema.makeFilter((value: string) => /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(value)
    ? undefined
    : "TrustedPublishingSourceCommit must be a lowercase full Git SHA (40 or 64 hex characters).")
).pipe(Schema.brand("TrustedPublishingSourceCommit"))
export type TrustedPublishingSourceCommit = typeof TrustedPublishingSourceCommit.Type

export class AnonymousAuthStrategy
  extends Schema.Class<AnonymousAuthStrategy>("AnonymousAuthStrategy")({
    kind: Schema.Literal("anonymous")
  }) {}

export class TokenAuthStrategy
  extends Schema.Class<TokenAuthStrategy>("TokenAuthStrategy")({
    kind: Schema.Literal("token"),
    credential: CredentialRef
  }) {}

export class TrustedPublishingAuthStrategy
  extends Schema.Class<TrustedPublishingAuthStrategy>("TrustedPublishingAuthStrategy")({
    kind: Schema.Literal("trusted-publishing"),
    identityProvider: Schema.Literal("github-actions"),
    runnerClass: Schema.Literal("github-hosted"),
    repository: Schema.NonEmptyString,
    workflow: Schema.NonEmptyString,
    workflowRef: Schema.NonEmptyString,
    sourceCommit: TrustedPublishingSourceCommit,
    provenanceEnvironmentContract: Schema.Literal("github-actions-npm-provenance-v1"),
    allowedAction: Schema.Literal("npm-publish-direct"),
    publisherSink: Schema.Literal("certified-npm-cli")
  }) {}

export const ResolvedAuthStrategy = Schema.Union([
  AnonymousAuthStrategy,
  TokenAuthStrategy,
  TrustedPublishingAuthStrategy
])
export type ResolvedAuthStrategy = typeof ResolvedAuthStrategy.Type

/**
 * Exact authority requested for a verified prepared subject. This value is
 * safe to report and persist: it contains only host references and intent.
 */
export class CredentialRequest
  extends Schema.Class<CredentialRequest>("CredentialRequest")({
    subject: SubjectId,
    provider: ProviderId,
    audience: CanonicalAudience,
    purpose: CredentialPurpose,
    strategy: ResolvedAuthStrategy
  }) {}

export type ObservationCredentialRequest = CredentialRequest & {
  readonly purpose: "observe"
}

export type MutationCredentialRequest = CredentialRequest & {
  readonly purpose: "publish" | "correct"
}
