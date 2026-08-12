import * as Schema from "effect/Schema"
import * as Result from "effect/Result"
import { SubjectId } from "../model/authority.js"
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

export class InconclusiveObservation
  extends Schema.TaggedClass<InconclusiveObservation>()("Inconclusive", {
    subject: SubjectId,
    reason: SafeReason
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
    reason: SafeReason
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
    observations: Schema.NonEmptyArray(Observation)
  }) {}

class ConvergedAfterMutationRecord
  extends Schema.TaggedClass<ConvergedAfterMutationRecord>()("ConvergedAfterMutation", {
    subject: SubjectId,
    preObservations: Schema.NonEmptyArray(Observation),
    decision: MutationDecision,
    attempt: Schema.Union([Applied, OutcomeUnknown, RejectedByProvider]),
    postObservations: Schema.NonEmptyArray(Observation)
  }) {}

class BlockedSubjectRecord
  extends Schema.TaggedClass<BlockedSubjectRecord>()("BlockedSubject", {
    subject: SubjectId,
    observations: Schema.NonEmptyArray(Observation),
    cause: BlockedSubjectCause
  }) {}

class UncertainSubjectRecord
  extends Schema.TaggedClass<UncertainSubjectRecord>()("UncertainSubject", {
    subject: SubjectId,
    observations: Schema.NonEmptyArray(Observation),
    decision: Schema.optionalKey(ProviderDecision),
    attempt: Schema.Union([Started, Applied, OutcomeUnknown]),
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

const subjectReportCorrelation = (
  value: NotReached | AlreadyEquivalent | ConvergedAfterMutation | BlockedSubject | UncertainSubject
): string | undefined => {
  switch (value._tag) {
    case "NotReached":
      return undefined
    case "AlreadyEquivalent":
      return sameSubject(value.subject, value.observations) && value.observations.at(-1)?._tag === "PresentEquivalent"
        ? undefined
        : "AlreadyEquivalent requires same-subject observations ending in PresentEquivalent."
    case "ConvergedAfterMutation":
      return sameSubject(value.subject, [
        ...value.preObservations,
        value.decision,
        value.attempt,
        ...value.postObservations
      ]) && value.postObservations.at(-1)?._tag === "PresentEquivalent"
        ? undefined
        : "ConvergedAfterMutation requires one subject and a final PresentEquivalent observation."
    case "BlockedSubject": {
      const nested = value.cause._tag === "ConclusiveProviderRejection"
        ? [value.cause, value.cause.fact, ...value.cause.postObservations]
        : value.cause._tag === "Conflict"
          ? [value.cause]
          : [value.cause]
      return sameSubject(value.subject, [...value.observations, ...nested])
        ? undefined
        : "BlockedSubject evidence must describe the report subject."
    }
    case "UncertainSubject":
      return sameSubject(value.subject, [
        ...value.observations,
        ...(value.decision === undefined ? [] : [value.decision]),
        value.attempt,
        ...value.trace
      ])
        ? undefined
        : "UncertainSubject evidence must describe the report subject."
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

export const makeNotReached = (
  subject: SubjectId,
  reason: NotReachedReason
): Result.Result<NotReached, ReportConstructionError> =>
  validateSubjectReport(new NotReachedRecord({ subject, reason }))

export const makeAlreadyEquivalent = (
  subject: SubjectId,
  observations: readonly [Observation, ...Array<Observation>]
): Result.Result<AlreadyEquivalent, ReportConstructionError> =>
  validateSubjectReport(new AlreadyEquivalentRecord({ subject, observations }))

export const makeConvergedAfterMutation = (input: {
  readonly subject: SubjectId
  readonly preObservations: readonly [Observation, ...Array<Observation>]
  readonly decision: MutationDecision
  readonly attempt: Applied | OutcomeUnknown | RejectedByProvider
  readonly postObservations: readonly [Observation, ...Array<Observation>]
}): Result.Result<ConvergedAfterMutation, ReportConstructionError> =>
  validateSubjectReport(new ConvergedAfterMutationRecord(input))

export const makeBlockedSubject = (input: {
  readonly subject: SubjectId
  readonly observations: readonly [Observation, ...Array<Observation>]
  readonly cause: BlockedSubjectCause
}): Result.Result<BlockedSubject, ReportConstructionError> =>
  validateSubjectReport(new BlockedSubjectRecord(input))

export const makeUncertainSubject = (input: {
  readonly subject: SubjectId
  readonly observations: readonly [Observation, ...Array<Observation>]
  readonly decision?: ProviderDecision
  readonly attempt: Started | Applied | OutcomeUnknown
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
    reason: SafeReason
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
export const inconclusiveObservation = (reason: SafeReason): ObservationClassification =>
  new ReadOnlyInconclusive({ reason })

export class ObservedSubject extends Schema.Class<ObservedSubject>("ObservedSubject")({
  subject: SubjectId,
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

export const ObservationReport = Schema.Struct({
  subjects: Schema.NonEmptyArray(ObservedSubject),
  status: ObservationStatus
}).pipe(Schema.check(Schema.makeFilter((value) =>
  value.status === deriveObservationStatus(value.subjects)
    ? undefined
    : "ObservationReport status must be derived from its subjects.")))
export type ObservationReport = typeof ObservationReport.Type

export const makeObservationReport = (
  subjects: readonly [ObservedSubject, ...Array<ObservedSubject>]
): ObservationReport => ({ subjects, status: deriveObservationStatus(subjects) })
