import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  EnvironmentName,
  ProviderId,
  SubjectId,
  TokenAuthStrategy,
  type CredentialPurpose
} from "../../src/model/authority.js"
import { NonEmptyName } from "../../src/model/primitives.js"
import {
  CredentialProvider,
  CredentialStrategyUnsupported,
  CredentialUnavailable,
  makeCredentialProvider,
  type CredentialGrantDescriptor
} from "../../src/publication/authority.js"
import {
  ReleaseCoordinatorConstructionError,
  observeReleaseSubjects,
  publishReleaseSubjects,
  type ReleaseObservationContext,
  type ReleaseSubject
} from "../../src/publication/coordinator.js"
import {
  AbsenceBasis,
  Applied,
  AuthoritativelyAbsent,
  Conflict,
  Difference,
  InconclusiveObservation,
  MutationPrecondition,
  NeedsMutation,
  ObservationReport,
  PresentDifferent,
  PresentEquivalent,
  ProviderAlreadyEquivalent,
  ProviderBlocked,
  ProviderMutationFact,
  RejectedBeforeDispatch,
  ReleaseReport,
  SafeReason,
  VisibilityBasis,
  VisibilityPending,
  type MutationAttempt,
  type Observation,
  type ProviderDecision
} from "../../src/publication/report.js"
import { conservativeUnknownRecoveryProfile } from "../../src/publication/recovery.js"

const prepared = SubjectId.make("prepared:fixture")
const first = SubjectId.make("npm:@fixture/first@1.0.0")
const second = SubjectId.make("github:fixture/second@1.0.0")
const third = SubjectId.make("catalog:fixture/third@1.0.0")
const provider = ProviderId.make("fixture-provider")
const audience = CanonicalAudience.make("https://provider.example.test/api/")
const publicProvider = ProviderId.make("fixture-public-provider")
const publicAudience = CanonicalAudience.make("https://public.example.test/metadata/")
const readRef = CredentialRef.make("FIXTURE_READ_TOKEN")
const mutationRef = CredentialRef.make("FIXTURE_PUBLISH_TOKEN")
const workloadName = EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_URL")
const unsafeCredentialReason = "npm_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL"

const anonymousRequest = (
  subject: SubjectId,
  requestProvider = provider,
  requestAudience = audience
): CredentialRequest => CredentialRequest.make({
  subject,
  provider: requestProvider,
  audience: requestAudience,
  purpose: "observe",
  strategy: AnonymousAuthStrategy.make({ kind: "anonymous" })
})

const tokenRequest = (
  subject: SubjectId,
  purpose: "observe" | "publish" | "correct"
): CredentialRequest => CredentialRequest.make({
  subject,
  provider,
  audience,
  purpose,
  strategy: TokenAuthStrategy.make({
    kind: "token",
    credential: purpose === "observe" ? readRef : mutationRef
  })
})

const equivalent = (subject: SubjectId): Observation => PresentEquivalent.make({ subject })
const inconclusive = (subject: SubjectId, reason = "read unavailable"): Observation =>
  InconclusiveObservation.make({ subject, reason: SafeReason.make(reason) })
const absent = (subject: SubjectId): Observation => AuthoritativelyAbsent.make({
  subject,
  basis: AbsenceBasis.make({
    kind: NonEmptyName.make("authenticated-not-found"),
    detail: SafeReason.make("The exact prepared identity is absent.")
  })
})
const different = (subject: SubjectId): Observation => PresentDifferent.make({
  subject,
  differences: [Difference.make({
    field: NonEmptyName.make("digest"),
    expected: SafeReason.make("prepared digest"),
    observed: SafeReason.make("provider digest")
  })]
})
const pending = (subject: SubjectId): Observation => VisibilityPending.make({
  subject,
  expectation: SafeReason.make("The mutation should become visible."),
  basis: VisibilityBasis.make({
    kind: NonEmptyName.make("provider-lag"),
    detail: SafeReason.make("The provider has not converged yet.")
  })
})

const alreadyEquivalent = (subject: SubjectId): ProviderDecision =>
  ProviderAlreadyEquivalent.make({ subject })
const needsMutation = (subject: SubjectId): ProviderDecision => NeedsMutation.make({
  subject,
  precondition: MutationPrecondition.make({ kind: NonEmptyName.make("exact-identity-absent") })
})
const blocked = (subject: SubjectId): ProviderDecision => ProviderBlocked.make({
  subject,
  reason: SafeReason.make("Observation cannot safely authorize mutation.")
})
const conflict = (subject: SubjectId): ProviderDecision => Conflict.make({
  subject,
  differences: [Difference.make({
    field: NonEmptyName.make("digest"),
    expected: SafeReason.make("prepared digest"),
    observed: SafeReason.make("provider digest")
  })]
})
const applied = (subject: SubjectId): MutationAttempt => Applied.make({
  subject,
  fact: ProviderMutationFact.make({
    subject,
    detail: SafeReason.make("The provider accepted the exact mutation.")
  })
})

const descriptorFor = (request: CredentialRequest): CredentialGrantDescriptor => {
  const purposes = [request.purpose] as [CredentialPurpose]
  switch (request.strategy.kind) {
    case "anonymous":
      return { _tag: "AnonymousAccess", purposes: ["observe"] }
    case "token":
      return { _tag: "ScopedSecret", purposes, ref: request.strategy.credential }
    case "trusted-publishing":
      return { _tag: "WorkloadIdentity", purposes, names: [workloadName] }
  }
}

const recordingCredentials = (
  events: Array<string>,
  describe: (request: CredentialRequest) => CredentialGrantDescriptor = descriptorFor
) => makeCredentialProvider({
  acquire: (request) => Effect.sync(() => {
    events.push(`${request.subject}:authority:${request.purpose}:${request.strategy.kind}`)
    return describe(request)
  })
})

type ReportableCredentialFailureTag = "CredentialUnavailable" | "CredentialStrategyUnsupported"

const credentialFailure = (
  tag: ReportableCredentialFailureTag,
  request: CredentialRequest
): CredentialUnavailable | CredentialStrategyUnsupported => tag === "CredentialUnavailable"
  ? new CredentialUnavailable({
    subject: request.subject,
    provider: request.provider,
    purpose: request.purpose,
    reason: unsafeCredentialReason
  })
  : new CredentialStrategyUnsupported({
    subject: request.subject,
    provider: request.provider,
    strategy: unsafeCredentialReason,
    reason: unsafeCredentialReason
  })

const rejectingCredentials = (
  events: Array<string>,
  rejectedPurpose: CredentialPurpose,
  tag: ReportableCredentialFailureTag
) => makeCredentialProvider({
  acquire: (request) => {
    events.push(`${request.subject}:authority:${request.purpose}:${request.strategy.kind}`)
    return request.purpose === rejectedPurpose
      ? Effect.fail(credentialFailure(tag, request))
      : Effect.succeed(descriptorFor(request))
  }
})

const run = <A, E>(
  effect: Effect.Effect<A, E, CredentialProvider>,
  events: Array<string>,
  describe?: (request: CredentialRequest) => CredentialGrantDescriptor
): Promise<A> => Effect.runPromise(effect.pipe(
  Effect.provideService(CredentialProvider, recordingCredentials(events, describe))
))

interface ScriptedSubjectOptions {
  readonly id: SubjectId
  readonly events: Array<string>
  readonly observations: ReadonlyArray<Observation>
  readonly decision: (observation: Observation) => ProviderDecision
  readonly attempt?: MutationAttempt
  readonly prerequisites?: ReadonlyArray<SubjectId>
  readonly observationRequests?: readonly [CredentialRequest, ...Array<CredentialRequest>]
  readonly contexts?: Array<ReleaseObservationContext>
}

const scriptedSubject = (options: ScriptedSubjectOptions): ReleaseSubject => {
  let observationIndex = 0
  return {
    id: options.id,
    recovery: conservativeUnknownRecoveryProfile,
    ...(options.prerequisites === undefined ? {} : { prerequisites: options.prerequisites }),
    observationRequests: options.observationRequests ?? [anonymousRequest(options.id)],
    mutationRequest: tokenRequest(options.id, "publish"),
    observe: (grant, context) => Effect.sync(() => {
      options.contexts?.push(context)
      const observation = options.observations[observationIndex++]
      if (observation === undefined) {
        throw new Error(`Missing scripted observation for ${options.id}.`)
      }
      options.events.push(`${options.id}:observe:${grant._tag}:${observation._tag}`)
      return observation
    }),
    decide: (observation) => {
      const decision = options.decision(observation)
      options.events.push(`${options.id}:decide:${observation._tag}:${decision._tag}`)
      return decision
    },
    mutate: (decision, grant) => Effect.sync(() => {
      const attempt = options.attempt ?? applied(options.id)
      options.events.push(`${options.id}:mutate:${decision._tag}:${grant._tag}:${attempt._tag}`)
      return attempt
    })
  }
}

describe("provider-neutral release coordinator", () => {
  test("keeps the verified local prepared subject explicit and reports zero remote subjects", async () => {
    const events: Array<string> = []
    const observation = await run(observeReleaseSubjects({ prepared, subjects: [] }), events)
    const release = await run(publishReleaseSubjects({ prepared, subjects: [] }), events)

    expect(observation).toMatchObject({ status: "equivalent" })
    expect(observation.subjects).toHaveLength(1)
    expect(observation.subjects[0]).toMatchObject({ subject: prepared, observation: { _tag: "Equivalent" } })
    expect(release).toMatchObject({ status: "complete" })
    expect(release.subjects).toHaveLength(1)
    expect(release.subjects[0]).toMatchObject({ subject: prepared, _tag: "AlreadyEquivalent" })
    expect(events).toEqual([])
  })

  test("read-only observation tries declared authority in order and never decides or mutates", async () => {
    const events: Array<string> = []
    const subject = scriptedSubject({
      id: first,
      events,
      observations: [inconclusive(first), equivalent(first)],
      observationRequests: [anonymousRequest(first), tokenRequest(first, "observe")],
      decision: () => { throw new Error("read-only observation must not decide") }
    })

    const report = await run(observeReleaseSubjects({ prepared, subjects: [subject] }), events)

    expect(report.status).toBe("equivalent")
    expect(events).toEqual([
      `${first}:authority:observe:anonymous`,
      `${first}:observe:AnonymousAccess:Inconclusive`,
      `${first}:authority:observe:token`,
      `${first}:observe:ScopedSecret:PresentEquivalent`
    ])
  })

  test.each([
    "CredentialUnavailable",
    "CredentialStrategyUnsupported"
  ] as const)("reports observation acquisition %s as secret-free data", async (tag) => {
    const events: Array<string> = []
    const subject = scriptedSubject({
      id: first,
      events,
      observations: [equivalent(first)],
      observationRequests: [tokenRequest(first, "observe")],
      decision: () => { throw new Error("read-only observation must not decide") }
    })
    const report = await Effect.runPromise(observeReleaseSubjects({ prepared, subjects: [subject] }).pipe(
      Effect.provideService(CredentialProvider, rejectingCredentials(events, "observe", tag))
    ))

    expect(report).toMatchObject({
      status: "inconclusive",
      subjects: [{ observation: { _tag: "Equivalent" } }, {
        observationAuthorities: [],
        observation: {
          _tag: "Inconclusive",
          cause: { _tag: tag, provider, purpose: "observe", strategy: "token" }
        }
      }]
    })
    expect(events).toEqual([`${first}:authority:observe:token`])
    expect(events.some((event) => event.startsWith(`${first}:observe:`) || event.startsWith(`${first}:mutate:`))).toBe(false)
    const encoded = Schema.encodeSync(ObservationReport)(report)
    const decoded = Schema.decodeUnknownSync(ObservationReport)(JSON.parse(JSON.stringify(encoded)))
    expect(decoded.subjects[1]?.observation).toMatchObject({ cause: { _tag: tag } })
    expect(JSON.stringify(encoded)).not.toContain(unsafeCredentialReason)
  })

  test.each([
    "CredentialUnavailable",
    "CredentialStrategyUnsupported"
  ] as const)("reports mutation acquisition %s as blocked data with zero dispatch", async (tag) => {
    const events: Array<string> = []
    const subject = scriptedSubject({
      id: first,
      events,
      observations: [absent(first)],
      decision: () => needsMutation(first)
    })
    const report = await Effect.runPromise(publishReleaseSubjects({ prepared, subjects: [subject] }).pipe(
      Effect.provideService(CredentialProvider, rejectingCredentials(events, "publish", tag))
    ))

    expect(report).toMatchObject({
      status: "blocked",
      subjects: [{ _tag: "AlreadyEquivalent" }, {
        _tag: "BlockedSubject",
        cause: {
          _tag: "Blocked",
          cause: { _tag: tag, provider, purpose: "publish", strategy: "token" }
        }
      }]
    })
    expect(events).toEqual([
      `${first}:authority:observe:anonymous`,
      `${first}:observe:AnonymousAccess:AuthoritativelyAbsent`,
      `${first}:decide:AuthoritativelyAbsent:NeedsMutation`,
      `${first}:authority:publish:token`
    ])
    expect(events.some((event) => event.includes(":mutate:"))).toBe(false)
    const encoded = Schema.encodeSync(ReleaseReport)(report)
    const decoded = Schema.decodeUnknownSync(ReleaseReport)(JSON.parse(JSON.stringify(encoded)))
    expect(decoded.subjects[1]).toMatchObject({ cause: { cause: { _tag: tag } } })
    expect(JSON.stringify(encoded)).not.toContain(unsafeCredentialReason)
  })

  test("equivalent, conflicting, and inconclusive observations acquire no mutation authority", async () => {
    const cases: ReadonlyArray<{
      readonly observation: (subject: SubjectId) => Observation
      readonly decision: (subject: SubjectId) => ProviderDecision
    }> = [
      { observation: equivalent, decision: alreadyEquivalent },
      { observation: different, decision: conflict },
      { observation: inconclusive, decision: blocked }
    ]

    for (const fixture of cases) {
      const events: Array<string> = []
      const subject = scriptedSubject({
        id: first,
        events,
        observations: [fixture.observation(first)],
        decision: () => fixture.decision(first)
      })
      await run(publishReleaseSubjects({ prepared, subjects: [subject] }), events)
      expect(events.some((event) => event.includes(":authority:publish:"))).toBe(false)
      expect(events.some((event) => event.includes(":mutate:"))).toBe(false)
    }
  })

  test("records bundled observation authority without dispatching mutation", async () => {
    const events: Array<string> = []
    const subject = scriptedSubject({
      id: first,
      events,
      observations: [equivalent(first)],
      observationRequests: [tokenRequest(first, "observe")],
      decision: () => alreadyEquivalent(first)
    })
    const report = await run(
      publishReleaseSubjects({ prepared, subjects: [subject] }),
      events,
      (request) => request.purpose === "observe" && request.strategy.kind === "token"
        ? {
          _tag: "ScopedSecret",
          purposes: ["observe", "publish"],
          ref: request.strategy.credential
        }
        : descriptorFor(request)
    )

    expect(report.subjects[1]).toMatchObject({
      _tag: "AlreadyEquivalent",
      observationAuthorities: [{
        requestedPurpose: "observe",
        grantKind: "ScopedSecret",
        purposes: ["observe", "publish"]
      }]
    })
    expect(events.some((event) => event.includes(":authority:publish:"))).toBe(false)
    expect(events.some((event) => event.includes(":mutate:"))).toBe(false)
  })

  test("acquires exact mutation authority lazily and reobserves every mutation result", async () => {
    const events: Array<string> = []
    const contexts: Array<ReleaseObservationContext> = []
    const subject = scriptedSubject({
      id: first,
      events,
      observations: [inconclusive(first), absent(first), inconclusive(first), equivalent(first)],
      observationRequests: [
        anonymousRequest(first, publicProvider, publicAudience),
        tokenRequest(first, "observe")
      ],
      decision: () => needsMutation(first),
      attempt: applied(first),
      contexts
    })

    const report = await run(publishReleaseSubjects({ prepared, subjects: [subject] }), events)

    expect(events).toEqual([
      `${first}:authority:observe:anonymous`,
      `${first}:observe:AnonymousAccess:Inconclusive`,
      `${first}:authority:observe:token`,
      `${first}:observe:ScopedSecret:AuthoritativelyAbsent`,
      `${first}:decide:AuthoritativelyAbsent:NeedsMutation`,
      `${first}:authority:publish:token`,
      `${first}:mutate:NeedsMutation:ScopedSecret:Applied`,
      `${first}:authority:observe:anonymous`,
      `${first}:observe:AnonymousAccess:Inconclusive`,
      `${first}:authority:observe:token`,
      `${first}:observe:ScopedSecret:PresentEquivalent`
    ])
    const remote = report.subjects[1]
    expect(remote?._tag).toBe("ConvergedAfterMutation")
    if (remote?._tag !== "ConvergedAfterMutation") throw new Error("Expected convergence.")
    expect(remote.authority).toMatchObject({
      subject: first,
      provider,
      audience,
      requestedPurpose: "publish",
      grantKind: "ScopedSecret"
    })
    expect(JSON.stringify(remote.authority)).not.toContain(mutationRef)
    expect(contexts.map((context) => context.phase)).toEqual([
      "pre-mutation",
      "pre-mutation",
      "post-mutation",
      "post-mutation"
    ])
    expect(contexts[0]).toEqual({ phase: "pre-mutation" })
    expect(contexts[2]).toMatchObject({ phase: "post-mutation", attempt: { _tag: "Applied" } })
  })

  test("downgrades VisibilityPending before mutation and cannot authorize through it directly", async () => {
    const events: Array<string> = []
    let decisionInput: Observation | undefined
    const subject = scriptedSubject({
      id: first,
      events,
      observations: [pending(first)],
      decision: (observation) => {
        decisionInput = observation
        return blocked(first)
      }
    })

    const report = await run(publishReleaseSubjects({ prepared, subjects: [subject] }), events)

    expect(decisionInput?._tag).toBe("Inconclusive")
    expect(report.subjects[1]).toMatchObject({
      _tag: "BlockedSubject",
      observations: [{ _tag: "Inconclusive" }]
    })
    expect(events.some((event) => event.includes(":authority:publish:"))).toBe(false)
  })

  test("records acquired authority when mutation is rejected before dispatch", async () => {
    const events: Array<string> = []
    const subject = scriptedSubject({
      id: first,
      events,
      observations: [absent(first), different(first)],
      decision: () => needsMutation(first),
      attempt: RejectedBeforeDispatch.make({
        subject: first,
        reason: SafeReason.make("Local dispatch validation rejected the operation.")
      })
    })

    const report = await run(publishReleaseSubjects({ prepared, subjects: [subject] }), events)
    const remote = report.subjects[1]

    expect(remote?._tag).toBe("BlockedSubject")
    if (remote?._tag !== "BlockedSubject") throw new Error("Expected a blocked subject.")
    expect(remote.cause).toMatchObject({
      _tag: "AuthorityAcquiredButMutationNotDispatched",
      authority: { _tag: "AuthorityAcquired", requestedPurpose: "publish" },
      attempt: { _tag: "RejectedBeforeDispatch" }
    })
    expect(events.at(-1)).toBe(`${first}:observe:AnonymousAccess:PresentDifferent`)
  })

  test("retains an applied attempt and full reread trace when convergence is uncertain", async () => {
    const events: Array<string> = []
    const subject = scriptedSubject({
      id: first,
      events,
      observations: [absent(first), inconclusive(first, "provider read timed out")],
      decision: () => needsMutation(first),
      attempt: applied(first)
    })

    const report = await run(publishReleaseSubjects({ prepared, subjects: [subject] }), events)

    expect(report.status).toBe("uncertain")
    expect(report.subjects[1]).toMatchObject({
      _tag: "UncertainSubject",
      attempt: { _tag: "Applied" },
      trace: [{ _tag: "Inconclusive" }]
    })
  })

  test("blocks only declared dependents and still executes independent subjects", async () => {
    const events: Array<string> = []
    const conflicting = scriptedSubject({
      id: first,
      events,
      observations: [different(first)],
      decision: () => conflict(first)
    })
    const independent = scriptedSubject({
      id: second,
      events,
      observations: [equivalent(second)],
      decision: () => alreadyEquivalent(second)
    })
    const dependent = scriptedSubject({
      id: third,
      events,
      prerequisites: [first],
      observations: [equivalent(third)],
      decision: () => alreadyEquivalent(third)
    })

    const report = await run(publishReleaseSubjects({
      prepared,
      subjects: [conflicting, independent, dependent]
    }), events)

    expect(report.subjects.map((subject) => subject._tag)).toEqual([
      "AlreadyEquivalent",
      "BlockedSubject",
      "AlreadyEquivalent",
      "NotReached"
    ])
    expect(report.subjects[3]).toMatchObject({
      subject: third,
      reason: { _tag: "DependencyBlocked", prerequisite: first }
    })
    expect(events.some((event) => event.startsWith(`${second}:observe:`))).toBe(true)
    expect(events.some((event) => event.startsWith(`${third}:`))).toBe(false)
  })

  test("rejects forward prerequisites and invalid report construction as typed coordinator errors", async () => {
    const dependencyEvents: Array<string> = []
    const forwardDependent = scriptedSubject({
      id: first,
      events: dependencyEvents,
      prerequisites: [second],
      observations: [equivalent(first)],
      decision: () => alreadyEquivalent(first)
    })
    const later = scriptedSubject({
      id: second,
      events: dependencyEvents,
      observations: [equivalent(second)],
      decision: () => alreadyEquivalent(second)
    })

    await expect(run(publishReleaseSubjects({
      prepared,
      subjects: [forwardDependent, later]
    }), dependencyEvents)).rejects.toBeInstanceOf(ReleaseCoordinatorConstructionError)
    expect(dependencyEvents).toEqual([])

    const reportEvents: Array<string> = []
    const contradictory = scriptedSubject({
      id: first,
      events: reportEvents,
      observations: [absent(first)],
      decision: () => alreadyEquivalent(first)
    })
    await expect(run(publishReleaseSubjects({
      prepared,
      subjects: [contradictory]
    }), reportEvents)).rejects.toBeInstanceOf(ReleaseCoordinatorConstructionError)
    expect(reportEvents.some((event) => event.includes(":authority:publish:"))).toBe(false)
  })
})
