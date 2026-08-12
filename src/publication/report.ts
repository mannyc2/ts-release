import * as Schema from "effect/Schema"
import * as Result from "effect/Result"
import {
  CanonicalAudience,
  CredentialPurpose,
  ProviderId,
  SubjectId
} from "../model/authority.js"
import { NonEmptyName } from "../model/primitives.js"
import { secretPatterns } from "../model/secret-patterns.js"

export const SafeReason = Schema.String.check(
  Schema.makeFilter((value: string) => {
    const length = [...value].length
    if (length === 0 || length > 2048) return "SafeReason must contain between 1 and 2048 code points."
    if (![...value].every((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint === 9 || codePoint === 10 || codePoint === 13 || codePoint >= 0x20
    })) return "SafeReason must not contain control characters."
    if (secretPatterns.some((pattern) => pattern.test(value))) return "SafeReason must not contain token-shaped material."
    return undefined
  })
).pipe(Schema.brand("SafeReason"))
export type SafeReason = typeof SafeReason.Type

export class Difference extends Schema.Class<Difference>("Difference")({
  field: NonEmptyName,
  expected: SafeReason,
  observed: SafeReason
}) {}

export class AbsenceBasis extends Schema.Class<AbsenceBasis>("AbsenceBasis")({
  kind: NonEmptyName,
  detail: SafeReason
}) {}

export class VisibilityBasis extends Schema.Class<VisibilityBasis>("VisibilityBasis")({
  kind: NonEmptyName,
  detail: SafeReason
}) {}

export class PresentEquivalent
  extends Schema.TaggedClass<PresentEquivalent>()("PresentEquivalent", {
    subject: SubjectId
  }) {}

export class PresentDifferent
  extends Schema.TaggedClass<PresentDifferent>()("PresentDifferent", {
    subject: SubjectId,
    differences: Schema.NonEmptyArray(Difference)
  }) {}

export class AuthoritativelyAbsent
  extends Schema.TaggedClass<AuthoritativelyAbsent>()("AuthoritativelyAbsent", {
    subject: SubjectId,
    basis: AbsenceBasis
  }) {}

export class VisibilityPending
  extends Schema.TaggedClass<VisibilityPending>()("VisibilityPending", {
    subject: SubjectId,
    expectation: SafeReason,
    basis: VisibilityBasis
  }) {}

const CredentialFailureStrategy = Schema.Literals(["anonymous", "token", "trusted-publishing"])

/** Secret-free durable projection of a transient credential acquisition failure. */
export class CredentialUnavailableCause
  extends Schema.TaggedClass<CredentialUnavailableCause>()("CredentialUnavailable", {
    provider: ProviderId,
    purpose: CredentialPurpose,
    strategy: CredentialFailureStrategy
  }) {}

/** Secret-free durable projection of an unsupported prepared authentication strategy. */
export class CredentialStrategyUnsupportedCause
  extends Schema.TaggedClass<CredentialStrategyUnsupportedCause>()("CredentialStrategyUnsupported", {
    provider: ProviderId,
    purpose: CredentialPurpose,
    strategy: CredentialFailureStrategy
  }) {}

export const CredentialFailureCause = Schema.Union([
  CredentialUnavailableCause,
  CredentialStrategyUnsupportedCause
])
export type CredentialFailureCause = typeof CredentialFailureCause.Type

export class InconclusiveObservation
  extends Schema.TaggedClass<InconclusiveObservation>()("Inconclusive", {
    subject: SubjectId,
    reason: SafeReason,
    cause: Schema.optionalKey(CredentialFailureCause)
  }) {}

export const Observation = Schema.Union([
  PresentEquivalent,
  PresentDifferent,
  AuthoritativelyAbsent,
  VisibilityPending,
  InconclusiveObservation
])
export type Observation = typeof Observation.Type

export class MutationPrecondition
  extends Schema.Class<MutationPrecondition>("MutationPrecondition")({
    kind: NonEmptyName
  }) {}

export class CreateAuthorizationProof
  extends Schema.Class<CreateAuthorizationProof>("CreateAuthorizationProof")({
    kind: NonEmptyName
  }) {}

export class NeedsMutation
  extends Schema.TaggedClass<NeedsMutation>()("NeedsMutation", {
    subject: SubjectId,
    precondition: MutationPrecondition
  }) {}

export class ProviderAuthorizedCreate
  extends Schema.TaggedClass<ProviderAuthorizedCreate>()("ProviderAuthorizedCreate", {
    subject: SubjectId,
    proof: CreateAuthorizationProof
  }) {}

export const MutationDecision = Schema.Union([NeedsMutation, ProviderAuthorizedCreate])
export type MutationDecision = typeof MutationDecision.Type

export class ProviderAlreadyEquivalent
  extends Schema.TaggedClass<ProviderAlreadyEquivalent>()("AlreadyEquivalent", {
    subject: SubjectId
  }) {}

export class Conflict
  extends Schema.TaggedClass<Conflict>()("Conflict", {
    subject: SubjectId,
    differences: Schema.NonEmptyArray(Difference)
  }) {}

export class ProviderBlocked
  extends Schema.TaggedClass<ProviderBlocked>()("Blocked", {
    subject: SubjectId,
    reason: SafeReason,
    cause: Schema.optionalKey(CredentialFailureCause)
  }) {}

export const ProviderDecision = Schema.Union([
  ProviderAlreadyEquivalent,
  NeedsMutation,
  ProviderAuthorizedCreate,
  Conflict,
  ProviderBlocked
])
export type ProviderDecision = typeof ProviderDecision.Type

export class ProviderRejectionFact extends Schema.Class<ProviderRejectionFact>("ProviderRejectionFact")({
  subject: SubjectId,
  code: NonEmptyName,
  detail: SafeReason
}) {}

export class ProviderMutationFact extends Schema.Class<ProviderMutationFact>("ProviderMutationFact")({
  subject: SubjectId,
  detail: SafeReason
}) {}

export class RejectedBeforeDispatch
  extends Schema.TaggedClass<RejectedBeforeDispatch>()("RejectedBeforeDispatch", {
    subject: SubjectId,
    reason: SafeReason
  }) {}

export class Started
  extends Schema.TaggedClass<Started>()("Started", {
    subject: SubjectId
  }) {}

export class RejectedByProvider
  extends Schema.TaggedClass<RejectedByProvider>()("RejectedByProvider", {
    subject: SubjectId,
    fact: ProviderRejectionFact
  }) {}

export class Applied
  extends Schema.TaggedClass<Applied>()("Applied", {
    subject: SubjectId,
    fact: ProviderMutationFact
  }) {}

export class OutcomeUnknown
  extends Schema.TaggedClass<OutcomeUnknown>()("OutcomeUnknown", {
    subject: SubjectId,
    reason: SafeReason
  }) {}

export const MutationAttempt = Schema.Union([
  RejectedBeforeDispatch,
  Started,
  RejectedByProvider,
  Applied,
  OutcomeUnknown
])
export type MutationAttempt = typeof MutationAttempt.Type

export const AuthorityGrantKind = Schema.Literals(["AnonymousAccess", "ScopedSecret", "WorkloadIdentity"])
export type AuthorityGrantKind = typeof AuthorityGrantKind.Type

class AuthorityAcquiredRecord
  extends Schema.TaggedClass<AuthorityAcquiredRecord>()("AuthorityAcquired", {
    subject: SubjectId,
    provider: ProviderId,
    audience: CanonicalAudience,
    requestedPurpose: CredentialPurpose,
    grantKind: AuthorityGrantKind,
    purposes: Schema.NonEmptyArray(CredentialPurpose)
  }) {}

const authorityAcquiredIssue = (value: AuthorityAcquiredRecord): string | undefined => {
  const purposes = new Set(value.purposes)
  if (purposes.size !== value.purposes.length) return "Acquired authority purposes must be unique."
  if (!purposes.has(value.requestedPurpose)) {
    return "Acquired authority must include the purpose requested when it was acquired."
  }
  if (value.grantKind === "AnonymousAccess" &&
      (value.requestedPurpose !== "observe" || purposes.size !== 1 || !purposes.has("observe"))) {
    return "Anonymous authority must be acquired for observation with exactly the observe purpose."
  }
  return undefined
}

export const AuthorityAcquired = AuthorityAcquiredRecord.pipe(Schema.check(
  Schema.makeFilter((value) => authorityAcquiredIssue(value))
))
export type AuthorityAcquired = typeof AuthorityAcquired.Type

const observationAuthorityIssue = (value: AuthorityAcquired): string | undefined =>
  authorityAcquiredIssue(value) ??
  (value.requestedPurpose === "observe" && value.purposes.includes("observe")
    ? undefined
    : "Observation authority must be acquired for and include the observe purpose.")

const mutationAuthorityIssue = (value: AuthorityAcquired): string | undefined =>
  authorityAcquiredIssue(value) ??
  (value.requestedPurpose === "publish" || value.requestedPurpose === "correct"
    ? undefined
    : "Mutation authority must be acquired for publish or correct.")

class AuthorityAcquiredButMutationNotDispatchedRecord
  extends Schema.TaggedClass<AuthorityAcquiredButMutationNotDispatchedRecord>()(
    "AuthorityAcquiredButMutationNotDispatched",
    {
      subject: SubjectId,
      authority: AuthorityAcquired,
      attempt: RejectedBeforeDispatch
    }
  ) {}

const authorityNotDispatchedIssue = (
  value: AuthorityAcquiredButMutationNotDispatchedRecord
): string | undefined => {
  const mutationIssue = mutationAuthorityIssue(value.authority)
  if (mutationIssue !== undefined) return mutationIssue
  return value.subject === value.authority.subject && value.subject === value.attempt.subject
    ? undefined
    : "Acquired authority and rejected attempt must describe the same subject."
}

export const AuthorityAcquiredButMutationNotDispatched =
  AuthorityAcquiredButMutationNotDispatchedRecord.pipe(Schema.check(
    Schema.makeFilter((value) => authorityNotDispatchedIssue(value))
  ))
export type AuthorityAcquiredButMutationNotDispatched =
  typeof AuthorityAcquiredButMutationNotDispatched.Type

export const AuthorityEvidence = Schema.Union([
  AuthorityAcquired,
  AuthorityAcquiredButMutationNotDispatched
])
export type AuthorityEvidence = typeof AuthorityEvidence.Type

export class DependencyBlocked
  extends Schema.TaggedClass<DependencyBlocked>()("DependencyBlocked", {
    prerequisite: SubjectId
  }) {}

export class RunAborted
  extends Schema.TaggedClass<RunAborted>()("RunAborted", {
    cause: SafeReason
  }) {}

export const NotReachedReason = Schema.Union([DependencyBlocked, RunAborted])
export type NotReachedReason = typeof NotReachedReason.Type

export class ConclusiveProviderRejection
  extends Schema.TaggedClass<ConclusiveProviderRejection>()("ConclusiveProviderRejection", {
    subject: SubjectId,
    fact: ProviderRejectionFact,
    postObservations: Schema.NonEmptyArray(Observation)
  }) {}

export const BlockedSubjectCause = Schema.Union([
  Conflict,
  ProviderBlocked,
  RejectedBeforeDispatch,
  AuthorityAcquiredButMutationNotDispatched,
  ConclusiveProviderRejection
])
export type BlockedSubjectCause = typeof BlockedSubjectCause.Type

class NotReachedRecord
  extends Schema.TaggedClass<NotReachedRecord>()("NotReached", {
    subject: SubjectId,
    reason: NotReachedReason
  }) {}

class AlreadyEquivalentRecord
  extends Schema.TaggedClass<AlreadyEquivalentRecord>()("AlreadyEquivalent", {
    subject: SubjectId,
    observationAuthorities: Schema.Array(AuthorityAcquired),
    observations: Schema.NonEmptyArray(Observation)
  }) {}

class ConvergedAfterMutationRecord
  extends Schema.TaggedClass<ConvergedAfterMutationRecord>()("ConvergedAfterMutation", {
    subject: SubjectId,
    observationAuthorities: Schema.Array(AuthorityAcquired),
    preObservations: Schema.NonEmptyArray(Observation),
    decision: MutationDecision,
    authority: AuthorityAcquired,
    attempt: Schema.Union([Applied, OutcomeUnknown, RejectedByProvider]),
    postObservations: Schema.NonEmptyArray(Observation)
  }) {}

class BlockedSubjectRecord
  extends Schema.TaggedClass<BlockedSubjectRecord>()("BlockedSubject", {
    subject: SubjectId,
    observationAuthorities: Schema.Array(AuthorityAcquired),
    observations: Schema.NonEmptyArray(Observation),
    cause: BlockedSubjectCause
  }) {}

class UncertainSubjectRecord
  extends Schema.TaggedClass<UncertainSubjectRecord>()("UncertainSubject", {
    subject: SubjectId,
    observationAuthorities: Schema.Array(AuthorityAcquired),
    observations: Schema.NonEmptyArray(Observation),
    decision: Schema.optionalKey(ProviderDecision),
    authority: AuthorityAcquired,
    attempt: Schema.Union([Started, Applied, OutcomeUnknown, RejectedByProvider]),
    trace: Schema.NonEmptyArray(Observation)
  }) {}

export type NotReached = typeof NotReachedRecord.Type
export type AlreadyEquivalent = typeof AlreadyEquivalentRecord.Type
export type ConvergedAfterMutation = typeof ConvergedAfterMutationRecord.Type
export type BlockedSubject = typeof BlockedSubjectRecord.Type
export type UncertainSubject = typeof UncertainSubjectRecord.Type

const sameSubject = (
  subject: SubjectId,
  values: ReadonlyArray<{ readonly subject: SubjectId }>
): boolean => values.every((value) => value.subject === subject)

const observationAuthoritiesIssue = (
  subject: SubjectId,
  authorities: ReadonlyArray<AuthorityAcquired>
): string | undefined => {
  if (!sameSubject(subject, authorities)) {
    return "Observation authority must describe the report subject."
  }
  return authorities.map(observationAuthorityIssue).find((issue) => issue !== undefined)
}

const subjectReportCorrelation = (
  value: NotReached | AlreadyEquivalent | ConvergedAfterMutation | BlockedSubject | UncertainSubject
): string | undefined => {
  switch (value._tag) {
    case "NotReached":
      return undefined
    case "AlreadyEquivalent": {
      const observationIssue = observationAuthoritiesIssue(value.subject, value.observationAuthorities)
      return observationIssue === undefined && sameSubject(value.subject, value.observations) &&
          value.observations.at(-1)?._tag === "PresentEquivalent"
        ? undefined
        : observationIssue ?? "AlreadyEquivalent requires same-subject observations ending in PresentEquivalent."
    }
    case "ConvergedAfterMutation": {
      const observationIssue = observationAuthoritiesIssue(value.subject, value.observationAuthorities)
      const mutationIssue = mutationAuthorityIssue(value.authority)
      return sameSubject(value.subject, [
        ...value.preObservations,
        value.decision,
        value.authority,
        value.attempt,
        ...value.postObservations
      ]) && observationIssue === undefined && mutationIssue === undefined &&
          value.postObservations.at(-1)?._tag === "PresentEquivalent"
        ? undefined
        : observationIssue ?? mutationIssue ??
          "ConvergedAfterMutation requires one subject and a final PresentEquivalent observation."
    }
    case "BlockedSubject": {
      const nested = value.cause._tag === "ConclusiveProviderRejection"
        ? [value.cause, value.cause.fact, ...value.cause.postObservations]
        : value.cause._tag === "AuthorityAcquiredButMutationNotDispatched"
          ? [value.cause, value.cause.authority, value.cause.attempt]
        : value.cause._tag === "Conflict"
          ? [value.cause]
          : [value.cause]
      const evidenceIssue = value.cause._tag === "AuthorityAcquiredButMutationNotDispatched"
        ? authorityNotDispatchedIssue(value.cause)
        : undefined
      const observationIssue = observationAuthoritiesIssue(value.subject, value.observationAuthorities)
      return sameSubject(value.subject, [...value.observations, ...nested]) && evidenceIssue === undefined &&
          observationIssue === undefined
        ? undefined
        : observationIssue ?? evidenceIssue ?? "BlockedSubject evidence must describe the report subject."
    }
    case "UncertainSubject": {
      const observationIssue = observationAuthoritiesIssue(value.subject, value.observationAuthorities)
      const mutationIssue = mutationAuthorityIssue(value.authority)
      return sameSubject(value.subject, [
        ...value.observations,
        ...(value.decision === undefined ? [] : [value.decision]),
        value.authority,
        value.attempt,
        ...value.trace
      ]) && observationIssue === undefined && mutationIssue === undefined
        ? undefined
        : observationIssue ?? mutationIssue ?? "UncertainSubject evidence must describe the report subject."
    }
  }
}

const SubjectReportVariants = Schema.Union([
  NotReachedRecord,
  AlreadyEquivalentRecord,
  ConvergedAfterMutationRecord,
  BlockedSubjectRecord,
  UncertainSubjectRecord
])

export const SubjectReport = SubjectReportVariants.pipe(Schema.check(
  Schema.makeFilter((value) => subjectReportCorrelation(value))
))
export type SubjectReport = typeof SubjectReport.Type

export class ReportConstructionError
  extends Schema.TaggedErrorClass<ReportConstructionError>()("ReportConstructionError", {
    reason: SafeReason
  }) {}

const invalid = <A>(reason: SafeReason): Result.Result<A, ReportConstructionError> =>
  Result.fail(new ReportConstructionError({ reason }))

const validateSubjectReport = <A extends SubjectReport>(value: A): Result.Result<A, ReportConstructionError> => {
  const issue = subjectReportCorrelation(value)
  return issue === undefined ? Result.succeed(value) : invalid(SafeReason.make(issue))
}

export const makeAuthorityAcquired = (input: {
  readonly subject: SubjectId
  readonly provider: ProviderId
  readonly audience: CanonicalAudience
  readonly requestedPurpose: CredentialPurpose
  readonly grantKind: AuthorityGrantKind
  readonly purposes: readonly [CredentialPurpose, ...Array<CredentialPurpose>]
}): Result.Result<AuthorityAcquired, ReportConstructionError> => {
  const value = new AuthorityAcquiredRecord(input)
  const issue = authorityAcquiredIssue(value)
  return issue === undefined ? Result.succeed(value) : invalid(SafeReason.make(issue))
}

export const makeAuthorityAcquiredButMutationNotDispatched = (input: {
  readonly subject: SubjectId
  readonly authority: AuthorityAcquired
  readonly attempt: RejectedBeforeDispatch
}): Result.Result<AuthorityAcquiredButMutationNotDispatched, ReportConstructionError> => {
  const value = new AuthorityAcquiredButMutationNotDispatchedRecord(input)
  const issue = authorityAcquiredIssue(value.authority) ?? authorityNotDispatchedIssue(value)
  return issue === undefined ? Result.succeed(value) : invalid(SafeReason.make(issue))
}

export const makeNotReached = (
  subject: SubjectId,
  reason: NotReachedReason
): Result.Result<NotReached, ReportConstructionError> =>
  validateSubjectReport(new NotReachedRecord({ subject, reason }))

export const makeAlreadyEquivalent = (
  subject: SubjectId,
  observations: readonly [Observation, ...Array<Observation>],
  observationAuthorities: ReadonlyArray<AuthorityAcquired>
): Result.Result<AlreadyEquivalent, ReportConstructionError> =>
  validateSubjectReport(new AlreadyEquivalentRecord({ subject, observationAuthorities, observations }))

export const makeConvergedAfterMutation = (input: {
  readonly subject: SubjectId
  readonly observationAuthorities: ReadonlyArray<AuthorityAcquired>
  readonly preObservations: readonly [Observation, ...Array<Observation>]
  readonly decision: MutationDecision
  readonly authority: AuthorityAcquired
  readonly attempt: Applied | OutcomeUnknown | RejectedByProvider
  readonly postObservations: readonly [Observation, ...Array<Observation>]
}): Result.Result<ConvergedAfterMutation, ReportConstructionError> =>
  validateSubjectReport(new ConvergedAfterMutationRecord(input))

export const makeBlockedSubject = (input: {
  readonly subject: SubjectId
  readonly observationAuthorities: ReadonlyArray<AuthorityAcquired>
  readonly observations: readonly [Observation, ...Array<Observation>]
  readonly cause: BlockedSubjectCause
}): Result.Result<BlockedSubject, ReportConstructionError> =>
  validateSubjectReport(new BlockedSubjectRecord(input))

export const makeUncertainSubject = (input: {
  readonly subject: SubjectId
  readonly observationAuthorities: ReadonlyArray<AuthorityAcquired>
  readonly observations: readonly [Observation, ...Array<Observation>]
  readonly decision?: ProviderDecision
  readonly authority: AuthorityAcquired
  readonly attempt: Started | Applied | OutcomeUnknown | RejectedByProvider
  readonly trace: readonly [Observation, ...Array<Observation>]
}): Result.Result<UncertainSubject, ReportConstructionError> =>
  validateSubjectReport(new UncertainSubjectRecord(input))

export const ReleaseStatus = Schema.Literals(["complete", "blocked", "uncertain"])
export type ReleaseStatus = typeof ReleaseStatus.Type

const deriveReleaseStatus = (
  subjects: readonly [SubjectReport, ...Array<SubjectReport>]
): ReleaseStatus => subjects.some((subject) => subject._tag === "UncertainSubject")
  ? "uncertain"
  : subjects.every((subject) => subject._tag === "AlreadyEquivalent" || subject._tag === "ConvergedAfterMutation")
    ? "complete"
    : "blocked"

const ReleaseReportRecord = Schema.Struct({
  subjects: Schema.NonEmptyArray(SubjectReport),
  status: ReleaseStatus
}).pipe(Schema.check(Schema.makeFilter((value) =>
  value.status === deriveReleaseStatus(value.subjects)
    ? undefined
    : "ReleaseReport status must be derived from its subjects.")))

export const ReleaseReport = ReleaseReportRecord
export type ReleaseReport = typeof ReleaseReport.Type

export const makeReleaseReport = (
  subjects: readonly [SubjectReport, ...Array<SubjectReport>]
): ReleaseReport => ({ subjects, status: deriveReleaseStatus(subjects) })

class ReadOnlyEquivalent
  extends Schema.TaggedClass<ReadOnlyEquivalent>()("Equivalent", {}) {}

class ReadOnlyDifferent
  extends Schema.TaggedClass<ReadOnlyDifferent>()("Different", {
    differences: Schema.NonEmptyArray(Difference)
  }) {}

class ReadOnlyAbsent
  extends Schema.TaggedClass<ReadOnlyAbsent>()("Absent", {
    basis: AbsenceBasis
  }) {}

class ReadOnlyInconclusive
  extends Schema.TaggedClass<ReadOnlyInconclusive>()("Inconclusive", {
    reason: SafeReason,
    cause: Schema.optionalKey(CredentialFailureCause)
  }) {}

export const ObservationClassification = Schema.Union([
  ReadOnlyEquivalent,
  ReadOnlyDifferent,
  ReadOnlyAbsent,
  ReadOnlyInconclusive
])
export type ObservationClassification = typeof ObservationClassification.Type

export const equivalentObservation = (): ObservationClassification => new ReadOnlyEquivalent()
export const differentObservation = (
  differences: readonly [Difference, ...Array<Difference>]
): ObservationClassification => new ReadOnlyDifferent({ differences })
export const absentObservation = (basis: AbsenceBasis): ObservationClassification =>
  new ReadOnlyAbsent({ basis })
export const inconclusiveObservation = (
  reason: SafeReason,
  cause?: CredentialFailureCause
): ObservationClassification => new ReadOnlyInconclusive({
  reason,
  ...(cause === undefined ? {} : { cause })
})

export class ObservedSubject extends Schema.Class<ObservedSubject>("ObservedSubject")({
  subject: SubjectId,
  observationAuthorities: Schema.Array(AuthorityAcquired),
  observation: ObservationClassification
}) {}

export const ObservationStatus = Schema.Literals(["equivalent", "different", "inconclusive"])
export type ObservationStatus = typeof ObservationStatus.Type

const deriveObservationStatus = (
  subjects: readonly [ObservedSubject, ...Array<ObservedSubject>]
): ObservationStatus => subjects.some(({ observation }) => observation._tag === "Inconclusive")
  ? "inconclusive"
  : subjects.every(({ observation }) => observation._tag === "Equivalent")
    ? "equivalent"
    : "different"

const observedSubjectIssue = (value: ObservedSubject): string | undefined =>
  observationAuthoritiesIssue(value.subject, value.observationAuthorities)

export const ObservationReport = Schema.Struct({
  subjects: Schema.NonEmptyArray(ObservedSubject),
  status: ObservationStatus
}).pipe(Schema.check(Schema.makeFilter((value) =>
  value.subjects.map(observedSubjectIssue).find((issue) => issue !== undefined) ??
  (value.status === deriveObservationStatus(value.subjects)
    ? undefined
    : "ObservationReport status must be derived from its subjects."))))
export type ObservationReport = typeof ObservationReport.Type

export const makeObservationReport = (
  subjects: readonly [ObservedSubject, ...Array<ObservedSubject>]
): ObservationReport => ({ subjects, status: deriveObservationStatus(subjects) })
