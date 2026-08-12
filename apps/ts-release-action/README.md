# ts-release Action app

This private first-party app is the GitHub Actions host boundary for the public
release API. It exposes exactly three commands: `release`, `prepare`, and
`publish`.

`release` is the automatic one-call path. It prepares the complete release,
uploads and verifies the content-addressed Actions artifact, emits
`prepared-ref`, and only then allows publication to continue. `prepare` uses
the same durable boundary for a reviewed split-job workflow. `publish` accepts
only the canonical prepared reference and authenticates its repository,
workflow, run, attempt, candidate commit, artifact name, and digest before
calling the public publisher.

The only outputs are `prepared-ref` and `report-ref`. A caught failure after a
durable commit retains the `gha:` reference and writes workflow-specific rerun
guidance to the step summary. It never recommends a local CLI command or an
unimplemented cross-run recovery path for a hosted reference.

GitHub job permissions and supplied tokens are job-scoped capabilities. The
automatic topology can delay their use, but the reviewed prepare/publish job
split is the stronger host authority boundary.

```sh
bun run --cwd apps/ts-release-action check
bun run --cwd apps/ts-release-action build
bun run check:action-bundle
```
