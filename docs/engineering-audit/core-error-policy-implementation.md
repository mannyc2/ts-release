# Core error classification: implementation evidence

This record accompanies the shared core `attempt` migration planned in
[the prerequisite inventory](core-error-policy-prerequisites.md). It records
before-fix failures and a passing run of the unchanged selected proofs after the
shared migration. Native integration and broader qualification are recorded
separately below; the selected run alone does not establish their result.

## Selected proof and necessity

The existing strict `validatePlan` regression does not exercise the shared
helper: that callback already has its own reviewed error policy. The new proof
therefore enters through actual release operations and the existing host/provider
seams, with no direct helper test, replacement kernel or new fixture.

1. **Host machine defect before publication**, in
   [dependencies.test.ts](../../test/reimplementation/kernel/dependencies.test.ts).
   The existing dependency fixture supplies a host whose `machine` callback
   throws one specific `TypeError`. The exact defect assertion distinguishes
   propagation from normalization into an ordinary refusal. The existing action
   counters must show no credential acquisition, publication sends or
   observations, and the journal must remain empty. Those assertions protect the
   admission boundary; they do not demand zero journal reads, since reconstruction
   legitimately reads history before constructing the machine.
2. **Receipt-classifier defect after dispatch**, in
   [errors.test.ts](../../test/reimplementation/kernel/errors.test.ts).
   The existing single-operation fixture sends successfully, then its
   `classifyReceipt` callback throws one specific `TypeError`. Checking the exact
   defect prevents a programming bug from becoming ordinary undecodable evidence
   or apparent success. Requiring only `DispatchStarted` in history protects the
   unresolved dispatch. A fresh invocation with the ordinary provider must report
   `Inconclusive`, and the independent send record must still contain one send.
   These assertions distinguish diagnosis from permission to resend after a
   possible remote commit. This case runs once, outside the evaluator matrix.
3. **Malformed receipt compatibility control**, also in `errors.test.ts`.
   Existing bad-correspondence and oversized-receipt cases do not reach the
   `core-undecodable-receipt/1` fallback: they reject at different owners. This
   uncovered branch matters because it shares the classification point being
   changed. One accepted response therefore supplies `null` to the existing
   receipt codec. The test checks the recorded fallback version/code, an
   inconclusive restart and no second send. It adds no evaluator matrix. This is
   a passing before-fix compatibility control, not a reproduced existing bug.

The defect assertions use rc.115 `Cause.findDefect`, whose successful Result
contains the original defect value (`effect/src/Cause.ts:1015–1040`). Unlike
`findDie`, this API does not return the enclosing `Die` reason. Ordinary schema
refusal remains distinct from both callbacks' programming exceptions.

## Before-fix execution

Checkout: `.core-error-policy`, baseline
`f82f4a19656fdd2f0c7629f0715895365182b3e9`. The complete installed Effect guide was
read and the installed runtime was verified as `4.0.0-rc.115`. Root completed the
baseline package build before execution; its log is
`/tmp/ts-release-core-error-policy-baseline-build.log`. The proof itself did not
build or modify shared outputs.

The following source hashes were captured immediately before the selected run,
while the shared helper and release workflow were still unchanged:

| Source                                              | SHA-256                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/ts-release/src/internal/Error.ts`         | `a7a559372196947edac47a880c26cdeaf37789ab3654e1c07078b167b7f99271` |
| `packages/ts-release/src/internal/Host.ts`          | `440c981122007350eda7f457df9a8e6f17521bee3f57b2be34df1bb3e4ae7db2` |
| `packages/ts-release/src/Release.ts`                | `6ad32ce8d515a71d2f136247c74f717543ab99d188fa104bf7a5d388af13a30a` |
| `packages/ts-release/src/Provider.ts`               | `58b7961a60244d5ecd71cb8413dd4c204f6e29d1d2f3eb514727852be9936c44` |
| `test/reimplementation/kernel/dependencies.test.ts` | `f7bb35c6ce7f80ad8d14048a2ba9421d3188f5c2583d3b522b4ea2d4ccbd8f4d` |
| `test/reimplementation/kernel/errors.test.ts`       | `4e51759bf0701c79e975eaac99ff9c940cd60203094028394413330af10887f8` |

Command:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test \
  ./test/reimplementation/kernel/dependencies.test.ts \
  ./test/reimplementation/kernel/errors.test.ts \
  --test-name-pattern 'host machine defects|receipt classifier defects|malformed accepted receipts'
```

The executable reported **Bun 1.3.14**. Raw output, baseline revision and the
hashes above are retained in `/tmp/ts-release-core-error-policy-red.log`.
Observed result: **exit 1; 1 passed, 2 failed, 18 filtered out, 6 reached
assertions**.

- The host-machine test reached the exact-defect assertion after its zero-action
  and empty-journal checks passed. `Cause.findDefect` had no success value: the
  broad helper had converted the exception into typed failure.
- The receipt-classifier test received a successful Exit and failed its required
  failure guard. The broad helper and post-dispatch typed-error fallback had
  swallowed the programming exception. Later unresolved-history/restart
  assertions were not reached in this failing baseline case.
- The malformed accepted receipt control passed, establishing the existing
  durable fallback and no-resend behavior before implementation.

The two test files were formatted before this run. Their strict owned-file lint
check subsequently passed with exit 0:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun node_modules/oxlint/bin/oxlint \
  -c .oxlintrc.json --deny-warnings \
  --report-unused-disable-directives-severity error \
  test/reimplementation/kernel/dependencies.test.ts \
  test/reimplementation/kernel/errors.test.ts
```

Only after retaining the failing result were the production helper/workflow files
released to the integrator for edits. The compatibility control must remain
passing through the migration; its chronology must not be described as failing
before the fix.

## Same selected proof after the shared change

After the integrator changed the shared helper and related pure owners, the exact
command above was rerun with Bun 1.3.14. No test edit occurred between these runs:
both test-file SHA-256 values matched the before-fix table. Raw output and source
hashes are in `/tmp/ts-release-core-error-policy-green.log`.

Observed result: **exit 0; 3 passed, 0 failed, 18 filtered out, 10 assertions**.
Both original `TypeError` values now survive as defects. The post-dispatch case
reaches its remaining assertions: history contains only `DispatchStarted`, a
fresh invocation with the ordinary provider reports `Inconclusive`, and there is
still only one recorded send. The malformed receipt compatibility control still
records `core-undecodable-receipt/1` and prevents another send.

The checkout still identified baseline `f82f4a19656fdd2f0c7629f0715895365182b3e9`
with implementation changes in the working tree. Relevant source hashes during
the passing run:

| Source                                         | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `packages/ts-release/src/internal/Error.ts`    | `ae4a82d9335afdba265bc26642f73a522254962f76828ed172c0ea37c1dc60d8` |
| `packages/ts-release/src/Plan.ts`              | `afcf35ef69775f6a834d6c7ff1307c7d0de7cc03e1bbf473fd174a9224b09898` |
| `packages/ts-release/src/Provider.ts`          | `7de4166fd36c9adfae15d98c201549b0cddfada0a6acb9bcad43eca1d68532de` |
| `packages/ts-release/src/internal/Identity.ts` | `9169090510ca5973d187d3e4d8a3052edb30d915344563ac3031ea0926feaecf` |

`Host.ts` and `Release.ts` retained their before-fix hashes. No shared build, full
suite or native fixture was run for this selected after-fix proof.

## Independent review of the shared change

The reviewed Error/Plan/Provider/Identity diff has the intended split:

- `attempt` now preserves local release errors, reconstructs independently
  declared errors from the stable release contract, maps ordinary `SchemaError`
  to the established safe data refusal, and keeps other exceptions as defects.
- `Plan.loadPlan` delegates its previously separate strict validator handling to
  that helper. The captured receiver, complete rebuilt operations and synchronous
  `undefined` return requirement remain intact; this is deduplication of the
  already-reviewed validator policy.
- `Provider.makeRequest` and `verifyRequest` use the native byte-copy owner. Its
  narrow projection preserves detached-buffer refusal without enclosing the
  surrounding provider/canonical callback work. `parseCanonical` similarly owns
  foreign JSON parsing while canonical comparison retains its separate guard.
- The unchanged receipt workflow catches typed failures, not defects. A schema
  refusal still reaches the durable undecodable-receipt fallback; a classifier
  defect escapes after the durable dispatch start. No accepted receipt or
  terminal noncommit proof is fabricated. The unchanged history decision cannot
  grant an ordinary unprotected resend from that unresolved start.

No issue was found in that bounded diff review. The no-resend regression uses the
ordinary `NoReplay` fixture without fresh risk approval; it does not revoke the
kernel's separate structural Git replay or explicit risk-acceptance mechanisms.
The review does not qualify in-progress native translations or separately owned
credential privacy boundaries.

## Scope of the selected proof

These are source-level kernel proofs through the existing in-memory journal and
external transport fixture. They do not certify installed tarballs, Node runtime
compatibility, real credentials or live providers. They also do not qualify the
native FS/SQLite/parser translations identified in the prerequisite inventory.

Provider-specific `makeDataBoundary` helpers, the exported native JSON parser and
the Promise loader's deliberate compatibility projection remain separately
owned. The integrator's broader checks and any later source/test changes must be
recorded separately from this selected green run.

## Native admission and credential integration

The shared helper now owns expected schema/domain admission only. Native owners
translate their own operational failures before returning to that helper:

| Owner | Classification and preserved contract |
| --- | --- |
| `Identity.parseCanonical`, `StoreCodec`, `GitProcess.nativeText` | Foreign JSON and fatal UTF-8 rejection become fixed `invalid-data`; canonical comparison and domain checks remain outside these narrow catches. Invalid post-push text still reaches GitJournal's typed ambiguous-outcome fallback. |
| `Identity.copyBytes` | The native byte copy preserves safe detached-buffer refusal without catching surrounding provider getters or callbacks. Only the reviewed request and private-exchange callers use it. |
| `GitProcess`, `GitJournal` | Actual realpath/stat/access/directory creation has fixed native failure projection. Primitive path fields are admitted before path operations; other dependency/callback bugs remain defects. |
| `SqliteJournal` | Bun's actual `SQLiteError` is projected safely for opening, transactions and queries. Callback exceptions pass through. Constructor failure cleanup uses the same native classifier; normal scope cleanup keeps its existing defect behavior. |
| `HttpTransport.headers` | Primitive values are checked before coercion; only Node's header validators receive a native catch. Existing safe binding/TLS/collision checks stay separate. |
| `GithubOidc` | Local fatal UTF-8, JWK import, RSA verification and runner URL admission preserve safe refusal. The shared exported JSON parser and provider-specific diagnostics are unchanged. |

Pinned Bun 1.3.14 probes distinguished an actual SQLite query error from the exact
`TypeError` thrown inside a transaction callback. A closed database instead threw
`RangeError`, intentionally a lifecycle defect. Directory/missing-parent/denied
opens yielded `SQLiteError` with errno 14; corrupt bytes opened but a query yielded
errno 26. The source classification uses the native class, not an optional code
property. These are real native probes, not a replacement database. Raw evidence
is `/tmp/ts-release-core-native-type-probe.log` (SHA-256
`ad3cc80869e590c4b04b168d53e48a0dc06cefcf190d64dafbf53019bde88c3d`)
and `/tmp/ts-release-core-native-open-probe.log` (SHA-256
`342930609f8d526588eec233f1fa8dd5845491032a9904bc037d86b92aa06e02`).

The returned-credential regression exposed an existing privacy bug before this
change: an enumerable authorization getter threw `ReleaseError` containing a
sentinel, which appeared in the returned Cause. The new test failed against the
unchanged baseline (0 passed, 1 failed, 3 assertions; raw log
`/tmp/ts-release-core-credential-privacy-red.log`). Enumeration now has a bounded
privacy projection that discards all thrown messages, including typed failures.
Credential acquisition still preserves interruption without retaining a secret
remainder of a mixed Cause. Private exchange property/byte capture has the same
projection; safe public policy checks follow it. Neither boundary stores native
or credential causes as diagnostics.

Two diagnostic details are deliberate. A non-string header value is rejected
before Node can coerce it; in particular `undefined` now yields `http-headers`
instead of the prior native-validator `invalid-data`. Private exchange getters
are captured before endpoint/TLS checks, so a throwing getter on a multiply-invalid
input may yield the privacy refusal first. Valid inputs and dispatch authority
are unchanged. Existing 12-row wire admission and four live-header cases now
distinguish typed failure from defect; no duplicate malformed-input matrix was
added.

An independent combined source review found no blocking correctness issue. It
specifically checked SQLite callback defects, secret getter projection, provider
parser compatibility and unresolved dispatch history. This review is not injected
native-fault coverage: JWK import, RSA verification and every fatal decoder catch
were not independently forced to fail. Existing SQLite envelope assertions use
rc.115 `Effect.isFailure`, which propagates pure defects; unlike checking only
an Exit tag, those assertions distinguish the relevant channels.

## Remaining limits

No resource-lifetime redesign is included in this slice. SQLite initialization
cleanup can still replace the original initialization failure if close fails;
HTTP still discards a client-destroy rejection. Other open lifetime owners are
self-release file reads and native Sigstore settlement. Provider
`makeDataBoundary.attempt`/`admit`/`matches` remain broad and need a separate review
of their parser, byte and privacy contracts. This is a core error-policy increment,
not completion of W3–W7 or all 36 requirements. Runtime packages remain rc.115;
no durable identity, wire version, publication approval or package version changes.

## Final combined qualification

Final runtime source was frozen during the serial checks on Linux x64, Bun
1.3.14 and Node 22.22.2. Exact final changed source/test inputs are retained in
`/tmp/ts-release-core-error-policy-final-inputs.json` (15 files, SHA-256
`e0f936ae3114e9a5c78be965f00cecc8473a9265d31ddd569ec64b6232cad753`).
The original 14-file qualification manifest still matches byte for byte; the
additional file is the existing installed Bun consumer described below.

| Check | Result and evidence |
| --- | --- |
| `bun run check` | Passed: patched compiler, formatting, strict lint, root/host closure types, all production builds, import graph (95 files, 664 edges, 15 entries, two computed loads), public entry loading. Log: `/tmp/ts-release-core-error-policy-check-qualified.log`. |
| Provenance runtime and full behavior suite | Passed: **358 tests, 0 failures, 3,769 assertions, 58 files**. Includes the new privacy and callback cases, native process/TLS/Git/SQLite, provider and self-release workflows. Log: `/tmp/ts-release-core-error-policy-runtime.log`. |
| Packed core through Bun/npm installs | Passed after the installed expectation correction below. Archive SHA-256 `04a2cc6093692c3281a4962f03dd39d771c527c1e4bb964077f88a8c6c588bf1`; work directory `/tmp/ts-release-packed-kernel-V0l7v0`; log `/tmp/ts-release-core-error-policy-packed-kernel.log`. |
| Packed catalog, packed Action, installed workflow | All passed sequentially. Seven-package installed consumers and native transport consumers; Action Node22 runs under both installers with absent optional peers, equivalent fresh-runner reports and one send; CLI/Action ordinary and interrupted continuation all passed. Log: `/tmp/ts-release-core-error-policy-runtime-remaining.log`. |
| Changed installed consumer lint | Passed with strict configuration, no diagnostics; `/tmp/ts-release-core-error-policy-consumer-lint.log`. |

The aggregate runtime command **did not pass uninterrupted**. It completed the
provenance and 358-test stages, then its packed Bun consumer failed because the
existing scope-closure assertion used `Effect.isFailure`. That assertion demands
a typed refusal, whereas the explicitly reviewed closed-database `RangeError`
is now a programming defect. The installed test correctly exposed the changed
contract. Its one existing assertion now requires a failure Exit containing a
`RangeError` defect; the journal reopen and exact event assertions remain intact.
This is an expectation update for the intentional policy change, not a new
test case or a newly claimed lifecycle repair. Runtime source did not change.
The packed core stage was repeated successfully, then qualification continued
through the remaining stages. The unchanged full source suite was not repeated.

Earlier static failures are retained honestly: the initial native constructor
`return fail(...)` prevented definite-assignment analysis, then three string
admissions used the unknown-input decoder despite already declared string types.
Removing the unnecessary return and choosing `Schema.decodeSync` fixed those
diagnostics without suppressions or weakened gates. Their failed logs are
`/tmp/ts-release-core-error-policy-check.log` and
`/tmp/ts-release-core-error-policy-check-final.log`.

These results qualify the selected local profiles and exact inputs. They do not
certify other Node versions, macOS/Windows, live OIDC or registry publication,
Apple notarization, or the privileged retained-distribution profile. No package
was published. The original architecture-program staged index still matches its
pre-task snapshot byte for byte.
