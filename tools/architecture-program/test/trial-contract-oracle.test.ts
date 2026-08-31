import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { parseCanonicalJsonBytes } from "../src/canonical-document.js"
import { trialContractOracleIssues } from "../src/check-trial-contract.js"
import { expectedCaseEvidenceSha256V2, probeChangeDefinitionSha256V2 } from "../src/schema/trial-evidence.js"
import {
  decodeArchitectureTrialSpec,
  encodeArchitectureTrialSpec,
  gateDefinitionSha256,
  machineCaseDefinitionSha256,
  machineCaseFixtureSha256,
  marginalProbeDefinitionSha256
} from "../src/schema/trial-spec.js"

type MutableDocument = Record<string, any>

const fixturePath = resolve(
  typeof import.meta.dir === "string" ? import.meta.dir : dirname(fileURLToPath(import.meta.url)),
  "../../../docs/refactor/architecture-program/inputs/trial-spec.json"
)

const loadValidSpec = Effect.fn("trialContractOracleTest.loadValidSpec")(function* () {
  const bytes = yield* Effect.tryPromise(() => readFile(fixturePath))
  const document = structuredClone(parseCanonicalJsonBytes(bytes)) as MutableDocument
  const spec = yield* decodeArchitectureTrialSpec(document)
  const encoded = encodeArchitectureTrialSpec(spec)
  return { encoded, spec }
})

describe("architecture trial v2 independent contract oracle", () => {
  it.effect("accepts every frozen component in the committed contract", () =>
    Effect.gen(function* () {
      const { encoded, spec } = yield* loadValidSpec()
      expect(trialContractOracleIssues(spec, encoded)).toEqual([])
    }))

  it.effect("rejects semantic case payloads after every affected hash is validly refreshed", () =>
    Effect.gen(function* () {
      const { encoded, spec } = yield* loadValidSpec()
      const machineCase = spec.machineCases[0]!
      const mutableCase = machineCase as unknown as MutableDocument
      const originalDefinitionSha256 = mutableCase.execution.definitionSha256

      mutableCase.fixture.inputFacts[0].value.value = "mutated-provider"
      mutableCase.expectedEvidence.facts[0].value.value = 8
      mutableCase.execution.fixtureSha256 = machineCaseFixtureSha256(machineCase)
      mutableCase.execution.expectedEvidenceSha256 = expectedCaseEvidenceSha256V2(
        machineCase.expectedEvidence
      )
      mutableCase.execution.definitionSha256 = machineCaseDefinitionSha256(machineCase)

      expect(mutableCase.execution.fixtureSha256).toBe(machineCaseFixtureSha256(machineCase))
      expect(mutableCase.execution.expectedEvidenceSha256).toBe(
        expectedCaseEvidenceSha256V2(machineCase.expectedEvidence)
      )
      expect(mutableCase.execution.definitionSha256).toBe(machineCaseDefinitionSha256(machineCase))
      expect(mutableCase.execution.definitionSha256).not.toBe(originalDefinitionSha256)

      const issues = trialContractOracleIssues(spec, encoded)
      expect(issues).toContain(
        "case C01-initial-success computed fixture hash differs from the independent v2 oracle"
      )
      expect(issues).toContain(
        "case C01-initial-success computed expected-evidence hash differs from the independent v2 oracle"
      )
      expect(issues).toContain(
        "case C01-initial-success computed definition hash differs from the independent v2 oracle"
      )
    }))

  it.effect("rejects a semantic probe change after both affected hashes are validly refreshed", () =>
    Effect.gen(function* () {
      const { encoded, spec } = yield* loadValidSpec()
      const probe = spec.marginalProbes[0]!
      const mutableProbe = probe as unknown as MutableDocument
      const originalDefinitionSha256 = mutableProbe.execution.definitionSha256

      mutableProbe.changeDefinition.parameters[0].value.value = "blue"
      mutableProbe.execution.changeDefinitionSha256 = probeChangeDefinitionSha256V2(
        probe.changeDefinition
      )
      mutableProbe.execution.definitionSha256 = marginalProbeDefinitionSha256(probe)

      expect(mutableProbe.execution.changeDefinitionSha256).toBe(
        probeChangeDefinitionSha256V2(probe.changeDefinition)
      )
      expect(mutableProbe.execution.definitionSha256).toBe(marginalProbeDefinitionSha256(probe))
      expect(mutableProbe.execution.definitionSha256).not.toBe(originalDefinitionSha256)

      const issues = trialContractOracleIssues(spec, encoded)
      expect(issues).toContain(
        "probe P01-second-provider-instance computed change-definition hash differs from the independent v2 oracle"
      )
      expect(issues).toContain(
        "probe P01-second-provider-instance computed definition hash differs from the independent v2 oracle"
      )
    }))

  it.effect("rejects a semantic gate mutation by its frozen definition hash", () =>
    Effect.gen(function* () {
      const { encoded, spec } = yield* loadValidSpec()
      const gate = spec.gateRequirements[0]!
      const originalDefinitionSha256 = gateDefinitionSha256(gate)

      ;(gate as unknown as MutableDocument).title = "Mutated shared case semantics"

      expect(gateDefinitionSha256(gate)).not.toBe(originalDefinitionSha256)
      expect(trialContractOracleIssues(spec, encoded)).toContain(
        "gate GM01-shared-case-semantics definition hash differs from the independent v2 oracle"
      )
    }))
})
