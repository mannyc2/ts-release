# ts-release

Prepare immutable release artifacts, publish through explicit provider adapters,
and resume partial releases using the same durable journal.

## Run a release application

Install the 0.4 core and the providers your application uses. An npm/GitHub
application uses this version-aligned set:

```sh
bun add @mannyc1/ts-release@0.4.0 @mannyc1/ts-release-npm@0.4.0 @mannyc1/ts-release-github@0.4.0 effect@4.0.0-rc.115
bun run ts-release ./release.mjs ./release-input.json > release-report.json
```

The [release page](https://github.com/mannyc2/ts-release/releases/tag/v0.4.0)
records published availability and the tested Action commit. If evaluating an
unpublished checkout, build and pack it from this repository:

```sh
bun install --frozen-lockfile
bun run build:delivery
bun pm --cwd packages/ts-release pack --ignore-scripts --filename /tmp/ts-release.tgz
```

In your application repository, install that archive and run your authored
JavaScript application:

```sh
bun add /tmp/ts-release.tgz effect@4.0.0-rc.115
bun run ts-release ./release.mjs ./release-input.json > release-report.json
```

`release.mjs` exports `createApplication(input)`, a scoped Effect returning
`{ bundle, host, options }`. Your application selects providers, credentials,
content storage and journal storage. `options.plan` identifies the prepared
operations; `options.authorize` explicitly controls publication. Input JSON has
an application-defined format. Ambient `TS_RELEASE_AUTHORIZE` does not grant
permission. See [the application guide](docs/preparation.md) for the contract.

There is no built-in configuration wizard or `prepare`/`publish` subcommand.
Build preparation belongs to your application: own the artifact bytes, finalize
the Bundle, construct the Plan, then retain both and the content they reference.
For later publication, load those same bytes and identities rather than rebuild.

The [npm/GitHub starter](templates/npm-github) supplies a complete preparation
command and application. Its generated JavaScript is the same application used
to release this repository. The current starter targets the 0.4.2 candidate;
use that checkout's retained package archives until 0.4.2 is published.

## Inspect progress and recover

```sh
bun run ts-release --observe ./release.mjs ./release-input.json > release-report.json
```

This loads the same trusted application and invokes `observeRelease`. It refreshes
provider observations and records evidence in the journal without dispatching
publication. Application setup is trusted code and may perform its own effects.
Read the JSON report's `operations` and `journal.revision`.

To continue, rerun the original command with the same Bundle, Plan and durable
journal. A fresh runner may use a new local cache, but must access the same
journal remote and original content. Completed operations are recognized;
unresolved dispatches are not resent merely because a destination looks absent.
See [recovery](docs/recovery.md) for status meanings and operator decisions.

The CLI writes JSON to stdout and diagnostics to stderr. Exit codes are 0 when
all operations are satisfied, 2 for incomplete progress, 1 for invalid usage or
application failure, and 130/143 for interruption. Interrupted output may be
partial; retain the journal rather than infer success from process output. A
failed run prints the application's `ReleaseError` code and message; keep those
free of secrets. Any other failure is named by type only, so defect text, paths
and native output never reach process logs.

## GitHub Action

The Action in `apps/action` is a native Node 24 launcher of the same application.
Install your application's dependencies and provide its original content and
journal access before invoking it. From a checkout containing this Action:

```yaml
- uses: ./apps/action
  with:
    application: release.mjs
    input: '{"releaseInput":"release-input.json"}'
    observe: "true"
```

The example JSON is application-defined; adapt it to your factory. Set `observe`
to `'false'` to run with the application's authorization policy. The outputs are
`plan-id` and `journal-revision`; the full report is emitted as JSON. Pin an
external Action to a reviewed commit containing the built `apps/action/dist`
launcher. No unpublished tag is promised here.

## Packages and development

The core exports planning, execution and recovery APIs. Subpaths separate
`bundle`, `http`, `git`, `node`, `bun`, `effect-build` and `apple` capabilities.
Provider packages cover npm, PyPI, GitHub, catalog files, MCP and OpenAI plugins.
Install the optional runtime/producer peers only for the subpaths you use.
Node engines are `^22.22.2 || ^24.15.0 || >=26.0.0`; Bun requires 1.3.14+.

```sh
bun install --frozen-lockfile
bun run check:portable
```

[Maintained checks](scripts/README.md) cover behavioral tests, package imports,
installed CLI and Action execution, and local provider fixtures. Public uploads,
Apple service acceptance and hosted Action execution need separate environment
access and approval. The production self-release application composes native npm
and GitHub providers. Installed acceptance exercises nonempty CLI/Action releases
over TLS, process interruption, delayed visibility and fresh journal caches. The
broader multi-provider preparation fixture is named `rehearsal.ts`.

Read [design decisions](docs/design-decisions.md) for the recovery rationale and
[plugin distribution](docs/skill-distribution.md) for catalog delivery.
The [Effect standards](docs/effect-standards.md) document service composition,
scoped ownership, interruption, callback types, and the consumer patterns adopted
by this checkout.

Upgrading from 0.3.1? Follow the [0.4 migration guide](docs/migration-0.4.md).
Maintainers can prepare and publish the complete seven-package release using the
[distribution runbook](docs/release-runbook.md). A successful CI run verifies the
candidate; the runbook separately verifies registry availability.
