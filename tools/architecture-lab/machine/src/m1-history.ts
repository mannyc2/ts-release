import {
  AcceptedRisk, Initial, NonCommit, ProtectedReplay,
  type DispatchStarted, type JournalEvent, type ObservationRecorded,
  type Operation, type OperationStatus, type Plan, type RiskAccepted
} from "./contracts.js"
import { canonical, fail } from "./identity.js"
import { sameProtectedRequest, sameStrings, type CandidateRequest, type Machine, type Next } from "./model.js"

/** M1 retains history; facts and decisions are reconstructed by queries. */
class HistoryMachine implements Machine {
  constructor(readonly plan: Plan, readonly events: ReadonlyArray<JournalEvent>) {}

  private facts(operationId: string) {
    const starts = this.events.flatMap((event) => event.body._tag === "DispatchStarted" && event.body.operationId === operationId ? [event.body] : [])
    const dispatchIds = new Set(starts.map((start) => start.dispatchId))
    const receipts = this.events.filter((event) => event.body._tag === "ReceiptAccepted" && dispatchIds.has(event.body.dispatchId))
    const rejected = new Set(this.events.flatMap((event) => event.body._tag === "DispatchRejectedBeforeCommit" && dispatchIds.has(event.body.dispatchId) ? [event.body.dispatchId] : []))
    const observations = this.events.flatMap((event) => event.body._tag === "ObservationRecorded" && event.body.operationId === operationId ? [event.body] : [])
    const risks = this.events.flatMap((event) => event.body._tag === "RiskAccepted" && event.body.operationId === operationId ? [event.body] : [])
    const consumed = new Set(starts.flatMap((start) => start.basis._tag === "AcceptedRisk" ? [start.basis.decisionId] : []))
    return { starts, receipts, rejected, observations, risks, consumed }
  }

  private status(operationId: string): OperationStatus {
    if (this.events.some((event) => event.body._tag === "PlanSuperseded")) return "Superseded"
    const facts = this.facts(operationId)
    const latest = facts.observations.at(-1)
    if (latest?.status === "Satisfied" || latest?.status === "Conflict" || latest?.status === "Pending") return latest.status
    if (facts.receipts.some((event) => event.body._tag === "ReceiptAccepted" && event.body.status === "Satisfied")) return "Satisfied"
    if (facts.receipts.length > 0) return "Pending"
    if (facts.starts.length === 0) return "Unattempted"
    if (facts.rejected.size === facts.starts.length) return "Rejected"
    return "Inconclusive"
  }

  report() {
    return {
      planId: this.plan.planId,
      revision: this.events.length,
      superseded: this.events.some((event) => event.body._tag === "PlanSuperseded"),
      operations: this.plan.operations.map((operation) => {
        const facts = this.facts(operation.operationId)
        return { operationId: operation.operationId, status: this.status(operation.operationId), dispatches: facts.starts.length, receipts: facts.receipts.length, observations: facts.observations.length }
      })
    }
  }

  next(operationId: string, candidate: CandidateRequest | null, now: number): Next {
    const operation = this.plan.operations.find((item) => item.operationId === operationId)
    if (!operation) return fail("unknown-operation", "Decision references an operation outside the plan")
    const status = this.status(operationId)
    if (status === "Superseded" || status === "Satisfied" || status === "Conflict" || status === "Pending") return { _tag: "Finish", status }
    if (operation.dependsOn.some((dependency) => this.status(dependency) !== "Satisfied")) return { _tag: "Finish", status: "Pending" }
    if (candidate === null) return { _tag: "PrepareDispatch" }
    const facts = this.facts(operationId)
    if (facts.receipts.length > 0) return { _tag: "Finish", status }
    if (facts.starts.length === 0) return { _tag: "AppendDispatch", basis: new Initial({}) }
    const unresolved = facts.starts.filter((start) => !facts.rejected.has(start.dispatchId))
    if (unresolved.length === 0) return { _tag: "AppendDispatch", basis: new NonCommit({ dispatchIds: facts.starts.map((start) => start.dispatchId).sort() }) }
    if (unresolved.every((start) => sameProtectedRequest(start.request, candidate.facts))) return { _tag: "AppendDispatch", basis: new ProtectedReplay({ dispatchIds: unresolved.map((start) => start.dispatchId).sort() }) }
    const risk = facts.risks.find((decision) => !facts.consumed.has(decision.decisionId) && decision.expiresAt >= now && decision.fingerprint === candidate.fingerprint && sameStrings(decision.priorDispatchIds, facts.starts.map((start) => start.dispatchId)))
    return risk ? { _tag: "AppendDispatch", basis: new AcceptedRisk({ decisionId: risk.decisionId }) } : { _tag: "RequestRiskAcceptance" }
  }

  append(event: JournalEvent): Machine {
    if (event.planId !== this.plan.planId || this.events.some((prior) => prior.eventId === event.eventId)) fail("journal-envelope", "Wrong plan or repeated event ID")
    const body = event.body
    const operation = "operationId" in body ? this.plan.operations.find((item) => item.operationId === body.operationId) : undefined
    if ("operationId" in body && !operation) fail("unknown-operation", "Event references an operation outside the plan")
    switch (body._tag) {
      case "DispatchStarted": {
        if (this.events.some((prior) => prior.body._tag === "DispatchStarted" && prior.body.dispatchId === body.dispatchId)) fail("duplicate-dispatch", "Dispatch identity is already used")
        const decision = this.next(body.operationId, { facts: body.request, fingerprint: body.fingerprint }, body.startedAt)
        if (decision._tag !== "AppendDispatch" || canonical(decision.basis) !== canonical(body.basis)) fail("illegal-dispatch", "Historical dispatch lacks a lawful basis")
        break
      }
      case "ReceiptAccepted":
      case "DispatchRejectedBeforeCommit": {
        const start = this.events.find((prior) => prior.body._tag === "DispatchStarted" && prior.body.dispatchId === body.dispatchId)
        if (!start || start.body._tag !== "DispatchStarted") fail("unknown-dispatch", "Evidence has no matching dispatch")
        const opposite = body._tag === "ReceiptAccepted" ? "DispatchRejectedBeforeCommit" : "ReceiptAccepted"
        if (this.events.some((prior) => prior.body._tag === opposite && prior.body.dispatchId === body.dispatchId)) fail("contradictory-evidence", "Acceptance and terminal non-commit cannot describe one dispatch")
        if (this.events.some((prior) => prior.body._tag === body._tag && "dispatchId" in prior.body && prior.body.dispatchId === body.dispatchId)) fail("duplicate-evidence", "A dispatch has one acceptance or rejection event")
        break
      }
      case "RiskAccepted": {
        if (this.status(body.operationId) === "Superseded") fail("superseded-decision", "A superseded plan cannot accept a new risk decision")
        const facts = this.facts(body.operationId)
        if (!body.principal || facts.starts.length === 0 || facts.receipts.length > 0 || !sameStrings(body.priorDispatchIds, facts.starts.map((start) => start.dispatchId))) fail("risk-scope", "Risk decision must bind the complete prior attempt set")
        if (this.events.some((prior) => prior.body._tag === "RiskAccepted" && prior.body.decisionId === body.decisionId)) fail("duplicate-risk", "Decision identity is already used")
        break
      }
      case "ObservationRecorded":
        if (!Number.isSafeInteger(body.observedAt) || body.observedAt < 0) fail("observation-time", "Observation time is invalid")
        break
      case "PlanSuperseded":
        if (this.events.some((prior) => prior.body._tag === "PlanSuperseded")) fail("duplicate-supersession", "Plan is already superseded")
        break
    }
    return new HistoryMachine(this.plan, [...this.events, event])
  }
}

export const historyMachine = (plan: Plan, events: ReadonlyArray<JournalEvent>): Machine =>
  events.reduce<Machine>((machine, event) => machine.append(event), new HistoryMachine(plan, []))
