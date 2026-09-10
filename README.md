# ts-release

Prepare immutable release artifacts, publish through explicit provider adapters,
and resume partial releases using the same durable journal.

## Run a release application

This checkout contains the 0.4 implementation. To try it before publication, build
and pack it from this repository:

```sh
bun install --frozen-lockfile
bun run build:delivery
bun pm --cwd packages/ts-release pack --ignore-scripts --filename /tmp/ts-release.tgz
```

In your application repository, install that archive and run your authored
JavaScript application:

```sh
bun add /tmp/ts-release.tgz effect@4.0.0-beta.107
ts-release ./release.mjs ./release-input.json > release-report.json
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

## Inspect progress and recover

```sh
ts-release --observe ./release.mjs ./release-input.json > release-report.json
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
partial; retain the journal rather than infer success from process output.

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
access and approval. The self-release application currently rehearses preparation
and validation with publication disabled.

Read [design decisions](docs/design-decisions.md) for the recovery rationale and
[plugin distribution](docs/skill-distribution.md) for catalog delivery.
