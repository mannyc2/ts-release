import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import {
  caseInvocationCodec,
  caseObservationStructureCodec,
  decodeCaseObservationForInvocation,
  decodeGateObservationForInvocation,
  decodeProbeObservationForInvocation,
  gateInvocationCodec,
  probeInvocationCodec
} from "../src/schema/harness-protocol.js"
import {
  caseFixtureSha256V2,
  probeChangeDefinitionSha256V2
} from "../src/schema/trial-evidence.js"

const digest0 = "0".repeat(64)
const digest1 = "1".repeat(64)

const textFact = (sequence: number, name: string, value: string) => ({
  sequence,
  name,
  value: { _tag: "Text" as const, value }
})

const validFixture = {
  schemaVersion: "architecture-case-fixture-v2",
  caseId: "C01-initial-success",
  deterministicSeed: digest0,
  releaseId: "release.c01",
  operationId: "operation.c01",
  requestId: "request.c01",
  endpointId: "provider-a-staging",
  initialRevision: 0,
  inputFacts: [textFact(1, "fixture.start-state", "empty-journal")],
  faultSchedule: []
} as const

const validCaseInvocation = {
  schemaVersion: "architecture-case-invocation-v2",
  runContextSha256: digest0,
  candidateId: "M1-extracted-fold",
  candidateTreeSha256: digest0,
  definitionSha256: digest0,
  caseId: "C01-initial-success",
  fixtureSha256: caseFixtureSha256V2(validFixture),
  fixture: validFixture
} as const

const validCaseObservation = {
  schemaVersion: "architecture-case-observation-v2",
  runContextSha256: digest0,
  candidateId: "M1-extracted-fold",
  candidateTreeSha256: digest0,
  definitionSha256: digest0,
  caseId: "C01-initial-success",
  fixtureSha256: validCaseInvocation.fixtureSha256,
  trace: [{
    sequence: 1,
    actionId: "action.initialize-operation",
    facts: [textFact(1, "trace.state", "initialized")]
  }],
  facts: [textFact(1, "summary.outcome", "succeeded")],
  terminalOutcome: "Succeeded"
} as const

const validChangeDefinition = {
  schemaVersion: "architecture-probe-change-definition-v2",
  probeId: "P01-second-provider-instance",
  changeId: "P01-runner-owned-change",
  baseFixtureSha256: digest0,
  actionId: "probe.add-second-provider-instance",
  parameters: [textFact(1, "change.instance-id", "provider-a-canary")],
  requiredZeroTouchRoleIds: ["kernel"],
  requiredChangeKinds: ["runtime-surface"]
} as const

const validProbeInvocation = {
  schemaVersion: "architecture-probe-invocation-v2",
  runContextSha256: digest0,
  candidateId: "T1-root",
  candidateTreeSha256: digest0,
  definitionSha256: digest0,
  probeId: "P01-second-provider-instance",
  baseFixtureSha256: digest0,
  changeDefinitionSha256: probeChangeDefinitionSha256V2(validChangeDefinition),
  changeDefinition: validChangeDefinition
} as const

const validProbeObservation = {
  schemaVersion: "architecture-probe-observation-v2",
  runContextSha256: digest0,
  candidateId: "T1-root",
  candidateTreeSha256: digest0,
  definitionSha256: digest0,
  probeId: "P01-second-provider-instance",
  baseFixtureSha256: digest0,
  changeDefinitionSha256: validProbeInvocation.changeDefinitionSha256,
  changeId: "P01-runner-owned-change",
  facts: [textFact(1, "measurement.changed-files", "1")]
} as const

const validGateInvocation = {
  schemaVersion: "architecture-gate-invocation-v2",
  runContextSha256: digest0,
  candidateId: "T1-root",
  candidateTreeSha256: digest0,
  definitionSha256: digest0,
  gateId: "GT01-shared-fixture-machine-and-cases",
  lawIds: ["L01-single-canonical-durable-chain"],
  caseIds: ["C01-initial-success"],
  probeIds: ["P01-second-provider-instance"]
} as const

const validGateObservation = {
  schemaVersion: "architecture-gate-observation-v2",
  runContextSha256: digest0,
  candidateId: "T1-root",
  candidateTreeSha256: digest0,
  definitionSha256: digest0,
  gateId: "GT01-shared-fixture-machine-and-cases",
  facts: [textFact(1, "gate.check-count", "1")]
} as const

describe("candidate harness protocol v2", () => {
  it.effect("round-trips an exact-ID case invocation carrying its full fixture", () =>
    Effect.gen(function* () {
      const decoded = yield* caseInvocationCodec.decode(validCaseInvocation)
      expect(caseInvocationCodec.encode(decoded)).toEqual(validCaseInvocation)
      expect(decoded.fixture.caseId).toBe(decoded.caseId)
    }))

  it.effect("rejects fixture hash, fixture ID, invented IDs, and expectation authority", () =>
    Effect.gen(function* () {
      const invalidInputs = [
        { ...validCaseInvocation, fixtureSha256: digest1 },
        {
          ...validCaseInvocation,
          caseId: "C02-rejection-before-commit"
        },
        { ...validCaseInvocation, caseId: "C99-invented-case" },
        { ...validCaseInvocation, requiredTerminalOutcome: "Succeeded" }
      ]
      for (const input of invalidInputs) {
        const exit = yield* caseInvocationCodec.decode(input).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("validates the full runner-owned probe change definition", () =>
    Effect.gen(function* () {
      const decoded = yield* probeInvocationCodec.decode(validProbeInvocation)
      expect(decoded.changeDefinition.changeId).toBe("P01-runner-owned-change")
      expect(probeInvocationCodec.encode(decoded)).toEqual(validProbeInvocation)

      for (const input of [
        { ...validProbeInvocation, changeDefinitionSha256: digest1 },
        { ...validProbeInvocation, baseFixtureSha256: digest1 },
        {
          ...validProbeInvocation,
          changeDefinition: {
            ...validChangeDefinition,
            probeId: "P02-packed-external-provider"
          }
        }
      ]) {
        const exit = yield* probeInvocationCodec.decode(input).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("requires canonical set-like gate bindings", () =>
    Effect.gen(function* () {
      const decoded = yield* gateInvocationCodec.decode(validGateInvocation)
      expect(decoded.gateId).toBe("GT01-shared-fixture-machine-and-cases")

      for (const input of [
        { ...validGateInvocation, lawIds: [...validGateInvocation.lawIds, ...validGateInvocation.lawIds] },
        { ...validGateInvocation, caseIds: ["C02-rejection-before-commit", "C01-initial-success"] },
        { ...validGateInvocation, probeIds: ["P99-invented-probe"] }
      ]) {
        const exit = yield* gateInvocationCodec.decode(input).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("distinguishes structure-only output decoding from paired validation", () =>
    Effect.gen(function* () {
      const structurallyValidMismatch = {
        ...validCaseObservation,
        candidateTreeSha256: digest1
      }
      const structure = yield* caseObservationStructureCodec.decode(structurallyValidMismatch)
      expect(structure.candidateTreeSha256).toBe(digest1)

      const exit = yield* decodeCaseObservationForInvocation(
        yield* caseInvocationCodec.decode(validCaseInvocation),
        structurallyValidMismatch
      ).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("rejects every case observation echo mismatch", () =>
    Effect.gen(function* () {
      const invocation = yield* caseInvocationCodec.decode(validCaseInvocation)
      const mismatches = [
        { ...validCaseObservation, runContextSha256: digest1 },
        { ...validCaseObservation, candidateId: "M2-total-transition" },
        { ...validCaseObservation, candidateTreeSha256: digest1 },
        { ...validCaseObservation, definitionSha256: digest1 },
        { ...validCaseObservation, caseId: "C02-rejection-before-commit" },
        { ...validCaseObservation, fixtureSha256: digest1 }
      ]
      for (const output of mismatches) {
        const exit = yield* decodeCaseObservationForInvocation(invocation, output).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
      const output = yield* decodeCaseObservationForInvocation(invocation, validCaseObservation)
      expect(output.terminalOutcome).toBe("Succeeded")
    }))

  it.effect("rejects every probe observation echo mismatch", () =>
    Effect.gen(function* () {
      const invocation = yield* probeInvocationCodec.decode(validProbeInvocation)
      const mismatches = [
        { ...validProbeObservation, runContextSha256: digest1 },
        { ...validProbeObservation, candidateId: "T2-kernel-provider-bundle" },
        { ...validProbeObservation, candidateTreeSha256: digest1 },
        { ...validProbeObservation, definitionSha256: digest1 },
        { ...validProbeObservation, probeId: "P02-packed-external-provider" },
        { ...validProbeObservation, baseFixtureSha256: digest1 },
        { ...validProbeObservation, changeDefinitionSha256: digest1 },
        { ...validProbeObservation, changeId: "P01-wrong-change" }
      ]
      for (const output of mismatches) {
        const exit = yield* decodeProbeObservationForInvocation(invocation, output).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
      yield* decodeProbeObservationForInvocation(invocation, validProbeObservation)
    }))

  it.effect("validates gate echoes and raw evidence without candidate-authored status", () =>
    Effect.gen(function* () {
      const invocation = yield* gateInvocationCodec.decode(validGateInvocation)
      yield* decodeGateObservationForInvocation(invocation, validGateObservation)

      for (const output of [
        { ...validGateObservation, runContextSha256: digest1 },
        { ...validGateObservation, candidateId: "T2-kernel-provider-bundle" },
        { ...validGateObservation, candidateTreeSha256: digest1 },
        { ...validGateObservation, definitionSha256: digest1 },
        { ...validGateObservation, gateId: "GT02-packed-library-node" },
        { ...validGateObservation, status: "Passed" }
      ]) {
        const exit = yield* decodeGateObservationForInvocation(invocation, output).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("rejects candidate-authored claims, assertions, and changeApplied flags", () =>
    Effect.gen(function* () {
      const caseInvocation = yield* caseInvocationCodec.decode(validCaseInvocation)
      const probeInvocation = yield* probeInvocationCodec.decode(validProbeInvocation)
      const gateInvocation = yield* gateInvocationCodec.decode(validGateInvocation)

      expect(Exit.isFailure(yield* decodeCaseObservationForInvocation(caseInvocation, {
        ...validCaseObservation,
        observationIds: ["claim.one"],
        executedAssertionIds: ["assertion.one"]
      }).pipe(Effect.exit))).toBe(true)
      expect(Exit.isFailure(yield* decodeProbeObservationForInvocation(probeInvocation, {
        ...validProbeObservation,
        changeApplied: true
      }).pipe(Effect.exit))).toBe(true)
      expect(Exit.isFailure(yield* decodeGateObservationForInvocation(gateInvocation, {
        ...validGateObservation,
        claimIds: ["claim.one"],
        failureIds: []
      }).pipe(Effect.exit))).toBe(true)
    }))
})
