# Source and maintenance assessment

## Denominator and ceiling (fresh recount)

Rule (`tools/architecture-lab/inventory.ts:40-41`): every `.ts/.tsx/.js/.mjs/.cjs`
under `src/` or `apps/*/src/` at the commit, counted as physical newlines.
Plan 005 defines the numerator as "all handwritten or generated production
TypeScript in public packages, hosts, and the Action source" plus generated
production inputs, and names the preserved overlay as the compression reference.

| Coordinate | Files | Product lines | Per top-level lane |
| --- | ---: | ---: | --- |
| Overlay `2ef7a9a` (denominator) | 60 | 22,916 | publication 10,932 · release 4,644 · platform 3,513 · transport 2,250 · cli 703 · model 493 · index 25 · action app 356 |
| + `apps/ts-release-action/action.yml` | 1 | 55 | generated product input |
| **Denominator** | | **22,971** | ceiling = floor(22,971 / 2) = **11,485** |
| PR21 `887a9fe` (required ancestor) | 93 | 18,052 | src 15,961 · release-ts 607 · action 1,136 · agents 348 |
| HEAD `9b14c6c` | 93 | 18,252 | src 16,161 · same apps |

Both recorded numbers reproduce exactly. Two caveats the packet does not state
plainly:

1. The line the implementation actually starts from is PR21/HEAD (≈18.1–18.3k),
   not the overlay. Against HEAD the forecast is a **37% reduction**, not
   50%; the 50% figure is only meaningful against the overlay reference that
   Plan 005 chose.
2. The overlay closed 19 of 69 acceptance rows (Plan 005 §Why). The numerator
   must close all 69. The comparison is like-for-like in *responsibility*
   (the overlay had no build/archive/wheel code either) but not in *evidence
   level*, so the forecast's provider rows cannot be sanity-checked against
   donor sizes that never passed their own oracles.

## Forecast decomposition (`forecast.json`, expected scenario)

| Class | Lines | Share | Basis quality |
| --- | ---: | ---: | --- |
| Measured prototype source, carried at physical density | 1,836 | 16% | kernel 935 · adoption/Apple 622 · journals 146 · CLI/Action bridge 43 · Action YAML 22 · checksums 68 |
| Estimated kernel/host completion | 1,830 | 16% | kernel admission/integration 140, HTTP/credentials/OIDC 780, journal completion 350, CLI/Action/self-release 560 |
| Seven provider implementations | 6,510 | 57% | donor-range estimates: npm 1,630 · warehouse 1,130 · github 1,520 · homebrew 200 · scoop 120 · mcp 1,180 · openai 730 |
| Native Git host (beyond the 71 kernel lines) | 929 | 8% | 122 measured construction + 807 estimate |
| Remaining Apple/content/host completion | 330 | 3% | estimate |
| Q01 remainder | 12 | <1% | estimate |
| **Expected total** | **11,447** | 100% | range 8,185 – 16,015 |

84% of the expected total is unmeasured. The "38 lines of headroom" is the
difference between two numbers of which one is an estimate with a ±35% band.

## Density adjustment (the packet's own printer diagnostic)

| Measured component | Physical | Printer | Ratio |
| --- | ---: | ---: | ---: |
| Selected machine | 935 | 1,043 | 1.116 |
| Adoption/Apple (5 files) | 552 | 661 | 1.197 |
| Native Git construction | 122 | 157 | 1.287 |
| Checksums | 68 | 77 | 1.132 |
| Overlay (donor style) | 22,916 | 18,432 | 0.804 |

The prototypes are 12–29% denser than the TypeScript printer's layout; the
donor is 20% *looser*. If the production code is written at ordinary
(printer-like) density, the measured 1,836 lines become ≈2,100 (+≈264), and the
expected total becomes **≈11,710**, above the ceiling by ≈225 lines, before any
estimation error. A defensible statement of the current position is:

> Expected ≈11,450 at prototype density, ≈11,700 at ordinary density, with a
> plausible engineering range of roughly 8,500–16,000. The ceiling is a
> coin flip, not a 38-line margin.

Correlated overruns to watch: the three HTTP publication providers share the
same unknowns (native metadata parsing, receipt/observation facets, strict
codecs); a 20% miss on one predicts a similar miss on the other two
(≈+850 lines together). The credential/OIDC row (780) and the native Git host
(807) are the two largest single estimates outside providers.

## Marginal quantiles (fresh recomputation from `metric-results.json`)

Per-probe TypeScript source additions (P01…P09):

| Layout | P01 | P02 | P03 | P04 | P05 | P06 | P07 | P08 | P09 | Sorted | Median (rank 5) | p90 = max (rank 9) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| T1/T2 | 0 | 46 | 38 | 12 | 43 | 73 | 40 | 7 | 47 | 0 7 12 38 **40** 43 46 47 73 | **40** | 73 |
| T3 | 0 | 46 | 51 | 12 | 43 | 73 | 40 | 7 | 47 | 0 7 12 40 **43** 46 47 51 73 | **43** | 73 |

Source + package metadata: T1/T2 median 43, T3 44, p90 77. Package metadata
lane alone: T1/T2 {0,19,4,0,0,4,4,0,0} median 0, p90 19; T3 {0,19,19,0,0,4,4,0,0}.

Consequences:

- Under Plan 005's numerator definition (TypeScript + Action source), with the
  predeclared configuration-only probe counted at its real zero, **T1 and T2
  pass the frozen 40-line median; T3 fails by 3** because P03 duplicates the
  13-line receipt helper (a lab artifact; the full design assigns it to
  `kernel.Http`).
- The metadata lane is what pushes every layout above 40. Plan 005 does not
  say manifests are in the TypeScript numerator; the handoff's conservative
  inclusion is a choice, and it should be a *separate* budget line rather than
  a reason to move the median to 45.
- Excluding P01 (eight samples, the trial-spec's nonzero rule): nearest-rank
  median rank 4 = 40 for T1/T2; the input's alternative "average of middle
  pair" method gives 41.5 → fails. The rule must be settled by amendment, not by
  picking the method that passes.
- Predicted after moving the helper into the lab kernel (P02 46→33, T3 P03
  51→38): source medians 38/38/38.

Metrics not measured (packet says so): representable invalid-state count,
owner hops, central branches touched, `semantic-source/v3`.

## Maintenance ledger (what the retired tooling really costs)

| Lane | Lines | Status |
| --- | ---: | --- |
| Product source (HEAD) | 18,252 | to be replaced |
| Root tests | ≈17,561 | to be replaced by `test/reimplementation/*` (unwritten) |
| `tools/architecture-program` src + tests (retired authority) | 27,046 + 12,388 | tracked (90 files); physical deletion deferred to W10 |
| `prototypes/research-complete-*` | 2,911 + 892 | tracked (103 files); superseded by the lab |
| `tools/architecture-lab` replacement | 8,031 (prototype 2,538 · tooling 3,271 · oracles 2,222) | staged |
| Handoff records | 61 files, ≈2.9 MB incl. gz | staged |
| Research probes under docs | ≈2,500 | tracked |

Total tracked-plus-staged research/tooling code after this handoff is ≈51k
lines against an 18k product. "Retired as authority" removes none of it; the
waves defer deletion to W10, which is the latest possible point. A W01 deletion
of `tools/architecture-program` and `prototypes/research-complete-*` (their
inputs under `docs/refactor/architecture-program/inputs/` are the retained
evidence and are hash-bound by the packet) would remove ≈43k lines of dead
tooling before implementation starts and is safe because nothing in
`verify.mjs`, the lab, or the waves imports them (`verify.mjs` binds only
`tools/architecture-program/src/trial-probe-evaluator.ts` as an evidence file for
E12; keep that single file or re-bind E12 to a copy under the handoff).

## Recommendations on the two extension questions

1. **Admit real configuration-only zeroes: yes.** P01 is one of the nine
   probes Plan 005 predeclared, and its predeclared invariant *is* "zero kernel
   edits". Plan 005's anti-dilution rule targets reused scorecard rows, not
   predeclared probes. Amend `trial-spec.json` `sampleUnit` (hash-changing,
   recorded) rather than waiving it silently.
2. **Raise the median to 45: no.** Keep 40 on the TypeScript lane; add a
   separate metadata-lane report with its own budget (proposal: median ≤ 5,
   p90 ≤ 25 lines, from the measured population). Run the helper-relocation
   experiment first; if T3 still misses 40 on the TypeScript lane it has a
   real duplication cost that the maintainer should see as such.
