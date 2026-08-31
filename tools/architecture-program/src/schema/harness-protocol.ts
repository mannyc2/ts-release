import { Effect, Schema } from "effect"
import { ArtifactId, Sha256Hex } from "./primitives.js"
import {
  CaseFixtureV2,
  CaseTraceStep,
  EvidenceEntryV2,
  ProbeChangeDefinitionV2,
  TerminalOutcome,
  caseFixtureInvariantIssues,
  caseFixtureSha256V2,
  caseTraceInvariantIssues,
  codePointCompare,
  evidenceEntriesInvariantIssues,
  probeChangeDefinitionInvariantIssues,
  probeChangeDefinitionSha256V2,
  sortedUniqueStringIssues
} from "./trial-evidence.js"
import { V2CandidateId, V2CaseId, V2GateId, V2ProbeId } from "./v2-ids.js"

const ImmutableInvocationBindings = {
  runContextSha256: Sha256Hex,
  candidateId: V2CandidateId,
  candidateTreeSha256: Sha256Hex,
  definitionSha256: Sha256Hex
} as const

export class ArchitectureCaseInvocationV2 extends Schema.Class<ArchitectureCaseInvocationV2>(
  "ArchitectureCaseInvocationV2"
)({
  schemaVersion: Schema.Literal("architecture-case-invocation-v2"),
  ...ImmutableInvocationBindings,
  caseId: V2CaseId,
  fixtureSha256: Sha256Hex,
  fixture: CaseFixtureV2
}) {}

export class ArchitectureProbeInvocationV2 extends Schema.Class<ArchitectureProbeInvocationV2>(
  "ArchitectureProbeInvocationV2"
)({
  schemaVersion: Schema.Literal("architecture-probe-invocation-v2"),
  ...ImmutableInvocationBindings,
  probeId: V2ProbeId,
  baseFixtureSha256: Sha256Hex,
  changeDefinitionSha256: Sha256Hex,
  changeDefinition: ProbeChangeDefinitionV2
}) {}

export class ArchitectureGateInvocationV2 extends Schema.Class<ArchitectureGateInvocationV2>(
  "ArchitectureGateInvocationV2"
)({
  schemaVersion: Schema.Literal("architecture-gate-invocation-v2"),
  ...ImmutableInvocationBindings,
  gateId: V2GateId,
  lawIds: Schema.Array(ArtifactId),
  caseIds: Schema.Array(V2CaseId),
  probeIds: Schema.Array(V2ProbeId)
}) {}

export class ArchitectureCaseObservationV2 extends Schema.Class<ArchitectureCaseObservationV2>(
  "ArchitectureCaseObservationV2"
)({
  schemaVersion: Schema.Literal("architecture-case-observation-v2"),
  ...ImmutableInvocationBindings,
  caseId: V2CaseId,
  fixtureSha256: Sha256Hex,
  trace: Schema.NonEmptyArray(CaseTraceStep),
  facts: Schema.NonEmptyArray(EvidenceEntryV2),
  terminalOutcome: TerminalOutcome
}) {}

export class ArchitectureProbeObservationV2 extends Schema.Class<ArchitectureProbeObservationV2>(
  "ArchitectureProbeObservationV2"
)({
  schemaVersion: Schema.Literal("architecture-probe-observation-v2"),
  ...ImmutableInvocationBindings,
  probeId: V2ProbeId,
  baseFixtureSha256: Sha256Hex,
  changeDefinitionSha256: Sha256Hex,
  changeId: ArtifactId,
  facts: Schema.NonEmptyArray(EvidenceEntryV2)
}) {}

export class ArchitectureGateObservationV2 extends Schema.Class<ArchitectureGateObservationV2>(
  "ArchitectureGateObservationV2"
)({
  schemaVersion: Schema.Literal("architecture-gate-observation-v2"),
  ...ImmutableInvocationBindings,
  gateId: V2GateId,
  facts: Schema.NonEmptyArray(EvidenceEntryV2)
}) {}

export class HarnessProtocolInvariantError extends Schema.TaggedError<HarnessProtocolInvariantError>()(
  "HarnessProtocolInvariantError",
  { issues: Schema.NonEmptyArray(Schema.String), message: Schema.String }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture candidate harness protocol invariant failure: ${issues.join("; ")}`
    })
  }
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const

const makeStructureCodec = <S extends Schema.ConstraintEncoder<unknown>>(schema: S, name: string) => {
  const decode = Schema.decodeUnknownEffect(schema, strictOptions)
  const encode = Schema.encodeUnknownSync(schema, strictOptions)
  return {
    decode: Effect.fn(`${name}.decodeStructure`)(function* (input: unknown) {
      return yield* decode(input)
    }),
    encode
  }
}

export const caseInvocationStructureCodec = makeStructureCodec(
  ArchitectureCaseInvocationV2,
  "ArchitectureCaseInvocationV2"
)
export const probeInvocationStructureCodec = makeStructureCodec(
  ArchitectureProbeInvocationV2,
  "ArchitectureProbeInvocationV2"
)
export const gateInvocationStructureCodec = makeStructureCodec(
  ArchitectureGateInvocationV2,
  "ArchitectureGateInvocationV2"
)
export const caseObservationStructureCodec = makeStructureCodec(
  ArchitectureCaseObservationV2,
  "ArchitectureCaseObservationV2"
)
export const probeObservationStructureCodec = makeStructureCodec(
  ArchitectureProbeObservationV2,
  "ArchitectureProbeObservationV2"
)
export const gateObservationStructureCodec = makeStructureCodec(
  ArchitectureGateObservationV2,
  "ArchitectureGateObservationV2"
)

const canonicalIssues = (issues: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(issues)].sort(codePointCompare)

const assertIssues = (issues: ReadonlyArray<string>): void => {
  if (issues.length > 0) throw new HarnessProtocolInvariantError(issues as [string, ...Array<string>])
}

const failOnIssues = (issues: ReadonlyArray<string>) =>
  issues.length > 0
    ? Effect.fail(new HarnessProtocolInvariantError(issues as [string, ...Array<string>]))
    : Effect.void

export const caseInvocationInvariantIssues = (
  invocation: ArchitectureCaseInvocationV2
): ReadonlyArray<string> => {
  const fixtureIssues = caseFixtureInvariantIssues(invocation.fixture)
  const issues = [...fixtureIssues]
  if (invocation.fixture.caseId !== invocation.caseId) {
    issues.push("fixture.caseId must equal invocation caseId")
  }
  if (fixtureIssues.length === 0 && caseFixtureSha256V2(invocation.fixture) !== invocation.fixtureSha256) {
    issues.push("fixtureSha256 must bind the canonical encoded fixture")
  }
  return canonicalIssues(issues)
}

export const probeInvocationInvariantIssues = (
  invocation: ArchitectureProbeInvocationV2
): ReadonlyArray<string> => {
  const definitionIssues = probeChangeDefinitionInvariantIssues(invocation.changeDefinition)
  const issues = [...definitionIssues]
  if (invocation.changeDefinition.probeId !== invocation.probeId) {
    issues.push("changeDefinition.probeId must equal invocation probeId")
  }
  if (invocation.changeDefinition.baseFixtureSha256 !== invocation.baseFixtureSha256) {
    issues.push("changeDefinition.baseFixtureSha256 must equal invocation baseFixtureSha256")
  }
  if (definitionIssues.length === 0 &&
    probeChangeDefinitionSha256V2(invocation.changeDefinition) !== invocation.changeDefinitionSha256) {
    issues.push("changeDefinitionSha256 must bind the canonical encoded change definition")
  }
  return canonicalIssues(issues)
}

export const gateInvocationInvariantIssues = (
  invocation: ArchitectureGateInvocationV2
): ReadonlyArray<string> => canonicalIssues([
  ...sortedUniqueStringIssues("lawIds", invocation.lawIds),
  ...sortedUniqueStringIssues("caseIds", invocation.caseIds),
  ...sortedUniqueStringIssues("probeIds", invocation.probeIds)
])

export const caseObservationInvariantIssues = (
  observation: ArchitectureCaseObservationV2
): ReadonlyArray<string> => canonicalIssues([
  ...caseTraceInvariantIssues("trace", observation.trace),
  ...evidenceEntriesInvariantIssues("facts", observation.facts)
])

export const probeObservationInvariantIssues = (
  observation: ArchitectureProbeObservationV2
): ReadonlyArray<string> => canonicalIssues(
  evidenceEntriesInvariantIssues("facts", observation.facts)
)

export const gateObservationInvariantIssues = (
  observation: ArchitectureGateObservationV2
): ReadonlyArray<string> => canonicalIssues(
  evidenceEntriesInvariantIssues("facts", observation.facts)
)

export const decodeCaseInvocation = Effect.fn("ArchitectureCaseInvocationV2.decodeInvariant")(
  function* (input: unknown) {
    const invocation = yield* caseInvocationStructureCodec.decode(input)
    yield* failOnIssues(caseInvocationInvariantIssues(invocation))
    return invocation
  }
)

export const decodeProbeInvocation = Effect.fn("ArchitectureProbeInvocationV2.decodeInvariant")(
  function* (input: unknown) {
    const invocation = yield* probeInvocationStructureCodec.decode(input)
    yield* failOnIssues(probeInvocationInvariantIssues(invocation))
    return invocation
  }
)

export const decodeGateInvocation = Effect.fn("ArchitectureGateInvocationV2.decodeInvariant")(
  function* (input: unknown) {
    const invocation = yield* gateInvocationStructureCodec.decode(input)
    yield* failOnIssues(gateInvocationInvariantIssues(invocation))
    return invocation
  }
)

export const caseInvocationCodec = {
  decode: decodeCaseInvocation,
  encode: (invocation: ArchitectureCaseInvocationV2): unknown => {
    assertIssues(caseInvocationInvariantIssues(invocation))
    return caseInvocationStructureCodec.encode(invocation)
  }
}

export const probeInvocationCodec = {
  decode: decodeProbeInvocation,
  encode: (invocation: ArchitectureProbeInvocationV2): unknown => {
    assertIssues(probeInvocationInvariantIssues(invocation))
    return probeInvocationStructureCodec.encode(invocation)
  }
}

export const gateInvocationCodec = {
  decode: decodeGateInvocation,
  encode: (invocation: ArchitectureGateInvocationV2): unknown => {
    assertIssues(gateInvocationInvariantIssues(invocation))
    return gateInvocationStructureCodec.encode(invocation)
  }
}

const immutableEchoIssues = (
  invocation: {
    readonly runContextSha256: string
    readonly candidateId: string
    readonly candidateTreeSha256: string
    readonly definitionSha256: string
  },
  observation: {
    readonly runContextSha256: string
    readonly candidateId: string
    readonly candidateTreeSha256: string
    readonly definitionSha256: string
  }
): ReadonlyArray<string> => [
  ...(observation.runContextSha256 === invocation.runContextSha256
    ? []
    : ["observation runContextSha256 must echo invocation"]),
  ...(observation.candidateId === invocation.candidateId
    ? []
    : ["observation candidateId must echo invocation"]),
  ...(observation.candidateTreeSha256 === invocation.candidateTreeSha256
    ? []
    : ["observation candidateTreeSha256 must echo invocation"]),
  ...(observation.definitionSha256 === invocation.definitionSha256
    ? []
    : ["observation definitionSha256 must echo invocation"])
]

export const decodeCaseObservationForInvocation = Effect.fn(
  "ArchitectureCaseObservationV2.decodeForInvocation"
)(function* (invocation: ArchitectureCaseInvocationV2, input: unknown) {
  const observation = yield* caseObservationStructureCodec.decode(input)
  const issues = canonicalIssues([
    ...immutableEchoIssues(invocation, observation),
    ...(observation.caseId === invocation.caseId
      ? []
      : ["observation caseId must echo invocation"]),
    ...(observation.fixtureSha256 === invocation.fixtureSha256
      ? []
      : ["observation fixtureSha256 must echo invocation"]),
    ...caseObservationInvariantIssues(observation)
  ])
  yield* failOnIssues(issues)
  return observation
})

export const decodeProbeObservationForInvocation = Effect.fn(
  "ArchitectureProbeObservationV2.decodeForInvocation"
)(function* (invocation: ArchitectureProbeInvocationV2, input: unknown) {
  const observation = yield* probeObservationStructureCodec.decode(input)
  const issues = canonicalIssues([
    ...immutableEchoIssues(invocation, observation),
    ...(observation.probeId === invocation.probeId
      ? []
      : ["observation probeId must echo invocation"]),
    ...(observation.baseFixtureSha256 === invocation.baseFixtureSha256
      ? []
      : ["observation baseFixtureSha256 must echo invocation"]),
    ...(observation.changeDefinitionSha256 === invocation.changeDefinitionSha256
      ? []
      : ["observation changeDefinitionSha256 must echo invocation"]),
    ...(observation.changeId === invocation.changeDefinition.changeId
      ? []
      : ["observation changeId must echo invocation change definition"]),
    ...probeObservationInvariantIssues(observation)
  ])
  yield* failOnIssues(issues)
  return observation
})

export const decodeGateObservationForInvocation = Effect.fn(
  "ArchitectureGateObservationV2.decodeForInvocation"
)(function* (invocation: ArchitectureGateInvocationV2, input: unknown) {
  const observation = yield* gateObservationStructureCodec.decode(input)
  const issues = canonicalIssues([
    ...immutableEchoIssues(invocation, observation),
    ...(observation.gateId === invocation.gateId
      ? []
      : ["observation gateId must echo invocation"]),
    ...gateObservationInvariantIssues(observation)
  ])
  yield* failOnIssues(issues)
  return observation
})
