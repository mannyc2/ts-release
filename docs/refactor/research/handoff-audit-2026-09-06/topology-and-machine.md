# Machine, topology and readability assessment

## The machine: owned Bundle → immutable Plan → one Journal → derived Report

Traced through the selected prototype (`tools/architecture-lab/machine/src`,
tree `25f02ed6…`, 1,089 lines for both candidates, 935 for M1 alone).

| Stage | Owner | What is enforced | Files |
| --- | --- | --- | --- |
| Construction | `identity.ts` | strict intent codec + canonical encode, operation ID = hash(definitionId, intentVersion, intent); Plan ID includes bundle ID, sorted DAG and journal ID; duplicate/cycle/dangling rejected before effects | `identity.ts:84-157` |
| Decoding on read | `run.ts read()` + `identity.ts verifyEvents/verifyNativeEvidence` | envelope, journal root, scope registration, event-ID uniqueness, fingerprint recomputation, native receipt/observation/error codec + correspondence + classification recomputed | `run.ts:38-86`, `identity.ts:187-270` |
| Decision | `m1-history.ts next()` | Finish / PrepareDispatch / AppendDispatch{Initial, NonCommit, ProtectedReplay, AcceptedRisk} / RequestRiskAcceptance from queried facts | `m1-history.ts:48-63` |
| Dispatch permission | `run.ts:169-188` | local law check → store CAS → `owned` only on `Appended` or same-call-stack exact read-back; single-use permit; one send | |
| Recovery | facts only | lost response → `DispatchError` Inconclusive; noncommit proof → new attempt; Git CAS → `ProtectedReplay`; risk → one more attempt bound to fingerprint + all prior IDs + expiry | `m1-history.ts:56-62,86-91` |
| Reporting | `report()` | derived from history; global revision from the store | `m1-history.ts:36-46` |

Laws probed and their status:

| Law | Status | Where |
| --- | --- | --- |
| Fresh successful CAS is the only permission | holds | `run.ts:178-188`; C07/C10 tests; store tests "Lost acknowledgment cannot turn an identical fresh invocation into Appended" |
| Competing writers | holds | two-process SQLite/Git/S3 races; one `Appended` |
| Crash/restart, lost acks | holds | `process.test.ts` (exit 70 after append/after send, fresh workspace), Git `=` up-to-date handling, S3 412/409/lost |
| Transport retry after remote commit | holds for the owned host; Bun `fetch` counterexample retained | `fetch-retry-results.json` |
| Late receipts after supersession | preserved; report shows Superseded for all ops (F14) | C09 |
| Dependency identity | holds | integration test: parent ID 41 kept, 99 rejected |
| Captured request/principal, exact risk | holds | fingerprint over facts; secret headers rejected; principal drift breaks risk |
| Invalid histories | rejected on read | `observable.test.ts:210-225`, `errors.test.ts:63-76` |
| Full-event size | enforced symmetric read/write at exactly 1 MiB and +1 | store tests; oversized receipt keeps uncertainty |
| Uncertainty → replay via read-back | impossible for a new process; only the live call stack (`run.ts:180-186`) | structural |

Weaknesses found are F05–F09 and F14 in `findings.md`. None breaks safety;
all cost extra states or branches that a stronger law would remove.

## M1 vs M2

| Aspect | M1 (history queries) | M2 (materialized state) |
| --- | --- | --- |
| Candidate-specific lines | 105 | 154 |
| Representation | events only; facts are queries | Active/Superseded + per-op attempts/observation/decisions; drops receipt bodies |
| Second representation? | no | yes, and the shared snapshot must still keep bodies for native validation |
| Behavior on the shared oracles | identical | identical |
| Maintenance under P04/P09 | 5 files, +12/−6; +47/−5 | same files, slightly larger deltas |
| Performance | none claimed; both reload whole history | same |

Recommendation: **M1**, with the F07 law (one Ready per preparation) added to
`append`, and the F08 interpreter change. M2's only conceivable advantage
(incremental state) is not exploited by the interpreter, which re-reads
everything anyway.

## Two paths through real files

**Ordinary path** (one npm publish, packed CLI, SQLite): `apps/*/application`
`createApplication` → `topology/src/host.ts:15` `runApplication` (import,
validate, `Effect.scoped`) → `run.ts:135` `runRelease` → `identity.ts:137`
`loadPlan` → `run.ts:38` `read` (scopes, snapshot, verify) → provider
`observe` → `run.ts:93` `appendFact` → `m1-history.ts:48` `next` →
provider `prepare` → `identity.ts:173` `verifyRequest` → `core-git.ts:26`
`assertTransportBinding` → `next` again with the candidate → `sqlite.ts:32`
`append` → `http.ts:8` `send` → `classifyReceipt` → `appendFact` → `read` →
report. Ownership hops: application → host → kernel → provider → kernel →
store → transport → provider → kernel = **8**. Hidden decisions an implementer
must know: observe-before-dispatch is default-on; `maxDispatches` defaults to
the operation count; dependency gating uses report status `Satisfied` only;
`appendFact` retries 8 times; `host.journal` may override the plan's journal
ID; `uniqueId` and `now` come from the host; `classifyReceipt` may say
`Pending`; provider context is a frozen JSON copy of own + declared
dependencies only. **9 hidden decisions.**

**Difficult path** (catalog push, response lost, restart, competitor): process
1 appends `DispatchStarted{Initial}` → `core-git.ts:60` runs
`push --porcelain --force-with-lease=ref:old` → exit 1 (ack lost) →
`Unknown` → `DispatchError` (`core-dispatch-error/1`, Inconclusive). Process 2:
`read` recomputes fingerprints and native codecs → `status` Inconclusive →
`next` finds one unresolved start whose facts equal the candidate's
(`model.ts:18` `sameProtectedRequest`, full RequestFacts equality including
`GitCas`) → `AppendDispatch{ProtectedReplay}` → push → `=` up-to-date line
→ `Accepted` GitReceipt → `ReceiptAccepted` Satisfied. With a competitor:
push rejected → `Unknown` → second `DispatchError` → next invocation
`RequestRiskAcceptance` → maintainer appends `RiskAccepted` bound to the
fingerprint, both prior dispatch IDs and expiry → one more attempt. Files:
`run.ts`, `m1-history.ts`, `model.ts`, `core-git.ts`, `identity.ts`,
`storage/git.ts` = **6 files**; hidden decisions: whole-facts equality for
replay, porcelain `=`/`*`/`+` parsing, "exactly one update line", competitor
→ Unknown (not Conflict), risk expiry uses `host.now()`. **5.**

Readability verdict: the central loop is readable (216 lines) and the laws are
where the packet says they are. The costs are hidden in the re-read pattern
(F08) and in the Apple module's private loops (F07), not in event families.

## Topology

Measured on the same ≈1,500-line slice (kernel 1,089, npm 142/90, python 98/85,
host 555, external 46):

| Boundary | T1 root | T2 kernel + aggregate | T3 kernel + per-provider | T3′ (corrected roster) |
| --- | --- | --- | --- | --- |
| Public packages (proposal) | 1 | 2 | 8 | 5 (kernel, npm, warehouse, github, catalog) + MCP/OpenAI as later packages or catalog-like subpaths |
| Public manifest lines (proposal) | 129 | 135 | 304 | ≈220 (projection to run) |
| Cohort tarball bytes (slice) | 19,851 | 20,366 | 21,784 | — |
| Core-only installed bytes (slice) | 96,441 | 81,345 | 81,345 | 81,345 |
| Selective JS bundle | equal | equal | equal | equal |
| Partial-publication states | 0 | 1 | 7 | 4 |
| Version skew | none | duplicate kernel possible | duplicate kernel possible | same, mitigated by peer (D4) |
| Marginal TS median (P01 = 0) | 40 | 40 | 43 | predicted 38–40 after helper relocation |
| Sibling-import law | lint | lint | structural | structural |
| Selective provider install | no | no | yes | yes |
| External/first-party symmetry | subpath vs package | package vs package | package vs package | package vs package |
| Effect peer (proposal) | exact (F01) | exact (F01) | exact (F01) | range |

Judgement: T1 is the strongest under the frozen rules and has the fewest
failure states; T3 as projected fails the frozen marginal rule by a lab
artifact and carries renderer packages that contradict the packet's own
invariant; T2 buys the core boundary without selective install and adds a
package. **The real choice is T1 vs T3′.** Package count is not the criterion;
the criteria that differ are selective installation, structural sibling
isolation, first/third-party symmetry (T3′) against publication atomicity and
metadata (T1). The maintainer's stated inclination toward `packages/` is
recorded evidence for T3′, not approval.

Claims the small slice does **not** support for the full graph: optional-peer
absence behavior (`@effect/platform-*`, `effect-build-apple` as optional peers
were never installed absent), Sigstore/semver dependency closures, Node/Bun
facade separation at full scale, the eight-package publication ordering, and
runtime loading of a provider built after core **and** CLI with the production
`CommandLine` (the slice proves it with `@lab/host`).

## Producer, provider and storage seams

- effect-build adoption: real published 0.6.3, path-free owned copies,
  manifest preimage recomputation, streaming 96 MB file; bounded tree (512 MiB /
  100k entries). Sound. Unbounded tree streaming correctly deferred.
- Apple: one journal, transient preparation scope, one final Bundle; native
  acceptance is doubles (correct label). F07 and F09 apply.
- Credentials/OIDC: **0 measured lines**; `host.Credentials`, `host.Http`
  (780 expected) and every provider `Auth` module are estimates. The 43-line
  HTTP prototype has no credential path at all (`principal` is a constant
  string in every fixture). This is the least-measured safety-relevant seam.
- Native Git objects: sound; F13 (delta object sets) is an optimization.
- Stores: SQLite (immediate transactions, WAL/FULL), Git ref (lease CAS,
  `=` handling, hook rejection → Ambiguous), S3 model (segment + head, 412
  reconciliation, delete-marker fail-closed). Deployment assumptions are stated
  (Object Lock ≠ head CAS; deny delete/rollback). Sound.
- Excluded donor responsibility that will return as cost: the 0.3.0 AWS
  host/auth/governance lines (1,755) are conditional; the overlay's
  `provider-http.ts` (550) OIDC claim validation is charged to `shared-http-auth`;
  `apple-notary.ts` (848) is replaced by upstream. Nothing is silently dropped.
