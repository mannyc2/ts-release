# Findings

Tags: **current defect** (in the staged packet), **proposal gap** (design or
plan incomplete), **historical defect, corrected** (found and fixed by the
research), **later acceptance** (legitimately deferred to Plan 009/010).
Evidence status: **confirmed** (reproduced or read in code/records here),
**inference**, **unverified**.

## Ranked table

| # | Sev | Conf | Tag | Finding (trigger → impact) | Anchor | Evidence | Effort | Fix risk | Depends on |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | High | High | current defect | Every proposed public manifest pins `effect` as an **exact** peer (`4.0.0-rc.108`). A consumer resolving effect@4.0.0-rc.109 satisfies effect-build 0.6.3 (`>=4.0.0-beta.104 <4.1.0-0`) but not ts-release → npm ERESOLVE, the exact failure the repository already fixed. | `layout.json` alternatives[*].packages[*].manifest.peerDependencies; `scripts/lib/versions.ts:49-50`; root `package.json` peers `>=4.0.0-rc.108 <4.1.0-0` | confirmed | S | low | none; before W01 skeleton |
| F02 | High | High | proposal gap | The marginal amendment bundles two independent choices and its number (45) is exactly the value that admits the recommended T3 (44). Under the frozen 40-line rule with the configuration-only zero admitted, the TypeScript lane passes for T1/T2 (median 40) and fails for T3 (43) because T3 duplicates a 13-line receipt helper that the full design already assigns to `kernel.Http`. | `metric-results.json` quantiles; Plan 005 lines 80-84, 509-538; `trial-spec.json` marginalBudget.sampleUnit | confirmed | S (experiment) | low | decision D2/D3 |
| F03 | High | High | current defect | Executor entrypoints do not exist: `check:architecture-program`, `check:launch-evidence`, `check:launch-closure`, `check:packed-action`, `check:effect-build-integration` are absent from `package.json`; `docs/refactor/evidence/` does not exist; Plans 006–010 still preflight on `SYSTEM/SURFACE/MIGRATION/WAVES/GATES.json` and `check:architecture-program`; `advisor-plans/README.md` still says Plan 005 IN PROGRESS with a freeze generator; CI pins the PR21 `bun.lock` hash. An executor following the tracked plans stops at preflight. | `waves.json` commonCommands; `advisor-plans/006:22-30`, `009:15-20`, `010:9-14`; `.github/workflows/ci.yml:46,60` | confirmed | S–M | low | none; before W01 |
| F04 | Med | High | proposal gap | Provider packages depend on the kernel through an exact `dependencies` pin, not a peer. Any cohort skew silently installs two kernel copies (the publication experiment shows it); module-private state such as the core-Git `mechanisms` WeakMap then lives in one copy while providers import the other. | `layout.json` T2/T3 provider manifests; `topology.md` "physically contain two kernel versions"; `machine/src/core-git.ts:25` | confirmed | S | low | D4 |
| F05 | Med | High | proposal gap | `ProviderDefinition` carries one `receiptVersion` / `observationVersion` / `dispatchError.version`; the reader fails closed on any other version. A provider upgrade between runner 1 and runner 2 makes an in-flight journal unreadable ("version is unavailable"). No pin-across-release law is stated. | `machine/src/identity.ts:216,221,243,254`; `kernel-api.d.ts` ProviderDefinition; `durable-vocabulary.json` (all versions "1") | confirmed | S–M | low | before W01 API freeze |
| F06 | Med | High | proposal gap | A committed send whose receipt fails the strict codec (excess property or non-canonical number) raises out of `runRelease` before anything is appended; the native receipt bytes are discarded and the attempt stays uncertain. Safe (no resend) but evidence-losing, and likely in production because `onExcessProperty: "error"` + exact canonical round-trip reject any new registry field. | `machine/src/run.ts:201`; `identity.ts:225-230` | confirmed | S | low | D7 |
| F07 | Med | High | proposal gap | Apple `ReadyToPlan` selection re-implements the interpreter's read/validate/append/CAS loop outside the interpreter (second append call site), because "at most one Ready per preparation" is not a machine law. Duplicated retry loops in two files, hard-coded candidate names (M1 in one, M2 in the other). | `apple/apple-preparation.ts:142-150,172-191`; `apple-composition/composition.ts:47-68`; `apple-api.d.ts:175 runPreparation` | confirmed | M | med | W01 kernel law |
| F08 | Med | Med | proposal gap | The interpreter re-reads and revalidates the whole history at every step (≥4 `read()` per operation); the Git journal implements `read` as ls-remote + fetch + rev-list + 2 subprocess calls per event. The forecast's "bounded history loading" (80 lines) does not address the per-step revalidation, which is the actual scaling term. | `machine/src/run.ts:95,145,156,165,181`; `storage/git.ts:29-42` | confirmed (shape), inference (cost) | M | med | W01 |
| F09 | Med | High | proposal gap | The producer commit SHA is a durable **schema literal** (`producerRevision: Schema.Literal<"ef29a087…">`), generated by string replacement. Every effect-build bump becomes a durable-format change and alters every preparation identity. | `apple-api.d.ts:45,58,71`; `proposal/emit.mjs:48` | confirmed | S | low | W08 |
| F10 | Med | High | proposal gap | Budget: 84% of the 11,447 expected lines is unmeasured estimate (providers alone 6,510 = 57%); the measured 1,836 lines are prototype-dense (printer normalization +12% to +29%); at ordinary density the expected total is ≈11,700, above the 11,485 ceiling. The handoff says "38 lines of headroom"; the honest statement is "no headroom at ordinary formatting". | `forecast.json` rows; `machine/source-metrics.json`; `apple/source-inventory.json` | confirmed (arithmetic) | S (accounting) | low | D-none; W01+ tripwires |
| F11 | Med | High | proposal gap | Receipt correspondence in the packed HTTP fixtures is self-referential: the fixture transport copies endpoint/method/bodyDigest from the request into the receipt, so `receiptCorresponds` compares a value with itself. Native correspondence is exercised only by observations (npm `dist.integrity`, python `sha256`), the integration test (release ID 41 vs 99) and Apple submission facts. C08 is correctly marked partial; W02–W05 acceptance must not reuse this fixture shape as a correspondence witness. | `topology/src/http.ts:26-27`; `machine/test/fixtures.ts:95`; `qualification.md` C08 | confirmed | — | — | W02–W05 |
| F12 | Low | High | proposal gap | T3's roster carries two renderer-only public packages (Homebrew ≈200 lines, Scoop ≈120 lines) although tracked architecture prose and the packet's own invariant say renderers feed one Git owner. Each adds a manifest, tsconfig, coordinate and partial-publication state. | `ARCHITECTURE.md:126-127`; `design.json` invariants/providers; `layout.json` T3 metadata (304 public manifest lines) | confirmed | S (projection) | low | D1 |
| F13 | Low | Med | proposal gap | Git catalog object sets export the entire reachable graph (`rev-list --objects desired`), so owned content grows with tap history; the CAS lease already guarantees the remote holds `expectedOld`, so a delta set plus a read-only shallow fetch at push time would bound the object set by the change. | `git-catalog/objects.ts:53-67`; README "host must bound object count" | confirmed (shape), inference (fix) | M | med | W04/W06 |
| F14 | Low | High | proposal gap | Report semantics: a later `Pending`/`Conflict` observation overrides a `Satisfied` receipt, and `PlanSuperseded` masks per-operation facts in the report (P09 exists because of this). Neither is wrong, but both are undocumented decisions an implementer will re-derive. | `machine/src/m1-history.ts:24-34` | confirmed | S (doc/test) | low | W01 |
| F15 | Low | High | later acceptance | 1 MiB full-event bound: fixture maxima (968 B) say nothing about real npm packuments or GitHub release JSON; providers must project native responses to bounded facts. Correctly labeled in the packet. | `hosts.md` journal profile; `event-sizes.json` | confirmed | — | — | W02–W05, OB05 |
| F16 | Low | High | historical defect, corrected | Bun 1.3.14 `fetch` resent a committed PUT after response loss (2 native PUTs); the mutation host now uses `node:http` with `agent:false` and no retry. | `topology/fetch-retry-results.json`; `topology/src/http.ts` | confirmed | — | — | — |
| F17 | Low | High | historical defect, corrected | Forged tree-entry mode accepted by the upstream shape guard; adoption now recomputes the ordered manifest preimage before trusting entries. | `apple/adoption.ts:110-115`; `apple-adoption.md` | confirmed | — | — | — |
| F18 | Low | High | historical defect, corrected | npm → owned-npm → npm barrel cycle; owned-npm now has its own public subpath and all three layouts' emitted/declaration graphs are acyclic. | `topology.md`; `graph-results.json` | confirmed | — | — | — |
| F19 | Low | High | later acceptance | Apple, AWS/S3, hosted Action store, Windows signing, live registries: local protocol doubles only. The packet labels every one of these correctly; nothing is relabeled as passed. | `qualification.json` OD/OB rows | confirmed | — | — | Plan 009/010 |
| F20 | Info | High | — | Hard cut provenance verified (explicit answer at thread line 259). 0.3.0 is published with `./operation-journal` exports; the inventory dispositions every export with no alias. | `provenance.md`; `public-history.md` | confirmed | — | — | — |

## Design weaknesses, traced

Format: symptom → weak invariant or duplicate representation → extra states or
branches → proposed canonical owner → deletable code or workflow → verification.

### F05 Single-version codec channels

- Symptom: `decodeObservationEvidence` / `verifyNativeEvidence` reject any
  event whose version string differs from the installed provider's one
  version; a release paused across a provider upgrade becomes unreadable.
- Weak invariant: "the journal is readable by the exact provider that wrote
  it" is assumed, never stated; the vocabulary starts everything at `"1"` and
  gives no rule for `"2"`.
- Extra states: an operational pin-across-release rule, or an ad-hoc importer
  per bump (P09 is the prototype of exactly that, 42 lines per format).
- Canonical owner: `ProviderDefinition` carries codec **maps** keyed by
  version (`receiptCodecs: ReadonlyMap<string, Codec>` etc.); the writer uses
  the current version; the reader resolves by the event's version. Unknown
  versions still fail closed.
- Deletable: the future per-bump importer pattern; `decodeObservationEvidence`
  equality branches collapse into one map lookup.
- Verification: a lab test that records with version 1, upgrades the provider
  to version 2 (map contains both), and resumes with zero sends; a negative
  test with version 3 absent fails closed.

### F06 Undecodable committed receipt

- Symptom: `runRelease` throws from `classifyReceipt(nativeEvidence(...))`
  after the send; no event is appended; the receipt bytes are gone.
- Weak invariant: "every native result of an authorized send is journaled" is
  true for `Unknown` with a native error and for `RejectedBeforeCommit`, but
  not for an `Accepted` result that fails strict decoding.
- Extra branches: the restart relies on `observe()` to recover; providers
  without observation (write-only) can never leave Inconclusive except by risk
  acceptance, even though the remote answered.
- Canonical owner: the interpreter's post-send branch records an
  `ObservationRecorded/DispatchError` with a core codec that carries the raw
  receipt text (bounded by the event profile) and status `Inconclusive`. This
  is evidence retention, not a compatibility reader; the core error codec
  already exists (`core-dispatch-error/1`).
- Deletable: nothing; adds ~10 lines in `run.ts`.
- Verification: fixture transport returns a receipt with one extra field;
  assert one `DispatchError` event whose evidence contains the raw text, zero
  resends on restart, and that a later matching observation satisfies.

### F07 Apple Ready selection outside the interpreter

- Symptom: `runPreparation` and `validateApplePublication` each run an
  8-retry read/validate/append loop; `validatedSnapshot` re-implements
  "report revision equals snapshot revision"; one file uses candidate M1, the
  other M2.
- Weak invariant: "exactly one Satisfied `ReadyToPlan` per preparation
  operation" is enforced by a private CAS loop, not by the machine's append
  law, so the interpreter's `appendFact` cannot be used (it would happily
  append two Ready events with different bytes).
- Extra states: a second append call site; a second "validated prefix" notion;
  two candidate spellings.
- Canonical owner: M1 `append`: once an operation has a `Satisfied`
  observation whose evidence is a `ReadyToPlan`, a second `Satisfied`
  observation with different evidence is `illegal-observation`; then Ready is
  routed exactly like Pending/Conflict already are (`apple-preparation.ts:192-193`,
  through `observeRelease` with an injected `observe`). The CAS loser's
  append fails the law before the store; the winner's Ready is the selected
  bytes.
- Deletable: `apple-preparation.ts:141-150` (`validatedSnapshot`) and
  `:172-191`; `composition.ts:47-51,67-69` retry scaffolding; the candidate
  literals.
- Verification: the existing lifecycle checks
  `two-process-distinct-final-bytes-select-one-ready-by-global-cas` and
  `concurrent-unvalidated-prefix-cannot-select-ready-or-final-plan` must pass
  through the interpreter path; source count of the Apple module must drop.

### F08 Whole-history revalidation per step

- Symptom: one operation costs ≥4 full `read()` calls; with the Git journal
  each `read` is O(events) subprocesses.
- Weak invariant: the interpreter treats the store as the only holder of
  truth even within one invocation; nothing says "an invocation may trust a
  snapshot it validated until its own CAS fails".
- Extra branches: repeated decode/verify of the same events; the forecast
  charges "bounded history loading" to the stores although the stores are not
  where the cost is.
- Canonical owner: the interpreter holds one validated `{snapshot, machine}`
  per invocation; after its own `Appended` it applies `machine.append(event)`
  locally and bumps the revision; it re-reads only on `RevisionMismatch`,
  `AmbiguousStorageOutcome`, or before returning the final report.
- Deletable: the four `read()` calls in the per-operation loop become one;
  `appendFact`'s loop re-reads only on mismatch.
- Verification: count store reads in the existing C07/C10 tests (assert exact
  counts) and keep every send-count assertion unchanged.

### F09 Producer SHA as a schema literal

- Symptom: the durable `ApplePreparation` schema encodes a Git commit hash;
  the proposal generator edits it by `replaceAll`.
- Weak invariant: "the admitted producer set is host policy" is expressed as a
  type, so policy changes are format changes.
- Canonical owner: `producer: { name, version }` as data in the preparation;
  the host's admitted producer set validated at `loadApplePreparations`.
- Deletable: the `replaceAll` adaptation; one literal per preparation kind.
- Verification: a preparation created under 0.6.3 loads under a host that
  admits 0.6.3 and 0.6.4 and fails under a host that admits neither.

### F02/F12 Duplicated receipt helper and renderer packages (topology)

- Symptom: T3 repeats the 13-line `http-evidence.ts` in each provider package
  (siblings may not import each other) and carries two renderer-only packages.
- Weak invariant: the lab slice has no `kernel.Http`; the full design does
  (`design.json` module `kernel.Http`), so the duplication is a lab artifact
  that the marginal numbers nevertheless charge to T3.
- Canonical owner: `kernel.Http` (receipt envelope + correspondence helper);
  catalog renderers as subpaths of one catalog package.
- Deletable: 2 × 13 helper lines in the slice; two manifests/tsconfigs in the
  full T3 projection (≈90 metadata lines).
- Verification: rerun `probes.mjs` + `metrics.mjs` after moving the helper
  into the lab kernel; predicted T3 source median 38, T1/T2 38.

## Strongest supported decisions (keep)

1. **M1** history/facts/decisions with one interpreter. Both candidates pass
   the same external-send oracles; M2 adds a materialized state (154 vs 105
   lines) that discards receipt bodies while the shared snapshot must retain
   them anyway. No performance claim was made and none is needed (see F08 for
   the real cost driver).
2. **CAS-only dispatch permission**, `AlreadyRecorded` never a permit,
   ambiguous append reconciled only inside the live call stack
   (`run.ts:180-186` is unreachable for a restarted process by construction).
3. **One physical journal, global revision, at most one publication scope,
   any number of preparation scopes** (tested in `boundaries.test.ts`).
4. **Single native send via `node:http` with `agent:false`**; the Bun fetch
   double-PUT is reproduced and retained.
5. **Owned content adoption boundary** with manifest-preimage recomputation
   and streaming copy; the forged-mode bug is a real find.
6. **No automatic Git-ref Action default**; explicit shared store; S3 optional.
7. **Hard cut** (explicit user decision) with a full export/format inventory
   of the published 0.3.0.
8. **Unpatched rc.108** for the proposed surface; effect-build 0.6.3 published
   consumer proof.
9. **Native Git plumbing** replacing the handwritten tree/commit parser
   (122 lines, 2 tests, both object formats).

## Considered and rejected concerns

- "Observation read-back could become replay permission": no; `owned` is set
  only from the live append result or the same call stack's exact read-back;
  `next()` never returns `AppendDispatch` while an unresolved non-Git start
  exists unless a matching `RiskAccepted` is present.
- "Provider can forge `GitCas` to get automatic replay": rejected before append
  and send (`core-git.ts:26-36`, `boundaries.test.ts:29-38`).
- "Credential rotation invalidates risk": principal, not credential bytes, is
  in the fingerprint (`boundaries.test.ts:40-61`).
- "Denominator inflated by externalizing builders to effect-build": the overlay
  (22,916) contains no build/archive/wheel code (`src/release`, `src/publication`,
  `src/transport`, `src/platform`, `src/cli`, `src/model` only); the comparison
  is publication-side like-for-like.
- "The 22,971 denominator was hand-typed": it is a literal in `inventory.ts:105`,
  but the recount reproduces it exactly under the recorded rule.
- "Hidden dual mechanism for external providers": the slice loads an external
  provider through ordinary import in a packed CLI built earlier (P02, 12
  outcomes); no registry.
- "M1 `Rejected` status vs. new attempt": `status()` says Rejected when every
  start has a linked noncommit proof and `next()` allows a `NonCommit` basis;
  consistent with C02b.

## Unreviewed areas

Provider wire fidelity against npm/PyPI/GitHub/MCP/OpenAI current APIs; the
Sigstore adapter option semantics; `public-history-inventory.py` internals;
`tools/architecture-program` internals beyond its counts; the 24 research
probes; effect-build internals; Windows/Apple native tooling; the exact bytes
of the 0.3.0 archive beyond its inventory; the three unrun native drivers
listed in `evidence-log.md`.
