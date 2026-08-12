import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
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
  publishReleaseSubjects,
  type ReleaseObservationContext,
  type ReleaseSubject
} from "../../src/publication/coordinator.js"
import {
  AbsenceBasis,
  Applied,
  AuthoritativelyAbsent,
  CreateAuthorizationProof,
  PresentEquivalent,
  ProviderAuthorizedCreate,
  ProviderMutationFact,
  SafeReason,
  type Observation
} from "../../src/publication/report.js"
import { conservativeUnknownRecoveryProfile } from "../../src/publication/recovery.js"

const prepared = SubjectId.make("prepared:plan224-first-create")
const subjectId = SubjectId.make("npm:@fixture/first-create@1.0.0")
const provider = ProviderId.make("npm")
const audience = CanonicalAudience.make("https://registry.npmjs.org/")
const credential = CredentialRef.make("FIXTURE_PUBLISH_TOKEN")

const observationRequest = CredentialRequest.make({
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

test("ProviderAuthorizedCreate acquires mutation authority lazily once and preserves its proof through reobservation", async () => {
  const events: Array<string> = []
  const observations: ReadonlyArray<Observation> = [
    AuthoritativelyAbsent.make({
      subject: subjectId,
      basis: AbsenceBasis.make({
        kind: NonEmptyName.make("provider-authorized-namespace"),
        detail: SafeReason.make("The provider authorized creation in the prepared namespace.")
      })
    }),
    PresentEquivalent.make({ subject: subjectId })
  ]
  let observationIndex = 0

  const subject: ReleaseSubject = {
    id: subjectId,
    recovery: conservativeUnknownRecoveryProfile,
    observationRequests: [observationRequest],
    mutationRequest,
    observe: (grant, context: ReleaseObservationContext) => Effect.sync(() => {
      const observation = observations[observationIndex++]
      if (observation === undefined) throw new Error("Unexpected extra observation.")
      events.push(`observe:${context.phase}:${grant._tag}:${observation._tag}`)
      return observation
    }),
    decide: (observation) => {
      events.push(`decide:${observation._tag}`)
      return ProviderAuthorizedCreate.make({
        subject: subjectId,
        proof: CreateAuthorizationProof.make({ kind: NonEmptyName.make("provider-authorized-namespace") })
      })
    },
    mutate: (decision, grant) => Effect.sync(() => {
      events.push(`mutate:${decision._tag}:${grant._tag}`)
      return Applied.make({
        subject: subjectId,
        fact: ProviderMutationFact.make({
          subject: subjectId,
          detail: SafeReason.make("The provider accepted the exact create operation.")
        })
      })
    })
  }

  const credentials = makeCredentialProvider({
    acquire: (request) => Effect.sync(() => {
      events.push(`authority:${request.purpose}:${request.strategy.kind}`)
      return request.strategy.kind === "token"
        ? { _tag: "ScopedSecret", purposes: ["publish"] as const, ref: request.strategy.credential }
        : { _tag: "AnonymousAccess", purposes: ["observe"] as const }
    })
  })

  const report = await Effect.runPromise(publishReleaseSubjects({
    prepared,
    subjects: [subject]
  }).pipe(Effect.provideService(CredentialProvider, credentials)))

  expect(events).toEqual([
    "authority:observe:anonymous",
    "observe:pre-mutation:AnonymousAccess:AuthoritativelyAbsent",
    "decide:AuthoritativelyAbsent",
    "authority:publish:token",
    "mutate:ProviderAuthorizedCreate:ScopedSecret",
    "authority:observe:anonymous",
    "observe:post-mutation:AnonymousAccess:PresentEquivalent"
  ])
  expect(events.filter((event) => event.startsWith("authority:publish:"))).toHaveLength(1)
  expect(events.filter((event) => event.startsWith("mutate:"))).toHaveLength(1)
  expect(observationIndex).toBe(2)

  const remote = report.subjects[1]
  expect(remote?._tag).toBe("ConvergedAfterMutation")
  if (remote?._tag !== "ConvergedAfterMutation") throw new Error("Expected convergence.")
  expect(remote.decision).toMatchObject({
    _tag: "ProviderAuthorizedCreate",
    subject: subjectId,
    proof: { kind: "provider-authorized-namespace" }
  })
  expect(remote.attempt).toMatchObject({ _tag: "Applied", subject: subjectId })
  expect(remote.postObservations).toEqual([{ _tag: "PresentEquivalent", subject: subjectId }])
})
