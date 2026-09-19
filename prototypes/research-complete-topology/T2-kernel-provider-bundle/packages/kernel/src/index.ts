export const CASE_IDS = [
  "C01-initial-success", "C02-rejection-before-commit", "C03-response-loss-satisfied-observation", "C04-response-loss-inconclusive-stop",
  "C05-core-git-cas-protected-replay", "C06-explicit-risk-acceptance", "C07-concurrent-runners-single-cas-winner", "C08-request-endpoint-mismatch",
  "C09-supersession-late-evidence", "C10-ambiguous-append-readback", "C11-malformed-provider-graph", "C12-external-provider-two-instances",
  "C13-apple-commit-before-id-loss", "C14-finalized-file-tree-adoption", "C15-host-dependency-shadowing", "C16-journal-bound-symmetry"
] as const
export type CaseId = (typeof CASE_IDS)[number]
export type TerminalOutcome = "Succeeded" | "Rejected" | "SafeStop" | "Inconclusive"
export type ActionId =
  | "action.initialize-operation" | "action.prepare-operation" | "action.validate-provider-graph" | "action.append-dispatch-authority"
  | "action.dispatch-operation" | "action.record-provider-receipt" | "action.observe-operation" | "action.derive-terminal-report"
  | "action.record-precommit-rejection" | "action.resume-fresh-runner" | "action.request-risk-acceptance" | "action.append-risk-acceptance"
  | "action.contend-append-cas" | "action.refold-after-cas-loss" | "action.verify-request-correspondence" | "action.append-supersession"
  | "action.append-late-evidence" | "action.reconcile-ambiguous-append" | "action.load-external-provider" | "action.submit-apple-operation"
  | "action.adopt-finalized-artifacts" | "action.attempt-host-shadow" | "action.write-journal-at-limit" | "action.read-journal-at-limit"
  | "action.reject-journal-write-over-limit" | "action.reject-journal-read-over-limit"
export type EvidenceValue = { readonly _tag: "Boolean"; readonly value: boolean } | { readonly _tag: "Integer"; readonly value: number } | { readonly _tag: "Sha256"; readonly value: string } | { readonly _tag: "Text"; readonly value: string }
export interface EvidenceEntry { readonly name: string; readonly sequence: number; readonly value: EvidenceValue }
export interface FaultSpec { readonly sequence: number; readonly faultId: string; readonly actionId: ActionId; readonly occurrence: number; readonly parameters: ReadonlyArray<EvidenceEntry> }
export interface CaseFixture { readonly schemaVersion: "architecture-case-fixture-v2"; readonly caseId: CaseId; readonly deterministicSeed: string; readonly releaseId: string; readonly operationId: string; readonly requestId: string; readonly endpointId: string; readonly initialRevision: number; readonly inputFacts: ReadonlyArray<EvidenceEntry>; readonly faultSchedule: ReadonlyArray<FaultSpec> }
interface InvocationBinding { readonly runContextSha256: string; readonly candidateId: string; readonly candidateTreeSha256: string; readonly definitionSha256: string }
export interface CaseInvocation extends InvocationBinding { readonly schemaVersion: "architecture-case-invocation-v2"; readonly caseId: CaseId; readonly fixtureSha256: string; readonly fixture: CaseFixture }
export interface ProbeInvocation extends InvocationBinding { readonly schemaVersion: "architecture-probe-invocation-v2"; readonly probeId: string; readonly baseFixtureSha256: string; readonly changeDefinitionSha256: string; readonly changeDefinition: { readonly schemaVersion: string; readonly probeId: string; readonly changeId: string; readonly baseFixtureSha256: string; readonly actionId: string; readonly parameters: ReadonlyArray<EvidenceEntry>; readonly requiredZeroTouchRoleIds: ReadonlyArray<string>; readonly requiredChangeKinds: ReadonlyArray<string> } }
export interface GateInvocation extends InvocationBinding { readonly schemaVersion: "architecture-gate-invocation-v2"; readonly gateId: string; readonly lawIds: ReadonlyArray<string>; readonly caseIds: ReadonlyArray<CaseId>; readonly probeIds: ReadonlyArray<string> }
export interface ProviderPlugin { readonly id: string; readonly instances: ReadonlyArray<{ readonly id: string; readonly endpointClass: string }>; readonly prepare: (instanceId: string, requestId: string) => { readonly providerId: string; readonly instanceId: string; readonly requestId: string } }

export const FORBIDDEN_TRANSITIONS = ["Ready->derive-terminal-report", "Planned->derive-terminal-report", "Authorized->derive-terminal-report", "RiskAccepted->derive-terminal-report"] as const
export const CASE_ACTIONS: Record<CaseId, ReadonlyArray<ActionId>> = {
  "C01-initial-success": ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.record-provider-receipt", "action.observe-operation", "action.derive-terminal-report"],
  "C02-rejection-before-commit": ["action.initialize-operation", "action.prepare-operation", "action.record-precommit-rejection", "action.derive-terminal-report"],
  "C03-response-loss-satisfied-observation": ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.resume-fresh-runner", "action.observe-operation", "action.derive-terminal-report"],
  "C04-response-loss-inconclusive-stop": ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.resume-fresh-runner", "action.observe-operation", "action.derive-terminal-report"],
  "C05-core-git-cas-protected-replay": ["action.initialize-operation", "action.prepare-operation", "action.observe-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.observe-operation", "action.derive-terminal-report"],
  "C06-explicit-risk-acceptance": ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.observe-operation", "action.request-risk-acceptance", "action.append-risk-acceptance", "action.append-dispatch-authority", "action.dispatch-operation", "action.observe-operation", "action.derive-terminal-report"],
  "C07-concurrent-runners-single-cas-winner": ["action.initialize-operation", "action.prepare-operation", "action.contend-append-cas", "action.refold-after-cas-loss", "action.dispatch-operation", "action.observe-operation", "action.derive-terminal-report"],
  "C08-request-endpoint-mismatch": ["action.initialize-operation", "action.prepare-operation", "action.verify-request-correspondence", "action.derive-terminal-report"],
  "C09-supersession-late-evidence": ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.append-supersession", "action.append-late-evidence", "action.derive-terminal-report"],
  "C10-ambiguous-append-readback": ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.reconcile-ambiguous-append", "action.derive-terminal-report"],
  "C11-malformed-provider-graph": ["action.initialize-operation", "action.validate-provider-graph", "action.derive-terminal-report"],
  "C12-external-provider-two-instances": ["action.load-external-provider", "action.validate-provider-graph", "action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.observe-operation", "action.derive-terminal-report"],
  "C13-apple-commit-before-id-loss": ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.submit-apple-operation", "action.resume-fresh-runner", "action.observe-operation", "action.derive-terminal-report"],
  "C14-finalized-file-tree-adoption": ["action.adopt-finalized-artifacts", "action.derive-terminal-report"],
  "C15-host-dependency-shadowing": ["action.attempt-host-shadow", "action.derive-terminal-report"],
  "C16-journal-bound-symmetry": ["action.write-journal-at-limit", "action.read-journal-at-limit", "action.reject-journal-write-over-limit", "action.reject-journal-read-over-limit", "action.derive-terminal-report"]
}
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0
export const canonicalStringify = (value: unknown): string => { const visit = (item: unknown): unknown => Array.isArray(item) ? item.map(visit) : item !== null && typeof item === "object" ? Object.fromEntries(Object.keys(item as Record<string, unknown>).sort(compare).map((key) => [key, visit((item as Record<string, unknown>)[key])])) : item; return `${JSON.stringify(visit(value))}\n` }
export const bool = (value: boolean): EvidenceValue => ({ _tag: "Boolean", value })
export const integer = (value: number): EvidenceValue => ({ _tag: "Integer", value })
export const text = (value: string): EvidenceValue => ({ _tag: "Text", value })
export const sortedFacts = (facts: ReadonlyArray<readonly [string, EvidenceValue]>): ReadonlyArray<EvidenceEntry> => [...facts].sort(([a], [b]) => compare(a, b)).map(([name, value], index) => ({ name, sequence: index + 1, value }))
type State = "Ready" | "Planned" | "Authorized" | "InFlight" | "Unproven" | "RiskAccepted" | "Satisfied" | "Rejected" | "Superseded" | "SafeStopped"
const hasFault = (fixture: CaseFixture, actionId: ActionId, faultId: string): boolean => fixture.faultSchedule.some((fault) => fault.actionId === actionId && fault.faultId === faultId)
const hasAnyFault = (fixture: CaseFixture, faultId: string): boolean => fixture.faultSchedule.some((fault) => fault.faultId === faultId)
const integerInput = (fixture: CaseFixture, name: string): number => { const value = fixture.inputFacts.find((fact) => fact.name === name)?.value; if (value?._tag !== "Integer") throw new Error(`missing integer fixture fact ${name}`); return value.value }
class Machine {
  state: State = "Ready"; revision = 0; dispatchCount = 0; observationCount = 0; freshRunner = false; terminalOutcome: TerminalOutcome | undefined; journalLimit = 0
  record(state: State, durable = false): void { this.state = state; if (durable) this.revision += 1 }
  apply(action: ActionId, fixture: CaseFixture): void {
    if (action === "action.derive-terminal-report") { if (this.state === "Satisfied") this.terminalOutcome = "Succeeded"; else if (this.state === "Rejected") this.terminalOutcome = "Rejected"; else if (this.state === "Superseded" || this.state === "SafeStopped") this.terminalOutcome = "SafeStop"; else if (this.state === "InFlight" || this.state === "Unproven") this.terminalOutcome = "Inconclusive"; else throw new Error(`terminal report requested from ${this.state}`); return }
    switch (action) {
      case "action.initialize-operation": if (hasFault(fixture, action, "fault.prior-dispatch-response-loss")) this.record("InFlight"); if (hasFault(fixture, action, "fault.prior-inconclusive-operation")) this.record("Unproven"); return
      case "action.prepare-operation": this.record("Planned"); return
      case "action.append-dispatch-authority": this.record("Authorized", true); return
      case "action.dispatch-operation": case "action.submit-apple-operation": if (this.state !== "Authorized") throw new Error("dispatch without authority"); this.dispatchCount += 1; this.record("InFlight"); return
      case "action.record-provider-receipt": this.record("InFlight", true); return
      case "action.record-precommit-rejection": this.record("Rejected", true); return
      case "action.resume-fresh-runner": this.freshRunner = true; return
      case "action.observe-operation": if (hasFault(fixture, action, "fault.observation-absence") || hasAnyFault(fixture, "fault.apple-submission-id-loss")) { this.record("Unproven"); return }; this.observationCount += 1; if ((hasAnyFault(fixture, "fault.prior-dispatch-response-loss") || hasAnyFault(fixture, "fault.prior-inconclusive-operation")) && this.observationCount === 1) this.record("Unproven", true); else this.record("Satisfied", true); return
      case "action.request-risk-acceptance": if (this.state !== "Unproven") throw new Error("risk acceptance without evidence"); return
      case "action.append-risk-acceptance": this.record("RiskAccepted", true); return
      case "action.contend-append-cas": this.record("Authorized"); return
      case "action.refold-after-cas-loss": if (this.state !== "Authorized") throw new Error("CAS refold failed"); return
      case "action.verify-request-correspondence": if (!hasFault(fixture, action, "fault.request-endpoint-mismatch")) throw new Error("missing mismatch"); this.record("Rejected"); return
      case "action.append-supersession": case "action.append-late-evidence": this.record("Superseded", true); return
      case "action.reconcile-ambiguous-append": if (!hasFault(fixture, "action.append-dispatch-authority", "fault.append-outcome-unknown")) throw new Error("missing ambiguity"); this.record("SafeStopped", true); return
      case "action.validate-provider-graph": if (hasFault(fixture, action, "fault.malformed-provider-graph")) this.record("Rejected"); return
      case "action.load-external-provider": return
      case "action.adopt-finalized-artifacts": this.record("Satisfied", true); return
      case "action.attempt-host-shadow": this.record("Rejected"); return
      case "action.write-journal-at-limit": this.journalLimit = integerInput(fixture, "journal.limit-bytes"); this.record("SafeStopped", true); return
      case "action.read-journal-at-limit": if (this.journalLimit !== integerInput(fixture, "journal.limit-bytes")) throw new Error("limit mismatch"); return
      case "action.reject-journal-write-over-limit": case "action.reject-journal-read-over-limit": if (this.journalLimit <= 0) throw new Error("store missing"); return
    }
  }
}
export const runCase = (invocation: CaseInvocation) => {
  if (invocation.fixture.caseId !== invocation.caseId) throw new Error("case and fixture differ")
  const machine = new Machine(); const actions = CASE_ACTIONS[invocation.caseId]
  const trace = actions.map((actionId, index) => { machine.apply(actionId, invocation.fixture); const facts: Array<readonly [string, EvidenceValue]> = [["trace.fresh-runner", bool(machine.freshRunner)], ["trace.journal-revision", integer(machine.revision)], ["trace.observation-count", integer(machine.observationCount)], ["trace.provider-dispatch-count", integer(machine.dispatchCount)]]; for (const fault of invocation.fixture.faultSchedule) if (fault.actionId === actionId) facts.push([`trace.${fault.faultId}`, bool(true)]); if (index === actions.length - 1) facts.push(["trace.terminal-outcome", text(machine.terminalOutcome!)]); return { actionId, facts: sortedFacts(facts), sequence: index + 1 } })
  return { schemaVersion: "architecture-case-observation-v2", runContextSha256: invocation.runContextSha256, candidateId: invocation.candidateId, candidateTreeSha256: invocation.candidateTreeSha256, definitionSha256: invocation.definitionSha256, caseId: invocation.caseId, fixtureSha256: invocation.fixtureSha256, trace, facts: sortedFacts([["summary.action-count", integer(actions.length)], ["summary.fault-count", integer(invocation.fixture.faultSchedule.length)], ["summary.final-journal-revision", integer(machine.revision)], ["summary.observation-count", integer(machine.observationCount)], ["summary.provider-dispatch-count", integer(machine.dispatchCount)]]), terminalOutcome: machine.terminalOutcome! }
}
