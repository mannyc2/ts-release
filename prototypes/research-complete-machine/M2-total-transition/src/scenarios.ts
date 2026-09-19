import { TypedInterpreter, makeCommand } from "./interpreter.js"
import {
  bool,
  integer,
  sortedFacts,
  text,
  type ActionId,
  type CaseId,
  type CaseInvocation,
  type CaseObservation,
  type EvidenceValue
} from "./contracts.js"

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

export const runCase = (invocation: CaseInvocation): CaseObservation => {
  if (invocation.caseId !== invocation.fixture.caseId) throw new Error("fixture/case mismatch")
  const interpreter = new TypedInterpreter()
  const actions = CASE_ACTIONS[invocation.caseId]
  const trace = actions.map((actionId, index) => {
    interpreter.execute(makeCommand(actionId, invocation.fixture))
    const snapshot = interpreter.snapshot
    const facts: Array<readonly [string, EvidenceValue]> = [
      ["trace.fresh-runner", bool(snapshot.freshRunner)],
      ["trace.journal-revision", integer(snapshot.journalRevision)],
      ["trace.observation-count", integer(snapshot.observationCount)],
      ["trace.provider-dispatch-count", integer(snapshot.dispatchCount)]
    ]
    for (const fault of invocation.fixture.faultSchedule) {
      if (fault.actionId === actionId) facts.push([`trace.${fault.faultId}`, bool(true)])
    }
    if (index === actions.length - 1) facts.push(["trace.terminal-outcome", text(interpreter.outcome)])
    return { actionId, sequence: index + 1, facts: sortedFacts(facts) }
  })
  const snapshot = interpreter.snapshot
  return {
    schemaVersion: "architecture-case-observation-v2",
    runContextSha256: invocation.runContextSha256,
    candidateId: invocation.candidateId,
    candidateTreeSha256: invocation.candidateTreeSha256,
    definitionSha256: invocation.definitionSha256,
    caseId: invocation.caseId,
    fixtureSha256: invocation.fixtureSha256,
    trace,
    facts: sortedFacts([
      ["summary.action-count", integer(actions.length)],
      ["summary.fault-count", integer(invocation.fixture.faultSchedule.length)],
      ["summary.final-journal-revision", integer(snapshot.journalRevision)],
      ["summary.observation-count", integer(snapshot.observationCount)],
      ["summary.provider-dispatch-count", integer(snapshot.dispatchCount)]
    ]),
    terminalOutcome: interpreter.outcome
  }
}

export const selfCheck = (): void => {
  if (Object.keys(CASE_ACTIONS).length !== 16) throw new Error("frozen case table is incomplete")
}
