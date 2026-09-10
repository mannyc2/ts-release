# Authoring a release application

The shipped CLI accepts a trusted ESM module and a JSON input file. The module
exports `createApplication(input)`, returning a scoped Effect with:

- `bundle`: an owned, finalized Bundle of exact artifact identities.
- `host`: providers, transport, journal store, clock and unique-ID function.
- `options`: the Plan, explicit `authorize`, and optional `observe` and `maxDispatches`.

Preparation uses `ContentOwner`, `finalize` and `encodeBundle` from the `bundle`
subpath, then `createOperation` and `createPlan` from the root. Bind the Plan's
bundle ID to the SHA-256 of `encodeBundle(bundle)`. Persist the Bundle, Plan and
owned content before authorizing publication. Producer adoption is available from
`effect-build`; Apple preparation retains its preparation scope and recovery laws.

On continuation, use `loadBundle` with the content owner and `loadPlan` with the
installed providers. `fileContentOwner` supplies local content; `openGitJournal`
supplies a durable shared Git journal with a disposable local cache. The Bun
subpath also supplies `openSqliteJournal` for a retained local database.

Provide services/layers at the application boundary. Credentials stay in the host;
never put credential values in durable operation intents. The standard runner
validates the Bundle/Plan/Journal binding before calling `runRelease` and returns
a complete derived report. `--observe` uses `observeRelease` instead.

The scoped factory allows cleanup on success, failure and SIGINT/SIGTERM. Choose
an application-specific preparation command or script to create input; the CLI
does not impose a second configuration format or rebuild missing artifacts.
See `apps/self-release/src/application.ts` for the repository's composition and
`test/reimplementation/hosts` for small executable applications used in tests.

A complete small application using the real Git provider, file content owner and
shared Git journal is exercised in
[`catalog-application.mjs`](../test/reimplementation/hosts/catalog-application.mjs).
Its input names `bundleFile`, `planFile`, `contentDirectory`, `cacheDirectory`,
`journalRemote`, `gitExecutable`, `publisherGit` and explicit `authorize`. The
[installed workflow check](../scripts/check-installed-workflow.ts) demonstrates
preparation and runs that application through both shipped entrypoints against
local repositories. It uses anonymous fixture credentials; supply your host's
credential policy when adapting it to an authenticated destination.
