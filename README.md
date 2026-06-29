# @mannyc1/ts-release

Portable artifact and package-manager distribution planning for TypeScript projects.

## How To Install

Choose the install surface that matches how you want to use `ts-release`.

### Homebrew

Installs the macOS CLI from the published Homebrew tap:

```sh
brew install mannyc2/ts-release/ts-release
ts-release --version
```

### uv

Installs the CLI wrapper from PyPI into an isolated tool environment:

```sh
uv tool install ts-release
ts-release --version
```

### pipx

Installs the CLI wrapper from PyPI with pipx:

```sh
pipx install ts-release
ts-release --version
```

### pip

Installs the PyPI package into the active Python environment:

```sh
python -m pip install ts-release
ts-release --version
```

### Scoop

Installs the Windows CLI from the published Scoop bucket:

```powershell
scoop bucket add ts-release https://github.com/mannyc2/scoop-ts-release
scoop install ts-release
ts-release --version
```

### npm

Installs the TypeScript library/API package:

```sh
npm install @mannyc1/ts-release
```

### Bun

Installs the TypeScript library/API package with Bun:

```sh
bun add @mannyc1/ts-release effect@beta @effect/platform-bun@beta
```

### GitHub Releases

Downloads a raw platform binary from the GitHub Release:

```sh
curl -fsSLO https://github.com/mannyc2/ts-release/releases/download/v0.0.7/ts-release-0.0.7-linux-x64
chmod +x ts-release-0.0.7-linux-x64
./ts-release-0.0.7-linux-x64 --version
```

The CLI is currently distributed through Homebrew, Scoop, PyPI, and GitHub
Release binaries. The npm package is the reusable TypeScript library surface.

## Use The CLI

Use the installed CLI to scaffold, inspect, stage, and render a release config:

```sh
ts-release init --template bun-cli-github --package @scope/pkg --repo owner/repo --github-actions --write
ts-release validate-config --config release.config.json
ts-release stage-artifacts --config release.config.json --format text
ts-release plan --config release.config.json --format text
ts-release render --config release.config.json
```

These commands do not publish anything unless an execution command receives
explicit approval. To publish through the full ordered workflow, pass both
execution approvals:

```sh
ts-release run --config release.config.json --execute --approve-irreversible
```

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

The npm package is the reusable TypeScript library. The package-manager CLI
wraps the same release planning model for teams that want a command-line
workflow.

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

## CLI Workflow

The first useful path is artifact-first: write or scaffold a config, stage any
declared artifact recipes, plan the target distribution work, then render
package-manager files or release metadata.

`run` renders generated files, validates preflights, executes approved publish
operations, and verifies remote state. Lower-level commands are available when
you want a manual pause between phases:

```sh
ts-release render --config release.config.json --execute
ts-release validate --config release.config.json
ts-release print --config release.config.json
ts-release execute --config release.config.json --execute --approve-irreversible
ts-release verify --config release.config.json
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
ts-release schema --out release-config.schema.json
ts-release validate-config --config release.config.json --format text
ts-release plan --config release.config.json --format summary
ts-release explain npm:npm-publish --config release.config.json
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
ts-release doctor --config release.config.json --format text
ts-release check-auth --config release.config.json --target npm --format text
ts-release check-ci --config release.config.json --workflow .github/workflows/release.yml --format markdown
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

Create a starter config with `init --template`:

```sh
ts-release init --template npm-github --package @scope/pkg --repo owner/repo --github-actions --write
```

Available templates:

- `npm-only`
- `npm-github`
- `bun-cli-github`
- `multi-target-homebrew`
- `multi-target-scoop`

Templates with `artifactRecipes` need an explicit staging step before target
planning expects the generated files to exist:

```sh
ts-release stage-artifacts --config release.config.json --format text
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
ts-release reconcile --config release.config.json --execute
```

## More Docs

See `ARCHITECTURE.md` for module boundaries, `SPEC.md` for the design contract,
`templates/README.md` for starter configs, and `examples/README.md` for runnable
fixtures.
