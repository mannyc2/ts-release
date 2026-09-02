import {
  CasJournal,
  LimitedStore,
  exerciseArtifactBoundary,
  exerciseCasContenders,
  exerciseExternalProvider,
  exerciseHostOwnership,
  exerciseMalformedProviderDag,
  validateProviderDag
} from "./boundaries.js"
import { terminalOutcome, transition, type State, type TransitionEvent } from "./transition-table.js"
import type { ActionId, CaseFixture, TerminalOutcome } from "./contracts.js"

export type Command = {
  readonly [A in ActionId]: { readonly _tag: A; readonly fixture: CaseFixture }
}[ActionId]

export const makeCommand = <A extends ActionId>(_tag: A, fixture: CaseFixture): Extract<Command, { readonly _tag: A }> =>
  ({ _tag, fixture }) as Extract<Command, { readonly _tag: A }>

const hasFault = (fixture: CaseFixture, actionId: ActionId, faultId: string): boolean =>
  fixture.faultSchedule.some((fault) => fault.actionId === actionId && fault.faultId === faultId)

const hasAnyFault = (fixture: CaseFixture, faultId: string): boolean =>
  fixture.faultSchedule.some((fault) => fault.faultId === faultId)

const integerInput = (fixture: CaseFixture, name: string): number => {
  const value = fixture.inputFacts.find((fact) => fact.name === name)?.value
  if (value?._tag !== "Integer") throw new Error(`missing integer fixture fact ${name}`)
  return value.value
}

export class TypedInterpreter {
  readonly #journal = new CasJournal<string>()
  #limitedStore: LimitedStore | undefined
  #state: State = "Idle"
  #dispatchCount = 0
  #observationCount = 0
  #freshRunner = false
  #outcome: TerminalOutcome | undefined

  get snapshot(): {
    readonly state: State
    readonly journalRevision: number
    readonly dispatchCount: number
    readonly observationCount: number
    readonly freshRunner: boolean
  } {
    return {
      state: this.#state,
      journalRevision: this.#journal.revision,
      dispatchCount: this.#dispatchCount,
      observationCount: this.#observationCount,
      freshRunner: this.#freshRunner
    }
  }

  get outcome(): TerminalOutcome {
    if (this.#outcome === undefined) throw new Error("terminal outcome has not been interpreted")
    return this.#outcome
  }

  #move(event: TransitionEvent): void {
    this.#state = transition(this.#state, event)
  }

  #append(event: string): void {
    if (!this.#journal.append(this.#journal.revision, event)) throw new Error("single-writer CAS unexpectedly failed")
  }

  execute(command: Command): void {
    const fixture = command.fixture
    switch (command._tag) {
      case "action.initialize-operation":
        if (hasFault(fixture, command._tag, "fault.prior-dispatch-response-loss")) this.#move("Dispatch")
        if (hasFault(fixture, command._tag, "fault.prior-inconclusive-operation")) this.#move("ObserveUnproven")
        return
      case "action.prepare-operation":
        this.#move("Plan")
        return
      case "action.append-dispatch-authority":
        this.#append("DispatchAuthorized")
        this.#move("Authorize")
        return
      case "action.dispatch-operation":
      case "action.submit-apple-operation":
        this.#move("Dispatch")
        this.#dispatchCount += 1
        return
      case "action.record-provider-receipt":
        this.#append("ProviderReceiptRecorded")
        this.#move("Acknowledge")
        return
      case "action.observe-operation":
        if (hasFault(fixture, command._tag, "fault.observation-absence") || hasAnyFault(fixture, "fault.apple-submission-id-loss")) {
          this.#move("ObserveUnproven")
          return
        }
        this.#observationCount += 1
        this.#append("ProviderObservationRecorded")
        if ((hasAnyFault(fixture, "fault.prior-dispatch-response-loss") || hasAnyFault(fixture, "fault.prior-inconclusive-operation")) && this.#observationCount === 1) {
          this.#move("ObserveUnproven")
        } else {
          this.#move("Succeed")
        }
        return
      case "action.record-precommit-rejection":
        this.#append("PrecommitRejected")
        this.#move("Reject")
        return
      case "action.resume-fresh-runner":
        this.#freshRunner = true
        return
      case "action.request-risk-acceptance":
        if (this.#state !== "Unproven") throw new Error("risk acceptance requested from a proven state")
        return
      case "action.append-risk-acceptance":
        this.#append("RiskAccepted")
        this.#move("AcceptRisk")
        return
      case "action.contend-append-cas":
        exerciseCasContenders()
        this.#move("Authorize")
        return
      case "action.refold-after-cas-loss":
        if (this.#state !== "Authorized") throw new Error("CAS loser did not observe winner authority")
        return
      case "action.verify-request-correspondence":
        if (!hasFault(fixture, command._tag, "fault.request-endpoint-mismatch")) throw new Error("mismatch fault missing")
        this.#move("Reject")
        return
      case "action.append-supersession":
        this.#append("Superseded")
        this.#move("Stop")
        return
      case "action.append-late-evidence":
        this.#append("LateEvidenceRecordedWithoutRedispatch")
        this.#move("Stop")
        return
      case "action.reconcile-ambiguous-append":
        if (!hasFault(fixture, "action.append-dispatch-authority", "fault.append-outcome-unknown")) throw new Error("append was not ambiguous")
        this.#append("AmbiguousAppendReadBack")
        this.#move("Stop")
        return
      case "action.validate-provider-graph":
        if (hasFault(fixture, command._tag, "fault.malformed-provider-graph")) {
          exerciseMalformedProviderDag()
          this.#move("Reject")
        } else {
          validateProviderDag([{ id: "kernel", needs: [] }, { id: "provider", needs: ["kernel"] }])
        }
        return
      case "action.load-external-provider":
        exerciseExternalProvider()
        return
      case "action.adopt-finalized-artifacts":
        exerciseArtifactBoundary()
        this.#append("FinalizedArtifactsAdopted")
        this.#move("Succeed")
        return
      case "action.attempt-host-shadow":
        exerciseHostOwnership()
        this.#move("Reject")
        return
      case "action.write-journal-at-limit":
        this.#limitedStore = new LimitedStore(integerInput(fixture, "journal.limit-bytes"))
        this.#limitedStore.write("exact", new Uint8Array(integerInput(fixture, "journal.limit-bytes")))
        this.#append("JournalAtLimit")
        this.#move("Stop")
        return
      case "action.read-journal-at-limit":
        if (this.#limitedStore?.read("exact").byteLength !== integerInput(fixture, "journal.limit-bytes")) throw new Error("exact-limit read was lossy")
        return
      case "action.reject-journal-write-over-limit":
        if (this.#limitedStore === undefined) throw new Error("limited store was not initialized")
        try {
          this.#limitedStore.write("over", new Uint8Array(integerInput(fixture, "journal.limit-bytes") + 1))
        } catch {
          return
        }
        throw new Error("over-limit write was accepted")
      case "action.reject-journal-read-over-limit":
        if (this.#limitedStore === undefined) throw new Error("limited store was not initialized")
        this.#limitedStore.inject("historical-over", new Uint8Array(integerInput(fixture, "journal.limit-bytes") + 1))
        try {
          this.#limitedStore.read("historical-over")
        } catch {
          return
        }
        throw new Error("over-limit read was accepted")
      case "action.derive-terminal-report":
        this.#outcome = terminalOutcome(this.#state)
        return
    }
  }
}
