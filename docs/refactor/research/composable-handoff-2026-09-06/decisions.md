# Decisions

## 1. What the user fixed, what was a working default, what this packet decided

**Explicit user constraints (verbatim, 2026-09-06 brief).** "I don't want to over
complicate things too much." "But also composable. I.e shouldn't we allow caching,
multiple machines, etc in the future or if someone implements it?" Earlier
explicit decisions with provenance: hard cut, no known consumers (thread
01a072e8 line 259); evaluate `packages/` fairly, package count is not the
objective (01a072e8 line 829); keep all 69 selected outcomes including MCP/OpenAI.
Consequence applied everywhere below: "one machine" means **one authoritative
history per coordinated release with derived state**, never a ban on alternative
implementations, instances or concurrent workers.

**Working defaults given in the brief and kept unchanged.** M1 as the default;
`apps/` + `packages/`; pin an application's/provider's versions for the life of an
unfinished release; measure genuine configuration-only changes as zero; 40→45 and
a separate metadata budget are recommendations, not accepted amendments; bounded
credential-free diagnostics only; prove replacement checks before physical
deletion of the retired framework.

**Decided here (routine engineering, with evidence).**

| Decision | Choice | Why (evidence in [evidence.md](evidence.md)) |
| --- | --- | --- |
| Evaluator seam | `Host.machine?: MachineConstructor`, default `historyMachine`; `Machine` types public; the `M1|M2` literal and the tournament switch leave the API | M2 relocated out of the kernel passes the entire suite through the seam; kernel −154 lines of M2, +4 for the seam |
| Provider compatibility law | `ProviderDefinition.contract: "ts-release/provider/1"` verified before any store/provider effect | bun installs mismatched peers silently (S4/S6); installers cannot carry this law |
| Provider→kernel edge | `peerDependencies` range `>=0.4.0 <0.5.0` (not exact peer, not `dependencies`) | exact `dependencies` nests a second kernel under npm and bun (S3); exact peer ERESOLVEs compatible patch bumps under npm (S4/S6) while doing nothing under bun; range peer keeps one physical kernel (S5) |
| Effect peers | ranges `>=4.0.0-rc.108 <4.1.0-0`, exact dev pins | tracked law `scripts/lib/versions.ts:49-50`; S1 vs S2 |
| Caching | a `JournalStore` decorator supplied by the application; no kernel option | 39-line witness: 5→1 authoritative reads per ordinary release, every send count unchanged, lying/tampered caches cannot mint a permit |
| Preparation selection | kernel law on `PreparationScope` (append and read): one Satisfied output per preparation operation | replaces Apple's private CAS loop (−20 lines, one append call site fewer); 16/16 Apple lifecycle checks and 8-process composition pass |
| Undecodable committed receipt | journal `ObservationRecorded/DispatchError/Inconclusive` with `core-undecodable-receipt/1` = {code, bounded message ≤256 chars, receipt sha256, byte length}; no raw bytes | witness: no resend on restart; later native observation satisfies |
| Marginal policy | keep 40 on the TypeScript lane; report a metadata lane separately (proposed budget median ≤5, p90 ≤25) | after `kernel.Http` relocation TS medians are 37/37/37; metadata lane median 0, p90 19 in every layout |
| Topology | T3c: `packages/ts-release` (kernel, keeps name + bin) + npm, pypi, github, mcp, openai + one `catalog` (homebrew/scoop) = 7 public packages | incorporates the user's grouping decision below; keeps OpenAI's distinct API and semver dependency independently consumable; all selected outcomes remain |
| Python package coordinate | `@mannyc1/ts-release-pypi` (the handoff's "Warehouse" vertical) | user-facing coordinate names the index, matching the existing repo vocabulary (`build:pypi-wheels`, `src/publication/pypi.ts`); "warehouse" stays the module namespace |
| Retired tooling | keep tracked until successor gates are green; remove it from CI now; delete or tag afterwards | user default: prove replacement checks first |

**Subsequent user decision (approved).** After discussion of module boundaries
versus installation/dependency/publication boundaries, the assistant recommended
grouping Homebrew and Scoop under catalog and giving OpenAI its own package.
The user replied "Yea agree". This replaces the earlier OpenAI-as-catalog
recommendation. OpenAI has a substantial distinct API (plugin construction,
validation, marketplace and submission preparation) and its own semver
dependency; the distinction is more than branding. Sharing Git delivery remains
possible through the kernel.

This approval covers the grouping, not the peer policy, numerical amendments,
kernel changes or production execution. `selection.topology` remains null until
the complete proposed topology is reviewed and projected. P0 must account for
seven public packages, regenerate exact metadata, and check consumer exports and
dependency isolation; the earlier experimental receipts are not measurements of
the full amended roster.

## 2. Audit proposals: accept, revise, reject

Classification: **R** required for current correctness/executability, **C** needed
to make composition real, **O** optional optimisation or diagnostics, **P**
documented operational or measurement policy, **U** unsupported.

| Audit item | Class | Verdict | Basis |
| --- | --- | --- | --- |
| F01 / D5 exact Effect peers | R | **Accept**: range peers, exact dev pins | S1 npm ERESOLVE vs S2 ok; `versions.ts:49-50` |
| F04 / D4 provider→kernel exact `dependencies`; audit proposes exact peer | C | **Revise**: range peer + runtime contract literal | S3 two kernels (both installers); S4/S6 bun ignores peers; contract test rejects before any read |
| F02 / D2 admit configuration-only zero | P | **Accept** (amend `trial-spec.json` sampleUnit, hash-recorded) | P01 is a predeclared probe whose invariant is zero kernel edits |
| F02 / D3 raise median 40→45 | U | **Reject**; add separate metadata lane | relocated lane: TS 37/37/37; metadata median 0 / p90 19 |
| F02 duplicated 13-line helper | R | **Accept**: `kernel.Http` owns receipt envelope + correspondence | measured: T3 P03 51→37, P02 46→32 |
| F03 missing executor entrypoints, stale CI lock hash | R | **Accept, narrowed**: 2 scripts + a 69-row JSON, red stubs allowed; CI checks lock drift instead of a hash | commands named by `waves.json`/Plans 006–010 do not exist |
| F05 / D8 single-version codecs | P | **Reject as prerequisite**; policy: pin provider/app versions for the life of a release; reader keeps failing closed; an optional additive `legacyReceiptCodecs` reader hook is possible later without durable change | user default; no durable format touched |
| F06 / D7 undecodable committed receipt | O | **Accept in bounded form** (no raw text) | witness `undecodable-receipt.test.ts` |
| F07 Apple Ready outside the interpreter | C | **Revise**: scope-level preparation-selection law, no Apple vocabulary in the kernel; Apple routes Ready through `observeRelease` | Apple lanes: 16/16 + composition, Apple module 224→207 lines |
| F08 whole-history re-read per step | O | **Reject as kernel change**; cache decorator achieves 5→1 authoritative reads; interpreter validated-prefix memo deferred | `cache.test.ts`, read-count run |
| F09 producer SHA as schema literal | O | **Accept for W08** (producer as data + admitted set at load); not executed here | `apple-api.d.ts:45,58,71` |
| F10 / Plan 05 density adjustment + per-wave tripwires | P | **Accept** as accounting (no ceiling change) | `budget-assessment.md`; ≈11,700 at ordinary density |
| D9 / Plan 05 delete retired tooling at W01 | — | **Revise**: exclude from CI now; delete/tag only after successor gates are green and E12 rebound | user default |
| F11 self-referential receipt fixture | P | **Accept** as W02–W05 acceptance note: native correspondence needs a real remote fact | `topology/src/http.ts:26-27` |
| F12 renderer-only packages | C | **Revise**: Homebrew/Scoop are catalog subpaths; OpenAI remains a separate public capability | approved grouping above |
| F13 delta Git object sets | O | **Defer** (W04/W06 optimisation) | unchanged |
| F14 report precedence undocumented | P | **Accept**: documented in contracts §5 (latest observation over receipts; supersession masks per-operation status) | `m1-history.ts:24-34` |
| F15, F19 later acceptance | — | unchanged | — |
| F16–F18 corrected defects | — | none needed | — |
| F20 hard-cut provenance | — | confirmed | thread line 259 |
| D1 topology | — | **Revise**: T3c recommendation recorded; `selection.topology` stays for the maintainer to flip | roster table |
| D6 1 MiB event profile | P | **Accept** | store tests at exactly 1 MiB and +1 |
| Plan 01 | R | **Accept** → P0 | — |
| Plan 02 | R/P | **Accept** → P1 (measurement already done here; recording and reseal remain) | lanes |
| Plan 03 | R | **Accept, narrowed** → P2 | — |
| Plan 04 A/B/C/D/E | — | A reject-for-now (policy), B accept bounded, C revise (preparation selection), D reject (decorator), E accept W08 → P3 + W08 | witnesses, Apple lanes |
| Plan 05 | — | tripwires accept; deletion deferred | — |

A smaller package count or a changed measurement lane is not proof that an
architecture passed: the relocated-lane numbers passed the **frozen** TypeScript
rule; the metadata lane is reported, not folded in.

## 3. The four meanings of "multiple machines"

| Meaning | Supported? | Shared contract | Observable equivalence required |
| --- | --- | --- | --- |
| Interchangeable evaluators of one release protocol | Yes: `Host.machine`; M1 default; M2 and a memoizing wrapper pass the suite externally | `Machine` laws + the kernel conformance suite (the observable tests parameterised over evaluators) | same admitted-history set, same `next()` for the same (history, operation, candidate, now), same `report()`; byte-identical journals across different hosts are **not** required (ids/clock/scheduling differ) |
| Concurrent runners sharing one journal | Yes: C07, two-process store races, two private caches over one journal | `JournalStore` laws (conformance kit); permit = fresh `Appended` only | exactly one `Appended` per revision; every report is true of its revision; the final report at the highest revision is the same for all runners |
| Independent releases | Yes: independent journal ids (derived from plan inputs or explicit); one store may hold many | none across journals | none |
| Application composition of preparation and publication | Yes: any number of `PreparationScope`s + one `PublicationScope` per journal; providers, stores, transports, caches, evaluators composed in `createApplication` | `Host` + scope admission + preparation-selection law | one selected output per preparation; one persisted publication plan |

Not an open API and deliberately removed: the literal `M1 | M2` switch that only
made sense for the tournament. Genuinely separate product extensions (their own
packages, no kernel edit): providers, stores (S3 model), transports, evaluators.
