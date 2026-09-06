# Evidence log

Audit date: 2026-09-06. Repository: `/mnt/models/dev/ts-release`, branch
`codex/architecture-program`. Every entry records the command, the input
identity, the runtime, the observed result and what the result establishes.
Labels: **fresh** = reproduced in this audit; **inspected** = historical
receipt read, not rerun; **inference** = reasoning from code or records;
**unverified** = claim not checked here.

## Inputs under review

| Input | Identity |
| --- | --- |
| HEAD | `9b14c6c14aec5c5a41b2cb0f98d6f1c63bca4d3d` (`Grow the provider contract's correction axis…`) |
| Index tree (staged material) | `git write-tree` = `72323d6191b11d69a77022f278bd3de671f43cbe` |
| Staged | 189 added files + 1 modified (`docs/refactor/research/README.md`, five-line pointer to the handoff); 190 files, 73,596 insertions; 61 under `docs/refactor/architecture-program`, 128 under `tools/architecture-lab` |
| Unstaged | none |
| Untracked | `.effect-build-hard-cut/`, `.effect-build-landing/` (sibling effect-build worktrees, unrelated to the packet) |
| `plans/` | gitignored (`.gitignore:10`); this audit's output is not visible to git |
| `AGENTS.md` | gitignored (`.gitignore:15`), untracked; its "aligned beta versions" line is a stale local note |
| Producing thread | `codex://threads/01a072e8-487e-7e50-a5be-a4be850a54c6`, local transcript `~/.codex/sessions/2026/09/05/rollout-2026-09-05T18-50-20-01a072e8-….jsonl` (25.7 MB, 6 user messages, 42 assistant messages) |
| Ancestry | PR21 `887a9fe` is an ancestor of HEAD; PR22 `c2ac4ee` and overlay `2ef7a9a` are not (fresh, `git merge-base --is-ancestor`) |

## Runtime

Bun 1.3.14 (matches `packageManager`); system Node v22.22.0 (below the engine
floor `^22.22.2`; fnm has v22.22.2 installed but not default); Python 3.12.3;
git 2.43.0; GNU sha256sum 9.4; TypeScript 6.0.3 from `node_modules`. Root
`bun.lock` sha256 `faa938b0…`; CI (`.github/workflows/ci.yml:46,60`) still
pins `5640ae3d…` (PR21 lock), so hosted CI is red by construction on this branch.

## Commands run (fresh)

| # | Command | Result | Wall time | Establishes |
| --- | --- | --- | ---: | --- |
| 1 | Python sha256 over all 192 `contract.json` entries | 0 mismatches | <1s | Sealed packet bytes on disk equal the seal. Integrity only. |
| 2 | `bun tools/architecture-lab/verify.mjs` | `{"integrity":"verified",…,"files":192}` exit 0 | 0.15s | 226 propositions match `inputs/research-traceability.json`; 69 outcomes match scorecard oracle strings; 16/14/25/9/6/9 obligations present; evidence bindings and gz hashes valid; forecast arithmetic balances. Integrity, not behavior. |
| 3 | `bun test ./tools/architecture-lab/machine/test ./tools/architecture-lab/storage ./tools/architecture-lab/integration ./tools/architecture-lab/git-catalog` | 93 pass, 0 fail, 534 expect() calls, 10 files | 5.5s | The reported 93/534 reproduces. Composition: machine 61 (364 asserts), stores 15, S3 model 11, dependency integration 4, git-catalog 2. Loopback sockets and subprocesses worked in this sandbox. |
| 4 | `bun tools/architecture-lab/inventory.ts --check` | exit 0; pr21 18,052 / pr22 21,252 / overlay 22,916 / current 18,252 | 3.9s | Inventory summary is current. |
| 5 | `bun tools/architecture-lab/migration.ts --check` | exit 0; 347 files, 551 symbols, 120 formats, currentDeletedLines 18,252 | 0.06s | Migration summary is current. |
| 6 | `bun tools/architecture-lab/reconcile.ts --check` | exit 0; 226/69/15 seams/5 coordinate overrides | 0.02s | Reconciliation file is byte-current. |
| 7 | `bun tools/architecture-lab/project.ts --check` | exit 0; 15 surfaces, 255 symbols, 29 successors, 63 modules/alternative, topology null | 0.3s | layout.json/public-surface.json regenerate from design.json. |
| 8 | `python3 tools/architecture-lab/public-history-inventory.py --check` | exit 0; 522 members, 98 source units, 186 export names | 0.5s | 0.3.0 archive census reproduces from the retained tarball. |
| 9 | `bun tools/architecture-lab/machine/unpatched-effect.mjs` (offline) | exit 0; 16 sources, strictSelectedDeclarations true | 0.03s | Receipt/source hashes current; the `--execute` public download was not rerun. |
| 10 | `bun node_modules/typescript/bin/tsc -p tools/architecture-lab/tsconfig.json` | exit 0 | 3.0s | Lab compiles strictly against installed rc.108 + local patch. |
| 11 | `bun tools/architecture-lab/proposal/emit.mjs --check` | exit 0 (temporary consumer built from retained 0.6.3 tarballs) | 10.3s | Proposed adoption/provider/Apple declarations regenerate byte-identically; typecheck witnesses pass. Writes only to temp dirs; tree unchanged afterwards. |
| 12 | Denominator recount: `git ls-tree -r` + `git show | wc -l` over `src/**` and `apps/*/src/**` (`.ts/.tsx/.js/.mjs/.cjs`) at overlay/PR21/HEAD | overlay 22,916 (60 files) + `action.yml` 55 = 22,971; PR21 18,052; HEAD 18,252 | 40s | The recorded denominator and ceiling (11,485 = floor(22,971/2)) reproduce under the recorded definition (`inventory.ts:40-41`, physical newline count). |
| 13 | Nearest-rank quantiles recomputed from `metric-results.json` per-probe rows | T1/T2 source medians 40, T3 43; source+metadata 43/43/44; p90 = max = 73/77 | <1s | The handoff's marginal numbers reproduce; see budget assessment for the decomposition. |
| 14 | Transcript extraction (user + assistant messages) for threads 01a072e8, 01a052c8, 01a059f0, 01a05f55, 01a0526e | 6/15/3/5/7 user messages | <5s | User decisions recovered verbatim; see `provenance.md`. Three parallel 09/05 sessions (01a072e9-*) carry the same initial prompt only (forks); 01a07340 and 01a07359 are other projects. |

Not rerun (inspected only): `topology/run.ts` (packed layouts, 60 scenarios),
`probes.mjs`/`metrics.mjs`, `apple/build-upstream.ts` + `run-experiments.ts`,
`apple-composition/run.mjs`, `checksums/run.mjs`, `published-upstream.mjs`,
`unpatched-effect.mjs --execute`, `fetch-retry.mjs`. Their JSON receipts and
gzip payloads were hash-verified by commands 1–2 and their contents inspected.
Reasons: they need the fnm Node 22.22.2 binary and multi-minute loopback
registry runs; they are not required to resolve any finding below the
"unverified" line, and the audit brief discourages broad reruns.

## What the numbers in the handoff cover

| Reported | Actual composition | Detection power |
| --- | --- | --- |
| 93 tests / 534 assertions | 61 machine (both M1 and M2 for every case) + 15 store + 11 S3 model + 4 integration + 2 git-catalog | External send counters, real SQLite/Git/HTTP peers, fresh OS processes: a candidate that resends or grants a permit without CAS would fail. Receipt "correspondence" in fixtures compares request facts copied into the receipt by the fixture transport (`fixtures.ts:95`, `topology/src/http.ts:26-27`), so it cannot detect a wrong remote; only the npm/python observation checks (`dist.integrity`, `sha256`) and the integration test (native ID 41 vs 99) test native correspondence. |
| 60 packed-consumer scenarios | 5 scenario shapes (library, cli, action, cli+external, cli+lost-response) × 2 runtimes × 2 candidates × 3 layouts (`topology/run.mjs:166-170`) | Same real source in every layout; sends counted by the fixture server; restart sends = 0. Provider breadth: npm + python fixtures (90 + 85 lines) and a 46-line external provider. |
| 27 extension comparisons | 9 probes × 3 layouts; P01 is configuration-only; P04/P09 compare against generated counterfactual "before" trees | Before-fails/after-passes is executed for each; metrics are `git diff --numstat` on authored files, so relocation is visible. |
| 34 adoption checks per runtime | Same 34-check fixture under Node and Bun against published 0.6.3 (`upstream/published-consumer.json`) and unpatched rc.108 (`upstream/unpatched-effect-consumer.json`) | Real upstream finalizers; the 95,971,456-byte input is a local release artifact and is recorded as skippable. |
| 16 Apple lifecycle checks + 8-process mixed release | Protocol doubles behind real published Notary/Staple/Assess service tags; real SQLite, TAR, process replacement | Proves journal/CAS/ownership laws, not Apple acceptance (correctly labeled). |
| 19 checksum checks per runtime | Real GNU sha256sum 9.4 | Bounded; fine. |

## Effect pin discrepancy

Resolved by evidence, not by changing anything: root `package.json`,
`bun.lock`, both apps and the lab pin Effect `4.0.0-rc.108` (commit `4956165`
"Migrate to the Effect rc line"); `patches/effect@4.0.0-rc.108.patch` adds one
missing CLI `Param` declaration used by current production only; the handoff
proves the proposed surface compiles against the official unpatched archive
(`upstream/unpatched-effect-consumer.json`, negative control TS2339).
`AGENTS.md` ("aligned beta versions") is an ignored, untracked note that
predates the migration; `vendor/effect-bun-test/package.json` still declares a
`beta.83` peer (stale vendor). The handoff's rc.108 pin is the correct current
coordinate; the reconciliation rows `effect-beta83-first-slice` and
`rc108-production-authority` record the supersession explicitly.
