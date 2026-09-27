# D5: retained native process fixture cancellation ownership

This repair changes only existing test owners:
[git-runtime.test.ts](../../test/reimplementation/transports/git-runtime.test.ts) and
[git-process-consumer.mjs](../../test/reimplementation/transports/git-process-consumer.mjs) in
`.standards-continuation`. No production export/runtime or shared output changed.

The existing Bun1.3.14 runner-timeout qualification in
[logical-clock-tests.md](logical-clock-tests.md#runner-timeout-qualification-before-the-repository-edit) proves that onTestFinished runs after
runner timeout and joins asynchronous teardown. Its observed abandoned-Promise
nuance is retained: a finishing guard skips active-body assertions only after the
runner has already finished the test. Active subprocess failures still assert.
No repeated hook probe or new permanent test matrix was added.

Before fixture editing, the temporary Node driver
`/tmp/ts-release-git-consumer-teardown-probe.mjs` spawned the actual existing
consumer under a unique TMPDIR. It read the consumer's actual pids.json, verified
the parent cmdline contained that exact fixture executable and the child's native
PPID matched, then sent SIGTERM to the consumer. The unchanged consumer exited by
SIGTERM, both detached native processes remained live, and its root remained.
The probe failed as expected (exit1):
`/tmp/ts-release-git-consumer-teardown-red.log`.
The driver's finally killed only the recorded validated native group, joined
consumer exit/stdio closure and removed its exact temporary root. No process-name
search/global kill or detached baseline fixture was left running.

The existing runner now registers onTestFinished before spawning work, latches
finishing, signals its active consumer with SIGTERM and joins the active stdout,
stderr and exit Promise.all. The consumer registers its SIGTERM handler before
fixture acquisition, latches stopping, aborts the active native operation and
joins it in finally before deleting the temporary root. No next iteration starts
after stop. Its scoped native runtime remains the owner that kills/joins the
purposefully detached Git group; killing the outer consumer alone is insufficient.

The unchanged temporary probe passed against the repaired consumer under both
Node22.22.2 and Bun1.3.14: both native PIDs stopped, root removed, output/exit joined.
These are `/tmp/ts-release-git-consumer-teardown-green-{node,bun}.log`. Bun exposes
process.version v24.3.0 to Node-compatible JS; the actual executable was the pinned
Bun1.3.14 path, not native Node24.

The existing selected test also passed with the real Node path:

    TS_RELEASE_HTTP_PEER_NODE=/tmp/node-v22.22.2-linux-x64/bin/node /tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/transports/git-runtime.test.ts -t 'native Git subprocess'

Receipt `/tmp/ts-release-git-consumer-teardown-existing.log`: 1 pass, 1 filtered,
4 wrapper assertions; each existing consumer still requires all18 internal OS,
environment, deadline, interruption and directory-cleanup assertions. No OS
assertion was deleted or weakened. Targeted lint for both files passed.

The real native probe required sandbox escalation because native subprocess
permissions are restricted. No live network, build, full suite, packaging or
publication occurred. This is Linux Node/Bun native fixture evidence, not a claim
for Windows/macOS process trees or general SIGKILL recoverability.

Exact baseline/final file and unchanged probe hashes are in
`/tmp/ts-release-git-consumer-teardown-{red,green}-hashes.txt`.

After the focused green run, a one-line guard limits SIGTERM to an active consumer
(`child?.exitCode === null`). This avoids relying on Bun's completed-child kill
being a no-op during normal finishing. The same active-child teardown is retained;
no assertion or native operation changed and no additional behavior matrix was
run for the guard. Targeted lint was rerun on the final source. The root owns
combined final static/runtime qualification.

SHA256 evidence:

| Artifact                                               | SHA256                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Final runner with active-child guard                   | `a05e34aa297c69cfd59de9a6df13f8d41ea95b44da418cdca6cf04933c3ec7ad` |
| Final consumer, identical across both greens           | `f1ce74f2b67bdb57d1150ca32d014ca0148f19ec911f517b10ecf32706465ecf` |
| Unchanged temporary red/green driver                   | `5c553d5e6a1f16a5a48ed04fbb6e9e7cb46ee27e53939959b97dff73e689169c` |
| Runner during focused green, before active-child guard | `906d0126951dca1c6e73c275e312c4f8755ccc0aa052d5a61b8f8c73e1472ebe` |

## Final combined source qualification

After the earlier stops and bounded receipts above, the coordinator qualified the
final frozen source: static/build **exit0**, with **95 files, 676 import edges,
15 entries and 2 computed loads** (`/tmp/ts-release-final-capability-check-final.log`);
behavior **exit0, 356 pass, 0 fail, 3,808 assertions across 62 files**, 256.64 seconds
(`/tmp/ts-release-final-capability-test.log`).

This run includes the final active-child guard and the retained Node/Bun native
process-group cases. It supersedes the pending combined-qualification note above;
the manual before/after teardown evidence remains scoped to its stated probe.

Packed/installed profiles were still running when this note was appended; these
source receipts make no archive-green claim. See the coordinator's
[final qualification](final-qualification.md) for subsequent delivery receipts
and remaining native/live-provider limits.
