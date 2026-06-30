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

Use the installed CLI to scaffold, inspect, build, plan, release, and verify:

```sh
ts-release init --template portable-cli --package @scope/pkg --repo owner/repo --tap owner/homebrew-pkg --bucket owner/scoop-pkg --pypi-package pkg --github-actions --write
ts-release doctor --config release.config.json
ts-release build --config release.config.json --format text
ts-release plan --config release.config.json --format text
```

These commands do not publish anything unless an execution command receives
explicit approval. To publish through the full ordered workflow, pass both
execution approvals:

```sh
ts-release release --config release.config.json --execute --approve-publish
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

The npm package ships both public surfaces: a small root TypeScript API for
typed config authoring and schema helpers, and the `ts-release` executable for
planning, staging, publishing, verification, and diagnostics. They use the same
release model; the CLI is not a separate product direction.

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
  -> post-publish verification
```

The library currently plans, stages, and validates these distribution surfaces:

| Surface | What ts-release models |
|---|---|
| npm | package publish, native dry-run validation, provenance, trusted publishing |
| GitHub Releases | release creation, asset uploads, and REST API verification |
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
declared artifact recipes, plan the target distribution work, then run the
approved release workflow.

The CLI intentionally has six top-level verbs:

```sh
ts-release init --config release.config.json
ts-release doctor --config release.config.json
ts-release build --config release.config.json --format text
ts-release plan --config release.config.json --format markdown
ts-release release --config release.config.json --execute --approve-publish
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

Supported action commands are `plan`, `doctor`, `build`, `release`, and
`verify`.

Publishing still needs explicit approval:

```yaml
- uses: mannyc2/ts-release-action@v1
  with:
    command: release
    config: release.config.json
    execute: "true"
    approve-publish: "true"
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

A release config declares project identity, build outputs, publish surfaces,
and evidence location.

```json
{
  "$schema": "https://mannyc2.github.io/ts-release/schema/release-config.schema.json",
  "project": {
    "packageName": "@scope/pkg",
    "repository": "owner/repo",
    "commit": "HEAD",
    "tagTemplate": "v{version}"
  },
  "build": {
    "npmPackage": {
      "id": "package",
      "path": ".",
      "consumers": ["npm"]
    }
  },
  "publish": {
    "npm": {
      "registry": "https://registry.npmjs.org",
      "packageName": "@scope/pkg",
      "packagePath": ".",
      "trustedPublishing": {
        "workflow": "release.yml",
        "packageExists": true,
        "verifyPackageExists": true
      },
      "access": "public",
      "provenance": true
    }
  },
  "strict": true,
  "evidence": ".release/evidence/{version}"
}
```

Useful config commands:

```sh
ts-release doctor --config release.config.json --format text
ts-release plan --config release.config.json --format summary
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
ts-release doctor --config release.config.json --target npm --format text
ts-release doctor --config release.config.json --format markdown
```

Diagnostics report confidence levels instead of pretending local checks can
prove provider-side setup. For example, npm trusted publishing can only be fully
confirmed inside the configured GitHub Actions environment.

## TypeScript API

Install the package when you want typed config authoring or schema helpers:

```sh
bun add -d @mannyc1/ts-release
```

The public TypeScript API lives at the package root. It is intentionally small
and pairs with the `ts-release` executable published by the same package:

```ts
import { defineRelease, renderReleaseConfigJsonSchema } from "@mannyc1/ts-release"

export default defineRelease({
  project: {
    name: "release",
    packageName: "@scope/pkg",
    repository: "owner/repo",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  build: {
    npmPackage: {
      id: "package",
      path: ".",
      consumers: ["npm"]
    }
  },
  publish: {
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "@scope/pkg",
      packagePath: ".",
      access: "public",
      provenance: true
    }
  },
  strict: true
})

console.log(renderReleaseConfigJsonSchema())
```

The package does not expose internal `domain/`, `planner/`, `targets/`,
`host/`, `artifacts/`, or `workflows/` subpaths. Use the root import for typed
config/schema work, and use the `ts-release` CLI or GitHub Action for release
execution.

## Templates And Examples

Create a starter config with `init --template`:

```sh
ts-release init --template npm-github --package @scope/pkg --repo owner/repo --github-actions --write
ts-release init --template portable-cli --package @scope/pkg --repo owner/repo --tap owner/homebrew-pkg --bucket owner/scoop-pkg --pypi-package pkg --write
```

Available templates:

- `npm-only`
- `npm-github`
- `bun-cli-github`
- `portable-cli`
- `multi-target-homebrew`
- `multi-target-scoop`

Templates with build recipes need an explicit staging step before publish
planning expects the generated files to exist:

```sh
ts-release build --config release.config.json --format text
```

## Evidence

Release and verification commands write JSON evidence bundles. The full
`release` workflow writes `evidence.json`.

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

## More Docs

See `ARCHITECTURE.md` for module boundaries, `SPEC.md` for the design contract,
`templates/README.md` for starter configs, and `examples/README.md` for runnable
fixtures.
