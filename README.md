# @mannyc1/ts-release

GoReleaser-grade distribution for TypeScript/Bun CLI authors, with typed
config and a reviewable publish plan.

`ts-release` is plan-first: produce a reviewable distribution plan, rehearse it
as a snapshot, then execute only after explicit approval. Snapshot releases use
the resolved version plus `-SNAPSHOT-{shortCommit}` and refuse externally
visible or irreversible operations even when execution flags are present.

The package keeps the useful GoReleaser shape without a Pro boundary: artifact
inventory, package-manager catalog files, publish operations, and evidence
artifacts all stay visible as data. Typed config keeps repeated distribution
metadata in one place. npm and PyPI support are first-party surfaces, not the
whole product.

Compared with semantic-release, `ts-release` starts from distribution artifacts
and approval gates rather than commit-message versioning. They meet naturally at
a future conventional-commits version source; today, version identity is explicit
or read from the package manifest/git tag.

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
curl -fsSLO https://github.com/mannyc2/ts-release/releases/download/v0.1.0/ts-release-0.1.0-linux-x64
chmod +x ts-release-0.1.0-linux-x64
./ts-release-0.1.0-linux-x64 --version
```

The CLI is currently distributed through Homebrew, Scoop, PyPI, and GitHub
Release binaries. The npm package is the reusable TypeScript library surface.

## TypeScript API

Use the root import for typed config authoring, Promise-based planning, and
stable summary data:

```ts
import {
  defineRelease,
  disposeReleaseRuntime,
  plan,
  release,
  renderReleaseConfigJsonSchema
} from "@mannyc1/ts-release"

const config = defineRelease({
  project: {
    name: "release",
    packageName: "@scope/pkg",
    repository: "owner/repo",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  npmPackage: {
    path: "."
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
  evidence: ".release/evidence/{version}"
})

const rehearsal = await plan({ config, snapshot: true })
console.log(rehearsal.identity.version)

const dryRun = await release({ config })
console.log(dryRun.executed.length)

console.log(renderReleaseConfigJsonSchema())
await disposeReleaseRuntime()
```

## Use The CLI

Use the installed CLI to scaffold, inspect, build, plan, release, and verify:

```sh
ts-release init --template portable-cli --package @scope/pkg --repo owner/repo --tap owner/homebrew-pkg --bucket owner/scoop-pkg --pypi-package pkg --github-actions --write
ts-release doctor --config release.config.json
ts-release build --config release.config.json --format text
ts-release plan --config release.config.json --format text
ts-release plan --config release.config.json --snapshot --format text
```

`release` is plan-only by default and ends with an explicit reminder that
nothing was executed:

```sh
ts-release release --config release.config.json
```

To publish through the full ordered workflow, pass both execution approvals:

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
  -> canonical build and imported artifacts
  -> installable artifact variants
  -> one complete release-plan/v4 operation sequence
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
| File-based catalogs | user-owned whole files with artifact facts and approved git push or pull-request flows |
| Bun executables | optional Bun compile staging before target planning |

### Publish to any file-based catalog

Use `catalogs[]` when a distribution surface is a file maintained in a git
repository. Literal content and predictable asset facts resolve in the plan;
typed checksum holes resolve only after the referenced artifact exists.

```json
{
  "catalogs": [
    {
      "id": "marketplace",
      "repository": "owner/catalog",
      "directory": "catalog-checkout",
      "file": "plugins/release.json",
      "submit": "pull-request",
      "content": [
        "{\"name\":\"{name}\",\"sha256\":\"",
        { "fact": "sha256", "artifact": "plugin" },
        "\"}\n"
      ]
    }
  ]
}
```

The `examples/agent-plugin` fixture shows the complete generic path: a
platform-neutral zip, checksum, GitHub release assets, catalog rendering, and
an approval-gated pull request. Catalog content is whole-file, user-owned data;
the generic surface does not claim that illustrative marketplace JSON is a
stable vendor contract. `downloadUrl` and `assetName` facts are also available
for values that can be fixed during planning.

It is not a fake universal package manager and does not hide each ecosystem's
manifest rules. It can stage declared artifacts through adapters, but it does
not replace full build pipelines, compilers, signing, or installer toolchains.
The job is to keep canonical artifact data and target-specific distribution
data in one typed plan.

## CLI Workflow

The first useful path is artifact-first: write or scaffold a config, stage any
declared build outputs, plan the target distribution work, then run the
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
  "npmPackage": {
    "path": "."
  },
  "publish": {
    "npm": {
      "registry": "https://registry.npmjs.org",
      "packageName": "@scope/pkg",
      "packagePath": ".",
      "trustedPublishing": {
        "workflow": "release.yml",
        "verifyPackageExists": true
      },
      "access": "public",
      "provenance": true
    }
  },
  "evidence": ".release/evidence/{version}"
}
```

Runtime config decoding is strict: unknown keys are rejected instead of
silently stripped. npm trusted publishing accepts only
`verifyPackageExists`; Homebrew accepts a non-empty `artifactIds` array while
Scoop retains its singular `artifactId`. PyPI can optionally select an
explicit non-empty `artifactIds` array and otherwise selects wheel artifacts
by kind.

Useful config commands:

```sh
ts-release doctor --config release.config.json --format text
ts-release plan --config release.config.json --format summary
```

Paths are release-workspace relative. Artifact paths can interpolate
`{version}`, `{name}`, and `{normalizedName}`. Evidence directories can
interpolate `{version}`.

## Plan Contract

`release-plan/v4` is the sole plan document. It is flat, contains one
canonical artifact array, and exposes every planned build, wheel, import,
archive, checksum, catalog, publish, and verification operation in contribution
order. Phase selection is execution policy; it does not hide work from JSON,
text, Markdown, summaries, scripts, doctor, or Action counts.

```json
{
  "schemaVersion": "release-plan/v4",
  "identity": {
    "name": "pkg",
    "normalizedName": "pkg",
    "version": "0.1.0",
    "commit": "abc123",
    "shortCommit": "abc123",
    "tag": "v0.1.0",
    "versionSource": "manifest",
    "snapshot": false
  },
  "artifacts": [
    {
      "id": "cli-linux-x64",
      "kind": "executable",
      "path": "artifacts/pkg-0.1.0-linux-x64",
      "producedBy": "build:bun"
    }
  ],
  "operations": [],
  "source": {
    "root": ".",
    "configPath": "release.config.json"
  },
  "evidenceDirectory": ".release/evidence/0.1.0"
}
```

The Action reports `operation_count` from this complete array and reports
unique catalog/publish surfaces as `surface_count`.

This is a hard cut: `release-plan/v3` documents are unsupported and there is
no fallback reader. The former Action `target_count` output was removed in
favor of `surface_count`; config `packageExists` was replaced by
`verifyPackageExists`; Homebrew `artifactId` was replaced by non-empty
`artifactIds`; and PyPI now uses explicit optional `artifactIds` or canonical
`kind: "wheel"` selection. These are removals, not deprecations.

## Artifact Variants

Bun builds can produce installable variants for different operating systems
and architectures. The Bun builder derives variant metadata from each canonical
target, so the release plan can carry facts such as `linux`/`x64` or
`windows`/`x64` before any package-manager adapter consumes the artifact.

```json
{
  "id": "cli-linux-x64",
  "kind": "executable",
  "path": "artifacts/pkg-0.1.0-linux-x64",
  "producedBy": "build:bun",
  "platform": {
    "os": "linux",
    "arch": "x64",
    "libc": "glibc",
    "targetTriple": "bun-linux-x64-baseline"
  }
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

## Public Root Import

The package does not expose internal `pipeline/`, `pipes/`, `builders/`,
`engine/`, `host/`, `artifacts/`, or `workflows/` subpaths. Use the root import
for `defineRelease`, schema helpers, `plan`, `build`, `release`, `verify`,
summary types, and `ReleaseApiError`.

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

Templates with build sections need an explicit staging step before publish
planning expects the generated files to exist:

```sh
ts-release build --config release.config.json --format text
```

## Evidence

Release and verification commands write JSON evidence bundles. The full
`release` workflow writes `evidence.json`.

```json
{
  "schemaVersion": "release-evidence/v3",
  "releaseName": "release",
  "releaseVersion": "0.1.0",
  "records": [
    {
      "operationId": "npm:npm-pack-dry-run",
      "pipeId": "publish:npm",
      "phase": "publish",
      "risk": "read-only",
      "status": "passed",
      "message": "npm pack dry run passed.",
      "startedAt": "2026-01-01T00:00:00.000Z",
      "endedAt": "2026-01-01T00:00:00.100Z",
      "durationMillis": 100,
      "outcome": {
        "command": {
          "executable": "npm",
          "args": ["pack", "--dry-run", "--json"],
          "requiredEnv": [],
          "redactedEnv": []
        },
        "exitCode": 0,
        "stdout": "",
        "stderr": "",
        "_tag": "command"
      }
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
