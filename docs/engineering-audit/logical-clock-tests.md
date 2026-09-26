# Existing npm authentication tests: logical clock and fiber ownership

## Scope and inputs

- Worktree: `/mnt/models/dev/ts-release/.verification-ownership`
- Baseline: `e0bedee2433e7d2dccee94131c8f51824ac97902`
- Owned repository file: `test/reimplementation/npm/local-authentication.test.ts`
- Pinned runner: `/tmp/ts-release-bun-qualification/node_modules/.bin/bun`, version `1.3.14` (`0d9b296a`).
- Installed Effect: `4.0.0-rc.115`.
- Read this worktree's AGENTS.md, CONTRIBUTING.md, npm README, installed Effect AGENTS.md, testing example, TestClock implementation/declarations and Fiber.interrupt contract. No dependency changes.
- Root built the unchanged production baseline before the focused source test run. This agent performed no builds, packing or native fixture setup.

## Necessity and ownership decision

The two existing browser-authentication rows waited for Effect-owned Retry-After sleeps of 1,000 ms. The existing final polling scenario waited for an Effect-owned 20 ms timeout. Keep these scenarios and their assertions; replace only their real-time scheduling and root fiber ownership. The injected read/notify effects at these timing boundaries are synchronous or Effect.never, so the pinned forkChild / TestClock.adjust / Fiber.join pattern is sufficient without another polling helper or Deferred barrier.

Each timed workflow retains its application Scope and receives a fresh TestClock.layer. Its root fiber belongs to that Bun test. onTestFinished interrupts and joins that root using a fresh Effect.runPromise call without an aborted signal; forkChild keeps the completion fiber owned by the workflow. The existing session finalizer still wipes credentials/challenges. No common harness, service, production seam, test case or assertion was added.

## Runner-timeout qualification before the repository edit

Bun's pinned typings expose onTestFinished but no callback AbortSignal. The specifically authorized temporary probe therefore tested whether the hook runs after the runner times out and whether it joins an asynchronous Effect finalizer. Its real 20 ms timeout exercises Bun's runner, not Effect scheduling or a production timing assertion.

Command, from the worktree:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test /tmp/ts-release-logical-clock-timeout-probe.test.ts > /tmp/ts-release-logical-clock-timeout-probe.log 2>&1
```

Raw exit: **1**, expected intentional timeout. The first probe used Fiber.join for the test's Promise. It observed, in order, `probe-finish-hook-entered`, `probe-finalizer-complete`, `probe-finish-hook-joined`. However, Bun then reported an additional unhandled interruption error because it had abandoned the timed-out test Promise: **0 pass, 1 fail, 1 error**. This was a runner-adapter finding, not a failing production regression test.

The revised temporary probe awaited the root with Fiber.await, which returns an Exit without rejection. The finish hook sets a local `finishing` flag before interrupting. After waiting, the test returns if the runner already finished; otherwise Effect.runPromise(exit) preserves the active test's success/failure/defect outcome.

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test /tmp/ts-release-logical-clock-timeout-exit-probe.test.ts > /tmp/ts-release-logical-clock-timeout-exit-probe.log 2>&1
```

Raw exit: **1**, expected intentional timeout. Observed the same ordered hook/finalizer/join markers and **0 pass, 1 fail**, with no extra unhandled error. The intentional failure remains visible; cleanup completed before the hook returned. This qualified pattern is used in the repository edit. Active-test failures are re-raised from the joined Exit; the finishing guard applies only after Bun has finished the test. No separate active-failure fault probe was run.

## Repository change

- Keep the same six test instances, including both existing lost-response rows and all malformed-response inputs.
- In each browser-authentication row, fork session.complete, advance virtual time by 1,000 ms, join it and retain the existing true, poll count, exact authorization, no-resend, secret omission and closed-session assertions.
- In the existing timeout block only, fork the existing Effect.exit(session.complete), advance virtual time by 20 ms and join it. Retain the failure, consumed-challenge and cancellation-finalizer assertions.
- Keep untimed rows, native configuration, Host.now, IDs and production code unchanged.

## Checks after the edit

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun node_modules/prettier/bin/prettier.cjs --write test/reimplementation/npm/local-authentication.test.ts
```

Exit **0**, unchanged formatting.

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun node_modules/oxlint/bin/oxlint -c .oxlintrc.json --deny-warnings --report-unused-disable-directives-severity error test/reimplementation/npm/local-authentication.test.ts > /tmp/ts-release-logical-clock-lint.log 2>&1
```

Exit **0**, no diagnostics. Empty raw log retained. The executable's version query returned `1.82.0`.

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/npm/local-authentication.test.ts > /tmp/ts-release-logical-clock-tests.log 2>&1
```

Exit **0**: **6 pass, 0 fail, 159 expect() calls**. Runner reported 720 ms total. This is one focused source-suite run, not a benchmark or a claim about installed, live npm, native host or full-profile compatibility. The root integrator owns full patched-compiler/static verification and combined validation.

## Evidence identities

| File | SHA-256 |
| --- | --- |
| Edited local-authentication.test.ts | `6f750e791501c652c435dd00e94b8e5bc3fb044ed40f71a6232e65b5c8e02e5c` |
| First temporary timeout probe | `90044bd862a42df353876e03791b40ceac26dc49bcf0bdad516fe04818b53438` |
| Revised temporary timeout probe | `ccf630c2ef97fe39bbcfcc066ad2d78831f36d747731b56e9c2d7b361b08a29b` |
| First timeout probe log | `7e06c7134dba73f6173483a321af92f43fc23da21be2d159d898c7610be6580f` |
| Revised timeout probe log | `ff291b14d694d975f89a9a9db1077929badf1ca1a6c6e8074ef6dcbdf711d524` |
| Focused test log | `af8249758b1c637099db92c1a538f66134abadd322ac59009204b014e7f427e7` |
| Lint log | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The temporary probe sources and raw logs remain under `/tmp`; none is a repository test addition or package input. No retrospective test-first claim is made for the retained authentication assertions.

Final integration also passed `bun run check`, including the patched compiler's
root test project and all strict lint/closure gates. Raw log:
`/tmp/ts-release-verification-ownership-check.log`. No production or dependency
change in this increment required repeating preceding installed-package checks.
