# ts-release

ts-release automatically prepares and publishes a configured software release.
The normal path is one command:

```sh
ts-release init --preset bun-npm-github
ts-release release --config release.config.json
```

`release` observes the clean source checkout, runs declared local preparation,
stores one exact `prepared-release/v1` bundle, observes each destination, and
publishes only after a provider-specific decision authorizes the exact subject. An external host
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
the runtime registry and dated evidence. Build, archive, and checksum
preparation remain certified. npm and GitHub are present as conservative
subjects: direct mismatches block, while equality, absence, and mutation stay
unsupported until their provider contracts are certified. Catalog delivery
and forward correction likewise remain explicit unsupported boundaries.

ts-release runs on Linux and macOS. Its Bun builder can produce Windows
artifacts. It does not claim native Windows execution or native Windows tools.

## Optional preparation boundary

Use the two-operation form when a host must transfer bytes between jobs:

```sh
prepared_ref="$(ts-release prepare --config release.config.json)"
ts-release inspect "$prepared_ref"
ts-release observe "$prepared_ref"
ts-release publish "$prepared_ref"
```

The value is a path-free `prepared:local:sha256-…` reference resolved against
the default local store. Select another store explicitly with `--store`; the
reference itself never embeds a filesystem location. The publisher accepts
only a complete prepared reference. It does not rebuild from source or accept
authored configuration as a publication fallback.

Local preparation uses two native primitives. `CommandCheck` is a pass/fail
gate; `CommandArtifact` generates or transforms declared regular-file bytes.
Use artifact input/output references for data flow. Trusted argv commands may
read only the declared environment names and are not a sandbox or a generic
remote-effect mechanism. Durable test or compliance evidence must be a
declared artifact. See [the preparation guide](docs/preparation.md).

## Recovery

Rerun the same prepared reference. Every attempt reloads and verifies the
exact bytes, then reobserves every subject. Equivalent subjects are skipped;
conflicting or inconclusive observations stop without mutation. A release may
partially succeed; publication is not an atomic transaction and there is no
universal rollback. Provider-specific forward correction is explicit only
where the capability inventory proves it. Announcements, deletion, and
generic inverse operations are not configured destinations.

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

Plan 233 certification will verify the exact immutable candidate reference
before packaging. No public document may invent a floating Action tag.

## Library API

The root package exposes the same lifecycle used by the CLI and Action:

```ts
import { encodeCompletePreparedReleaseRef, makeReleaseApi } from "@mannyc1/ts-release"
import { NodeReleaseLayer } from "@mannyc1/ts-release/node"

const api = makeReleaseApi(NodeReleaseLayer)
const result = await api.release({ config: { project: {}, versionFrom: "manifest" }, workspace: process.cwd() })
await api.dispose()
console.log(encodeCompletePreparedReleaseRef(result.prepared))
console.log(result.report.status)
```

The public operations are `inspect`, `prepare`, `observe`, `publish`,
`release`, and `correct`. Public inputs contain neither credential values nor
prepared paths. The derived graph is ephemeral; the prepared manifest and
blobs are the durable cross-process boundary.

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
