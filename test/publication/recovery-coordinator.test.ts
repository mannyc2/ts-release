import { describe, expect, it } from "@effect/bun-test"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Schema from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  ProviderId,
  SubjectId,
  TokenAuthStrategy
} from "../../src/model/authority.js"
import { NonEmptyName } from "../../src/model/primitives.js"
import {
  CredentialProvider,
  makeCredentialProvider
} from "../../src/publication/authority.js"
import {
  ReleaseCoordinatorConstructionError,
  publishReleaseSubjects,
  type ReleaseObservationContext,
  type ReleaseSubject
} from "../../src/publication/coordinator.js"
import {
  AbsenceBasis,
  Applied,
  AuthoritativelyAbsent,
  Difference,
  InconclusiveObservation,
  MutationPrecondition,
  NeedsMutation,
  PresentDifferent,
  PresentEquivalent,
  ProviderBlocked,
  ProviderMutationFact,
  ProviderRejectionFact,
  RejectedByProvider,
  ReleaseReport,
  SafeReason,
  VisibilityBasis,
  VisibilityPending,
  type MutationAttempt,
  type Observation,
  type ProviderDecision
} from "../../src/publication/report.js"
import {
  conservativeUnknownRecoveryProfile,
  makeRecoveryCapabilityProfile,
  type RecoveryCapabilityProfile
} from "../../src/publication/recovery.js"

const prepared = SubjectId.make("prepared:recovery-fixture")
const subjectId = SubjectId.make("provider:recovery-fixture@1.0.0")
const provider = ProviderId.make("recovery-fixture")
const audience = CanonicalAudience.make("https://provider.example.test/api/")
const credential = CredentialRef.make("RECOVERY_FIXTURE_TOKEN")

const observeRequest = CredentialRequest.make({
  subject: subjectId,
  provider,
  audience,
  purpose: "observe",
  strategy: AnonymousAuthStrategy.make({ kind: "anonymous" })
})

const mutationRequest = CredentialRequest.make({
  subject: subjectId,
  provider,
  audience,
  purpose: "publish",
  strategy: TokenAuthStrategy.make({ kind: "token", credential })
})

const authenticatedObserveRequest = CredentialRequest.make({
  subject: subjectId,
  provider,
  audience,
  purpose: "observe",
  strategy: TokenAuthStrategy.make({ kind: "token", credential })
})

const credentials = makeCredentialProvider({
  acquire: (request) => Effect.succeed(request.strategy.kind === "anonymous"
    ? { _tag: "AnonymousAccess", purposes: ["observe"] as const }
    : { _tag: "ScopedSecret", purposes: [request.purpose] as const, ref: credential })
})

const assumedRecovery = (options: {
  readonly maxAttempts: number
  readonly baseMs?: number
  readonly factor?: number
  readonly capMs?: number
  readonly totalBudgetMs: number
}): RecoveryCapabilityProfile => makeRecoveryCapabilityProfile({
  observation: "exact",
  authoritativeAbsence: "proved",
  createAuthorization: "none",
  replay: "coordinate-unique",
  identifierReuse: "not-applicable",
  correction: [],
  exposure: "persistent-to-consumers",
  historyRequirement: "optional-evidence",
  readConvergence: {
    contract: {
      _tag: "assumed",
      basis: "ASSUMED/UNVERIFIED deterministic test timing."
    },
    observationRetry: {
      maxAttempts: options.maxAttempts,
      backoff: {
        baseMs: options.baseMs ?? 10,
        factor: options.factor ?? 2,
        capMs: options.capMs ?? 20
      },
      totalBudgetMs: options.totalBudgetMs
    },
    retryEligible: "VisibilityPending | Inconclusive",
    exhaustion: "UncertainSubject with full trace"
  }
})

const absent = (): Observation => AuthoritativelyAbsent.make({
  subject: subjectId,
  basis: AbsenceBasis.make({
    kind: NonEmptyName.make("exact-coordinate-absent"),
    detail: SafeReason.make("The exact prepared coordinate is absent.")
  })
})

const pending = (): Observation => VisibilityPending.make({
  subject: subjectId,
  expectation: SafeReason.make("The exact mutation should become visible."),
  basis: VisibilityBasis.make({
    kind: NonEmptyName.make("provider-read-lag"),
    detail: SafeReason.make("The lag-capable endpoint has not converged yet.")
  })
})

const inconclusive = (): Observation => InconclusiveObservation.make({
  subject: subjectId,
  reason: SafeReason.make("The provider read did not establish a conclusive fact.")
})

const equivalent = (): Observation => PresentEquivalent.make({ subject: subjectId })

const different = (): Observation => PresentDifferent.make({
  subject: subjectId,
  differences: [Difference.make({
    field: NonEmptyName.make("digest"),
    expected: SafeReason.make("prepared digest"),
    observed: SafeReason.make("provider digest")
  })]
})

const needsMutation = (): ProviderDecision => NeedsMutation.make({
  subject: subjectId,
  precondition: MutationPrecondition.make({ kind: NonEmptyName.make("exact-coordinate-absent") })
})

const applied = (): MutationAttempt => Applied.make({
  subject: subjectId,
  fact: ProviderMutationFact.make({
    subject: subjectId,
    detail: SafeReason.make("The provider accepted the exact mutation.")
  })
})

interface ScriptedSubjectOptions {
  readonly recovery: RecoveryCapabilityProfile
  readonly observations: ReadonlyArray<Observation>
  readonly attempt?: MutationAttempt
  readonly decision?: (observation: Observation) => ProviderDecision
  readonly observationRequests?: readonly [CredentialRequest, ...Array<CredentialRequest>]
  readonly events: Array<string>
  readonly contexts?: Array<ReleaseObservationContext>
}

const scriptedSubject = (options: ScriptedSubjectOptions): ReleaseSubject => {
  let observationIndex = 0
  return {
    id: subjectId,
    recovery: options.recovery,
    observationRequests: options.observationRequests ?? [observeRequest],
    mutationRequest,
    observe: (grant, context) => Effect.sync(() => {
      const observation = options.observations[observationIndex++]
      if (observation === undefined) throw new Error("The recovery fixture was observed too many times.")
      options.contexts?.push(context)
      options.events.push(`observe:${context.phase}:${grant._tag}:${observation._tag}`)
      return observation
    }),
    decide: (observation) => {
      const decision = options.decision?.(observation) ?? needsMutation()
      options.events.push(`decide:${observation._tag}:${decision._tag}`)
      return decision
    },
    mutate: () => Effect.sync(() => {
      const attempt = options.attempt ?? applied()
      options.events.push(`mutate:${attempt._tag}`)
      return attempt
    })
  }
}

const publish = (subject: ReleaseSubject) => publishReleaseSubjects({
  prepared,
  subjects: [subject]
}).pipe(Effect.provideService(CredentialProvider, credentials))

describe("bounded post-mutation observation convergence", () => {
  it.effect("converges VisibilityPending on the next full observation cycle without repeating decision or mutation", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const contexts: Array<ReleaseObservationContext> = []
      const subject = scriptedSubject({
        recovery: assumedRecovery({ maxAttempts: 3, totalBudgetMs: 100 }),
        observations: [
          inconclusive(), absent(),
          inconclusive(), pending(),
          inconclusive(), equivalent()
        ],
        observationRequests: [observeRequest, authenticatedObserveRequest],
        events,
        contexts
      })

      const fiber = yield* publish(subject).pipe(Effect.forkChild)
      yield* TestClock.adjust(Duration.millis(10))
      const report = yield* Fiber.join(fiber)

      expect(report.status).toBe("complete")
      expect(report.subjects[1]).toMatchObject({
        _tag: "ConvergedAfterMutation",
        postObservations: [
          { _tag: "Inconclusive" },
          { _tag: "VisibilityPending" },
          { _tag: "Inconclusive" },
          { _tag: "PresentEquivalent" }
        ]
      })
      if (report.subjects[1]?._tag !== "ConvergedAfterMutation") throw new Error("Expected convergence.")
      expect(report.subjects[1].observationAuthorities).toHaveLength(6)
      expect(events.filter((event) => event.startsWith("observe:post-mutation"))).toEqual([
        "observe:post-mutation:AnonymousAccess:Inconclusive",
        "observe:post-mutation:ScopedSecret:VisibilityPending",
        "observe:post-mutation:AnonymousAccess:Inconclusive",
        "observe:post-mutation:ScopedSecret:PresentEquivalent"
      ])
      expect(events.filter((event) => event.startsWith("mutate:"))).toHaveLength(1)
      expect(events.filter((event) => event.startsWith("decide:"))).toHaveLength(1)
      expect(contexts.map(({ phase }) => phase)).toEqual([
        "pre-mutation",
        "pre-mutation",
        "post-mutation",
        "post-mutation",
        "post-mutation",
        "post-mutation"
      ])
    }))

  it.effect("converges an inconclusive confirming read on the next bounded cycle", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const subject = scriptedSubject({
        recovery: assumedRecovery({ maxAttempts: 2, totalBudgetMs: 100 }),
        observations: [absent(), inconclusive(), equivalent()],
        events
      })

      const fiber = yield* publish(subject).pipe(Effect.forkChild)
      yield* TestClock.adjust(Duration.millis(10))
      const report = yield* Fiber.join(fiber)

      expect(report.subjects[1]).toMatchObject({
        _tag: "ConvergedAfterMutation",
        postObservations: [{ _tag: "Inconclusive" }, { _tag: "PresentEquivalent" }]
      })
      expect(events.filter((event) => event.startsWith("mutate:"))).toHaveLength(1)
    }))

  it.effect("exhausts maxAttempts into UncertainSubject with the complete ordered trace", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const subject = scriptedSubject({
        recovery: assumedRecovery({ maxAttempts: 3, totalBudgetMs: 100 }),
        observations: [absent(), pending(), inconclusive(), pending()],
        events
      })

      const fiber = yield* publish(subject).pipe(Effect.forkChild)
      yield* TestClock.adjust(Duration.millis(30))
      const report = yield* Fiber.join(fiber)

      expect(report.status).toBe("uncertain")
      expect(report.subjects[1]).toMatchObject({
        _tag: "UncertainSubject",
        trace: [
          { _tag: "VisibilityPending" },
          { _tag: "Inconclusive" },
          { _tag: "VisibilityPending" }
        ]
      })
      expect(events.filter((event) => event.startsWith("observe:post-mutation"))).toHaveLength(3)
      expect(events.filter((event) => event.startsWith("mutate:"))).toHaveLength(1)
    }))

  it.effect("checks the total budget before sleeping and preserves every completed attempt", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const subject = scriptedSubject({
        recovery: assumedRecovery({
          maxAttempts: 4,
          baseMs: 10,
          factor: 2,
          capMs: 20,
          totalBudgetMs: 15
        }),
        observations: [absent(), pending(), pending()],
        events
      })

      const fiber = yield* publish(subject).pipe(Effect.forkChild)
      yield* TestClock.adjust(Duration.millis(10))
      const report = yield* Fiber.join(fiber)

      expect(report.subjects[1]).toMatchObject({
        _tag: "UncertainSubject",
        trace: [{ _tag: "VisibilityPending" }, { _tag: "VisibilityPending" }]
      })
      expect(events.filter((event) => event.startsWith("observe:post-mutation"))).toHaveLength(2)
      expect(events.filter((event) => event.startsWith("mutate:"))).toHaveLength(1)
    }))

  it.effect("stops immediately on a conclusive different fact", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const subject = scriptedSubject({
        recovery: assumedRecovery({ maxAttempts: 5, totalBudgetMs: 100 }),
        observations: [absent(), different()],
        events
      })

      const report = yield* publish(subject)

      expect(report.subjects[1]).toMatchObject({
        _tag: "UncertainSubject",
        trace: [{ _tag: "PresentDifferent" }]
      })
      expect(events.filter((event) => event.startsWith("observe:post-mutation"))).toHaveLength(1)
      expect(events.filter((event) => event.startsWith("mutate:"))).toHaveLength(1)
    }))

  it.effect("stops immediately when the exact coordinate remains authoritatively absent", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const subject = scriptedSubject({
        recovery: assumedRecovery({ maxAttempts: 5, totalBudgetMs: 100 }),
        observations: [absent(), absent()],
        events
      })

      const report = yield* publish(subject)

      expect(report.subjects[1]).toMatchObject({
        _tag: "UncertainSubject",
        trace: [{ _tag: "AuthoritativelyAbsent" }]
      })
      expect(events.filter((event) => event.startsWith("observe:post-mutation"))).toHaveLength(1)
      expect(events.filter((event) => event.startsWith("mutate:"))).toHaveLength(1)
    }))

  it.effect("never retries a pre-mutation inconclusive fact or repeats a provider decision", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const subject = scriptedSubject({
        recovery: assumedRecovery({ maxAttempts: 5, totalBudgetMs: 100 }),
        observations: [inconclusive()],
        decision: () => ProviderBlocked.make({
          subject: subjectId,
          reason: SafeReason.make("The pre-mutation observation is inconclusive.")
        }),
        events
      })

      const report = yield* publish(subject)

      expect(report.status).toBe("blocked")
      expect(events).toEqual([
        "observe:pre-mutation:AnonymousAccess:Inconclusive",
        "decide:Inconclusive:Blocked"
      ])
    }))

  it.effect("preserves RejectedByProvider truthfully when confirming reads remain inconclusive", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const rejection = RejectedByProvider.make({
        subject: subjectId,
        fact: ProviderRejectionFact.make({
          subject: subjectId,
          code: NonEmptyName.make("documented-provider-rejection"),
          detail: SafeReason.make("The provider conclusively rejected this request.")
        })
      })
      const subject = scriptedSubject({
        recovery: assumedRecovery({ maxAttempts: 2, totalBudgetMs: 100 }),
        observations: [absent(), pending(), inconclusive()],
        attempt: rejection,
        events
      })

      const fiber = yield* publish(subject).pipe(Effect.forkChild)
      yield* TestClock.adjust(Duration.millis(10))
      const report = yield* Fiber.join(fiber)

      expect(report.subjects[1]).toMatchObject({
        _tag: "UncertainSubject",
        attempt: { _tag: "RejectedByProvider" },
        trace: [{ _tag: "Inconclusive" }, { _tag: "Inconclusive" }]
      })
      expect(JSON.stringify(report)).not.toContain('"_tag":"Started"')
      const encoded = Schema.encodeSync(ReleaseReport)(report)
      expect(Schema.decodeUnknownSync(ReleaseReport)(encoded).subjects[1]).toMatchObject({
        _tag: "UncertainSubject",
        attempt: { _tag: "RejectedByProvider" }
      })
    }))

  it.effect("admits VisibilityPending only for a lag-capable same-invocation mutation profile", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const subject = scriptedSubject({
        recovery: conservativeUnknownRecoveryProfile,
        observations: [absent(), pending()],
        events
      })

      const report = yield* publish(subject)

      expect(report.subjects[1]).toMatchObject({
        _tag: "UncertainSubject",
        trace: [{ _tag: "Inconclusive" }]
      })
      expect(events.filter((event) => event.startsWith("observe:post-mutation"))).toHaveLength(1)
    }))

  it.effect("rejects a malformed required profile before authority, observation, decision, or mutation", () =>
    Effect.gen(function*() {
      const events: Array<string> = []
      const subject = scriptedSubject({
        recovery: {
          ...conservativeUnknownRecoveryProfile,
          readConvergence: {
            ...conservativeUnknownRecoveryProfile.readConvergence,
            observationRetry: {
              maxAttempts: 2,
              backoff: { baseMs: 10, factor: 2, capMs: 20 },
              totalBudgetMs: 100
            }
          }
        } as RecoveryCapabilityProfile,
        observations: [absent()],
        events
      })

      const error = yield* publish(subject).pipe(Effect.flip)

      expect(error).toBeInstanceOf(ReleaseCoordinatorConstructionError)
      expect(events).toEqual([])
    }))
})
