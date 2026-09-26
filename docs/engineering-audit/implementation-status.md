# First implementation milestone

This is the implementation record for `codex/engineering-standards`, based on
published 0.4.2 main, `fa50ce368c50e9a28a2e57f667d454374e7b209c`. The adjacent audits
and inventories are dated research snapshots. They do not describe every line
of the current implementation or establish completion of all 36 requirements.
The older `ec25cbe` checkpoint was reviewed change by change rather than merged.

## Implemented scope

- **W0:** completed the [checkpoint disposition](w0-checkpoint-review.md), including
  Promise compatibility, test necessity and remaining native lifecycle work.
- **W1:** tracked AGENTS/CONTRIBUTING, a qualified patched compiler, type-aware
  lint, blocking diagnostics and unused suppressions, formatting, strict compiler
  flags, and CI static checks before native fixture setup. Direct build scripts
  also reject an unpatched compiler before changing outputs.
- **W2 enforcement:** explicit compiler environments, all production package
  exports, dependency directions including type imports, case-correct targets,
  runtime cycles, and two narrowly owned computed loads. Portable Git declarations
  no longer depend on the native host's interface owner. The import inventory
  covers 95 source files, 663 edges and 15 public entries.
- **Selected W3/W4 changes:** schema decoding at known native/provider/tooling
  boundaries; checked indexes and owned callback contracts; an additive scoped
  `runApplicationEffect` preserving factory E/R; credential interruption and
  mixed-cause redaction; exact GitHub tag-type admission; OpenAI skill discovery
  without an undefined name for a root-level `SKILL.md`.
- **Selected W5 integration:** the existing static and portable runtime commands
  compose without rerunning the entire static profile in CI. Existing native,
  packed and installed workflow checks remain the delivery authorities.

Runtime Effect/platform packages remain aligned on `4.0.0-rc.115`. Qualified
development tools are TypeScript `7.0.2`, `@effect/tsgo` `0.45.0`, Oxlint `1.82.0`
and `oxlint-tsgolint` `7.0.2001`. The `typescript-api` alias at `6.0.3` supplies only
the JavaScript AST parser removed from TypeScript 7; it does not own diagnostics.
The narrow `TextDecoderOptions` declaration compatibility is explained in
[CONTRIBUTING](../../CONTRIBUTING.md#compiler-and-import-closures).

The Promise/module application runner retains its 0.4.2 factory-throw behavior;
the new Effect entrypoint is lazy and preserves synchronous factory defects.
Bundle, Plan, request, journal and publication authorization remain the existing
authorities. Generated Action/starter files are regenerated from their owners.
No new package version or publication is part of this milestone.

## Evidence and interpretation

Final qualification uses Linux x64, Bun `1.3.14`, Node `22.22.2`, and the existing
pinned native Python/Homebrew/Scoop/PowerShell fixtures. Native listeners and
process pipes require execution outside this environment's restricted sandbox;
the initial restricted Git failures reproduced its stdin `EPERM` limitation and
passed unchanged with that capability available.

| Check                                                        | Result and claim                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean frozen install; install with lifecycle scripts omitted | Normal installation patches the exact compiler; the stock compiler is rejected by the guard.                                                                                                                           |
| Compiler/linter negative controls                            | Warning-only and error-only Effect findings, unused Effect directives, unsafe typed values and unused lint disables independently fail.                                                                                |
| Import negative controls                                     | Baseline accepted four forbidden patterns; the new gate rejects computed loads, upward type imports, runtime cycles and private provider subpaths. Declaration-level erased type cycles remain valid.                  |
| All 11 compiler projects                                     | Zero diagnostics, including portable and Node core closures.                                                                                                                                                           |
| `bun run check`                                              | Passed: formatting, build, strict lint, root/closure types, import graph and public entries.                                                                                                                           |
| Provenance runtime and `bun run test`                        | Native Sigstore trust-root verification passed on Node; 351 tests passed, 0 failed, 3,737 assertions across 57 files.                                                                                                  |
| `bun run check:packed-kernel`                                | Passed under Bun/npm installs, including strict installed declarations and factory E/R inference.                                                                                                                      |
| `bun run check:packed-catalog`                               | Initial run caught a NodeJS type leak in MCP's emitted `render` return type. Explicit standard typed-array annotation fixed it; final static checks, all four MCP tests and this seven-package installed check passed. |
| `bun run check:packed-action`                                | Passed under Bun/npm installs on Node 22.22.2, with real installed resolution, fresh-runner equivalence and no extra send.                                                                                             |
| `bun run check:installed-workflow`                           | Passed: CLI and Action ordinary/interrupted runs, installed observation, continuation and completed-release recognition.                                                                                               |

The aggregate runtime command stopped at the original MCP declaration failure.
After the annotation-only correction, verification resumed at the affected
packed provider stage and continued through the remaining stages. The unchanged
351-test suite and packed core were not unnecessarily repeated; this record
does not claim one uninterrupted successful aggregate invocation.

The concrete GitHub malformed-tag regression and credential interruption
regression were observed failing before their fixes and passing afterward.
Application proof covers the specific lazy factory-throw seam and preservation
of the legacy Promise behavior. Installed declaration consumers check exact
factory error/service inference; the packed runtime check uses an already
satisfied journal to prove the new public export works without another send.
The OpenAI skill-name correction has a direct before/after probe, without adding
another committed test case. Existing fixture cleanups add no proof by themselves.

With `verbatimModuleSyntax`, `import { type T }` and `export { type T }` emit empty
runtime imports. Only declaration-level `import type` / `export type` erase those
edges. Both TypeScript 6 and the qualified TypeScript 7 confirmed this. The older
inventory's runtime-cycle method excluded inline all-type imports, so its empty
cycle list alone was incomplete evidence; the current checker corrects that.

## Remaining work

- **W3:** provider `makeDataBoundary.attempt`/`admit`/`matches` still normalize
  unexpected exceptions. Core `attempt` is repaired in the subsequent increment
  below. Continue by caller-visible slice while retaining privacy and Promise
  compatibility; static diagnostics alone do not establish the semantic policy.
- **W4:** the ContentStore acquisition/write interruption repair is completed in
  the subsequent increment below. The checkpoint's broad instrumentation matrix
  was deliberately not copied. Other capability-inventory decisions and native
  adapter/platform comparisons still require their own qualification.
- **W2/W5:** finish the whole-suite retention/ownership review and remaining
  public declaration/example completeness work. Static import analysis does not
  prove arbitrary external initialization pure. Untyped installed JS fixtures
  retain the documented unsafe-any exceptions; this is not blanket TS exclusion.
- **W6:** registry observation deadlines, repaired-executor recovery, full request
  preflight and smaller adoption recipes remain separate product increments in
  the [incident mapping](incident-to-plan.md) and [plan](refactor-plan.md).
- **W7:** complete requirement-by-requirement migration qualification. This Linux
  run does not certify macOS, Windows, every supported Node engine, live OIDC/
  Sigstore publication, or the privileged hosted distribution profile.

Research markdown and inventories are review artifacts in the repository. Package
file allowlists exclude them from published archives. Unrelated repository names
from the discovery census are omitted; the count and relevant findings remain.

## Subsequent content lifecycle increment

Branch `codex/content-store-lifecycle` starts at the completed local milestone
`32fe7cdb4335d0ec269859772ced519367a292b7`. It closes the specific ContentStore
item above: two native settlement races failed on that baseline and pass with
per-operation joining, bracketed handles and guarded temporary cleanup. Existing
Bundle/adoption checks, packed core consumers and installed CLI/Action recovery
also pass. See [the increment record](content-store-lifecycle.md) for exact proof
selection, source hashes and limits. Other W3–W7 work remains as listed above;
this increment does not establish completion of the entire standards migration.

## Provider validation and starter closure

Branch `codex/provider-validation-defects` continues from content lifecycle
commit `07eff4faba15483d5d80879c493c3233733344c5`. A separate starter fix closes
a reproduced missing-module failure in the documented input command. Its
workspace schemas are bundled from their existing source; package dependencies
resolve from the adopter's installation. The actual generated command passed
in an isolated installed consumer without publication authorization; see
[starter dependency closure](starter-dependency-closure.md).

Complete-plan provider validation now preserves unexpected thrown values as
defects, local domain-error identity, foreign tagged domain-error fields and
safe schema refusals. The change is confined to the captured synchronous
callback on an admitted Plan. The [slice record](provider-validation-defects.md)
includes failing evidence, a corrected Cause-inspection assertion, subsequent
baseline control and final checks. It does not change the global admission
helpers or the documented credential/legacy Promise projections.

Final static checks, nine dependency tests, 45 existing GitHub/application/CLI
tests and packed Bun/npm core qualification passed. The separate
[closure review](standards-closure-review.md) identifies justified native
exceptions and concrete remaining test/lifecycle/profile work; milestone one
and these increments are still not completion of all 36 requirements.

## Verification ownership and clock increment

Branch `codex/verification-ownership` starts at
`e0bedee2433e7d2dccee94131c8f51824ac97902`. Four cross-owner tests now use public
core APIs or native fixture setup, and the shared Git fixture uses the public
Bundle entry. All existing cases remain; one duplicate private-verifier assertion
was removed from four GitHub DAG rows because the retained public rerun validates
that history. See [the ownership decisions](test-ownership.md).

The existing npm authentication retry and timeout scenarios now use TestClock
and own their root fibers through Bun's finish hook. A temporary runner-timeout
probe established joined cleanup and caught an abandoned-Promise rejection;
the retained pattern awaits an Exit and still rethrows active-test failures.
No new test case or harness was added. See [clock evidence](logical-clock-tests.md).

The affected selections passed: 44 cross-owner tests, 20 shared-fixture tests
(with the nested-build self-release case subsequently requalified alone), and
six authentication tests. Full static checks passed. Runtime source and package
artifacts are unchanged. [Maintained check profiles](../../scripts/README.md)
now name their actual stages and limitations instead of calling the portable
profile the full local suite. Other lifecycle/error-policy and whole-suite
retention decisions remain subject to the closure review; this is a bounded W5
increment, not a full migration-completion claim.

The [core error-policy prerequisite inventory](core-error-policy-prerequisites.md)
now identifies each native/parser owner that needs local failure translation
before narrowing shared `attempt`. It also records credential privacy and
post-dispatch ambiguity contracts that a global replacement must preserve.

## Strict core error classification

Branch `codex/core-error-policy` starts at
`f82f4a19656fdd2f0c7629f0715895365182b3e9`. Shared core admission now preserves
programming defects, known release-error fields across package constructors and
safe schema refusals. Native JSON/UTF-8, file/SQLite, HTTP header and OIDC owners
classify expected native rejection locally. Plan's separate strict validator
classifier is deduplicated. A receipt-classifier defect after dispatch leaves
unresolved history without authorizing ordinary resend; malformed receipt data
still records the existing durable undecodable evidence.

Returned-credential getters previously leaked private text through typed errors;
the reproduced leak is now projected safely. Non-string headers are rejected
before coercion (`undefined` changes from `invalid-data` to `http-headers`).
Using a SQLite journal after its owning scope closes is a defect, reflected in
the existing installed consumer's closure assertion. Full native compatibility
decisions, failing evidence and limits are in the
[implementation record](core-error-policy-implementation.md).

Final static checks passed, followed by 358 behavior tests (3,769 assertions),
packed core under both installers, seven-package catalog/native consumers,
packed Action, and installed CLI/Action ordinary/interrupted workflows. The
aggregate initially stopped on the old closed-store typed-failure expectation;
after correcting that existing assertion, packed core and all remaining stages
passed. No uninterrupted aggregate pass is claimed. Runtime source stayed frozen
through qualification and Effect/platform remain rc.115.

Provider/application-local broad helpers, self-release and Sigstore lifetime
joining, HTTP/SQLite cleanup classification and final W7 closure remain open.
The subsequent retention review below resolves the whole-test-file review item
within its stated supporting-fixture limits. R32–R34 product improvements remain
separate work.
These local commits have not been pushed to the new implementation branch; the
earlier checkpoint approval does not satisfy the automatic review's direct
approval requirement for that destination.

## Test retention and next-owner planning

Branch `codex/test-retention` starts at core error-policy commit
`f2266bd7065cb1378a1fbf95cc0172c7f1b389e4`. Independent reviewers read all 58
test-file bodies and compared materially distinct scenarios with their native,
packed and installed owners. The [core review](test-retention-core.md) and
[provider review](test-retention-providers.md) retain explicit coverage limits:
not every supporting server/worker implementation was re-audited, and no source
test can certify unrun native hosts or live providers.

Nine repeated test executions are removed: the Action successful fresh-runner
case, public Git/raw HTTP/TLS consumer wrappers, one GitHub shared-transport
preparation case, and four M3 native crash cells. Existing packed Action/catalog
stages provide stronger installation proof for the first five; M3 still runs in
the semantic matrices, while native crash coverage retains independent M1/M2,
both cache settings and both fault windows. One fixture-key assertion and one
positive private-verifier assertion are removed; retained renderer output and
public journal re-entry assert the actual behavior. No fixture or meaningful
failure case was discarded, and no replacement test was added.

The existing `scripts/test.ts` now owns one delivery build before loading tests.
Both output-mutating beforeAll hooks are removed. The runner stops on a build
failure and selects the repository root for generation and test execution.
Direct focused `bun test` calls require a current `build:delivery`, as documented
in [the check profiles](../../scripts/README.md). Behavior-only runs no longer
repeat the installed native consumers; the portable runtime profile still runs
their packed owners.

One cross-owner test import remains an explicit R26/R27 exception:
`self-release/credentials.test.js` obtains private npm scope helpers. Its one-byte
provenance fixture cannot simply pass real public provider preparation. The
review records a bounded repair using the existing npm structural-provenance
fixture with public `createProvenance` and provider preparation, without adding
test APIs or pretending cryptographic verification occurred. That fixture work
is separate from these deletions. Tiny partial npm grammar overlap is retained
with its unique lexical/prototype controls; no new parser suite is warranted.

Next implementation is specified in the
[provider error-policy prerequisites](provider-error-policy-prerequisites.md)
and [native lifetime prerequisites](native-lifetime-prerequisites.md). The
[R01–R36 status ledger](requirements-status.md) distinguishes qualified mechanisms,
partial semantic adoption and still-planned product improvements.

Final static checks passed. The updated `bun run test` generated delivery once
before loading the suite, then passed **349 tests, 0 failures, 3,701 assertions
across 58 files**. Logs are `/tmp/ts-release-test-retention-check-final.log` and
`/tmp/ts-release-test-retention-behavior.log`; the initial static run caught an
orphaned GitHub transport import, which was removed without suppressions.
The ten changed test/runner/profile inputs are recorded in
`/tmp/ts-release-test-retention-inputs.json`, SHA-256
`75b9b8deced286a264c2c3efb851fc35bcc16b95ba37f50ec80216793e6c3f47`.

Production source, dependency locks, delivery generator and packed consumer
inputs are unchanged from qualified `f2266bd`; the successful packed catalog,
Action and installed-workflow evidence from that increment remains applicable.
Those costly unchanged stages were not repeated just to remove source duplicates.
The full behavior command was repeated because its build ownership and selected
test cases changed. These are correctness results, not a speed benchmark or a
new all-host/full-distribution qualification claim. This increment adds no
production code, public API, test case, dependency or publication authority.

## Native settlement repairs and bounded qualification

Current checkout: `/mnt/models/dev/ts-release/.native-settlement`, branch
`codex/native-settlement`, based on qualified retention commit
`5227a01f5dbcc722ff5c9971f72106cf2e8fcdee`. This bounded W4/R12 increment has
passed the affected static, native, installed-package and generated-starter
checks below. It does not complete all standards or product requirements.

Two existing owners now join issued noncancellable work:

- Self-release `Model.read` brackets its actual FileHandle and masks only each
  native open/stat/read/close operation. It preserves numeric flags, size checks,
  owned bytes and the fixed file refusal. [Evidence](self-release-read-lifecycle.md).
- npm `makeSigstoreVerifier` masks its existing SDK verification Promise until
  settlement. Trust/source checks, retry/timeout configuration, supported runtime,
  safe error projection and signing remain unchanged.
  [Evidence](native-sigstore-settlement.md).

Both necessary regressions failed against the unchanged baseline before the
source repairs. Both focused greens passed: the file owner remained pending
until read delivery and handle closure; the real Sigstore SDK authenticated the
existing fixture and removed all five actual TUF temporary directories before
the interrupted Effect exited. The SDK helper changed after red only for
formatting and a JSDoc Promise annotation; the file proof was byte-identical.
The native SDK proof is part of the existing explicit native profile, with no
network added to the ordinary Bun suite. No signing or publication occurred.

Pinned npm and self-release compilation passed with the patched compiler
(`check:toolchain`, then each affected build project), exit 0; log
`/tmp/ts-release-native-settlement-target-build.log`. Targeted strict lint passed
for both source/proof owners. Existing npm authentication and self-release
application behavior were selected using:

```sh
bun test ./test/reimplementation/npm/auth.test.ts ./test/reimplementation/self-release/application.test.ts
```

The sandboxed command exited 1: 15 passed, two native Git-journal scenarios
failed. Rerunning only those same two scenarios outside the sandbox, with no
source change, exited 0: 2 passed, 9 filtered, 19 assertions. Thus all 17 selected
scenarios have passing results, but no single uninterrupted selected-suite pass
is claimed. Raw logs are
`/tmp/ts-release-native-settlement-selected-behavior.log` and
`/tmp/ts-release-native-settlement-git-behavior.log`. Exact Bun 1.3.14 and Node
22.22.2 paths remain those recorded by the owner evidence. An independent
read-only review found no blocking correctness defect and confirmed the stated
cause/teardown limits; it ran no additional gates.

Full gates initially waited for the coordinator's required lock path. The
coordinator subsequently supplied `/tmp/the-show-full-verification.lock`, and
the integrator acquired that exact path with nonblocking `flock`; no substitute
lock was used. All full-gate compiler/build/test children ran inside their held
batch, and the lock was released after the children exited.

The first static check stopped at TS2345 in the new Bun test wrapper: its stored
spawn type widened stderr to include a file descriptor. Keeping the inferred
`const spawned` for the stream, then assigning the teardown handle, fixed the
type without a cast, suppression or changed assertion. The final wrapper differs
from the initially byte-identical red/green only by this later repair; source
and native fixture stayed unchanged. The stopped log is
`/tmp/ts-release-native-settlement-check.log`.

The resumed locked batch passed, in order:

| Check                            | Exit and evidence                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`                  | 0; `/tmp/ts-release-native-settlement-check-final.log`. Formatting, patched compiler, build, strict lint, root/host types, 95-file/664-edge import policy and 15 package entries passed.                   |
| `bun run build:delivery`         | 0; `/tmp/ts-release-native-settlement-delivery.log`. Refreshed generated starter Model and bundled input.                                                                                                  |
| Direct final read-lifecycle test | 0; 1 test/1 assertion, `/tmp/ts-release-native-settlement-read-final.log`. Repeated because the wrapper changed.                                                                                           |
| `bun run check:packed-npm`       | 0; `/tmp/ts-release-native-settlement-packed-npm.log`. Actual core/npm archives passed Bun/npm installation, strict declarations, optional-peer absence and existing behavior under Node22.22.2/Bun1.3.14. |

The existing `check:native-npm-sigstore` separately passed with Node22.22.2:
authentic verification, all four existing rejection controls, and the new
isolated lifecycle child. It ran against the targeted compiled npm before the
lock path arrived; this narrow command does not build or pack. Full regeneration
left `Auth.js` byte-identical, SHA256
`a3164b34759256d4b14fda689702bc03c89ed889cacae6b822e9b98fb618bf75`.
The unchanged native witness was therefore reused. Log:
`/tmp/ts-release-native-settlement-sigstore-profile.log`; native receipt:
`.release/checks/native-sigstore.json`.

Generated `release/Model.js` matches compiled application Model byte for byte,
SHA256 `bd9d8b7e648df5a6050eba6049ca78f5c5d43e561134b0161ea03730f5b97a49`.
Bun retains the named read definition in `input.ts` (SHA256
`75c90c4b0f62e078649f052a321bcb15635062cd4d02912df6d688a8d17881c6`).
Independent review confirmed the added native operations remain deferred;
the existing input command never calls `read`, and no workspace-relative import
was introduced.

A second bounded batch held the same lock for one isolated starter consumer.
It copied the actual generated starter, installed the current core/npm archives
plus the built GitHub archive with Bun, checked physical package resolution and
byte equality with current dist, then ran Node `prepare.mjs` on the existing
packed fixture archive and the documented Bun `input:release` without
`--execute`. All commands exited 0. Actual Bundle/Plan bytes and retained/input
identities agree, and authorization is false. No inherited publishing
credentials, journal access, signing, observation or publication was used.

The existing temporary-probe approach is retained instead of adding a committed
test: `/tmp/ts-release-current-starter-F4pFW4/qualification.json` contains exact
commands, raw results, resolutions and hashes, SHA256
`895a8a9348ff1ac4e47ba6b08b88b289a43609163069823c3b5f26c10c07c151`.
Its summary log is `/tmp/ts-release-native-settlement-starter.log`.
Core/npm archive hashes are in [Sigstore qualification](native-sigstore-settlement.md#integrator-qualification);
GitHub's archive is
`b02ec589dc3fe2e7148be4fada2bb81397443fb9149513f75968cae8d0ffbe71`.

The ordinary full suite, unchanged catalog/Action/kernel profiles and retained
distribution were not rerun: the selected existing scenarios cover affected
application/auth behavior, while this isolated starter exercises the actual
changed generated application. Catalog installed-workflow and packed Action
use fixture applications and cannot replace that evidence. These results do
not qualify other hosts/engine versions, live providers or Bun native Sigstore.
Original root staging remains byte-identical to the retained snapshot.

The ten changed runtime, proof, generated-delivery and maintained guide inputs
are frozen in `/tmp/ts-release-native-settlement-final-inputs.json`, SHA256
`e96f95c2803cf687c9ddcfbc42be3ba79453663754be7017009c982895ab441a`.
Research/status documents are excluded from that manifest to avoid a
self-referential hash; Git records them with the same bounded increment.

Remaining implementation includes provider/application broad helper policies,
the shared preparation `mkdir` and Bundle/Plan writes, native signing's separate
approval/settlement policy, HTTP/SQLite cleanup outcome ownership, and the R26
private credential-fixture import. These successful-native interruption proofs
do not establish arbitrary native body/cleanup failure combinations. A native
call that never settles can still delay cancellation. R32–R35 product increments
and W7 all-host/final migration closure remain open.

New-branch publication is independently blocked: automatic approval review
rejected it because direct user approval covered only the earlier checkpoint
destination. The existing approval question remains pending. This slice has not
been pushed, and that rejection has not been retried or bypassed.

## Credential fixture ownership

Branch `codex/credential-fixture-ownership`, isolated checkout
`/mnt/models/dev/ts-release/.credential-fixture-ownership`, starts at
`fc7d1412a75509f48f39f0e551affe7432ee2432`. This bounded W5 increment closes the
R26 private npm import/request-double exception identified by the retention
review. It changes three test/fixture files plus these research records.

The existing npm structural-envelope helper moves into its shared fixture owner
without duplication. Self-release now authors the expected provenance statement
through public `createProvenance`, supplies both exact owned artifacts, and uses
actual public provider preparation. The explicit Attest/VerifyProvenance ports
still provide structural/credential-policy coverage only. Registry reads and
journal/transport writes are forbidden; all original 201/401, one-read,
one-exchange, zero-write, diagnostic-shape and secret-redaction assertions remain
unchanged. No test case, production export or weaker authorization scenario was
introduced. [Ownership and proof details](credential-fixture-ownership.md).

The existing static check and selected npm-auth/self-release-credential tests ran
sequentially under `flock -n /tmp/the-show-full-verification.lock`. Both exited
0: static formatting, compiler/build, lint, types, imports and entries passed;
behavior passed **9 tests, 0 failures, 67 assertions across 2 files** in one
uninterrupted selected run. Raw logs:
`/tmp/ts-release-credential-fixture-check.log` and
`/tmp/ts-release-credential-fixture-behavior.log`.
Frozen installation required leaving the sandbox after temporary/cache access
failures, with no dependency or toolchain change. Independent read-only review
found no blocking issue and ran no duplicate checks.

The three changed test/fixture inputs are recorded in
`/tmp/ts-release-credential-fixture-inputs.json`, SHA256
`d8fa89ff597712e7cbc82dd61aab02c776c2d938effd16f93db952a08dc88bda`.
Production, dependencies, scripts and generated delivery are unchanged from
qualified fc7d141; its bounded packed npm/native SDK/isolated starter evidence
remains applicable. No new native network, delivery-generation, full-suite or
distribution run was warranted. Original root staging remains untouched.

Independent plan work remains. The next bounded W3 owner is Catalog's separate
`Shared.renderBytes` admission/failure policy: its catch still converts every
exception to `catalog-input`, while `downloads` has explicit expected raw-Error
refusals. Inventory those renderer callers and translate their expected refusals
before preserving unexpected defects, using the existing catalog rendering
checks first. Preserve the fixed code/message and exact owned-download rules;
no catalog regression, implementation or qualification is claimed here.
The five-provider shared-helper prerequisites, application helpers, candidate
writes, signing and HTTP/SQLite cleanup remain separate work, as do R32–R35
product increments and W7 final closure.

This increment is local only. The existing direct publication question remains
pending; no original or descendant branch push, signing or live publication has
been attempted.

## Catalog failure policy

The next bounded W3/R10 increment is on `codex/standards-continuation`, based on
`8b80d967fb6ae68aa40daf398e5bce4f86b803d4`. Catalog's private rendering owner now
preserves unexpected exceptions as defects and local/foreign declared errors as
typed failures. Its three owned-download refusals and Schema admission retain
exact fixed `catalog-input` diagnostics. No renderer algorithm, public signature,
identity, credential, transport or runtime dependency changed.

[The detailed record](catalog-error-policy.md) includes the genuine initial red,
the initial overstrong Schema-wrapper identity assertion, the corrected final
assertion's separate baseline control, and final source green (4 tests, 93
assertions). Independent review found no actionable issue. A serialized batch
under `/tmp/the-show-full-verification.lock` passed full static checks, all four
existing native format tests (86 assertions), and the existing packed Catalog
selector. Its 61 commands passed for seven actual archives, Bun/npm installs,
strict declarations and Node 22.22.2/Bun 1.3.14 consumers. No new transport or live
publication check was run. Five qualification inputs have manifest SHA256
`420f1fe79ee7f25771afb0dad16ccfb03c4a34af1aa694fe9a3eaefc2f92cca6`.
Original root staging remains byte-identical to the retained snapshot.

Provider primitive prerequisites and candidate write ownership are next; shared
provider strict classification, application privacy policy, signing/cleanup and
R32–R35 remain open. The release workflow also needs explicit compiler patching
in its two `--ignore-scripts` jobs before build; that is a separate CI increment.
Work continues through independently authorized local slices. This increment
has not been pushed; no pending publication approval has been retried.

## Explicit compiler patching in release CI

Following Catalog commit `d7837c5ddbf4196e3e79f5cd9984263ebc00e734`, both the
attestation and publication jobs now run the existing `bun run prepare` between
`bun install --frozen-lockfile --ignore-scripts` and `bun run build`. A fresh
ignored-script install would otherwise leave stock TypeScript, which the new
build guard correctly refuses. The preparation job's ordinary frozen install
already invokes the hook. Dependency lifecycle scripts remain disabled in the
other two jobs; workflow approval, permissions and candidate selection are
unchanged. CONTRIBUTING documents the same explicit-install contract.

The existing patch command and toolchain guard exited 0 under the shared lock;
log `/tmp/ts-release-ci-explicit-patch.log` explicitly reports an already-patched
compiler and version `7.0.2+effect-tsgo.0.45.0`. This is an idempotent invocation,
not a new clean-install proof. The prior milestone's actual ignored-script/stock
compiler negative control remains the evidence for the failure mode. Prettier
checked the workflow and contributor guide successfully. No new test/configuration
mirror, full profile, hosted workflow, signing or publication was run. Provider
and self-release agents are editing separate owners; this local CI commit stages
only the workflow, contributor guide and this status record.

## Provider request and archive prerequisites

Following local CI commit `0354d1c7caba8e283b2f5162e2c1f1f377e718de`, the first
compatible provider primitives now classify their own expected native failures:
request byte cloning, tar UTF-8, npm/PyPI gzip and PyPI ZIP UTF-8/inflate.
PyPI request matching reuses existing owned-request capture. Existing provider
codes remain; direct public tar users now receive the supplied callback's
`encoding` reason instead of an uncaught decoder exception. Shared provider
`attempt`/`admit`/`matches` are deliberately still broad while other callers are
prepared. [Owner inventory and evidence](provider-native-prerequisites.md).

The strengthened existing gzip assertion genuinely failed before these edits
at the private native owner and passed afterward. With frozen inputs, full
static checks and the rebuilt npm/Warehouse composition passed, alongside the
separate candidate-write proof: 11 tests/312 assertions/4 files. Exact limits
and the ignored nonexistent preparation selector are recorded in the owner
note. Installed-provider qualification remains assigned to the coordinated
strict-boundary slice; no packed or live provider success is inferred here.
Candidate-write source/generated/proof changes are present but excluded from
this bounded provider commit. All work remains local, with publication approval
still pending.

## Candidate write settlement

Based on provider-prerequisite commit `8aa26ccfe55558cf99a615143a5352fc3f046ddc`,
self-release now joins each issued exclusive directory creation and Bundle/Plan
write before restoring interruption. The existing bytes, `wx` flags, directory/
file modes, ordering and partial-candidate retention stay intact. No rollback,
atomic-directory promise or new recovery identity is introduced. Generated starter
`release/prepare.js` contains exactly these three masks and the same explanation;
its public guide and changelog describe cancellation and stuck-native limits.

[Detailed proof](self-release-write-lifecycle.md) records a genuine baseline
failure using actual prepareRelease and a real Bundle write with held completion
delivery. Teardown joined the write on the failing baseline too. The exact test
then passed after rebuilding; no Plan write starts after the interruption. Root
full static checks passed together with the provider prerequisites. Selected
provider/lifecycle checks passed 11 tests/312 assertions; the actual existing
application file then passed 11 tests/70 assertions separately. Delivery
regeneration exited 0. Logs use `/tmp/ts-release-primitives-writes-` and
`/tmp/ts-release-candidate-write-` prefixes in the detailed record.

No new archive/API/installed-starter/native-signing/full-distribution run is
claimed. The generated diff adds no import or eager operation; the prior installed
starter closure remains applicable, while this native compiled-application proof
owns the changed write lifecycle. Native mkdir and Plan-write holds were not
independently reproduced; the one real Bundle-write interruption covers the
shared per-issued-operation pattern. Source remains local and original staging
is untouched. Signing settlement and self-release privacy/error classification
remain separate next slices, with R32–R35 and W7 still open.

## Native signing settlement

Following candidate-write commit `17d491dfc0cbcbdb0653c233cc2981091c0dc321`, npm
now masks only the already-issued native Sigstore attestation promise. Signing
approval, token acquisition, fixed failure projection, retry:0, subsequent verify
and candidate retention are unchanged. A stuck SDK call can delay cancellation;
joining does not establish rollback or permission to retry an unknown outcome.

[The proof record](native-sigstore-signing-settlement.md) uses SDK 5's actual
malformed synthetic-token rejection before any network call. Its original
baseline genuinely completed interruption too early. The first after-fix run
proved joining but exposed a mistaken interruption-only assertion: rc.115 gives
the settled typed SDK failure precedence. Corrected assertions require the safe
failure, zero defects/token disclosure, joined work and zero network attempts.
The corrected fixture failed against identical original Auth/SDK bytes in the
preserved baseline checkout, then passed current compiled code. This later
baseline control is documented separately from the initial pre-edit red.

Pinned npm compilation and toolchain checks exited 0 under the shared lock.
Corrected direct Node 22.22.2 proof and Bun wrapper passed. An extra integrator
wrapper invocation omitted the explicit Node path and was correctly refused
because the environment's `node` launched Bun; this is recorded without a new
Node-engine claim. No actual Fulcio/Rekor request, successful signing, full gate
or installed archive was exercised. Those source/proof/doc paths alone are in
this local signing commit; concurrent provider, application, observation and
executor edits remain separate and await integrated qualification.

## Strict provider admission

Following signing commit `a7043878ef964dac1ebcff6e3a2569471c5dc0e9`, the five
provider families now classify expected native/schema/domain refusals at their
owners before sharing a strict HTTP data boundary. Known release errors retain
identity/fields; unexpected callback, getter and parser-algorithm failures remain
defects. MCP/GitHub malformed-evidence fallbacks retain Unknown/Inconclusive for
expected input. Credential and SDK privacy projections remain intentional.

[Provider implementation](provider-error-policy-implementation.md) records each
translation, the three genuine initial failing controls, the later MCP malformed
response control and the corrected OpenAI assertion. [Coordinated qualification](continuation-qualification.md)
records static success, 354 passing behavior cases plus the separately repaired
assertion, all seven installed provider archives, Action/workflow and refreshed
starter. These stages include the still-separate application/observation changes;
they are not claimed as an independent full run of this intermediate commit.
No live provider or publication action ran. HTTP/SQLite cleanup, R34 preflight
and final requirement disposition remain subsequent work.

## Self-release error ownership

Following provider commit `6ed3526`, the private self-release admission owner now
preserves unexpected defects and translates declared/schema refusals to its
existing fixed subject diagnostic. Its twelve callers explicitly own expected
policy guards and native UTF-8/URL decoding. Secret-bearing declared errors stay
redacted at this application boundary. Repository admission uses Schema decoding
rather than a constructor-only check. Candidate identities, bytes, signing
approval and dispatch rules remain unchanged.

[Application evidence](self-release-error-policy.md) records the actual initial
getter-defect failure and unchanged-test green result. Final static checks,
application cases, generated delivery and isolated installed starter preparation
passed in the [coordinated profile](continuation-qualification.md). The profile's
one corrected OpenAI assertion remains separately reported. Observation/executor
changes are the next local slice; HTTP/SQLite cleanup and preflight remain open.

## Bounded observation and retained executor selection

Following self-release admission commit `084a9b9`, Node/Bun runners now admit
an explicit bounded observation policy. One acquired application refreshes
native observations with monotonic budget/backoff and derives safe pending,
conflict or satisfied visibility from the journal. Timeout settlement preserves
failures/defects; no observation result authorizes resend. Legacy string modes
and ordinary report shape remain intact. The maintained verifier uses this API
and refuses an older executor before input/application access.

The self-release installer separately selects current built executor archives
with `--executor=checkout`, without altering retained publication bytes. Workflow
attempts retain exact executor/archive/helper receipts under attempt-specific
artifact names. The actual original signed 0.4.1 candidate was admitted by an
isolated installation of all seven current packages. Its real superseded
26-operation Plan and complete two-event history stopped every publication
capability in a deliberately incapable adapter; candidate bytes stayed unchanged.
Its lack of historical dispatches is an explicit limit, not a recovery success.

[Observation evidence](bounded-observation.md), [retained executor proof](retained-executor.md)
and [coordinated qualification](continuation-qualification.md) record genuine
baseline failures, fixture corrections, exact installed/archive identities and
all stopped stages. The initial historical probe's empty captured stdout was
corrected at its temporary result transport; no runtime assertion was weakened.
No push, live publication, signing or hosted workflow was performed. R34 request
preflight, HTTP/SQLite cleanup and final capability disposition remain active
local work, with no additional publication approval implied.
