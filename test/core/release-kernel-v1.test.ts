import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  ArtifactBundleError,
  ArtifactId,
  ArtifactRef,
  adoptArtifactBundle,
  decodeArtifactBundleManifest,
  encodeArtifactBundleManifest,
  loadArtifactBundle
} from "../../src/release/artifact-bundle.js"
import {
  ReleasePlanError,
  PlanId,
  PlannedOperationV1,
  decodeProviderIntent,
  decodeReleasePlan,
  deriveOperationKey,
  encodeProviderIntent,
  encodeReleasePlan,
  makeReleasePlan
} from "../../src/release/release-plan.js"
import {
  AuthorizationIdentity,
  DispatchId,
  DispatchStarted,
  EndpointIdentity,
  JournalEntry,
  JournalEvent,
  ObservationRecorded,
  PlanSuperseded,
  ReceiptAccepted,
  ReleaseJournal,
  RequestFingerprint,
  TransportId
} from "../../src/release/journal.js"
import {
  ObservationClassifier,
  OperationObservationConcluded,
  OperationReceiptAccepted,
  OperationReconciliationRequired,
  deriveReleaseReport
} from "../../src/release/release-report.js"

class FixtureIntent extends Schema.TaggedClass<FixtureIntent>()("FixtureIntent", {
  schemaVersion: Schema.Literal("fixture-intent/v1"),
  artifact: ArtifactRef,
  endpoint: Schema.NonEmptyString
}) {}

const FixtureDefinition = Object.freeze({
  definitionId: "fixture.example/publish/1",
  intentSchemaVersion: "fixture-intent/v1",
  intentSchema: FixtureIntent
})

const bytes = new Uint8Array([1, 2, 3, 4])
const alpha = ArtifactId.make("alpha")
const beta = ArtifactId.make("beta")

const dispatchId = DispatchId.make("dispatch-1")
const supersedingPlanId = PlanId.make("f".repeat(64))

const journalFrom = (planId: PlanId, events: ReadonlyArray<JournalEvent>): ReleaseJournal =>
  ReleaseJournal.make({
    schemaVersion: 1,
    planId,
    revision: events.length,
    entries: events.map((event, index) => JournalEntry.make({ revision: index + 1, event }))
  })

const started = (
  operation: PlannedOperationV1,
  id = dispatchId,
  attempt = 1
): DispatchStarted => DispatchStarted.make({
  schemaVersion: 1,
  operationId: operation.operationId,
  dispatchId: id,
  attempt,
  providerDefinitionId: operation.intent.providerDefinitionId,
  transportId: TransportId.make("fixture-transport/1"),
  endpointIdentity: EndpointIdentity.make("https://provider.example.test"),
  requestFingerprint: RequestFingerprint.make("a".repeat(64)),
  authorizationIdentity: AuthorizationIdentity.make("fixture-authorization"),
  replayProtection: { kind: "none" },
  replayBasis: { reason: "fixture dispatches cannot be replayed" },
  startedAtEpochMillis: 1
})

const classifyFixtureObservation: ObservationClassifier = ({ observation }) => {
  switch (observation.observation) {
    case "satisfied":
    case "conflict":
    case "pending":
    case "inconclusive":
      return observation.observation
    default:
      return undefined
  }
}

const makeReportFixture = Effect.fn("makeReportFixture")(function*() {
  const bundle = yield* adoptArtifactBundle([{ artifactId: alpha, bytes }])
  const intent = yield* encodeProviderIntent({
    definition: FixtureDefinition,
    intent: FixtureIntent.make({
      schemaVersion: "fixture-intent/v1",
      artifact: ArtifactRef.make({ artifactId: alpha }),
      endpoint: "https://provider.example.test"
    })
  })
  const plan = yield* makeReleasePlan({ bundle, intents: [intent] })
  return { bundle, plan, operation: plan.operations[0]! }
})

describe("v1 immutable bundle and durable plan", () => {
  it.effect("owns bytes, deduplicates content, and preserves canonical identity across input order", () =>
    Effect.gen(function*() {
      const callerBytes = Uint8Array.from(bytes)
      const bundle = yield* adoptArtifactBundle([
        { artifactId: beta, bytes: callerBytes },
        { artifactId: alpha, bytes: callerBytes }
      ])
      callerBytes[0] = 255

      expect(Object.isFrozen(bundle)).toBe(true)
      expect(Object.keys(bundle)).toEqual([])
      expect(Reflect.set(bundle, "content", new Map())).toBe(false)
      expect(() => Reflect.construct(bundle.constructor, [])).toThrow("construction is internal")
      expect(bundle.manifest.objects).toHaveLength(1)
      expect(bundle.artifactIds.map(String)).toEqual(["alpha", "beta"])
      const resolved = yield* bundle.resolve(ArtifactRef.make({ artifactId: alpha }))
      expect(resolved.bytes).toEqual(bytes)
      resolved.bytes[0] = 0
      expect((yield* bundle.resolve(ArtifactRef.make({ artifactId: alpha }))).bytes).toEqual(bytes)

      const reordered = yield* adoptArtifactBundle([
        { artifactId: alpha, bytes },
        { artifactId: beta, bytes }
      ])
      expect(reordered.bundleId).toBe(bundle.bundleId)
      expect(encodeArtifactBundleManifest(reordered.manifest))
        .toEqual(encodeArtifactBundleManifest(bundle.manifest))

      const encoded = encodeArtifactBundleManifest(bundle.manifest)
      const manifest = yield* decodeArtifactBundleManifest(encoded)
      const loaded = yield* loadArtifactBundle({
        manifest,
        objects: [{ digest: manifest.objects[0]!.digest, bytes }]
      })
      expect(loaded.bundleId).toBe(bundle.bundleId)
      expect((yield* loaded.resolve(ArtifactRef.make({ artifactId: beta }))).bytes).toEqual(bytes)

      const noncanonical = new TextEncoder().encode(` ${new TextDecoder().decode(encoded)}`)
      expect((yield* decodeArtifactBundleManifest(noncanonical).pipe(Effect.flip)))
        .toBeInstanceOf(ArtifactBundleError)
    }))

  it.effect("rejects duplicate logical artifacts", () => Effect.gen(function*() {
    const error = yield* adoptArtifactBundle([
      { artifactId: alpha, bytes },
      { artifactId: alpha, bytes }
    ]).pipe(Effect.flip)
    expect(error).toBeInstanceOf(ArtifactBundleError)
  }))

  it.effect("round-trips imported provider Intents and recomputes all plan identities", () =>
    Effect.gen(function*() {
      const bundle = yield* adoptArtifactBundle([{ artifactId: alpha, bytes }])
      const encodedOne = yield* encodeProviderIntent({
        definition: FixtureDefinition,
        intent: FixtureIntent.make({
          schemaVersion: "fixture-intent/v1",
          artifact: ArtifactRef.make({ artifactId: alpha }),
          endpoint: "https://one.example.test"
        })
      })
      const encodedTwo = yield* encodeProviderIntent({
        definition: FixtureDefinition,
        intent: FixtureIntent.make({
          schemaVersion: "fixture-intent/v1",
          artifact: ArtifactRef.make({ artifactId: alpha }),
          endpoint: "https://two.example.test"
        })
      })

      const plan = yield* makeReleasePlan({ bundle, intents: [encodedTwo, encodedOne] })
      const reordered = yield* makeReleasePlan({ bundle, intents: [encodedOne, encodedTwo] })
      expect(reordered.planId).toBe(plan.planId)
      expect(plan.operations).toHaveLength(2)
      expect(plan.operations.map((operation) => operation.operationId)).toEqual(
        [...plan.operations.map((operation) => operation.operationId)].sort()
      )

      const durable = yield* encodeReleasePlan({ plan, bundle })
      const decodedPlan = yield* decodeReleasePlan({ bytes: durable, bundle })
      expect(decodedPlan).toEqual(plan)
      const decodedIntent = yield* decodeProviderIntent({
        definition: FixtureDefinition,
        intent: decodedPlan.operations[0]!.intent
      })
      expect(decodedIntent).toBeInstanceOf(FixtureIntent)
      expect(deriveOperationKey(plan.planId, plan.operations[0]!.operationId)).toMatchObject({
        planId: plan.planId,
        operationId: plan.operations[0]!.operationId
      })

      const tampered = new TextEncoder().encode(
        new TextDecoder().decode(durable).replace(plan.planId, "0".repeat(64))
      )
      expect((yield* decodeReleasePlan({ bytes: tampered, bundle }).pipe(Effect.flip)))
        .toBeInstanceOf(ReleasePlanError)
    }))

  it.effect("rejects duplicate operations and dangling bundle references", () =>
    Effect.gen(function*() {
      const bundle = yield* adoptArtifactBundle([{ artifactId: alpha, bytes }])
      const intent = yield* encodeProviderIntent({
        definition: FixtureDefinition,
        intent: FixtureIntent.make({
          schemaVersion: "fixture-intent/v1",
          artifact: ArtifactRef.make({ artifactId: alpha }),
          endpoint: "https://provider.example.test"
        })
      })
      expect((yield* makeReleasePlan({ bundle, intents: [intent, intent] }).pipe(Effect.flip)))
        .toBeInstanceOf(ReleasePlanError)

      const dangling = yield* encodeProviderIntent({
        definition: FixtureDefinition,
        intent: FixtureIntent.make({
          schemaVersion: "fixture-intent/v1",
          artifact: ArtifactRef.make({ artifactId: ArtifactId.make("missing") }),
          endpoint: "https://provider.example.test"
        })
      })
      expect((yield* makeReleasePlan({ bundle, intents: [dangling] }).pipe(Effect.flip)))
        .toBeInstanceOf(ReleasePlanError)
    }))

  it.effect("keeps canonical bundle, operation, and plan identity vectors stable", () =>
    Effect.gen(function*() {
      const bundle = yield* adoptArtifactBundle([{ artifactId: alpha, bytes }])
      const intent = yield* encodeProviderIntent({
        definition: FixtureDefinition,
        intent: FixtureIntent.make({
          schemaVersion: "fixture-intent/v1",
          artifact: ArtifactRef.make({ artifactId: alpha }),
          endpoint: "https://one.example.test"
        })
      })
      const plan = yield* makeReleasePlan({ bundle, intents: [intent] })

      expect({
        bundleId: String(bundle.bundleId),
        operationId: String(plan.operations[0]?.operationId),
        planId: String(plan.planId)
      }).toEqual({
        bundleId: "930fe6f8bc2e3eef38a9c491806cc5816e91d8dc0a81b221cfcef25e090ca264",
        operationId: "e060e224704061c639ae139a1f40954a5843e1979ceb0b917ae7952f0200e033",
        planId: "a468ced9a0d071e23230031251e552e3b8b28dd101eebba8454ef4c01bb9d26d"
      })
    }))
})

describe("v1 release report state projection", () => {
  it.effect("keeps pending and inconclusive observations reconciliation-required", () =>
    Effect.gen(function*() {
      const { bundle, plan, operation } = yield* makeReportFixture()

      for (const conclusion of ["pending", "inconclusive"] as const) {
        const report = yield* deriveReleaseReport({
          bundle,
          plan,
          journal: journalFrom(plan.planId, [
            started(operation),
            ObservationRecorded.make({
              schemaVersion: 1,
              operationId: operation.operationId,
              dispatchId,
              observation: conclusion,
              recordedAtEpochMillis: 2
            })
          ]),
          classifyObservation: classifyFixtureObservation
        })

        expect(report.operations[0]?.progress).toBeInstanceOf(OperationReconciliationRequired)
        expect(report.operations[0]?.progress).toMatchObject({
          _tag: "OperationReconciliationRequired",
          dispatchId,
          dispatchRevision: 1,
          observationRevisions: [2]
        })
      }
    }))

  it.effect("concludes satisfied or conflicting observations", () =>
    Effect.gen(function*() {
      const { bundle, plan, operation } = yield* makeReportFixture()

      for (const conclusion of ["satisfied", "conflict"] as const) {
        const report = yield* deriveReleaseReport({
          bundle,
          plan,
          journal: journalFrom(plan.planId, [
            started(operation),
            ObservationRecorded.make({
              schemaVersion: 1,
              operationId: operation.operationId,
              dispatchId,
              observation: conclusion,
              recordedAtEpochMillis: 2
            }),
            ObservationRecorded.make({
              schemaVersion: 1,
              operationId: operation.operationId,
              dispatchId,
              observation: "inconclusive",
              recordedAtEpochMillis: 3
            })
          ]),
          classifyObservation: classifyFixtureObservation
        })

        expect(report.operations[0]?.progress).toBeInstanceOf(OperationObservationConcluded)
        expect(report.operations[0]?.progress).toMatchObject({
          _tag: "OperationObservationConcluded",
          dispatchId,
          observationRevision: 2,
          conclusion
        })
      }
    }))

  it.effect("accepts linked late evidence after supersession and lets a late receipt win", () =>
    Effect.gen(function*() {
      const { bundle, plan, operation } = yield* makeReportFixture()
      const report = yield* deriveReleaseReport({
        bundle,
        plan,
        journal: journalFrom(plan.planId, [
          started(operation),
          PlanSuperseded.make({
            schemaVersion: 1,
            supersedingPlanId,
            reason: { reason: "replacement approved" },
            recordedAtEpochMillis: 2
          }),
          ObservationRecorded.make({
            schemaVersion: 1,
            operationId: operation.operationId,
            dispatchId,
            observation: "pending",
            recordedAtEpochMillis: 3
          }),
          ReceiptAccepted.make({
            schemaVersion: 1,
            operationId: operation.operationId,
            dispatchId,
            receipt: { accepted: true },
            recordedAtEpochMillis: 4
          })
        ]),
        classifyObservation: classifyFixtureObservation
      })

      expect(report.planHistory).toHaveLength(1)
      expect(report.operations[0]?.progress).toBeInstanceOf(OperationReceiptAccepted)
      expect(report.operations[0]?.progress).toMatchObject({
        _tag: "OperationReceiptAccepted",
        dispatchId,
        dispatchRevision: 1,
        receiptRevision: 4
      })
    }))

  it.effect("rejects a new dispatch after plan supersession", () =>
    Effect.gen(function*() {
      const { bundle, plan, operation } = yield* makeReportFixture()
      const error = yield* deriveReleaseReport({
        bundle,
        plan,
        journal: journalFrom(plan.planId, [
          PlanSuperseded.make({
            schemaVersion: 1,
            supersedingPlanId,
            reason: { reason: "replacement approved" },
            recordedAtEpochMillis: 1
          }),
          started(operation)
        ]),
        classifyObservation: classifyFixtureObservation
      }).pipe(Effect.flip)

      expect(error.reason).toContain("dispatched after PlanSuperseded")
    }))

  it.effect("rejects self-supersession as a permanent invalid fence", () =>
    Effect.gen(function*() {
      const { bundle, plan } = yield* makeReportFixture()
      const error = yield* deriveReleaseReport({
        bundle,
        plan,
        journal: journalFrom(plan.planId, [
          PlanSuperseded.make({
            schemaVersion: 1,
            supersedingPlanId: plan.planId,
            reason: { reason: "invalid self replacement" },
            recordedAtEpochMillis: 1
          })
        ])
      }).pipe(Effect.flip)

      expect(error.reason).toContain("cannot supersede itself")
    }))

  it.effect("rejects overlapping dispatch attempts without a versioned trusted replay law", () =>
    Effect.gen(function*() {
      const { bundle, plan, operation } = yield* makeReportFixture()
      const error = yield* deriveReleaseReport({
        bundle,
        plan,
        journal: journalFrom(plan.planId, [
          started(operation),
          started(operation, DispatchId.make("dispatch-2"), 2)
        ])
      }).pipe(Effect.flip)

      expect(error.reason).toContain("more than one dispatch")
    }))
})
