# Contracts: seams, ownership and laws

All line anchors are into the sealed lab (`tools/architecture-lab`, machine tree
`25f02ed6…`), which the handoff names as the tested prototype of the production
kernel. The production declarations are `handoff/kernel-api.d.ts`; the amended
version is [`handoff-amendment/kernel-api.d.ts`](handoff-amendment/kernel-api.d.ts)
and the delta is [`declarations/kernel-seams.d.ts`](declarations/kernel-seams.d.ts).

## 1. Who owns what today (traced, not asserted)

| Responsibility | Owner | Where | Law enforced |
| --- | --- | --- | --- |
| Plan validation | kernel identity | `identity.ts:96-157` (`validateDag`, `createPlan`, `loadPlan`) | unique sorted DAG, no cycles/dangling, operation id = hash(definition, intentVersion, canonical intent), plan id includes journal id; unknown definition or intent version fails closed |
| Provider contract verification | interpreter | `identity.ts:203-211` called first in `run.ts:39` | mandatory codecs/classifiers/correspondence; (amended) `contract` literal equals the kernel's |
| History admission | interpreter `read` | `run.ts:38-86` + `identity.ts:187-201,233-270` | one journal root, ≤1 publication scope, registered scopes only, unique event ids, revision = prefix length, fingerprints recomputed, native receipts/observations/errors re-decoded and re-classified; (amended) preparation selection |
| Decision evaluation | evaluator (`Machine`) | `m1-history.ts:48-63` (`next`), `:65-101` (`append` legality) | pure in (history, plan, candidate, now); illegal history rejected on fold |
| Append authorization (the permit) | interpreter | `run.ts:169-188` | local law → store CAS → `owned` only on fresh `Appended` or same-call-stack exact read-back; single-use |
| Fact append with retry | interpreter `appendFact` | `run.ts:93-109` | re-read, re-validate, machine legality, CAS; `AlreadyRecorded`/`Appended` end the loop; 8 attempts then `journal-contention` |
| Dispatch | transport | `run.ts:196` + host transport (`core-git.ts:39-71`, `topology/src/http.ts`) | one native send per permit; Git CAS replay only through the captured core mechanism (`core-git.ts:26-36`) |
| Reporting | evaluator `report()` + interpreter revision | `m1-history.ts:36-46`, `run.ts:84` | derived from history; carries the global revision |
| Store CAS | store | `storage/sqlite.ts:32-47`, `storage/git.ts:47-72` | `Appended` iff expectedRevision matched; identical bytes → `AlreadyRecorded`; loss → `AmbiguousStorageOutcome` |
| Construction boundary | application | `topology/src/host.ts:15-27` (`runApplication`) | one Scope owns acquisition and execution; CLI/Action/library use the same interpreter |

Every safety-relevant decision already sits in the interpreter or the store;
providers and evaluators supply *facts and decisions*, never permits. That is why
the seams below can be opened without new defensive checks.

## 2. Seams: what existed, what was opened, what was added

| Seam | Status | Contract | Witness |
| --- | --- | --- | --- |
| `JournalStore` | existed | `read`/`append` + the store laws (§4) | store-laws kit passes for Memory, SQLite, and a cache decorator over both; a last-writer-wins store fails three laws |
| Store decorators (cache/index) | existed implicitly; now stated | wrap `HostShape.store`; append is never served from cache; own `Appended` extends the cache; mismatch/ambiguous/error invalidate | `examples/caching-store.ts` (39 lines); `cache.test.ts` |
| `Transport` | existed | one native send per permit; `makeCoreGitTransport(bindings, otherwise)` composes | C05/C08, git tests |
| `ProviderDefinition` | existed; **added** `contract` | codecs, correspondence, classification, `prepare`, optional `observe` | `contract.test.ts`: foreign contract rejected with zero reads; a second physical kernel copy of the same contract interoperates |
| Evaluator (`Machine`) | **opened** (`Host.machine`, types exported, M2 removed from the kernel) | §3 signatures; conformance = the observable suite over evaluators | 156-test suite over M1, external M2, memoizing M3 |
| `Host` / `createApplication` | existed | the single construction boundary | `examples/application-example.ts` (compile-checked) |
| Preparation/publication scopes | existed; **added** selection law | ≤1 publication scope; any number of one-operation preparation scopes; one Satisfied output per preparation | `preparation-selection.test.ts`; Apple lanes |

No registry, allowlist, plugin discovery or configuration language was added.
An application that wants a new store, cache, evaluator, transport or provider
imports it and puts it in the `Host`.

## 3. Exact signatures (delta over `kernel-api.d.ts`)

```ts
export interface CandidateRequest { readonly facts: RequestFacts; readonly fingerprint: string }
export type Next =
  | { readonly _tag: "PrepareDispatch" }
  | { readonly _tag: "AppendDispatch"; readonly basis: DispatchBasis }
  | { readonly _tag: "RequestRiskAcceptance" }
  | { readonly _tag: "Finish"; readonly status: OperationStatus }
export interface Machine {
  readonly append: (event: JournalEvent) => Machine           // throws ReleaseError on an illegal event; no effects
  readonly report: () => ReleaseReport
  readonly next: (operationId: string, candidate: CandidateRequest | null, now: number) => Next
}
export type MachineConstructor = (plan: Plan, events: ReadonlyArray<JournalEvent>) => Machine
export declare const historyMachine: MachineConstructor
export declare const sameProtectedRequest: (recorded: RequestFacts, candidate: RequestFacts) => boolean
export declare const sameStrings: (left: ReadonlyArray<string>, right: ReadonlyArray<string>) => boolean

export declare const PROVIDER_CONTRACT: "ts-release/provider/1"
export interface ProviderDefinition { readonly contract: typeof PROVIDER_CONTRACT; /* …unchanged… */ }

export interface HostShape {
  readonly store: JournalStore; readonly transport: Transport; readonly providers: ReadonlyArray<ProviderDefinition>
  readonly now: () => number; readonly uniqueId: () => string; readonly journal?: JournalContext
  readonly machine?: MachineConstructor                        // default historyMachine
}

export declare class CoreUndecodableReceipt /* { code, message ≤256, receiptSha256, receiptBytes } */ {}
// evidenceVersion "core-undecodable-receipt/1" is reserved beside "core-dispatch-error/1"
```

Unchanged: `RunOptions { plan, authorize, maxDispatches?, observe? }` (the
prototype's `candidate` and fault `checkpoint` do not ship), the six event
families, `JournalStore`, `Transport`, `CreateApplication`, and the five public
Effects (`runRelease`, `observeRelease`, `reportRelease`, `supersedePlan`,
`acceptRisk`).

## 4. Safety laws and who enforces them

| # | Law | Enforcer | How an implementation is held to it |
| --- | --- | --- | --- |
| L1 Permit | Only a fresh `Appended` from the authoritative store's conditional append of this invocation's `DispatchStarted` authorizes one send; `AlreadyRecorded`, CAS loss and read-back by a new process never do | interpreter `run.ts:169-188` | C07/C10, process tests, cache tests (stale/lying caches: zero sends) |
| L2 One history | All events of a coordinated release live in one journal; revision = complete prefix length across scopes | store + interpreter admission | store laws; boundaries tests (`revisions` 0..5, global revision 6) |
| L3 Derived state | Reports, indexes and caches are projections; authoritative only at a revision equal to a fresh read; they cannot change the journal | application; interpreter's final read | `cache.test.ts` stale report is visibly behind the truth; Apple `validatedSnapshot` |
| L4 Fail closed | Unknown provider, contract, codec version, scope, journal root or non-canonical bytes reject before any effect | interpreter | C11, contract test (0 reads), errors tests |
| L5 Preparation selection | A `PreparationScope` operation admits one Satisfied output; a second Satisfied observation with different canonical evidence is `preparation-selected` at append and on read; publications may be re-observed | interpreter (`appendFact`, `read`) | `preparation-selection.test.ts`; Apple 16/16 |
| L6 Evaluator | Pure `next`; illegal histories rejected on fold; `append` mirrors the laws the interpreter recomputes | conformance suite (machine tests over evaluators) | M1, external M2, M3 |
| L7 Store | `Appended` iff expected revision matched; same bytes → `AlreadyRecorded`; different facts under one id → error; read returns the complete prefix | `examples/store-laws.ts` | Memory, SQLite, cache decorators pass; LWW store fails |
| L8 Transport | One native send per permit; no retry after bytes left the process; interruption is not non-commit | transport implementer + independent send counters | fetch double-PUT counterexample; `node:http` `agent:false` |
| L9 Provider | Native codecs, correspondence and classification are recomputed on read; providers cannot forge `GitCas` or set secret headers | interpreter `verifyNativeEvidence`, `verifyRequest`, `assertTransportBinding` | boundaries tests |
| L10 Secrets | Credentials never enter facts, plan, journal or report; bounded diagnostics pass the host redaction boundary | interpreter + host | boundaries "authentication header material" test; undecodable-receipt test |

**Report precedence (F14, now documented):** the latest observation with status
Satisfied/Conflict/Pending overrides receipts; a Satisfied receipt otherwise
Satisfies; any receipt otherwise means Pending; no start means Unattempted; all
starts with proven non-commit means Rejected; otherwise Inconclusive; a
`PlanSuperseded` event makes every operation Superseded in the report while
per-operation facts stay in the history (`m1-history.ts:24-34`).

## 5. Observable equivalence for evaluators and schedulers

Two evaluators are interchangeable when, for every history the kernel admits,
they (a) accept and reject the same event sequences, (b) return the same `Next`
for the same `(operationId, candidate, now)`, and (c) produce equal reports.
The conformance suite is the existing observable/error/boundary/process tests
parameterised over `MachineConstructor`; the "impossible histories" test compares
each evaluator's report to M1's. Different schedulers or hosts need **not**
produce byte-identical journals: event ids, timestamps and observation order are
host facts. What must be equal is the send count per permit, the set of durable
facts about each dispatch, and the final report at the same revision.

## 6. Module and export map (T3c)

| Package (dir) | Exports | Owns | Depends on |
| --- | --- | --- | --- |
| `@mannyc1/ts-release` (`packages/ts-release`) | `.` kernel entry (Error, Model, Provider, Plan, Journal, Host, Decision, GitAuthority, Release); `./bundle`; `./effect-build`; `./apple`; `./http`; `./git`; `./node`; `./bun`; bin `ts-release` | machine, identity, interpreter, owned artifacts, `kernel.Http` (receipt envelope, correspondence, `HttpProviderDefinition`, credential binding types), Git owner, hosts, CLI loader | peers: `effect` range; optional `@effect/platform-node`, `@effect/platform-bun`, `effect-build-apple` (exact 0.6.3); dependency `effect-build` 0.6.3 |
| `@mannyc1/ts-release-npm` (`packages/npm`) | `.` | Model/Protocol/Auth incl. Sigstore wrapper | peer kernel `>=0.4.0 <0.5.0`, peer `effect` range; deps `semver`, `sigstore` |
| `@mannyc1/ts-release-pypi` (`packages/pypi`) | `.` | Warehouse Model/Protocol/Auth | peer kernel, peer effect |
| `@mannyc1/ts-release-github` (`packages/github`) | `.` | six operations, receipts, observations | peer kernel, peer effect |
| `@mannyc1/ts-release-catalog` (`packages/catalog`) | `./homebrew`, `./scoop` (no root barrel) | Homebrew and Scoop renderers | peer kernel, peer effect |
| `@mannyc1/ts-release-openai` (`packages/openai`) | `.` | plugin construction, validation, marketplace and submission preparation | peer kernel, peer effect; dep `semver` |
| `@mannyc1/ts-release-mcp` (`packages/mcp`) | `.` | manifest, publish, observation, OIDC/token auth | peer kernel, peer effect |
| `apps/action` (private) | — | node24 launcher, `action.yml` | kernel `./node` |
| `apps/self-release` (private) | — | ts-release's own `createApplication` | all seven packages |

Import laws (unchanged from the handoff, now structurally enforced by packages):
providers import the kernel and neutral host ports, never siblings; neutral
entries never import Node/Bun/Apple implementations; `catalog` renderers hand
files to the kernel's Git owner through application composition.

## 7. Obligations for implementers

- **Evaluator:** implement `MachineConstructor`; pass the conformance suite;
  use `sameProtectedRequest`/`sameStrings` for the protected-replay and
  risk-scope laws; never perform effects or read the store.
- **Store:** pass the store-laws kit; enforce the 1 MiB canonical event profile
  on write and read; return `AmbiguousStorageOutcome` on any lost acknowledgment.
- **Cache / index:** decorate a store; pass the kit; never answer an append from
  memory; invalidate on anything but your own `Appended`; label reports derived.
- **Provider:** carry `contract`; own codecs/correspondence/classification;
  project native responses to bounded facts; pin your version for the life of a
  release you are part of.
- **Transport:** one native request per permit; no retry after send; ephemeral
  credentials resolved inside the host closure.
- **Application:** compose all of the above in `createApplication`; declare an
  explicit shared store for multi-runner releases; treat any report whose
  revision differs from a fresh read as stale.
