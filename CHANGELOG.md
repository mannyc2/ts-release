# Changelog

## 0.2.1 - 2026-08-14

This release delivers the intended `0.2` product relative to `0.0.7` and
supersedes the incomplete immutable `v0.2.0` GitHub release.

### Release repair

- Preserve caller-declared HTTP body media types through the Effect transport,
  so GitHub agent archives retain `application/zip` instead of being rewritten
  to `application/octet-stream`.
- Authenticate recovery against the canonical workflow path and `head_branch`
  fields returned by GitHub's run-attempt API, allowing an emitted immutable
  prepared reference to be reloaded in a later workflow run.

### Release lifecycle

- Replaced the previous `ship` and plan/apply/review command model with one
  lifecycle: `release`, `prepare`, `inspect`, `observe`, `publish`, and
  `correct`. The same lifecycle is available through the Promise API, CLI, and
  GitHub Action.
- Added complete, content-addressed `prepared-release/v2` bundles. Preparation
  materializes the exact verified commit, binds declared source inputs, checks
  the manifest and blobs, and commits the durable bundle only when every
  declared output is present.
- Added one-command local release and a one-job automatic GitHub Actions path.
  Protected-environment publication remains an optional two-job host workflow,
  not an identity inside ts-release.
- Added a strict `bun-npm-github` init preset that discovers the canonical
  repository coordinate and writes explicit npm and GitHub authentication
  intent.

### Publication, authentication, and recovery

- Retained npm publication and restored explicit trusted-publishing intent.
  npm authentication must select GitHub Actions OIDC or a named token
  credential; credential values remain host-owned and do not enter
  configuration, prepared bytes, reports, or logs.
- Retained GitHub Releases and asset publication with exact tag, commit,
  release, and asset observation before mutation.
- Publication now observes every destination before writing. Equivalent
  subjects are skipped, conflicts stop, and inconclusive pre-mutation reads do
  not acquire credentials. A response-lost write remains uncertain until an
  exact later observation converges.
- Recovery always reloads and verifies the same prepared bundle. It never
  rebuilds from the current checkout as a fallback. Reports preserve partial
  and uncertain outcomes and are redacted before a workflow uploads them.
- Correction is now proposal-only for the installed npm and GitHub providers.
  `correct` binds intent to an exact prepared subject and emits a canonical
  external-operator proposal; it does not delete or mutate provider state.

### Executable capabilities

- Retained Bun compilation, prebuilt-file imports, declared command checks and
  artifact generation, archives, and checksums behind strict configuration and
  default runtime layers.
- Separated execution-host claims from artifact-target claims. Linux is the
  only execution host, the advertised targets are Linux/macOS x64/arm64, and
  Windows is neither an execution host nor a shipped target.
- Added generated capability, recovery-profile, and agent-bundle evidence so a
  documented support row must join to executable code and tests.

### Breaking removals and migration

- Removed the old `ship`, plan/apply/review, approval, and self-review
  protocols. Migrate automation to `release`, or cross an explicit boundary
  with `prepare` followed by `publish` of the returned prepared reference.
- Replaced implicit npm credential selection with explicit
  `publish.npm.authentication`. Existing token workflows must name their
  environment credential; GitHub-hosted trusted publishing must author its
  exact attestation relationship.
- Installed Node consumers now require
  `^22.22.2 || ^24.15.0 || >=26.0.0`. The checked-in GitHub Action is now a
  native Node 24 launcher around a Linux/Bun boundary: advertised workflows
  install pinned Bun, the runtime preloader receives no credentials, and the
  Bun release child receives the runner's Actions-artifact transport. Artifact
  upload/download is executed by a checked-in Node 24 bridge so the official
  client uses native Node streams; bridge requests never serialize the GitHub
  token. This does not change the installed library or CLI's Node engine.
- PyPI prebuilt publication is temporarily removed despite being available in
  `0.0.7`; it is assigned to a post-`0.2.1` provider-capability wave. PyPI
  wrapper wheels are also removed, and will return only after an explicit
  product decision based on native-wheel or cibuildwheel-class user demand.
- Homebrew tap and Scoop bucket rendering and delivery are temporarily removed
  despite being available in `0.0.7`; they are assigned to a separate catalog
  delivery wave. Old PyPI, Homebrew, Scoop, and generic catalog configurations
  are rejected rather than accepted as no-ops.
- A third-party publication-adapter SDK is not part of `0.2.1`. Local extension
  work must use declared command checks or artifact bytes; downstream effects
  belong in the workflow host after a complete release report.

## 0.2.0 - incomplete (2026-08-14)

The immutable GitHub tag and release were created, but asset publication did
not complete and npm was not published. Those immutable subjects remain as an
audit record and are superseded by `0.2.1`; no `0.2.0` subject was rewritten.
