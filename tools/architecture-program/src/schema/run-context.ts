import { Effect, Schema } from "effect"
import { hashCanonicalValue } from "../trial-hash.js"
import { PlannedRepositoryPath, Sha256Hex } from "./primitives.js"
import { codePointCompare } from "./trial-evidence.js"
import {
  V2CandidateId,
  V2CandidateModel,
  V2CandidateScope,
  V2CaseId,
  V2GateId,
  V2ProbeId,
  V2_CANDIDATE_DEFINITIONS,
  V2_CASE_IDS,
  V2_MACHINE_GATE_IDS,
  V2_PROBE_IDS,
  V2_TOPOLOGY_GATE_IDS
} from "./v2-ids.js"

const wellFormedText = Schema.makeFilter(
  (value: string) => value.isWellFormed() ? undefined : "must not contain an unpaired UTF-16 surrogate"
)
const nfcText = Schema.makeFilter(
  (value: string) => value === value.normalize("NFC") ? undefined : "must be NFC-normalized"
)
const ToolchainVersion = Schema.NonEmptyString.check(wellFormedText, nfcText)

export const TRIAL_RUN_CONTEXT_HASH_DOMAIN = "ts-release/architecture-trial-run-context/v2"

export class TrialRunContextToolchain extends Schema.Class<TrialRunContextToolchain>(
  "TrialRunContextToolchain"
)({
  bun: ToolchainVersion,
  typescript: ToolchainVersion,
  effect: ToolchainVersion,
  git: ToolchainVersion
}) {}

export class CaseDefinitionBindingV2 extends Schema.Class<CaseDefinitionBindingV2>(
  "CaseDefinitionBindingV2"
)({
  caseId: V2CaseId,
  definitionSha256: Sha256Hex,
  fixtureSha256: Sha256Hex,
  expectedEvidenceSha256: Sha256Hex
}) {}

export class ProbeDefinitionBindingV2 extends Schema.Class<ProbeDefinitionBindingV2>(
  "ProbeDefinitionBindingV2"
)({
  probeId: V2ProbeId,
  definitionSha256: Sha256Hex,
  baseFixtureSha256: Sha256Hex,
  changeDefinitionSha256: Sha256Hex
}) {}

export class GateDefinitionBindingV2 extends Schema.Class<GateDefinitionBindingV2>(
  "GateDefinitionBindingV2"
)({
  gateId: V2GateId,
  definitionSha256: Sha256Hex
}) {}

const TrialRunContextBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-trial-run-context/v2"),
  trialSpecSha256: Sha256Hex,
  executionContractSha256: Sha256Hex,
  measurementContractSha256: Sha256Hex,
  topologyFixtureSha256: Sha256Hex,
  candidateId: V2CandidateId,
  candidateScope: V2CandidateScope,
  candidateModel: V2CandidateModel,
  implementationRoot: PlannedRepositoryPath,
  candidateManifestSha256: Sha256Hex,
  candidateTreeSha256: Sha256Hex,
  runnerSourceSha256: Sha256Hex,
  toolchain: TrialRunContextToolchain,
  caseDefinitionBindings: Schema.Array(CaseDefinitionBindingV2),
  probeDefinitionBindings: Schema.Array(ProbeDefinitionBindingV2),
  gateDefinitionBindings: Schema.Array(GateDefinitionBindingV2)
} as const

export const TrialRunContextBody = Schema.Struct(TrialRunContextBodyFields)
export type TrialRunContextBody = typeof TrialRunContextBody.Type
export type TrialRunContextBodyEncoded = typeof TrialRunContextBody.Encoded

export class TrialRunContextV2 extends Schema.Class<TrialRunContextV2>("TrialRunContextV2")({
  runContextSha256: Sha256Hex,
  ...TrialRunContextBodyFields
}) {}

export class TrialRunContextInvariantError extends Schema.TaggedError<TrialRunContextInvariantError>()(
  "TrialRunContextInvariantError",
  { issues: Schema.NonEmptyArray(Schema.String), message: Schema.String }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial run context invariant failure: ${issues.join("; ")}`
    })
  }
}

const exactOrderedIdIssues = (
  label: string,
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>
): ReadonlyArray<string> => actual.length === expected.length &&
    actual.every((id, index) => id === expected[index])
  ? []
  : [`${label} must equal the exact ordered v2 ids [${expected.join(", ")}]`]

const canonicalIssues = (issues: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(issues)].sort(codePointCompare)

export const trialRunContextBodyInvariantIssues = (
  context: TrialRunContextBody
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const candidate = V2_CANDIDATE_DEFINITIONS[context.candidateId]
  if (context.candidateScope !== candidate.scope ||
    context.candidateModel !== candidate.model ||
    context.implementationRoot !== candidate.implementationRoot) {
    issues.push(
      `candidate ${context.candidateId} must use scope ${candidate.scope}, model ${candidate.model}, ` +
      `and implementation root ${candidate.implementationRoot}`
    )
  }
  issues.push(...exactOrderedIdIssues(
    "caseDefinitionBindings",
    context.caseDefinitionBindings.map(({ caseId }) => caseId),
    V2_CASE_IDS
  ))
  issues.push(...exactOrderedIdIssues(
    "probeDefinitionBindings",
    context.probeDefinitionBindings.map(({ probeId }) => probeId),
    V2_PROBE_IDS
  ))
  issues.push(...exactOrderedIdIssues(
    "gateDefinitionBindings",
    context.gateDefinitionBindings.map(({ gateId }) => gateId),
    context.candidateScope === "machine" ? V2_MACHINE_GATE_IDS : V2_TOPOLOGY_GATE_IDS
  ))
  return canonicalIssues(issues)
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeBodyStructure = Schema.decodeUnknownSync(TrialRunContextBody, strictOptions)
const encodeBodyStructure = Schema.encodeUnknownSync(TrialRunContextBody, strictOptions)
const decodeContextStructure = Schema.decodeUnknownEffect(TrialRunContextV2, strictOptions)
const encodeContextStructure = Schema.encodeUnknownSync(TrialRunContextV2, strictOptions)

const assertIssues = (issues: ReadonlyArray<string>): void => {
  if (issues.length > 0) throw new TrialRunContextInvariantError(issues as [string, ...Array<string>])
}

const hashTrialRunContextBody = (body: TrialRunContextBody) =>
  hashCanonicalValue(TRIAL_RUN_CONTEXT_HASH_DOMAIN, encodeBodyStructure(body))

export const computeTrialRunContextSha256 = (input: unknown) => {
  const body = decodeBodyStructure(input)
  assertIssues(trialRunContextBodyInvariantIssues(body))
  return hashTrialRunContextBody(body)
}

export const trialRunContextInvariantIssues = (
  context: TrialRunContextV2
): ReadonlyArray<string> => {
  const { runContextSha256: _runContextSha256, ...body } = context
  const issues = [...trialRunContextBodyInvariantIssues(body)]
  if (context.runContextSha256 !== hashTrialRunContextBody(body)) {
    issues.push("runContextSha256 must bind the canonical encoded run-context body")
  }
  return canonicalIssues(issues)
}

export const makeTrialRunContext = (input: unknown): TrialRunContextV2 => {
  const body = decodeBodyStructure(input)
  assertIssues(trialRunContextBodyInvariantIssues(body))
  return new TrialRunContextV2({
    runContextSha256: computeTrialRunContextSha256(body),
    ...body
  })
}

export const decodeTrialRunContext = Effect.fn("TrialRunContextV2.decode")(function* (input: unknown) {
  const context = yield* decodeContextStructure(input)
  const issues = trialRunContextInvariantIssues(context)
  if (issues.length > 0) yield* new TrialRunContextInvariantError(issues as [string, ...Array<string>])
  return context
})

export const encodeTrialRunContext = (context: TrialRunContextV2): unknown => {
  assertIssues(trialRunContextInvariantIssues(context))
  return encodeContextStructure(context)
}
