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
never put credential values in durable operation intents. Apple preparation runs
its native operations through the `AppleTools` service from the `apple` subpath;
`appleToolsLayer(credential)` binds effect-build-apple's notarization, stapling
and assessment to one host credential over `Apple.layer()` and platform services. The standard runner
validates the Bundle/Plan/Journal binding before calling `runRelease` and returns
a complete derived report. `--observe` uses `observeRelease` instead.

The scoped factory allows cleanup on success, failure and SIGINT/SIGTERM. Choose
an application-specific preparation command or script to create input; the CLI
does not impose a second configuration format or rebuild missing artifacts.
See `apps/self-release/src/application.ts` for the repository's composition and
the [npm/GitHub starter](../templates/npm-github/README.md) for its runnable,
generated projection. `prepareRelease` adopts tarballs and authors dependency
ordered npm and GitHub operations. Credentials and the journal are supplied when
loading the retained candidate; preparation does not publish packages or releases.

The optional `onRejected(operation)` application hook completes live authentication
after the kernel has persisted a provider's terminal noncommit proof. Returning
true asks the runner to re-enter `runRelease` with the original Plan and journal.
The hook is called at most once per operation per invocation, never during
observation or an unauthorized run. An explicit `maxDispatches` covers all
continuations. Unknown outcomes never invoke it or grant another dispatch.

Effect hosts can compose `runApplicationEffect(createApplication, input, mode)`
from the `node` or `bun` subpath. This addition is available in this source
checkout; it is not part of the already-published 0.4.2 package. The runner owns
the application scope, preserves factory errors and service requirements, and
adds `ReleaseError | AdoptionError` for interpretation and Bundle admission.
Provide factory layers around the returned Effect and execute it at your host
boundary. It uses the caller's runtime, logging and interruption policy. The
existing `runApplication(path, input, signal, mode)` remains the Promise adapter
for CLI and other hosts. Both defer the factory inside the scope; synchronous
factory throws now remain defects. Previously construction exceptions became
typed `ReleaseError` failures (preserving an existing `ReleaseError` or using
`invalid-data` otherwise); return `Effect.fail(error)` for an expected failure.
See the [Effect standards](effect-standards.md) for the ownership contract.

Use Node for native Sigstore signing and verification. Bun remains supported for
package management, scripts, tests and token-based publication. Bun 1.3.14 fails
the native Sigstore trust-root signature check; the native provenance adapters
report `npm-sigstore-runtime` instead of a misleading trust failure.

A complete small application using the real Git provider, file content owner and
shared Git journal is exercised in
[`catalog-application.mjs`](../test/reimplementation/hosts/catalog-application.mjs).
Its input names `bundleFile`, `planFile`, `contentDirectory`, `cacheDirectory`,
`journalRemote`, `gitExecutable`, `publisherGit` and explicit `authorize`. The
[installed workflow check](../scripts/check-installed-workflow.ts) demonstrates
preparation and runs that application through both shipped entrypoints against
local repositories. It uses anonymous fixture credentials; supply your host's
credential policy when adapting it to an authenticated destination.
