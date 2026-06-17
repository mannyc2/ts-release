# release

`@mannyc1/ts-release` turns release intent into explicit, inspectable, repeatable publishing operations.

The default workflow is plan-first:

```sh
bun run cli plan --config release.config.json --format text
bun run cli run --config release.config.json --execute --approve-irreversible
```

The `run` command is the recommended release path: it renders generated files,
validates every preflight, executes approved publish operations, and verifies
remote state in order. The primitive commands remain available for review and
debug flows:

```sh
bun run cli plan --config release.config.json --format text
bun run cli render --config release.config.json --execute
bun run cli validate --config release.config.json
bun run cli print --config release.config.json
bun run cli execute --config release.config.json --execute --approve-irreversible
bun run cli verify --config release.config.json
```

Rendering writes generated target files locally and records `render.json` evidence. `execute` is a lower-level primitive that runs publish operations only. Publishing is blocked unless execution is explicitly approved. Irreversible operations require a second approval flag.

Status and resume commands use existing `.release/evidence` files to report progress and continue conservative unfinished work:

```sh
bun run cli status --config release.config.json --format text
bun run cli resume --config release.config.json --execute --approve-irreversible
```

Resume skips operations with successful matching evidence, reruns safe read-only failures, and blocks failed publish operations until remote state is reconciled manually.

The executable is an argv and console adapter over the TypeScript API. Release workflows are modeled as typed functions first, then exposed through the CLI for terminal and CI usage.

## Imports

The package intentionally avoids aggregate library barrels. The root `release` export is intentionally empty; import the exact module you need from an explicit subpath.

```ts
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type ReleaseIntent } from "@mannyc1/ts-release/domain/release"
import { PlatformCommandRunnerLayer } from "@mannyc1/ts-release/host/platform"
import { createReleasePlan } from "@mannyc1/ts-release/planner/create-release-plan"
import { validatePlan } from "@mannyc1/ts-release/planner/executor"
import { LiveTargetRegistryLayer } from "@mannyc1/ts-release/targets/live"

const planAndValidate = (intent: ReleaseIntent) =>
  Effect.gen(function*() {
    const plan = yield* createReleasePlan(intent)
    const evidence = yield* validatePlan(plan)
    return { plan, evidence }
  }).pipe(
    Effect.provide(Layer.mergeAll(
      PlatformCommandRunnerLayer.pipe(Layer.provideMerge(BunServices.layer)),
      LiveTargetRegistryLayer
    ))
  )
```

`createReleasePlan` needs a `TargetRegistry` layer. Command execution needs a `ReleaseCommandRunner` layer, while artifact checks and checksum generation use Effect Platform `FileSystem`, `Path`, and `Crypto` services directly. High-level config-file APIs, render writes, and evidence writes also need Effect Platform `FileSystem` and `Path` services. Workflows that verify HTTP evidence, such as `verifyPlan`, `runApprovedReleaseWorkflow`, or direct `VerifyHttpOperation` execution, also need a `ReleaseHttp` layer. `PlatformCommandRunnerLayer` is implemented against Effect child process spawning, so applications choose their command runtime by providing Bun, Node, or test platform layers at the edge. HTTP follows the same pattern through Effect's `HttpClient` and Effect `Config`; tests can import `makeTestReleaseHttpLayer` from `@mannyc1/ts-release/host/http`. Internal Effect imports use deep module paths such as `effect/Effect` and `effect/Layer` to keep bundlers from depending on broad root-package analysis.

## TypeScript API

Applications can call high-level release workflows without argv arrays or CLI command names:

```ts
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  PlanReleaseConfigOptions,
  ReleaseExecutionOptions,
  ReleaseResumeConfigOptions,
  ReleaseStatusOptions,
  planReleaseConfig,
  renderReleaseConfigPlan,
  resumeReleaseConfig,
  runReleaseConfig,
  statusReleaseConfig
} from "@mannyc1/ts-release/api"
import { LiveReleaseApiLayer } from "@mannyc1/ts-release/api/live"
import { makePlatformCommandRunnerLayer } from "@mannyc1/ts-release/host/platform"

const root = "/path/to/release-workspace"
const RuntimeLayer = BunServices.layer
const PlatformLayer = Layer.mergeAll(
  makePlatformCommandRunnerLayer({ root }).pipe(Layer.provideMerge(RuntimeLayer)),
  BunHttpClient.layer
)
const ApiLayer = LiveReleaseApiLayer.pipe(Layer.provideMerge(PlatformLayer))

const textPlan = await Effect.runPromise(
  renderReleaseConfigPlan(
    PlanReleaseConfigOptions.make({ root, configPath: "release.config.json", format: "text" })
  ).pipe(Effect.provide(ApiLayer))
)

const plan = await Effect.runPromise(
  planReleaseConfig(PlanReleaseConfigOptions.make({ root, configPath: "release.config.json" })).pipe(
    Effect.provide(ApiLayer)
  )
)

const evidence = await Effect.runPromise(
  runReleaseConfig(
    ReleaseExecutionOptions.make({
      root,
      configPath: "release.config.json",
      execute: true,
      approveIrreversible: true
    })
  ).pipe(
    Effect.provide(ApiLayer)
  )
)

const status = await Effect.runPromise(
  statusReleaseConfig(
    ReleaseStatusOptions.make({ root, configPath: "release.config.json", format: "json" })
  ).pipe(
    Effect.provide(ApiLayer)
  )
)

const resumedEvidence = await Effect.runPromise(
  resumeReleaseConfig(
    ReleaseResumeConfigOptions.make({
      root,
      configPath: "release.config.json",
      execute: true,
      approveIrreversible: true
    })
  ).pipe(
    Effect.provide(ApiLayer)
  )
)
```

Use `@mannyc1/ts-release/api` for high-level workflows and `@mannyc1/ts-release/api/live` for the live target/HTTP layer. The package does not require Bun for library use; Bun is just the platform layer used by the published binary and by the example above. Node callers can provide Node platform services and a Node HTTP client instead. Use explicit lower-level planner, config, target, host, and domain subpaths when an application needs finer control over planning, execution, or test layers.

## Example Config

```json
{
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
  "evidenceDirectory": ".release/evidence"
}
```

Paths are release-workspace relative and may not be absolute or contain parent traversal.

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
evidence: .release/evidence
artifacts: 2
targets: 2
operations: 9

targets:
  - github [GitHubReleaseTarget] auth=env-token dry-run=simulated strategy=simulated-plan mutability=mutable-release recovery=delete-and-recreate
  - npm [NpmRegistryTarget] auth=trusted-publishing runs-in=ci provider=github-actions workflow=release.yml required-permission=id-token:write package-prerequisite=exists dry-run=native strategy=native-command mutability=immutable recovery=publish-new-version
```

JSON plans include the same data in a stable, CI-artifact-friendly shape, including `targetCapabilities`.

GitHub release verification uses the GitHub REST API to check the release tag, title, draft flag, prerelease flag, and each uploaded artifact name.

## Status and Resume

`status` reads local phase evidence and reports each current operation as pending, passed, failed, blocked, or complete without executing anything. The JSON format is schema-backed for CI or dashboards; the text format is intended for terminal review.

`resume` is intentionally conservative. It skips successful matching evidence, can rerun missing work and failed read-only validation or verification operations, and never reruns a failed publish operation. A failed publish command can still have changed the outside world, so resume blocks until a maintainer reconciles npm, GitHub, or any other remote state manually.

## Public API

The intentional public API is the explicit subpath list in `package.json`. The npm package exposes the `release` executable through `bin`; programmatic callers should import high-level workflows from `@mannyc1/ts-release/api` or use the explicit lower-level planner/config/target/status subpaths for finer control. `release/cli` and `release/cli/command` remain public for applications that need to embed the CLI command adapter.

The package export checker fails if a new export is added without being added to the intentional API list.

## Examples

Runnable example configs live in `examples/`:

- `examples/multi-target`
- `examples/npm-only`
- `examples/github-release`
- `examples/homebrew-tap`
- `examples/pypi-registry`
- `examples/scoop-bucket`
- `examples/non-strict-skips`

`examples/multi-target` demonstrates one release coordinated across a release host, a package registry, and an installer catalog. Build the package first, then plan an example from its directory:

```sh
bun run build
cd examples/multi-target
bun ../../dist/cli/main.js plan --config release.config.json --format text
```

## Evidence

Render, validation, execution, and verification evidence is written as JSON bundles. Failed commands still preserve partial evidence before the command failure is returned.

```json
{
  "schemaVersion": "release-evidence/v1",
  "releaseName": "release",
  "releaseVersion": "0.1.0",
  "records": [
    {
      "id": "npm:npm-pack-dry-run:command",
      "operationId": "npm:npm-pack-dry-run",
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

CI runs the portable package checks on Linux, macOS, and Windows. The Ubuntu release-readiness lane also runs the self-release config guard.

Real-tool integration checks are opt-in:

```sh
bun run test:integration:tools
RELEASE_INTEGRATION_GITHUB=1 bun run test:integration:tools
```

The first command validates npm adapter operations against the real `npm` CLI. The second also validates GitHub adapter readiness checks against the real `gh` CLI and requires `gh auth status` to succeed. GitHub release creation itself has no native dry-run; release validation is simulated from the deterministic plan before publish and verified against GitHub only after publish.

Example configs are checked through the TypeScript API path:

```sh
bun run check:examples
```

This repository also includes a first release config at `release.config.json` that targets both npm and GitHub for the scoped `@mannyc1/ts-release` package. The self-release config must pass `bun run check:self-release-config` before release checks proceed. Its `identity.commit` may be the explicit current short commit, or `HEAD` as a stored-config convenience. Generated plans resolve `HEAD` to the current short commit, and the self-release guard requires a committed Git checkout with clean tracked files.

```sh
bun run check:self-release-config
```

### Self Release

The local non-publish gates for this package are:

```sh
bun run check:release
bun run release:artifacts
bun dist/cli/main.js plan --config release.config.json --format text
```

`release:artifacts` writes ignored files under `.release/artifacts`: the npm package tarball and standalone CLI executables for Linux, macOS, and Windows. GitHub Actions runs the approved release workflow on protected `main` when the package version has not already been published. The workflow uses npm trusted publishing with GitHub Actions OIDC instead of an npm token, and uploads `.release/evidence/**` for audit.

### Local Release Auth

Use `.env.example` as the local credential contract. Export `GH_TOKEN`, or copy
`.env.example` to `.env` and fill in token values locally. `.env` and `.npmrc`
are ignored intentionally; keep token values out of commits. `.npmrc.example`
shows npm's `${NPM_TOKEN}` interpolation form for token-based npm targets.

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
  }
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

The first-release GitHub target uses `GH_TOKEN` for both `gh` command authentication and read-only REST API verification. The release workflow sets up a current Node/npm toolchain for trusted publishing and enables npm provenance for CI-based publishes where the registry can generate provenance.
