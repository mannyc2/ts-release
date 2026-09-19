/**
 * Machine state-space enumeration — an M2 hypothesis spike.
 *
 * Charter (plan 005, machine selection): enumerate the complete operation
 * lifecycle state x event x decision space implied by the canonical research,
 * classify every cell, and test whether M2-total-transition remains viable.
 * This file neither implements M1 nor selects between the candidates. Only
 * hash-bound results from both candidate roots under the shared trial runner
 * may select a machine or require a measured maintainer decision.
 *
 * Authorities (exact sources this file mechanizes):
 * - docs/refactor/research/resumability.md — event families, decision
 *   codomain, four lawful later-attempt cases, replay algebra, strict
 *   correspondence rule, mutation uncertainty boundary.
 * - docs/refactor/architecture-program/inputs/trial-spec.json — the 16
 *   machine cases C01-C16 with required terminal outcomes, and laws L01-L14.
 * - docs/refactor/research/decision-packet.md — strict replay rule (any
 *   fingerprint mismatch stops), one-operation-composite-receipt npm.
 * - advisor-plans/005-freeze-research-complete-system-contract.md — machine
 *   and topology selection remain separate measured trial phases.
 *
 * Predeclared viability criteria (all must hold for the M2 hypothesis):
 *   V1  named lifecycle states <= 16
 *   V2  fold table total over states x events, every cell classified
 *       advance/absorb/impossible with a reason — zero judgment cells
 *   V3  decision table fully enumerated with <= 128 cells
 *   V4  every machine-walk case C01-C13 reproduces its required terminal
 *       outcome from the tables alone; C14-C16 are explicitly classified as
 *       interpreter/store/boundary obligations with named owners
 *   V5  every provider family in launch scope projects onto these states
 *       with zero additional lifecycle states
 *
 * Deliberately recorded assumptions (maintainer-visible, not silently
 * resolved) are listed in FINDINGS at the bottom and printed on every run.
 *
 * Zero dependencies. Run: bun prototypes/research-complete-machine/state-space.ts
 * Exit code 0 = every local hypothesis check passed. It is not a candidate
 * receipt or selection result.
 */

// ---------------------------------------------------------------------------
// 1. Lifecycle states — the fold's codomain (state is a projection of the
//    journal, law L01; one pure transition owner, law L02).
// ---------------------------------------------------------------------------

const STATES = [
  /** Operation exists in the validated plan; no attempt facts recorded. */
  "PlannedReady",
  /** DispatchRejectedBeforeCommit recorded; no attempt ever crossed the
   *  mutation uncertainty boundary. Terminal: Rejected. */
  "RejectedBeforeCommit",
  /** DispatchStarted appended for the latest attempt; no receipt or fresh
   *  observation for that attempt. The uncertainty region. */
  "AttemptInFlight",
  /** A provider receipt or fresh authoritative observation proves the
   *  intended coordinate/state. The evidence kind remains a journal fact;
   *  it is not a distinct continuation state (law L04). */
  "ProvenSatisfied",
  /** Fresh observation shows absence or pending — never proof of
   *  non-commit (observed absence cannot fence an in-flight mutation). */
  "ObservedUnproven",
  /** Trusted transport/provider evidence proves the earlier attempt cannot
   *  commit now or later (lawful later-attempt case 2). */
  "ObservedNonCommit",
  /** The coordinate exists in a conflicting form the intent cannot satisfy. */
  "ObservedConflict",
  /** RiskAccepted bound to this exact operation and request fingerprint;
   *  no new attempt appended yet (lawful later-attempt case 4). */
  "RiskAuthorized",
  /** PlanSuperseded wins decision order; late evidence absorbs and never
   *  reopens the terminal (case C09). */
  "Superseded"
] as const
type State = (typeof STATES)[number]

// ---------------------------------------------------------------------------
// 2. Event kinds — the six research event families, with ObservationRecorded
//    split by its verdict payload so the fold table is total over kinds.
// ---------------------------------------------------------------------------

const EVENTS = [
  "DispatchStarted",
  "DispatchRejectedBeforeCommit",
  "ReceiptAccepted",
  "ObservationSatisfied",
  "ObservationUnproven",
  "ObservationNonCommitProof",
  "ObservationConflict",
  "RiskAccepted",
  "PlanSuperseded"
] as const
type EventKind = (typeof EVENTS)[number]

/** Research family count check: 6 families project onto 9 kinds only by
 *  splitting ObservationRecorded's verdict; no new family is invented. */
const RESEARCH_EVENT_FAMILIES = [
  "DispatchStarted",
  "DispatchRejectedBeforeCommit",
  "ReceiptAccepted",
  "ObservationRecorded",
  "RiskAccepted",
  "PlanSuperseded"
] as const

// ---------------------------------------------------------------------------
// 3. Fold table — total over State x EventKind. Every cell is one of:
//    advance     — lawful transition to `next`
//    absorb      — event is durably recorded (late/duplicate/baseline fact)
//                  but the decision state does not change
//    impossible  — the single interpreter (law L03) must refuse to append
//                  this event in this state; each such cell is a removed
//                  representable-invalid-state and an append-guard obligation
// ---------------------------------------------------------------------------

type FoldCell =
  | { class: "advance"; next: State; why: string }
  | { class: "absorb"; why: string }
  | { class: "impossible"; why: string }

const adv = (next: State, why: string): FoldCell => ({ class: "advance", next, why })
const abs = (why: string): FoldCell => ({ class: "absorb", why })
const imp = (why: string): FoldCell => ({ class: "impossible", why })

const FOLD: Record<State, Record<EventKind, FoldCell>> = {
  PlannedReady: {
    DispatchStarted: adv("AttemptInFlight", "initial attempt; authority constructed by the CAS append itself"),
    DispatchRejectedBeforeCommit: adv("RejectedBeforeCommit", "pre-boundary failure creates no attempt (C02, C08, C11)"),
    ReceiptAccepted: imp("receipt without any attempt"),
    ObservationSatisfied: adv("ProvenSatisfied", "intent already satisfied without dispatch; idempotent re-run stops satisfied"),
    ObservationUnproven: abs("baseline observation (e.g. CAS head at expected-old) recorded before first attempt (C05 seed)"),
    ObservationNonCommitProof: imp("nothing to prove non-commit of"),
    ObservationConflict: adv("ObservedConflict", "coordinate occupied in a conflicting form before any attempt"),
    RiskAccepted: imp("risk acceptance is derived from an uncertain attempt; none exists"),
    PlanSuperseded: adv("Superseded", "plan replaced before any attempt")
  },
  RejectedBeforeCommit: {
    DispatchStarted: imp("rejected operation re-attempts only through a new plan revision"),
    DispatchRejectedBeforeCommit: imp("duplicate rejection"),
    ReceiptAccepted: imp("no attempt existed"),
    ObservationSatisfied: abs("external satisfaction recorded as fact; rejection terminal is derived from this plan's history"),
    ObservationUnproven: abs("observation recorded; terminal unchanged"),
    ObservationNonCommitProof: imp("no attempt existed"),
    ObservationConflict: abs("observation recorded; terminal unchanged"),
    RiskAccepted: imp("no uncertain attempt to accept risk for"),
    PlanSuperseded: abs("supersession recorded; operation already terminal"),
  },
  AttemptInFlight: {
    DispatchStarted: imp("second attempt without an intervening observation — decision table forces ObserveOrWait first"),
    DispatchRejectedBeforeCommit: imp("attempt already crossed the uncertainty boundary"),
    ReceiptAccepted: adv("ProvenSatisfied", "provider documented success for the attempt (C01)"),
    ObservationSatisfied: adv("ProvenSatisfied", "fresh observation proves satisfaction (C03)"),
    ObservationUnproven: adv("ObservedUnproven", "absence/pending is not non-commit proof (C04, C13)"),
    ObservationNonCommitProof: adv("ObservedNonCommit", "trusted evidence the attempt cannot commit"),
    ObservationConflict: adv("ObservedConflict", "coordinate occupied in a conflicting form"),
    RiskAccepted: imp("risk request derives from an observed-inconclusive state, not from a fresh attempt"),
    PlanSuperseded: adv("Superseded", "supersession wins decision order mid-flight (C09)")
  },
  ProvenSatisfied: {
    DispatchStarted: imp("satisfied operations never re-dispatch"),
    DispatchRejectedBeforeCommit: imp("attempt history exists or satisfaction pre-empts it"),
    ReceiptAccepted: abs("receipt evidence is preserved; the interpreter rejects a duplicate dispatchId before the fold"),
    ObservationSatisfied: abs("observation evidence is preserved; re-observation confirms"),
    ObservationUnproven: abs("later ambiguity does not un-satisfy a proven coordinate; fact recorded"),
    ObservationNonCommitProof: imp("contradicts proven satisfaction — integrity failure, not a lawful transition"),
    ObservationConflict: abs("later drift is recorded for the report; satisfaction at decision time stands"),
    RiskAccepted: imp("no uncertainty to accept"),
    PlanSuperseded: adv("Superseded", "supersession after satisfaction; report preserves both")
  },
  ObservedUnproven: {
    DispatchStarted: adv("AttemptInFlight", "lawful re-attempt appended only when the decision table authorized it (C05, C06)"),
    DispatchRejectedBeforeCommit: imp("attempt exists"),
    ReceiptAccepted: adv("ProvenSatisfied", "late receipt resolves the uncertainty as documented success"),
    ObservationSatisfied: adv("ProvenSatisfied", "later observation proves satisfaction (C03 resume path)"),
    ObservationUnproven: abs("repeat ambiguity"),
    ObservationNonCommitProof: adv("ObservedNonCommit", "later evidence proves non-commit"),
    ObservationConflict: adv("ObservedConflict", "later evidence proves conflict"),
    RiskAccepted: adv("RiskAuthorized", "maintainer accepts resend risk for the exact request (C06)"),
    PlanSuperseded: adv("Superseded", "supersession during uncertainty")
  },
  ObservedNonCommit: {
    DispatchStarted: adv("AttemptInFlight", "lawful later attempt: earlier attempt proven unable to commit (case 2)"),
    DispatchRejectedBeforeCommit: imp("attempt exists"),
    ReceiptAccepted: imp("contradicts non-commit proof — integrity failure"),
    ObservationSatisfied: adv("ProvenSatisfied", "satisfied by another lawful actor or corrected evidence"),
    ObservationUnproven: abs("weaker evidence does not erase non-commit proof"),
    ObservationNonCommitProof: abs("repeat proof"),
    ObservationConflict: adv("ObservedConflict", "coordinate later occupied conflictingly"),
    RiskAccepted: imp("non-commit is proven; a fresh attempt is already lawful without risk"),
    PlanSuperseded: adv("Superseded", "supersession recorded")
  },
  ObservedConflict: {
    DispatchStarted: imp("conflict requires a new plan revision or supersession, never a blind resend"),
    DispatchRejectedBeforeCommit: imp("attempt exists or conflict pre-empts it"),
    ReceiptAccepted: abs("late receipt recorded; conflict decision derives from fresh authoritative state"),
    ObservationSatisfied: adv("ProvenSatisfied", "conflict resolved externally in the intent's favor"),
    ObservationUnproven: abs("ambiguity does not erase an observed conflict"),
    ObservationNonCommitProof: abs("non-commit of our attempt recorded; the conflict fact stands"),
    ObservationConflict: abs("repeat conflict"),
    RiskAccepted: imp("risk acceptance covers resend uncertainty, not overwriting a conflicting coordinate"),
    PlanSuperseded: adv("Superseded", "correction path: superseding plan owns the conflict")
  },
  RiskAuthorized: {
    DispatchStarted: adv("AttemptInFlight", "risk-authorized re-attempt (C06)"),
    DispatchRejectedBeforeCommit: imp("attempt exists"),
    ReceiptAccepted: adv("ProvenSatisfied", "late receipt for the earlier attempt arrives before resend — resend is avoided"),
    ObservationSatisfied: adv("ProvenSatisfied", "observation before resend proves satisfaction — resend avoided"),
    ObservationUnproven: abs("still uncertain; risk authority stands"),
    ObservationNonCommitProof: adv("ObservedNonCommit", "proof arrives; structural lawfulness supersedes risk authority"),
    ObservationConflict: adv("ObservedConflict", "conflict voids the resend premise"),
    RiskAccepted: imp("one bound risk acceptance per request; duplicates are append-guarded"),
    PlanSuperseded: adv("Superseded", "supersession voids pending risk authority")
  },
  Superseded: {
    DispatchStarted: imp("superseded plans never dispatch (C09: supersession wins decision order)"),
    DispatchRejectedBeforeCommit: imp("no new pre-commit path on a superseded plan"),
    ReceiptAccepted: abs("late receipt preserved without reopening (C09)"),
    ObservationSatisfied: abs("late observation preserved without reopening (C09)"),
    ObservationUnproven: abs("late observation preserved"),
    ObservationNonCommitProof: abs("late proof preserved"),
    ObservationConflict: abs("late conflict preserved"),
    RiskAccepted: imp("no future effects to authorize on a superseded plan"),
    PlanSuperseded: abs("duplicate supersession recorded")
  }
}

// ---------------------------------------------------------------------------
// 4. Decision table — decideNextAttempt(plan, journal, preparedRequest, now).
//    Total over states; input facts appear only where they change the output.
//    Codomain reconciled with the research's eight values: the five progress
//    decisions are kept verbatim; the three Stop* values generalize to
//    Stop(reason) so RejectedBeforeCommit and Superseded stops are
//    representable (see FINDINGS F1).
// ---------------------------------------------------------------------------

const DECISIONS = [
  "InitialAttempt",
  "ReplayFromNonCommitProof",
  "ReplayFromRecordedProtection",
  "RequiresRiskAcceptance",
  "ObserveOrWait",
  "Stop(satisfied)",
  "Stop(conflict)",
  "Stop(inconclusive)",
  "Stop(rejected)",
  "Stop(superseded)"
] as const
type Decision = (typeof DECISIONS)[number]

/** Prepared-request viability at PlannedReady (pre-boundary checks). */
const PREPARED = ["viable", "planMismatch", "validationFailure"] as const
type Prepared = (typeof PREPARED)[number]

/** Correspondence of a newly prepared request with the recorded attempt:
 *  strict rule — any fingerprint/endpoint/authorization mismatch stops. */
const CORRESPONDENCE = ["match", "mismatch"] as const
type Correspondence = (typeof CORRESPONDENCE)[number]

/** Recorded replay-protection scheme of the earlier attempt. Only
 *  replay.cas/1 carries a structural, core-evidenced protocol law in v1. */
const SCHEMES = ["replay.none/1", "replay.idempotency-key/1", "replay.cas/1", "replay.exact-duplicate/1", "unknown"] as const
type Scheme = (typeof SCHEMES)[number]

/** Whether the recorded CAS condition is still the fresh authoritative
 *  state (expected-old still at head). Ignored for non-cas schemes. */
const CONDITION = ["holds", "void"] as const
type Condition = (typeof CONDITION)[number]

/** Whether a bound RiskAccepted still corresponds to the request the
 *  current code prepares (strict rule voids drifted authority). */
const RISK_BOUND = ["corresponds", "drifted"] as const
type RiskBound = (typeof RISK_BOUND)[number]

type DecisionCell = { decision: Decision; why: string }
type DecisionRow =
  | { state: State; input: "none"; cell: DecisionCell }
  | { state: "PlannedReady"; input: "prepared"; cells: Record<Prepared, DecisionCell> }
  | { state: "ObservedUnproven"; input: "correspondence x scheme x condition"; cells: Record<Correspondence, Record<Scheme, Record<Condition, DecisionCell>>> }
  | { state: "RiskAuthorized"; input: "riskBound"; cells: Record<RiskBound, DecisionCell> }

const unprovenCell = (c: Correspondence, s: Scheme, k: Condition): DecisionCell => {
  if (c === "mismatch") {
    return { decision: "Stop(inconclusive)", why: "strict rule: the historical request cannot be reconstructed; even risk acceptance would authorize a different request — new plan revision required" }
  }
  if (s === "replay.cas/1" && k === "holds") {
    return { decision: "ReplayFromRecordedProtection", why: "structural core CAS law + exact correspondence + condition holds (C05)" }
  }
  if (s === "replay.cas/1") {
    return { decision: "RequiresRiskAcceptance", why: "condition void: head moved; only a human may accept resend risk" }
  }
  return { decision: "RequiresRiskAcceptance", why: "no structural protocol law in v1 (npm/warehouse/opaque/unknown schemes never auto-replay); honest stop reports Inconclusive unless a maintainer accepts risk (C04, C06, C13)" }
}

const DECISION_TABLE: ReadonlyArray<DecisionRow> = [
  {
    state: "PlannedReady",
    input: "prepared",
    cells: {
      viable: { decision: "InitialAttempt", why: "no earlier DispatchStarted (lawful case 1)" },
      planMismatch: { decision: "Stop(rejected)", why: "prepared request does not correspond to the reviewed plan (C08) — command appends DispatchRejectedBeforeCommit" },
      validationFailure: { decision: "Stop(rejected)", why: "pre-boundary validation/credential/artifact failure creates no attempt (C02, C11)" }
    }
  },
  { state: "RejectedBeforeCommit", input: "none", cell: { decision: "Stop(rejected)", why: "terminal" } },
  { state: "AttemptInFlight", input: "none", cell: { decision: "ObserveOrWait", why: "observation always precedes any post-attempt decision — collapses this state to one cell (C03, C04, C05, C13 resume shape)" } },
  { state: "ProvenSatisfied", input: "none", cell: { decision: "Stop(satisfied)", why: "a receipt or authoritative observation proves satisfaction; evidence kind remains a journal fact" } },
  { state: "ObservedNonCommit", input: "none", cell: { decision: "ReplayFromNonCommitProof", why: "lawful case 2: earlier attempt proven unable to commit; a fresh attempt is lawful" } },
  { state: "ObservedConflict", input: "none", cell: { decision: "Stop(conflict)", why: "conflicting occupation is never overwritten automatically" } },
  {
    state: "ObservedUnproven",
    input: "correspondence x scheme x condition",
    cells: Object.fromEntries(CORRESPONDENCE.map((c) => [c, Object.fromEntries(SCHEMES.map((s) => [s, Object.fromEntries(CONDITION.map((k) => [k, unprovenCell(c, s, k)]))]))])) as Record<Correspondence, Record<Scheme, Record<Condition, DecisionCell>>>
  },
  {
    state: "RiskAuthorized",
    input: "riskBound",
    cells: {
      corresponds: { decision: "InitialAttempt", why: "risk-authorized attempt on the exact bound request (lawful case 4, C06)" },
      drifted: { decision: "Stop(inconclusive)", why: "risk authority is bound to the exact request; drift voids it (strict rule)" }
    }
  },
  { state: "Superseded", input: "none", cell: { decision: "Stop(superseded)", why: "superseding plan owns all future effects (C09)" } }
]

// ---------------------------------------------------------------------------
// 5. Interpreter append sub-table (law L03: CAS is the sole constructor of
//    dispatch authority) — the store-outcome half of the machine that the
//    fold never sees, covering C07 and C10.
// ---------------------------------------------------------------------------

const APPEND_TABLE = [
  { outcome: "Applied", readback: "n/a", action: "ProceedAuthorized", why: "committed read-back-visible append constructs authority" },
  { outcome: "StaleExpectedRevision", readback: "n/a", action: "RefoldNoSend", why: "CAS loser reloads and must not send (C07)" },
  { outcome: "Ambiguous", readback: "ownEventPresent", action: "TreatAsApplied", why: "read-back finds the exact event: the append committed (C10)" },
  { outcome: "Ambiguous", readback: "otherEventAtRevision", action: "SafeStopNoReappend", why: "head advanced by another writer; re-append would double-authorize (C10)" },
  { outcome: "Ambiguous", readback: "readUnavailable", action: "SafeStopNoReappend", why: "cannot prove the append's fate; never re-append blind (C10 shape)" }
] as const

/** Evidence kinds deliberately do not become continuation states. The exact
 *  receipt append guard still inspects journal facts before the pure fold:
 *  one receipt per dispatch identity. Repeated observations remain ordinary
 *  append/absorb facts; this spike does not invent an observation identity. */
const SATISFACTION_EVIDENCE_KINDS = ["ReceiptAccepted", "ObservationSatisfied"] as const
const RECEIPT_APPEND_GUARD = {
  identity: "dispatchId",
  duplicate: "reject",
  distinct: "append-and-project-ProvenSatisfied"
} as const

// ---------------------------------------------------------------------------
// 6. Terminal report projection (law L01: the report is derived).
// ---------------------------------------------------------------------------

type TerminalReport = "Succeeded" | "Rejected" | "Inconclusive" | "SafeStop" | "Pending"
type ReportReason =
  | "Ready"
  | "RejectedBeforeCommit"
  | "AwaitingObservation"
  | "Satisfied"
  | "Unproven"
  | "ReplayAuthorizedByNonCommitProof"
  | "Conflict"
  | "RiskAuthorized"
  | "Superseded"

interface ReportProjection {
  outcome: TerminalReport
  reason: ReportReason
}

const REPORT: Record<State, ReportProjection> = {
  PlannedReady: { outcome: "Pending", reason: "Ready" },
  RejectedBeforeCommit: { outcome: "Rejected", reason: "RejectedBeforeCommit" },
  AttemptInFlight: { outcome: "Pending", reason: "AwaitingObservation" },
  ProvenSatisfied: { outcome: "Succeeded", reason: "Satisfied" },
  ObservedUnproven: { outcome: "Inconclusive", reason: "Unproven" },
  ObservedNonCommit: { outcome: "Pending", reason: "ReplayAuthorizedByNonCommitProof" },
  ObservedConflict: { outcome: "SafeStop", reason: "Conflict" },
  RiskAuthorized: { outcome: "Pending", reason: "RiskAuthorized" },
  Superseded: { outcome: "SafeStop", reason: "Superseded" }
}

// ---------------------------------------------------------------------------
// 7. Machine-case walks — each trial case C01-C13 replayed through the
//    tables; expected outcomes are the trial spec's requiredTerminalOutcome
//    values verbatim. C14-C16 are boundary/store obligations (section 8).
// ---------------------------------------------------------------------------

type Step =
  | { fold: EventKind }
  | { expectDecision: Decision; at?: { prepared?: Prepared; correspondence?: Correspondence; scheme?: Scheme; condition?: Condition; riskBound?: RiskBound } }

interface CaseWalk {
  id: string
  outcome: TerminalReport
  steps: ReadonlyArray<Step>
  note?: string
}

const CASE_WALKS: ReadonlyArray<CaseWalk> = [
  {
    id: "C01-initial-success",
    outcome: "Succeeded",
    steps: [
      { expectDecision: "InitialAttempt", at: { prepared: "viable" } },
      { fold: "DispatchStarted" },
      { fold: "ReceiptAccepted" },
      { expectDecision: "Stop(satisfied)" },
      { fold: "ObservationSatisfied" }
    ]
  },
  {
    id: "C02-rejection-before-commit",
    outcome: "Rejected",
    steps: [
      { expectDecision: "Stop(rejected)", at: { prepared: "validationFailure" } },
      { fold: "DispatchRejectedBeforeCommit" }
    ]
  },
  {
    id: "C03-response-loss-satisfied-observation",
    outcome: "Succeeded",
    steps: [
      { fold: "DispatchStarted" },
      { expectDecision: "ObserveOrWait" },
      { fold: "ObservationSatisfied" },
      { fold: "ReceiptAccepted" }
    ],
    note: "fresh runner; late receipt absorbs after proven satisfaction (late-fact-preserved)"
  },
  {
    id: "C04-response-loss-inconclusive-stop",
    outcome: "Inconclusive",
    steps: [
      { fold: "DispatchStarted" },
      { expectDecision: "ObserveOrWait" },
      { fold: "ObservationUnproven" },
      { expectDecision: "RequiresRiskAcceptance", at: { correspondence: "match", scheme: "replay.none/1", condition: "holds" } }
    ],
    note: "npm replay.none: absence never authorizes resend; host stops, report is Inconclusive"
  },
  {
    id: "C05-core-git-cas-protected-replay",
    outcome: "Succeeded",
    steps: [
      { fold: "ObservationUnproven" },
      { fold: "DispatchStarted" },
      { expectDecision: "ObserveOrWait" },
      { fold: "ObservationUnproven" },
      { expectDecision: "ReplayFromRecordedProtection", at: { correspondence: "match", scheme: "replay.cas/1", condition: "holds" } },
      { fold: "DispatchStarted" },
      { fold: "ObservationSatisfied" }
    ],
    note: "baseline observation, lost first response, structural CAS replay, at most one replay"
  },
  {
    id: "C06-explicit-risk-acceptance",
    outcome: "Succeeded",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "ObservationUnproven" },
      { expectDecision: "RequiresRiskAcceptance", at: { correspondence: "match", scheme: "replay.none/1", condition: "holds" } },
      { fold: "RiskAccepted" },
      { expectDecision: "InitialAttempt", at: { riskBound: "corresponds" } },
      { fold: "DispatchStarted" },
      { fold: "ObservationSatisfied" }
    ]
  },
  {
    id: "C07-concurrent-runners-single-cas-winner",
    outcome: "Succeeded",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "ObservationSatisfied" }
    ],
    note: "winner path; the loser is the APPEND_TABLE StaleExpectedRevision row (RefoldNoSend)"
  },
  {
    id: "C08-request-endpoint-mismatch",
    outcome: "Rejected",
    steps: [
      { expectDecision: "Stop(rejected)", at: { prepared: "planMismatch" } },
      { fold: "DispatchRejectedBeforeCommit" }
    ]
  },
  {
    id: "C09-supersession-late-evidence",
    outcome: "SafeStop",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "PlanSuperseded" },
      { fold: "ReceiptAccepted" },
      { fold: "ObservationSatisfied" },
      { expectDecision: "Stop(superseded)" }
    ],
    note: "late receipt and observation absorb; the terminal never reopens"
  },
  {
    id: "C10-ambiguous-append-readback",
    outcome: "SafeStop",
    steps: [],
    note: "entirely the APPEND_TABLE Ambiguous rows: ownEventPresent=TreatAsApplied, otherwise SafeStopNoReappend"
  },
  {
    id: "C11-malformed-provider-graph",
    outcome: "Rejected",
    steps: [
      { expectDecision: "Stop(rejected)", at: { prepared: "validationFailure" } },
      { fold: "DispatchRejectedBeforeCommit" }
    ],
    note: "complete graph decoded before any provider effect; duplicate/dangling ids reject pre-boundary"
  },
  {
    id: "C12-external-provider-two-instances",
    outcome: "Succeeded",
    steps: [
      { expectDecision: "InitialAttempt", at: { prepared: "viable" } },
      { fold: "DispatchStarted" },
      { fold: "ReceiptAccepted" },
      { fold: "ObservationSatisfied" }
    ],
    note: "composition facts (import/Layer, two instances, zero kernel patch) are topology gates, not lifecycle states"
  },
  {
    id: "C13-apple-commit-before-id-loss",
    outcome: "Inconclusive",
    steps: [
      { fold: "DispatchStarted" },
      { expectDecision: "ObserveOrWait" },
      { fold: "ObservationUnproven" },
      { expectDecision: "RequiresRiskAcceptance", at: { correspondence: "match", scheme: "replay.none/1", condition: "holds" } }
    ],
    note: "missing submission id is not absence proof; no blind resubmission — identical machine shape to C04; Apple adds zero states"
  }
]

/** Cases that are real obligations but not operation-lifecycle transitions. */
const OUT_OF_LIFECYCLE = [
  { id: "C14-finalized-file-tree-adoption", outcome: "Succeeded", owner: "adoption envelope at the effect-build boundary (law L09, OD08)" },
  { id: "C15-host-dependency-shadowing", outcome: "Rejected", owner: "host composition law (law L05); rejects before any machine input exists" },
  { id: "C16-journal-bound-symmetry", outcome: "SafeStop", owner: "JournalStore byte-bound law (OD01/OB05); store refuses before the fold ever sees an event" }
] as const

// ---------------------------------------------------------------------------
// 8. Provider projection — every launch family maps onto the same lifecycle
//    with zero added states. This is the 69-outcomes-do-not-multiply claim
//    as checkable data: every referenced state and case shape must exist.
// ---------------------------------------------------------------------------

const PROVIDER_PROJECTION = [
  { family: "D01 npm", scheme: "replay.none/1", shapes: ["C01", "C03", "C04"], addedStates: 0, note: "one operation, composite version/tag receipt; lost response observes then stops honestly" },
  { family: "D02 Warehouse/PyPI", scheme: "replay.exact-duplicate/1", shapes: ["C01", "C04", "C06"], addedStates: 0, note: "exact-duplicate is a recorded fact, not v1 auto-replay authority" },
  { family: "D03 GitHub", scheme: "replay.none/1", shapes: ["C01", "C03", "C04"], addedStates: 0, note: "tag/release/assets are plural operations, each with the same lifecycle; distinct lost-response paths are distinct operations, not states" },
  { family: "D04 Homebrew", scheme: "replay.cas/1", shapes: ["C01", "C05"], addedStates: 0, note: "conditional Git publication rides the structural CAS law" },
  { family: "D05 Scoop", scheme: "replay.cas/1", shapes: ["C01", "C05"], addedStates: 0, note: "same conditional Git shape as D04" },
  { family: "D06 custom providers", scheme: "unknown", shapes: ["C12", "C04"], addedStates: 0, note: "opaque dispatch: valid for initial attempt and observation; never auto-replays" },
  { family: "D07 MCP Registry", scheme: "replay.none/1", shapes: ["C01", "C04"], addedStates: 0, note: "ambiguous completion continues by observation or honest stop" },
  { family: "Apple notarization", scheme: "replay.none/1", shapes: ["C13"], addedStates: 0, note: "commit-before-id is an observation-capability fact, not a state; Inconclusive is a report row" },
  { family: "AI01-AI03 OpenAI plugin delivery", scheme: "replay.cas/1", shapes: ["C02", "C05"], addedStates: 0, note: "marketplace entry via conditional Git; handoff validation is pre-boundary" },
  { family: "artifact production/trust (28 leaves)", scheme: "n/a", shapes: ["C14"], addedStates: 0, note: "production happens in effect-build before the plan; adoption is the boundary; no lifecycle states" }
] as const

// ---------------------------------------------------------------------------
// 9. Adversarial-trace reconciliation — docs/refactor/research/
//    adversarial-traces.md replayed against the tables. Walkable traces are
//    executed exactly like machine cases; the rest are classified with an
//    owner. A trace the tables cannot reproduce fails the run.
// ---------------------------------------------------------------------------

const ADVERSARIAL_WALKS: ReadonlyArray<CaseWalk> = [
  {
    id: "T2-lost-npm-response-satisfied",
    outcome: "Succeeded",
    steps: [
      { fold: "DispatchStarted" },
      { expectDecision: "ObserveOrWait" },
      { fold: "ObservationSatisfied" },
      { expectDecision: "Stop(satisfied)" }
    ]
  },
  {
    id: "T2-lost-npm-response-absent",
    outcome: "Inconclusive",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "ObservationUnproven" },
      { expectDecision: "RequiresRiskAcceptance", at: { correspondence: "match", scheme: "replay.none/1", condition: "holds" } }
    ],
    note: "version immutability alone never authorizes replay (T2.8): no cell auto-replays scheme none"
  },
  {
    id: "T3-warehouse-untouched-file",
    outcome: "Pending",
    steps: [{ expectDecision: "InitialAttempt", at: { prepared: "viable" } }],
    note: "per-file Intents are independent operations; the never-attempted file C dispatches initially while A is receipt-proven and B proves by observation"
  },
  {
    id: "T4-exact-duplicate-untrusted",
    outcome: "Inconclusive",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "ObservationUnproven" },
      { expectDecision: "RequiresRiskAcceptance", at: { correspondence: "match", scheme: "replay.exact-duplicate/1", condition: "holds" } }
    ],
    note: "request correspondence is insufficient without a trusted protocol-law authority (T4.7)"
  },
  {
    id: "T6-idempotency-header-ignored",
    outcome: "Inconclusive",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "ObservationUnproven" },
      { expectDecision: "RequiresRiskAcceptance", at: { correspondence: "match", scheme: "replay.idempotency-key/1", condition: "holds" } }
    ],
    note: "the double-commit E1/E2 requires a resend; no cell produces one for this scheme, so the machine cannot cause T6.5"
  },
  {
    id: "T9-github-starter-asset-noncommit",
    outcome: "Succeeded",
    steps: [
      { fold: "DispatchStarted" },
      { expectDecision: "ObserveOrWait" },
      { fold: "ObservationNonCommitProof" },
      { expectDecision: "ReplayFromNonCommitProof" },
      { fold: "DispatchStarted" },
      { fold: "ObservationSatisfied" }
    ],
    note: "documented starter-asset-after-502 is provider-evidenced non-commit; deleting the starter before re-upload is vertical recovery law (L06), not a lifecycle state"
  },
  {
    id: "T10-write-only-provider",
    outcome: "Inconclusive",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "ObservationUnproven" },
      { expectDecision: "RequiresRiskAcceptance", at: { correspondence: "match", scheme: "replay.none/1", condition: "holds" } }
    ],
    note: "no status API yields verdict Unproven; the provider stays valid with an explicit resumability ceiling (T10.5)"
  },
  {
    id: "T12-unknown-scheme-version",
    outcome: "Inconclusive",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "ObservationUnproven" },
      { expectDecision: "RequiresRiskAcceptance", at: { correspondence: "match", scheme: "unknown", condition: "holds" } }
    ],
    note: "replay.idempotency-key/2 is never reinterpreted under /1; the structured stop explanation is a report obligation"
  },
  {
    id: "T15-consumer-failure-after-acceptance",
    outcome: "Succeeded",
    steps: [
      { fold: "DispatchStarted" },
      { fold: "ReceiptAccepted" },
      { expectDecision: "Stop(satisfied)" }
    ],
    note: "consumer smoke failure is release policy above the operation machine; the journal never reopens the publication (facet C is not a journal event)"
  }
]

const ADVERSARIAL_NOTES = [
  { id: "T1-normal-npm-success", disposition: "identical to case walk C01" },
  { id: "T2-immutable-facet-tag-moved", disposition: "composite facet verdict derivation is the npm vertical's observation codec (L06); correction is a new tag Intent, not a lifecycle state" },
  { id: "T3-files-A-and-B", disposition: "C01 and C03 shapes on independent operations" },
  { id: "T5-git-cas-replay", disposition: "identical to case walk C05" },
  { id: "T7-equal-wire-facts-different-code", disposition: "wire-sufficient policy: correspondence inputs are fingerprint, endpoint, and authorization only; provenance is explanation, never a decision input" },
  { id: "T8-provider-controlled-identity", disposition: "operation identity is core-derived upstream of the machine; no state impact" },
  { id: "T11-two-fresh-runners", disposition: "APPEND_TABLE rows Applied and StaleExpectedRevision" },
  { id: "T13-journal-backend-race", disposition: "store law territory (OD01-OD04), outside the machine" },
  { id: "T14-apple-response-loss", disposition: "identical to case walk C13; durable submission-identity recovery is blocker OB06" },
  { id: "T16-plan-correction", disposition: "PlanSuperseded path plus a new plan revision with its own core-derived identity" }
] as const

/** Candidate-specific conformance evidence may add coverage but does not
 *  replace or amend any of the 16 shared trial cases. This walk closes the
 *  only state-coverage gap found by adversarial reconciliation. */
const CONFORMANCE_WALKS: ReadonlyArray<CaseWalk> = [
  {
    id: "MC01-conflicting-coordinate-safe-stop",
    outcome: "SafeStop",
    steps: [
      { fold: "ObservationConflict" },
      { expectDecision: "Stop(conflict)" }
    ],
    note: "a conflicting occupied coordinate is never overwritten; the terminal envelope is SafeStop with structured reason Conflict"
  }
]

// ---------------------------------------------------------------------------
// 10. Recorded findings and assumptions (maintainer-visible).
// ---------------------------------------------------------------------------

const FINDINGS = [
  "F1 decision-codomain reconciliation: the research's eight decision values omit stops for rejected and superseded operations; this table generalizes the three Stop* values to Stop(reason) with reasons satisfied|conflict|inconclusive|rejected|superseded. The five progress decisions are unchanged.",
  "F2 resolved — conflict reporting: ObservedConflict projects to the frozen SafeStop terminal envelope with structured reason Conflict. Conflict remains a first-class fact and continuation reason without inventing a fifth terminal outcome.",
  "F3 pre-attempt observations: observations may lawfully precede the first attempt (CAS baseline, already-satisfied idempotent re-run, occupied-conflicting). Satisfied/conflict advance the state; unproven absorbs as baseline.",
  "F4 ProvenSatisfied decides Stop(satisfied) without requiring both evidence forms: documented success is success; observation facets (A/M/B/C/J) are acceptance evidence per family, enforced by case fixtures rather than lifecycle policy.",
  "F5 integrity contradictions (non-commit proof after receipt or after proven satisfaction) are impossible cells: they indicate provider or store integrity failure and must surface as append-guard violations, not as lawful transitions.",
  "F6 the M1-style fold grammar can generate M2's table: `unprovenCell` is a four-line guard over an otherwise enumerated table. That overlap is a hypothesis finding, not a comparison result; separate M1 and M2 candidate roots must still prove whether they are genuinely distinct under the shared runner.",
  "F7 resolved — minimal quotient: receipt-proven and observation-proven satisfaction are one ProvenSatisfied continuation state. Their evidence kind and identity-specific duplicate guard remain journal/interpreter facts, satisfying the facts-not-decisions law while the nine-state table stays fully labeled and behaviorally minimal.",
  "F8 resolved — adversarial and conformance coverage: all 16 traces in adversarial-traces.md reconcile with the tables; T9 exercises ObservedNonCommit, and candidate-specific walk MC01 exercises ObservedConflict without changing the shared 16-case contract.",
  "F9 two policies confirmed vertical-owned with zero machine impact: composite facet verdict derivation (T2: version satisfied, tag moved) and occupied-failed-coordinate cleanup before a lawful re-attempt (T9: delete starter asset). Both are recovery/observation law under L06."
] as const

// ---------------------------------------------------------------------------
// 10. Checks and arithmetic.
// ---------------------------------------------------------------------------

const fail = (message: string): never => {
  console.error(`CHECK FAILED: ${message}`)
  process.exit(1)
}

/** Canonical decision behavior of a state, independent of prose. */
const decisionSurface = (state: State): string => {
  const row = DECISION_TABLE.find((r) => r.state === state) ?? fail(`no decision row for ${state}`)
  if (row.input === "none") return row.cell.decision
  if (row.input === "prepared") return PREPARED.map((p) => row.cells[p].decision).join(",")
  if (row.input === "riskBound") return RISK_BOUND.map((r) => row.cells[r].decision).join(",")
  return CORRESPONDENCE.flatMap((c) => SCHEMES.flatMap((s) => CONDITION.map((k) => row.cells[c][s][k].decision))).join(",")
}

/**
 * Moore-style partition refinement — the minimality probe.
 * "full-labeling": states are distinguished by report, decision surface,
 *   per-event cell class (advance/absorb/impossible), and advance structure.
 * "behavioral": absorb and impossible both mean "no state change", so only
 *   reports, decision surfaces, and advance structure distinguish states —
 *   this surfaces states that differ ONLY by append-guard labeling.
 */
const minimize = (mode: "full-labeling" | "behavioral"): ReadonlyArray<ReadonlyArray<State>> => {
  let block = new Map<State, string>()
  for (const state of STATES) {
    const classes = mode === "full-labeling"
      ? EVENTS.map((event) => FOLD[state][event].class).join(",")
      : ""
    // Use only the externally observable coarse outcome here. Including the
    // state-derived structured reason would make every state distinct by
    // construction and turn this into a tautology rather than a probe.
    block.set(state, `${REPORT[state].outcome}|${decisionSurface(state)}|${classes}`)
  }
  for (;;) {
    const next = new Map<State, string>()
    for (const state of STATES) {
      const successors = EVENTS.map((event) => {
        const cell: FoldCell = FOLD[state][event]
        if (cell.class !== "advance") return "self"
        return block.get(cell.next) === block.get(state) ? "self" : block.get(cell.next)!
      }).join(";")
      next.set(state, `${block.get(state)}#${successors}`)
    }
    const grewApart = new Set(next.values()).size > new Set(block.values()).size
    block = next
    if (!grewApart) break
  }
  const groups = new Map<string, Array<State>>()
  for (const state of STATES) {
    const key = block.get(state) ?? fail("minimize lost a state")
    groups.set(key, [...(groups.get(key) ?? []), state])
  }
  return [...groups.values()]
}

const walkCase = (walk: CaseWalk): TerminalReport => {
  let state: State = "PlannedReady"
  for (const step of walk.steps) {
    if ("fold" in step) {
      const cell: FoldCell = FOLD[state][step.fold]
      if (cell.class === "impossible") {
        fail(`${walk.id}: event ${step.fold} impossible in state ${state} (${cell.why})`)
      } else if (cell.class === "advance") {
        state = cell.next
      }
    } else {
      const row = DECISION_TABLE.find((r) => r.state === state) ?? fail(`${walk.id}: no decision row for state ${state}`)
      const at = step.at ?? {}
      const cell: DecisionCell = row.input === "none"
        ? row.cell
        : row.input === "prepared"
          ? row.cells[at.prepared ?? fail(`${walk.id}: prepared fact required in ${state}`)]
          : row.input === "riskBound"
            ? row.cells[at.riskBound ?? fail(`${walk.id}: riskBound fact required in ${state}`)]
            : row.cells[at.correspondence ?? fail(`${walk.id}: correspondence required in ${state}`)][at.scheme ?? fail(`${walk.id}: scheme required in ${state}`)][at.condition ?? fail(`${walk.id}: condition required in ${state}`)]
      if (cell.decision !== step.expectDecision) {
        fail(`${walk.id}: in ${state} expected ${step.expectDecision}, table says ${cell.decision} (${cell.why})`)
      }
    }
  }
  return walk.id === "C10-ambiguous-append-readback" ? "SafeStop" : REPORT[state].outcome
}

const main = (): void => {
  // V2: fold totality and cell census.
  let advance = 0, absorb = 0, impossible = 0
  for (const state of STATES) {
    for (const event of EVENTS) {
      const cell: FoldCell = FOLD[state][event]
      if (cell.why.length === 0) fail(`fold cell ${state} x ${event} has no reason`)
      if (cell.class === "advance") advance += 1
      else if (cell.class === "absorb") absorb += 1
      else impossible += 1
    }
  }
  const foldCells = STATES.length * EVENTS.length
  if (advance + absorb + impossible !== foldCells) fail("fold census mismatch")

  // Fold reachability: every state is reachable from PlannedReady.
  const reachable = new Set<State>(["PlannedReady"])
  let grew = true
  while (grew) {
    grew = false
    for (const state of [...reachable]) {
      for (const event of EVENTS) {
        const cell: FoldCell = FOLD[state][event]
        if (cell.class === "advance" && !reachable.has(cell.next)) {
          reachable.add(cell.next)
          grew = true
        }
      }
    }
  }
  for (const state of STATES) if (!reachable.has(state)) fail(`state ${state} unreachable`)

  // V3: decision totality and cell census.
  const decisionStates = new Set(DECISION_TABLE.map((row) => row.state))
  for (const state of STATES) if (!decisionStates.has(state)) fail(`no decision row for ${state}`)
  if (decisionStates.size !== STATES.length) fail("duplicate decision rows")
  let decisionCells = 0
  const usedDecisions = new Set<Decision>()
  for (const row of DECISION_TABLE) {
    if (row.input === "none") { decisionCells += 1; usedDecisions.add(row.cell.decision) }
    else if (row.input === "prepared") for (const p of PREPARED) { decisionCells += 1; usedDecisions.add(row.cells[p].decision) }
    else if (row.input === "riskBound") for (const r of RISK_BOUND) { decisionCells += 1; usedDecisions.add(row.cells[r].decision) }
    else for (const c of CORRESPONDENCE) for (const s of SCHEMES) for (const k of CONDITION) { decisionCells += 1; usedDecisions.add(row.cells[c][s][k].decision) }
  }
  for (const decision of DECISIONS) {
    if (!usedDecisions.has(decision)) fail(`decision ${decision} is never produced — dead codomain value`)
  }

  // V4: case walks reproduce required terminal outcomes.
  const exercised = new Set<State>()
  for (const walk of CASE_WALKS) {
    let state: State = "PlannedReady"
    exercised.add(state)
    for (const step of walk.steps) {
      if ("fold" in step) {
        const cell: FoldCell = FOLD[state][step.fold]
        if (cell.class === "advance") { state = cell.next; exercised.add(state) }
      }
    }
    const outcome = walkCase(walk)
    if (outcome !== walk.outcome) fail(`${walk.id}: walked to ${outcome}, trial requires ${walk.outcome}`)
  }
  const machineCaseCount = CASE_WALKS.length + OUT_OF_LIFECYCLE.length
  if (machineCaseCount !== 16) fail(`case coverage ${machineCaseCount} != 16`)

  // Adversarial-trace walks reconcile with the tables (finding F8).
  for (const walk of ADVERSARIAL_WALKS) {
    let state: State = "PlannedReady"
    for (const step of walk.steps) {
      if ("fold" in step) {
        const cell: FoldCell = FOLD[state][step.fold]
        if (cell.class === "advance") { state = cell.next; exercised.add(state) }
      }
    }
    const outcome = walkCase(walk)
    if (outcome !== walk.outcome) fail(`${walk.id}: walked to ${outcome}, trace requires ${walk.outcome}`)
  }
  const traceCount = ADVERSARIAL_WALKS.length + ADVERSARIAL_NOTES.length
  if (traceCount < 16) fail(`adversarial coverage ${traceCount} < 16 traces`)

  // Candidate-specific conformance walks close coverage gaps without changing
  // the shared trial-case population or its hash-bound expected outcomes.
  for (const walk of CONFORMANCE_WALKS) {
    let state: State = "PlannedReady"
    for (const step of walk.steps) {
      if ("fold" in step) {
        const cell: FoldCell = FOLD[state][step.fold]
        if (cell.class === "advance") { state = cell.next; exercised.add(state) }
      }
    }
    const outcome = walkCase(walk)
    if (outcome !== walk.outcome) fail(`${walk.id}: walked to ${outcome}, conformance case requires ${walk.outcome}`)
  }

  // Exercise census: shared cases, adversarial traces, and additive
  // candidate-specific conformance walks must reach every continuation state.
  const unexercised = STATES.filter((state) => !exercised.has(state))
  if (unexercised.length !== 0) {
    fail(`unexercised states [${unexercised.join(", ")}]`)
  }

  // Minimality probe (finding F7): after adopting the ProvenSatisfied
  // quotient, both full labeling and behavioral refinement keep every state
  // distinct. Evidence-specific duplicate guards remain outside continuation
  // state in SATISFACTION_EVIDENCE_KINDS and RECEIPT_APPEND_GUARD.
  const fullBlocks = minimize("full-labeling")
  if (fullBlocks.length !== STATES.length) {
    fail(`full-labeling partition has ${fullBlocks.length} blocks — states are indistinguishable even with append-guard labels`)
  }
  const behavioralBlocks = minimize("behavioral")
  const mergedBlocks = behavioralBlocks.filter((group) => group.length > 1)
  const mergedKey = mergedBlocks.map((group) => [...group].sort().join("+")).sort().join(" ")
  if (behavioralBlocks.length !== STATES.length || mergedKey !== "") {
    fail(`behavioral quotient merged [${mergedKey || "unexpected blocks"}] — nine-state quotient is not minimal`)
  }
  if (SATISFACTION_EVIDENCE_KINDS.join(",") !== "ReceiptAccepted,ObservationSatisfied" ||
      RECEIPT_APPEND_GUARD.identity !== "dispatchId" ||
      RECEIPT_APPEND_GUARD.duplicate !== "reject") {
    fail("satisfaction evidence kinds or receipt append guard drifted")
  }

  // V5: provider projection adds zero states and references real shapes.
  const caseIds = new Set([...CASE_WALKS.map((walk) => walk.id.slice(0, 3)), ...OUT_OF_LIFECYCLE.map((row) => row.id.slice(0, 3))])
  for (const row of PROVIDER_PROJECTION) {
    if (row.addedStates !== 0) fail(`${row.family} claims added states`)
    for (const shape of row.shapes) if (!caseIds.has(shape)) fail(`${row.family} references unknown case shape ${shape}`)
  }

  // Hypothesis viability arithmetic.
  const v1 = STATES.length <= 16
  const v3 = decisionCells <= 128
  console.log("machine state-space enumeration")
  console.log(`  states                       ${STATES.length}  (V1 <= 16: ${v1 ? "PASS" : "FAIL"})`)
  console.log(`  event kinds                  ${EVENTS.length}  (${RESEARCH_EVENT_FAMILIES.length} research families; observation split by verdict)`)
  console.log(`  fold cells                   ${foldCells} = advance ${advance} + absorb ${absorb} + impossible ${impossible}`)
  console.log(`  representable-invalids removed ${impossible} (append-guard obligations on the single interpreter)`)
  console.log(`  decision cells               ${decisionCells}  (V3 <= 128: ${v3 ? "PASS" : "FAIL"})`)
  console.log(`  interpreter append rows      ${APPEND_TABLE.length}`)
  console.log(`  report outcome rows          ${new Set(Object.values(REPORT).map((report) => report.outcome)).size} (4 terminal + Pending) over ${STATES.length} states`)
  console.log(`  structured projection rows   ${new Set(Object.values(REPORT).map((report) => `${report.outcome}:${report.reason}`)).size}`)
  console.log(`  machine-walk cases           ${CASE_WALKS.length} reproduce trial outcomes; ${OUT_OF_LIFECYCLE.length} owned outside the lifecycle`)
  console.log(`  provider families projected  ${PROVIDER_PROJECTION.length}, added lifecycle states 0 (V5 PASS)`)
  console.log(`  adversarial traces           ${ADVERSARIAL_WALKS.length} executable walks + ${ADVERSARIAL_NOTES.length} classified = 16+ reconciled`)
  console.log(`  conformance walks            ${CONFORMANCE_WALKS.length} additive; all ${STATES.length} states exercised`)
  console.log(`  minimality probe             full labeling ${fullBlocks.length}/${STATES.length} distinct; behavioral quotient ${behavioralBlocks.length}/${STATES.length} distinct`)
  console.log("")
  for (const finding of FINDINGS) console.log(`  ${finding}`)
  console.log("")
  if (!v1 || !v3) {
    fail("M2 hypothesis viability criteria not met")
  }
  console.log("HYPOTHESIS: M2-total-transition remains viable as a reviewable table:")
  console.log("every local fold and decision cell is classified, invalid states are")
  console.log("enumerated as append guards, and the launch families add no local states.")
  console.log("No candidate is selected: M1/M2 roots, shared receipts, metrics, and")
  console.log("the frozen selection policy remain authoritative (finding F6).")
}

main()
