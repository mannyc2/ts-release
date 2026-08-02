# Where ts-release fits

Per axis, with no headline verdict. Every row below is annotated with something
a machine can check (`bun run check:docs-claims`), so a row that stops being
true fails the build instead of aging quietly.

**About the GoReleaser column.** This project has never executed GoReleaser.
Every GoReleaser statement here is read from its configuration schema and
documentation at the pinned version `v2.16.0`, and is phrased as such. Nothing
here is an observation of its runtime behavior, and nothing here claims one tool
is better than the other.

If you are releasing a Go project, use GoReleaser. This document is for
TypeScript and Bun authors deciding what to use for theirs.

## 1. What actually executes

The axis that motivates this tool.

ts-release compiles a configuration into canonical plan bytes with a `PlanId`,
and that is the artifact you review. Apply refuses to plan, refuses to read a
configuration, and refuses bytes whose identity does not match what was
approved — so the thing that runs is the thing that was read.
<!-- claim command:check:release -->
The self-release gate compiles the repository's own plan on every run, and the
plan bytes are re-derived byte-for-byte from the value alone.

<!-- claim test:test/core/release-handoff.test.ts -->
Approvals are receipts, not flags: an execution receipt binds a review
challenge, a run, and an approver identity, and a second process that never saw
the first one's memory re-derives the same challenge from the durable record.

<!-- claim section:hooks.after -->
Hooks are typed plan rows — argv arrays with declared environment names, not
opaque shell strings — so they are visible at review like everything else.
<!-- claim section:publish.custom -->
Custom publishers are the same: typed rows carrying an explicit risk class
(`writes-local`, `externally-visible`, `irreversible`).

<!-- claim section:catalogs -->
Catalog content (Homebrew formulae, Scoop manifests, marketplace files) is
authored with a CLOSED set of typed holes — a checksum, an asset name, a
download URL — rather than a template language. There is no second expression
grammar to learn or to sandbox.

<!-- claim docs-derived:121 -->
Per GoReleaser's v2.16.0 configuration schema, hooks are shell command strings
expanded through its template engine, and its documented model runs the pipeline
directly rather than emitting a reviewable intermediate document.

## 2. When something goes wrong halfway

<!-- claim section:retry -->
A run writes a durable ledger. Every operation records its attempts and their
outcomes, so a release that dies after publishing to npm but before creating the
GitHub release RESUMES from that point rather than starting over.

<!-- claim test:test/core/apply.test.ts -->
A publication whose outcome is genuinely unknown — the request went out, the
response never came back — becomes a durable `CommitUnknown` state that STOPS
the run. It is never guessed, never retried blind. Getting out is an explicit
operator act: reconcile to observe the remote, resolve to judge, retry to
re-attempt something proven absent. See [recovery.md](./recovery.md).

<!-- claim test:test/core/ship-cutover.test.ts -->
This survives one-shot mode. `ts-release ship` writes the same ledger a staged
release does, so a failed one-shot run continues as a staged apply with no
migration — and the receipts still show which parts had an independent
reviewer.

<!-- claim docs-derived:121 -->
Per GoReleaser's v2.16.0 documentation, the documented recovery model is
re-running the pipeline, with `--continue-on-error` controlling whether a failed
step stops it.

## 3. What it can publish

Ordered by how often the surface appears in real release configurations
(builds and archives dominate; announcements are rare).

| Surface | Status |
|---|---|
| <!-- claim section:builds --> Cross-target builds | Bun compile, command builders, prebuilt binaries |
| <!-- claim section:archives --> Archives | tar.gz and zip, files-only patterns, deterministic entries |
| <!-- claim section:checksum --> Checksums | sha256/sha512 with a templated name |
| <!-- claim section:publish.changelog --> Changelog | deterministic generation, reviewed note transforms |
| <!-- claim section:publish.github --> GitHub releases | assets, draft/prerelease, forge catalog PRs |
| <!-- claim section:publish.npm --> npm | trusted publishing, provenance, access |
| <!-- claim section:publish.homebrew --> Homebrew | formula generation into a tap repository |
| <!-- claim section:publish.scoop --> Scoop | manifest generation into a bucket repository |
| <!-- claim section:publish.pypi --> PyPI | wheels per target, trusted publishing |
| <!-- claim section:publish.packageStores --> Package stores | Snap and Chocolatey |
| <!-- claim section:supplyChain --> Supply chain | detached signing, attestation, notarization |
| <!-- claim section:publish.providers --> Generic providers | GitLab, Gitea, S3, GCS, Azure Blob, Artifactory, Cloudsmith, Gemfury, Docker Hub metadata |
| <!-- claim section:publish.announce --> Announcements | fifteen channel profiles including Slack, Discord, Mastodon, Bluesky, and SMTP |

Also generated as package formats: nfpm-family Linux packages, MSI, NSIS, DMG,
macOS `.app` and `.pkg`, Flatpak, makeself, and source RPM.
<!-- claim test:src/recipes/packages/profiles.ts -->
These are product-owned immutable profiles; applications cannot register their
own.

Not supported, deliberately:

| Surface | Why |
|---|---|
| <!-- claim absent:aur --> Arch User Repository | no profile exists; not planned |
| <!-- claim absent:winget --> WinGet | no profile exists; not planned |
| <!-- claim absent:helm --> Helm charts | out of scope for a CLI/package release tool |
| <!-- claim absent:krew --> kubectl plugins (krew) | out of scope |
| Container image build and push | Docker Hub metadata is a provider surface; building and pushing images is not this tool's job |
| Config includes / a second template language | recorded rejection: one closed placeholder set, no template DSL |
| Execute-as-you-go semantics | recorded rejection: the plan/apply split is the product |

## 4. What it costs you to use

<!-- claim test:test/core/workflow-shape.test.ts -->
CI is a workflow call with four inputs; the plan/materialize/publish staging,
the id threading, and the artifact handoff come with it.

<!-- claim command:check:cli-bundle -->
Locally it is `ts-release init` then `ts-release ship --from-git`, from an npm
install that runs under plain Node.

<!-- claim test:test/core/resolve.test.ts -->
The configuration you write can omit what the repository already knows — the
version, the tag, the commit — and a stated value that contradicts an observed
one is refused rather than silently preferred.

<!-- claim test:test/core/ship-cutover.test.ts -->
Graduating from one-shot to reviewed releases costs nothing: same config, same
plan file, same ledger, four staged commands instead of one.

The costs are real too. The configuration is closed-world and strict: unknown
fields are refused, and there is no inference beyond the resolver's explicit
rules. The target matrix above is smaller than GoReleaser's documented one.
Reviewing plan bytes is a step you do not have with a tool that just runs.
