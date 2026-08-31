import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import {
  computeTrialRunContextSha256,
  decodeTrialRunContext,
  encodeTrialRunContext,
  makeTrialRunContext
} from "../src/schema/run-context.js"
import {
  V2_CASE_IDS,
  V2_MACHINE_GATE_IDS,
  V2_PROBE_IDS
} from "../src/schema/v2-ids.js"

const digest0 = "0".repeat(64)
const digest1 = "1".repeat(64)

const validBody = {
  schemaVersion: "ts-release/architecture-trial-run-context/v2",
  trialSpecSha256: digest0,
  executionContractSha256: digest0,
  measurementContractSha256: digest0,
  topologyFixtureSha256: digest0,
  candidateId: "M1-extracted-fold",
  candidateScope: "machine",
  candidateModel: "extracted-fold",
  implementationRoot: "prototypes/research-complete-machine/M1-extracted-fold",
  candidateManifestSha256: digest0,
  candidateTreeSha256: digest0,
  runnerSourceSha256: digest0,
  toolchain: {
    bun: "1.3.14",
    typescript: "6.0.3",
    effect: "4.0.0-rc.108",
    git: "2.43.0"
  },
  caseDefinitionBindings: V2_CASE_IDS.map((caseId) => ({
    caseId,
    definitionSha256: digest0,
    fixtureSha256: digest0,
    expectedEvidenceSha256: digest0
  })),
  probeDefinitionBindings: V2_PROBE_IDS.map((probeId) => ({
    probeId,
    definitionSha256: digest0,
    baseFixtureSha256: digest0,
    changeDefinitionSha256: digest0
  })),
  gateDefinitionBindings: V2_MACHINE_GATE_IDS.map((gateId) => ({
    gateId,
    definitionSha256: digest0
  }))
} as const

describe("trial run context v2", () => {
  it.effect("self-hashes the exact canonical body and round-trips strictly", () =>
    Effect.gen(function* () {
      const context = makeTrialRunContext(validBody)
      expect(context.runContextSha256).toBe(computeTrialRunContextSha256(validBody))
      const encoded = encodeTrialRunContext(context)
      expect(yield* decodeTrialRunContext(encoded)).toEqual(context)
    }))

  it("changes the context hash when an immutable execution binding changes", () => {
    expect(computeTrialRunContextSha256({
      ...validBody,
      runnerSourceSha256: digest1
    })).not.toBe(computeTrialRunContextSha256(validBody))
  })

  it.effect("rejects a forged self-hash and excess fields", () =>
    Effect.gen(function* () {
      const context = makeTrialRunContext(validBody)
      for (const input of [
        { ...context, runContextSha256: digest1 },
        { ...context, selectedCandidate: true }
      ]) {
        const exit = yield* decodeTrialRunContext(input).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it("rejects candidate mapping drift and incomplete or reordered exact bindings", () => {
    expect(() => makeTrialRunContext({
      ...validBody,
      candidateModel: "total-transition"
    })).toThrow()
    expect(() => makeTrialRunContext({
      ...validBody,
      caseDefinitionBindings: [...validBody.caseDefinitionBindings].reverse()
    })).toThrow()
    expect(() => makeTrialRunContext({
      ...validBody,
      probeDefinitionBindings: validBody.probeDefinitionBindings.slice(1)
    })).toThrow()
    expect(() => makeTrialRunContext({
      ...validBody,
      gateDefinitionBindings: validBody.gateDefinitionBindings.slice(0, -1)
    })).toThrow()
  })
})
