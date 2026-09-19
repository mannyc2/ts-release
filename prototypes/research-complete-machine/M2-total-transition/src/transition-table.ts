import type { TerminalOutcome } from "./contracts.js"

export const STATES = [
  "Authorized",
  "Idle",
  "InFlight",
  "Planned",
  "Rejected",
  "RiskAccepted",
  "SafeStopped",
  "Succeeded",
  "Unproven"
] as const

export const EVENTS = [
  "AcceptRisk",
  "Acknowledge",
  "Authorize",
  "Dispatch",
  "ObserveUnproven",
  "Plan",
  "Reject",
  "Stop",
  "Succeed"
] as const

export type State = (typeof STATES)[number]
export type TransitionEvent = (typeof EVENTS)[number]
export type TransitionStatus = "allowed" | "absorbing" | "invalid"
export interface TransitionCell { readonly next: State; readonly status: TransitionStatus }
export type TotalTransitionTable = { readonly [S in State]: { readonly [E in TransitionEvent]: TransitionCell } }

const allowed = (next: State): TransitionCell => ({ next, status: "allowed" })
const absorbing = (next: State): TransitionCell => ({ next, status: "absorbing" })
const invalid = (next: State): TransitionCell => ({ next, status: "invalid" })

/** Every State × Event cell is written here; no default or fallthrough transition exists. */
export const TRANSITION_TABLE = {
  Authorized: {
    AcceptRisk: invalid("Authorized"),
    Acknowledge: invalid("Authorized"),
    Authorize: allowed("Authorized"),
    Dispatch: allowed("InFlight"),
    ObserveUnproven: invalid("Authorized"),
    Plan: invalid("Authorized"),
    Reject: allowed("Rejected"),
    Stop: allowed("SafeStopped"),
    Succeed: invalid("Authorized")
  },
  Idle: {
    AcceptRisk: invalid("Idle"),
    Acknowledge: invalid("Idle"),
    Authorize: allowed("Authorized"),
    Dispatch: allowed("InFlight"),
    ObserveUnproven: allowed("Unproven"),
    Plan: allowed("Planned"),
    Reject: allowed("Rejected"),
    Stop: allowed("SafeStopped"),
    Succeed: allowed("Succeeded")
  },
  InFlight: {
    AcceptRisk: invalid("InFlight"),
    Acknowledge: allowed("InFlight"),
    Authorize: invalid("InFlight"),
    Dispatch: invalid("InFlight"),
    ObserveUnproven: allowed("Unproven"),
    Plan: allowed("Planned"),
    Reject: allowed("Rejected"),
    Stop: allowed("SafeStopped"),
    Succeed: allowed("Succeeded")
  },
  Planned: {
    AcceptRisk: invalid("Planned"),
    Acknowledge: invalid("Planned"),
    Authorize: allowed("Authorized"),
    Dispatch: invalid("Planned"),
    ObserveUnproven: allowed("Unproven"),
    Plan: allowed("Planned"),
    Reject: allowed("Rejected"),
    Stop: allowed("SafeStopped"),
    Succeed: invalid("Planned")
  },
  Rejected: {
    AcceptRisk: absorbing("Rejected"),
    Acknowledge: absorbing("Rejected"),
    Authorize: absorbing("Rejected"),
    Dispatch: absorbing("Rejected"),
    ObserveUnproven: absorbing("Rejected"),
    Plan: absorbing("Rejected"),
    Reject: absorbing("Rejected"),
    Stop: absorbing("Rejected"),
    Succeed: absorbing("Rejected")
  },
  RiskAccepted: {
    AcceptRisk: allowed("RiskAccepted"),
    Acknowledge: invalid("RiskAccepted"),
    Authorize: allowed("Authorized"),
    Dispatch: invalid("RiskAccepted"),
    ObserveUnproven: invalid("RiskAccepted"),
    Plan: invalid("RiskAccepted"),
    Reject: allowed("Rejected"),
    Stop: allowed("SafeStopped"),
    Succeed: invalid("RiskAccepted")
  },
  SafeStopped: {
    AcceptRisk: absorbing("SafeStopped"),
    Acknowledge: absorbing("SafeStopped"),
    Authorize: absorbing("SafeStopped"),
    Dispatch: absorbing("SafeStopped"),
    ObserveUnproven: absorbing("SafeStopped"),
    Plan: absorbing("SafeStopped"),
    Reject: absorbing("SafeStopped"),
    Stop: absorbing("SafeStopped"),
    Succeed: absorbing("SafeStopped")
  },
  Succeeded: {
    AcceptRisk: absorbing("Succeeded"),
    Acknowledge: absorbing("Succeeded"),
    Authorize: absorbing("Succeeded"),
    Dispatch: absorbing("Succeeded"),
    ObserveUnproven: absorbing("Succeeded"),
    Plan: absorbing("Succeeded"),
    Reject: absorbing("Succeeded"),
    Stop: absorbing("Succeeded"),
    Succeed: absorbing("Succeeded")
  },
  Unproven: {
    AcceptRisk: allowed("RiskAccepted"),
    Acknowledge: invalid("Unproven"),
    Authorize: allowed("Authorized"),
    Dispatch: invalid("Unproven"),
    ObserveUnproven: allowed("Unproven"),
    Plan: allowed("Planned"),
    Reject: allowed("Rejected"),
    Stop: allowed("SafeStopped"),
    Succeed: invalid("Unproven")
  }
} as const satisfies TotalTransitionTable

export const TRANSITION_CELLS = STATES.flatMap((state) => EVENTS.map((event) => ({
  id: `${state}+${event}`,
  state,
  event,
  ...TRANSITION_TABLE[state][event]
})))

// This literal is the independently countable readability surface consumed by
// the runner. The assertion below keeps it equal to the executable table; a
// computed-only export would make the metric depend on candidate execution.
export const FORBIDDEN_TRANSITIONS = [
  "Authorized+AcceptRisk",
  "Authorized+Acknowledge",
  "Authorized+ObserveUnproven",
  "Authorized+Plan",
  "Authorized+Succeed",
  "Idle+AcceptRisk",
  "Idle+Acknowledge",
  "InFlight+AcceptRisk",
  "InFlight+Authorize",
  "InFlight+Dispatch",
  "Planned+AcceptRisk",
  "Planned+Acknowledge",
  "Planned+Dispatch",
  "Planned+Succeed",
  "RiskAccepted+Acknowledge",
  "RiskAccepted+Dispatch",
  "RiskAccepted+ObserveUnproven",
  "RiskAccepted+Plan",
  "RiskAccepted+Succeed",
  "Unproven+Acknowledge",
  "Unproven+Dispatch",
  "Unproven+Succeed"
] as const
const derivedForbiddenTransitions = TRANSITION_CELLS
  .filter((cell) => cell.status === "invalid")
  .map((cell) => cell.id)
if (JSON.stringify(derivedForbiddenTransitions) !== JSON.stringify(FORBIDDEN_TRANSITIONS)) {
  throw new Error("literal forbidden-transition inventory differs from the total transition table")
}
export const FORBIDDEN_TRANSITION_COUNT = FORBIDDEN_TRANSITIONS.length

export const transition = (state: State, event: TransitionEvent): State => {
  const cell: TransitionCell = TRANSITION_TABLE[state][event]
  if (cell.status === "invalid") throw new Error(`invalid transition ${state} + ${event}`)
  return cell.next
}

export const terminalOutcome = (state: State): TerminalOutcome => {
  switch (state) {
    case "Succeeded": return "Succeeded"
    case "Rejected": return "Rejected"
    case "SafeStopped": return "SafeStop"
    case "InFlight":
    case "Unproven": return "Inconclusive"
    case "Authorized":
    case "Idle":
    case "Planned":
    case "RiskAccepted": throw new Error(`terminal report requested from ${state}`)
  }
}
