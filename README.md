# @mannyc1/ts-release

Portable artifact and package-manager distribution planning for TypeScript projects.

`@mannyc1/ts-release` helps you declare the thing you want to distribute, stage
platform-specific artifacts when needed, and feed those artifacts into
target-specific package managers, catalogs, release hosts, and install surfaces.
Publish operations still stay reviewable and approval-gated, but the product
center is portable distribution data.

Use it when you need to answer:

- Which binaries, archives, packages, or generated files make up this release?
- Which package managers or install channels consume each artifact variant?
- What target-specific files or commands will be generated?
- Which operations are only rendering data, and which ones publish externally?
- What evidence proves what was staged, rendered, validated, or executed?

The root package is the reusable TypeScript library. This repo also contains the
first-party Bun CLI app in `apps/release-ts` and the bundled GitHub Action in
`apps/ts-release-action`.

## What It Does

`ts-release` models distribution as data:

```text
release config
  -> normalized release identity
  -> artifact recipes and inventory
  -> installable artifact variants
  -> target-specific distribution operations
  -> generated package-manager files
  -> explicit execution evidence
  -> verification or reconciliation
```

The library currently plans, stages, and validates these distribution surfaces:

| Surface | What ts-release models |
|---|---|
| npm | package publish, native dry-run validation, provenance, trusted publishing |
| GitHub Releases | release creation, asset uploads, REST API verification, draft reconciliation |
| Homebrew taps | generated formula files, macOS artifact variants, and approved tap pushes |
| PyPI | already-built distributions and platform CLI wrapper wheels published through Twine |
| Scoop buckets | generated manifest files, Windows binary shims, and approved bucket pushes |
| Bun executables | optional binary artifact recipe staging before target planning |

It is not a fake universal package manager and does not hide each ecosystem's
manifest rules. It can stage declared artifacts through adapters, but it does
not replace full build pipelines, compilers, signing, or installer toolchains.
The job is to keep shared artifact inventory and target-specific distribution
data in one typed plan.

## Quick Start

Inside this repository, the CLI script runs the first-party Bun app:

```sh
bun run cli init --template bun-cli-github --package @scope/pkg --repo owner/repo --github-actions --write
bun run cli validate-config --config release.config.json
bun run cli stage-artifacts --config release.config.json --format text
bun run cli plan --config release.config.json --format text
bun run cli render --config release.config.json
```

The first useful path is artifact-first: write or scaffold a config, stage any
declared artifact recipes, plan the target distribution work, then render
package-manager files or release metadata. These commands do not publish
anything unless an execution command receives explicit approval.

To publish through the full ordered workflow, pass both execution approvals:

```sh
bun run cli run --config release.config.json --execute --approve-irreversible
```

`run` renders generated files, validates preflights, executes approved publish
operations, and verifies remote state. The lower-level commands are available
when you want a manual pause between phases:

```sh
bun run cli render --config release.config.json --execute
bun run cli validate --config release.config.json
bun run cli print --config release.config.json
bun run cli execute --config release.config.json --execute --approve-irreversible
bun run cli verify --config release.config.json
```

## GitHub Actions

The bundled action is the intended CI adapter:

```yaml
- uses: mannyc2/ts-release-action@v1
  with:
    command: plan
    config: release.config.json
    format: markdown
    upload-evidence: true
```

Supported action commands are `plan`, `validate-config`, `doctor`, `check-auth`,
`check-ci`, `validate`, `run`, and `reconcile`. Artifact recipe staging remains
owned by the Bun CLI/runtime because the bundled action runs on Node.

Publishing still needs explicit approval:

```yaml
- uses: mannyc2/ts-release-action@v1
  with:
    command: run
    config: release.config.json
    execute: "true"
    approve-irreversible: "true"
    upload-evidence: true
```

For npm trusted publishing, configure npmjs for the GitHub repository and
workflow, grant `id-token: write`, and keep `trustedPublishing` in the npm
target. Trusted publishing uses OIDC during `npm publish`; it does not use
`NPM_TOKEN`.

For PyPI trusted publishing, configure a pending or existing PyPI Trusted
Publisher for the GitHub repository, workflow, and release environment, then
keep `trustedPublishing` in the PyPI target. Twine uses OIDC during
`twine upload`; it does not require `TWINE_USERNAME` or `TWINE_PASSWORD` in CI.

## Config

A release config declares identity, artifacts, target policy, and evidence
location.

```json
{
  "$schema": "https://mannyc2.github.io/ts-release/schema/release-config.schema.json",
  "identity": {
    "_tag": "PackageManifestReleaseIdentitySource",
    "packagePath": "package.json",
    "commit": "HEAD",
    "tagTemplate": "v{version}"
  },
  "artifacts": [
    {
      "id": "package",
      "path": ".",
      "format": "directory",
      "consumers": ["npm"]
    }
  ],
  "targets": [
    {
      "_tag": "NpmRegistryTarget",
      "id": "npm",
      "registry": "https://registry.npmjs.org",
      "packageName": "@scope/pkg",
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
    }
  ],
  "strict": true,
  "evidenceDirectory": ".release/evidence/{version}"
}
```

Useful config commands:

```sh
bun run cli schema --out release-config.schema.json
bun run cli validate-config --config release.config.json --format text
bun run cli plan --config release.config.json --format summary
bun run cli explain npm:npm-publish --config release.config.json
```

Paths are release-workspace relative. Artifact paths can interpolate
`{version}`, `{name}`, and `{normalizedName}`. Evidence directories can
interpolate `{version}`.

## Artifact Variants

Artifact recipes can produce installable variants for different operating
systems and architectures. Bun executable recipes derive variant metadata from
their compile target, so the release plan can carry facts such as `linux`/`x64`
or `windows`/`x64` before any package-manager adapter consumes the artifact.

```json
{
  "id": "cli-linux-x64",
  "target": "bun-linux-x64-baseline",
  "path": "artifacts/pkg-{version}-linux-x64",
  "consumers": ["github"]
}
```

The planned artifact inventory for that output includes an executable artifact
with a variant like:

```json
{
  "os": "linux",
  "arch": "x64",
  "libc": "glibc",
  "targetTriple": "bun-linux-x64-baseline"
}
```

Direct artifact declarations can also include `variant` when an artifact was
built outside `ts-release`. Homebrew formulas can consume macOS `darwin` x64
and arm64 variants from one target, and Scoop manifests can derive a stable shim
from a Windows executable variant. Future package-manager adapters should follow
that pattern instead of guessing platform support from filenames.

## Diagnostics

Static diagnostics help catch missing auth and unsafe workflow setup before an
approved run:

```sh
bun run cli doctor --config release.config.json --format text
bun run cli check-auth --config release.config.json --target npm --format text
bun run cli check-ci --config release.config.json --workflow .github/workflows/release.yml --format markdown
```

Diagnostics report confidence levels instead of pretending local checks can
prove provider-side setup. For example, npm trusted publishing can only be fully
confirmed inside the configured GitHub Actions environment.

## Programmatic API

Install the library and provide platform services at your application boundary:

```sh
bun add @mannyc1/ts-release effect@beta @effect/platform-bun@beta
```

High-level workflows are available from the opt-in workflow facade:

```ts
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Distribution, Live } from "@mannyc1/ts-release/workflows"

const root = "/path/to/release-workspace"
const RuntimeLayer = Live.makeLayer({ root }).pipe(
  Layer.provideMerge(BunServices.layer),
  Layer.provideMerge(BunHttpClient.layer)
)

const textPlan = await Effect.runPromise(
  Distribution.renderPlan({ root, configPath: "release.config.json", format: "text" }).pipe(
    Effect.provide(RuntimeLayer)
  )
)

const evidence = await Effect.runPromise(
  Distribution.run({
    root,
    configPath: "release.config.json",
    execute: true,
    approveIrreversible: true
  }).pipe(Effect.provide(RuntimeLayer))
)

console.log(textPlan)
console.log(evidence.schemaVersion)
```

Use `@mannyc1/ts-release/workflows` for the curated `Distribution`, `Config`,
`Init`, `Diagnostics`, `Evidence`, and `Live` namespaces. The `Distribution`
namespace is the artifact-first facade; `Config` keeps the lower-level
config-file workflow names. Use exact subpaths such as
`@mannyc1/ts-release/workflows/distribution` or lower-level `domain/`,
`planner/`, `targets/`, and `host/` modules when you need tighter control or
maximum tree-shaking.

The package root export is intentionally empty. Public API is the explicit
subpath list in `package.json`.

## Templates And Examples

Config templates live in `templates/`:

- `npm-only`
- `npm-github`
- `bun-cli-github`
- `multi-target-homebrew`
- `multi-target-scoop`

Runnable fixtures live in `examples/` and are checked through the same workflow
path as user configs.

```sh
bun run build
cd examples/multi-target
bun ../../apps/release-ts/src/cli/main.ts plan --config release.config.json --format text
```

Templates with `artifactRecipes` need an explicit staging step before target
planning expects the generated files to exist:

```sh
bun run cli stage-artifacts --config release.config.json --format text
```

## Evidence

Validation, rendering, execution, reconciliation, and verification write JSON
evidence bundles. Primitive commands write named files such as
`validation.json`; the full `run` workflow writes `evidence.json`.

```json
{
  "schemaVersion": "release-evidence/v1",
  "releaseName": "release",
  "releaseVersion": "0.1.0",
  "records": [
    {
      "id": "npm:npm-pack-dry-run:command",
      "operationId": "npm:npm-pack-dry-run",
      "phase": "validation",
      "targetId": "npm",
      "risk": "read-only",
      "status": "passed",
      "severity": "info",
      "message": "npm pack dry run passed.",
      "startedAt": "2026-01-01T00:00:00.000Z",
      "endedAt": "2026-01-01T00:00:00.100Z",
      "durationMillis": 100,
      "command": "npm pack --dry-run --json",
      "exitCode": 0
    }
  ]
}
```

Failed commands preserve partial evidence when possible. Non-strict mode records
missing validators as visible skipped evidence instead of silently dropping them.

## Reconciliation

`reconcile` is a narrow repair path for GitHub Releases. It reads the release by
tag, blocks on mismatched metadata or assets, skips an already matching
published release, and can publish a matching draft with `--execute`.

It does not replay immutable registry publishes:

```sh
bun run cli reconcile --config release.config.json --execute
```

## Repository Checks

Use Bun for package management, scripts, and tests:

```sh
bun run check:release
bun run check:examples
bun run check:readme
```

Real-tool integration checks are opt-in:

```sh
bun run test:integration:tools
RELEASE_INTEGRATION_GITHUB=1 bun run test:integration:tools
```

See `ARCHITECTURE.md` for module boundaries, `SPEC.md` for the design contract,
`templates/README.md` for starter configs, and `examples/README.md` for runnable
fixtures.
