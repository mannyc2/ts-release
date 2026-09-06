# Handoff audit: ts-release architecture handoff (staged at HEAD `9b14c6c`)

Audit date 2026-09-06. Inputs: HEAD `9b14c6c14aec5c5a41b2cb0f98d6f1c63bca4d3d`
plus the staged handoff (index tree `72323d6191b11d69a77022f278bd3de671f43cbe`,
190 files). Nothing was committed, staged, installed, published or refactored;
all new material is under this ignored directory.

## Verdict

**Ready after named prerequisites — for beginning W01.** Not ready to freeze
the complete design (two maintainer decisions plus five contract amendments
are open), and nowhere near certification (Plans 009/010 are correctly
unstarted).

What is solid: the reconciliation is complete and honest (226 propositions,
69 outcomes, every native oracle string preserved; nothing weakened, nothing
relabeled as passed); the sealed evidence reproduces (192 files, 93/534 tests,
every `--check`, declaration emission, denominator recount); the machine laws
that matter (CAS-only permission, no replay from read-back, one journal,
single native send, owned adoption, hard cut) are implemented in real code
with independent oracles; the T1/T2/T3 work is a fair comparison of the same
source; the forecast is a bottom-up estimate that names its own unknowns.

What blocks W01 (prerequisites, all small):

1. **Dependency contract** (F01/F04): every proposed manifest pins Effect as an
   exact peer, contradicting the tracked peer-range law and effect-build's own
   range peer; provider→kernel is an exact dependency that duplicates the
   kernel under skew. Plan 01.
2. **Marginal policy** (F02): the "45-line" amendment merges two decisions and
   equals the number that admits the recommended T3; under the frozen 40 with
   the real zero admitted, T1/T2 pass and T3 fails by a lab artifact. Plan 02
   runs the structural experiment and splits the decision (D2/D3).
3. **Executor entrypoints** (F03): the gates the waves and Plans 006–010
   prescribe do not exist, the plans still name the old freeze artifacts, and
   CI pins an obsolete lockfile hash. Plan 03.
4. **Kernel contract amendments before the API freeze** (F05–F09): versioned
   codec maps, raw-receipt retention, one-Ready-per-preparation as a machine
   law (deleting Apple's private CAS loops), invocation-scoped snapshot, and
   producer pin as data. Plan 04.
5. **Budget honesty** (F10): 38 lines of headroom is a prototype-density
   artifact; at ordinary density the expected total is ≈11,700 > 11,485.
   Plan 05 adds per-wave tripwires and deletes ≈43k lines of retired tooling
   now instead of at W10.

Topology and marginal policy remain the maintainer's; see `decision-packet.md`.

## Documents

| File | Content |
| --- | --- |
| [evidence-log.md](evidence-log.md) | inputs identity, runtime, every command run, what each establishes, what the headline numbers actually cover, Effect-pin resolution |
| [provenance.md](provenance.md) | user decisions recovered verbatim from transcripts; recommendations vs decisions vs superseded |
| [findings.md](findings.md) | ranked findings F01–F20 with anchors; traced design weaknesses (symptom → invariant → branches → owner → deletable → verification); strongest decisions; rejected concerns; unreviewed areas |
| [budget-assessment.md](budget-assessment.md) | denominator/ceiling recount, forecast decomposition, density adjustment, marginal quantiles recomputed, maintenance ledger, extension-policy recommendations |
| [topology-and-machine.md](topology-and-machine.md) | machine trace, M1 vs M2, one ordinary and one recovery path through real files with hidden-decision counts, T1/T2/T3/T3′ comparison, seams |
| [decision-packet.md](decision-packet.md) | D1–D9 with alternatives and recommendations |
| [plans/01](plans/01-peer-contract.md) … [plans/05](plans/05-budget-tripwires-and-tooling-deletion.md) | self-contained improvement plans |

## Ranked findings (summary; full table in findings.md)

| # | Sev | Tag | One line |
| --- | --- | --- | --- |
| F01 | High | current defect | Exact `effect` peer in every projected manifest re-creates the ERESOLVE failure the repo already fixed (`scripts/lib/versions.ts:49-50`). |
| F02 | High | proposal gap | Marginal amendment conflates zero-admission with raising 40→45; 45 equals T3's number; T3's miss is a duplicated 13-line helper the design assigns to `kernel.Http`. |
| F03 | High | current defect | `check:architecture-program`, `check:launch-*`, the evidence ledger and the plan artifact names do not exist as prescribed; CI lock hash stale. |
| F04 | Med | proposal gap | Provider→kernel exact `dependencies` silently duplicates the kernel under skew. |
| F05 | Med | proposal gap | Single-version codec channels make in-flight journals unreadable after a provider bump. |
| F06 | Med | proposal gap | A committed receipt that fails strict decoding is discarded, not journaled. |
| F07 | Med | proposal gap | Apple Ready selection duplicates the interpreter's append/CAS loop outside the interpreter. |
| F08 | Med | proposal gap | Whole-history revalidation on every interpreter step; Git journal reads are O(events) subprocesses. |
| F09 | Med | proposal gap | Producer commit SHA baked into the durable Apple schema as a literal. |
| F10 | Med | proposal gap | Forecast headroom is not real at ordinary code density; 84% of the total is estimate. |
| F11 | Med | proposal gap | Packed-fixture receipt correspondence is self-referential; native correspondence exists only in observations/integration/Apple. |
| F12–F14 | Low | proposal gap | Renderer-only T3 packages; whole-graph Git object sets; undocumented report precedence. |
| F15, F19 | Low | later acceptance | 1 MiB profile vs real payloads; Apple/AWS/Action/live acceptance correctly deferred. |
| F16–F18 | Low | corrected | Bun fetch double-PUT; forged tree mode; npm/owned cycle — found and fixed by the research. |
| F20 | Info | — | Hard-cut provenance verified. |

## Recommendations

- **Machine:** M1, amended per Plan 04 (C and D). M2 adds a second
  representation with no exploited benefit.
- **Topology:** choose between **T1** and a **corrected T3′** (kernel +
  npm/warehouse/github/catalog with renderers as subpaths; MCP/OpenAI as later
  packages) after Plan 02's experiment. Not T3 as projected, not T2.
- **Extension policy:** admit real configuration-only zeroes (D2: yes); keep
  the 40-line TypeScript-lane median and add a separate metadata-lane budget
  (D3: no to 45).
- **Effect:** rc.108 range peer with exact dev pins (D5); AGENTS.md's beta
  wording is stale local text.

## Next action (smallest set that enables W01)

1. Record D2, D3, D5 and either D1 (T1) or D1 + D4 (T3′) in `design.json`.
2. Execute Plans 01, 02 and 03 (research/handoff/tracked-doc changes; ~1–2
   days including the packed rerun), reseal with `verify.mjs --seal`.
3. Execute Plan 04 A–E on the lab kernel and regenerate the declarations;
   freeze `kernel-api.d.ts` only after that.
4. Execute Plan 05 (tripwires; delete retired tooling) so W01 starts on a
   tree whose gates are real and whose budget is measured per wave.
5. Begin W01 from PR21 ancestry as specified in `waves.json`.

Later, not now: hosted Action store qualification (OB01), S3/WORM (OB03),
Apple native acceptance (OB06/P09/P10), Windows signing, live registries
(Plan 009), certification (Plan 010).

## Optional product ideas within selected scope

- Delta Git object sets with a read-only shallow fetch of `expectedOld` at
  push time (F13) — bounds owned content by the change, not the tap history.
- A `producer` field as data (F09) doubles as the admitted-producer policy hook
  the Windows/Apple waves will need anyway.
