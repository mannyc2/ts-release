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

## Imports

The package intentionally avoids aggregate library barrels. The root `release` export is intentionally empty; import the exact module you need from an explicit subpath.

```ts
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type ReleaseIntent } from "@mannyc1/ts-release/domain/release"
import { BunReleaseHostLayer } from "@mannyc1/ts-release/host/bun"
import { createReleasePlan } from "@mannyc1/ts-release/planner/create-release-plan"
import { validatePlan } from "@mannyc1/ts-release/planner/executor"
import { LiveTargetRegistryLayer } from "@mannyc1/ts-release/targets/live"

const planAndValidate = (intent: ReleaseIntent) =>
  Effect.gen(function*() {
    const plan = yield* createReleasePlan(intent)
    const evidence = yield* validatePlan(plan)
    return { plan, evidence }
  }).pipe(
    Effect.provide(Layer.mergeAll(BunReleaseHostLayer, LiveTargetRegistryLayer))
  )
```

`createReleasePlan` needs a `TargetRegistry` layer. `validatePlan` needs `ReleaseHost` and `TargetRegistry` layers. Workflows that verify HTTP evidence, such as `verifyPlan`, `runApprovedReleaseWorkflow`, or direct `VerifyHttpOperation` execution, also need a `ReleaseHttp` layer. Bun callers can import `LiveReleaseHttpLayer` from `@mannyc1/ts-release/host/http-live` and provide it with a `ReleaseHost` layer plus an Effect HTTP client such as `@effect/platform-bun/BunHttpClient`; tests can import `makeTestReleaseHttpLayer` from `@mannyc1/ts-release/host/http`. Internal Effect imports use deep module paths such as `effect/Effect` and `effect/Layer` to keep bundlers from depending on broad root-package analysis.

## Programmatic CLI

Applications can run the CLI command path without spawning the executable:

```ts
import * as Effect from "effect/Effect"
import {
  PlanReleaseConfigOptions,
  planReleaseConfig,
  ReleaseCliOptions,
  runReleaseCli
} from "@mannyc1/ts-release/cli/programmatic"

await Effect.runPromise(
  runReleaseCli([
    "plan",
    "--config",
    "release.config.json",
    "--format",
    "text"
  ], ReleaseCliOptions.make({ root: "/path/to/release-workspace" }))
)

const plan = await Effect.runPromise(
  planReleaseConfig(
    PlanReleaseConfigOptions.make({
      root: "/path/to/release-workspace",
      configPath: "release.config.json"
    })
  )
)
```

The helper provides the Bun host and live target registry internally, so callers do not need to import `effect/unstable/cli/Command` or assemble CLI layers by hand.

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
      "packagePath": ".",
      "tokenEnv": "NPM_TOKEN",
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
  - npm [NpmRegistryTarget] auth=env-token dry-run=native strategy=native-command mutability=immutable recovery=publish-new-version
```

JSON plans include the same data in a stable, CI-artifact-friendly shape, including `targetCapabilities`.

GitHub release verification uses the GitHub REST API to check the release tag, title, draft flag, prerelease flag, and each uploaded artifact name.

## Public API

The intentional public API is the explicit subpath list in `package.json`. `release/cli` and `release/cli/command` are public so applications can embed the CLI command, while the executable remains available through the `release` binary.

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

Example configs are checked through the same programmatic CLI command path:

```sh
bun run check:examples
```

This repository also includes a first release config at `release.config.json` that targets both npm and GitHub for the scoped `@mannyc1/ts-release` package. The self-release config must pass `bun run check:self-release-config` before release checks proceed. Its `identity.commit` may be the explicit current short commit, or `HEAD` as a stored-config convenience. Generated plans resolve `HEAD` to the current short commit, and the self-release guard requires a committed Git checkout with clean tracked files.

```sh
bun run check:self-release-config
```

### Local Release Auth

Use `.env.example` as the local credential contract. Export `NPM_TOKEN` and `GH_TOKEN`, or copy `.env.example` to `.env` and fill in the tokens locally. `.env` and `.npmrc` are ignored intentionally; keep token values out of commits. `.npmrc.example` shows npm's `${NPM_TOKEN}` interpolation form for local setup.

The first-release GitHub target uses `GH_TOKEN` for both `gh` command authentication and read-only REST API verification. Draft release verification requires authenticated API access. Enable npm provenance for CI-based publishes where the registry can generate provenance.
