# ts-release Action app

This first-party app is the GitHub Actions host boundary for the public
release API. It exposes exactly four commands: `release`, `prepare`, `inspect`,
and `publish`.

`release` is the automatic one-call path. It prepares the complete release,
uploads and verifies the content-addressed Actions artifact, emits
`prepared-ref`, and only then allows publication to continue. `prepare` uses
the same durable boundary for an environment-gated split-job workflow. `publish` accepts
only the canonical prepared reference and authenticates its repository,
workflow identity and revision, candidate commit, producer run and attempt,
artifact name, and digest before calling the public publisher.

The only outputs are `prepared-ref` and `report-ref`. A caught failure after a
durable commit retains the `gha:` reference and writes workflow-specific rerun
guidance to the step summary. The automatic workflow accepts that exact value
as its optional `prepared_ref`: an empty value selects `release` with config,
while a nonempty value selects `publish` without config or re-preparation. Its
job has `actions: read` so a later run in the same repository, workflow,
workflow revision, and candidate boundary can load the producer run's
artifact. The reviewed workflow instead recovers by rerunning its failed
publish job in the same workflow run, preserving the prepare output.

`inspect` consumes the same authenticated durable reference without mutation;
the repository self-release uses it to prove exact npm state before GitHub
Release authority can run.

Every advertised workflow requires `candidate_sha` and gates the whole job on
`refs/heads/main` plus equality between that input and `github.sha`. The
repository self-release adds one unconditional admission job that validates
the canonical repository ids, workflow ref/SHA, mode, and prepared-reference
topology, then emits the sole selected authority job. Invalid input therefore
fails the workflow instead of skipping every authority job and looking green.

The workflow templates consume `report-ref` by uploading that redacted file
with `if: always()`. They do not generically upload the prepared bundle; the
dedicated Action store owns that content-addressed transfer.

GitHub job permissions and supplied tokens are job-scoped capabilities. The
automatic workflow acquires them lazily, while the environment-gated
prepare/publish job split provides the stronger host authority boundary.

The Action metadata declares GitHub's native Node 24 handler so the runner
injects the private Actions-artifact transport only at the Action process
boundary. The checked-in launcher refuses before preparation if that transport
is unavailable, launches the Bun runtime preloader with no credentials, and
then passes the native Action environment to the checked-in Bun `dist/index.js`
bundle. The Bun release process delegates only Actions-artifact upload and
download to the checked-in Node 24 bridge; cross-run tokens are reconstructed
at that Node sink and are never serialized into its request file. Each
advertised workflow installs pinned Bun before invoking it. Credentialed
self-release producers are followed, even on failure, by a separate private
Node 24 Action that admits one exact redacted report, uploads it once, and
rereads its artifact identity and bytes without blind resubmission. That
retention process rejects GitHub, npm, and OIDC publication credentials. The
npm OIDC jobs blank their request coordinates on every step except the sole
certifier or publisher, and GitHub publication moves npm inspection into a
separate read-only preflight whose retained identity is handed to the writer.
Its strict
kind set includes the non-mutating `npm-oidc-certification` receipt as well as
tag, npm publish/inspect, and GitHub publish reports. The direct self-release
certification job stays in `release.yml`, adopts the prepared npm bytes without
repacking, and proves only one OIDC dry-run exchange with no registry mutation;
it does not claim upload, provenance, or publication. All four
checked-in bundles have disposable rebuild and entrypoint gates; installed
library and CLI consumers still follow the root package engine.

```sh
bun run --cwd apps/ts-release-action check
bun run --cwd apps/ts-release-action build
bun run check:action-bundle
```
