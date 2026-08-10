# Scripts

Scripts in this directory are maintained release tooling, not a scratchpad.
Use Bun for script entrypoints, keep reusable work in `Effect.fn`, and provide
runtime layers only at the script boundary. Scripts may import app-owned runtime
layers when they are dogfooding the official CLI/runtime, but shared
distribution logic belongs in `src/`.

## Durable Gates

Every `check:*` script in the root `package.json`, and where it runs.

Composites:

- `check:portable` = `check:core` + `check:agents` + `check:app` + `check:action`. What CI runs.
- `check:core` = `check:versions`, `check:import-rules`, `check:tree-shaking`,
  `check` (tsc), `bun test`, `build`, `check:examples`, `check:readme`,
  `check:package-exports` — cheap policy gates first, so a violation fails in
  seconds rather than after a build.
- `check:app` / `check:action` typecheck each shipped surface and run its
  cutover suite; `check:action` also runs `check:action-bundle`.
- `check:release` = the four `check:self-release-*` gates + `check:portable`.
  Runs before a tag.
- `check:summary` runs every gate without stopping at the first failure and
  prints a pass/fail/seconds table.

Individual gates:

- `check` — `tsc --noEmit` over the root project.
- `check:versions` — one version per pinned thing: packageManager, engines,
  workflow pins, README, and the Effect version agreement across manifests.
- `check:import-rules` (`check-import-rules.ts`) — enforces the source import
  layering rules.
- `check:tree-shaking` (`check-tree-shaking.ts`) — checks public export graphs
  against the shared public API policy.
- `check:package-exports` (`check-package-exports.ts`) — validates package
  exports, declarations, side effects, consumer type resolution, and that
  SPEC section 13 names exactly the root runtime exports.
- `check:examples` (`check-examples.ts`) — verifies every example can produce a
  text release plan through Effect Platform path/filesystem services,
  trusted-publishing npm examples/templates keep provenance and
  package-exists verification enabled, and every template stays
  schema/checker compatible.
- `check:readme` (`check-readme.ts`) — validates README fenced snippets and
  package import subpaths.
- `check:action-bundle` (`check-action-bundle.ts`) — verifies the tracked
  GitHub Action bundle matches a fresh temporary build and runs under Node.
- `check:agents` — typechecks the single agent-distribution app, builds its
  provider-native layouts and archives, and runs its contract checks.
- `check:self-release-config` / `check:self-release-doctor` /
  `check:self-release-live` / `check:self-release-artifacts` — the offline
  dogfood gates, app-owned under `apps/release-ts/scripts/`.

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
