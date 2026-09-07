// External evaluator witness: M2 built from the kernel's PUBLIC exports only (no kernel-private import).
import {
  AcceptedRisk, Initial, LabError, NonCommit, ProtectedReplay, canonical, sameProtectedRequest, sameStrings,
  type CandidateRequest, type DispatchStarted, type JournalEvent, type Machine, type MachineConstructor, type Next,
  type ObservationRecorded, type OperationStatus, type Plan, type RiskAccepted, type Scope
} from "../src/index.js"

function fail(code: string, message: string): never { throw new LabError({ code, message }) }

type Attempt =
  | { readonly _tag: "Open"; readonly start: DispatchStarted }
  | { readonly _tag: "Accepted"; readonly start: DispatchStarted; readonly status: "Satisfied" | "Pending" }
  | { readonly _tag: "NonCommit"; readonly start: DispatchStarted }
type Attempts =
  | { readonly _tag: "NeverStarted" }
  | { readonly _tag: "Attempted"; readonly entries: readonly [Attempt, ...Attempt[]] }
interface OperationState {
  readonly attempts: Attempts
  readonly observation: ObservationRecorded | null
  readonly selected: boolean
  readonly observationCount: number
  readonly decisions: ReadonlyArray<{ readonly event: RiskAccepted; readonly consumed: boolean }>
}
interface State {
  readonly disposition: "Active" | "Superseded"
  readonly eventIds: ReadonlySet<string>
  readonly operations: ReadonlyMap<string, OperationState>
}
const entries = (state: OperationState): ReadonlyArray<Attempt> => state.attempts._tag === "NeverStarted" ? [] : state.attempts.entries

/** M2 materializes a closed state algebra, discarding historical event bodies. */
class TransitionMachine implements Machine {
  constructor(readonly plan: Plan, readonly state: State, readonly scopeKind: Scope["_tag"] = "PublicationScope") {}

  private operation(id: string): OperationState {
    return this.state.operations.get(id) ?? fail("unknown-operation", "Operation is not registered in this plan")
  }

  private status(id: string): OperationStatus {
    if (this.state.disposition === "Superseded") return "Superseded"
    const operation = this.operation(id)
    if (this.scopeKind === "PreparationScope" && operation.selected) return "Satisfied"
    const observed = operation.observation?.status
    if (observed === "Satisfied" || observed === "Conflict" || observed === "Pending") return observed
    switch (operation.attempts._tag) {
      case "NeverStarted": return "Unattempted"
      case "Attempted":
        if (operation.attempts.entries.some((attempt) => attempt._tag === "Accepted" && attempt.status === "Satisfied")) return "Satisfied"
        if (operation.attempts.entries.some((attempt) => attempt._tag === "Accepted")) return "Pending"
        return operation.attempts.entries.every((attempt) => attempt._tag === "NonCommit") ? "Rejected" : "Inconclusive"
    }
  }

  report() {
    return {
      planId: this.plan.planId,
      revision: this.state.eventIds.size,
      superseded: this.state.disposition === "Superseded",
      operations: this.plan.operations.map((operation) => {
        const state = this.operation(operation.operationId)
        const attempts = entries(state)
        return { operationId: operation.operationId, status: this.status(operation.operationId), dispatches: attempts.length, receipts: attempts.filter((attempt) => attempt._tag === "Accepted").length, observations: state.observationCount }
      })
    }
  }

  next(operationId: string, candidate: CandidateRequest | null, now: number): Next {
    const state = this.operation(operationId)
    const status = this.status(operationId)
    if (status === "Superseded" || status === "Satisfied" || status === "Conflict" || status === "Pending") return { _tag: "Finish", status }
    const definition = this.plan.operations.find((operation) => operation.operationId === operationId)!
    if (definition.dependsOn.some((dependency) => this.status(dependency) !== "Satisfied")) return { _tag: "Finish", status: "Pending" }
    if (!candidate) return { _tag: "PrepareDispatch" }
    switch (state.attempts._tag) {
      case "NeverStarted": return { _tag: "AppendDispatch", basis: new Initial({}) }
      case "Attempted": {
        const previous = state.attempts.entries
        if (previous.some((attempt) => attempt._tag === "Accepted")) return { _tag: "Finish", status }
        const open = previous.filter((attempt) => attempt._tag === "Open")
        if (open.length === 0) return { _tag: "AppendDispatch", basis: new NonCommit({ dispatchIds: previous.map((attempt) => attempt.start.dispatchId).sort() }) }
        if (open.every((attempt) => sameProtectedRequest(attempt.start.request, candidate.facts))) return { _tag: "AppendDispatch", basis: new ProtectedReplay({ dispatchIds: open.map((attempt) => attempt.start.dispatchId).sort() }) }
        for (const decision of state.decisions) {
          if (!decision.consumed && decision.event.expiresAt >= now && decision.event.fingerprint === candidate.fingerprint && sameStrings(decision.event.priorDispatchIds, previous.map((attempt) => attempt.start.dispatchId))) return { _tag: "AppendDispatch", basis: new AcceptedRisk({ decisionId: decision.event.decisionId }) }
        }
        return { _tag: "RequestRiskAcceptance" }
      }
    }
  }

  append(event: JournalEvent): Machine {
    if (event.planId !== this.plan.planId || this.state.eventIds.has(event.eventId)) fail("journal-envelope", "Wrong plan or repeated event ID")
    const eventIds = new Set(this.state.eventIds).add(event.eventId)
    const operations = new Map(this.state.operations)
    const body = event.body
    let disposition = this.state.disposition
    switch (body._tag) {
      case "PlanSuperseded":
        if (disposition === "Superseded") fail("duplicate-supersession", "Plan is already superseded")
        disposition = "Superseded"
        break
      case "ObservationRecorded": {
        const state = this.operation(body.operationId)
        if (!Number.isSafeInteger(body.observedAt) || body.observedAt < 0) fail("observation-time", "Observation time is invalid")
        operations.set(body.operationId, { ...state, observation: body, selected: state.selected || body.status === "Satisfied", observationCount: state.observationCount + 1 })
        break
      }
      case "RiskAccepted": {
        if (this.state.disposition === "Superseded") fail("superseded-decision", "A superseded plan cannot accept a new risk decision")
        const state = this.operation(body.operationId)
        const previous = entries(state)
        if (!body.principal || previous.length === 0 || previous.some((attempt) => attempt._tag === "Accepted") || !sameStrings(body.priorDispatchIds, previous.map((attempt) => attempt.start.dispatchId))) fail("risk-scope", "Risk must bind the complete prior attempt set")
        if ([...operations.values()].some((operation) => operation.decisions.some((decision) => decision.event.decisionId === body.decisionId))) fail("duplicate-risk", "Decision identity is already used")
        operations.set(body.operationId, { ...state, decisions: [...state.decisions, { event: body, consumed: false }] })
        break
      }
      case "DispatchStarted": {
        const state = this.operation(body.operationId)
        if ([...operations.values()].some((operation) => entries(operation).some((attempt) => attempt.start.dispatchId === body.dispatchId))) fail("duplicate-dispatch", "Dispatch identity is already used")
        const decision = this.next(body.operationId, { facts: body.request, fingerprint: body.fingerprint }, body.startedAt)
        if (decision._tag !== "AppendDispatch" || canonical(decision.basis) !== canonical(body.basis)) fail("illegal-dispatch", "Historical transition lacks a lawful dispatch basis")
        const nextAttempts: readonly [Attempt, ...Attempt[]] = [{ _tag: "Open", start: body }, ...entries(state)]
        operations.set(body.operationId, {
          ...state,
          attempts: { _tag: "Attempted", entries: nextAttempts },
          decisions: state.decisions.map((risk) => ({ ...risk, consumed: risk.consumed || (body.basis._tag === "AcceptedRisk" && body.basis.decisionId === risk.event.decisionId) }))
        })
        break
      }
      case "ReceiptAccepted":
      case "DispatchRejectedBeforeCommit": {
        const owner = [...operations.entries()].find(([, state]) => entries(state).some((attempt) => attempt.start.dispatchId === body.dispatchId))
        if (!owner) fail("unknown-dispatch", "Evidence has no corresponding dispatch")
        const [id, state] = owner
        if (state.attempts._tag !== "Attempted") fail("unknown-dispatch", "Evidence targets an unattempted operation")
        const updated = state.attempts.entries.map((attempt): Attempt => {
          if (attempt.start.dispatchId !== body.dispatchId) return attempt
          const target = body._tag === "ReceiptAccepted" ? "Accepted" : "NonCommit"
          if (attempt._tag !== "Open") fail(attempt._tag === target ? "duplicate-evidence" : "contradictory-evidence", "A terminal attempt cannot transition to another terminal fact")
          return body._tag === "ReceiptAccepted" ? { _tag: "Accepted", start: attempt.start, status: body.status } : { _tag: "NonCommit", start: attempt.start }
        }) as [Attempt, ...Attempt[]]
        operations.set(id, { ...state, selected: state.selected || body._tag === "ReceiptAccepted" && body.status === "Satisfied", attempts: { _tag: "Attempted", entries: updated } })
        break
      }
    }
    return new TransitionMachine(this.plan, { disposition, eventIds, operations }, this.scopeKind)
  }
}

export const transitionMachine: MachineConstructor = (plan, events, scopeKind = "PublicationScope") => {
  const initial = new TransitionMachine(plan, {
    disposition: "Active", eventIds: new Set(),
    operations: new Map(plan.operations.map((operation) => [operation.operationId, {
      attempts: { _tag: "NeverStarted" }, observation: null, selected: false, observationCount: 0, decisions: []
    }]))
  }, scopeKind)
  return events.reduce<Machine>((machine, event) => machine.append(event), initial)
}
