import type { DispatchBasis, JournalEvent, OperationStatus, Plan, ReleaseReport, RequestFacts } from "./contracts.js"
import { canonical } from "./identity.js"

export interface CandidateRequest { readonly facts: RequestFacts; readonly fingerprint: string }
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
export type MachineConstructor = (plan: Plan, events: ReadonlyArray<JournalEvent>) => Machine

/** Protocol law shared by representations, not inferred from provider labels. */
export const sameProtectedRequest = (recorded: RequestFacts, candidate: RequestFacts): boolean =>
  recorded.transport === "core.git/1" && recorded.method === "update-ref" &&
  recorded.replay._tag === "GitCas" && canonical(recorded) === canonical(candidate)

export const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  canonical([...left].sort()) === canonical([...right].sort())
