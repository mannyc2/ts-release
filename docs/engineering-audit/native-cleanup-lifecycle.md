# Native HTTP and SQLite cleanup ownership

This is task evidence for the bounded cleanup increment from baseline
`084a9b9def009dcd8016b5c86fd3f1d8e892f44d`. It follows the
[native lifetime prerequisites](native-lifetime-prerequisites.md), with Effect
`4.0.0-rc.115`, Undici `8.10.1`, Node `22.22.2`, and Bun `1.3.14`.
It does not claim a real native close failure was reproduced. Both regressions
inject a completion failure **after the real native close succeeds**.

## Owners and deletion decision

[HttpTransport](../../packages/ts-release/src/platform/HttpTransport.ts) owns one
native client, its pending socket, and the response deadline per dispatch. Its
old empty rejection handler erased a client shutdown failure. Replacing that
handler alone would make `Promise.all` return before the socket-close signal;
putting fallible cleanup before the response would also lose the response Cause.
The change removes those separate completion/interrupt cleanup paths and uses one
`Effect.onExit` finalizer. It schedules socket and client shutdown before either
can throw, joins both and the close signal with `Promise.allSettled`, then emits a
fixed `http-cleanup` / `Native HTTP resources could not be released` failure when
needed. No native error text enters that error. Effect composes response and
cleanup causes. Request identity, framing, bounds, no-replay policy and credential
ownership are unchanged.

[SqliteJournal](../../packages/ts-release/src/platform/SqliteJournal.ts) previously
closed in the constructor's initialization catch; a thrown close error replaced
the initialization refusal. Opening and initialization now occur separately
inside the existing `acquireRelease` acquisition.
`onExitIf(Exit.isFailure, ...)` closes after failed initialization and preserves
both causes. Successful initialization registers the
same ordinary scope finalizer. The class is private: no new public API or service
was added. SQL, transaction behavior, bytes, path admission, native SQLiteError
translation and ordinary close defect policy are unchanged.

These two resource owners need no new registry, common lifetime facade, capability
bag or test-only production injection. Existing acquisition/finalizer combinators
express the lifetime. Pinned Effect `src/internal/effect.ts:4106–4163` masks
`acquireRelease` acquisition through finalizer registration and masks `onExit`
finalizers; `combineFinalizerCause` at line3935 retains both failing causes.
No additional mask is necessary here.

## Necessary proof and chronology

The existing native HTTP cancellation/response and SQLite legacy-format checks
cover ordinary behavior. Neither observed simultaneous body and cleanup failure,
so one isolated actual-HTTP-owner proof and a narrow extension of the existing
SQLite legacy refusal are retained.

The HTTP [fixture](../../test/reimplementation/transports/http-cleanup-lifecycle.mjs)
uses a real loopback truncated response, real Undici client destruction and real
socket closure. It holds only delivery of the transport's socket-close listener,
and injects a private rejection after the real client destroy Promise resolves.
It requires the Effect to remain pending until the held close signal arrives,
then requires both safe failure codes and no leaked injection text. This also
rejects a fail-fast `Promise.all` replacement. Teardown releases the barrier,
joins the native deliveries and fiber, restores instrumentation, and closes the
server; the [Bun wrapper](../../test/reimplementation/transports/http-cleanup-lifecycle.test.ts)
registers runner-failure cleanup before spawning its isolated process.

The first restricted run could not listen (`EPERM`); it was not a regression
result. An initial replacement of the connector's CommonJS export did not
instrument the imported owner and was corrected before the accepted red. The
final fixture instruments the actual native `net.connect` socket, preserving all
native calls and holding the exact next `once("close")` listener installed by the
transport. No syscall or HTTP implementation is faked.

Before production editing, the accepted formatted baseline failed with only
`http-outcome-unknown`, missing `http-cleanup`; both native closes and pending
before release were true. Afterwards, a JSDoc annotation and removal of an unused
lint suppression changed the fixture without changing assertions. That exact
final fixture was rerun against the unchanged compiled baseline and failed the
same assertion. This second run is a post-edit baseline control, not a reconstructed
pre-edit result. Logs are `/tmp/ts-release-http-cleanup-red-native-final.log` and
`/tmp/ts-release-http-cleanup-corrected-baseline.log`.

The [existing SQLite test](../../test/reimplementation/kernel/sqlite.test.ts)
first retains its ordinary legacy-format refusal. A synchronous, exact-filename
native close wrapper then calls the real close and throws a marker TypeError.
It is restored before assertions or other asynchronous test work. On unchanged
production, the `journal-format` Fail disappeared; the final unchanged regression
passes after the fix, retaining both that Fail and the exact marker Die. The
existing stored-data retention and 1MiB bounds cases also pass: **2 tests, 14
assertions** on Bun1.3.14. Logs: `/tmp/ts-release-sqlite-cleanup-red-final.log` and
`/tmp/ts-release-sqlite-cleanup-green.log`.

Targeted lint passed for both source owners and their proof files, but the first
combined static check then rejected the SQLite `onError` callback: pinned rc.115
requires its finalizer error type to be `never`, whereas the existing native
SQLiteError translation can produce a typed ReleaseError. The source-only Bun
regression had passed because Bun transpilation is not that compiler check.
The coordinator is correcting this to `onExitIf(Exit.isFailure, ...)`, whose
finalizer admits typed errors and combines the Cause. This preserves both typed
cleanup failure and cleanup defect policy without converting them using `orDie`.
The pinned declarations at `Effect.ts:13382`, `:13657`, and `:13748` distinguish
these combinator contracts. The first-green SQLite hash below is the pre-correction
source, not a compiler-qualified final artifact.

HTTP rebuilt runtime qualification, SQLite requalification after that API
correction, and combined static/installed checks belong to the root coordinator;
they were not run by this author and are pending at this snapshot.

## Frozen evidence hashes

SHA256, with compiled baseline separate from source:

| Artifact                                                        | SHA256                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| HTTP baseline source                                            | `fa23ff3b275c1b6eb391572454429571e9ac0c2e6aed45db0cfd62e6e0addd8c` |
| HTTP baseline compiled JS                                       | `2972b1004cada80cee1df37af7b9057bd60462d6e625932411d8ee5bfde94c29` |
| HTTP cleanup-only source at handoff to request-validation owner | `26d1f41470c06b8b5071c4908f02beeabbd6caed51549abf7860be3997d10194` |
| HTTP pre-edit formatted regression                              | `89bc1b582d7f59a1e9739cd445596ada916ba788861f3272000616863779c631` |
| HTTP final lint-corrected regression                            | `0e7dc00eacc20013bac70bece59aa84afb35440ba7e3ccda8c17c7632cf0b257` |
| HTTP Bun wrapper                                                | `9d0eaa0ab1f6de4b0eb23a00f204f156e9907ff1bc9bee16a2d205995d2e0aa2` |
| SQLite baseline source                                          | `14c93fb2ad967fcc7cd26807bd0a8ef9b1e0aae6f96fbecdc9ac69f0b96d4bc4` |
| SQLite first source green, before compiler API correction       | `9fcadf16b27069c278b298803d2529a1b7e93061db2ad840ab7c433666a12886` |
| SQLite identical final red/green test                           | `2ab5a3c036d245d6fa98e90d56337e8a3b64b8781ef55e0a0aa1ccf044d839d7` |

## Limits

The HTTP proof establishes joining and Cause preservation when native completion
settles, including an injected rejected completion. It does not reproduce a real
Undici destruction failure. Pinned Undici
`lib/dispatcher/dispatcher-base.js:114–159` does not forward an internal
`kDestroy` rejection to the public callback; that public Promise can remain
pending. A cleanup Promise or socket that never settles still holds finalization.
Neither `allSettled` nor a catch can safely assert that resource closed. There is
no cleanup timeout that pretends settlement, retry, or new publication authority.

The SQLite proof does not establish authentic `SQLiteError` from default close.
Pinned Bun declarations use `sqlite3_close_v2` by default, allow repeated close,
and reserve `sqlite3_close` for `close(true)`. The production code keeps default
close. The injected TypeError remains a defect, not a new typed native failure.
Ordinary scoped close already preserved a failing body Cause and was not
redesigned. Neither increment changes remote-mutation uncertainty or retries.

## Final combined source qualification

After the earlier stops and bounded receipts above, the coordinator qualified the
final frozen source: static/build **exit0**, with **95 files, 676 import edges,
15 entries and 2 computed loads** (`/tmp/ts-release-final-capability-check-final.log`);
behavior **exit0, 356 pass, 0 fail, 3,808 assertions across 62 files**, 256.64 seconds
(`/tmp/ts-release-final-capability-test.log`).

This run includes the actual final SQLite `onExitIf` correction and the native
HTTP cleanup proof. Final SQLite source SHA256 is
`ec582bf347bbd1da28607be045f4d7ec107bb9409ae53d4fc766311e2d1fd70c`;
final HTTP source, including the separately reviewed admission extraction, is
`8870a5f847c10b7a5b74c1e21d8400aac12911f3ba2d27661832c97d55d4ed46`.
The earlier `onError` static failure and first-green hash remain historical
receipts, not the final implementation.

Packed/installed profiles were still running when this note was appended; these
source receipts make no archive-green claim. See the coordinator's
[final qualification](final-qualification.md) for subsequent delivery receipts
and remaining native/live-provider limits.
