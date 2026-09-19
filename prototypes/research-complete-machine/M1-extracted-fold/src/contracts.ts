export const caseIds = [
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

export type CaseId = (typeof caseIds)[number]

export type ActionId =
  | "action.initialize-operation"
  | "action.prepare-operation"
  | "action.append-dispatch-authority"
  | "action.dispatch-operation"
  | "action.record-provider-receipt"
  | "action.observe-operation"
  | "action.derive-terminal-report"
  | "action.record-precommit-rejection"
  | "action.resume-fresh-runner"
  | "action.request-risk-acceptance"
  | "action.append-risk-acceptance"
  | "action.contend-append-cas"
  | "action.refold-after-cas-loss"
  | "action.verify-request-correspondence"
  | "action.append-supersession"
  | "action.append-late-evidence"
  | "action.reconcile-ambiguous-append"
  | "action.validate-provider-graph"
  | "action.load-external-provider"
  | "action.submit-apple-operation"
  | "action.adopt-finalized-artifacts"
  | "action.attempt-host-shadow"
  | "action.write-journal-at-limit"
  | "action.read-journal-at-limit"
  | "action.reject-journal-write-over-limit"
  | "action.reject-journal-read-over-limit"

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

const compareCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(source).sort(compareCodePoint).map((key) => [key, canonicalize(source[key])]))
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite JSON number")
  if (value === undefined) throw new Error("undefined is not canonical JSON")
  return value
}

export const canonicalStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value))}\n`

export const sortedFacts = (facts: ReadonlyArray<readonly [string, EvidenceValue]>): ReadonlyArray<EvidenceEntry> =>
  [...facts]
    .sort(([left], [right]) => compareCodePoint(left, right))
    .map(([name, value], index) => ({ name, sequence: index + 1, value }))

export const bool = (value: boolean): EvidenceValue => ({ _tag: "Boolean", value })
export const integer = (value: number): EvidenceValue => ({ _tag: "Integer", value })
export const text = (value: string): EvidenceValue => ({ _tag: "Text", value })

export const assertNever = (value: never): never => {
  throw new Error(`unhandled value: ${String(value)}`)
}
