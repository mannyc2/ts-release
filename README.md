# ts-release

Release a TypeScript or Bun project to npm, GitHub Releases, Homebrew, Scoop,
and PyPI with one command — and get a durable record of what happened.

```sh
ts-release ship --from-git
```

What you get for that:

- **A release that resumes.** Every run writes a ledger. If publishing dies
  after npm and before the GitHub release, the next run continues from there
  instead of starting over.
- **Approvals that mean something.** What executes is the exact plan that was
  reviewed, byte for byte. Approving names a `PlanId`, and the receipt in the
  ledger says who approved it.
- **Honest records when nobody reviewed.** Releasing unreviewed is fine and
  common — the ledger just says so, so you can tell the two apart forever.
- **A CI pipeline you do not write.** Ten lines call a reusable workflow that
  stages plan, materialize, and publish behind your environment's approval
  rules.

### Is this GoReleaser for TypeScript?

Not quite, in both directions. ts-release compiles your configuration into a
reviewable plan and executes only those bytes, with a durable ledger for
partial failures; its target matrix is smaller. If you release Go projects, use
GoReleaser. The per-axis answer, with every row machine-checked against this
repository's code, is in [docs/comparison.md](docs/comparison.md).

## Install

```sh
bun add -d @mannyc1/ts-release
```

```sh
npm i -D @mannyc1/ts-release
```

`effect`, `@effect/platform-node`, and `@effect/platform-bun` are peer
dependencies; npm 7+ and bun install them for you. The published executable is
a Node bundle, so `npx ts-release` works without Bun. Hosts are Linux and
Linux and macOS. Its Bun builder can produce Windows artifacts; native Windows
execution is not supported.

## Quickstart

```sh
ts-release init --template npm-only --write
ts-release ship --from-git
```

`init` writes a configuration from a template. `ship` plans it, prints the
review surface, confirms it itself, and applies through verification — one
process, one command.

When you want an independent approver, split the same release into the staged
commands (see [CLI](#cli)) or call the composed workflow in CI (see
[GitHub Action](#github-action)). Same configuration, same plan file, same run
ledger; nothing to migrate.

## Approvals and who approved

Every run records an approver identity in its ledger receipts, and the identity
tells you what kind of run it was:

- `self:one-shot` — one process planned, confirmed, and applied. Nobody
  independent looked.
- `self:one-shot@github:<actor>` — the same, in CI, where the environment had
  no protection rules. The workflow probes for them rather than assuming.
- `environment:<name>@github:<actor>` — a protected environment gated the run,
  and this actor approved it.
- Any other string — a staged release, where whoever ran `apply` named
  themselves.

The carrier is the run ledger's approval receipts. Your run ledgers therefore
prove which of your releases had an independent reviewer, long after everyone
has forgotten.

## When a release stops halfway

A stopped run resumes; it does not restart. A publication whose outcome is
genuinely unknown stops the run and stays unknown until a person observes the
remote (`--reconcile`), judges it (`--resolutions`), or re-attempts something
proven absent (`--retry`). Nothing recovers automatically, in CI or one-shot
mode, because every one of those is a judgment about the outside world.

The full map from state to command is in
[docs/recovery.md](docs/recovery.md).

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

That value is what the library plans. What you WRITE can be terser: state a
repository once and let the release facts be observed.

```json
{
  "project": {
    "name": "@scope/example"
  },
  "versionFrom": "manifest",
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

```sh
ts-release ship --config release.config.json --from-git
```

`--from-git` observes the HEAD commit, the single release-shaped tag at HEAD,
and the package manifest's name and version, then resolves them into the
canonical configuration above — writing it to `.release/resolved.config.json`
for review. The GitHub Action does the same with `resolve: github`.

Resolution never picks a side. A value you stated and a value the repository
reports are either equal or a refusal naming both; a version that cannot be
observed is a refusal naming how to state it; two release-shaped tags at HEAD
are an ambiguity, not a coin flip. Without `--from-git` nothing is observed at
all, and a config carrying `versionFrom` or `project.tagTemplate` is refused by
the core — those are authoring directives, and the canonical world has never
heard of them.

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
    path: ".release/runs",
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
    resumeRunPath: ".release/runs",
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

`plan`, `reviewExecution`, and `apply` are bound to one immutable live layer
that closes the host capabilities with `@effect/platform-node`, which is
correct under both Node and Bun. A host that wants its own platform, or a
test that wants its own services, composes the api instead:

```ts
import { makeReleaseApi } from "@mannyc1/ts-release"
import { BunReleaseLayer } from "@mannyc1/ts-release/bun"

const release = makeReleaseApi(BunReleaseLayer)
const config = {
  project: { name: "@scope/example", version: "1.2.3", tag: "v1.2.3", commit: "abc123" }
}
const planned = await release.plan({
  config,
  workspace: "/absolute/real/workspace"
})
await release.dispose()
```

`@mannyc1/ts-release/node` exports `NodeReleaseLayer` for the same purpose;
importing the package root never loads a Bun module. For fully custom
services the package also exports the five service tags (`RunStore`,
`WorkspaceStore`, `CredentialStore`, `DriverCatalog`, `ApprovalSigner`) with
their shapes, the permit classes an `ApprovalSigner` returns, and
`ReleaseServicesLive`, the platform-generic live layer that still requires a
`ChildProcessSpawner` and an `HttpClient`.

## CLI

The installed CLI has exactly five commands:

```text
ts-release init
ts-release doctor
ts-release plan
ts-release apply
ts-release ship
```

One command releases everything a config describes:

```sh
ts-release ship --config release.config.json
```

`ship` plans, prints the review surface, confirms it itself, and applies
through verify in one process. Because nobody independent approved, both
approval receipts in the run ledger record the reviewer `self:one-shot`. When
you want an independent approver between materialize and publish, split into
the staged commands below — same plan file, same run ledger, no migration.

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
  --new-run .release/runs \
  --scope all \
  --confirm-execution EXECUTION_REVIEW_ID \
  --reviewer release-team

ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --through verify \
  --resume .release/runs \
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

The whole staged pipeline, in a workflow you do not have to write:

```yaml
name: Release
on:
  workflow_dispatch: {}
permissions:
  contents: read
jobs:
  release:
    uses: mannyc2/ts-release/.github/workflows/release.yml@__TS_RELEASE_ACTION_REF__
    with:
      config: release.config.json
      environment: release
      bun-version: "1.3.14"
      setup: bun install --frozen-lockfile
    secrets: inherit
```

Three jobs run: `plan` compiles and reviews with no gate, then `materialize`
and `publish` sit behind the environment you named. The plan id and the review
challenges thread between them, and the plan a human approves is byte-identical
to the plan that is applied.

Protect that environment in Settings → Environments to require an approval
between the stages. Leave it unprotected and the same pipeline runs one-shot —
which is a legitimate way to run it, and the durable receipts say so: the
reviewer is probed from the environment's real protection rules, recording
`environment:...` when they exist and `self:one-shot@...` when they do not.

Composing it yourself is still first-class — this is what the reusable workflow
does on your behalf:

```yaml
- id: plan
  uses: mannyc2/ts-release/apps/ts-release-action@__TS_RELEASE_ACTION_REF__
  with:
    command: plan
    config: release.config.json
    plan-path: .release/release-plan.json

- id: review
  uses: mannyc2/ts-release/apps/ts-release-action@__TS_RELEASE_ACTION_REF__
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

## Releasing this repository

The operator procedure — preconditions, what to read in the plan artifact
before approving each environment, the mirror push, and the smoke checks — is
[docs/release-runbook.md](docs/release-runbook.md).

## Development

```sh
bun install
bun run check
bun test
bun run check:portable
```

`check:action` needs a `node` binary of version 20 or newer on `PATH`: it
builds the Action bundle and then executes it under the runtime the Action
actually uses (`node20`) against a fixture release. The gate fails loudly
when `node` is absent rather than skipping, because a skipped run is exactly
how a Bun-only call reached the Node host once before.

Publication operations are treated as plan data during repository
verification. The checks do not dispatch a release.
