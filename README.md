# ts-release

ts-release automatically prepares and publishes a configured software release.
The normal path is one command:

```sh
ts-release init
ts-release release --config release.config.json
```

`release` observes the clean source checkout, runs declared local preparation,
stores one exact `prepared-release/v1` bundle, observes each destination, and
publishes only subjects that are absent and safely mutable. An external host
may place a gate around the publication job; that policy does not become
engine state.

## Smallest authored configuration

`ts-release init` writes the facts a repository can observe as optional. A
minimal package-and-GitHub release can therefore keep the authored file small:

```json
{
  "project": {},
  "versionFrom": "manifest",
  "npmPackage": { "path": "." },
  "publish": { "npm": {}, "github": {} }
}
```

The resolver fills package name, version, tag, commit, and repository from the
workspace when those facts agree. Deliberate overrides remain explicit, and a
disagreement stops instead of guessing.

## What is proven

The [executable capability inventory](docs/capabilities.md) is generated from
the runtime registry and dated evidence. The current retained slice includes
Bun builds for Linux, macOS, and Windows artifact targets; deterministic
archives and checksums; npm and GitHub publication adapters; managed catalog
rendering and Git delivery; and npm/catalog forward correction. Unsupported
correction variants remain visible as explicit boundaries.

ts-release runs on Linux and macOS. Its Bun builder can produce Windows
artifacts. It does not claim native Windows execution or native Windows tools.

## Optional preparation boundary

Use the two-operation form when a host must transfer bytes between jobs:

```sh
ts-release prepare --config release.config.json
ts-release inspect --prepared .release/ts-release/prepared/<manifest-digest>
ts-release publish .release/ts-release/prepared/<manifest-digest>
```

The publisher accepts only the complete prepared bundle. It does not rebuild
from source or accept authored configuration as a publication fallback.

Local preparation uses two native primitives. `CommandCheck` is a pass/fail
gate; `CommandArtifact` generates or transforms declared regular-file bytes.
Use artifact input/output references for data flow. Trusted argv commands may
read only the declared environment names and are not a sandbox or a generic
remote-effect mechanism. Durable test or compliance evidence must be a
declared artifact. See [the preparation guide](docs/preparation.md).

## Recovery

Rerun the same prepared bundle. Equivalent subjects are skipped, a safe absent
subject may be created, and conflicting or inconclusive observation stops
without mutation. A release may partially succeed; publication is not an
atomic transaction and there is no universal rollback. Provider-specific
forward correction is explicit and repeatable where the capability inventory
proves it. Announcements, deletion, and generic inverse operations are not
configured destinations.

## GitHub Actions

The automatic workflow is one job and one `release` Action call. The Action
durably uploads and verifies the prepared bundle before any provider mutation.
Copy [`templates/github-actions/release.yml`](templates/github-actions/release.yml).
If a host gate is required, use the two-job
[`reviewed-release.yml`](templates/github-actions/reviewed-release.yml): its
uncredentialed prepare job hands one exact hosted reference to a protected
publish job.

Consumer templates bind the Action only after candidate certification:

```yaml
uses: mannyc2/ts-release/apps/ts-release-action@v0.2.0
```

Plan 221 replaces that token with the exact immutable candidate version before
packaging. No public document may invent a floating Action tag.

## Library API

The root package exposes the same lifecycle used by the CLI and Action:

```ts
import { makeReleaseApi } from "@mannyc1/ts-release"
import { NodeReleaseLayer } from "@mannyc1/ts-release/node"

const api = makeReleaseApi(NodeReleaseLayer)
const result = await api.release({ config: { project: {}, versionFrom: "manifest" }, workspace: process.cwd() })
await api.dispose()
console.log(result.prepared.directory)
```

The public operations are `inspect`, `prepare`, `publish`, `release`, and
`correct`. The derived graph is ephemeral; the prepared manifest and blobs are
the durable cross-process boundary.

## Agent integration and development

The single tracked agent source owner is
[`apps/ts-release-agents`](apps/ts-release-agents/). Generated provider-native
packages are build output under `.release/agents/` and are captured by the
self-release preparation.

```sh
bun install --frozen-lockfile
bun run check:portable
bun test
```

Architecture is documented in [ARCHITECTURE.md](ARCHITECTURE.md), the precise
boundary in [SPEC.md](SPEC.md), and contributor operations in
[docs/release-runbook.md](docs/release-runbook.md).
