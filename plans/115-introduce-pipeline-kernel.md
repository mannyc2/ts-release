# Plan 115: Introduce the pipeline kernel and move builds into library pipes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.
>
> **Required reading before Step 1**: the finalized contract in
> `plans/114-pipeline-contract.md` AND the builder contract in
> `plans/119-design-builder-contract.md` (canonical platform targets,
> `Builder` interface, `command`/`prebuilt` escape hatch). Those contracts
> are the authority; this plan inlines draft baselines, and 114/119
> execution may have patched details here. If either plan's status in
> `plans/README.md` is not DONE, STOP.
>
> **Drift check (run first)**:
>
> ```sh
> git diff --stat f1c90c0..HEAD -- src/domain src/planner src/artifacts src/targets src/workflows apps/release-ts/src/runtime
> ```
>
> Expect changes only from plans 113/114 (version bump, docs). Structural
> src/ changes beyond that → compare "Current state" excerpts before
> proceeding; meaningful mismatch → STOP.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: MED
- **Depends on**: 113 (ship 0.0.8 first — do not break an unreleased surface), 114 (kernel contract), 119 (builder contract)
- **Category**: tech-debt / architecture
- **Planned at**: commit `f1c90c0`, 2026-07-03

## Why this matters

The engine has three different extension seams: artifact "recipes" living in
the CLI app runtime, target adapters in the library, and workflow functions
above both — plus a 969-line central normalizer that must learn every new
feature. The 0.1 direction (GoReleaser-shaped) replaces all three with one
seam: an ordered pipeline of small pipes over a shared, serializable release
state with a filterable artifact catalog. This plan builds that kernel and
proves it by porting the three build paths (bun executable, npm pack, PyPI
wheel) into library build pipes. Publish targets stay on the old path until
plan 116 — both paths coexist inside this plan so the suite stays green at
every step.

## Current state

(Verified at `f1c90c0`; re-verify excerpts after drift check.)

- `src/planner/normalize-release.ts` (969 lines) — central normalization:
  config→domain adapters (~40%), field validation (~50%), identity/path
  resolution (~10%). The build-related parts move into per-pipe `defaults`;
  identity resolution survives as the kernel's identity stage.
- `src/artifacts/adapter.ts` (100 lines) — `ArtifactRecipe` staging seam; the
  concrete builders live OUTSIDE the library:
  - `apps/release-ts/src/runtime/bun-artifact-recipes.ts` — bun compile
    staging.
  - `apps/release-ts/src/runtime/pypi-wheel-artifact-recipes.ts` (401 lines)
    — wheel assembly (zip writing, RECORD, metadata).
- Artifact metadata sprawl in `src/domain/artifact.ts` (see
  `ArtifactIntent`, `ArtifactInventoryItem`, `InstallableArtifactVariant`,
  `BunExecutableArtifactRecipe`, `PyPiWheelArtifactRecipe`); no filterable
  catalog.
- Operations are risk-graded data (`src/domain/operation.ts`:
  `OperationRisk = "read-only" | "writes-local" | "externally-visible" |
  "irreversible"`); `src/planner/executor.ts` (448 lines) is the only thing
  that executes them, via injected `host/` services. This model is preserved
  — the kernel emits operations, it does not execute.
- `src/workflows/release.ts` (718 lines) — the internal engine the CLI and
  Action call (`planRelease`, `buildReleaseArtifacts`, ...). Its call sites
  are the compatibility boundary this plan must not break.
- Tests: `bun test` → 205 pass / 2 skip at planning time. Test harness:
  `@effect/bun-test` (vendored), patterns in `test/*.test.ts` — model new
  tests on `test/config-schema.test.ts` (schema round-trips) and
  `test/target-github.test.ts` (operation planning).

Conventions (binding): Bun only; Effect 4.0.0-beta.83 aligned;
`Schema.Class`/`TaggedClass`/`TaggedErrorClass` for durable data/errors;
`Effect.fn` for reusable operations, `Effect.gen` for workflow bodies; layers
at boundaries; publish operations stay data until approved; `.repos/effect`
and `vendor/` untouchable.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bun run check` | exit 0 |
| Tests | `bun test` | 0 fail |
| Full gate | `bun run check:portable` | exit 0 |
| Self-release gate | `bun run check:release` | exit 0 |
| LOC measure | `find src apps/release-ts/src apps/ts-release-action/src -name '*.ts' \| xargs wc -l \| tail -1` | record the number |

## Scope

**In scope**:

- Create `src/pipeline/` (kernel: state, catalog, pipe interface, runner,
  identity stage, template expansion) per the 114 contract.
- Create `src/pipes/build.ts` as the generic build pipe with
  `src/builders/bun.ts`, `src/builders/command.ts`, and
  `src/builders/prebuilt.ts` as the 0.1 builders, plus
  `src/pipes/npm-pack.ts` and `src/pipes/pypi-wheel.ts`.
- Move wheel/executable staging logic from
  `apps/release-ts/src/runtime/*-recipes.ts` into the library behind the
  `ArtifactStager` escape-hatch service defined by the 114 contract.
- Rewire `src/workflows/release.ts` build path onto the pipeline; keep its
  exported function signatures unchanged.
- Delete build-specific branches of `normalize-release.ts` as they are
  absorbed; delete `src/artifacts/adapter.ts` when nothing imports it.
- New tests under `test/` for kernel + each build pipe.

**Out of scope** (do NOT touch):

- `src/targets/**` and the publish/verify path — plan 116.
- Public exports in `src/index.ts` / `package.json` — plan 117.
- CLI flags/commands, Action inputs — plan 117.
- `scripts/`, `apps/release-ts/scripts/` — plan 118.
- `.repos/effect`, `vendor/`, `test/` deletions (only additions/updates here).

## Git workflow

- Branch: `codex/115-pipeline-kernel`.
- Commit per step, imperative sentence case (e.g. `Add pipeline kernel state
  and catalog`).
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the LOC baseline

Run the LOC measure command; record the total in your final report and in
the `plans/README.md` status note.

**Verify**: a number ≈ 10.2k (± plan-113/114 drift). The command covers the
library and app source trees only — `scripts/`, `apps/release-ts/scripts/`,
and `test/` sit outside it; the ≈ 13.7k figure quoted elsewhere is the
whole-repo total including scripts.

### Step 2: Build the kernel data types

In `src/pipeline/`, implement per the 114 contract: `ReleaseState` (identity
+ artifacts + operations + notices, all Schema classes, serializable),
`Artifact` (single tagged family with `kind`, `path`, `producedBy`,
optional platform/checksum/extra — typed per-kind extra fields per 114
D13), `ArtifactCatalog` with pure filter
combinators (`byKind`, `byOs`, `byArch`, `byProducer`), and `PipeNotice`.
Reuse `InstallableArtifactVariant` and `Checksum` from `src/domain/artifact.ts`
rather than redefining them.

Two kernel rules from the 114 contract (D12) are enforced here, not just
documented: **no function-valued fields anywhere in `ReleaseState`**
(GoReleaser hides a checksum-refresh closure in artifact metadata, omitted
from its JSON — the exact anti-pattern that would silently break our
resume/split-merge story), and **artifacts are immutable once
contributed** — a pipe that transforms an artifact contributes a NEW
artifact with provenance; nothing rewrites a catalog entry.

**Verify**: `bun run check` → exit 0. New test
`test/pipeline-state.test.ts`: state JSON-round-trips through Schema
(model on `test/config-schema.test.ts`); catalog filters compose. `bun test
test/pipeline-state.test.ts` → pass.

### Step 3: Implement the Pipe interface and pipeline runner

Per the contract: `Pipe<Section>` (`id`, `phase`, `section`, optional
`defaults`, `plan`) and a runner that folds an ordered pipe array over
`ReleaseState` — applying `defaults`, recording skip notices for pipes whose
`section` returns undefined, and appending each `PipeContribution`. Notices
are reason-bearing and a single pipe may contribute several in one run
(114 D11, GoReleaser's `SkipMemento` aggregation adopted as plain data). The
pipeline array lives in one file (`src/pipeline/pipeline.ts`), initially
containing only the identity stage. The identity stage implements the 114
contract's `VersionSource` strategy seam (sources resolve identity through
read-only injected services; modifiers transform it) with ONE source in
this plan: `manifest`, a behavior-preserving port of today's
manifest-derived identity (the vestigial `ReleaseIdentitySource` union in
`src/domain/release.ts:48-72` dissolves into it). The `git-tag` source and
the snapshot modifier land in plan 116.

**Verify**: `test/pipeline-runner.test.ts` with toy pipes: ordering
respected, skip notice recorded, contributions appended, defaults applied
before plan. `bun test test/pipeline-runner.test.ts` → pass.

### Step 4: Port the bun executable build as the first Builder behind a generic build pipe

Per the plan-119 builder contract: implement ONE generic build pipe
(`src/pipes/build.ts`) that consumes a static builder registry, and
`src/builders/bun.ts` as the first dedicated `Builder` (builders live in
their own top-level `src/builders/` directory per 114 D18 — `pipes/` holds
only Pipe modules) — its `defaults` absorbs
the bun-build normalization currently in `normalize-release.ts`, its
translation table inverts the compile-target→variant switch in
`src/domain/artifact.ts:145-233` (config now declares canonical
`PlatformTarget`s per 119; `BunExecutableCompileTarget` leaves the config
vocabulary), and its `plan` emits one `writes-local` staging operation per
output plus catalog artifacts (`kind: "executable"`,
`producedBy: "build:bun"`). Update `apps/release-ts/release.config.json`
targets to the canonical vocabulary in the same commit. The actual
bun-compile invocation moves from
`apps/release-ts/src/runtime/bun-artifact-recipes.ts` into the library as an
`ArtifactStager` implementation; the app runtime provides the layer. Note
it already compiles in-process via `Bun.build` — per 119 B5 the move
preserves that (structured compile intent in a `StageArtifactOperation`;
the translation table's output type is `Bun.Build.CompileTarget` so
toolchain drift is a compile error), not a switch to a shelled CLI.

In the same generic pipe, add `src/builders/command.ts` and
`src/builders/prebuilt.ts` exactly per `plans/119-builder-contract.md`:
`command` emits argv-only `writes-local` command operations and verifies the
declared `output`, while `prebuilt` emits catalog artifacts plus read-only
existence checks and no build operation. They are part of 0.1, not a later
follow-up, because they prove the language-agnostic build axis before any
publish surfaces port onto the catalog.

Note: npm-pack and pypi-wheel (Step 5) are packaging pipes, NOT builders,
per the 119 contract.

**Verify**: `bun test` → 0 fail. `bun run check:app` → exit 0.
`bun run cli build --config apps/release-ts/release.config.json --format text`
→ exit 0 and stages the same artifact set as before the change (compare
`.release/artifacts/` listing before/after on the same version). New build
pipe tests cover `bun`, `command`, and `prebuilt` operation/catalog shapes.

### Step 5: Port npm-pack and pypi-wheel builds

Same treatment: `src/pipes/npm-pack.ts` and
`src/pipes/pypi-wheel.ts`; the wheel writer moves from
`apps/release-ts/src/runtime/pypi-wheel-artifact-recipes.ts` into the
library. Add both to the pipeline array.

**Verify**: `bun test` → 0 fail; per-pipe tests exist (operation shape,
catalog contribution, defaults); `bun run check:release` → exit 0.

### Step 6: Rewire the engine build path and delete absorbed code

Point `buildReleaseArtifacts` in `src/workflows/release.ts` at the pipeline
runner (build phase only). Delete: the recipe plumbing in
`src/artifacts/adapter.ts`, the app-runtime recipe modules, and the
build-related branches of `normalize-release.ts` — only once
`rg -n "ArtifactRecipe|artifact-recipes" src apps` shows no remaining
consumers.

**Verify**: `bun run check:portable` → exit 0; `bun run check:release` →
exit 0; the rg sweep above → no hits outside tests that were updated.

### Step 7: Measure and report LOC

Re-run the LOC measure command. Expected: net reduction relative to Step 1
even with the kernel added (the ~800 app-runtime recipe lines and the
build share of `normalize-release.ts` are gone). Record both numbers in the
status row note.

**Verify**: total is BELOW the Step 1 baseline. If it is not, report the
delta and where it went — do not golf to force it.

## Test plan

- `test/pipeline-state.test.ts` — schema round-trip, catalog filters.
- `test/pipeline-runner.test.ts` — ordering, skips, defaults, contribution
  merge.
- `test/pipe-build-bun.test.ts`, `test/pipe-build-command.test.ts`,
  `test/pipe-build-prebuilt.test.ts`, `test/pipe-build-pypi-wheel.test.ts`,
  `test/pipe-build-npm-pack.test.ts` — defaults + emitted operations +
  catalog artifacts, no execution (model on `test/target-github.test.ts`).
- All existing tests keep passing unmodified EXCEPT tests that imported
  moved recipe modules — update their imports, not their assertions.

## Done criteria

- [ ] `bun run check:portable` and `bun run check:release` exit 0.
- [ ] `bun test` → 0 fail; the seven new test files exist and pass.
- [ ] `rg -n "ArtifactRecipe" src apps` → no hits (family deleted).
- [ ] `apps/release-ts/src/runtime/` no longer contains wheel/compile
      staging logic (`ls apps/release-ts/src/runtime/`).
- [ ] Exported signatures of `src/workflows/release.ts` unchanged
      (`git diff f1c90c0..HEAD -- src/workflows/release.ts` shows no export
      removals).
- [ ] LOC total below the Step 1 baseline; both numbers recorded.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Plan 114 is not DONE, or its finalized contract contradicts a step here.
- Preserving `src/workflows/release.ts` export signatures proves impossible
  without keeping both build paths alive — report the conflict instead of
  changing the public workflow surface (that's plan 117's decision).
- The wheel writer cannot express its work as `StageArtifactOperation` +
  `ArtifactStager` without widening the escape hatch into a general task
  runner (SPEC.md non-goal).
- Any verification fails twice after a reasonable fix attempt.
- You need to modify `src/targets/**` beyond import-path fixes.

## Maintenance notes

- After this plan, builds and publishes run on different architectures —
  intentionally short-lived; plan 116 unifies. Do not add features to the
  old target path in the interim.
- The pipeline array file is the one place that knows pipe order; reviewers
  of future pipe PRs should check ordering there and nothing else changes in
  the kernel.
- `evidence-recorder.ts` and `executor.ts` are deliberately untouched here;
  they are reshaped in 116 when operations start carrying pipe provenance.
