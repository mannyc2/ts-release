# Cross-owner test cleanup

Baseline: `e0bedee2433e7d2dccee94131c8f51824ac97902` in
`/mnt/models/dev/ts-release/.verification-ownership`. Bun 1.3.14; selected native
Node 22.22.2; unchanged Effect/platform rc.115. Root built the baseline before
these test-only changes were qualified. AGENTS/CONTRIBUTING and relevant package
guides were reviewed; the installed Effect guide hash matches the complete guide
read during the preceding increment.

## Scope and retention decisions

- `github/protocol.test.ts`: remove the private core `verifyNativeEvidence`
  import/call and its otherwise-unused snapshot. This removes one repeated
  assertion in four existing DAG cells. The immediately following public
  `runRelease` still loads the real retained history and calls the verifier via
  core `Host.read`; send counts and public observations still assert no replay
  and complete provider facts. No DAG variant or test case was removed.
- `self-release/application.test.ts`: obtain the successor report from public
  `runApplicationEffect`, which now owns creation and cleanup of that application.
  Its fixture explicitly overrides both `authorize: false` and `observe: false`
  on the returned application options. Merely setting authorization false would
  still permit provider observations. Preserve the existing superseded identity,
  exact journal event/revision, unattempted-operation and report assertions,
  without acquiring provider credentials or making network observations.
- `catalog/git.test.ts`: initialize a real native bare repository under the
  existing test-owned temporary directory; retain SHA1/SHA256 selection and an
  empty Git template. The existing native helper supplies the same deterministic
  author/committer identity, bounded output/deadline and explicit isolated Git
  configuration. Public Git host, native SQLite, lost-acknowledgement wrapper,
  Homebrew oracle, exact files, untouched trees and atomic CAS proofs remain.
- `ai/openai.test.ts`: use the same real native setup in an existing owned
  directory, explicitly selecting SHA1 and an empty template. Public marketplace
  rendering and conditional Git publication still prove exact bytes. The private
  core Git runtime is no longer a fixture dependency.
- `transports/git-fixture.ts`: import `Content` and `ReadContent` from the already
  public bundle entry. No new public testing API or fixture service was added.

The setup directories remain owned by the existing try/finally cleanup. Native
Git initialization does not replace the public host under test, and provider
authorities, credentials and release laws are unchanged. Core-private Git adapter
tests remain legitimate and were not relocated. No new committed tests, matrix
cells or assertions were added, so no fabricated red/green test history is claimed.

## Qualification

Owned files were formatted with the pinned Bun/Prettier command. Focused strict
Oxlint passed, exit 0, with `--deny-warnings` and unused-disable errors; raw output
is `/tmp/ts-release-test-ownership-lint.log`.

Root's build passed at `/tmp/ts-release-verification-ownership-build.log`.
The selected native test command is:

```sh
PATH=/tmp/ts-release-bun-qualification/node_modules/.bin:/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin:$PATH TS_RELEASE_ACCEPTANCE_NODE=/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node TS_RELEASE_HTTP_PEER_NODE=/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node bun test test/reimplementation/github/protocol.test.ts test/reimplementation/self-release/application.test.ts test/reimplementation/catalog/git.test.ts test/reimplementation/ai/openai.test.ts
```

It uses existing native Git, Bun SQLite and pinned Homebrew fixtures. Native
process stdin pipes require escalation in this environment; the restricted
failure mode was already reproduced during preceding qualification. The command
does not publish to public providers. Raw output is
`/tmp/ts-release-test-ownership-tests.log`: exit 0, 44 tests passed, 0 failed,
464 expectations across four files, 19.71 seconds. This includes all eight native
catalog cells and the unchanged GitHub/OpenAI/self-release cases. `git diff
--check` also passed. No source input changed after these checks.

This is selected source-test evidence on Linux, not fresh packed/installed
consumer, macOS/Windows, hosted runner, live provider, or full-suite qualification.
## Final integration

The changed public `Content` import is also used by the existing core-native Git
and self-release fixtures. The seven additional test files passed: **20 tests,
253 assertions**, in `/tmp/ts-release-test-ownership-shared-fixture.log`:

- `self-release/self-release.test.ts`
- `transports/git-objects.test.ts`, `git-runtime.test.ts`, `git-journal.test.ts`,
  `native-provider.test.ts`, `git-host.test.ts`, `git-process.test.ts`

The self-release file starts `build:delivery` in `beforeAll`; the integrator
initially missed that nested build and overlapped the static command with that
stage. After both commands finished, that file was run again alone, with no
other output-mutating check active. The final serialized run passed **1 test,
30 assertions**, at `/tmp/ts-release-test-ownership-self-release-final.log`.
The other six files had completed before the overlap and were not repeated.
This records the correction rather than claiming the original selection was
entirely serialized.

The final static command passed with zero diagnostics at
`/tmp/ts-release-verification-ownership-check.log`. Source production, dependencies,
public APIs and generated delivery files remain unchanged in this increment.
Existing packed qualification from the preceding commit remains applicable;
it was not rerun for test and documentation changes.
