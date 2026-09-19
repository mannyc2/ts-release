import { AcceptedRisk, DispatchBasis, Initial, JournalEvent } from "./ReleaseModel.js"
import { NonCommit, Plan, ProtectedReplay, RequestFacts } from "./ReleaseModel.js"
import type { OperationStatus, ReleaseReport } from "./ReleaseModel.js"
import type { Scope } from "../Journal.js"
import { canonical } from "./Identity.js"
import { fail } from "./Error.js"

export type CandidateRequest = Readonly<{ facts: RequestFacts; fingerprint: string }>
export type Next =
  | { readonly _tag: "PrepareDispatch" }
  | { readonly _tag: "AppendDispatch"; readonly basis: DispatchBasis }
  | { readonly _tag: "RequestRiskAcceptance" }
  | { readonly _tag: "Finish"; readonly status: OperationStatus }
export interface Machine {
  readonly append: (event: JournalEvent) => Machine
  readonly report: () => ReleaseReport
  readonly next: (operationId: string, candidate: CandidateRequest | null, now: number) => Next
}
type Body<Tag extends JournalEvent["body"]["_tag"]> = Extract<JournalEvent["body"], { _tag: Tag }>
export type MachineConstructor = (
  plan: Plan,
  events: ReadonlyArray<JournalEvent>,
  scopeKind?: Scope["_tag"],
) => Machine
/** Protocol law shared by representations, not inferred from provider labels. */
export const sameProtectedRequest = (recorded: RequestFacts, candidate: RequestFacts): boolean =>
  recorded.transport === "core.git/1" &&
  recorded.method === "update-ref" &&
  recorded.replay._tag === "GitCas" &&
  canonical(recorded) === canonical(candidate)
export const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  canonical([...left].sort()) === canonical([...right].sort())
/** Core-owned history laws, shared by M1 and the executor admission boundary. */
export const operationFacts = (events: ReadonlyArray<JournalEvent>, operationId: string) => {
  const starts: Body<"DispatchStarted">[] = [],
    dispatchIds = new Set<string>(),
    receipts: Body<"ReceiptAccepted">[] = [],
    rejected = new Set<string>(),
    observations: Body<"ObservationRecorded">[] = [],
    risks: Body<"RiskAccepted">[] = [],
    consumed = new Set<string>()
  for (const { body } of events) {
    if (body._tag === "DispatchStarted" && body.operationId === operationId) {
      starts.push(body)
      dispatchIds.add(body.dispatchId)
      if (body.basis._tag === "AcceptedRisk") consumed.add(body.basis.decisionId)
    } else if (body._tag === "ReceiptAccepted" && dispatchIds.has(body.dispatchId))
      receipts.push(body)
    else if (body._tag === "DispatchRejectedBeforeCommit" && dispatchIds.has(body.dispatchId))
      rejected.add(body.dispatchId)
    else if (body._tag === "ObservationRecorded" && body.operationId === operationId)
      observations.push(body)
    else if (body._tag === "RiskAccepted" && body.operationId === operationId) risks.push(body)
  }
  return { starts, receipts, rejected, observations, risks, consumed }
}
export const operationStatus = (
  events: ReadonlyArray<JournalEvent>,
  operationId: string,
  scopeKind: Scope["_tag"] = "PublicationScope",
): OperationStatus => {
  if (events.some((event) => event.body._tag === "PlanSuperseded")) return "Superseded"
  const facts = operationFacts(events, operationId)
  if (
    scopeKind === "PreparationScope" &&
    (facts.observations.some((event) => event.status === "Satisfied") ||
      facts.receipts.some((receipt) => receipt.status === "Satisfied"))
  )
    return "Satisfied"
  const latest = facts.observations.at(-1)
  if (latest && latest.status !== "Inconclusive" && latest.status !== "Absent") return latest.status
  if (facts.receipts.some((receipt) => receipt.status === "Satisfied")) return "Satisfied"
  if (facts.receipts.length > 0) return "Pending"
  if (facts.starts.length === 0) return "Unattempted"
  if (facts.rejected.size === facts.starts.length) return "Rejected"
  return "Inconclusive"
}
export const dispatchDecision = (
  plan: Plan,
  events: ReadonlyArray<JournalEvent>,
  operationId: string,
  candidate: CandidateRequest | null,
  now: number,
  scopeKind: Scope["_tag"] = "PublicationScope",
): Next => {
  const operation = plan.operations.find((item) => item.operationId === operationId)
  if (!operation)
    return fail("unknown-operation", "Decision references an operation outside the plan")
  const status = operationStatus(events, operationId, scopeKind)
  if (["Superseded", "Satisfied", "Conflict", "Pending"].includes(status))
    return { _tag: "Finish", status }
  if (
    operation.dependsOn.some(
      (dependency) => operationStatus(events, dependency, scopeKind) !== "Satisfied",
    )
  )
    return { _tag: "Finish", status: "Pending" }
  if (candidate === null) return { _tag: "PrepareDispatch" }
  const facts = operationFacts(events, operationId)
  if (facts.receipts.length > 0) return { _tag: "Finish", status }
  if (facts.starts.length === 0) return { _tag: "AppendDispatch", basis: new Initial({}) }
  const unresolved = facts.starts.filter((start) => !facts.rejected.has(start.dispatchId))
  if (unresolved.length === 0)
    return {
      _tag: "AppendDispatch",
      basis: new NonCommit({ dispatchIds: facts.starts.map((start) => start.dispatchId).sort() }),
    }
  if (unresolved.every((start) => sameProtectedRequest(start.request, candidate.facts)))
    return {
      _tag: "AppendDispatch",
      basis: new ProtectedReplay({
        dispatchIds: unresolved.map((start) => start.dispatchId).sort(),
      }),
    }
  const risk = facts.risks.find(
    (decision) =>
      !facts.consumed.has(decision.decisionId) &&
      decision.expiresAt >= now &&
      decision.fingerprint === candidate.fingerprint &&
      sameStrings(
        decision.priorDispatchIds,
        facts.starts.map((start) => start.dispatchId),
      ),
  )
  return risk
    ? { _tag: "AppendDispatch", basis: new AcceptedRisk({ decisionId: risk.decisionId }) }
    : { _tag: "RequestRiskAcceptance" }
}
export const assertJournalAppend = (
  plan: Plan,
  events: ReadonlyArray<JournalEvent>,
  event: JournalEvent,
  scopeKind: Scope["_tag"] = "PublicationScope",
): void => {
  if (event.planId !== plan.planId || events.some((prior) => prior.eventId === event.eventId))
    fail("journal-envelope", "Wrong plan or repeated event ID")
  const body = event.body
  const operation =
    "operationId" in body
      ? plan.operations.find((item) => item.operationId === body.operationId)
      : undefined
  if ("operationId" in body && !operation)
    fail("unknown-operation", "Event references an operation outside the plan")
  switch (body._tag) {
    case "DispatchStarted": {
      if (!Number.isSafeInteger(body.startedAt) || body.startedAt < 0)
        fail("dispatch-time", "Dispatch time is invalid")
      if (
        events.some(
          (prior) =>
            prior.body._tag === "DispatchStarted" && prior.body.dispatchId === body.dispatchId,
        )
      )
        fail("duplicate-dispatch", "Dispatch identity is already used")
      const decision = dispatchDecision(
        plan,
        events,
        body.operationId,
        { facts: body.request, fingerprint: body.fingerprint },
        body.startedAt,
        scopeKind,
      )
      if (decision._tag !== "AppendDispatch" || canonical(decision.basis) !== canonical(body.basis))
        fail("illegal-dispatch", "Historical dispatch lacks a lawful basis")
      break
    }
    case "ReceiptAccepted":
    case "DispatchRejectedBeforeCommit": {
      const dispatch = events.flatMap(({ body: prior }) =>
        "dispatchId" in prior && prior.dispatchId === body.dispatchId ? [prior] : [],
      )
      if (!dispatch.some((prior) => prior._tag === "DispatchStarted"))
        fail("unknown-dispatch", "Evidence has no matching dispatch")
      const opposite =
        body._tag === "ReceiptAccepted" ? "DispatchRejectedBeforeCommit" : "ReceiptAccepted"
      if (dispatch.some((prior) => prior._tag === opposite))
        fail(
          "contradictory-evidence",
          "Acceptance and terminal non-commit cannot describe one dispatch",
        )
      if (dispatch.some((prior) => prior._tag === body._tag))
        fail("duplicate-evidence", "A dispatch has one acceptance or rejection event")
      break
    }
    case "RiskAccepted": {
      if (!Number.isSafeInteger(body.expiresAt) || body.expiresAt < 0)
        fail("risk-time", "Risk expiry is invalid")
      if (operationStatus(events, body.operationId, scopeKind) === "Superseded")
        fail("superseded-decision", "A superseded plan cannot accept a new risk decision")
      const facts = operationFacts(events, body.operationId)
      if (
        !body.principal ||
        facts.starts.length === 0 ||
        facts.receipts.length > 0 ||
        !sameStrings(
          body.priorDispatchIds,
          facts.starts.map((start) => start.dispatchId),
        )
      )
        fail("risk-scope", "Risk decision must bind the complete prior attempt set")
      if (
        events.some(
          (prior) =>
            prior.body._tag === "RiskAccepted" && prior.body.decisionId === body.decisionId,
        )
      )
        fail("duplicate-risk", "Decision identity is already used")
      break
    }
    case "ObservationRecorded":
      if (!Number.isSafeInteger(body.observedAt) || body.observedAt < 0)
        fail("observation-time", "Observation time is invalid")
      break
    case "PlanSuperseded":
      if (events.some((prior) => prior.body._tag === "PlanSuperseded"))
        fail("duplicate-supersession", "Plan is already superseded")
      break
  }
}
export const projectReport = (
  plan: Plan,
  events: ReadonlyArray<JournalEvent>,
  scopeKind: Scope["_tag"],
) => {
  return {
    planId: plan.planId,
    revision: events.length,
    superseded: events.some((event) => event.body._tag === "PlanSuperseded"),
    operations: plan.operations.map((operation) => {
      const facts = operationFacts(events, operation.operationId)
      return {
        operationId: operation.operationId,
        status: operationStatus(events, operation.operationId, scopeKind),
        dispatches: facts.starts.length,
        receipts: facts.receipts.length,
        observations: facts.observations.length,
      }
    }),
  }
}

/** M1 retains history and derives decisions and reports from the core laws. */
class HistoryMachine implements Machine {
  constructor(
    readonly plan: Plan,
    readonly events: ReadonlyArray<JournalEvent>,
    readonly scopeKind: Scope["_tag"] = "PublicationScope",
  ) {}
  report() {
    return projectReport(this.plan, this.events, this.scopeKind)
  }
  next(operationId: string, candidate: CandidateRequest | null, now: number) {
    return dispatchDecision(this.plan, this.events, operationId, candidate, now, this.scopeKind)
  }
  append(event: JournalEvent): Machine {
    assertJournalAppend(this.plan, this.events, event, this.scopeKind)
    return new HistoryMachine(this.plan, [...this.events, event], this.scopeKind)
  }
}
export const historyMachine = (
  plan: Plan,
  events: ReadonlyArray<JournalEvent>,
  scopeKind: Scope["_tag"] = "PublicationScope",
): Machine =>
  events.reduce<Machine>(
    (machine, event) => machine.append(event),
    new HistoryMachine(plan, [], scopeKind),
  )
