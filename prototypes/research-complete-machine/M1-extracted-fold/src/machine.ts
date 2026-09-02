import {
  BoundedJournalStore,
  RevisionJournal,
  proveConsumerCannotShadowHost,
  proveExactlyOneCasWinner,
  proveExternalProviderIsOrdinary,
  proveFinalizedArtifactAdoption,
  proveInvalidProviderGraphRejected,
  validateProviderGraph
} from "./boundaries.js"
import type { ActionId, CaseFixture, TerminalOutcome } from "./contracts.js"

export type FoldState =
  | "Ready"
  | "Planned"
  | "Authorized"
  | "InFlight"
  | "Unproven"
  | "RiskAccepted"
  | "Satisfied"
  | "Rejected"
  | "Superseded"
  | "SafeStopped"

export const STATES: ReadonlyArray<FoldState> = [
  "Authorized",
  "InFlight",
  "Planned",
  "Ready",
  "Rejected",
  "RiskAccepted",
  "SafeStopped",
  "Satisfied",
  "Superseded",
  "Unproven"
]

export type MachineEvent =
  | { readonly _tag: "Planned" }
  | { readonly _tag: "DispatchAuthorized" }
  | { readonly _tag: "DispatchStarted" }
  | { readonly _tag: "ProviderReceiptRecorded" }
  | { readonly _tag: "ObservationUnproven" }
  | { readonly _tag: "RiskAccepted" }
  | { readonly _tag: "ObservationSatisfied" }
  | { readonly _tag: "PrecommitRejected" }
  | { readonly _tag: "Superseded" }
  | { readonly _tag: "LateEvidenceIgnored" }
  | { readonly _tag: "AmbiguityReconciled" }
  | { readonly _tag: "BoundarySucceeded" }
  | { readonly _tag: "BoundaryRejected" }
  | { readonly _tag: "LimitProtected" }

export const GRAMMAR_BRANCHES = [
  "AmbiguityReconciled->SafeStopped",
  "BoundaryRejected->Rejected",
  "BoundarySucceeded->Satisfied",
  "DispatchAuthorized->Authorized",
  "DispatchStarted->InFlight",
  "LateEvidenceIgnored->Superseded",
  "LimitProtected->SafeStopped",
  "ObservationSatisfied->Satisfied",
  "ObservationUnproven->Unproven",
  "Planned->Planned",
  "PrecommitRejected->Rejected",
  "ProviderReceiptRecorded->InFlight",
  "RiskAccepted->RiskAccepted",
  "Superseded->Superseded"
] as const

export const FORBIDDEN_TRANSITIONS = [
  "Ready->derive-terminal-report",
  "Planned->derive-terminal-report",
  "Authorized->derive-terminal-report",
  "RiskAccepted->derive-terminal-report"
] as const

export const FORBIDDEN_TRANSITION_COUNT = FORBIDDEN_TRANSITIONS.length

export const foldEvent = (state: FoldState, event: MachineEvent): FoldState => {
  switch (event._tag) {
    case "Planned":
      return "Planned"
    case "DispatchAuthorized":
      return "Authorized"
    case "DispatchStarted":
    case "ProviderReceiptRecorded":
      return "InFlight"
    case "ObservationUnproven":
      return "Unproven"
    case "RiskAccepted":
      return "RiskAccepted"
    case "ObservationSatisfied":
    case "BoundarySucceeded":
      return "Satisfied"
    case "PrecommitRejected":
    case "BoundaryRejected":
      return "Rejected"
    case "Superseded":
    case "LateEvidenceIgnored":
      return "Superseded"
    case "AmbiguityReconciled":
    case "LimitProtected":
      return "SafeStopped"
  }
}

export const foldJournal = (events: ReadonlyArray<MachineEvent>): FoldState => events.reduce(foldEvent, "Ready")

type Decision =
  | { readonly _tag: "Apply"; readonly action: ActionId }
  | { readonly _tag: "Complete"; readonly outcome: TerminalOutcome }

export const decide = (state: FoldState, requestedAction: ActionId): Decision => {
  if (requestedAction !== "action.derive-terminal-report") return { _tag: "Apply", action: requestedAction }
  switch (state) {
    case "Satisfied":
      return { _tag: "Complete", outcome: "Succeeded" }
    case "Rejected":
      return { _tag: "Complete", outcome: "Rejected" }
    case "Superseded":
    case "SafeStopped":
      return { _tag: "Complete", outcome: "SafeStop" }
    case "InFlight":
    case "Unproven":
      return { _tag: "Complete", outcome: "Inconclusive" }
    case "Ready":
    case "Planned":
    case "Authorized":
    case "RiskAccepted":
      throw new Error(`terminal report requested from nonterminal state ${state}`)
  }
}

const hasFault = (fixture: CaseFixture, actionId: ActionId, faultId: string): boolean =>
  fixture.faultSchedule.some((fault) => fault.actionId === actionId && fault.faultId === faultId)

const hasAnyFault = (fixture: CaseFixture, faultId: string): boolean =>
  fixture.faultSchedule.some((fault) => fault.faultId === faultId)

const integerInput = (fixture: CaseFixture, name: string): number => {
  const value = fixture.inputFacts.find((fact) => fact.name === name)?.value
  if (value?._tag !== "Integer") throw new Error(`missing integer fixture fact ${name}`)
  return value.value
}

export class ExtractedFoldApplication {
  readonly #journal = new RevisionJournal<string>()
  readonly #semanticEvents: Array<MachineEvent> = []
  #boundedStore: BoundedJournalStore | undefined
  #dispatches = 0
  #observations = 0
  #freshRunner = false
  #terminalOutcome: TerminalOutcome | undefined

  get snapshot(): {
    readonly journalRevision: number
    readonly dispatchCount: number
    readonly observationCount: number
    readonly freshRunner: boolean
    readonly state: FoldState
  } {
    return {
      journalRevision: this.#journal.revision,
      dispatchCount: this.#dispatches,
      observationCount: this.#observations,
      freshRunner: this.#freshRunner,
      state: foldJournal(this.#semanticEvents)
    }
  }

  get terminalOutcome(): TerminalOutcome {
    if (this.#terminalOutcome === undefined) throw new Error("terminal outcome has not been derived")
    return this.#terminalOutcome
  }

  #record(event: MachineEvent, durable = false): void {
    this.#semanticEvents.push(event)
    if (durable && !this.#journal.appendIfRevision(this.#journal.revision, event._tag)) {
      throw new Error("single-writer journal append unexpectedly lost CAS")
    }
  }

  apply(action: ActionId, fixture: CaseFixture): void {
    const decision = decide(foldJournal(this.#semanticEvents), action)
    if (decision._tag === "Complete") {
      this.#terminalOutcome = decision.outcome
      return
    }

    switch (decision.action) {
      case "action.initialize-operation":
        if (hasFault(fixture, action, "fault.prior-dispatch-response-loss")) this.#record({ _tag: "DispatchStarted" })
        if (hasFault(fixture, action, "fault.prior-inconclusive-operation")) this.#record({ _tag: "ObservationUnproven" })
        return
      case "action.prepare-operation":
        this.#record({ _tag: "Planned" })
        return
      case "action.append-dispatch-authority":
        this.#record({ _tag: "DispatchAuthorized" }, true)
        return
      case "action.dispatch-operation":
      case "action.submit-apple-operation":
        if (foldJournal(this.#semanticEvents) !== "Authorized") throw new Error("dispatch attempted without current authority")
        this.#dispatches += 1
        this.#record({ _tag: "DispatchStarted" })
        return
      case "action.record-provider-receipt":
        this.#record({ _tag: "ProviderReceiptRecorded" }, true)
        return
      case "action.record-precommit-rejection":
        this.#record({ _tag: "PrecommitRejected" }, true)
        return
      case "action.resume-fresh-runner":
        this.#freshRunner = true
        return
      case "action.observe-operation": {
        if (hasFault(fixture, action, "fault.observation-absence") || hasAnyFault(fixture, "fault.apple-submission-id-loss")) {
          this.#record({ _tag: "ObservationUnproven" })
          return
        }
        this.#observations += 1
        if (hasAnyFault(fixture, "fault.prior-dispatch-response-loss") && this.#observations === 1) {
          this.#record({ _tag: "ObservationUnproven" }, true)
        } else if (hasAnyFault(fixture, "fault.prior-inconclusive-operation") && this.#observations === 1) {
          this.#record({ _tag: "ObservationUnproven" }, true)
        } else {
          this.#record({ _tag: "ObservationSatisfied" }, true)
        }
        return
      }
      case "action.request-risk-acceptance":
        if (foldJournal(this.#semanticEvents) !== "Unproven") throw new Error("risk acceptance requested without unproven evidence")
        return
      case "action.append-risk-acceptance":
        this.#record({ _tag: "RiskAccepted" }, true)
        return
      case "action.contend-append-cas":
        proveExactlyOneCasWinner()
        this.#record({ _tag: "DispatchAuthorized" })
        return
      case "action.refold-after-cas-loss":
        if (foldJournal(this.#semanticEvents) !== "Authorized") throw new Error("CAS loser did not refold winner authority")
        return
      case "action.verify-request-correspondence":
        if (!hasFault(fixture, action, "fault.request-endpoint-mismatch")) throw new Error("correspondence mismatch fixture was not injected")
        this.#record({ _tag: "BoundaryRejected" })
        return
      case "action.append-supersession":
        this.#record({ _tag: "Superseded" }, true)
        return
      case "action.append-late-evidence":
        this.#record({ _tag: "LateEvidenceIgnored" }, true)
        return
      case "action.reconcile-ambiguous-append":
        if (!hasFault(fixture, "action.append-dispatch-authority", "fault.append-outcome-unknown")) {
          throw new Error("ambiguous append reconciliation lacked an ambiguous append")
        }
        this.#record({ _tag: "AmbiguityReconciled" }, true)
        return
      case "action.validate-provider-graph":
        if (hasFault(fixture, action, "fault.malformed-provider-graph")) {
          proveInvalidProviderGraphRejected()
          this.#record({ _tag: "BoundaryRejected" })
        } else {
          validateProviderGraph([
            { id: "kernel", dependencies: [] },
            { id: "provider", dependencies: ["kernel"] }
          ])
        }
        return
      case "action.load-external-provider":
        proveExternalProviderIsOrdinary()
        return
      case "action.adopt-finalized-artifacts":
        proveFinalizedArtifactAdoption()
        this.#record({ _tag: "BoundarySucceeded" }, true)
        return
      case "action.attempt-host-shadow":
        proveConsumerCannotShadowHost()
        this.#record({ _tag: "BoundaryRejected" })
        return
      case "action.write-journal-at-limit":
        this.#boundedStore = new BoundedJournalStore(integerInput(fixture, "journal.limit-bytes"))
        this.#boundedStore.write("exact", new Uint8Array(integerInput(fixture, "journal.limit-bytes")))
        this.#record({ _tag: "LimitProtected" }, true)
        return
      case "action.read-journal-at-limit":
        if (this.#boundedStore?.read("exact").byteLength !== integerInput(fixture, "journal.limit-bytes")) throw new Error("exact-limit read changed byte length")
        return
      case "action.reject-journal-write-over-limit":
        if (this.#boundedStore === undefined) throw new Error("bounded store was not initialized")
        try {
          this.#boundedStore.write("over", new Uint8Array(integerInput(fixture, "journal.limit-bytes") + 1))
        } catch {
          return
        }
        throw new Error("over-limit write was accepted")
      case "action.reject-journal-read-over-limit":
        if (this.#boundedStore === undefined) throw new Error("bounded store was not initialized")
        this.#boundedStore.injectHistorical("historical-over", new Uint8Array(integerInput(fixture, "journal.limit-bytes") + 1))
        try {
          this.#boundedStore.read("historical-over")
        } catch {
          return
        }
        throw new Error("over-limit read was accepted")
      case "action.derive-terminal-report":
        return
    }
  }
}
