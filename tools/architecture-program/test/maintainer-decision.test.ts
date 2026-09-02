import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { canonicalJsonBytes } from "../src/canonical-document.js"
import {
  MAINTAINER_DECISION_DOCUMENT_HASH_DOMAIN,
  MaintainerDecisionInvariantError,
  computeMaintainerDecisionDocumentId,
  decodeCanonicalMaintainerDecisionDocument,
  decodeMaintainerDecisionDocument,
  encodeCanonicalMaintainerDecisionDocument,
  encodeMaintainerDecisionDocument,
  makeMaintainerDecisionDocument,
  type MaintainerDecisionValidationContext
} from "../src/schema/maintainer-decision.js"
import { MetricId, Sha256Hex } from "../src/schema/primitives.js"
import {
  MaintainerDecisionRequired,
  TrialCandidateObjectiveVector,
  TrialObjectiveValue,
  UniqueSelection
} from "../src/schema/trial-selection.js"
import { computeTrialSelectionOutcomeSha256 } from "../src/schema/trial-results-aggregate.js"

type MutableDocument = Record<string, any>

const hash = (character: string) => Sha256Hex.make(character.repeat(64))
const trialSpecSha256 = hash("a")
const metricIds = [MetricId.make("metric.lines"), MetricId.make("metric.branches")] as const

const vector = (
  candidateId: "M1-extracted-fold" | "M2-total-transition" |
    "T1-root" | "T2-kernel-provider-bundle" | "T3-provider-verticals",
  receiptId: typeof Sha256Hex.Type,
  values: readonly [number, number]
) => new TrialCandidateObjectiveVector({
  candidateId,
  receiptId,
  values: metricIds.map((metricId, index) => new TrialObjectiveValue({
    metricId,
    value: values[index]!
  })) as [TrialObjectiveValue, TrialObjectiveValue]
})

const machineSelection = new MaintainerDecisionRequired({
  scope: "machine",
  candidateIds: ["M1-extracted-fold", "M2-total-transition"],
  objectiveMetricIds: metricIds,
  objectiveVectors: [
    vector("M1-extracted-fold", hash("1"), [1, 2]),
    vector("M2-total-transition", hash("2"), [2, 1])
  ],
  qualifyingCandidateIds: ["M1-extracted-fold", "M2-total-transition"],
  nonDominatedCandidateIds: ["M1-extracted-fold", "M2-total-transition"],
  rejectedCandidateIds: []
})

const topologySelection = new MaintainerDecisionRequired({
  scope: "topology",
  candidateIds: ["T1-root", "T2-kernel-provider-bundle", "T3-provider-verticals"],
  objectiveMetricIds: metricIds,
  objectiveVectors: [
    vector("T1-root", hash("3"), [1, 2]),
    vector("T2-kernel-provider-bundle", hash("4"), [2, 1])
  ],
  qualifyingCandidateIds: ["T1-root", "T2-kernel-provider-bundle"],
  nonDominatedCandidateIds: ["T1-root", "T2-kernel-provider-bundle"],
  rejectedCandidateIds: ["T3-provider-verticals"]
})

const uniqueMachineSelection = new UniqueSelection({
  scope: "machine",
  candidateIds: ["M1-extracted-fold", "M2-total-transition"],
  objectiveMetricIds: metricIds,
  objectiveVectors: [vector("M1-extracted-fold", hash("1"), [1, 1])],
  selectedCandidateId: "M1-extracted-fold",
  selectedReceiptId: hash("1"),
  qualifyingCandidateIds: ["M1-extracted-fold"],
  dominatedCandidateIds: [],
  rejectedCandidateIds: ["M2-total-transition"]
})

const contexts = {
  machine: {
    trialSpecSha256,
    machineSelection,
    topologySelection: null
  },
  topology: {
    trialSpecSha256,
    machineSelection: uniqueMachineSelection,
    topologySelection
  },
  both: {
    trialSpecSha256,
    machineSelection,
    topologySelection
  }
} as const satisfies Readonly<Record<string, MaintainerDecisionValidationContext>>

const machineDecision = () => ({
  scope: "machine" as const,
  trialSpecSha256,
  selectionOutcomeSha256: computeTrialSelectionOutcomeSha256(machineSelection),
  selectedCandidateId: "M1-extracted-fold" as const,
  selectedReceiptId: hash("1"),
  rationale: "M1 keeps the smaller state-transition surface while preserving the required laws.",
  maintainerIdentity: "maintainer.example",
  maintainerAuthority: "Repository maintainer authorized to resolve architecture Pareto decisions."
})

const topologyDecision = () => ({
  scope: "topology" as const,
  trialSpecSha256,
  selectionOutcomeSha256: computeTrialSelectionOutcomeSha256(topologySelection),
  selectedCandidateId: "T1-root" as const,
  selectedReceiptId: hash("3"),
  rationale: "T1 is preferred for its smaller package-boundary change under the observed tradeoff.",
  maintainerIdentity: "maintainer.example",
  maintainerAuthority: "Repository maintainer authorized to resolve architecture Pareto decisions."
})

const body = (decisions: readonly [unknown, ...Array<unknown>]) => ({
  schemaVersion: "ts-release/architecture-maintainer-decision/v2",
  programId: "ts-release-architecture-program",
  decisions
})

const selfHashed = (input: unknown): MutableDocument => ({
  documentId: computeMaintainerDecisionDocumentId(input),
  ...(input as Record<string, unknown>)
})

describe("maintainer decision document v2", () => {
  it.effect("round-trips strict canonical bytes with a deterministic body hash", () =>
    Effect.gen(function* () {
      const input = body([machineDecision(), topologyDecision()])
      const document = makeMaintainerDecisionDocument(input, contexts.both)
      const repeated = makeMaintainerDecisionDocument(structuredClone(input), contexts.both)
      expect(document.documentId).toBe(repeated.documentId)
      expect(document.documentId).toBe(computeMaintainerDecisionDocumentId(input))

      const encoded = encodeMaintainerDecisionDocument(document, contexts.both) as MutableDocument
      const decoded = yield* decodeMaintainerDecisionDocument(encoded, contexts.both)
      expect(decoded).toEqual(document)
      expect(Object.keys(encoded).sort()).toEqual([
        "decisions",
        "documentId",
        "programId",
        "schemaVersion"
      ])
      expect(Object.keys(encoded.decisions[0]).sort()).toEqual([
        "maintainerAuthority",
        "maintainerIdentity",
        "rationale",
        "scope",
        "selectedCandidateId",
        "selectedReceiptId",
        "selectionOutcomeSha256",
        "trialSpecSha256"
      ])

      const bytes = encodeCanonicalMaintainerDecisionDocument(document, contexts.both)
      expect(bytes).toEqual(canonicalJsonBytes(encoded))
      expect(yield* decodeCanonicalMaintainerDecisionDocument(bytes, contexts.both)).toEqual(
        document
      )
      expect(MAINTAINER_DECISION_DOCUMENT_HASH_DOMAIN).toBe(
        "ts-release/architecture-maintainer-decision/v2"
      )
    }))

  it("supports exactly the ordered machine and topology decisions that are needed", () => {
    const cases = [
      [contexts.machine, body([machineDecision()]), ["machine"]],
      [contexts.topology, body([topologyDecision()]), ["topology"]],
      [contexts.both, body([machineDecision(), topologyDecision()]), ["machine", "topology"]]
    ] as const
    for (const [context, input, scopes] of cases) {
      expect(makeMaintainerDecisionDocument(input, context).decisions.map(
        ({ scope }) => scope
      )).toEqual(scopes)
    }
  })

  it("changes the document ID for every authority-bearing decision change", () => {
    const original = body([machineDecision()])
    const originalId = computeMaintainerDecisionDocumentId(original)
    const alternateSelection = {
      ...machineDecision(),
      selectedCandidateId: "M2-total-transition",
      selectedReceiptId: hash("2")
    } as const
    for (const changed of [
      body([{ ...machineDecision(), rationale: "A different bounded rationale." }]),
      body([{ ...machineDecision(), maintainerIdentity: "another.maintainer" }]),
      body([{ ...machineDecision(), maintainerAuthority: "Release architecture owner." }]),
      body([alternateSelection])
    ]) {
      expect(computeMaintainerDecisionDocumentId(changed)).not.toBe(originalId)
    }
    expect(makeMaintainerDecisionDocument(
      body([alternateSelection]),
      contexts.machine
    ).decisions[0].selectedReceiptId).toBe(hash("2"))
  })

  it.effect("rejects unknown keys, timestamps, missing fields, and forged document IDs", () =>
    Effect.gen(function* () {
      const document = makeMaintainerDecisionDocument(
        body([machineDecision()]),
        contexts.machine
      )
      const encoded = encodeMaintainerDecisionDocument(document, contexts.machine) as MutableDocument
      const hostile = [
        { ...encoded, generatedAt: "2026-09-02T00:00:00Z" },
        { ...encoded, decidedAt: "2026-09-02T00:00:00Z" },
        {
          ...encoded,
          decisions: [{ ...encoded.decisions[0], timestamp: "2026-09-02T00:00:00Z" }]
        },
        {
          ...encoded,
          decisions: [{ ...encoded.decisions[0], selectedByCandidate: true }]
        },
        { ...encoded, documentId: hash("f") },
        {
          ...encoded,
          decisions: [{ ...encoded.decisions[0], rationale: undefined }]
        }
      ]
      for (const input of hostile) {
        expect(Exit.isFailure(yield* decodeMaintainerDecisionDocument(
          input,
          contexts.machine
        ).pipe(Effect.exit))).toBe(true)
      }
    }))

  it.effect("rejects noncanonical, duplicate-key, and malformed UTF-8 documents", () =>
    Effect.gen(function* () {
      const document = makeMaintainerDecisionDocument(
        body([machineDecision()]),
        contexts.machine
      )
      const canonical = encodeCanonicalMaintainerDecisionDocument(document, contexts.machine)
      const withTrailingSpace = new Uint8Array(canonical.byteLength + 1)
      withTrailingSpace.set(canonical)
      withTrailingSpace[canonical.byteLength] = 0x20
      const text = new TextDecoder().decode(canonical)
      const duplicate = new TextEncoder().encode(
        text.replace('{"decisions":', '{"decisions":[],"decisions":')
      )
      for (const bytes of [withTrailingSpace, duplicate, new Uint8Array([0xff])]) {
        const error = yield* decodeCanonicalMaintainerDecisionDocument(
          bytes,
          contexts.machine
        ).pipe(Effect.flip)
        expect(error).toBeInstanceOf(MaintainerDecisionInvariantError)
        if (!(error instanceof MaintainerDecisionInvariantError)) throw error
        expect(error.issues[0]).toContain("canonical document bytes are invalid")
      }
    }))

  it.effect("validates every row against the actual MaintainerDecisionRequired outcome", () =>
    Effect.gen(function* () {
      const original = body([machineDecision()])
      const changedOutcome = new MaintainerDecisionRequired({
        ...machineSelection,
        objectiveVectors: [
          vector("M1-extracted-fold", hash("1"), [1, 3]),
          vector("M2-total-transition", hash("2"), [2, 1])
        ]
      })
      const contextualCases: ReadonlyArray<readonly [unknown, MaintainerDecisionValidationContext]> = [
        [body([{ ...machineDecision(), trialSpecSha256: hash("b") }]), contexts.machine],
        [body([{ ...machineDecision(), selectionOutcomeSha256: hash("c") }]), contexts.machine],
        [body([{ ...machineDecision(), selectedReceiptId: hash("d") }]), contexts.machine],
        [body([{
          ...topologyDecision(),
          selectedCandidateId: "T3-provider-verticals",
          selectedReceiptId: hash("5")
        }]), contexts.topology],
        [original, { ...contexts.machine, machineSelection: changedOutcome }],
        [original, { ...contexts.machine, machineSelection: uniqueMachineSelection }],
        [body([machineDecision()]), contexts.both],
        [body([machineDecision(), topologyDecision()]), contexts.machine]
      ]

      for (const [input, context] of contextualCases) {
        const error = yield* decodeMaintainerDecisionDocument(
          selfHashed(input),
          context
        ).pipe(Effect.flip)
        expect(error).toBeInstanceOf(MaintainerDecisionInvariantError)
      }
    }))

  it("rejects duplicate, reordered, and cross-scope decision rows", () => {
    for (const input of [
      body([machineDecision(), machineDecision()]),
      body([topologyDecision(), machineDecision()]),
      body([{
        ...machineDecision(),
        selectedCandidateId: "T1-root",
        selectedReceiptId: hash("3")
      }])
    ]) {
      expect(() => computeMaintainerDecisionDocumentId(input)).toThrow(
        MaintainerDecisionInvariantError
      )
    }
  })

  it("rejects empty, noncanonical, control-bearing, and overlong human authority text", () => {
    const invalidValues = [
      "",
      " leading space",
      "trailing space ",
      "line\nbreak",
      "e\u0301",
      "\ud800"
    ]
    for (const field of ["rationale", "maintainerIdentity", "maintainerAuthority"] as const) {
      for (const value of invalidValues) {
        expect(() => makeMaintainerDecisionDocument(body([{
          ...machineDecision(),
          [field]: value
        }]), contexts.machine)).toThrow()
      }
    }
    expect(() => makeMaintainerDecisionDocument(body([{
      ...machineDecision(),
      maintainerIdentity: "x".repeat(257)
    }]), contexts.machine)).toThrow()
    expect(() => makeMaintainerDecisionDocument(body([{
      ...machineDecision(),
      maintainerAuthority: "x".repeat(1_025)
    }]), contexts.machine)).toThrow()
    expect(() => makeMaintainerDecisionDocument(body([{
      ...machineDecision(),
      rationale: "x".repeat(4_097)
    }]), contexts.machine)).toThrow()
  })
})
