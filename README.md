# ts-release

`ts-release` turns an in-memory release configuration into canonical,
reviewable plan bytes, then applies only those accepted bytes. It is a Bun
and TypeScript release tool built around explicit authority, staged
publication, and a durable run ledger.

Full in-scope outcome parity for TypeScript/Bun distribution against the
pinned GoReleaser v2.17.0 ledger: 107/107 customization rows and 33/33 Pro
rows, excluding C005, C008, C017, C023, C028, C047, C050, C051, P029, P035,
and P036.

That claim is scoped to the frozen outcome ledger. It does not claim parity
for Go-specific toolchains, deprecated implementation mechanics, or vendor
licensing behavior.

## Install

```sh
bun add -d @mannyc1/ts-release
```

The supported runtime is Bun 1.3.14 or newer.

## Configuration

Core configuration is a JSON-compatible value, never a file path or encoded
document. The CLI and GitHub Action own JSON loading and pass the parsed value
to the library once.

```json
{
  "project": {
    "name": "@scope/example",
    "version": "1.2.3",
    "tag": "v1.2.3",
    "commit": "abc123"
  },
  "artifacts": [
    {
      "id": "cli",
      "path": "dist/example",
      "format": "executable"
    }
  ],
  "publish": {}
}
```

Every public fixture contains the complete fields required by its package or
provider surface. Homebrew and Scoop lowering use product-owned immutable
presets; applications cannot register or replace profiles.

## Promise API

```ts
import {
  apply,
  plan,
  reviewExecution,
  type PlanId
} from "@mannyc1/ts-release"

const config = {
  project: {
    name: "@scope/example",
    version: "1.2.3",
    tag: "v1.2.3",
    commit: "abc123"
  },
  artifacts: [
    { id: "cli", path: "dist/example", format: "executable" }
  ],
  publish: {}
}

const planned = await plan({
  config,
  workspace: "/absolute/real/workspace"
})

const review = await reviewExecution({
  planBytes: planned.bytes,
  expectedPlanId: planned.planId,
  scope: "all"
})

const materialized = await apply({
  planBytes: planned.bytes,
  expectedPlanId: planned.planId,
  workspace: "/absolute/real/workspace",
  through: "validate",
  newRun: {
    path: ".release/run.json",
    scope: "all",
    executionReviewId: review.executionReviewId,
    reviewer: "release-team"
  }
})

if (materialized.nextPublishReviewId !== undefined) {
  await apply({
    planBytes: planned.bytes,
    expectedPlanId: planned.planId as PlanId,
    workspace: "/absolute/real/workspace",
    through: "verify",
    resumeRunPath: ".release/run.json",
    publishConfirmation: {
      publishReviewId: materialized.nextPublishReviewId,
      reviewer: "release-team"
    }
  })
}
```

`plan` rejects strings, `configPath`, non-JSON values, excess configuration
fields, and empty or relative workspaces. Existing absolute workspaces are
realpath-normalized, so a symlink spelling and its canonical spelling produce
the same plan identity. Workspace paths never enter plan bytes.

`apply` has no configuration input and never replans. It accepts canonical
`release-plan/v6` bytes plus the expected `PlanId`, then verifies the plan,
scope, topology, ledger, operation hashes, materialized bytes, and receipts
before exercising a driver.

Use `makeReleaseApi(layer)` when a test or alternate host needs explicit
services. The default functions are bound to one immutable live layer.

## CLI

The installed CLI has exactly four commands:

```text
ts-release init
ts-release doctor
ts-release plan
ts-release apply
```

The canonical staged flow is:

```sh
ts-release plan \
  --config release.config.json \
  --out release-plan.json

ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --review-only \
  --scope all

ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --through validate \
  --new-run .release/run.json \
  --scope all \
  --confirm-execution EXECUTION_REVIEW_ID \
  --reviewer release-team

ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --through verify \
  --resume .release/run.json \
  --confirm-publish PUBLISH_REVIEW_ID \
  --reviewer release-team
```

`doctor` consumes a plan file and `--plan-id`; it performs read-only review
and does not load configuration or publish. `apply --review-only` also
derives the immutable execution challenge without minting authority.

The CLI reads its JSON configuration exactly once. A relative config path
uses the current working directory as the workspace, an absolute config path
uses its containing directory, and `--root` overrides both. The selected
workspace must exist and is normalized with `realpath`.

## GitHub Action

```yaml
- id: plan
  uses: mannyc2/ts-release/apps/ts-release-action@main
  with:
    command: plan
    config: release.config.json
    plan-path: .release/release-plan.json

- id: review
  uses: mannyc2/ts-release/apps/ts-release-action@main
  with:
    command: apply
    review-only: "true"
    plan-path: .release/release-plan.json
    plan-id: ${{ steps.plan.outputs.plan_id }}
    scope: all
```

Action commands are `plan`, `apply`, and `doctor`. Configuration and output
paths must remain inside the realpath-normalized `GITHUB_WORKSPACE`. The
Action exposes plan, review, receipt, run, status, and evidence outputs named
in `action.yml`; it never plans during `apply`.

## Durable documents and approvals

There are two durable documents:

- `release-plan/v6` is canonical immutable intent. `PlanId` is derived from
  its exact accepted bytes.
- `run-ledger/v1` records immutable scope, operation hashes, monotonic
  frontier, attempts, receipts, materialized-output snapshots, and recovery
  decisions.

Evidence is a derived projection of the ledger, not a third authority source.
An execution review challenge is deterministic for a plan, scope, and
topology, but it is not permission. Starting a run mints a nonce- and
run-bound execution receipt. Publication requires a second review after local
outputs and remote facts have been observed; confirmation mints a
run-bound publish receipt.

Unknown publication outcomes stop for reconciliation or an explicit
operator resolution with operation id, identity, reason, and timestamp.

## Certification

The repository proves five technical properties: review equals execution,
invalid plans stop before capabilities, authority is structural, uncertainty
is durable and replay-safe, and staged split/merge execution remains bound to
one plan and content inventory. The final fault matrix covers 45/45 cells and
11/11 structural controls with zero credential leaks or duplicate mutations.

| Certified state | Product semantic lines | Oracle semantic lines |
|---|---:|---:|
| M6 / Plan 177 | 4,322 | 4,374 |
| PARITY / Plan 184 readiness | 5,871 | 6,045 |

Product source remains below the 8,031-line opening implementation while
covering the complete in-scope parity surface.

## Migration

| Removed surface | v6 replacement |
|---|---|
| `build` API/command | Review a scope and `apply --through process` |
| `plan` from a config path | Load once in the CLI/Action, then call value-only `plan` |
| `release` API/command | Full-scope staged `apply` through validate, review, then verify |
| `verify` API/command | Resume the same ledger with `apply --through verify` |
| Mutable runtime configuration | `makeReleaseApi(layer)` or the immutable default API |
| `release-plan/v5` | Canonical `release-plan/v6`; there is no fallback reader |
| `release-evidence/v3` | Durable `run-ledger/v1` plus a derived evidence projection |

This is a hard cut. Old verbs, readers, aliases, mutable registries, and
translation DTOs are intentionally absent.

## Development

```sh
bun install
bun run check
bun test
bun run check:portable
```

Publication operations are treated as plan data during repository
verification. The checks and rewrite certification do not dispatch a release.
