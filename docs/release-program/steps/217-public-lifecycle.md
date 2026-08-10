# Plan 217 — Automatic public lifecycle cut

Input-Commit: ea88e76
Result-Commit: 7613f3b
Evidence-Commit: SELF
Status: DONE
Outcome: AUTOMATIC-RELEASE / PREPARED-BUNDLE-BOUNDARY
Date: 2026-08-09

## Boundary

The public product now has one lifecycle vocabulary. The root exports
`inspect`, `prepare`, `publish`, `release`, `correct`, and `makeReleaseApi`;
the constructed API adds only `dispose`. `release` is the automatic default.
`publish` accepts only an exact prepared bundle, and `correct` accepts one
canonical provider-specific correction intent bound to that bundle.

The CLI commands are exactly `init`, `inspect`, `prepare`, `publish`, `release`,
and `correct`. The Action invokes one `release` operation and emits only the
prepared bundle path and status. Host review remains optional policy outside the
engine; no review service, approval identity, run ledger, compatibility alias,
generic hook, or config-at-publication fallback remains.

The old plan/apply/review model, operation/result surface, approval and ledger
modules, obsolete recipe projections, and compatibility tests were deleted.
The retained graph and preparation primitives remain native to this product.
The platform layer composes source observation, process execution, HTTP, and
catalog transport once per host. A live catalog transport remains explicit and
unsupported until its host supplies one.

## Verification

- `bun run check` — PASS.
- `bun test` — PASS: 90 tests, 311 expectations, 30 files.
- `bun run check:import-rules` — PASS: 125 files examined.
- `bun run check:tree-shaking` — PASS: 63 files examined.
- `bun run check:config-schema` — PASS: generated schema matches AuthoredConfig.
- `bun run check:examples` — PASS: 9 examples, 6 templates, 1 current workflow.
- `bun run check:readme` — PASS: 4 fenced blocks and 2 package imports.
- `bun run check:package-exports` — PASS: root and host export surfaces match
  the specification.
- `bun run check:cli-bundle` — PASS: Node bundle contains no Bun runtime and
  exposes all six commands.
- `bun run check:action-bundle` — PASS: Action bundle exposes one release
  command and two outputs.
- `bun run --cwd apps/release-ts check` — PASS.
- `bun run --cwd apps/ts-release-action check` — PASS.
- `bun run check:self-release-config` — PASS.
- `bun run check:self-release-live` — PASS.
- `git diff --check` — PASS before the implementation commit.

The required lifecycle tests are present at `test/api.test.ts`,
`test/core/public-api.test.ts`, `test/core/public-surface.test.ts`,
`test/core/cli-cutover.test.ts`, `test/core/release-command.test.ts`,
`test/core/correct-command.test.ts`, `test/cli-command.test.ts`, and
`test/core/init.test.ts`. Action cutover tests additionally prove one API call
and the reduced manifest surface.

## Evidence classes

- `source-derived`: root, API, CLI, Action, workflow, and module-surface cut.
- `contract-tested`: lifecycle, prepared-store, native preparation, provider
  observation, correction, import-rule, tree-shaking, schema, and bundle gates.
- `live-read-verified`: none; the release checks intentionally use no remote
  registry, GitHub, catalog repository, credential, tag, push, or workflow
  dispatch.
- `live-write-dogfooded`: none.

## Physical delta

The hard cut is committed in `7613f3b`. It removes the pre-cut lifecycle and
durable authority modules, simplifies the host/runtime and app surfaces,
refreshes current docs/workflow/schema checks, and adds the exact public and
Action certification tests. No external mutation occurred.

## Handoff

Plan 218 may audit and reduce the agent/plugin distribution surface against
this root API. It must treat this handoff and the committed six-command
surface as authoritative; it must not reintroduce a compatibility protocol or
make distribution artifacts a second release authority.
