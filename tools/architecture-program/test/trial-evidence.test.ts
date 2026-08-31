import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import {
  caseFixtureSha256V2,
  decodeCaseFixture,
  decodeExpectedCaseEvidence,
  decodeProbeChangeDefinition,
  encodeCaseFixture,
  expectedCaseEvidenceSha256V2,
  probeChangeDefinitionSha256V2
} from "../src/schema/trial-evidence.js"

const digest0 = "0".repeat(64)

const value = (raw: boolean | number | string) => {
  if (typeof raw === "boolean") return { _tag: "Boolean" as const, value: raw }
  if (typeof raw === "number") return { _tag: "Integer" as const, value: raw }
  return { _tag: "Text" as const, value: raw }
}

const facts = (entries: ReadonlyArray<readonly [string, boolean | number | string]>) =>
  entries.map(([name, raw], index) => ({ sequence: index + 1, name, value: value(raw) }))

const validFixture = {
  schemaVersion: "architecture-case-fixture-v2",
  caseId: "C01-initial-success",
  deterministicSeed: digest0,
  releaseId: "release.c01",
  operationId: "operation.c01",
  requestId: "request.c01",
  endpointId: "provider-a-staging",
  initialRevision: 0,
  inputFacts: facts([
    ["fixture.provider-kind", "generic-provider"],
    ["fixture.start-state", "empty-journal"]
  ]),
  faultSchedule: []
} as const

describe("trial evidence v2", () => {
  it.effect("strictly round-trips a concrete case fixture and hashes its canonical body", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeCaseFixture(validFixture)
      expect(encodeCaseFixture(decoded)).toEqual(validFixture)
      expect(caseFixtureSha256V2(decoded)).toMatch(/^[0-9a-f]{64}$/u)
      expect(caseFixtureSha256V2({
        ...validFixture,
        requestId: "request.changed"
      })).not.toBe(caseFixtureSha256V2(validFixture))
    }))

  it.effect("rejects malformed scalar tags, unsafe integers, and excess authority fields", () =>
    Effect.gen(function* () {
      for (const fixture of [
        {
          ...validFixture,
          inputFacts: [{ sequence: 1, name: "fixture.state", value: { _tag: "Number", value: 1 } }]
        },
        {
          ...validFixture,
          inputFacts: [{
            sequence: 1,
            name: "fixture.count",
            value: { _tag: "Integer", value: Number.MAX_SAFE_INTEGER + 1 }
          }]
        },
        { ...validFixture, expectedTrace: [] }
      ]) {
        const exit = yield* decodeCaseFixture(fixture).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("requires contiguous sequences and code-point-sorted unique evidence names", () =>
    Effect.gen(function* () {
      for (const inputFacts of [
        [
          { sequence: 1, name: "fixture.z", value: value(true) },
          { sequence: 2, name: "fixture.a", value: value(true) }
        ],
        [
          { sequence: 2, name: "fixture.a", value: value(true) }
        ],
        [
          { sequence: 1, name: "fixture.a", value: value(true) },
          { sequence: 2, name: "fixture.a", value: value(false) }
        ]
      ]) {
        const exit = yield* decodeCaseFixture({ ...validFixture, inputFacts }).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("keeps the exact C16 journal limit in runner-owned fixture facts only", () =>
    Effect.gen(function* () {
      const c16 = {
        ...validFixture,
        caseId: "C16-journal-bound-symmetry",
        inputFacts: facts([
          ["fixture.start-state", "empty-journal"],
          ["journal.has-product-authority", false],
          ["journal.limit-bytes", 64],
          ["journal.limit-source", "trial-fixture"]
        ])
      }
      const decoded = yield* decodeCaseFixture(c16)
      expect(decoded.caseId).toBe("C16-journal-bound-symmetry")

      for (const fixture of [
        { ...c16, inputFacts: c16.inputFacts.filter(({ name }) => name !== "journal.limit-bytes") },
        {
          ...c16,
          inputFacts: facts([
            ["fixture.start-state", "empty-journal"],
            ["journal.has-product-authority", false],
            ["journal.limit-bytes", 65],
            ["journal.limit-source", "trial-fixture"]
          ])
        },
        {
          ...validFixture,
          inputFacts: facts([
            ["fixture.start-state", "empty-journal"],
            ["journal.limit-bytes", 64]
          ])
        }
      ]) {
        const exit = yield* decodeCaseFixture(fixture).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("separates runner-owned expected evidence from candidate inputs", () =>
    Effect.gen(function* () {
      const expected = {
        schemaVersion: "architecture-expected-case-evidence-v2",
        caseId: "C01-initial-success",
        trace: [{
          sequence: 1,
          actionId: "action.initialize-operation",
          facts: facts([["trace.state", "initialized"]])
        }],
        facts: facts([["summary.outcome", "succeeded"]]),
        terminalOutcome: "Succeeded"
      } as const
      const decoded = yield* decodeExpectedCaseEvidence(expected)
      expect(expectedCaseEvidenceSha256V2(decoded)).toMatch(/^[0-9a-f]{64}$/u)
    }))

  it.effect("binds concrete probe parameters and canonical set-like requirements", () =>
    Effect.gen(function* () {
      const definition = {
        schemaVersion: "architecture-probe-change-definition-v2",
        probeId: "P01-second-provider-instance",
        changeId: "P01-runner-owned-change",
        baseFixtureSha256: digest0,
        actionId: "probe.add-second-provider-instance",
        parameters: facts([["change.instance-id", "provider-a-canary"]]),
        requiredZeroTouchRoleIds: ["kernel", "provider"],
        requiredChangeKinds: ["runtime-surface", "type-surface"]
      } as const
      const decoded = yield* decodeProbeChangeDefinition(definition)
      expect(probeChangeDefinitionSha256V2(decoded)).toMatch(/^[0-9a-f]{64}$/u)

      const exit = yield* decodeProbeChangeDefinition({
        ...definition,
        requiredZeroTouchRoleIds: ["provider", "kernel"]
      }).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
    }))
})
