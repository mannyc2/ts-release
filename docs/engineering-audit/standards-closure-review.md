# Standards closure decisions

This review was completed on 2026-09-26 in `codex/provider-validation-defects`,
starting at `07eff4faba15483d5d80879c493c3233733344c5`. The reviewed working tree
also contained the separately qualified provider-validation change and the
starter repair below. Effect and its platform packages remain on rc.115. The
tracked AGENTS/CONTRIBUTING chain and complete installed Effect guide were read.
This is task research, excluded from published packages; it does not certify
all R01–R36 or replace the [implementation record](implementation-status.md).

The decisions distinguish a reproduced broken workflow, a statically confirmed
contract gap, a justified exception, and work that needs a targeted probe. No
whole-suite test deletion or blanket platform replacement follows from an
occurrence count. Read-only inspection was supplemented only by the bounded
starter repair and its real command evidence. Other tests were not rerun here.

## Maintained delivery: one reproduced defect, existing declaration coverage

**R21, R24–R26, R29: repaired starter closure.**
The maintained [starter](../../templates/npm-github/README.md#L53) documents
`bun run input:release`. Its generated `input.ts` imported
`./ReleaseMetadata.js`, but the old generator copied only `release-input.ts`.
The helper itself imports the production application model, so copying one
additional helper would leave another workspace-relative dependency.

Before the repair, the real command exited 1 in an isolated copied starter with
`Cannot find module './ReleaseMetadata.js'`; no output input file was written.
The dependency directory came from a real npm-installed, previously qualified
packed consumer, with physical package directories and no workspace fallback.
The two candidate identity values were fixtures; this was input projection,
not full candidate admission. Publication credentials were removed from the
child environment and the journal URL was `example.invalid`.

[build-delivery.ts:37](../../scripts/build-delivery.ts#L37) now bundles the three
workspace modules needed by the input helper with `packages: "external"`.
It preserves the documented `input.ts` Bun entrypoint, production-owned schemas,
and adopter-installed package instances. No new hand-maintained schema, public
export, or helper service was added. The actual generator completed successfully;
the actual generated artifact then ran successfully in the same isolated
consumer, preserving both identity digests and emitting `authorize: false`.
Its remaining imports are declared Effect/core/npm/GitHub packages and native
built-ins. The Action launcher and generated release application were unchanged.

Evidence is retained in `/tmp/ts-release-starter-closure-red.json`,
`/tmp/ts-release-starter-closure-green.json`, and
`/tmp/ts-release-starter-closure-evidence.md`. Generated input SHA-256 is
`59b0aff19ff08193852fe89cbe8eb4f36999828af6691ca195c2c958036c90a3`.
The first shared build stopped on provider diagnostics before generation; the
subsequent successful build is `/tmp/ts-release-starter-build-delivery-final.log`.
This probe reuses milestone-one installed packages and does not qualify the
newer provider implementation, fresh installation, live authentication, or an
entire release workflow. Root integration owns final static/package checks.

**R21, R22, R29: keep existing declaration mechanisms.**
All eight core public subpaths have strict installed declaration coverage across
existing commands; the five-entry table in one script is not the whole inventory:

| Core subpath | Existing installed declaration owner |
| --- | --- |
| `.`, `bundle`, `http`, `node`, `bun` | [check-packed-kernel.ts:108](../../scripts/check-packed-kernel.ts#L108), strict consumer config at line 141; Node/Bun factory E/R equalities at line 123. |
| `effect-build`, `apple` | [artifacts/public-contract.ts:24](../../test/reimplementation/artifacts/public-contract.ts#L24), copied into and compiled in the installed consumer by [check-packed-artifacts.ts:133](../../scripts/check-packed-artifacts.ts#L133). |
| `git` | Explicit installed imports and `Git.NativeHost` usage in [check-packed-npm.ts:252](../../scripts/check-packed-npm.ts#L252), enabled by the existing `--transports` catalog profile. |

All seven packages also have installed provider consumers. These are substantial
closure checks, not exhaustive semantic assertions about every exported API.
No missing exported declaration name was found in this review.
[build.ts:9](../../scripts/build.ts#L9) removes each old dist directory and emits
JavaScript/declarations together. [check-import-rules.ts:83](../../scripts/check-import-rules.ts#L83)
pins every manifest's source/JS/declaration targets. The export smoke check then
loads all advertised entries; it does not itself compare complete symbol sets.
Retain this combined evidence and the known public inference checks. Do not
restore retired generated API-projection machinery without a concrete missing
failure that the current emission and installed checks cannot catch.

**R04, R21: historical examples are already retired.**
[examples/README.md:1](../../examples/README.md#L1) explicitly labels the old
configuration API unsupported and redirects users to current preparation docs.
Do not spend a migration wave compiling that historical tree. The maintained
starter does need delivered-dependency closure, as the reproduced defect shows.
The existing installed-workflow script uses a catalog fixture application
([line 70](../../scripts/check-installed-workflow.ts#L70)); the distribution
script copies the production application and verifier
([line 154](../../scripts/check-distribution.ts#L154)). Neither previously ran
the starter input command, explaining why those green checks missed this defect.

## Native owners: retain specific contracts, correct the platform comparison

**R05–R07, R12–R16, R22: Process/Git are compatibility exceptions, not missing
Effect functionality.** The installed rc.115
[NodeChildProcessSpawner:18](../../node_modules/@effect/platform-node-shared/src/NodeChildProcessSpawner.ts#L18)
already kills and waits for process groups; its implementation at
[line 470](../../node_modules/@effect/platform-node-shared/src/NodeChildProcessSpawner.ts#L470)
supports kill signals and escalation. A claim that Effect cannot clean up a
process tree is incorrect. Its documented group wait has explicit one-second
and force-kill bounds, with separate Windows behavior.

Keep the current small [Process adapter](../../packages/ts-release/src/platform/Process.ts#L32)
for this migration: it combines stdout/stderr byte admission, a native deadline,
immediate group kill, close joining, and fixed safe failures behind an already
constructed capability. The existing public native entries work without optional
platform peers: [package.json:67](../../packages/ts-release/package.json#L67)
declares those peers optional and [packed-kernel:84](../../scripts/check-packed-kernel.ts#L84)
proves their absence. A direct platform import or new service requirement would
change that package/composition contract. This does not establish that replacement
is impossible or undesirable; it makes it a separately qualified compatibility
change. Reuse the real Node/Bun group interruption/deadline fixture
([git-runtime.test.ts:78](../../test/reimplementation/transports/git-runtime.test.ts#L78))
and environment/output checks if pursuing it. The process fixture uses Linux
`/proc` to distinguish zombies; its pass does not certify Windows or macOS.

**R07, R12, R14, R15: HTTP has concrete lower-level requirements.**
The pinned [NodeHttpClient:146](../../node_modules/@effect/platform-node/src/NodeHttpClient.ts#L146)
uses Undici `dispatcher.request`; its public response headers are normalized
at [line 230](../../node_modules/@effect/platform-node/src/NodeHttpClient.ts#L230).
ts-release needs raw duplicate-header admission
([HttpTransport.ts:199](../../packages/ts-release/src/platform/HttpTransport.ts#L199)),
wire-byte counting before discarded framing, ownership of a socket before TLS
handshake completion, and total I/O settlement
([lines 134–176](../../packages/ts-release/src/platform/HttpTransport.ts#L134)).
Its dispatch also sets `idempotent: false` and creates one non-pipelined client.
These justify retaining the narrow pinned adapter and its real TLS/wire fixtures.
Effect's [retry](../../node_modules/effect/src/unstable/http/HttpClient.ts#L1059)
and [redirect](../../node_modules/effect/src/unstable/http/HttpClient.ts#L1957)
combinators are opt-in; generic claims that Effect HTTP inherently retries or
redirects are not valid justifications.

Retaining HTTP does not certify every R12 cleanup path. In particular,
`client.destroy().catch(() => {})` at line 140 discards the destroy rejection.
Classify the pinned client's actual destroy outcomes before claiming all cleanup
failures observable; no failed-destroy incident or leaked socket was reproduced
here. Preserve the separation between local cleanup, uncertain mutation and
publication visibility, and never turn a transport failure into retry authority.

**R07, R12, R14: retain native content flags.** The pinned Effect
[FileSystem.OpenFlag:417](../../node_modules/effect/src/FileSystem.ts#L417)
accepts only string flags, not `O_NOFOLLOW`, `O_NONBLOCK`, or `O_DIRECTORY`.
ContentStore's special-file/symlink refusal and immutable installation/fsync
requirements therefore have a concrete native exception. Its new settlement
proof and limits are recorded separately in [content-store-lifecycle.md](content-store-lifecycle.md).
Do not expand that result into a proof of every native adapter.

**R12: two additional lifetime gaps remain statically confirmed.**
[self-release Model.ts:119](../../apps/self-release/src/Model.ts#L119) wraps
open/stat/read/close in one Promise through an interruptible `tryPromise` helper.
The `finally` eventually closes the handle, but interrupted Effect completion
does not join the pending native workflow. [npm Auth.ts:269](../../packages/npm/src/Auth.ts#L269)
similarly runs native `Sigstore.verify` without cancellation or settlement joining;
the call owns trust-cache activity. No leaked handle, post-cancel cache write or
lost cleanup failure was reproduced in this closure review. The next bounded
action is one deterministic acquisition/settlement probe per actual owner, then
the smallest join/bracket repair justified by that result. Keep native Sigstore
verification and credential-safe diagnostic projection; do not replace them with
a fake trust implementation or mask the whole application.

## Test ownership and retention decisions

**R24–R27: keep root test placement; remove cross-owner private dependencies.**
CONTRIBUTING explicitly permits the retained `test/reimplementation` tree.
Moving files or creating a public testing package does not improve proof. Private
provider codecs/wire fixtures are legitimate when that provider is their owner.
The following four cross-owner sites have concrete alternatives:

| Site | Keep the protection; change the dependency |
| --- | --- |
| [github/protocol.test.ts:5](../../test/reimplementation/github/protocol.test.ts#L5), private `verifyNativeEvidence` | Delete the redundant direct verifier call at line 59 and its otherwise-unused snapshot. The immediately following public `runRelease` re-admits the history through [Host.ts:156](../../packages/ts-release/src/internal/Host.ts#L156), then asserts no extra sends; public observation checks the resulting provider facts. Retain those real outcome assertions and all DAG variants. |
| [self-release/application.test.ts:9](../../test/reimplementation/self-release/application.test.ts#L9), private `reportFinalizedRelease` | Use public `runApplicationEffect` with the already-authored unauthorized successor input to obtain the finalized report. Preserve retained predecessor identity, supersession event, unattempted operations and journal revision assertions. Do not expose the private renderer just for this test. |
| [catalog/git.test.ts:14](../../test/reimplementation/catalog/git.test.ts#L14), private `openGitRuntime` | Create the seed bare repository with the existing native Git fixture command inside the test's already-owned temporary directory. The system under test remains public catalog operations plus `makeGitCatalogHost`; retain SHA1/SHA256, multi-path atomicity and lost-acknowledgement recovery. |
| [ai/openai.test.ts:33](../../test/reimplementation/ai/openai.test.ts#L33), private `openGitRuntime` | Use the same native bare-repository setup pattern; retain exact marketplace bytes through public conditional Git execution. Do not substitute a fake Git host. |

The shared [git-fixture.ts:6](../../test/reimplementation/transports/git-fixture.ts#L6)
also imports `Content` and `ReadContent` through source paths. Both already have
supported `@mannyc1/ts-release/bundle` exports; use those exports when updating
the cross-owner fixture. Purely core-private adapter tests can remain private.

**R24, R26, R29: one concrete duplicate is a removal candidate.**
The first [hosts/action.test.ts:66](../../test/reimplementation/hosts/action.test.ts#L66)
case checks a successful shared-journal run, exact output, fresh-runner equality
and one send. [check-packed-action.ts:63](../../scripts/check-packed-action.ts#L63)
already exercises the same fixture through actual Bun/npm installations; lines
117–130 check those outcomes and additionally prove absent optional peers and
non-symlink package resolution. Retain the stronger installed check. The source
case's literal journal revision assertion is incidental to the retained output
and no-replay contract. Remove only that duplicate case after its owner records
the decision; keep Action path/redaction/signal cases, which cover different
failures. No whole matrix deletion follows from this one overlap.

**R13, R28: virtualize existing logical-time cases and own their fibers.**
[npm/local-authentication.test.ts:113](../../test/reimplementation/npm/local-authentication.test.ts#L113)
returns `retry-after: 1` then waits through the real clock; lines 437–465 use a
real 20ms timeout around `Effect.never`. The production owner uses
[Effect.sleep/timeout:274](../../packages/npm/src/LocalAuthentication.ts#L274).
Retain the cases and their journal/token/cancellation assertions, but provide
TestClock and advance time after a causal barrier. Give started fibers test
teardown ownership; `runWithHost` currently calls unsignalled `runPromise`
([fixtures.ts:203](../../test/reimplementation/kernel/fixtures.ts#L203)). A Bun
runner timeout must not leave an owned Effect running, and teardown must not
inherit an already-aborted operation signal. No new timing matrix is required.
Native socket truncation, subprocess watchdogs and actual process-group death
checks exercise different contracts and retain real OS timing.

## Qualification boundaries and next work

**R01, R04, R24, R29–R31:** use the existing command/receipt owners, with a concise
profile table in maintained documentation. `check` is the static/build profile;
`check:portable` is static plus the explicitly listed portable runtime chain.
Native Apple/Sigstore and retained distribution qualification are separate.
[scripts/README.md:32](../../scripts/README.md#L32) calls `check:portable` the
“full local suite”, while [CI:74](../../.github/workflows/ci.yml#L74) separately
checks retained distribution. Clarify that scope rather than adding another
acceptance framework or inferring coverage from a test count. Existing command
failures already stop their sequential profiles; this review did not find a
missing-stage success bug requiring a new gate.

The next bounded standards changes are the four cross-owner substitutions,
the existing logical-time/fiber cleanup repair, and the two native lifetime
probes. The Action duplicate and HTTP destroy outcome need their explicit owner
decisions. Reuse the corresponding current tests and installed checks. Keep
unrun macOS/Windows, Node24/other engines, hosted distribution and live-provider
qualification visible. R08–R10 provider defect classification is being handled
in its separate increment; product work R32–R36 remains separate. These findings
do not establish whole-suite case-by-case retention review or full migration
completion.
