import { Effect, Schema } from "effect"
import { hashCanonicalValue } from "../trial-hash.js"
import { ArtifactId, Sha256Hex } from "./primitives.js"
import { V2CaseId, V2ProbeId } from "./v2-ids.js"

const wellFormedText = Schema.makeFilter(
  (value: string) => value.isWellFormed() ? undefined : "must not contain an unpaired UTF-16 surrogate"
)
const nfcText = Schema.makeFilter(
  (value: string) => value === value.normalize("NFC") ? undefined : "must be NFC-normalized"
)
const safeInteger = Schema.makeFilter(
  (value: number) => Number.isSafeInteger(value) && !Object.is(value, -0)
    ? undefined
    : "must be a safe integer other than negative zero"
)

const CanonicalText = Schema.String.check(wellFormedText, nfcText)
const SafeInteger = Schema.Int.check(safeInteger)
const Natural = SafeInteger.check(Schema.isGreaterThanOrEqualTo(0))
const PositiveInteger = SafeInteger.check(Schema.isGreaterThan(0))

export const EvidenceName = Schema.NonEmptyString.check(
  wellFormedText,
  nfcText,
  Schema.isPattern(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u)
).pipe(Schema.brand("TrialEvidenceName"))
export type EvidenceName = typeof EvidenceName.Type

export class BooleanEvidenceValueV2 extends Schema.TaggedClass<BooleanEvidenceValueV2>()(
  "Boolean",
  { value: Schema.Boolean }
) {}

export class IntegerEvidenceValueV2 extends Schema.TaggedClass<IntegerEvidenceValueV2>()(
  "Integer",
  { value: SafeInteger }
) {}

export class TextEvidenceValueV2 extends Schema.TaggedClass<TextEvidenceValueV2>()(
  "Text",
  { value: CanonicalText }
) {}

export class Sha256EvidenceValueV2 extends Schema.TaggedClass<Sha256EvidenceValueV2>()(
  "Sha256",
  { value: Sha256Hex }
) {}

export const EvidenceValueV2 = Schema.Union([
  BooleanEvidenceValueV2,
  IntegerEvidenceValueV2,
  TextEvidenceValueV2,
  Sha256EvidenceValueV2
])
export type EvidenceValueV2 = typeof EvidenceValueV2.Type

export class EvidenceEntryV2 extends Schema.Class<EvidenceEntryV2>("EvidenceEntryV2")({
  sequence: PositiveInteger,
  name: EvidenceName,
  value: EvidenceValueV2
}) {}

export class CaseFaultScheduleEntryV2 extends Schema.Class<CaseFaultScheduleEntryV2>(
  "CaseFaultScheduleEntryV2"
)({
  sequence: PositiveInteger,
  actionId: ArtifactId,
  occurrence: PositiveInteger,
  faultId: ArtifactId,
  parameters: Schema.Array(EvidenceEntryV2)
}) {}

export class CaseTraceStep extends Schema.Class<CaseTraceStep>("CaseTraceStep")({
  sequence: PositiveInteger,
  actionId: ArtifactId,
  facts: Schema.NonEmptyArray(EvidenceEntryV2)
}) {}

export const TerminalOutcome = Schema.Literals(["Succeeded", "Rejected", "Inconclusive", "SafeStop"])
export type TerminalOutcome = typeof TerminalOutcome.Type

export class CaseFixtureV2 extends Schema.Class<CaseFixtureV2>("CaseFixtureV2")({
  schemaVersion: Schema.Literal("architecture-case-fixture-v2"),
  caseId: V2CaseId,
  deterministicSeed: Sha256Hex,
  releaseId: ArtifactId,
  operationId: ArtifactId,
  requestId: ArtifactId,
  endpointId: ArtifactId,
  initialRevision: Natural,
  inputFacts: Schema.NonEmptyArray(EvidenceEntryV2),
  faultSchedule: Schema.Array(CaseFaultScheduleEntryV2)
}) {}

export class ExpectedCaseEvidenceV2 extends Schema.Class<ExpectedCaseEvidenceV2>(
  "ExpectedCaseEvidenceV2"
)({
  schemaVersion: Schema.Literal("architecture-expected-case-evidence-v2"),
  caseId: V2CaseId,
  trace: Schema.NonEmptyArray(CaseTraceStep),
  facts: Schema.NonEmptyArray(EvidenceEntryV2),
  terminalOutcome: TerminalOutcome
}) {}

export class ProbeChangeDefinitionV2 extends Schema.Class<ProbeChangeDefinitionV2>(
  "ProbeChangeDefinitionV2"
)({
  schemaVersion: Schema.Literal("architecture-probe-change-definition-v2"),
  probeId: V2ProbeId,
  changeId: ArtifactId,
  baseFixtureSha256: Sha256Hex,
  actionId: ArtifactId,
  parameters: Schema.NonEmptyArray(EvidenceEntryV2),
  requiredZeroTouchRoleIds: Schema.Array(ArtifactId),
  requiredChangeKinds: Schema.Array(ArtifactId)
}) {}

export class TrialEvidenceInvariantError extends Schema.TaggedError<TrialEvidenceInvariantError>()(
  "TrialEvidenceInvariantError",
  { issues: Schema.NonEmptyArray(Schema.String), message: Schema.String }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial evidence invariant failure: ${issues.join("; ")}`
    })
  }
}

export const codePointCompare = (left: string, right: string): number => {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!
    if (difference !== 0) return difference
  }
  return leftPoints.length - rightPoints.length
}

export const sortedUniqueStringIssues = (
  label: string,
  values: ReadonlyArray<string>
): ReadonlyArray<string> => {
  for (let index = 1; index < values.length; index += 1) {
    if (codePointCompare(values[index - 1]!, values[index]!) >= 0) {
      return [`${label} must be strictly sorted and unique by Unicode code point`]
    }
  }
  return []
}

const orderedSequenceIssues = (
  label: string,
  values: ReadonlyArray<{ readonly sequence: number }>
): ReadonlyArray<string> => values.flatMap((value, index) =>
  value.sequence === index + 1
    ? []
    : [`${label}[${index}].sequence must equal ${index + 1}`])

export const evidenceEntriesInvariantIssues = (
  label: string,
  entries: ReadonlyArray<EvidenceEntryV2>
): ReadonlyArray<string> => [
  ...orderedSequenceIssues(label, entries),
  ...sortedUniqueStringIssues(`${label} names`, entries.map(({ name }) => name))
]

export const caseTraceInvariantIssues = (
  label: string,
  trace: ReadonlyArray<CaseTraceStep>
): ReadonlyArray<string> => [
  ...orderedSequenceIssues(label, trace),
  ...trace.flatMap((step, index) =>
    evidenceEntriesInvariantIssues(`${label}[${index}].facts`, step.facts))
]

const canonicalIssues = (issues: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(issues)].sort(codePointCompare)

const c16FactNames = [
  "journal.has-product-authority",
  "journal.limit-bytes",
  "journal.limit-source"
] as const

const matchesC16Fact = (entry: EvidenceEntryV2, name: (typeof c16FactNames)[number]): boolean => {
  if (entry.name !== name) return false
  if (name === "journal.has-product-authority") {
    return entry.value._tag === "Boolean" && entry.value.value === false
  }
  if (name === "journal.limit-bytes") {
    return entry.value._tag === "Integer" && entry.value.value === 64
  }
  return entry.value._tag === "Text" && entry.value.value === "trial-fixture"
}

export const caseFixtureInvariantIssues = (fixture: CaseFixtureV2): ReadonlyArray<string> => {
  const issues: Array<string> = [
    ...evidenceEntriesInvariantIssues("inputFacts", fixture.inputFacts),
    ...orderedSequenceIssues("faultSchedule", fixture.faultSchedule)
  ]
  const faultCoordinates = fixture.faultSchedule.map(({ actionId, occurrence, faultId }) =>
    `${actionId}\u0000${String(occurrence)}\u0000${faultId}`)
  if (new Set(faultCoordinates).size !== faultCoordinates.length) {
    issues.push("faultSchedule must not repeat an action occurrence and fault id")
  }
  fixture.faultSchedule.forEach((fault, index) => {
    issues.push(...evidenceEntriesInvariantIssues(`faultSchedule[${index}].parameters`, fault.parameters))
  })

  if (fixture.caseId === "C16-journal-bound-symmetry") {
    for (const name of c16FactNames) {
      const fact = fixture.inputFacts.find((entry) => entry.name === name)
      if (fact === undefined || !matchesC16Fact(fact, name)) {
        issues.push(`C16 inputFacts must contain exact ${name} trial-only value`)
      }
    }
  } else if (fixture.inputFacts.some(({ name }) => c16FactNames.includes(
    name as (typeof c16FactNames)[number]
  ))) {
    issues.push("only C16-journal-bound-symmetry may contain trial-only journal limit facts")
  }
  return canonicalIssues(issues)
}

export const expectedCaseEvidenceInvariantIssues = (
  evidence: ExpectedCaseEvidenceV2
): ReadonlyArray<string> => canonicalIssues([
  ...caseTraceInvariantIssues("trace", evidence.trace),
  ...evidenceEntriesInvariantIssues("facts", evidence.facts)
])

export const probeChangeDefinitionInvariantIssues = (
  definition: ProbeChangeDefinitionV2
): ReadonlyArray<string> => canonicalIssues([
  ...evidenceEntriesInvariantIssues("parameters", definition.parameters),
  ...sortedUniqueStringIssues("requiredZeroTouchRoleIds", definition.requiredZeroTouchRoleIds),
  ...sortedUniqueStringIssues("requiredChangeKinds", definition.requiredChangeKinds)
])

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeCaseFixtureStructure = Schema.decodeUnknownEffect(CaseFixtureV2, strictOptions)
const decodeExpectedCaseEvidenceStructure = Schema.decodeUnknownEffect(ExpectedCaseEvidenceV2, strictOptions)
const decodeProbeChangeStructure = Schema.decodeUnknownEffect(ProbeChangeDefinitionV2, strictOptions)
const decodeCaseFixtureSync = Schema.decodeUnknownSync(CaseFixtureV2, strictOptions)
const decodeExpectedCaseEvidenceSync = Schema.decodeUnknownSync(ExpectedCaseEvidenceV2, strictOptions)
const decodeProbeChangeSync = Schema.decodeUnknownSync(ProbeChangeDefinitionV2, strictOptions)
const encodeCaseFixtureStructure = Schema.encodeUnknownSync(CaseFixtureV2, strictOptions)
const encodeExpectedCaseEvidenceStructure = Schema.encodeUnknownSync(ExpectedCaseEvidenceV2, strictOptions)
const encodeProbeChangeStructure = Schema.encodeUnknownSync(ProbeChangeDefinitionV2, strictOptions)

const assertIssues = (issues: ReadonlyArray<string>): void => {
  if (issues.length > 0) throw new TrialEvidenceInvariantError(issues as [string, ...Array<string>])
}

export const decodeCaseFixture = Effect.fn("CaseFixtureV2.decode")(function* (input: unknown) {
  const fixture = yield* decodeCaseFixtureStructure(input)
  const issues = caseFixtureInvariantIssues(fixture)
  if (issues.length > 0) yield* new TrialEvidenceInvariantError(issues as [string, ...Array<string>])
  return fixture
})

export const decodeExpectedCaseEvidence = Effect.fn("ExpectedCaseEvidenceV2.decode")(
  function* (input: unknown) {
    const evidence = yield* decodeExpectedCaseEvidenceStructure(input)
    const issues = expectedCaseEvidenceInvariantIssues(evidence)
    if (issues.length > 0) yield* new TrialEvidenceInvariantError(issues as [string, ...Array<string>])
    return evidence
  }
)

export const decodeProbeChangeDefinition = Effect.fn("ProbeChangeDefinitionV2.decode")(
  function* (input: unknown) {
    const definition = yield* decodeProbeChangeStructure(input)
    const issues = probeChangeDefinitionInvariantIssues(definition)
    if (issues.length > 0) yield* new TrialEvidenceInvariantError(issues as [string, ...Array<string>])
    return definition
  }
)

export const encodeCaseFixture = (fixture: CaseFixtureV2): unknown => {
  assertIssues(caseFixtureInvariantIssues(fixture))
  return encodeCaseFixtureStructure(fixture)
}

export const encodeExpectedCaseEvidence = (evidence: ExpectedCaseEvidenceV2): unknown => {
  assertIssues(expectedCaseEvidenceInvariantIssues(evidence))
  return encodeExpectedCaseEvidenceStructure(evidence)
}

export const encodeProbeChangeDefinition = (definition: ProbeChangeDefinitionV2): unknown => {
  assertIssues(probeChangeDefinitionInvariantIssues(definition))
  return encodeProbeChangeStructure(definition)
}

export const caseFixtureSha256V2 = (input: unknown) => {
  const fixture = decodeCaseFixtureSync(input)
  assertIssues(caseFixtureInvariantIssues(fixture))
  return hashCanonicalValue(
    "ts-release/architecture-case-fixture/v2",
    encodeCaseFixtureStructure(fixture)
  )
}

export const expectedCaseEvidenceSha256V2 = (input: unknown) => {
  const evidence = decodeExpectedCaseEvidenceSync(input)
  assertIssues(expectedCaseEvidenceInvariantIssues(evidence))
  return hashCanonicalValue(
    "ts-release/architecture-expected-case-evidence/v2",
    encodeExpectedCaseEvidenceStructure(evidence)
  )
}

export const probeChangeDefinitionSha256V2 = (input: unknown) => {
  const definition = decodeProbeChangeSync(input)
  assertIssues(probeChangeDefinitionInvariantIssues(definition))
  return hashCanonicalValue(
    "ts-release/architecture-probe-change-definition/v2",
    encodeProbeChangeStructure(definition)
  )
}
