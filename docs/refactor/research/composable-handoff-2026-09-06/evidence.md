# Evidence

Labels: **fresh** = run in this session; **inspected** = read, not rerun;
**estimate** = arithmetic on measured parts. Nothing in the repository tree was
modified; all runs used disposable copies under the job temp directory with
`node_modules` symlinked to the repository install.

## Inputs and runtime

| Item | Value |
| --- | --- |
| HEAD | `9b14c6c14aec5c5a41b2cb0f98d6f1c63bca4d3d`, branch `codex/architecture-program` |
| Index tree (staged handoff) | `72323d6191b11d69a77022f278bd3de671f43cbe`; `git status --short`: 189 `A`, 1 `M` (`docs/refactor/research/README.md`), 2 `??` (`.effect-build-hard-cut/`, `.effect-build-landing/`) |
| `bun.lock` sha256 | `faa938b0749fab11056df4a44dfbe497f149437207683cec591fbdab90c98297` (CI still pins `5640ae3d…`) |
| Runtimes | Bun 1.3.14; system Node v22.22.0 (below the engine floor); fnm Node v22.22.2 and npm 10.9.7 used for packed lanes and the installer experiment; TypeScript 6.0.3 from `node_modules` |
| Effect | installed `4.0.0-rc.108` (root manifest, both apps, lab). `AGENTS.md` ("aligned beta versions") is an **ignored, untracked** local note (`.gitignore:11`); it predates the rc migration recorded in tracked manifests. I used the installed rc.108 and changed nothing. This is reported, not resolved. |
| Sealed lab machine tree | `25f02ed605cb054888f5aad37f55f26732d0ad57fad595eafa1483502bebd435` (1,089 lines; M1-only 935) |

## Baseline reproduction (fresh)

| Command | Result |
| --- | --- |
| `bun tools/architecture-lab/verify.mjs` | `{"integrity":"verified","selected":69,"propositions":226,"obligations":"16/14/25/9/6/9","mode":"check","files":192}`; exit 0 (stderr: a `NO_COLOR`/`FORCE_COLOR` warning only). `--execute`/`--seal` **not** run on the packet. |
| `bun test ./tools/architecture-lab/{machine/test,storage,integration,git-catalog}` | 93 pass, 0 fail, 534 expect() calls, 10 files, 4.95 s |
| `bun node_modules/typescript/bin/tsc -p tools/architecture-lab/tsconfig.json` | exit 0 |

## E1. Installer behavior under skew (fresh) — `experiments/peer-skew/`

Synthetic packages, loopback registry, no Effect code. Full table:
[`results.md`](experiments/peer-skew/results.md), raw `results.json`.

| Finding | npm 10.9.7 | bun 1.3.14 |
| --- | --- | --- |
| Exact `effect` peer, consumer resolves rc.109 (S1) | ERESOLVE, exit 1 | installs silently |
| Range `effect` peer (S2) | ok | ok |
| Provider lists kernel@1 in `dependencies`, consumer has kernel@2 (S3) | installs **two kernels** (nested), `sameInstance:false`, 2 instances loaded | same |
| Provider exact **peer** kernel@1, consumer kernel@2 (S4) | ERESOLVE | installs kernel@2 with the provider, one instance, **no diagnostic failure** |
| Provider peer `^1`, kernel 1.5 (S5) / kernel 2 (S6) | ok / ERESOLVE | ok / installs kernel@2 silently |
| Consumer `overrides` kernel@2 over S3 (S8) | one kernel | one kernel |
| Consumer omits the kernel (S9) | peer auto-installed | peer auto-installed |

Conclusion: a peer declaration protects npm consumers only; bun performs no
peer enforcement; only a runtime contract check holds for both. `dependencies`
edges are wrong under both installers.

## E2. Helper relocation on the packed matrix (fresh) — `experiments/helper-relocation/`

Two full lab copies ran the sealed pipeline `topology/run.ts → probes.mjs →
metrics.mjs` (fnm Node 22.22.2, loopback registries), ≈7 minutes each, in
parallel. `setup-lane.sh` and `run-lane.sh` reproduce them; the relocation is
[`patches/helper-relocation-lab.patch`](patches/helper-relocation-lab.patch)
(8 files, +9/−13: move `http-evidence.ts` into `machine/src`, export it, import
from `@lab/kernel` in five providers, make two `probes.mjs` spreads conditional).

| Lane | source sha256 | TS-lane median T1/T2/T3 | TS+metadata median | metadata lane median / p90 | P02 (src+meta) | P03 T1/T2 / T3 |
| --- | --- | --- | --- | --- | --- | --- |
| baseline (control) | `c653f05d…` = sealed | 40 / 40 / 43 | 43 / 43 / 44 | 0 / 19 | 46+19 | 38+4 / 51+19 |
| relocated | `fbba7ed7…` | **37 / 37 / 37** | 42 / 42 / 44 | 0 / 19 | 32+19 | 37+4 / 37+19 |

All 20 scenarios per layout, all nine probes and every restart-sends-zero
assertion passed in both lanes (`*-summary.json`, `*-lane.log`). The control
lane reproduces the sealed quantiles exactly. The frozen 40-line TypeScript rule
passes for every layout after relocation; the combined number stays above 40
only because of the package-metadata lane, which is a manifest cost, not code.

## E3. Composition witnesses (fresh) — `experiments/witnesses/`, `examples/`, `patches/kernel-seams-*.patch`

Disposable copy of `machine`, `storage`, `integration`, `git-catalog` with the
kernel seam patch applied ([`kernel-seams-lab.patch`](patches/kernel-seams-lab.patch):
`contracts.ts` +11/−2, `identity.ts` +18/−4, `index.ts` +1/−1, `run.ts` +49/−36,
`m2-transition.ts` −154 moved out) and the tests parameterised over evaluators
([`kernel-seams-tests-lab.patch`](patches/kernel-seams-tests-lab.patch)).

| Check | Result |
| --- | --- |
| strict `tsc` on the copy | exit 0 |
| full copy suite | **156 pass / 0 fail / 937 expect() / 15 files**, 8.1 s: the 93 original tests now run for M1, external M2 and memoizing M3, plus 12 new witness cases ([`witness-cases.txt`](experiments/witnesses/witness-cases.txt)) |
| authoritative reads per ordinary release (C01 shape) | without cache **5 reads / 2 appends / 1 send**; with `CachingJournalStore` **1 read / 2 appends / 1 send**; logical reads equal (5) |
| stale cache (warm at rev 0, other runner completes) | CAS refuses at expected 0; cache invalidated; 1 send total |
| two runners, private caches, one journal, barrier at DispatchStarted | 2 arrivals, 1 send, 1 `DispatchStarted`; each report true of its revision; settled report Satisfied |
| ambiguous append / AlreadyRecorded through a cache | 1 / 0 sends; fresh cache resend 0 |
| lying cache (truncated history) | 0 sends; report revision 0 vs truth 2 |
| tampered cache (fingerprint) | rejected `fingerprint`; 0 sends |
| cache reporting a revision ≠ events | rejected `complete global history` |
| store laws kit | Memory, SQLite, cache(Memory), cache(SQLite): 7/7; last-writer-wins store fails the three CAS laws |
| provider with `contract: "lab/provider/0"` | rejected before any store read (0 reads, 0 sends) |
| second physical kernel copy, same contract | provider authored against the copy runs: Satisfied, 1 send |
| preparation-selection law | second different Satisfied selection refused via `observeRelease`; identical selection allowed; publication scope re-observable; hostile second selection rejected on read with 0 sends |
| undecodable committed receipt | one `core-undecodable-receipt/1` event {code, message ≤256, sha256, bytes}; string from the response not present; restart 0 resends; later observation Satisfied |
| fresh OS process (SQLite) with and without cache, after-append / after-send | Inconclusive / Satisfied, sends 0 / 1 (process tests now run 12 variants) |

## E4. Apple lanes (fresh) — `experiments/apple-selection/`

`apple/run-experiments.ts` (packed adopter from the retained PR24 stage) and
`apple-composition/run.mjs` (published 0.6.3 packs) ran in two lanes, ≈16 s each.

| Lane | Apple lifecycle checks | adoption checks Bun/Node | composition | Apple module |
| --- | --- | --- | --- | --- |
| control (sealed source) | 16/16 | 34/34 | 8 processes, 2 preparations | 224 lines |
| preparation-selection law ([`patch`](patches/preparation-selection-lab.patch): kernel `identity.ts` +11, `run.ts` +8/−2; Apple −20 loop +3) | **16/16** incl. `two-process-distinct-final-bytes-select-one-ready-by-global-cas` and `concurrent-unvalidated-prefix-cannot-select-ready-or-final-plan` | 34/34 | 8 processes, 2 preparations | **207 lines**, one append call site fewer |

Protocol doubles as in the handoff: this proves journal/CAS/ownership laws,
not Apple acceptance.

## E5. Inspected, not rerun

`unpatched-effect.mjs --execute`, `fetch-retry.mjs`, `published-upstream.mjs`,
`checksums/run.mjs`, `graphs.mjs`, `publication.mjs`, the 0.3.0 archive census,
the 27,046-line retired framework. Their receipts were hash-verified by
`verify.mjs`; none is needed for a finding here.

## Costs: four separate assessments

**Semantic complexity.** Added concepts: evaluator seam (1 optional Host field,
4 exported types, 2 exported law functions), provider contract literal (1 field,
1 constant), `CoreUndecodableReceipt` (1 core codec, 1 reserved version),
preparation-selection law (no new event, state or vocabulary; uses
`PreparationScope`). Removed: `Candidate` literal and the M1/M2 switch; M2 from
the kernel; Apple's second append path. Net: +4 concepts, −3.

**Control-flow readability.** Interpreter: +1 branch (undecodable receipt), +2
law calls (selection at append and read), −1 candidate switch; `appendFact`
unchanged in shape. System-wide append call sites: 2 → 1. Ownership hops on the
ordinary path unchanged (8); hidden decisions an implementer must know: the same
9 minus "which candidate" plus "the cache is a decorator".

**Production source (physical lines, charged).** Kernel prototype 935 → **971**
(+36: seam ≈+4, contract ≈+4, diagnostic ≈+14, selection law ≈+14). Apple
prototype 224 → 207 (−17). Relocated helper: 0 net (13 lines move into
`kernel.Http`, which the forecast already owns). Forecast rows: kernel 1,075 →
≈1,111, Apple 952 → ≈935; expected total ≈11,466 at prototype density,
≈11,720 at ordinary density (estimate) against the unchanged 11,485 ceiling.
Per-package manifests: 6 public × ≈38 measured lines ≈ 230 (T3 measured 304 for
8, T1 129), reported in the metadata lane, not the source lane.

**Total maintained tooling, metadata and tests.** New lab tests +251 lines
(`cache 118`, `contract 36`, `preparation-selection 29`, `store-laws.test 39`,
`undecodable 29`), conformance kit 25, cache example 39, memoizing example 15,
external M2 example 155 (moved, not new), application example ≈40, experiment
scripts ≈200, handoff patches (design.json 100-line diff, kernel-api 81-line
diff). Not deleted: the retired framework (≈43k lines) stays tracked until its
successor gates are green.

## Unverified limits

- No packed **production** layout exists; the roster and metadata estimate are
  projections of the same slice the handoff measured.
- Installer behavior was measured with bun 1.3.14 and npm 10.9.7 on synthetic
  packages; workspaces/isolated linkers and pnpm were not exercised.
- The cache decorator is single-process memory; a persistent index would need
  the same laws plus L3 labelling, not new kernel API.
- Apple, AWS, hosted Action, live registries, Sigstore signing: unchanged
  status (protocol doubles or unrun), exactly as the handoff states.
- The forecast remains ≈84% estimate; the density-adjusted total is above the
  ceiling; per-wave tripwires are the honest response, not a waiver.
