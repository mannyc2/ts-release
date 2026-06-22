# release

`@mannyc1/ts-release` turns release intent into explicit, inspectable, repeatable publishing operations.

The root package is the reusable TypeScript release library. The official Bun
CLI app lives in `apps/release-ts`, and the root `cli` script delegates to that
private first-party app.

The default workflow is plan-first:

```sh
bun run cli validate-config --config release.config.json
bun run cli plan --config release.config.json --format text
bun run cli run --config release.config.json --execute --approve-irreversible
```

On GitHub Actions, the primary CI integration is the JavaScript action:

```yaml
- uses: mannyc2/ts-release-action@v1
  with:
    command: plan
    config: release.config.json
    format: markdown
```

The action calls the TypeScript workflow APIs directly and keeps target-native
operations visible in the plan. It defaults to `runtime: bundled`; workspace
runtime mode is deferred until a same-module-graph Node platform setup can be
required without surprising users. The source currently lives in
`apps/ts-release-action`.

The action supports the review commands `plan`, `validate-config`, `status`,
`eligibility`, `doctor`, `check-auth`, and `check-ci`, plus the approved workflow commands
`validate`, `run`, `resume`, and `reconcile`. Use `upload-evidence: true` when
an action job should publish collected `.release/evidence` JSON files even after
a command fails.

The `run` command is the recommended release path: it renders generated files,
validates every preflight, executes approved publish operations, and verifies
remote state in order. The primitive commands remain available for review and
debug flows:

```sh
bun run cli schema --out release-config.schema.json
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo
bun run cli validate-config --config release.config.json --format text
bun run cli plan --config release.config.json --format text
bun run cli plan --config release.config.json --format summary
bun run cli explain npm:npm-publish --config release.config.json
bun run cli doctor --config release.config.json --format text
bun run cli check-auth --config release.config.json --target npm --format text
bun run cli check-ci --config release.config.json --workflow .github/workflows/release.yml --format markdown
bun run cli check-intent --config release.config.json --format text
bun run cli render --config release.config.json --execute
bun run cli validate --config release.config.json
bun run cli print --config release.config.json
bun run cli execute --config release.config.json --execute --approve-irreversible
bun run cli verify --config release.config.json
bun run cli eligibility --config release.config.json --format text
bun run cli reconcile --config release.config.json --execute
```

Rendering writes generated target files locally and records `render.json` evidence. `execute` is a lower-level primitive that runs publish operations only. Publishing is blocked unless execution is explicitly approved. Irreversible operations require a second approval flag.

Status and resume commands use existing `.release/evidence` files to report progress and continue conservative unfinished work:

```sh
bun run cli status --config release.config.json --format text
bun run cli resume --config release.config.json --execute --approve-irreversible
```

Resume skips operations with successful matching evidence, reruns safe read-only failures, and blocks failed publish operations until remote state is reconciled manually.
`eligibility` resolves the configured release decision strategy and checks npm and GitHub remote state when a release is intended.
`check-intent` is a read-only CI gate for the explicit intent-file strategy.
`reconcile` is separate from resume: it inspects GitHub release state through the API and can publish a matching draft release with explicit `--execute` without republishing immutable npm versions.

The executable is an argv and console adapter over TypeScript workflows. Release workflows are modeled as typed functions first, then exposed through the CLI for terminal and CI usage.

## Imports

The package root export is intentionally empty. For onboarding and application workflow code, import the opt-in workflow facade from `@mannyc1/ts-release/workflows`; for maximum tree-shaking or target-author control, import the exact module you need from an explicit subpath.

```ts
import * as Effect from "effect/Effect"
import { type ReleaseIntent } from "@mannyc1/ts-release/domain/release"
import { createReleasePlan } from "@mannyc1/ts-release/planner/create-release-plan"
import { validatePlan } from "@mannyc1/ts-release/planner/executor"

export const planAndValidate = Effect.fn("docs.planAndValidate")(function*(intent: ReleaseIntent) {
  const plan = yield* createReleasePlan(intent)
  const evidence = yield* validatePlan(plan)
  return { plan, evidence }
})
```

`createReleasePlan` needs a `TargetRegistry` layer. Command execution needs a `ReleaseCommandRunner` layer, while artifact checks and checksum generation use Effect Platform `FileSystem`, `Path`, and `Crypto` services directly. High-level config-file workflows, render writes, and evidence writes also need Effect Platform `FileSystem` and `Path` services. Workflows that verify HTTP evidence, such as `verifyPlan`, `runApprovedReleaseWorkflow`, or direct `VerifyHttpOperation` execution, also need a `ReleaseHttp` layer. Applications can compose `@mannyc1/ts-release/workflows` and their platform services at the edge, or use exact lower-level imports from `@mannyc1/ts-release/workflows/live`, `@mannyc1/ts-release/host/platform`, and `@mannyc1/ts-release/host/http`. Tests can import `makeTestReleaseHttpLayer` from `@mannyc1/ts-release/host/http`. Internal Effect imports use deep module paths such as `effect/Effect` and `effect/Layer` to keep bundlers from depending on broad root-package analysis. See `ARCHITECTURE.md` for the module taxonomy.

Reusable operations in docs and examples should use `Effect.fn`; workflow bodies use `Effect.gen`. Durable data, options, tagged target variants, and typed errors use `Schema.Class`, `Schema.TaggedClass`, and `Schema.TaggedErrorClass`, with `.make(...)` for construction. Runtime layers are provided once at CLI, action, script, application, or test boundaries.

## TypeScript Workflows

Applications can call high-level release workflows without argv arrays or CLI command names:

```ts
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Config, Live } from "@mannyc1/ts-release/workflows"

const root = "/path/to/release-workspace"
const RuntimeLayer = Live.makeLayer({ root }).pipe(
  Layer.provideMerge(BunServices.layer),
  Layer.provideMerge(BunHttpClient.layer)
)

const textPlan = await Effect.runPromise(
  Config.renderPlan({ root, configPath: "release.config.json", format: "text" }).pipe(
    Effect.provide(RuntimeLayer)
  )
)

const plan = await Effect.runPromise(
  Config.plan({ root, configPath: "release.config.json" }).pipe(
    Effect.provide(RuntimeLayer)
  )
)

const evidence = await Effect.runPromise(
  Config.run({
    root,
    configPath: "release.config.json",
    execute: true,
    approveIrreversible: true
  }).pipe(
    Effect.provide(RuntimeLayer)
  )
)

const status = await Effect.runPromise(
  Config.status({ root, configPath: "release.config.json", format: "json" }).pipe(
    Effect.provide(RuntimeLayer)
  )
)

const resumedEvidence = await Effect.runPromise(
  Config.resume({
    root,
    configPath: "release.config.json",
    execute: true,
    approveIrreversible: true
  }).pipe(
    Effect.provide(RuntimeLayer)
  )
)

const eligibility = await Effect.runPromise(
  Config.checkEligibility({
    root,
    configPath: "release.config.json"
  }).pipe(
    Effect.provide(RuntimeLayer)
  )
)

const reconciliationEvidence = await Effect.runPromise(
  Config.reconcile({
    root,
    configPath: "release.config.json",
    execute: true
  }).pipe(
    Effect.provide(RuntimeLayer)
  )
)
```

Use `@mannyc1/ts-release/workflows` for the curated `Config`, `Init`, `Diagnostics`, `Evidence`, and `Live` namespaces. Exact leaf imports such as `@mannyc1/ts-release/workflows/config`, `@mannyc1/ts-release/workflows/init`, `@mannyc1/ts-release/workflows/diagnostics`, `@mannyc1/ts-release/workflows/evidence`, and `@mannyc1/ts-release/workflows/live` remain stable and are preferred when an application needs maximum tree-shaking or direct access to option classes. Applications provide platform services at the edge, such as `FileSystem`, `Path`, `HttpClient`, and command execution. Use explicit lower-level planner, config, target, host, and domain subpaths when an application needs finer control over planning, execution, or test layers.

## Example Config

```json
{
  "$schema": "https://mannyc2.github.io/ts-release/schema/release-config.schema.json",
  "identity": {
    "name": "@mannyc1/ts-release",
    "version": "0.1.0",
    "commit": "abc123",
    "tag": "v0.1.0",
    "notes": "Release notes"
  },
  "artifacts": [
    {
      "id": "package",
      "path": ".",
      "format": "directory",
      "consumers": ["npm"]
    },
    {
      "id": "github-asset",
      "path": "artifacts/mannyc1-ts-release-0.1.0.tgz",
      "format": "tarball",
      "consumers": ["github"]
    }
  ],
  "targets": [
    {
      "_tag": "NpmRegistryTarget",
      "id": "npm",
      "registry": "https://registry.npmjs.org",
      "packageName": "@mannyc1/ts-release",
      "packagePath": ".",
      "trustedPublishing": {
        "provider": "github-actions",
        "workflow": "release.yml",
        "packageExists": true,
        "verifyPackageExists": true
      },
      "access": "public",
      "provenance": true,
      "dryRunSupport": "native",
      "mutability": "immutable",
      "recovery": "publish-new-version"
    },
    {
      "_tag": "GitHubReleaseTarget",
      "id": "github",
      "repository": "owner/repo",
      "tokenEnv": "GH_TOKEN",
      "draft": true,
      "dryRunSupport": "simulated",
      "mutability": "mutable-release",
      "recovery": "delete-and-recreate"
    }
  ],
  "strict": true,
  "evidenceDirectory": ".release/evidence/{version}"
}
```

The optional `$schema` key powers editor completion and does not change release behavior. Print the derived schema with `bun run cli schema`, and use `bun run cli validate-config` to check JSON syntax and release config shape without running target validators.

Paths are release-workspace relative and may not be absolute or contain parent traversal. `evidenceDirectory` may include the literal `{version}` placeholder, which is resolved during planning so each release version can use its own evidence directory.
Artifact paths may use `{version}`, `{name}`, and `{normalizedName}`. `normalizedName` removes a leading npm scope marker and replaces `/` with `-`, matching generated self-release artifact names such as `mannyc1-ts-release-0.1.0.tgz`.

## Release Strategies

Release identity and release decisions are strategy-backed data. Target adapters still receive a concrete release identity and still produce reviewable, approval-gated operations.

| Strategy | Good for | Source of truth |
|---|---|---|
| Static config | audited/manual release identity | release config |
| Package manifest | npm/package releases with one version source | `package.json` |
| Git tag | tag-triggered release workflows | current Git tag |
| Conventional commits | automated SemVer from commit messages | commits since the latest matching tag |
| Intent files | reviewed release intent in PRs | `.release/intents/*.json` |

Static identity remains supported:

```json
{
  "identity": {
    "name": "@scope/pkg",
    "version": "0.1.0",
    "commit": "abc123",
    "tag": "v0.1.0"
  }
}
```

For npm-style packages, prefer manifest-derived identity to avoid repeating versions in release config:

```json
{
  "identity": {
    "_tag": "PackageManifestReleaseIdentitySource",
    "packagePath": "package.json",
    "commit": "HEAD",
    "tagTemplate": "v{version}"
  }
}
```

Decision strategies are opt-in through `releaseDecision`. The default `RemoteStateReleaseDecision` uses the resolved identity, then checks npm and GitHub state. Git tag and conventional commit strategies can return `skipped` without error when no release input is present. Intent files are small JSON documents in `.release/intents`:

```json
{
  "$schema": "https://mannyc2.github.io/ts-release/schema/release-intent.schema.json",
  "package": "@scope/pkg",
  "release": "patch",
  "summary": "Explain the user-visible change.",
  "empty": false
}
```

This is a first-party intent-file format, not full Changesets compatibility. Publish operations remain plan data until explicit execution approval, regardless of which strategy chose the intended version.

Homebrew tap targets model catalog updates as generated files plus an approval-gated push:

```json
{
  "_tag": "HomebrewTapTarget",
  "id": "homebrew",
  "repository": "owner/homebrew-tap",
  "formulaName": "release",
  "formulaPath": ".release/generated/release.rb",
  "artifactId": "github-asset",
  "url": "https://github.com/owner/repo/releases/download/v0.1.0/mannyc1-ts-release-0.1.0.tgz",
  "installPath": "bin/release",
  "dryRunSupport": "simulated",
  "mutability": "mutable-index",
  "recovery": "manual"
}
```

PyPI registry targets coordinate already-built Python distributions through Twine. They do not build wheels or sdists:

```json
{
  "_tag": "PyPiRegistryTarget",
  "id": "pypi",
  "repositoryUrl": "https://test.pypi.org/legacy/",
  "usernameEnv": "TWINE_USERNAME",
  "passwordEnv": "TWINE_PASSWORD",
  "dryRunSupport": "native",
  "mutability": "immutable",
  "recovery": "publish-new-version"
}
```

Use `TWINE_USERNAME` and `TWINE_PASSWORD` for token-based local publishing so secrets stay in environment variables rather than command arguments. PyPI Trusted Publishing belongs at the CI/auth layer; this adapter records Twine commands and their auth requirements. TestPyPI is a real registry publish target, not a dry-run.

Scoop bucket targets model Windows installer catalog updates as generated JSON manifests plus an approval-gated push:

```json
{
  "_tag": "ScoopBucketTarget",
  "id": "scoop",
  "repository": "owner/scoop-bucket",
  "manifestName": "release",
  "manifestPath": ".release/generated/release.json",
  "artifactId": "github-asset",
  "url": "https://github.com/owner/repo/releases/download/v0.1.0/mannyc1-ts-release-0.1.0.zip",
  "bin": "release.exe",
  "dryRunSupport": "simulated",
  "mutability": "mutable-index",
  "recovery": "manual"
}
```

Tap and bucket pushes use the Git credentials configured for the local checkout; `tokenEnv` is not supported for these catalog targets yet.

Use `run --execute --approve-irreversible` for the ordered release workflow, or use `plan`, `render --execute`, `validate`, `print`, `execute --execute`, and `verify` separately when generated catalog files need a manual review pause before any tap or bucket update is pushed.

## Plan Review

Text plans include the release identity, evidence directory, artifact inventory, target capabilities, operation commands, HTTP verification requests, validation notes, and execution gates. Command operations include a human command summary plus an `argv:` JSON array that preserves exact argument boundaries for review.

```text
@mannyc1/ts-release@0.1.0
commit: abc123
evidence: .release/evidence/0.1.0
artifacts: 2
targets: 2
operations: 9

targets:
  - github [GitHubReleaseTarget] auth=env-token dry-run=simulated strategy=simulated-plan mutability=mutable-release recovery=delete-and-recreate
  - npm [NpmRegistryTarget] auth=trusted-publishing runs-in=ci provider=github-actions workflow=release.yml required-permission=id-token:write package-prerequisite=exists dry-run=native strategy=native-command mutability=immutable recovery=publish-new-version
```

Summary plans provide a compact human first pass over risk, execution gates, target auth setup, and gated operation IDs:

```sh
bun run cli plan --config release.config.json --format summary
```

Markdown plans are intended for CI artifacts and PR review:

```sh
bun run cli plan --config release.config.json --format markdown > release-plan.md
```

Use `explain` when one operation needs a focused review without executing anything:

```sh
bun run cli explain npm:npm-publish --config release.config.json
```

JSON plans include the same data in a stable, CI-artifact-friendly shape, including `targetCapabilities`.

GitHub release verification uses the GitHub REST API to check the release tag, title, draft flag, prerelease flag, and each uploaded artifact name.

## Status and Resume

`status` reads local phase evidence and reports each current operation as pending, passed, failed, blocked, or complete without executing anything. The JSON format is schema-backed for CI or dashboards; the text format is intended for terminal review.

`resume` is intentionally conservative. It skips successful matching evidence, can rerun missing work and failed read-only validation or verification operations, and never reruns a failed publish operation. A failed publish command can still have changed the outside world, so resume blocks until a maintainer reconciles npm, GitHub, or any other remote state manually.

`reconcile` is the narrow remote repair path for GitHub Releases. It reads the GitHub release by tag, blocks on mismatched metadata or assets, skips an already matching published release, and can run `gh release edit <tag> --draft=false` for a matching draft when the target expects a public release. It does not run `npm publish`.

## Public API

The intentional public API is the explicit subpath list in `package.json`. The root package export remains empty. Programmatic callers can use the opt-in `@mannyc1/ts-release/workflows` facade for happy-path workflow APIs, or exact leaf subpaths such as `@mannyc1/ts-release/workflows/config`, `@mannyc1/ts-release/workflows/init`, and `@mannyc1/ts-release/workflows/diagnostics` for maximum tree-shaking and direct option-class access. Lower-level planner/config/target/status subpaths remain available for finer control. The official CLI command adapter lives in the private `apps/release-ts` app rather than the reusable root package API.

The package export checker fails if a new export is added without being added to the intentional API list.

## Templates

Copyable starter configs live in `templates/`. They are authoring starting
points with placeholder package, repository, tap, and bucket names. Runnable
fixtures live in `examples/`.

Config templates are intentionally narrow:

- `npm-only` for an existing npm package using GitHub Actions trusted publishing.
- `npm-github` for npm plus GitHub Releases.
- `multi-target-homebrew` for npm, GitHub Releases, and a Homebrew tap.
- `multi-target-scoop` for npm, GitHub Releases, and a Scoop bucket.

```sh
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo --write
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo --github-actions --package-manager npm --write
bun run cli plan --config release.config.json --format text
```

The npm templates enable provenance and set `verifyPackageExists: true`, which
adds a read-only `npm view <package>` validation before trusted publishing.
Add `--github-actions` to include the action-first trusted-publishing workflow
template in the preview or write set. Workflow scaffolding supports
`--package-manager bun|npm|pnpm|yarn`, plus single-line `--install-command` and
`--build-command` overrides. Those commands are CI setup steps, not release
target policy; publish operations still come from the `ts-release` plan.
Existing files are not overwritten unless `--overwrite` is also passed.

Action-first GitHub templates live under `templates/github-actions/`. The
checked-in templates use npm setup by default, while this repository's own
self-release workflow uses the Bun preset.

Use `doctor`, `check-auth`, and `check-ci` after writing a template to inspect
static readiness before any publish operation is approved.

## Examples

Runnable example configs live in `examples/`:

- `examples/multi-target`
- `examples/npm-only`
- `examples/npm-first-publish`
- `examples/github-release`
- `examples/homebrew-tap`
- `examples/pypi-registry`
- `examples/scoop-bucket`
- `examples/non-strict-skips`

`examples/multi-target` demonstrates one release coordinated across GitHub Releases, npm, and a Homebrew tap. The focused fixtures cover PyPI, Scoop, npm-only trusted publishing, token-based first npm publish, GitHub-only releases, and non-strict skipped validators. Build the package first, then plan an example from its directory:

```sh
bun run build
cd examples/multi-target
bun ../../apps/release-ts/src/cli/main.ts plan --config release.config.json --format text
```

Trusted-publishing npm examples use provenance and `verifyPackageExists`. The
`npm-first-publish` example intentionally stays token-based because npm trusted
publishing can only be configured after the package already exists.

## Evidence

Render, validation, execution, and verification evidence is written as JSON bundles. Failed commands still preserve partial evidence before the command failure is returned. Use `evidenceDirectory` such as `.release/evidence/{version}` when older local evidence should not collide with the current release version.

```json
{
  "schemaVersion": "release-evidence/v1",
  "releaseName": "release",
  "releaseVersion": "0.1.0",
  "records": [
    {
      "id": "npm:npm-pack-dry-run:command",
      "operationId": "npm:npm-pack-dry-run",
      "operationFingerprint": "{\"_tag\":\"ValidateCommandOperation\",\"id\":\"npm:npm-pack-dry-run\",\"targetId\":\"npm\",\"approval\":{\"requiresExecute\":false,\"requiresIrreversibleApproval\":false},\"command\":{\"executable\":\"npm\",\"args\":[\"pack\",\"--dry-run\",\"--json\"],\"requiredEnv\":[],\"redactedEnv\":[]}}",
      "status": "passed",
      "severity": "info",
      "exitCode": 0
    }
  ]
}
```

Non-strict mode records missing validators as visible skipped evidence instead of silently dropping them.

## Readiness

Normal verification stays deterministic and does not require live external services:

```sh
bun run check:release
```

CI runs the portable package checks on Linux, macOS, and Windows. The release
gate runs the self-release config guard, the static self-release CI diagnostic,
and then the portable checks.

Real-tool integration checks are opt-in:

```sh
bun run test:integration:tools
RELEASE_INTEGRATION_GITHUB=1 bun run test:integration:tools
```

The first command validates npm adapter operations against the real `npm` CLI. The second also validates GitHub adapter readiness checks against the real `gh` CLI and requires `gh auth status` to succeed. GitHub release creation itself has no native dry-run; release validation is simulated from the deterministic plan before publish and verified against GitHub only after publish.

Example configs and templates are checked through the TypeScript workflow path:

```sh
bun run check:examples
```

This repository also includes a self-release config at `apps/release-ts/release.config.json` that targets both npm and GitHub for the scoped `@mannyc1/ts-release` package. The app-owned self-release scripts live under `apps/release-ts/scripts`, with root package scripts delegating to them. The self-release config must pass `bun run check:self-release-config`, and the workflow must pass `bun run check:self-release-ci`, before portable release checks proceed. It derives name and version from the root `package.json`, uses `{version}` artifact templates, and keeps `identity.commit` as `HEAD` for stored-config convenience. Generated plans resolve `HEAD` to the current short commit, and the self-release guard requires a committed Git checkout with clean tracked files.

```sh
bun run check:self-release-config
bun run check:self-release-ci
```

### Self Release

The local non-publish gates for this package are:

```sh
bun run check:release
bun run release:artifacts
bun run cli plan --config apps/release-ts/release.config.json --format text
```

`release:artifacts` delegates to `apps/release-ts/scripts/build-release-artifacts.ts` and writes ignored files under `.release/artifacts`: the npm package tarball and standalone CLI executables for Linux, macOS, and Windows. GitHub Actions runs on protected `main` and checks release eligibility before the full release gate. When `should_release` is true, the plan job runs `check:release`, builds artifacts, records a Markdown release plan, uploads evidence, and does not execute release operations. The protected `execute` job uses the reviewed `.release/artifacts` download, grants `contents: write` and `id-token: write`, and runs approved execution with npm trusted publishing OIDC instead of an npm token.

### Local Release Auth

Use `.env.example` as the local credential contract. Export `GH_TOKEN`, or copy
`.env.example` to `.env` and fill in token values locally. `.env` and `.npmrc`
are ignored intentionally; keep token values out of commits. `.npmrc.example`
shows npm's `${NPM_TOKEN}` interpolation form for token-based npm targets.
`TWINE_USERNAME` and `TWINE_PASSWORD` are only needed for PyPI/Twine examples.

For npmjs releases from GitHub Actions, prefer structured `trustedPublishing` on
the npm target:

```json
{
  "packageName": "@mannyc1/ts-release",
  "trustedPublishing": {
    "provider": "github-actions",
    "workflow": "release.yml",
    "packageExists": true,
    "verifyPackageExists": true
  },
  "access": "public",
  "provenance": true
}
```

Trusted publishing authenticates during `npm publish` with CI OIDC, so
`ts-release` records that mode in validation evidence instead of running
`npm whoami`, which does not validate OIDC publishing. Configure npmjs trusted
publishing for an existing package and use a GitHub-hosted runner with
`id-token: write`, Node 22.14+ and npm 11.5.1+. The `packageExists` field must be
`true` as a precondition acknowledgement, not first-publish support. Setting
`verifyPackageExists` to `true` adds a read-only `npm view <package>` validation
check. Trusted publishing does not use `NPM_TOKEN` for `npm publish`; token-based
npm targets may still use `.npmrc.example` and `NPM_TOKEN`.

Diagnostics stay static by default and report confidence instead of pretending
local checks prove provider setup:

```sh
bun run cli check-auth --config release.config.json --format text
bun run cli check-ci --config release.config.json --workflow .github/workflows/release.yml --format markdown
bun run cli doctor --config release.config.json --format json
```

The reusable GitHub Actions trusted-publishing workflow template lives at
`templates/github-actions/trusted-publishing.yml`. It uses
`mannyc2/ts-release-action@v1` to record a Markdown plan, uploads review
artifacts, and requires a protected `release` environment before running
approved execution. npm trusted publishing uses OIDC, not `NPM_TOKEN`;
`GH_TOKEN` is for GitHub Releases and API verification.

### First npm Publish Bootstrap

Trusted publishing is the preferred steady state for GitHub Actions, but npm
requires the package to exist before trusted publishing can be configured. For a
new package, use a temporary token-based npm target with `tokenEnv: "NPM_TOKEN"`
and no `trustedPublishing` object. After the first version exists on npm,
configure npm trusted publishing for owner `mannyc2`, repository `ts-release`,
and workflow filename `release.yml`, then switch the target to
`trustedPublishing`.

Do not commit token values. Keep `.env.example` and `.npmrc.example` as
placeholder contracts only.

The first-release GitHub target uses `GH_TOKEN` for both `gh` command authentication and read-only REST API verification. The release workflow sets up a current Node/npm toolchain for trusted publishing and enables npm provenance for CI-based publishes where the registry can generate provenance.
