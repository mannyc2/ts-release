# Plan 117: Expose the 0.1 public TypeScript API and make the CLI and Action thin wrappers over it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.
>
> **Required reading before Step 1**: the finalized 0.1 public API contract
> in `plans/114-pipeline-contract.md` (root exports, the four Promise
> functions, summary types, CLI mapping, `render` dissolution). If plans
> 114-116 are not all DONE in `plans/README.md`, STOP.
>
> **Drift check (run first)**:
>
> ```sh
> git diff --stat f1c90c0..HEAD -- src/index.ts package.json apps/release-ts/src apps/ts-release-action/src src/workflows
> ```
>
> Plans 115/116 changed `src/workflows` internals and app runtime modules;
> that is expected. If `src/index.ts` or the CLI command list already changed,
> compare "Current state" excerpts; meaningful mismatch → STOP.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED (public-surface change; ships as 0.1.0)
- **Depends on**: 114, 115, 116
- **Category**: dx / direction
- **Planned at**: commit `f1c90c0`, 2026-07-03

## Why this matters

The maintainer's 0.1 requirement: **a TypeScript API, and a CLI that wraps
that API**. Today the root export is config-authoring only (`defineRelease`,
types, JSON-schema helpers) — there is no programmatic way to plan, build,
or release from TypeScript; the engine is reachable only through the CLI and
Action. After 115/116 the engine is a clean pipeline; this plan promotes it
behind a small Promise-based public API and rebuilds the CLI and GitHub
Action as thin adapters over exactly that API. This is also where the
`render` command dissolves into the pipeline, completing the plan-112
contract cleanup.

## Current state

(Verified at `f1c90c0`; 115/116 changed engine internals but the public
surface below is theirs to preserve, so these excerpts should still hold.)

- `src/index.ts` (32 lines) — entire public API:

  ```ts
  // src/index.ts:3-9,30-31
  export { RELEASE_CONFIG_SCHEMA_ID, releaseConfigJsonSchemaDocument as releaseConfigJsonSchema,
    renderReleaseConfigJsonSchema } from "./config/schema.js"
  export type { ReleaseConfig } from "./config/schema.js"
  // ...ReleasePlanSummary interfaces (lines 11-28)...
  export const defineRelease = <const Config extends ReleaseConfig>(config: Config): Config => config
  ```

- `package.json` — exports: root only; `bin.ts-release` →
  `./apps/release-ts/src/cli/main.ts`. Export policy enforced by
  `bun run check:package-exports` and `bun run check:tree-shaking`.
- CLI (`apps/release-ts/src/cli/command.ts`, 284-302): 7 subcommands —
  `plan`, `build`, `init`, `doctor`, `verify`, `render`, `release` — each
  calling `src/workflows/release.ts` functions directly with Effect layers
  provided by `apps/release-ts/src/runtime/`.
- Action (`apps/ts-release-action/src/`, 766 lines): commands
  `plan | doctor | build | release | verify`, own input parsing +
  step-summary/output adapters, same workflow calls, Node runtime.
- The engine functions are Effect-typed (`Effect.fn` returning
  `Effect.Effect<...>`); Effect is 4.0.0-beta.83 — beta types must NOT leak
  into the public API (the 114 contract's binding decision).
- Approval semantics to preserve exactly: `release` is non-publishing by
  default; `--execute` allows externally-visible operations;
  `--approve-publish` allows irreversible ones. In the API these become
  `{ execute?: boolean; approvePublish?: boolean }` defaulting to false.
- `package.json` scripts `release:catalogs` uses `cli render ... --execute`
  — must be migrated when `render` dissolves (catalog rendering runs inside
  `build`/`release` per the 114 contract; `.github/workflows/release.yml`
  calls `bun run release:catalogs` — keep the script name working by
  re-pointing it, do not edit the workflow YAML).

Conventions: same binding list as plans 115/116. Public API additions must
keep `check:package-exports`, `check:tree-shaking`, and `check:readme`
green.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bun run check` | exit 0 |
| Tests | `bun test` | 0 fail |
| Export policy | `bun run check:package-exports && bun run check:tree-shaking` | exit 0 |
| Full gate | `bun run check:portable` | exit 0 |
| Self-release gate | `bun run check:release` | exit 0 |
| LOC measure | `find src apps/release-ts/src apps/ts-release-action/src -name '*.ts' \| xargs wc -l \| tail -1` | record |

## Scope

**In scope**:

- `src/index.ts` + a new `src/api/` module implementing the four public
  functions per the 114 contract: `plan()`, `build()`, `release()`,
  `verify()` — Promise-based, accepting `config` as a path or an inline
  `ReleaseConfig` value, running the Effect engine internally with a
  self-contained runtime layer, returning the stable summary types
  (`ReleasePlanSummary` extended; new `BuildSummary`, `ReleaseSummary`,
  `VerifySummary`).
- Rebuild `apps/release-ts/src/cli/` as: flag parsing → the four API
  functions (+ `init`/`doctor` workflow calls per the contract) →
  formatting. Delete the `render` subcommand; re-point `release:catalogs`.
- Rebuild `apps/ts-release-action/src/` command dispatch onto the same API;
  rebuild the action bundle (`bun run --cwd apps/ts-release-action build`)
  and keep `check:action-bundle` green.
- README + `templates/` + `examples/` updates for the new API and any config
  changes from 116; version bump to `0.1.0` in the three `package.json`
  files as the final step.
- Tests for the public API.

**Out of scope**:

- Engine/pipeline internals (only additive plumbing for summaries).
- `ts-release.config.ts` loading (still deferred — JSON + inline TS values
  only; the API taking an inline `defineRelease` value covers the TS
  authoring story for 0.1).
- New CLI verbs beyond the contract; publish execution of 0.1.0 (operator
  dispatch, as with plan 113).
- `scripts/` beyond what `check:*` gates force; `.repos/effect`, `vendor/`.

## Git workflow

- Branch: `codex/117-public-api-thin-cli`.
- Commit per step; imperative sentence case (e.g. `Expose plan/build/release
  /verify public API`).
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Implement the API module

`src/api/` per the 114 contract: the four functions, `RunOptions`
(`config?: string | ReleaseConfig`, `workspace?: string`, `snapshot?:
boolean` — snapshot maps to the plan-116 engine capability: marked fake
version, publish refused regardless of approvals),
`ReleaseRunOptions` (`execute?`, `approvePublish?`, both default false).
Each function assembles the internal runtime layer (BunServices for the
library default — check how `apps/release-ts/src/runtime/` does it and hoist
what is host-neutral) and runs the pipeline/engine. Projection rule (114
D19, binding): the engine's Effect-typed entry points must natively
return the public summary types with tagged errors — `src/api/` adds
runtime assembly, `runPromise`, and error collapse ONLY, never result
mapping. If you find yourself writing a summary-mapping layer in `api/`,
fix the engine signature instead; this is what keeps a future
Effect-native `/effect` subpath a zero-redesign additive export. Use `ManagedRuntime.make(layer)` for the Promise boundary — verified
in the installed beta.83 package (`node_modules/effect/src/ManagedRuntime.ts:273-278`;
see `plans/research/effect-v4-api-probe.md`); construct it lazily and share
it across calls within one options scope so repeated API calls do not
rebuild layers (layer context is cached per runtime; use a shared
`memoMap` only if multiple runtimes are ever needed). Decide and test the
**disposal story**: `runtime.dispose()` must be called to release layer
resources — recommended: one lazily-created runtime per API-call scope,
disposed in a `finally`, OR a process-wide singleton with disposal on exit;
pick one, document it, and assert no resource leak in `test/api.test.ts`
(repeated `plan()` calls do not accumulate). Errors surface as a single typed `ReleaseApiError` (message + phase +
cause chain), never raw Effect failures.

**Verify**: `bun run check` → exit 0; new `test/api.test.ts` — `plan()` with
an inline `defineRelease` value (no file) returns a summary with the
expected targets; `release()` without flags plans but executes nothing
(assert via fake host layers — model on existing executor tests).

### Step 2: Export and enforce

Add the four functions + summary types to `src/index.ts`. Update the export
policy scripts' expectations if they pin the export list.

**Verify**: `bun run check:package-exports && bun run check:tree-shaking` →
exit 0.

### Step 3: Thin the CLI

Rewrite command handlers to parse flags → call the API → format. Add
`--snapshot` to `plan`, `build`, and `release` (mapping to
`RunOptions.snapshot`; the Action gains a matching `snapshot` input in Step
4). Delete `render`; re-point the `release:catalogs` script at the
equivalent API-level invocation so `.github/workflows/release.yml`
continues to work unchanged.
The CLI must contain no engine logic — grep discipline:
`rg -n "pipeline|Pipe|executor" apps/release-ts/src/cli` → no hits.

DX guard (from the 2026-07-03 plan-first assessment): `release` without
`--execute` must end its output with one unmissable line stating that this
was a plan-only run and exactly what flag performs it (e.g. "Planned N
operations; nothing was executed. Re-run with --execute to perform them.")
— GoReleaser migrants expect `release` to publish, and silence reads as
breakage.

Plan rendering also implements the 114 host-vs-publish decision: group
operations by risk grade and include an explicit divider before irreversible
operations ("everything above this line can still be undone"). This is a
formatter responsibility, not a new engine phase.

**Verify**: `bun run check:app` → exit 0; `bun test test/cli-command.test.ts`
→ pass (update tests for `render` removal, and assert the plan-only closing
line is present without `--execute` and absent with it);
`bun run cli release --config apps/release-ts/release.config.json --format text`
→ plans without executing.

### Step 4: Thin the Action and rebuild the bundle

Same treatment for `apps/ts-release-action/src/`; rebuild the bundle.

**Verify**: `bun run check:action` → exit 0.

### Step 5: Docs, templates, version, final gates

Update README (API examples first, CLI second — the API is the product
now), `templates/`, `examples/`. README positioning follows the
evidence-ranked wedge from `plans/research/120A-goreleaser-sentiment.md`
(as encoded in plan 114 Step 3): tagline "GoReleaser-grade distribution
for TypeScript/Bun CLI authors, with typed config and a reviewable publish
plan" (adopted from 120B); lead with the rehearsal/plan-first story
(review the full release plan, snapshot-rehearse, approve explicitly —
the thing GoReleaser users are told to use throwaway repos for), then
no-Pro-boundary/single-open-binary + evidence artifacts, then typed DRY
config (imports/presets instead of Pro-gated includes); npm/PyPI-free
appears as a supporting comparison point, not the headline. Include the
semantic-release objection answer (one short README paragraph: what
semantic-release is for, what this is for, and that they meet at a future
conventional-commits version source). Bump the three
`package.json` versions to `0.1.0`. Run everything.

**Verify**: `bun run check:release` → exit 0; LOC measured and recorded
(expect apps/release-ts/src + apps/ts-release-action/src ≤ ~1.2k combined
per the 114 budget).

## Test plan

- `test/api.test.ts` — inline config, file config, no-execute default,
  execute+approve gating via fake hosts, error mapping. Model runtime/layer
  handling on `test/cli-command.test.ts`.
- Existing CLI/action tests updated for `render` removal; assertion strength
  preserved elsewhere.

## Done criteria

- [ ] `import { plan, build, release, verify, defineRelease } from
      "@mannyc1/ts-release"` typechecks in `test/api.test.ts` and all four
      run against the dogfood config via fake hosts.
- [ ] `release()` with no options executes nothing (test-proven).
- [ ] `rg -n "pipeline|Pipe|executor" apps/release-ts/src/cli
      apps/ts-release-action/src` → no hits.
- [ ] `render` gone from CLI and tests; `bun run release:catalogs` still
      works; `.github/workflows/release.yml` untouched.
- [ ] `bun run check:portable` and `bun run check:release` exit 0.
- [ ] Versions read `0.1.0`; LOC recorded.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Plans 114-116 are not all DONE.
- The Promise API cannot avoid leaking Effect types without duplicating
  summary mapping in both CLI and API — report; do not export Effect types.
- Re-pointing `release:catalogs` would require editing
  `.github/workflows/release.yml` — the release pipeline is out of scope;
  report the conflict.
- `check:package-exports` / `check:tree-shaking` cannot pass with the new
  exports without policy-script changes bigger than updating an expected
  list.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The four summary types are now the compatibility contract — additive
  evolution only; a field removal is a breaking release.
- 0.1.0 publishing is a separate operator-approved dispatch (same runbook as
  plan 113); nothing here publishes.
- The deferred items remain deferred deliberately: `ts-release.config.ts`
  file loading, and the Effect-native public API — per 114 D19 the latter
  is a future `@mannyc1/ts-release/effect` subpath exporting the SAME
  engine entry points (trigger: Effect 4 stable + a concrete external
  Effect consumer); the projection rule in Step 1 is what keeps that
  additive.
