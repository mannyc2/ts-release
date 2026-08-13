import * as Schema from "effect/Schema"
import { encodeCanonicalJson } from "../model/canonical.js"
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

/**
 * One executable publication adapter and the durable recovery profile it
 * promises to honor. `correctionAdapters` names only actually installed
 * conditional correction implementations; an authored operator proposal is
 * not an adapter.
 */
export interface PublicationProfileRegistration {
  readonly id: string
  readonly provider: string
  readonly preparedTag: string
  readonly recovery: RecoveryCapabilityProfile
  readonly correctionAdapters: ReadonlyArray<CorrectionKind>
  readonly evidence: {
    readonly reviewedAt: string
    readonly observationSources: ReadonlyArray<string>
    readonly correctionSources: ReadonlyArray<string>
    readonly correctionFinding: string
  }
}

export class RecoveryProfileRegistrationError
  extends Schema.TaggedErrorClass<RecoveryProfileRegistrationError>()("RecoveryProfileRegistrationError", {
    registration: Schema.NonEmptyString,
    reason: SafeReason
  }) {}

const decodeRecoveryCapabilityProfile = (value: unknown): RecoveryCapabilityProfile =>
  Schema.decodeUnknownSync(RecoveryCapabilityProfile, { onExcessProperty: "error" })(value)

/** Canonical profile bytes are shared by registration checks and generators. */
export const encodeRecoveryCapabilityProfile = (value: unknown): string =>
  encodeCanonicalJson(Schema.encodeSync(RecoveryCapabilityProfile)(decodeRecoveryCapabilityProfile(value)))

export const recoveryCapabilityProfilesEqual = (left: unknown, right: unknown): boolean =>
  encodeRecoveryCapabilityProfile(left) === encodeRecoveryCapabilityProfile(right)

const registrationFailure = (registration: string, reason: string): RecoveryProfileRegistrationError =>
  RecoveryProfileRegistrationError.make({
    registration,
    reason: SafeReason.make(reason)
  })

/**
 * Fail module registration before any provider operation when the declared
 * profile or installed correction behavior is incoherent.
 */
export const validatePublicationProfiles = <
  const Profiles extends Readonly<Record<string, PublicationProfileRegistration>>
>(profiles: Profiles): Profiles => {
  const ids = new Set<string>()
  const preparedTags = new Set<string>()
  for (const [name, registration] of Object.entries(profiles)) {
    try {
      if (registration.id.length === 0 || registration.provider.length === 0 || registration.preparedTag.length === 0) {
        throw registrationFailure(name, "Registration id, provider, and prepared tag must be nonempty.")
      }
      if (ids.has(registration.id)) throw registrationFailure(name, "Publication profile ids must be unique.")
      if (preparedTags.has(registration.preparedTag)) {
        throw registrationFailure(name, "Prepared publication tags must be unique.")
      }
      ids.add(registration.id)
      preparedTags.add(registration.preparedTag)

      const recovery = decodeRecoveryCapabilityProfile(registration.recovery)
      const adapters = Schema.decodeUnknownSync(Schema.Array(CorrectionKind), {
        onExcessProperty: "error"
      })(registration.correctionAdapters)
      if (new Set(adapters).size !== adapters.length) {
        throw registrationFailure(name, "Installed correction adapter kinds must be unique.")
      }
      if (encodeCanonicalJson(adapters) !== encodeCanonicalJson(recovery.correction)) {
        throw registrationFailure(
          name,
          "Installed correction adapters do not exactly match the recovery profile correction axis."
        )
      }
      Schema.decodeUnknownSync(calendarDate)(registration.evidence.reviewedAt)
      if (registration.evidence.observationSources.length === 0 ||
        registration.evidence.correctionSources.length === 0) {
        throw registrationFailure(name, "A publication profile requires observation and correction evidence sources.")
      }
      for (const url of [
        ...registration.evidence.observationSources,
        ...registration.evidence.correctionSources
      ]) Schema.decodeUnknownSync(documentedUrl)(url)
      Schema.decodeUnknownSync(SafeReason)(registration.evidence.correctionFinding)
    } catch (cause) {
      if (cause instanceof RecoveryProfileRegistrationError) throw cause
      throw registrationFailure(name, "Publication profile registration failed strict schema validation.")
    }
  }
  return profiles
}

/** Refuse a subject factory whose executable subject advertises another policy. */
export const assertRecoveryProfileMatches = (
  registration: string,
  expected: RecoveryCapabilityProfile,
  actual: unknown
): void => {
  try {
    if (!recoveryCapabilityProfilesEqual(expected, actual)) {
      throw registrationFailure(
        registration,
        "Executable subject recovery behavior does not match its registered profile."
      )
    }
  } catch (cause) {
    if (cause instanceof RecoveryProfileRegistrationError) throw cause
    throw registrationFailure(registration, "Executable subject recovery profile failed strict schema validation.")
  }
}

export const validateRecoveryProfileSubjects = (
  registration: string,
  expected: RecoveryCapabilityProfile,
  actualProfiles: ReadonlyArray<unknown>
): void => {
  if (actualProfiles.length === 0) {
    throw registrationFailure(registration, "A registered publication adapter produced no release subject.")
  }
  for (const actual of actualProfiles) assertRecoveryProfileMatches(registration, expected, actual)
}

/** Decode at module/registration boundaries so malformed policies never run. */
export const makeRecoveryCapabilityProfile = (value: unknown): RecoveryCapabilityProfile =>
  decodeRecoveryCapabilityProfile(value)

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
