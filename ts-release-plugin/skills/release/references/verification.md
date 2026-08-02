# Verification commands

Use these when working inside the ts-release repository itself (fixing a
bug, extending a recipe, or validating this plugin). For a user project,
verification is the project's own test suite plus `ts-release doctor`.

Bun owns package management, scripts, and tests. Run from the repository
root.

| Purpose | Command | Expected success |
|---|---|---|
| Install dependencies | `bun install --frozen-lockfile` | exit 0, lockfile unchanged |
| Typecheck | `bun run check` | `tsc --noEmit` exits 0 with no output |
| Full test suite | `bun test` | `0 fail` |
| Focused archive tests | `bun test test/core/archive-files.test.ts` | all pass |
| Recipe integration tests | `bun test test/core/current-recipes.test.ts` | all pass |
| Driver conformance | `bun test test/core/driver-conformance.test.ts` | all pass |
| Plugin structural contract | `bun run check:skill-plugin` | canonical JSON report with `"status":"ready"` |
| Examples and templates | `bun run check:examples` | report with `"status":"current"` |
| Portable gates (core + app + action) | `bun run check:portable` | exit 0 |
| Release readiness gates | `bun run check:release` | exit 0; dispatches no publication |

Notes:

- `check:release` is a readiness gate; it must never be described or used as
  a publish action.
- If a gate fails, report the exact failing command and its output; do not
  weaken a check, waiver, budget, or fixture to make it pass.
- The self-release configuration lives at
  `apps/release-ts/release.config.json`; `bun run release:plan` plans it
  without executing any operation.
