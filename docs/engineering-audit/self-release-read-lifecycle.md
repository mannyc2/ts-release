# Self-release file-read lifetime: implementation evidence

Baseline: `5227a01f5dbcc722ff5c9971f72106cf2e8fcdee`, reviewed in
`.native-settlement` on 2026-09-26. This bounded repair implements the file-read
portion of [native lifetime prerequisites](native-lifetime-prerequisites.md).
It does not implement the separate Sigstore decision or repair every application
I/O operation. Combined qualification belongs in
[implementation status](implementation-status.md).

## Ownership and compatibility

[Model.read](../../apps/self-release/src/Model.ts#L124) previously passed one
async open/stat/read/close workflow to interruptible `io`. Native finally would
eventually close the handle, but the Effect could report interruption while the
callback still owned the read and close. Later native completion was detached
from that reported exit.

The owner now uses `Effect.fn`, an inline workflow, and `acquireUseRelease` for
the actual FileHandle. A private `readIo` applies uninterruptible joining only
to each issued native operation. Acquisition and release remain protected;
interruption is restored between use operations. Open/stat/read/close must settle
before the handle owner exits. A native operation that never settles can still
delay interruption; this is not a timeout or cancellation guarantee for the
underlying syscall.

The change retains:

- Numeric `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`, regular-file admission, the
  caller's byte bound and exact stat/read byte-count comparison.
- A fresh Uint8Array of the returned bytes, with the same path and maximum-size
  parameters and no new public testing seam.
- `release-application-file: Release file could not be read or retained` for
  native operation failures and explicit bad-file/changed-size refusals. Those
  explicit checks now yield the typed refusal directly; a blanket workflow catch
  no longer hides unrelated owned-code defects.
- The shared `io` helper and the other application workflows.

The installed Effect **4.0.0-rc.115** guide, resource example and implementations
of `tryPromise` and `acquireUseRelease` were read. Its platform `OpenFlag` accepts
string flags and does not express this numeric no-follow/nonblocking contract,
so the existing native adapter remains justified. The private joining helper is
local to one owner; no service, Layer, registry or callback bag was added.

## Necessary proof and actual before/after result

Existing application checks protect prepared bytes and retained candidate
admission. They do not control interruption while a native read result remains
owned. One focused
[Bun test](../../test/reimplementation/self-release/read-lifecycle.test.ts)
therefore starts an isolated
[Node fixture](../../test/reimplementation/self-release/read-lifecycle.mjs).
It imports the actual TypeScript Model.read source under **Node 22.22.2**, using
Node's type stripping. Dependencies use the baseline build completed by the
integrator; its log is `/tmp/ts-release-native-settlement-baseline-build.log`.
This is source-owner proof, not compiled or installed application qualification.

The fixture opens and reads a real file. It holds only delivery of that real
readFile result, preserving the actual FileHandle and native operations. After
the completion barrier is reached, it interrupts the owner and drains already
queued rc.115 dispatcher work. No stabilization sleep estimates when interruption
should occur, and the test does not claim that the syscall itself was blocked.

On the unchanged baseline, the fixture failed at
`Interruption completed before native read settlement`: the owner observer
already held an interrupted exit while result delivery remained blocked. Its
finally released the barrier and awaited actual native close before letting the
assertion fail. The outer `onTestFinished` joins the child before removing the
temporary directory; a process watchdog bounds a broken fixture but supplies no
timing evidence.

After the repair, the **byte-identical test files** passed. While the real read
result was held, the owner remained pending and its actual handle could still be
statted. After release, the joined owner exit contained interruption and stat on
that handle rejected with `EBADF`. The fixture also awaited the real close in
teardown; the bracket's close-settlement ordering was reviewed in source.
Both runs used the same command:

```sh
TS_RELEASE_HTTP_PEER_NODE=/tmp/node-v22.22.2-linux-x64/bin/node \
  /tmp/ts-release-bun-qualification/node_modules/.bin/bun test \
  ./test/reimplementation/self-release/read-lifecycle.test.ts
```

| Run        | Recorded result                        | Raw log SHA-256                                                    |
| ---------- | -------------------------------------- | ------------------------------------------------------------------ |
| Before fix | Bun 1.3.14, exit 1; 0 passed, 1 failed | `e770998ff52ee6d373e419e6f6fd1eb3eabaf9809c10f7b4609c4834ac91b4c6` |
| After fix  | Bun 1.3.14, exit 0; 1 passed, 0 failed | `240bdcb002e2f0f55d061248e5ad7df87c49c6ca5d11618de959dbd62f3c4f5f` |

Raw logs: `/tmp/ts-release-self-read-red.log` and
`/tmp/ts-release-self-read-green.log`. Captured source/test hashes:

| File                                                        | Before fix                                                         | After fix / frozen source                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `apps/self-release/src/Model.ts`                            | `e0ed99b273002e72565f91c0efd481c9a280eb19d74c6d9d64139da7d696daec` | `1babf2149ed98b28605f06f585fa84b81b0c01d713bc1470e980992b5eda09a3` |
| `test/reimplementation/self-release/read-lifecycle.test.ts` | `a25b11e4232af44b3827cb8d1a2e2524fad46088a42f32a055ac91b2c6c13af5` | unchanged                                                          |
| `test/reimplementation/self-release/read-lifecycle.mjs`     | `62eff5d03ec1c2b5a5dc4332b48fcf930f37c52c2cba8ed0d294e6402c3b8ec2` | unchanged                                                          |

The hash records are also in `/tmp/ts-release-self-read-before.sha256` and
`/tmp/ts-release-self-read-after.sha256`. Following coordinator interruption, the
captured results were retained without rerunning the passing proof; source and
test hashes were reconfirmed unchanged.

## Review and remaining limits

Source review confirms that the bracket acquires before installing the use
region, releases after all body exits, and preserves the original native flags,
size checks and byte copy. There is one real-read interruption case, not an
acquisition/read/close matrix. It does not inject close failure or establish
simultaneous body/cleanup failure behavior experimentally; the bracket uses
rc.115's existing cause-combining release semantics. It also does not qualify
an entire Node/Bun engine range or a live provider.

The shared `io` remains interruptible. Its remaining callers in
[prepare.ts](../../apps/self-release/src/prepare.ts) are:

- Line 73: exclusive candidate-directory `mkdir`.
- Line 272: exclusive Bundle `writeFile`.
- Line 275: exclusive Plan `writeFile`.

Their settlement ownership has not been repaired or proved by this change.
Do not extend this read result to candidate-write durability, whole-preparation
cancellation or native Sigstore lifetime.

Formatting the three owned source/test files and targeted Oxlint with
`--deny-warnings --report-unused-disable-directives-severity error` passed.
The lint log `/tmp/ts-release-self-read-lint.log` is empty, SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
`git diff --check` also passed. This owner ran no build, pack or full-suite gate;
the integrator owns compiled/installed application and combined qualification.

## Integration follow-up

The first integrator static check found TS2345 in the Bun wrapper: storing
`Bun.spawn` immediately in `ReturnType<typeof Bun.spawn>` widened the known piped
stderr to include a file descriptor. The wrapper now keeps the inferred
`const spawned` for reading stderr and separately assigns the teardown handle.
There is no cast, suppression or changed fixture assertion. Thus the **initial**
red/green used byte-identical tests as recorded above; the final wrapper contains
this later type repair. The native `.mjs` fixture and production source remain
unchanged.

After that repair, the full static check, delivery generation and this one
focused proof passed under `flock -n /tmp/the-show-full-verification.lock`.
The final proof log is `/tmp/ts-release-native-settlement-read-final.log`:
exit 0, 1 test, 1 assertion. Its SHA256 is
`99f13d7fd963f893f324f9fe27e7333d572de01d2eb85de76aa36517acef481e`;
the final wrapper SHA256 is
`c539616e3cf9ea7b0a4203cad6d37db103a543a19df0c69afbd6bdb15be3fc50`.
The failed and successful static logs are respectively
`/tmp/ts-release-native-settlement-check.log` and
`/tmp/ts-release-native-settlement-check-final.log`.

Generated `templates/npm-github/release/Model.js` is byte-identical to compiled
`apps/self-release/dist/Model.js`, SHA256
`bd9d8b7e648df5a6050eba6049ca78f5c5d43e561134b0161ea03730f5b97a49`.
Bun retains the named read definition in generated `input.ts`; independent
source review confirmed its native operations remain deferred and the input
command never calls it. Installed starter execution and the final bounded
qualification are recorded in [implementation status](implementation-status.md).
