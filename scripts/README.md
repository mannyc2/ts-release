# Scripts

Scripts in this directory are maintained release tooling, not a scratchpad.
Use Bun for script entrypoints, keep reusable work in `Effect.fn`, and provide
runtime layers only at the script boundary. Scripts may import app-owned runtime
layers when they are dogfooding the official CLI/runtime, but shared
distribution logic belongs in `src/`.

## Durable Gates

- `check-import-rules.ts` enforces the source import layering rules.
- `check-tree-shaking.ts` checks public export graphs against the shared public API policy.
- `check-package-exports.ts` validates package exports, declarations, side effects, and consumer type resolution.
- `check-examples.ts` verifies every example can produce a text release plan through Effect Platform path/filesystem services, trusted-publishing npm examples/templates keep provenance and package-exists verification enabled, and every template stays schema/checker compatible.
- `check-readme.ts` validates README fenced snippets and package import subpaths.
- `check-action-bundle.ts` verifies the tracked GitHub Action bundle matches a fresh temporary build through Effect Platform temporary-directory, filesystem, path, and child-process services.

Self-release dogfood policy checks are app-owned under `apps/release-ts/scripts/`.
Root package scripts delegate there for self-release config checks. Release
artifact staging goes through the official CLI workflow so build-system-specific
work stays in artifact recipe adapters at the app runtime boundary.

## Internal Helpers

- `lib/public-api-policy.ts` contains the public API and tree-shaking policy shared by export checks. Keep it aligned with `ARCHITECTURE.md` when adding workflow or lower-level library subpaths.
- `lib/scratch-workspace.ts` contains guarded scratch directory helpers.

## Temporary Work

Temporary scripts should not be committed here unless they have:

- a package command or documented owner,
- a deletion condition,
- and either focused tests or a clear reason they are intentionally manual.

## Watch mode

There is no bespoke watcher: use `bun test --watch` for tests and
`bunx tsc --noEmit --watch` for types. `bun run check:summary` runs every
`check:portable` gate sequentially and prints one pass/fail/seconds table
instead of stopping at the first failure.
