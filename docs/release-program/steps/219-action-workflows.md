# Plan 219 — Action and workflow boundary collapse

Input-Commit: 133c927
Result-Commit: a487a63
Evidence-Commit: SELF
Status: DONE
Outcome: FOUR-COMMAND-ACTION / DURABLE-TWO-JOB-RELEASE
Date: 2026-08-09

## Boundary

The Action is a thin Node boundary over the public API. Its exact inputs are
`command`, `config`, `prepared`, and `correction`; its outputs are `status`,
`prepared_path`, and `report_path`. The four commands map one-to-one to
`prepare`, `publish`, `inspect`, and `correct`. Command-specific parsing rejects
invalid combinations before the API call, all user paths are contained in the
workspace, generated reports redact credential-shaped values, and publication
credentials come only from host environment variables.

The automatic repository release is two jobs: uncredentialed preparation,
complete prepared-bundle upload, downloaded-bundle inspection, and one
publication invocation. The reviewed template has the identical handoff and
one GitHub environment on its publish job. The Action owns no review identity,
receipt, run, or lifecycle state.

The repository now owns exactly `.github/workflows/ci.yml` and
`.github/workflows/release.yml`. CI delegates its gate inventory to
`bun run check:portable`, keeps Linux/macOS execution coverage, and runs the
generated agent host check. The old reusable protocol workflow, install lanes
for unconfigured destinations, workflow smoke, root agent integration lane,
and Action mirror tooling were deleted. Consumer templates use only
`__TS_RELEASE_ACTION_REF__`; repository dogfood uses the checked-out relative
Action path.

## Verification

- `bun run check:portable` — PASS.
- `bun test` — PASS: 96 tests, 351 expectations, 31 files.
- `bun run check:action` — PASS: Action typecheck, Node bundle check, 4 focused
  Action tests, 19 expectations.
- `bun run check:action-bundle` — PASS: rebuilt bundle executes its parser under
  Node and exposes 4 commands / 3 outputs.
- `bun run check:examples` — PASS: 8 examples, 6 templates, 2 workflows.
- `bun run check:import-rules` — PASS: 123 files examined.
- `bun run check:tree-shaking` — PASS: 63 files examined.
- `bun run check:package-exports` — PASS.
- `bun run check:config-schema` — PASS.
- `bun run check:self-release-config` — PASS.
- `bun run check:self-release-live` — PASS: automatic prepare/upload/inspect/
  publish topology.
- Claude agent host validator 2.1.219 — PASS through `bun run check:agents`.
- `git diff --check` — PASS before the implementation commit.

The required topology and vocabulary searches are clean: exactly two workflow
files, one `check:portable` invocation in CI, no obsolete Action protocol or
lifecycle hook terms, no standalone Action mirror reference, and no concrete
consumer Action tag in the templates.

## Evidence classes

- `source-derived`: reduced Action metadata, public API wiring, two-job workflow
  topology, permissions, and distribution decision.
- `contract-tested`: Action parser/path/report tests, workflow invariants,
  generated bundle execution, portable gates, and template/example checks.
- `live-read-verified`: none; no workflow dispatch, remote Action ref, release,
  registry, or destination was queried.
- `live-write-dogfooded`: none.

## Physical delta

Commit `a487a63` removes four obsolete workflows, the reusable plan/materialize
workflow, the standalone Action mirror, and unconfigured PyPI/Homebrew smoke
jobs. It reduces the Action from the prior 17-input / 9-output protocol shape
to 4 inputs / 3 outputs and replaces topology-preservation assertions with
authority and handoff tests. The lockfile drops the mirror-only Action artifact,
GitHub, and transitive dependency surface.

## Handoff

Plan 220 may now write product documentation and capability truth against this
automatic public path. It must retain the literal
`__TS_RELEASE_ACTION_REF__` placeholder until Plan 221 binds the exact
candidate version reference, and must not add a third workflow or a second
gate inventory.
