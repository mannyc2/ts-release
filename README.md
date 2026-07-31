# ts-release

`ts-release` turns an in-memory release configuration into canonical,
reviewable plan bytes, then applies only those accepted bytes. It is a Bun
and TypeScript release tool built around explicit authority, staged
publication, and a durable run ledger.

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

## Agent skill/plugin

The repository doubles as a plugin marketplace for one shared `release`
skill that teaches agent hosts to drive ts-release without bypassing its
review gates. The same `ts-release-plugin/` tree carries native manifests
for OpenAI/Codex and Claude Code:

```sh
codex plugin marketplace add mannyc2/ts-release
codex plugin add ts-release@mannyc2-ts-release

claude plugin marketplace add mannyc2/ts-release
claude plugin install ts-release@mannyc2-ts-release
```

Claude Code exposes the skill as `/ts-release:release`. Each tagged release
also ships `ts-release-plugin-{version}.zip` with a checksum as a GitHub
release asset, produced by this repository's own dogfood release plan. The
plugin version always equals the package version; `bun run
check:skill-plugin` fails on any drift.

Public directory submission (OpenAI Plugins Directory, Anthropic's
community marketplace) is a manual operator action documented in
[docs/skill-distribution.md](docs/skill-distribution.md); third-party skill
registries are explicitly out of scope. The skill grants no publication
authority: releases still flow through ts-release's execution and publish
reviews.

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

## Development

```sh
bun install
bun run check
bun test
bun run check:portable
```

Publication operations are treated as plan data during repository
verification. The checks do not dispatch a release.
