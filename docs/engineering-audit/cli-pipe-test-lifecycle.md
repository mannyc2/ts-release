# CLI pipe fixture ownership and causal backpressure

This bounded R28/W7 change repairs only existing test owners:
[cli.test.ts](../../test/reimplementation/kernel/cli.test.ts) and
[cli-pipes.py](../../test/reimplementation/kernel/cli-pipes.py). Production CLI
code, its input/output contract and all **3 cases / 13 Python assertions** per
runtime remain unchanged.

The old first case waited 100ms after the application lifecycle marker and then
assumed the large report was backpressured. The second Python subprocess lacked
a failure finalizer, and Bun's parent test did not register runner-finish child
cleanup. These were owner-review findings, not newly reproduced production CLI
failures.

The first case now owns an ordinary native `os.pipe`. Nobody drains its read end
until the CLI exits. Python retains its copy of the write end long enough to wait
for `select` to report it is not writable, then closes that copy before signaling
the CLI. The fixed sleep is removed. This observes the native condition directly;
it does not assume a Linux-specific pipe capacity or infer backpressure merely
from process liveness. Bounded polling sleeps only check that condition and the
existing marker; they do not constitute stabilization evidence. The existing
nonempty/less-than-1MiB partial-output, interruption exit143 and empty-stderr
assertions remain. The closed-output error and refused-FIFO checks also remain.
No new assertion or retrospective failure-first claim is made for replacing the
barrier.

Bun registers `onTestFinished` before spawning Python, latches finishing, sends
SIGTERM only to an active child and joins stdout, stderr and exit. Its finishing
guard applies only after the runner has ended the test; active failures retain
the existing assertions. Pinned Bun1.3.14 hook qualification is documented in
[logical-clock-tests.md](logical-clock-tests.md#runner-timeout-qualification-before-the-repository-edit);
that runner-timeout experiment was not repeated here.

Python registers its SIGTERM handler before resource acquisition, latches stop,
and forwards the signal to its active CLI. Admission before and after every spawn
prevents a late signal from starting further cases. All three subprocesses now
have a single explicit owner, including the prior `subprocess.run` FIFO case.
The outer finalizer first sends SIGTERM so the actual CLI can cancel, waits up to
two seconds, then kills only that exact child if necessary and joins it. It closes
owned stream/pipe descriptors and removes its exact temporary directory. Killing
Python alone would not establish cleanup of its CLI child.

Qualification used the authoritative nonblocking shared lock:

```sh
flock -n /tmp/the-show-full-verification.lock env TS_RELEASE_HTTP_PEER_NODE=/tmp/node-v22.22.2-linux-x64/bin/node /tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/kernel/cli.test.ts -t 'native pipe cancellation'
```

The native run required the existing sandbox escalation for local subprocess
fixtures. Receipt `/tmp/ts-release-cli-pipe-ownership.log`: **exit0, 2 pass,
6 filtered, 4 Bun assertions**; each Node22.22.2/Bun1.3.14 Python invocation retains
all13 assertions. Targeted Oxlint passed for the TypeScript owner and Python's
`ast.parse` accepted the fixture. No package build, full gate, pack, external
network or publication was run by this author. Combined compiler and broader
runtime qualification remain coordinator-owned. These are existing Unix-native
pipe checks, not proof of Windows pipes or unconditional SIGKILL recoverability.

Final SHA256:

| Artifact       | SHA256                                                             |
| -------------- | ------------------------------------------------------------------ |
| `cli.test.ts`  | `eaaf1e806d45442a1c30906989634b2b4945bc35cfe020ef82f43fb3747bcca4` |
| `cli-pipes.py` | `ae10928cd493634ce7d2aa7ad7796f6b42af59c49f740b6d68b0f7342c006c62` |

## Final combined source qualification

After the earlier stops and bounded receipts above, the coordinator qualified the
final frozen source: static/build **exit0**, with **95 files, 676 import edges,
15 entries and 2 computed loads** (`/tmp/ts-release-final-capability-check-final.log`);
behavior **exit0, 356 pass, 0 fail, 3,808 assertions across 62 files**, 256.64 seconds
(`/tmp/ts-release-final-capability-test.log`).

This run includes the final CLI native pipe cases on both Node and Bun, preserving
the backpressure, closed-output and FIFO assertions. It supersedes the pending
combined-qualification note above without converting this fixture refactor into
a newly claimed production failure-first history.

Packed/installed profiles were still running when this note was appended; these
source receipts make no archive-green claim. See the coordinator's
[final qualification](final-qualification.md) for subsequent delivery receipts
and remaining native/live-provider limits.
