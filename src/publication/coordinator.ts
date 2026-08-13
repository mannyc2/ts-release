import * as Clock from "effect/Clock"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import {
  SubjectId,
  type CredentialRequest
} from "../model/authority.js"
import {
  CredentialProvider,
  type CredentialAuthorityError,
  type CredentialGrant,
  type CredentialStrategyUnsupported,
  type CredentialUnavailable,
  type MutationCredentialGrant
} from "./authority.js"
import {
  ConclusiveProviderRejection,
  CredentialStrategyUnsupportedCause,
  CredentialUnavailableCause,
  DependencyBlocked,
  InconclusiveObservation,
  ObservedSubject,
  OutcomeUnknown,
  PresentEquivalent,
  ProviderBlocked,
  RejectedBeforeDispatch,
  Started,
  SafeReason,
  absentObservation,
  differentObservation,
  equivalentObservation,
  inconclusiveObservation,
  makeAlreadyEquivalent,
  makeAuthorityAcquired,
  makeAuthorityAcquiredButMutationNotDispatched,
  makeBlockedSubject,
  makeConvergedAfterMutation,
  makeNotReached,
  makeObservationReport,
  makeReleaseReport,
  makeUncertainSubject,
  type Applied,
  type AuthorityAcquired,
  type CredentialFailureCause,
  type MutationAttempt,
  type MutationDecision,
  type Observation,
  type ObservationClassification,
  type ObservationReport,
  type ProviderDecision,
  type RejectedByProvider,
  type ReleaseReport,
  type ReportConstructionError,
  type SubjectReport
} from "./report.js"
import {
  RecoveryCapabilityProfile,
  isReadConvergenceLagCapable,
  type RecoveryCapabilityProfile as RecoveryCapabilityProfileType
} from "./recovery.js"

export class ReleaseSubjectError
  extends Schema.TaggedErrorClass<ReleaseSubjectError>()("ReleaseSubjectError", {
    subject: SubjectId,
    phase: Schema.Literals(["observe", "mutate"]),
    commitment: Schema.Literals(["before-dispatch", "unknown"]),
    reason: SafeReason
  }) {}

export class ReleaseCoordinatorConstructionError
  extends Schema.TaggedErrorClass<ReleaseCoordinatorConstructionError>()(
    "ReleaseCoordinatorConstructionError",
    { reason: SafeReason }
  ) {}

/** Provider-neutral subject derived from one verified prepared intent. */
export type ReleaseObservationContext =
  | { readonly phase: "pre-mutation" }
  | { readonly phase: "post-mutation", readonly attempt: MutationAttempt }

export interface ReleaseSubject {
  readonly id: SubjectId
  /** Durable provider policy. Coordinator retries are derived only from this value. */
  readonly recovery: RecoveryCapabilityProfileType
  /** Earlier prepared subjects that must converge before this subject may run. */
  readonly prerequisites?: ReadonlyArray<SubjectId>
  readonly observationRequests: readonly [CredentialRequest, ...Array<CredentialRequest>]
  readonly mutationRequest: CredentialRequest
  /** Required by every durable-cas-required recovery profile. Runs before mutation authority acquisition. */
  readonly claimMutation?: (
    decision: MutationDecision
  ) => Effect.Effect<void, ReleaseSubjectError>
  readonly observe: (
    grant: CredentialGrant,
    context: ReleaseObservationContext
  ) => Effect.Effect<Observation, ReleaseSubjectError>
  readonly decide: (observation: Observation) => ProviderDecision
  readonly mutate: (
    decision: MutationDecision,
    grant: MutationCredentialGrant
  ) => Effect.Effect<MutationAttempt, ReleaseSubjectError>
}

export interface ReleaseSubjectsInput {
  /** Local, already-verified prepared identity; always makes the report nonempty. */
  readonly prepared: SubjectId
  /** Dependency-ordered remote subjects. */
  readonly subjects: ReadonlyArray<ReleaseSubject>
}

const constructionFailure = (reason: string | SafeReason): ReleaseCoordinatorConstructionError =>
  new ReleaseCoordinatorConstructionError({
    reason: typeof reason === "string" ? SafeReason.make(reason) : reason
  })

const validateRequestIdentity = (
  subject: ReleaseSubject,
  request: CredentialRequest,
  purpose: "observe" | "mutation"
): void => {
  if (request.subject !== subject.id) {
    throw constructionFailure("A credential request does not match its prepared subject identity.")
  }
  if (purpose === "observe" ? request.purpose !== "observe" : request.purpose === "observe") {
    throw constructionFailure("A credential request is assigned to the wrong authority phase.")
  }
  if (purpose === "mutation" && request.strategy.kind === "anonymous") {
    throw constructionFailure("A mutation credential request cannot use anonymous authority.")
  }
}

const validateInput = (input: ReleaseSubjectsInput): Effect.Effect<void, ReleaseCoordinatorConstructionError> =>
  Effect.try({
    try: () => {
      const identities = new Set<string>([input.prepared])
      for (const subject of input.subjects) {
        if (identities.has(subject.id)) {
          throw constructionFailure("Prepared and remote subject identities must be unique.")
        }
        const prerequisites = new Set<SubjectId>()
        for (const prerequisite of subject.prerequisites ?? []) {
          if (!identities.has(prerequisite)) {
            throw constructionFailure("Every prerequisite must identify the prepared subject or an earlier remote subject.")
          }
          if (prerequisites.has(prerequisite)) {
            throw constructionFailure("A release subject cannot declare the same prerequisite twice.")
          }
          prerequisites.add(prerequisite)
        }
        if (subject.observationRequests.length === 0) {
          throw constructionFailure("Every remote subject requires at least one observation strategy.")
        }
        Schema.decodeUnknownSync(RecoveryCapabilityProfile, { onExcessProperty: "error" })(subject.recovery)
        if (subject.recovery.historyRequirement === "durable-cas-required" && subject.claimMutation === undefined) {
          throw constructionFailure("A durable-cas-required subject has no terminal mutation-claim boundary.")
        }
        subject.observationRequests.forEach((request, index) => {
          validateRequestIdentity(subject, request, "observe")
          if (request.strategy.kind === "anonymous" && index !== 0) {
            throw constructionFailure("Anonymous observation must be the first declared strategy.")
          }
        })
        validateRequestIdentity(subject, subject.mutationRequest, "mutation")
        identities.add(subject.id)
      }
    },
    catch: (cause) => cause instanceof ReleaseCoordinatorConstructionError
      ? cause
      : constructionFailure("The release subject contract is invalid.")
  })

const fromReportResult = <A>(
  result: Result.Result<A, ReportConstructionError>
): Effect.Effect<A, ReleaseCoordinatorConstructionError> => Result.isFailure(result)
  ? Effect.fail(constructionFailure(result.failure.reason))
  : Effect.succeed(result.success)

type ReportableCredentialFailure = CredentialUnavailable | CredentialStrategyUnsupported

// The error contributes only its closed tag. Host error fields, especially
// `reason`, are transient diagnostics and may contain credential material.
const credentialFailureCause = (
  request: CredentialRequest,
  error: ReportableCredentialFailure
): CredentialFailureCause => error._tag === "CredentialUnavailable"
  ? CredentialUnavailableCause.make({
    provider: request.provider,
    purpose: request.purpose,
    strategy: request.strategy.kind
  })
  : CredentialStrategyUnsupportedCause.make({
    provider: request.provider,
    purpose: request.purpose,
    strategy: request.strategy.kind
  })

const unavailableObservation = (
  subject: SubjectId,
  request?: CredentialRequest,
  error?: ReportableCredentialFailure
): InconclusiveObservation =>
  InconclusiveObservation.make({
    subject,
    reason: SafeReason.make("Observation authority or provider read was unavailable."),
    ...(request === undefined || error === undefined ? {} : { cause: credentialFailureCause(request, error) })
  })

const subjectObservationFailure = (
  subject: ReleaseSubject,
  error: ReleaseSubjectError
): Effect.Effect<Observation, ReleaseCoordinatorConstructionError> => error.subject !== subject.id
  ? Effect.fail(constructionFailure("A subject error does not match its prepared subject identity."))
  : Effect.succeed(InconclusiveObservation.make({ subject: subject.id, reason: error.reason }))

const observeOnce = (
  credentials: CredentialProvider["Service"],
  subject: ReleaseSubject,
  request: CredentialRequest,
  context: ReleaseObservationContext
): Effect.Effect<{
  readonly observation: Observation
  readonly authorities: ReadonlyArray<AuthorityAcquired>
}, ReleaseCoordinatorConstructionError> =>
  credentials.acquireForObservation(request).pipe(
    Effect.flatMap((grant) => makeAuthority(request, grant).pipe(
      Effect.flatMap((authority) => subject.observe(grant, context).pipe(
        Effect.catch((error) => subjectObservationFailure(subject, error)),
        Effect.map((observation) => ({ observation, authorities: [authority] }))
      ))
    )),
    Effect.catchTags({
      CredentialUnavailable: (error) => Effect.succeed({
        observation: unavailableObservation(subject.id, request, error), authorities: []
      }),
      CredentialAudienceMismatch: () => Effect.succeed({
        observation: unavailableObservation(subject.id), authorities: []
      }),
      CredentialPurposeMismatch: () => Effect.succeed({
        observation: unavailableObservation(subject.id), authorities: []
      }),
      CredentialStrategyUnsupported: (error) => Effect.succeed({
        observation: unavailableObservation(subject.id, request, error), authorities: []
      }),
      CredentialSubjectMismatch: () => Effect.succeed({
        observation: unavailableObservation(subject.id), authorities: []
      })
    }),
    Effect.flatMap((result) => result.observation.subject === subject.id
      ? Effect.succeed(result)
      : Effect.fail(constructionFailure("An observation does not match its prepared subject identity.")))
  )

const observeTrace = Effect.fn("observeReleaseSubject")(function*(
  credentials: CredentialProvider["Service"],
  subject: ReleaseSubject,
  context: ReleaseObservationContext
) {
  const observations: Array<Observation> = []
  const authorities: Array<AuthorityAcquired> = []
  for (const request of subject.observationRequests) {
    const observed = yield* observeOnce(credentials, subject, request, context)
    let observation = observed.observation
    authorities.push(...observed.authorities)
    const visibilityPendingIsAdmitted = context.phase === "post-mutation" &&
      context.attempt._tag !== "RejectedBeforeDispatch" &&
      context.attempt._tag !== "RejectedByProvider" &&
      isReadConvergenceLagCapable(subject.recovery)
    if (observation._tag === "VisibilityPending" && !visibilityPendingIsAdmitted) {
      observation = InconclusiveObservation.make({
        subject: subject.id,
        reason: SafeReason.make(
          "VisibilityPending was not admitted by a lag-capable same-invocation mutation profile and was treated as inconclusive."
        )
      })
    }
    observations.push(observation)
    if (observation._tag !== "Inconclusive") break
  }
  return {
    observations: observations as [Observation, ...Array<Observation>],
    authorities
  }
})

const retryEligibleObservation = (observation: Observation): boolean =>
  observation._tag === "VisibilityPending" || observation._tag === "Inconclusive"

const retryDelayMs = (
  profile: RecoveryCapabilityProfileType,
  completedAttempts: number
): number => {
  const { baseMs, factor, capMs } = profile.readConvergence.observationRetry.backoff
  const scaled = baseMs * factor ** Math.max(0, completedAttempts - 1)
  return Math.min(capMs, scaled)
}

const observeAfterMutation = Effect.fn("observeReleaseSubjectAfterMutation")(function*(
  credentials: CredentialProvider["Service"],
  subject: ReleaseSubject,
  attempt: MutationAttempt
) {
  const observations: Array<Observation> = []
  const authorities: Array<AuthorityAcquired> = []
  const policy = subject.recovery.readConvergence.observationRetry
  const maxAttempts = attempt._tag === "RejectedBeforeDispatch" ? 1 : policy.maxAttempts
  const startedAt = yield* Clock.currentTimeMillis
  let completedAttempts = 0

  while (completedAttempts < maxAttempts) {
    if (completedAttempts > 0) {
      const delayMs = retryDelayMs(subject.recovery, completedAttempts)
      const now = yield* Clock.currentTimeMillis
      const elapsedMs = Math.max(0, now - startedAt)
      if (elapsedMs + delayMs > policy.totalBudgetMs) break
      yield* Effect.sleep(Duration.millis(delayMs))
    }

    const observed = yield* observeTrace(credentials, subject, { phase: "post-mutation", attempt })
    observations.push(...observed.observations)
    authorities.push(...observed.authorities)
    completedAttempts += 1
    if (!retryEligibleObservation(observed.observations.at(-1)!)) break
  }

  return {
    observations: observations as [Observation, ...Array<Observation>],
    authorities
  }
})

const classifyObservation = (observation: Observation): ObservationClassification => {
  switch (observation._tag) {
    case "PresentEquivalent":
      return equivalentObservation()
    case "PresentDifferent":
      return differentObservation(observation.differences)
    case "AuthoritativelyAbsent":
      return absentObservation(observation.basis)
    case "VisibilityPending":
      return inconclusiveObservation(SafeReason.make("Provider visibility remains pending."))
    case "Inconclusive":
      return inconclusiveObservation(observation.reason, observation.cause)
  }
}

const providerBlockedFromAuthority = (
  subject: SubjectId,
  request: CredentialRequest,
  error: CredentialAuthorityError
): ProviderBlocked => ProviderBlocked.make({
  subject,
  reason: SafeReason.make("Mutation authority was unavailable for the exact prepared request."),
  ...(error._tag === "CredentialUnavailable" || error._tag === "CredentialStrategyUnsupported"
    ? { cause: credentialFailureCause(request, error) }
    : {})
})

const makeAuthority = (
  request: CredentialRequest,
  grant: CredentialGrant
): Effect.Effect<AuthorityAcquired, ReleaseCoordinatorConstructionError> => {
  const purposes = [...grant.purposes]
  if (purposes.length === 0) {
    return Effect.fail(constructionFailure("A credential grant carries no authority purpose."))
  }
  if (grant.subject !== request.subject || grant.provider !== request.provider ||
    grant.audience !== request.audience || !grant.purposes.has(request.purpose)) {
    return Effect.fail(constructionFailure("A credential grant does not match the exact prepared request."))
  }
  return fromReportResult(makeAuthorityAcquired({
    subject: request.subject,
    provider: request.provider,
    audience: request.audience,
    requestedPurpose: request.purpose,
    grantKind: grant._tag,
    purposes: purposes as [typeof purposes[number], ...Array<typeof purposes[number]>]
  }))
}

const decide = (
  subject: ReleaseSubject,
  observation: Observation
): Effect.Effect<ProviderDecision, ReleaseCoordinatorConstructionError> => Effect.try({
  try: () => subject.decide(observation),
  catch: () => constructionFailure("The provider decision function did not return a total decision.")
}).pipe(Effect.flatMap((decision) => decision.subject === subject.id
  ? Effect.succeed(decision)
  : Effect.fail(constructionFailure("A provider decision does not match its prepared subject identity."))))

const performMutation = (
  subject: ReleaseSubject,
  decision: MutationDecision,
  grant: MutationCredentialGrant
): Effect.Effect<MutationAttempt, ReleaseCoordinatorConstructionError> => subject.mutate(decision, grant).pipe(
  Effect.catch((error) => error.subject !== subject.id
    ? Effect.fail(constructionFailure("A mutation error does not match its prepared subject identity."))
    : Effect.succeed(error.commitment === "before-dispatch"
      ? RejectedBeforeDispatch.make({ subject: subject.id, reason: error.reason })
      : OutcomeUnknown.make({ subject: subject.id, reason: error.reason }))),
  Effect.flatMap((attempt) => attempt.subject === subject.id
    ? Effect.succeed(attempt)
    : Effect.fail(constructionFailure("A mutation attempt does not match its prepared subject identity.")))
)

const uncertainAttempt = (
  attempt: Exclude<MutationAttempt, RejectedBeforeDispatch>
): Started | Applied | OutcomeUnknown | RejectedByProvider => attempt

const convergedAttempt = (
  attempt: MutationAttempt
): Applied | OutcomeUnknown | RejectedByProvider => attempt._tag === "Started"
  ? OutcomeUnknown.make({
    subject: attempt.subject,
    reason: SafeReason.make("Mutation started without a terminal provider response before reobservation.")
  })
  : attempt as Applied | OutcomeUnknown | RejectedByProvider

const publishSubject = Effect.fn("publishReleaseSubject")(function*(
  credentials: CredentialProvider["Service"],
  subject: ReleaseSubject
) {
  const before = yield* observeTrace(credentials, subject, { phase: "pre-mutation" })
  const decision = yield* decide(subject, before.observations.at(-1)!)
  switch (decision._tag) {
    case "AlreadyEquivalent":
      return yield* fromReportResult(makeAlreadyEquivalent(
        subject.id,
        before.observations,
        before.authorities
      ))
    case "Conflict":
    case "Blocked":
      return yield* fromReportResult(makeBlockedSubject({
        subject: subject.id,
        observationAuthorities: before.authorities,
        observations: before.observations,
        cause: decision
      }))
    case "NeedsMutation":
    case "ProviderAuthorizedCreate": {
      if (subject.claimMutation !== undefined) {
        const claimed = yield* Effect.exit(subject.claimMutation(decision))
        if (Exit.isFailure(claimed)) {
          return yield* fromReportResult(makeBlockedSubject({
            subject: subject.id,
            observationAuthorities: before.authorities,
            observations: before.observations,
            cause: ProviderBlocked.make({
              subject: subject.id,
              reason: SafeReason.make("The terminal publication claim was unavailable or already occupied.")
            })
          }))
        }
      }
      const acquisition = yield* credentials.acquireForMutation(subject.mutationRequest, decision).pipe(
        Effect.map((grant) => ({ _tag: "Granted", grant } as const)),
        Effect.catch((error) => Effect.succeed({ _tag: "Denied", error } as const))
      )
      if (acquisition._tag === "Denied") {
        return yield* fromReportResult(makeBlockedSubject({
          subject: subject.id,
          observationAuthorities: before.authorities,
          observations: before.observations,
          cause: providerBlockedFromAuthority(subject.id, subject.mutationRequest, acquisition.error)
        }))
      }
      const grant = acquisition.grant
      const authority = yield* makeAuthority(subject.mutationRequest, grant)
      const attempt = yield* performMutation(subject, decision, grant)
      const after = yield* observeAfterMutation(credentials, subject, attempt)
      const observationAuthorities = [...before.authorities, ...after.authorities]
      if (attempt._tag === "RejectedBeforeDispatch") {
        const cause = yield* fromReportResult(makeAuthorityAcquiredButMutationNotDispatched({
          subject: subject.id,
          authority,
          attempt
        }))
        return yield* fromReportResult(makeBlockedSubject({
          subject: subject.id,
          observationAuthorities,
          observations: [...before.observations, ...after.observations],
          cause
        }))
      }
      if (after.observations.at(-1)?._tag === "PresentEquivalent") {
        return yield* fromReportResult(makeConvergedAfterMutation({
          subject: subject.id,
          observationAuthorities,
          preObservations: before.observations,
          decision,
          authority,
          attempt: convergedAttempt(attempt),
          postObservations: after.observations
        }))
      }
      if (attempt._tag === "RejectedByProvider" &&
        after.observations.at(-1)?._tag !== "Inconclusive" &&
        after.observations.at(-1)?._tag !== "VisibilityPending") {
        return yield* fromReportResult(makeBlockedSubject({
          subject: subject.id,
          observationAuthorities,
          observations: before.observations,
          cause: ConclusiveProviderRejection.make({
            subject: subject.id,
            fact: attempt.fact,
            postObservations: after.observations
          })
        }))
      }
      return yield* fromReportResult(makeUncertainSubject({
        subject: subject.id,
        observationAuthorities,
        observations: before.observations,
        decision,
        authority,
        attempt: uncertainAttempt(attempt),
        trace: after.observations
      }))
    }
  }
})

/** Read-only projection. It never asks for publish or correction authority. */
export const observeReleaseSubjects = Effect.fn("observeReleaseSubjects")(function*(
  input: ReleaseSubjectsInput
): Effect.fn.Return<ObservationReport, ReleaseCoordinatorConstructionError, CredentialProvider> {
  yield* validateInput(input)
  const credentials = yield* CredentialProvider
  const observed: [ObservedSubject, ...Array<ObservedSubject>] = [
    new ObservedSubject({
      subject: input.prepared,
      observationAuthorities: [],
      observation: equivalentObservation()
    })
  ]
  for (const subject of input.subjects) {
    const trace = yield* observeTrace(credentials, subject, { phase: "pre-mutation" })
    observed.push(new ObservedSubject({
      subject: subject.id,
      observationAuthorities: trace.authorities,
      observation: classifyObservation(trace.observations.at(-1)!)
    }))
  }
  return makeObservationReport(observed)
})

/** Dependency-ordered observation, lazy authority, mutation, and reobservation. */
export const publishReleaseSubjects = Effect.fn("publishReleaseSubjects")(function*(
  input: ReleaseSubjectsInput
): Effect.fn.Return<ReleaseReport, ReleaseCoordinatorConstructionError, CredentialProvider> {
  yield* validateInput(input)
  const credentials = yield* CredentialProvider
  const localObservation = PresentEquivalent.make({ subject: input.prepared })
  const local = yield* fromReportResult(makeAlreadyEquivalent(input.prepared, [localObservation], []))
  const reports: [SubjectReport, ...Array<SubjectReport>] = [local]
  const converged = new Map<SubjectId, boolean>([[input.prepared, true]])
  for (const subject of input.subjects) {
    const prerequisite = (subject.prerequisites ?? []).find((candidate) => converged.get(candidate) !== true)
    if (prerequisite !== undefined) {
      reports.push(yield* fromReportResult(makeNotReached(
        subject.id,
        new DependencyBlocked({ prerequisite })
      )))
      converged.set(subject.id, false)
      continue
    }
    const report = yield* publishSubject(credentials, subject)
    reports.push(report)
    converged.set(
      subject.id,
      report._tag === "AlreadyEquivalent" || report._tag === "ConvergedAfterMutation"
    )
  }
  return makeReleaseReport(reports)
})
