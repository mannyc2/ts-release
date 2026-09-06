/**
 * Delta over docs/refactor/architecture-program/handoff/kernel-api.d.ts (the full amended file is
 * handoff-amendment/kernel-api.d.ts; the patch is patches/handoff-kernel-api.d.ts.patch).
 * Everything here is witnessed by examples/ against the lab kernel; names use the production domains.
 */
import type * as Effect from "effect/Effect"
import type * as Schema from "effect/Schema"
import type {
  DispatchBasis, JournalEvent, JournalStore, JournalContext, OperationStatus, Plan, ProviderDefinition as ProposedProviderDefinition,
  ReleaseError, ReleaseReport, RequestFacts, Transport
} from "../../../../docs/refactor/architecture-program/handoff/kernel-api.js"

// ---- 1. Evaluator seam ---------------------------------------------------------------------------
export interface CandidateRequest { readonly facts: RequestFacts; readonly fingerprint: string }
export type Next =
  | { readonly _tag: "PrepareDispatch" }
  | { readonly _tag: "AppendDispatch"; readonly basis: DispatchBasis }
  | { readonly _tag: "RequestRiskAcceptance" }
  | { readonly _tag: "Finish"; readonly status: OperationStatus }
/** Immutable value over one scope's validated history. `next` is pure in (history, plan, candidate, now). */
export interface Machine {
  /** Throws ReleaseError for an illegal next event; returns the successor. Never performs effects. */
  readonly append: (event: JournalEvent) => Machine
  readonly report: () => ReleaseReport
  readonly next: (operationId: string, candidate: CandidateRequest | null, now: number) => Next
}
/** Folds `events` through `append`, so impossible histories are rejected on construction. */
export type MachineConstructor = (plan: Plan, events: ReadonlyArray<JournalEvent>) => Machine
export declare const historyMachine: MachineConstructor            // kernel default (M1)
export declare const sameProtectedRequest: (recorded: RequestFacts, candidate: RequestFacts) => boolean
export declare const sameStrings: (left: ReadonlyArray<string>, right: ReadonlyArray<string>) => boolean

// ---- 2. Provider contract literal ------------------------------------------------------------------
export declare const PROVIDER_CONTRACT: "ts-release/provider/1"
export interface ProviderDefinition extends ProposedProviderDefinition {
  /** Verified for every definition before any store read, provider effect or send. Installers do not carry this law. */
  readonly contract: typeof PROVIDER_CONTRACT
}

// ---- 3. Host: the one construction boundary --------------------------------------------------------
export interface HostShape {
  readonly store: JournalStore            // authoritative journal; decorators (caches) wrap it, they never replace its CAS
  readonly transport: Transport           // one native send per permit
  readonly providers: ReadonlyArray<ProviderDefinition>
  readonly now: () => number
  readonly uniqueId: () => string
  readonly journal?: JournalContext        // explicit shared root + admitted scopes (Apple, other producers)
  readonly machine?: MachineConstructor    // default historyMachine
}

// ---- 4. Bounded diagnostic for an undecodable committed receipt --------------------------------------
declare const CoreUndecodableReceipt_base: Schema.Class<CoreUndecodableReceipt, Schema.Struct<{
  readonly code: Schema.String; readonly message: Schema.String; readonly receiptSha256: Schema.String; readonly receiptBytes: Schema.String
}>, {}>
/** Recorded as ObservationRecorded { evidenceKind: "DispatchError", status: "Inconclusive", evidenceVersion: "core-undecodable-receipt/1" }.
 *  message is truncated to 256 characters and passes the host redaction boundary; no raw response bytes are retained. */
export declare class CoreUndecodableReceipt extends CoreUndecodableReceipt_base {}

// ---- 5. Unchanged seams the application already composes (for reference) ---------------------------
// JournalStore { read(journalId): Effect<Snapshot>; append(journalId, expectedRevision, event): Effect<AppendResult> }
// Transport    { send(prepared): Effect<SendResult> }            makeCoreGitTransport(bindings, otherwise?)
// CreateApplication = (input: unknown) => Effect<{ host: HostShape; options: RunOptions }, ReleaseError, Scope>
// runRelease / observeRelease / reportRelease / supersedePlan / acceptRisk : Effect<ReleaseReport, ReleaseError, Host>
export type { Effect }
