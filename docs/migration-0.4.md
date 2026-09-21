# Migrating from 0.3.1 to 0.4

0.4 is a breaking change. The package name remains `@mannyc1/ts-release`, but
the CLI now runs an application you author. Updating the dependency alone does
not migrate an existing release configuration or an unfinished release.

## Finish existing releases first

Keep the 0.3.1 lockfile, CLI/Action pin, configuration, prepared content and any
publication journal needed by an unfinished release. Continue it with that exact
toolchain. Do not translate its prepared reference into a new 0.4 Plan and retry:
that would lose the record of writes that may already have happened.

0.4 accepts `ts-release/bundle/2` and `ts-release/plan/1`. It does not load the
old `prepared-release/v2` bundle or `prepared:local:` / `prepared:gha:` references.
The intermediate `ts-release/bundle/1` format is also rejected. Apple preparation
uses format 3. There is no automatic conversion of old journals, receipts or
unfinished attempts; the installed provider must understand each recorded codec
version. See [recovery](recovery.md) before changing providers on a retained Plan.

## Install the matching packages

The published 0.4.1 npm/GitHub packages install with:

```sh
bun add @mannyc1/ts-release@0.4.1 @mannyc1/ts-release-npm@0.4.1 @mannyc1/ts-release-github@0.4.1 effect@4.0.0-rc.115
```

For an unpublished development checkout, follow the root README to build and
pack the core, and pack each required provider with `bun pm pack --ignore-scripts`.
Install all required local archives in one `bun add` invocation so providers can
resolve the unpublished core peer. Do not combine 0.3.1 core with 0.4 providers.

| Package                       | Purpose                                                |
| ----------------------------- | ------------------------------------------------------ |
| `@mannyc1/ts-release`         | Bundle, Plan, executor, journal, CLI and runtime hosts |
| `@mannyc1/ts-release-npm`     | npm versions, dist-tags and provenance                 |
| `@mannyc1/ts-release-github`  | GitHub tags, releases and assets                       |
| `@mannyc1/ts-release-pypi`    | Python distribution publication                        |
| `@mannyc1/ts-release-catalog` | Homebrew and Scoop catalog authoring                   |
| `@mannyc1/ts-release-mcp`     | MCP registry publication                               |
| `@mannyc1/ts-release-openai`  | OpenAI plugin packaging and submission data            |

Keep the selected packages at the same release version. Optional platform peers
are needed only for the subpaths that import them; the `apple` subpath needs
`effect-build-apple@0.8.0`. Keep any installed Effect runtime/platform packages
aligned at `4.0.0-rc.115`. Supported runtimes are Node
`^22.22.2 || ^24.15.0 || >=26.0.0` and Bun 1.3.14 or later.

## Replace configuration with an application

An old npm/GitHub configuration looked like:

```json
{
  "project": { "repository": "owner/repo" },
  "versionFrom": "manifest",
  "npmPackage": { "path": "." },
  "publish": {
    "npm": { "authentication": { "strategy": "token", "credential": "NPM_TOKEN" } },
    "github": {}
  }
}
```

Replace those declarations with the following application responsibilities:

| 0.3.1 declaration                           | 0.4 responsibility                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `project`, `versionFrom`                    | Resolve the intended version/source and author exact provider intents in preparation.                                            |
| `npmPackage`, artifact/build settings       | Build and adopt immutable artifacts into a content owner; finalize and retain the Bundle.                                        |
| `publish.npm`, `publish.github`             | Install the provider packages; author their operations and construct a Plan bound to the Bundle digest.                          |
| Authentication strategy and credential name | Supply the host's credential resolver and provider authorization. Credential values stay out of the Bundle, Plan and input JSON. |
| Prepared store and reference                | Retain encoded Bundle, Plan, owned content and an application-defined input file.                                                |
| Recovery state                              | Configure a durable shared journal; a new runner reads the same journal and original content.                                    |

The module `release.mjs` exports `createApplication(input)`. Its scoped Effect
loads the retained Bundle and Plan, constructs the provider/transport/journal
host, and returns `{ bundle, host, options: { plan, authorize } }`. The input JSON
has your application's schema; an old `release.config.json` is not accepted as
a built-in schema. `authorize` must be an explicit application decision;
`TS_RELEASE_AUTHORIZE` does not grant publication permission.

Use the [application guide](preparation.md), the
[npm provider guide](../packages/npm/README.md) and
[GitHub provider guide](../packages/github/README.md) when composing these pieces.
The complete [Git catalog application](../test/reimplementation/hosts/catalog-application.mjs)
and [installed workflow check](../scripts/check-installed-workflow.ts) demonstrate
preparation, retained input, observation and continuation with real local Git
destinations. The examples/templates marked historical target the old interface.

The [current npm/GitHub starter](../templates/npm-github/README.md) targets 0.4.1
and supplies the production application used for this repository's own release.
Its version-aligned dependencies install directly from npm with `bun install`.
It includes explicit Token, Local browser authentication and Trusted OIDC modes;
native provenance runs under Node. Keep the selected mode, Bundle and Plan for
the lifetime of an unfinished release. Re-attesting creates different operation
identities and cannot replace a Plan that already has journal history.

## Update commands and automation

| Old command                                       | Replacement                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ts-release init`                                 | Author your application and input; there is no built-in wizard.                                                |
| `ts-release release --config release.config.json` | Run your preparation script, retain its outputs, then `bun run ts-release ./release.mjs ./release-input.json`. |
| `ts-release prepare --config …`                   | Run your own preparation script without publication.                                                           |
| `ts-release inspect <prepared-ref>`               | Inspect the retained Bundle/Plan/input with your application tooling.                                          |
| `ts-release observe <prepared-ref>`               | `bun run ts-release --observe ./release.mjs ./release-input.json`.                                             |
| `ts-release publish <prepared-ref>`               | `bun run ts-release ./release.mjs ./release-input.json`, loading the same Bundle/Plan/content/journal.         |
| `ts-release correct …`                            | Author explicit provider operations/operator decisions; there is no generic correction subcommand.             |

Use `bun run ts-release` after local installation so the command resolves the
project's binary. A globally installed 0.3.1 binary has a different CLI contract.

Observe mode does not dispatch publication, but it executes trusted application
setup and writes observation evidence to the journal. Stdout is JSON; stderr
contains diagnostics. Exit codes are 0 for all operations satisfied, 2 for
incomplete progress, 1 for invalid usage/application failure, and 130/143 for
interruption. An empty or partial stdout file is not evidence of release success.

## Update the GitHub Action

The Action moved from `apps/ts-release-action` to `apps/action` and uses Node 24.
Remove `command`, `config` and `prepared`; supply `application`, `input` and
`observe`. `input` is JSON passed to the factory, not automatically a filename.
Pass file paths only if your factory explicitly loads them.

```yaml
- uses: actions/checkout@v4
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: 1.3.14
- run: bun install --frozen-lockfile
# Restore the original Bundle, Plan and content; provide shared journal access.
- uses: mannyc2/ts-release/apps/action@ce25cac60c2e3b6c2686de78eb03a5a663194b90
  with:
    application: release.mjs
    input: "{}" # Replace with input matching your factory's schema.
    observe: "true"
```

That immutable commit contains the 0.4 Action and its built launcher. The 0.4
GitHub release notes supply the final tested release commit to pin after
publication. Retain your normal environment approval and credential policy;
switch `observe` to `'false'` only when your application's authorization permits
publication. The Action outputs are now `plan-id` and `journal-revision`; retain
the journal and original content independently of the report.

Before enabling publication, install the selected packages in a clean consumer,
validate observation against the intended destinations, and exercise continuation
with a fresh cache using the same durable journal. Keep the previous toolchain
available for any unresolved pre-upgrade release.
