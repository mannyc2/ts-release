import * as Schema from "effect/Schema"
import { SafeReason } from "./report.js"

/** Independent recovery axes. None of these values implies another axis. */
export const ObservationStrength = Schema.Literals(["exact", "conditional", "none"])
export type ObservationStrength = typeof ObservationStrength.Type

export const AuthoritativeAbsenceCapability = Schema.Literals([
  "proved",
  "provider-specific",
  "unavailable"
])
export type AuthoritativeAbsenceCapability = typeof AuthoritativeAbsenceCapability.Type

export const CreateAuthorizationCapability = Schema.Literals([
  "none",
  "authenticated-namespace-and-unique-coordinate"
])
export type CreateAuthorizationCapability = typeof CreateAuthorizationCapability.Type

export const ReplayCapability = Schema.Literals([
  "coordinate-unique",
  "idempotency-key",
  "conditional",
  "unsafe"
])
export type ReplayCapability = typeof ReplayCapability.Type

export const IdentifierReuseCapability = Schema.Literals([
  "reusable",
  "consumed-after-delete",
  "not-applicable"
])
export type IdentifierReuseCapability = typeof IdentifierReuseCapability.Type

export const CorrectionKind = Schema.Literals([
  "deprecate",
  "amend-release-metadata",
  "yank-file",
  "forward-catalog-state"
])
export type CorrectionKind = typeof CorrectionKind.Type

export const ExposureCapability = Schema.Literals([
  "retractable",
  "persistent-to-consumers",
  "append-only"
])
export type ExposureCapability = typeof ExposureCapability.Type

export const HistoryStoreRequirement = Schema.Literals([
  "optional-evidence",
  "durable-cas-required"
])
export type HistoryStoreRequirement = typeof HistoryStoreRequirement.Type

const documentedUrl = Schema.String.check(Schema.makeFilter((value: string) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === ""
      ? undefined
      : "A documented convergence contract must use a credential-free HTTPS URL."
  } catch {
    return "A documented convergence contract must use a valid HTTPS URL."
  }
}))

const calendarDate = Schema.String.check(Schema.makeFilter((value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return "A convergence contract date must use YYYY-MM-DD."
  const instant = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 10) !== value
    ? "A convergence contract date must be a real calendar date."
    : undefined
}))

export class DocumentedReadConvergenceContract
  extends Schema.TaggedClass<DocumentedReadConvergenceContract>()("documented", {
    url: documentedUrl,
    date: calendarDate
  }) {}

export class AssumedReadConvergenceContract
  extends Schema.TaggedClass<AssumedReadConvergenceContract>()("assumed", {
    basis: SafeReason
  }) {}

export class UnknownReadConvergenceContract
  extends Schema.TaggedClass<UnknownReadConvergenceContract>()("unknown", {}) {}

export const ReadConvergenceContract = Schema.Union([
  DocumentedReadConvergenceContract,
  AssumedReadConvergenceContract,
  UnknownReadConvergenceContract
])
export type ReadConvergenceContract = typeof ReadConvergenceContract.Type

const boundedInteger = (name: string, minimum: number, maximum: number) =>
  Schema.Number.check(Schema.makeFilter((value: number) =>
    Number.isSafeInteger(value) && value >= minimum && value <= maximum
      ? undefined
      : `${name} must be a safe integer between ${minimum} and ${maximum}.`))

const boundedFactor = Schema.Number.check(Schema.makeFilter((value: number) =>
  Number.isFinite(value) && value >= 1 && value <= 100
    ? undefined
    : "A retry factor must be finite and between 1 and 100."))

const MaxAttempts = boundedInteger("maxAttempts", 1, 100)
const BackoffMilliseconds = boundedInteger("A backoff duration", 0, 3_600_000)
const TotalBudgetMilliseconds = boundedInteger("totalBudgetMs", 0, 86_400_000)

export class ObservationRetryBackoff
  extends Schema.Class<ObservationRetryBackoff>("ObservationRetryBackoff")({
    baseMs: BackoffMilliseconds,
    factor: boundedFactor,
    capMs: BackoffMilliseconds
  }) {}

class ObservationRetryRecord
  extends Schema.Class<ObservationRetryRecord>("ObservationRetry")({
    maxAttempts: MaxAttempts,
    backoff: ObservationRetryBackoff,
    totalBudgetMs: TotalBudgetMilliseconds
  }) {}

const observationRetryIssue = (value: ObservationRetryRecord): string | undefined => {
  if (value.backoff.capMs < value.backoff.baseMs) {
    return "A retry backoff cap must be greater than or equal to its base."
  }
  if (value.maxAttempts === 1) {
    return value.backoff.baseMs === 0 && value.backoff.capMs === 0 && value.totalBudgetMs === 0
      ? undefined
      : "A one-attempt policy must carry zero backoff and zero total budget."
  }
  if (value.backoff.baseMs === 0 || value.totalBudgetMs === 0) {
    return "A multi-attempt policy requires a positive base backoff and total budget."
  }
  return undefined
}

export const ObservationRetry = ObservationRetryRecord.pipe(Schema.check(
  Schema.makeFilter((value) => observationRetryIssue(value))
))
export type ObservationRetry = typeof ObservationRetry.Type

export const RetryEligible = Schema.Literal("VisibilityPending | Inconclusive")
export type RetryEligible = typeof RetryEligible.Type

export const RetryExhaustion = Schema.Literal("UncertainSubject with full trace")
export type RetryExhaustion = typeof RetryExhaustion.Type

class ReadConvergenceProfileRecord
  extends Schema.Class<ReadConvergenceProfileRecord>("ReadConvergenceProfile")({
    contract: ReadConvergenceContract,
    observationRetry: ObservationRetry,
    retryEligible: RetryEligible,
    exhaustion: RetryExhaustion
  }) {}

const readConvergenceIssue = (value: ReadConvergenceProfileRecord): string | undefined =>
  value.contract._tag === "unknown" && value.observationRetry.maxAttempts !== 1
    ? "An unknown convergence contract cannot authorize additional observation attempts."
    : undefined

export const ReadConvergenceProfile = ReadConvergenceProfileRecord.pipe(Schema.check(
  Schema.makeFilter((value) => readConvergenceIssue(value))
))
export type ReadConvergenceProfile = typeof ReadConvergenceProfile.Type

class RecoveryCapabilityProfileRecord
  extends Schema.Class<RecoveryCapabilityProfileRecord>("RecoveryCapabilityProfile")({
    observation: ObservationStrength,
    authoritativeAbsence: AuthoritativeAbsenceCapability,
    createAuthorization: CreateAuthorizationCapability,
    replay: ReplayCapability,
    identifierReuse: IdentifierReuseCapability,
    correction: Schema.Array(CorrectionKind),
    exposure: ExposureCapability,
    historyRequirement: HistoryStoreRequirement,
    readConvergence: ReadConvergenceProfile
  }) {}

const recoveryCapabilityIssue = (value: RecoveryCapabilityProfileRecord): string | undefined => {
  if (new Set(value.correction).size !== value.correction.length) {
    return "Correction kinds in a recovery profile must be unique."
  }
  return readConvergenceIssue(value.readConvergence)
}

export const RecoveryCapabilityProfile = RecoveryCapabilityProfileRecord.pipe(Schema.check(
  Schema.makeFilter((value) => recoveryCapabilityIssue(value))
))
export type RecoveryCapabilityProfile = typeof RecoveryCapabilityProfile.Type

/** Decode at module/registration boundaries so malformed policies never run. */
export const makeRecoveryCapabilityProfile = (value: unknown): RecoveryCapabilityProfile =>
  Schema.decodeUnknownSync(RecoveryCapabilityProfile, { onExcessProperty: "error" })(value)

/** Unknown provider timing permits the mandatory first reread and nothing else. */
export const conservativeUnknownRecoveryProfile = makeRecoveryCapabilityProfile({
  observation: "conditional",
  authoritativeAbsence: "unavailable",
  createAuthorization: "none",
  replay: "unsafe",
  identifierReuse: "not-applicable",
  correction: [],
  exposure: "persistent-to-consumers",
  historyRequirement: "optional-evidence",
  readConvergence: {
    contract: { _tag: "unknown" },
    observationRetry: {
      maxAttempts: 1,
      backoff: { baseMs: 0, factor: 1, capMs: 0 },
      totalBudgetMs: 0
    },
    retryEligible: "VisibilityPending | Inconclusive",
    exhaustion: "UncertainSubject with full trace"
  }
})

/** Additional reads are permitted only when their timing basis is explicit. */
export const isReadConvergenceLagCapable = (profile: RecoveryCapabilityProfile): boolean =>
  profile.readConvergence.contract._tag !== "unknown" &&
  profile.readConvergence.observationRetry.maxAttempts > 1
