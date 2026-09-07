import type { JournalEvent, Plan, Scope } from "./contracts.js"
import type { CandidateRequest, Machine } from "./model.js"
import { assertJournalAppend, dispatchDecision, operationFacts, operationStatus } from "./laws.js"

/** M1 retains history and derives decisions and reports from the core laws. */
class HistoryMachine implements Machine {
  constructor(readonly plan: Plan, readonly events: ReadonlyArray<JournalEvent>, readonly scopeKind: Scope["_tag"] = "PublicationScope") {}
  report() {
    return {
      planId: this.plan.planId,
      revision: this.events.length,
      superseded: this.events.some((event) => event.body._tag === "PlanSuperseded"),
      operations: this.plan.operations.map((operation) => {
        const facts = operationFacts(this.events, operation.operationId)
        return { operationId: operation.operationId, status: operationStatus(this.events, operation.operationId, this.scopeKind), dispatches: facts.starts.length, receipts: facts.receipts.length, observations: facts.observations.length }
      })
    }
  }

  next(operationId: string, candidate: CandidateRequest | null, now: number) {
    return dispatchDecision(this.plan, this.events, operationId, candidate, now, this.scopeKind)
  }
  append(event: JournalEvent): Machine {
    assertJournalAppend(this.plan, this.events, event, this.scopeKind)
    return new HistoryMachine(this.plan, [...this.events, event], this.scopeKind)
  }
}

export const historyMachine = (plan: Plan, events: ReadonlyArray<JournalEvent>, scopeKind: Scope["_tag"] = "PublicationScope"): Machine =>
  events.reduce<Machine>((machine, event) => machine.append(event), new HistoryMachine(plan, [], scopeKind))
