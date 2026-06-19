# Scripts

Scripts in this directory are maintained release tooling, not a scratchpad.
Use Bun for script entrypoints, keep reusable work in `Effect.fn`, and provide
runtime layers only at the script boundary. Scripts may import app-owned runtime
layers when they are dogfooding the official CLI/runtime, but generic release
logic belongs in `src/`.

## Durable Gates

- `clean-dist.ts` removes the build output through Effect Platform path and filesystem services.
- `check-effect-imports.ts` rejects broad root `effect` imports.
- `check-tree-shaking.ts` checks public export graphs against the shared public API policy.
- `check-package-exports.ts` validates package exports, declarations, side effects, and consumer type resolution.
- `check-examples.ts` verifies every example can produce a text release plan, trusted-publishing npm examples/templates keep provenance and package-exists verification enabled, and every template stays schema/checker compatible.
- `check-readme.ts` validates README fenced snippets and package import subpaths.
- `check-action-bundle.ts` verifies the tracked GitHub Action bundle matches a fresh temporary build.

Self-release dogfood scripts are app-owned under `apps/release-ts/scripts/`.
Root package scripts delegate to those app scripts for release eligibility,
self-release config checks, and release artifact preparation.

## Internal Helpers

- `lib/public-api-policy.ts` contains the public API and tree-shaking policy shared by export checks. Keep it aligned with `ARCHITECTURE.md` when adding workflow or lower-level library subpaths.
- `lib/scratch-workspace.ts` contains guarded scratch directory helpers.

## Temporary Work

Temporary scripts should not be committed here unless they have:

- a package command or documented owner,
- a deletion condition,
- and either focused tests or a clear reason they are intentionally manual.
