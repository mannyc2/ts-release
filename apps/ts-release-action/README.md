# ts-release Action app

This first-party app is the GitHub Actions host boundary for the public
release API. It exposes exactly three commands: `release`, `prepare`, and
`publish`.

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

Every advertised workflow requires `candidate_sha` and gates the whole job on
`refs/heads/main` plus equality between that input and `github.sha`; the
repository workflow additionally requires `mannyc2/ts-release`. A mismatch
therefore cannot reach checkout, dependency installation, or this Action.

The workflow templates consume `report-ref` by uploading that redacted file
with `if: always()`. They do not generically upload the prepared bundle; the
dedicated Action store owns that content-addressed transfer.

GitHub job permissions and supplied tokens are job-scoped capabilities. The
automatic workflow acquires them lazily, while the environment-gated
prepare/publish job split provides the stronger host authority boundary.

The Action metadata declares a Linux composite boundary. Each advertised
workflow installs pinned Bun before invoking the Action, and the composite
step runs the checked-in `dist/index.js` through that Bun runtime. The Action
bundle has its own entrypoint smoke gate; installed library and CLI consumers
still follow the root package engine.

```sh
bun run --cwd apps/ts-release-action check
bun run --cwd apps/ts-release-action build
bun run check:action-bundle
```
