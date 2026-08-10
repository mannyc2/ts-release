# Plan 215 — Typed catalog repository delivery

Input-Commit: 6f926aa
Result-Commit: 57ebbe0
Evidence-Commit: SELF
Status: DONE
Outcome: CONDITIONAL-CATALOG-GIT / PREPARED-PAIR
Date: 2026-08-09

## Boundary

Plan 207's Homebrew, Scoop, and generic catalog work remains local deterministic
rendering. Plan 213 captures the rendered file as an exact prepared artifact;
this plan adds only delivery of that file and its canonical managed-state
companion. There is no catalog shell command, caller-owned checkout, PR mode,
force push, or application-workspace Git mutation.

`src/publication/catalog-git.ts` defines one `CatalogFileIntent` with:

- host/owner/repository, branch, contained target path, and contained state path;
- exact prepared target and managed-state artifact ids;
- release version and deterministic commit message.

The adapter accepts an injected repository transport that must return and
verify repository coordinate, branch, and a nonempty current revision. It maps
only both-files-absent to `NeedsMutation`, carries the observed revision into
the write, writes target and state together, and reobserves through Plan 214's
coordinator. Exact bytes skip. Half-present pairs, malformed/unmanaged state,
newer releases, non-active state, wrong origin, and transport failures cannot
become writes. An older active release may be replaced only with its verified
revision precondition. The adapter never constructs a generic fallback
directory or generic Git command.

`CatalogManagedState` and its canonical encoder establish the state record
shape needed by Plan 216's correction/supersession extension. The executable
registry now includes `publish.catalog-git` only beside the vertical adapter
test. Homebrew and Scoop remain content presets; no provider-specific push
pipeline was restored.

## Verification

- `bun test test/publication/catalog-git.test.ts` — PASS: 4 tests, 16
  expectations.
- Required catalog cases pass: exact skip, paired absence write, revision
  precondition, wrong origin, half-present state, newer-state conflict,
  transport refusal, and racing equivalent convergence.
- `bun run check:docs-claims` — PASS: 9 claims across 3 files.
- `bun run check:import-rules` — PASS: 153 files examined.
- `bun run check:portable` — PASS: 211 tests, 888 expectations across 41
  files, plus app/Action checks, build, CLI/Action bundles, schema, examples,
  README, package exports, and all static gates.
- `git diff --check` — PASS.
- All repository behavior was exercised through test transports; no real
  remote, credential, application checkout, package registry, tag, or PR was
  mutated.

## Physical delta

Against the Plan 214 evidence head, this plan adds 191 lines across one typed
catalog adapter, one registry entry/export, and one focused test file. It does
not add a second repository writer or duplicate the npm/GitHub adapter algebra.

## Handoff

Plan 216 may extend `CatalogManagedState` with provider-specific correction or
supersession state. Ordinary publication must continue to treat corrected or
superseded state as conflict and must never resurrect an older prepared
catalog. Plan 217 owns the pre-217 compatibility cut and must delete obsolete
catalog lifecycle rows without reintroducing a generic Git escape hatch.
