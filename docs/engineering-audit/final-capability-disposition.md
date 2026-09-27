# Capability disposition for standards closure

Owner review on 2026-09-26, initial checkpoint
`8d5bbaffe7e88298f9e2d91d4cdde9d75e5200d7` in `codex/standards-continuation`.
This follows [the original closure review](standards-closure-review.md), with
current source and the subsequent lifecycle/error-policy records inspected.
It addresses R05–R07, R11–R14 and R28. The enumerated capability and
native/API retention decisions are complete for this review; all D1–D5 owners
and the later CLI fixture finding have concrete repairs. **Final combined
static/runtime, packed core/provider/Action and installed-workflow qualification
passed for the frozen current inputs.** The [final record](final-qualification.md)
identifies those inputs and raw exits; this does not certify unrun hosts or live
provider operations. Historical findings and before-fix evidence remain identified
below; each repair links its actual owner record.

The historical [inventory](ts-release-inventory.json) contains **41 declaration
shapes in 14 capability families**, not 41 separate runtime services. Its source
positions describe the historical checkpoint. All 41 shapes are accounted for
below by their original name and C-ID. Current file links identify the owners;
new bounded observation and repaired file/SDK operations are included even though
they were not separate service-shape matches in that inventory. No inventory
regeneration, count target, forwarding service or new enforcement system follows.

AGENTS/CONTRIBUTING were reread. Installed Effect remains `4.0.0-rc.115`; the
previously read complete guide retains SHA256
`e155acab559b29e0a54acd0f5d8d4b7a428268ba6eb1aba4d62b4876d6b1a78e`.
Relevant current implementations/declarations were inspected. Dependency-file
links here are local research references, not shipped application dependencies.

## Complete declaration disposition

“Retain” means the named construction/API decision is justified; it does not hide
an repair or qualification limit listed in the last column. Counts only establish that the
historical declaration inventory has no omitted row.

| Family / shapes                                                                                  | Construction, selection and disposal                                                                                                                                                                                                                                                                                                                                      | Disposition / remaining owner                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C01 (2): HostShape, Host**                                                                     | [Host](../../packages/ts-release/src/internal/Host.ts) captures provider methods, store/transport methods, wall time and ID callbacks. The application chooses the concrete host and provides it at its interpretation boundary. No resource is allocated by the service tag.                                                                                             | **Retain domain authority aggregate.** Splitting journal/transport into forwarding tags would obscure their joint dispatch contract. Preserve existing caller-selected synchronous time/ID ports; see the explicit Clock/Crypto decision below.                                                                                                                         |
| **C02 (3): JournalStore, SqliteJournal, GitJournalOptions**                                      | Application selects scoped [Git](../../packages/ts-release/src/platform/GitJournal.ts) or Bun-only [SQLite](../../packages/ts-release/src/platform/SqliteJournal.ts). StoreCodec owns durable bytes, native adapters own row/wire admission, and the kernel owns mutation permission.                                                                                     | **Retain port/adapters.** SQLite rows now use Schema and native SQLiteError classification. SQLite acquisition-cleanup error composition is implemented at D2; completed Git repository retention has a reproduced repair and targeted proof (D4). Neither requires another store service.                                                                              |
| **C03 (4): ProviderDefinition, NativeFailureBoundary, Author, HttpProviderDefinition**           | [Provider](../../packages/ts-release/src/Provider.ts) captures versioned codecs/callbacks; application-created npm/GitHub/etc. definitions close over explicit content/read/trust ports. Registry payloads remain opaque until the provider's codec admits them.                                                                                                          | **Retain versioned contract.** Closed `ReleaseError`/no-service execution is deliberate at this heterogeneous registry; factories capture selected implementations. Public generic factory/derivation E/R remains preserved where actually offered. The implemented provider strict error policy owns expected refusal versus defect, not a generic service conversion. |
| **C04 (5): Transport, CoreGitOptions, GitCommand, GitRuntime, RawCommand**                       | [GitAuthority](../../packages/ts-release/src/internal/GitAuthority.ts) captures exact conditional-push authority; [Process](../../packages/ts-release/src/platform/Process.ts) owns bounded native child output/deadline/group termination; [GitProcess](../../packages/ts-release/src/platform/GitProcess.ts) owns private repositories and sanitized child environment. | **Retain native adapter/API compatibility.** Compare actual platform behavior, not claims that Effect lacks process groups. D4 shortens completed journal and catalog leaf-operation repository lifetimes; a GitHost prepared send must retain its repository until that later send settles. Native fixture teardown has a reproduced R28 repair (D5).                  |
| **C05 (5): HttpRead, OidcTokenSource, CredentialExchange, ResolveCredentials, BoundCredentials** | [HTTP](../../packages/ts-release/src/platform/HttpTransport.ts) captures credentials, provider ownership and limits, then owns one non-pipelined client/socket per request. [OIDC](../../packages/ts-release/src/platform/GithubOidc.ts) reads Config at invocation, validates exact issuer/claims/JWKS and uses Clock wall time.                                         | **Retain explicit ports and narrow native wire adapter.** Keep secret projection and receiver-capturing zero-argument credential callbacks. HTTP destroy failure joining is repaired at D1; it cannot confer resend authority. Do not replace this closure with a second injectable global client.                                                                      |
| **C06 (3): ContentOwner, ReadContent, PutContent**                                               | [Content](../../packages/ts-release/src/internal/Content.ts) captures caller methods; [ContentStore](../../packages/ts-release/src/platform/ContentStore.ts) brackets actual handles and joins issued operations, with native flags, immutable install and fsync semantics. Public generic ReadContent preserves its error parameter.                                     | **Retain meaningful port/native exception.** [Lifecycle repair](content-store-lifecycle.md) replaces the old broad-mask concern with explicit operation boundaries. No further ContentStore rewrite is justified by the old inventory verdict.                                                                                                                          |
| **C07 (3): DeriveDeliveryFiles, AppleToolsShape, AppleTools**                                    | [AppleTools](../../packages/ts-release/src/apple/Tools.ts) captures Apple.Apple/Env once in its selected Layer; [Native](../../packages/ts-release/src/apple/Native.ts) uses FileSystem/Path/Crypto and scoped workspaces. Caller-supplied delivery derivation preserves R. Actual external xcrun operations belong to effect-build-apple.                                | **Retain the existing service and Layer composition.** Free functions wrapping already-named Apple operations are useful boundary methods, not missing services or mandatory new spans. Existing protocol/installed evidence cannot certify a successful native macOS signing/notarization lifecycle; that is a named native profile, not a source-style defect.        |
| **C08 (2): Application, CreateApplication**                                                      | [Application](../../packages/ts-release/src/platform/Application.ts) admits mode before factory invocation, acquires one Scope, captures host/options, and returns the finalized report. `runApplicationEffect` preserves factory E/R; the outer trusted-module Promise adapter preserves its explicit old factory-error projection.                                      | **Retain additive Effect runner and Promise framework bridge.** [R32](bounded-observation.md) uses this owner for monotonic observation, joined timeout settlement and no dispatch. Do not replace CLI/Action entrypoints with another runtime facade.                                                                                                                  |
| **C09 (3): LocalAuthenticationOptions, LocalAuthentication, LocalAuthenticationHost**            | [LocalAuthentication](../../packages/npm/src/LocalAuthentication.ts) captures its notify/read/config callbacks, owns ephemeral token/challenge/password maps in Scope, consumes OTP once, and only authenticates after durable rejection. The small internal host is an explicit deterministic external-edge substitute.                                                  | **Retain bounded authentication owner.** Existing TestClock/fiber ownership is repaired. D3 now records reproduced timeout-loser cleanup loss, the minimal owner repair and its unchanged-test green. A cancellation assertion alone did not cover failing cleanup. The local npmrc parser remains a deliberate narrow literal-token grammar.                           |
| **C10 (2): Attest, VerifyProvenance**                                                            | [npm Auth](../../packages/npm/src/Auth.ts) owns captured TUF/cache/timeout policy, structural/source admission and real Sigstore. Only issued noncancellable SDK calls are masked. The application chooses actual signing/verification explicitly.                                                                                                                        | **Retain native crypto authority.** [Verification](native-sigstore-settlement.md) has authentic success plus interruption evidence; [signing settlement](native-sigstore-signing-settlement.md) has actual native rejection/no-network proof, not successful live signing. Neither callback is a generic retry service.                                                 |
| **C11 (4): ObserveRef, ObjectBuilder, GitCatalogHost, GitCatalogHostOptions**                    | [GitHost](../../packages/ts-release/src/platform/GitHost.ts) captures content/credentials and a scoped runtime. Objects and ref reads use genuine Git; prepared transport retains exact imported objects/credentials until the later core-authorized send.                                                                                                                | **Retain shared concrete host; no forwarding Layer.** D4 closes completed observation/capture/construction repositories after real retained-disk reproduction. Prepared send closures retain the original scoped repository lifetime. No leak after normal scope disposal is claimed.                                                                                   |
| **C12 (2): Machine, HistoryMachine**                                                             | [Decision](../../packages/ts-release/src/internal/Decision.ts) constructs pure projections from admitted Plan/history. Optional alternative evaluation is selected by Host and retains the same durable authority.                                                                                                                                                        | **Retain pure computation.** Do not introduce Context, Scope, timers or operation spans into deterministic identity/history functions. Fault/evaluator checks remain meaningful only where they protect distinct no-replay laws.                                                                                                                                        |
| **C13 (2): Headers, Manifest**                                                                   | [Headers](../../packages/ts-release/src/Http.ts) is request data; [MCP Manifest](../../packages/mcp/src/Model.ts) is a structured domain Schema. Neither is acquired/disposed.                                                                                                                                                                                            | **Retain explicit values.** These are lexical service-search matches, not missing capability construction. No service or Layer action remains for these rows.                                                                                                                                                                                                           |
| **C14 (1): ActionError**                                                                         | [Action launcher](../../apps/action/src/launcher.ts) resolves the application's physical installed core, then delegates scoped execution/signals. Its own configuration exception and bounded formatting avoid importing a second core/Effect instance.                                                                                                                   | **Retain narrow framework exception.** Packed Action/installed workflow protect the single-authority instance and safe output. A Schema error class here would require the runtime dependency the launcher intentionally excludes.                                                                                                                                      |

## Named findings, repairs and qualification

### D1 — HTTP destruction outcome (R05, R07, R12)

The original [HTTP owner](../../packages/ts-release/src/platform/HttpTransport.ts)
joined `socketClosed` but suppressed `client.destroy()` rejection. The
[cleanup repair](native-cleanup-lifecycle.md) replaces split completion/interrupt
cleanup with one `onExit` finalizer. It schedules socket and client destruction
before either can throw, joins both plus the socket-close signal with
`Promise.allSettled`, and projects failure to fixed `http-cleanup`. Effect
composes that safe cleanup Cause with the response Cause. No native private text
is exposed, and cleanup cannot create retry permission or a known noncommit.

The actual loopback/Undici proof holds only delivery of the real socket-close
signal and injects rejection after the real client destroy completes. The
before-fix result lost `http-cleanup`; the exact final fixture's later baseline
control and instrumentation corrections are retained in the owner record. This
is not a reproduced native Undici close failure. Rebuilt current-source runtime
and affected packed qualification passed in the coordinator's
[final profile](final-qualification.md).
If native destruction or its close signal never settles, finalization can still
remain pending; no fabricated cleanup-success timeout is added.

### D2 — SQLite failed acquisition plus close (R05, R12)

The original [SQLite constructor](../../packages/ts-release/src/platform/SqliteJournal.ts)
closed inside the initialization catch, allowing a thrown close error to replace
the initialization failure. The [repair](native-cleanup-lifecycle.md) separates
opening from initialization inside existing `acquireRelease`, then uses
`onExitIf(Exit.isFailure, ...)` to close failed acquisition while preserving both
causes. Successful acquisition retains the normal scoped close. SQL, durable
bytes, native SQLiteError classification and mutation semantics are unchanged.

An extension of the existing legacy-format refusal calls real native close then
throws a marker TypeError. It genuinely failed before the edit and the existing
SQLite file passed **2 tests / 14 assertions** after the first fix. The combined
compiler subsequently rejected that first `onError` API's typed finalizer, so the
current owner uses rc.115's suitable `onExitIf` without `orDie`. That correction
then passed the [final static/runtime qualification](final-qualification.md);
the first transpiled source green is not relabeled compiler success. Default native SQLite close
itself did not fail in this proof, and ordinary scoped close was not redesigned.

### D3 — Local authentication timeout loses settled cleanup cause (R12, R13, R28)

The original [LocalAuthentication workflow](../../packages/npm/src/LocalAuthentication.ts#L277)
used `timeoutOrElse` around notify/poll. Pinned
[Effect implementation](../../node_modules/effect/src/internal/effect.ts#L3830)
delegates to `timeoutOption`, which races and joins the loser while discarding
its Exit. This replaced a real timed-out read finalizer defect with ordinary
`authentication-timeout`; the challenge wipe outside that race was already joined.

The existing [logical-clock timeout case](../../test/reimplementation/npm/local-authentication.test.ts#L449)
now retains its ordinary timeout/cancellation assertions, then captures another
challenge and makes the same deliberate read port's finalizer die with a specific
`TypeError`. It requires that actual defect and no typed Fail, followed by the
same consumed-challenge refusal. Necessity: cancellation alone proved neither
cleanup success nor preservation of the failing cleanup channel. The six existing
cases remain six; no native authentication, signing or test matrix was added.

Before production editing, exact Bun 1.3.14 ran:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test \
  test/reimplementation/npm/local-authentication.test.ts \
  --test-name-pattern 'browser completion refuses'
```

This exited **1**: `0 pass / 1 fail / 5 filtered`, 40 assertions, at the missing
actual defect assertion. Raw log: `/tmp/ts-release-local-auth-settlement-red.log`.
Production SHA256 was
`1bba9126f38197570d56d14820d71860dda646b25a0b2268253cdae10f607028`;
red test SHA256 was
`5e613c5aca9bfb1fa5534c91e6138885db315c62cd311f173e6a4e34e437b989`.

The repair adds one local `onExit` capture before the same timeout combinator.
After joined timeout, a loser Cause containing Fail or Die is repropagated intact,
including composite interruption causes; only ordinary timeout interruption
receives the existing fixed timeout refusal. External caller interruption does
not invoke the timeout fallback. The existing notify failure projection and native
HTTP credential privacy boundary remain unchanged; this code neither reads raw
credentials nor serializes a native diagnostic. The final challenge wipe remains
outside the race. This is the same specific rc.115 behavior already reproduced
at the R32 owner, not a new general timeout abstraction.

Running the entire existing file with the same Bun exited **0**, **6 pass / 163
assertions**, log `/tmp/ts-release-local-auth-settlement-green.log`. The test is
byte-identical to red. Final production SHA256:
`acfb66aafa101751cd7abbf14c50232a07848737fcc21da502636b361ac159ee`.
Source-only Prettier and strict focused oxlint also exited 0; lint log
`/tmp/ts-release-local-auth-settlement-lint.log`. The check used:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun oxlint \
  -c .oxlintrc.json --deny-warnings \
  --report-unused-disable-directives-severity error \
  packages/npm/src/LocalAuthentication.ts \
  test/reimplementation/npm/local-authentication.test.ts
```

Those focused results are source-owner proofs, not live npm claims. The
coordinator subsequently qualified the frozen source with the
[final compiler/runtime and affected installed profile](final-qualification.md).

### D4 — completed Git repositories retained for the whole application (R05, R12, R14)

Originally [GitRuntime.repository](../../packages/ts-release/src/platform/GitProcess.ts#L153)
created a new directory per call and removed it only when the enclosing runtime
root closed. Every Journal snapshot and catalog observation/capture/construction
therefore retained obsolete object databases for the whole application lifetime.
Each output/history snapshot had a bound; aggregate retained disk across completed
operations did not. The coordinator reproduced this before each affected owner
repair: the existing native SHA-1 Journal case retained **9 repository HEADs**
while both journal scopes remained open, and the existing native SHA-1 GitHost
case separately retained **9 HEADs** before its builder scope closed. Both failed
the added empty-retained-repositories assertion. Raw logs:
`/tmp/ts-release-git-journal-retention-red.log` and
`/tmp/ts-release-git-host-retention-red.log`. These measure actual retained native
repositories, not disk exhaustion or a leak after normal scope closure.

The reviewed repair keeps native removal at GitProcess's private repository
`close` capability; failed initialization closes through `onError`, preserving
Effect finalization semantics. Root removal remains the safety net. Journal
[selection and reads](../../packages/ts-release/src/platform/GitJournal.ts#L84)
retain coordinate/credential admission before acquisition, then bracket the whole
snapshot/read or snapshot/append/CAS. The close finalizer sits outside the
conditional-push ambiguous-outcome fallback. Catalog
[leaf operations](../../packages/ts-release/src/platform/GitHost.ts#L34) similarly
bracket observeRef, captureBase and construct; their return values own the scalar
or fully materialized object-set bytes. No repository escapes those results.

[Prepared transport](../../packages/ts-release/src/platform/GitHost.ts#L110)
retains its original repository lifetime because its returned send closure still
needs the imported objects. No public cleanup API or broad Scope requirement was
added. Acquisition is masked by `acquireUseRelease`, but native initialization
retains the existing command deadline and joined process teardown. Cleanup
failure remains an observable defect instead of granting any retry authority.

Independent review of all three production files found no blocking issue. The
coordinator reports targeted **5 Journal cases / 43 assertions** and **3 GitHost
cases / 40 assertions** passing after the fixes. The final small Journal change
restoring prior admission-before-acquisition order followed those targeted runs;
it is included in the passing [final static/runtime profile](final-qualification.md).
The existing object-format, CAS, lost-acknowledgement, prepared-send and environment
checks remain the regression authority; no duplicate outcome matrix was added.
The [Git lifecycle record](git-repository-lifetimes.md) retains exact baseline and
regression hashes, commands and the final ordering correction chronology.

### D5 — native process-test child ownership on runner cancellation (R28)

The original [Git runner](../../test/reimplementation/transports/git-runtime.test.ts)
awaited its real native consumer without runner-finish teardown, while the
[consumer](../../test/reimplementation/transports/git-process-consumer.mjs)
removed files without always aborting/joining an active native operation on early
termination. The [owner repair](native-process-test-lifecycle.md) was preceded by
a real unchanged-consumer SIGTERM probe: validated detached parent/child PIDs
remained live and the temporary root remained. The probe cleaned only those
recorded native processes in its own finally; no abandoned fixture was left.

Bun now registers `onTestFinished` before spawning, signals only an active
consumer and joins exit/stdout/stderr. The consumer latches SIGTERM before
acquisition, aborts its active operation and joins it before removing its root;
its existing scoped Process adapter owns termination of the detached group.
The unchanged probe passed under native Node22.22.2 and Bun1.3.14. The existing
selected test passed **1 case / 4 wrapper assertions**, retaining all 18 internal
native assertions per consumer. The final active-child guard is included in the
passing [coordinator combined profile](final-qualification.md). This
proves the stated SIGTERM/runner ownership, not universal SIGKILL recovery.

### CLI follow-up — causal backpressure and child teardown (R28)

The final disposition review separately identified the retained CLI pipe fixture's
100ms stabilization and missing parent/second-child teardown. The
[CLI owner record](cli-pipe-test-lifecycle.md) documents the bounded repair in
existing [cli.test.ts](../../test/reimplementation/kernel/cli.test.ts) and
[cli-pipes.py](../../test/reimplementation/kernel/cli-pipes.py). Python owns an
ordinary native pipe and waits for actual non-writability without draining the
read end, replacing the fixed delay. Bun joins its active Python child on runner
finish; Python signals/joins its active CLI, closes streams/descriptors and
removes its temporary root. The same three cases and 13 assertions per runtime
remain; no production CLI change or new matrix was introduced.

Both existing Node22/Bun cases passed (**2 cases / 4 wrapper assertions**) under
the shared lock, and targeted lint/Python parsing passed. This is source-owner
review plus actual native green, not a newly reproduced production CLI failure
or retrospective test-first claim. The pinned Bun hook experiment is reused from
[logical-clock qualification](logical-clock-tests.md#runner-timeout-qualification-before-the-repository-edit).
Final combined checks passed. Unix pipe readiness does not certify Windows
pipes or cleanup after an uncatchable process kill.

## Native/API exceptions and bounds retained deliberately

- **Process and Git:** installed Effect NodeChildProcessSpawner already supports
  group kill/wait/escalation. The exception is the current adapter's combined
  exact output bound, fixed safe failure, sanitized environment, conditional
  push semantics and optional-platform-peer compatibility. Source/installed Linux
  Node/Bun evidence does not certify Windows or macOS process trees.
- **HTTP:** installed NodeHttpClient uses normalized Undici response headers;
  the current owner needs duplicate raw-header validation, discarded-framing
  byte accounting and ownership before TLS handshake completion. Effect retry
  and redirect combinators are opt-in. Keep one no-pipelining/no-idempotent-retry
  native request and fixed body/header/wire/deadline bounds; do not justify it
  with a false claim of unavoidable Effect resends.
- **Content and self-release files:** rc.115 FileSystem's string OpenFlag union
  cannot represent the current numeric no-follow/nonblocking/directory flags.
  [ContentStore](content-store-lifecycle.md), [candidate reads](self-release-read-lifecycle.md)
  and [candidate writes](self-release-write-lifecycle.md) now own their issued
  native settlement. Ordinary platform FileSystem/Path/Crypto remain used for
  EffectBuild/Apple operations where those exact native contracts are unnecessary.
- **Clock and identifiers:** `Host.now` is durable event wall time, not an elapsed
  budget; the application explicitly supplies Date.now/randomUUID. Clock exposes
  a synchronous current-time projection, while Crypto.randomUUIDv4 is an Effect
  with service/error requirements. Retain the current host callbacks rather than
  changing the synchronous public authority contract solely for a built-in count.
  OIDC already uses Clock wall time; authentication and R32 use Effect elapsed
  timing. Native process/socket deadlines remain native contract tests.
- **Sigstore:** the pinned SDK has no AbortSignal. Keep actual native trust,
  explicit root/cache inputs, retry zero and per-call timeout, with only issued
  verify/attest calls masked. A sequence of SDK calls is not a promised total
  deadline; a stuck issued native call can delay cancellation. Successful live
  signing remains an unrun qualification profile, not a reason to fake trust.
- **Local authentication:** 64 KiB config/response admission, bounded challenge
  map, bounded retry-after and at most ten-minute configured session timeout are
  meaningful bounds. The config file is read before its text-size admission;
  no claim of a pre-allocation filesystem byte bound is made. D3 addresses error
  preservation, not arbitrary tightening of these existing capacities.
- **Journal/history data:** preserve complete history and event identities.
  StoreCodec has a per-event byte limit; Git additionally checks total decoded
  history against the selected output limit. SQLite reads the complete local
  journal and does not promise a total history-memory quota. Adding one is a
  separate capacity/compatibility policy, not a safe count-driven W7 cleanup.
  D4 is narrower: release already-finished native repository copies without
  discarding admitted history.

## R11 and R28 closure decisions

Named Effect functions already own application execution, release interpretation,
HTTP preparation/send/read, Git commands/history, file adoption/read/write, npm
authentication and native Sigstore. Pure codecs, classifiers, deterministic
hash/identity functions and Layer method adapters are not automatically workflows
needing extra spans. Keep `fnUntraced` admission helpers and zero-argument Effect
values such as the native Sigstore runtime gate. Keep public zero-argument
callback contracts (`BoundCredentials.acquire`, IDs/time) with receiver capture;
turning them into eagerly-read Effects would change caller compatibility. No
remaining tracing rename or public signature change is justified by this review.

The existing npm authentication retry/timeout cases and new R32 case use rc.115
TestClock and owned fibers. Native file/SDK lifecycle fixtures use actual native
completion barriers; their timers are outer failure watchdogs. File read/write
and signing Bun wrappers register independent runner teardown. ContentStore's
process watchdog expires before its longer test timeout and its finally joins
the child; native OS wire/process tests retain real time for the behavior tested.
The bare `runWithHost` helper is suitable for the terminating in-memory checks
where used; its existence is not proof that all tests detach work. D5 and the
CLI follow-up close the named native-child ownership findings at their existing
fixtures instead of adding a universal test harness.

This review reads owner contracts, the relevant retained proof assertions and
their prior retention decisions; it does not claim a formal proof of every
anonymous callback or every platform. All 41 historical declaration shapes have
an explicit disposition. D1–D5 and the CLI follow-up are implemented and passed
the coordinator's affected [final combined/packed profile](final-qualification.md):
356 tests with zero failures, strict compiler/lint/import checks, packed
core/provider/Action and installed-workflow checks. Exact frozen inputs and raw
exits are linked from [requirements status](requirements-status.md) and
[implementation status](implementation-status.md). Retain the finite unrun
native-host/live-signing and interrupted historical-dispatch limits; they are not
an unspecified service inventory or a demand for invented compatibility code.

The inventory review itself ran no builds/tests. The separately authorized D3
repair and targeted source checks are recorded above; D1/D2/D4/D5 and CLI results
are attributed to their owner records. The earlier R33 installed-consumer probe
has its own receipt and does not qualify native cleanup. Refreshed standalone starter and historical-executor probes subsequently passed;
the coordinator records their exact receipts in
[final qualification](final-qualification.md). This does not strengthen the
historical-dispatch claim. This final documentation
update changes only this record and the requirement-status document; no new test,
source mechanism, shared output, build or package operation follows from it.
