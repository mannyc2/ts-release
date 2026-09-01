# ts-release

Automate multi-artifact releases and safely resume partial publication.

## Release locally

The normal path is one command from a clean Git checkout:

```sh
ts-release release --config release.config.json
```

`release` resolves observed package and Git facts, materializes the exact
verified commit, runs declared local preparation, commits one complete
`prepared-release/v2` bundle, observes every configured destination, and
publishes only after a provider-specific decision authorizes that exact
subject. The command prints the durable prepared reference and correlated
report. A blocked or uncertain report is preserved and exits nonzero.

npm authentication is always explicit. A GitHub-hosted npm and GitHub release
can use this authored configuration:

```json
{
  "project": { "repository": "owner/repo" },
  "versionFrom": "manifest",
  "npmPackage": { "path": "." },
  "publish": {
    "npm": {
      "authentication": {
        "strategy": "trusted-publishing",
        "attestation": {
          "provider": "github-actions",
          "runner": "github-hosted",
          "repository": "owner/repo",
          "workflow": "release.yml",
          "workflowRef": "refs/heads/main",
          "allowedAction": "npm-publish-direct"
        }
      }
    },
    "github": {}
  }
}
```

`workflow` and `workflowRef` are local host-admission constraints, not claims
about fields exposed by npm's trusted-publisher configuration. They must name
the workflow that actually invokes publication: use `release.yml` with the
automatic template and `reviewed-release.yml` with the reviewed template. The
host must observe that exact repository/path/ref on a GitHub-hosted runner
before it reads either OIDC request value. Public npm metadata reads are always
anonymous; private or custom-registry authenticated reads are unsupported
until configured with a distinct read credential.

The resolver fills package name, version, tag, commit, and repository only
when observed facts agree with authored intent. For a non-OIDC host, use
`{ "strategy": "token", "credential": "NPM_TOKEN" }` instead. The value of
that environment variable remains host-owned and never enters configuration,
prepared bytes, reports, or logs.

Prebuilt Python distributions can be published to the closed `pypi` or
`testpypi` destination. Each named artifact must be a valid wheel or gzip
sdist whose filename and embedded metadata agree with the configured project
and version:

```json
{
  "project": { "name": "fixture", "version": "1.0.0", "tag": "v1.0.0" },
  "artifacts": [
    { "id": "wheel", "path": "dist/fixture-1.0.0-py3-none-any.whl", "format": "file" }
  ],
  "publish": {
    "pypi": {
      "artifacts": ["wheel"],
      "repository": "pypi",
      "authentication": {
        "strategy": "token",
        "credential": "PYPI_TOKEN",
        "scope": "project"
      }
    }
  }
}
```

PyPI token upload additionally requires the host to install a shared,
durable terminal `PublicationClaimStore`; runner-local files and memory do not
satisfy that contract. The stock CLI and Action deliberately fail closed
without one. Library hosts can pass it to `makeNodeReleaseLayer`,
`makeBunReleaseLayer`, or `makeCustomReleaseLayer`. The token is projected as
PyPI Basic authentication only inside the authorized HTTP sink. PyPI trusted
publishing is represented as an external, host-owned
`pypa/gh-action-pypi-publish@release/v1` path; the stock coordinator neither
exchanges its OIDC token nor claims to recover that external upload.

This repository's selected self-release shape is declared in
`apps/release-ts/pypi-release.config.json`. It deterministically embeds one
native executable in each of these `ts-release` wheels:

- `py3-none-manylinux_2_17_x86_64`
- `py3-none-manylinux_2_17_aarch64`
- `py3-none-macosx_13_0_x86_64`
- `py3-none-macosx_13_0_arm64`

`.github/workflows/pypi-release.yml` prepares the exact four-file set in a
read-only build job, transfers it with GitHub Actions artifact retention, and
gives only the separate `pypi` environment job `id-token: write`. That job has
no checkout or arbitrary command step; it downloads the prepared wheels and
invokes the official PyPA trusted-publishing Action. The PyPI publisher must
be configured for owner `mannyc2`, repository `ts-release`, workflow
`pypi-release.yml`, branch `main`, and environment `pypi` before dispatch.
The macOS wheel tags certify the cross-compiled artifact targets; they do not
expand the product's Linux-only execution-host claim.

With the canonical GitHub origin or package repository configured, `init` can
discover the exact owner/repository coordinate and write this explicit shape:

```sh
ts-release init --preset bun-npm-github
```

It refuses to guess when no repository coordinate is observable and strictly
inspects the exact generated configuration before writing it.

## Automatic GitHub Actions release

The default workflow is one job and one Action invocation. Copy the exact
[automatic workflow template](templates/github-actions/release.yml). It is
manual-only and requires `candidate_sha` to equal the current commit on
`refs/heads/main` before the job can reach checkout. Its
mutation job grants `contents: write` for the same-repository tag, release, and
assets, `id-token: write` for npm trusted publishing, and `actions: read` for
prepared-artifact recovery. It installs the publisher boundary explicitly,
uses the job-scoped `GITHUB_TOKEN`, and uploads the redacted report as a
recovery artifact.

```yaml
- id: release
  uses: mannyc2/ts-release/apps/ts-release-action@v0.2.2
  env:
    GITHUB_TOKEN: ${{ github.token }}
  with:
    command: ${{ inputs.prepared_ref == '' && 'release' || 'publish' }}
    config: ${{ inputs.prepared_ref == '' && 'release.config.json' || '' }}
    prepared: ${{ inputs.prepared_ref }}
```

Leave `prepared_ref` empty for a fresh release. To resume after durable
preparation, dispatch the same candidate with the exact emitted
`prepared:gha:` reference; the job selects `publish`, loads and verifies the
original bundle, and does not rebuild.

`v0.2.2` is the immutable monorepo-subpath coordinate intended for this
candidate. Packaging and release certification must stop unless that tag is
created from the exact certified result commit before consumers can see a
README that names it. A floating Action branch is never an alternative.

## Optional environment-gated publication

When a host policy requires a protected environment, use the
[two-job workflow template](templates/github-actions/reviewed-release.yml).
Copy its paired
[reviewed configuration](templates/npm-github/reviewed-release.config.json)
to the repository root with the same filename; the workflow loads that exact
file.
Its prepare job has read-only repository authority and no OIDC permission. It
uploads one complete prepared bundle and passes only its content-addressed
hosted reference. The environment-gated publish job installs the publisher
toolchain, receives mutation permissions, reloads and verifies the bundle, and
then observes destinations before any write. The environment gate remains a workflow
fact; it is not release-engine identity or data.

The reviewed configuration attests `workflow: "reviewed-release.yml"` and
`workflowRef: "refs/heads/main"`. Keep the workflow filename and dispatch it
from that ref with `candidate_sha` equal to the current commit, or deliberately
update both constraints. Reusing an automatic configuration that attests
`release.yml` fails before OIDC acquisition. Recover a failed reviewed
publication by rerunning the publish job in the same workflow run, not by
preparing again.

## Prepare without publication

Use the split local path for build-only work or when bytes must cross an
explicit host boundary:

```sh
prepared_ref="$(ts-release prepare --config release.config.json)"
ts-release inspect "$prepared_ref"
```

The value is a path-free `prepared:local:sha256-…` reference resolved against
the selected content-addressed store. `--store` selects another local store;
the reference itself never embeds a filesystem path. Publication accepts only
a complete reference and never rebuilds from source as a fallback.

Local extension work uses two primitives. `CommandCheck` is a pass/fail gate.
`CommandArtifact` generates or transforms declared regular-file bytes. Data
flow uses declared input and output IDs. Generic preparation children receive
no authored host environment values, and the runner may retain only `PATH` as
argv execution plumbing. Trusted commands are not a sandbox or a generic
remote-effect mechanism.

## Observe and recover

Observation is read-only:

```sh
ts-release observe "$prepared_ref"
```

To resume a partial or response-lost release, publish the same reference:

```sh
ts-release publish "$prepared_ref"
```

Every attempt verifies the manifest and blobs, then reobserves every subject.
Equivalent subjects are skipped. Conflict and pre-mutation uncertainty stop
without mutation. A post-dispatch unknown outcome stays uncertain until a new
exact observation converges. Publication is not an atomic transaction, so a
release may partially succeed and there is no universal rollback.

## Provider-specific correction

Correction is deliberately separate from ordinary publication:

```sh
ts-release correct "$prepared_ref" correction.json
```

The command binds authored intent to the exact prepared provider subject. npm
and GitHub Release corrections remain canonical external operator proposals.
Catalog Git installs one conditional `forward-catalog-state` correction: it
requires a SemVer-newer replacement and changes both the consumer formula or
manifest and its managed-state record against the exact observed branch
generation. Deletion, arbitrary inverse operations, and announcements are not
release destinations.

## Capability and platform boundary

A source checkout or accepted field is not support evidence. The generated
capability inventory must join each supported row to its strict decoder,
default-layer entrypoint, exact observation semantics, and vertical test, and
the release-candidate matrix must exercise every claimed execution host.

| Axis | Kernel candidate boundary |
| --- | --- |
| Local preparation | Bun compilation, prebuilt imports, command checks/artifacts, archives, and checksums are retained; final support requires the generated capability and clean-candidate gates to agree. |
| Remote publication | npm, prebuilt PyPI distributions, GitHub Releases, and typed Homebrew/Scoop catalog Git delivery are installed. npm uses explicit trusted-publishing or token authentication; PyPI token writes require a host-supplied shared terminal claim store, and its trusted-publishing strategy is external-host-owned. |
| Correction | npm and GitHub authored proposals are exact-bound; PyPI yanking is observation-only; catalog Git installs exact paired SemVer-forward correction. |
| Execution hosts | Linux is the only installed execution host. The checked-in Action is a native Node 24 launcher around a workflow-installed, pinned Bun runtime. macOS and Windows are not ts-release execution hosts. |
| Artifact targets | The Bun builder advertises Linux and macOS x64/arm64 targets. macOS binaries are cross-compiled artifacts, not host-execution evidence. The self-release does not distribute a Windows ts-release binary. |
| Native tools | Linux preparation requires an external Bun executable and `libseccomp.so.2`; network-denied commands record both identities. WSL, when used, is Linux. A standalone CLI binary is not a self-contained replacement for these tools. |

Installed Node consumers must satisfy the package engine
`^22.22.2 || ^24.15.0 || >=26.0.0`; Bun consumers require Bun 1.3.14 or newer.
The checked-in Action uses GitHub's native Node 24 Action handler so the runner
can inject its Actions-artifact transport credentials. Its tiny checked-in
launcher passes no credentials to the Bun 1.3.14 runtime preloader, then runs
the checked-in `dist/index.js` through the workflow-installed Bun runtime.
Preparation stays in Bun, while every Actions-artifact upload or download is
delegated to the checked-in Node 24 bridge so the official artifact client runs
on its native stream implementation. The Action does not change the Node
engine of the installed library or CLI package.

The current source tree is not a release certificate. A published support
claim exists only after the clean-candidate evidence records all required
gates green; skipped live facts remain `UNVERIFIED`.

## Extension jobs and exclusions

The kernel translates extension requests to the owner that can enforce them:

| User job | Owner |
| --- | --- |
| Tests, policy checks, generated notes, and agent bundles | `CommandCheck` or declared `CommandArtifact` bytes |
| npm, prebuilt PyPI, GitHub Release, and catalog Git remote verification/publication | Installed provider modules; PyPI token mutation also requires the shared terminal claim boundary |
| Environment protection or human authorization | External workflow host |
| Downstream announcements | External workflow step after a complete report |

Homebrew and Scoop rendering/delivery use typed renderers and an exact paired
Git Data subject; arbitrary whole-file catalog templating remains excluded.
Generic wrapper-wheel generation remains excluded from the prebuilt PyPI
capability. The repository-specific four-wheel `ts-release` self-release is an
explicit product decision and is prepared by its dedicated workflow. PyPI
support is contract-tested but has not been live-write-dogfooded in this wave.
Custom library applications may compose full provider subjects through the
[`provider-sdk`](https://github.com/mannyc2/ts-release/blob/main/docs/native-extensions.md)
subpath. The stock CLI and Action
do not discover packages or treat generic hooks as remote publishers.

## Library API

The Promise API uses the same lifecycle as the CLI and Action:

```ts
import {
  defineRelease,
  encodeCompletePreparedReleaseRef,
  makeReleaseApi
} from "@mannyc1/ts-release"
import { NodeReleaseLayer } from "@mannyc1/ts-release/node"

const config = defineRelease({
  project: { repository: "owner/repo" },
  versionFrom: "manifest" as const,
  npmPackage: { path: "." },
  publish: {
    npm: {
      authentication: {
        strategy: "trusted-publishing" as const,
        attestation: {
          provider: "github-actions" as const,
          runner: "github-hosted" as const,
          repository: "owner/repo",
          workflow: "release.yml",
          workflowRef: "refs/heads/main",
          allowedAction: "npm-publish-direct" as const
        }
      }
    },
    github: {}
  }
})

const api = makeReleaseApi(NodeReleaseLayer)
try {
  const result = await api.release({ config, workspace: process.cwd() })
  console.log(encodeCompletePreparedReleaseRef(result.prepared))
  console.log(result.report.status)
} finally {
  await api.dispose()
}
```

The public operations are `inspect`, `prepare`, `observe`, `publish`,
`release`, and `correct`. Public inputs contain neither credential values nor
prepared paths. The derived graph is ephemeral; the verified prepared
manifest and blobs are the durable cross-process boundary.

The separate `@mannyc1/ts-release/operation-journal` subpath exposes the
provider-neutral canonical envelope and one S3 CAS protocol for durable
external-operation continuation. It stores consumer-owned opaque bytes and
never decodes provider fields. Workflow repository/run coordinates are derived
from the re-observed GitHub OIDC session rather than accepted from an append
request. A host can supply one already-authenticated, exact-policy S3 boundary
as the credential-agnostic qualification seam. The separate
`@mannyc1/ts-release/operation-journal/aws` subpath is the only operational
backend implementation: it accepts one sealed activation contract, rejects
ambient AWS variables and shared files, requests GitHub OIDC directly, uses
only the returned short-lived role session, and parses live STS, IAM, bucket,
Object Lock, ownership, public-access, and policy responses. It accepts no
profile, credential, endpoint, alternate bucket, or fallback-store input.
Operation identities are bounded to 65,536 bytes, payloads to 1,048,576 bytes,
and retained objects to 1,500,000 bytes before hashing or allocation. The AWS
trust and activation contract require the
reusable workflow to be called as `uses: .../operational-journal.yml@<40-hex>`;
a branch or tag ref is not authority, and the observed `job_workflow_ref` SHA
must equal `job_workflow_sha`. The frozen subject selects exactly one GitHub
environment-subject form: name-bound `repo:owner/repository:environment:name`
or immutable-ID-bound
`repo:owner@ownerId/repository@repositoryId:environment:name`; observed IDs
must reconstruct the latter exactly, and there is no runtime fallback between
forms. The same STS-admitted token must also report `workflow_dispatch`, a
branch ref, a public repository, and a GitHub-hosted runner. Every OIDC fetch,
AWS SDK send, and retained-object stream has a fixed 10,000 ms wall-clock
deadline in addition to single-attempt retry policy.

The checked-in `operational-journal.yml` is intentionally inert: it has no
OIDC permission, AWS coordinate, credential input, checkout, or executable
adapter and always stops. Activating it requires the separately provisioned
bucket/role, a released adapter version, a reviewed opaque-byte caller/callee
transport, and qualification of the exact retained object protocol. The
serialized SDK requests, structural boundary, and fake tests are not live AWS
or workflow qualification.
An activated reusable job must install the package-supported Node 22.22.2
runtime independently of the caller and launch the adapter through an
`env -i` allowlist containing only the exact Actions OIDC request coordinates
and non-secret activation inputs. The caller's Node 24.14.1 runtime is below a
transitive dependency's admitted Node 24 floor and must not run this package.

## Agent bundles and development

The single tracked agent source owner is `apps/ts-release-agents`. Generated
Codex and Claude layouts are ignored build output and are captured by the
self-release as declared `CommandArtifact` outputs. No root marketplace tree
is a second canonical owner.

```sh
bun install --frozen-lockfile
bun run check:portable
bun test
```

The durable model is documented in [ARCHITECTURE.md](ARCHITECTURE.md), and the
precise public contract is in [SPEC.md](SPEC.md). Both files are included with the npm
package; this README does not rely on an unpackaged relative document.
