export const CASE_IDS = [
  "C01-initial-success",
  "C02-rejection-before-commit",
  "C03-response-loss-satisfied-observation",
  "C04-response-loss-inconclusive-stop",
  "C05-core-git-cas-protected-replay",
  "C06-explicit-risk-acceptance",
  "C07-concurrent-runners-single-cas-winner",
  "C08-request-endpoint-mismatch",
  "C09-supersession-late-evidence",
  "C10-ambiguous-append-readback",
  "C11-malformed-provider-graph",
  "C12-external-provider-two-instances",
  "C13-apple-commit-before-id-loss",
  "C14-finalized-file-tree-adoption",
  "C15-host-dependency-shadowing",
  "C16-journal-bound-symmetry"
] as const

export type CaseId = (typeof CASE_IDS)[number]

export const ACTION_IDS = [
  "action.adopt-finalized-artifacts",
  "action.append-dispatch-authority",
  "action.append-late-evidence",
  "action.append-risk-acceptance",
  "action.append-supersession",
  "action.attempt-host-shadow",
  "action.contend-append-cas",
  "action.derive-terminal-report",
  "action.dispatch-operation",
  "action.initialize-operation",
  "action.load-external-provider",
  "action.observe-operation",
  "action.prepare-operation",
  "action.read-journal-at-limit",
  "action.reconcile-ambiguous-append",
  "action.record-precommit-rejection",
  "action.record-provider-receipt",
  "action.refold-after-cas-loss",
  "action.reject-journal-read-over-limit",
  "action.reject-journal-write-over-limit",
  "action.request-risk-acceptance",
  "action.resume-fresh-runner",
  "action.submit-apple-operation",
  "action.validate-provider-graph",
  "action.verify-request-correspondence",
  "action.write-journal-at-limit"
] as const

export type ActionId = (typeof ACTION_IDS)[number]
export type TerminalOutcome = "Succeeded" | "Rejected" | "SafeStop" | "Inconclusive"

export type EvidenceValue =
  | { readonly _tag: "Boolean"; readonly value: boolean }
  | { readonly _tag: "Integer"; readonly value: number }
  | { readonly _tag: "Sha256"; readonly value: string }
  | { readonly _tag: "Text"; readonly value: string }

export interface EvidenceEntry {
  readonly name: string
  readonly sequence: number
  readonly value: EvidenceValue
}

export interface FaultSpec {
  readonly sequence: number
  readonly faultId: string
  readonly actionId: ActionId
  readonly occurrence: number
  readonly parameters: ReadonlyArray<EvidenceEntry>
}

export interface CaseFixture {
  readonly schemaVersion: "architecture-case-fixture-v2"
  readonly caseId: CaseId
  readonly deterministicSeed: string
  readonly releaseId: string
  readonly operationId: string
  readonly requestId: string
  readonly endpointId: string
  readonly initialRevision: number
  readonly inputFacts: ReadonlyArray<EvidenceEntry>
  readonly faultSchedule: ReadonlyArray<FaultSpec>
}

interface InvocationBinding {
  readonly runContextSha256: string
  readonly candidateId: string
  readonly candidateTreeSha256: string
  readonly definitionSha256: string
}

export interface CaseInvocation extends InvocationBinding {
  readonly schemaVersion: "architecture-case-invocation-v2"
  readonly caseId: CaseId
  readonly fixtureSha256: string
  readonly fixture: CaseFixture
}

export interface ProbeChangeDefinition {
  readonly schemaVersion: "architecture-probe-change-definition-v2"
  readonly probeId: string
  readonly changeId: string
  readonly baseFixtureSha256: string
  readonly actionId: string
  readonly parameters: ReadonlyArray<EvidenceEntry>
  readonly requiredZeroTouchRoleIds: ReadonlyArray<string>
  readonly requiredChangeKinds: ReadonlyArray<string>
}

export interface ProbeInvocation extends InvocationBinding {
  readonly schemaVersion: "architecture-probe-invocation-v2"
  readonly probeId: string
  readonly baseFixtureSha256: string
  readonly changeDefinitionSha256: string
  readonly changeDefinition: ProbeChangeDefinition
}

export interface GateInvocation extends InvocationBinding {
  readonly schemaVersion: "architecture-gate-invocation-v2"
  readonly gateId: string
  readonly lawIds: ReadonlyArray<string>
  readonly caseIds: ReadonlyArray<CaseId>
  readonly probeIds: ReadonlyArray<string>
}

export interface CaseObservation extends InvocationBinding {
  readonly schemaVersion: "architecture-case-observation-v2"
  readonly caseId: CaseId
  readonly fixtureSha256: string
  readonly trace: ReadonlyArray<{ readonly actionId: ActionId; readonly facts: ReadonlyArray<EvidenceEntry>; readonly sequence: number }>
  readonly facts: ReadonlyArray<EvidenceEntry>
  readonly terminalOutcome: TerminalOutcome
}

export interface ProbeObservation extends InvocationBinding {
  readonly schemaVersion: "architecture-probe-observation-v2"
  readonly probeId: string
  readonly baseFixtureSha256: string
  readonly changeDefinitionSha256: string
  readonly changeId: string
  readonly facts: ReadonlyArray<EvidenceEntry>
}

export interface GateObservation extends InvocationBinding {
  readonly schemaVersion: "architecture-gate-observation-v2"
  readonly gateId: string
  readonly facts: ReadonlyArray<EvidenceEntry>
}

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(source).sort(compare).map((key) => [key, canonicalize(source[key])]))
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error("canonical JSON accepts only safe integers")
  if (value === undefined) throw new Error("undefined is not canonical JSON")
  return value
}

export const canonicalStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value))}\n`
export const bool = (value: boolean): EvidenceValue => ({ _tag: "Boolean", value })
export const integer = (value: number): EvidenceValue => ({ _tag: "Integer", value })
export const text = (value: string): EvidenceValue => ({ _tag: "Text", value })
export const sortedFacts = (facts: ReadonlyArray<readonly [string, EvidenceValue]>): ReadonlyArray<EvidenceEntry> =>
  [...facts].sort(([left], [right]) => compare(left, right)).map(([name, value], index) => ({ name, sequence: index + 1, value }))
