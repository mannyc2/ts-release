# Implementation plan: four prerequisites and one W01 delta

This narrows the audit's Plans 01–05 to the work that is actually required
before W01 and states the W01 changes the amended contract implies. Everything
else the audit proposed is either done here as evidence, deferred with an
explicit reason ([decisions.md](decisions.md) §2), or folded into an existing
wave. Order matters; each step ends in a pass witness and a stop condition.

| Step | Supersedes / narrows | Scope | Estimated effort |
| --- | --- | --- | --- |
| P0 Dependency policy in the projection | audit Plan 01 (accepted) + D4 revision | research/handoff only | small |
| P1 Marginal policy record + `kernel.Http` relocation | audit Plan 02 (measurement already done here) | research/handoff + lab source | small |
| P2 Executor entrypoints and CI | audit Plan 03 (narrowed) + Plan 05 tripwire wiring | tracked scripts/docs | small–medium |
| P3 Kernel seams on the lab and declaration regeneration | audit Plan 04 (A rejected, B bounded, C revised, D rejected, E moved to W08) | lab source + handoff declarations | small (patches exist) |
| W01 delta | handoff W01 | production kernel | inside W01 |

Not in the sequence: deleting `tools/architecture-program` (deferred until P2's
successor gates are green; see D9), versioned codec maps (policy), interpreter
read memo (decorator instead), Apple producer-as-data (W08).

## P0 — Dependency policy in the projection

Files: `handoff/design.json` (apply `patches/handoff-design.json.patch`:
`peerPolicy`, T3c alternative, provider `package` fields, invariants);
`tools/architecture-lab/project.ts` (two changes: emit provider manifests with
`peerDependencies: { "@mannyc1/ts-release": peerPolicy.kernelPeerRange, effect: peerPolicy.effect }`
and no kernel `dependencies` entry; group providers by their `package` field
into one manifest per package with one subpath per provider file group);
regenerated `layout.json`, `public-surface.json`, `forecast.json.layoutMetadata`;
one paragraph each in `topology.md` and `hosts.md`.

The user approved Homebrew/Scoop sharing catalog and OpenAI remaining separate.
Project seven public packages. Verify catalog exposes only `./homebrew` and
`./scoop` and gains no OpenAI-only dependencies; OpenAI exports its complete API
from its own root and owns its semver dependency. Regenerate exact manifest and
cohort accounting and exercise the amended public imports in packed consumers.
Earlier small-slice receipts retain their original scope.

Checks: `bun tools/architecture-lab/project.ts --write && bun tools/architecture-lab/project.ts --check`
exit 0; `grep -c '"effect": "4.0.0-rc.108"' handoff/layout.json` returns 0 inside
`peerDependencies`; `project.ts --check` gains an assertion that every projected
`effect*` peer is a range satisfied by the exact pin and every provider manifest
peers on the kernel range. Optional but recommended: add one loopback
publication scenario asserting that a consumer on effect `4.0.0-rc.999`
installs with the range peer and ERESOLVEs with an exact one (the synthetic
experiment in `experiments/peer-skew/run.mjs` already shows both outcomes).

Stop if `project.ts` cannot express per-package grouping without hand edits;
then fix the projector first (still research).

## P1 — Marginal policy record and `kernel.Http` relocation

Files: `docs/refactor/architecture-program/inputs/trial-spec.json`
(`marginalBudget.sampleUnit` → observation-per-probe with real zeros; add
`metadataLane: { medianAtMost: 5, p90AtMost: 25 }`; the new hash goes into
`qualification.json.inputBindings`); apply
`patches/helper-relocation-lab.patch` to `tools/architecture-lab`; copy the two
lane results from `experiments/helper-relocation/` or rerun
`topology/run.ts → probes.mjs → metrics.mjs` (≈7 min, fnm Node 22.22.2) so the
sealed `metric-results.json`/`extension-results.json`/`results.json` carry the
relocated source; update `machine/source-metrics.json`,
`design.json.machineEvidence` (kernel tree grows by the 13-line helper),
`topology.md`, `qualification.md` GM06/GT15, `README.md` numbers.

Expected: TS-lane medians 37/37/37, p90 73; metadata lane median 0 / p90 19;
the 45 proposal removed from `design.json` (done in the patch).

Stop if any layout's TS-lane median exceeds 40 after relocation; report it as
that layout's real duplication cost, do not widen the budget.

## P2 — Executor entrypoints and CI

Files: `package.json` scripts `check:architecture-program`
(`bun tools/architecture-lab/verify.mjs && bun tools/architecture-lab/project.ts --check && bun scripts/check-architecture-ancestry.ts && bun scripts/check-architecture-budget.ts`),
`check:launch-evidence`, `check:launch-closure`, red stubs
`check:packed-action`/`check:effect-build-integration` (exit 1 with the owning
wave named); `scripts/check-architecture-ancestry.ts` (the three
`merge-base` checks from `waves.json.ancestry`); `scripts/check-launch-evidence.ts`
+ `docs/refactor/evidence/launch-evidence.json` (69 rows, all `open`, generated
from `waves.json`); `scripts/check-architecture-budget.ts` (≈20 lines: the
`inventory.ts:40-41` count against `forecast.json.perWaveBudget`, which P2 adds
together with `densityAdjusted`); `.github/workflows/ci.yml`: replace the
hard-coded `bun.lock` hash with `git diff --exit-code -- bun.lock` after
`bun install --frozen-lockfile`, and stop installing/running
`tools/architecture-program` in CI; `advisor-plans/README.md` and the preflight
paragraphs of Plans 006–010 point at the handoff artifact map.

Checks: `bun run check:architecture-program` exit 0; `check:launch-evidence`
exit 0 with 69 open rows; `check:launch-closure` exit 1 "69 open".

Stop if the maintainer prefers renaming packet files to the old plan names;
either direction, but one.

## P3 — Kernel seams on the lab and declaration regeneration

Apply `patches/kernel-seams-lab.patch` and `patches/kernel-seams-tests-lab.patch`
to `tools/architecture-lab` (or take the lab copy's commit as is), move
`witnesses/` to `tools/architecture-lab/machine/witnesses/` (they are lab tests
and examples), apply `patches/preparation-selection-lab.patch`'s Apple part to
`apple/apple-preparation.ts` (the kernel part is already inside the seams
patch), then:

1. `bun test ./tools/architecture-lab/machine/test ./tools/architecture-lab/storage ./tools/architecture-lab/integration ./tools/architecture-lab/git-catalog ./tools/architecture-lab/machine/witnesses` → 156 pass;
2. `bun tools/architecture-lab/apple/run-experiments.ts` → 16 checks; `apple-composition/run.mjs` → 8 processes;
3. regenerate declarations: `bun tools/architecture-lab/proposal/emit.mjs` (write), then hand-carry the machine-derived changes into `handoff/kernel-api.d.ts` (or apply `patches/handoff-kernel-api.d.ts.patch`, which is exactly that delta), rerun `emit.mjs --check`;
4. `bun tools/architecture-lab/machine/measure.mjs` → `source-metrics.json` (expect ≈971 + 13 helper lines for the M1-only kernel), update `design.json.machineEvidence` and the kernel/Apple rows in `forecast.json`;
5. `verify.mjs --seal` by the maintainer after review; then `verify.mjs`.

Stop if any send-count assertion changes, or if the preparation-selection law
needs any provider- or Apple-specific vocabulary in the kernel (it does not in
the witness).

## W01 delta (production kernel)

Implement the amended `kernel-api.d.ts`: `Host.machine` with `historyMachine`
default and the exported `Machine` types; `PROVIDER_CONTRACT` and
`ProviderDefinition.contract` checked in `verifyProviderContracts`; the
preparation-selection law at append and read; the bounded
`core-undecodable-receipt/1` diagnostic whose message passes the host redaction
boundary (`src/model/secret-patterns.ts` lineage); `kernel.Http` owns the
receipt envelope and correspondence helper. W01's suite
(`test/reimplementation/kernel`) is parameterised over `MachineConstructor` with
M1 as the only shipped evaluator and an external evaluator fixture (the M2
example) as the conformance witness; it includes the store-laws kit for SQLite
and Git, the contract rejection case, the preparation-selection cases and the
undecodable-receipt case. Budget: kernel forecast row ≈1,111 lines.

Later waves change only as follows: W02–W07 provider definitions carry the
contract literal and peer on the kernel range; W04 hosts import the receipt
helper from `kernel.Http`; W06 ships one `catalog` package (homebrew + scoop);
W08 records the Apple producer as data (F09) and routes Ready through
`observeRelease`; W09 ships separate `mcp` and `openai` packages;
W10's self-release publishes seven coordinates with a cohort preflight.

## Behavior-preserving checks that stay red until their wave

`check:packed-action` (W10), `check:effect-build-integration` (W08),
`check:launch-closure` (Plan 009). A gate that cannot run is not a gate; a stub
that names its owner is.
