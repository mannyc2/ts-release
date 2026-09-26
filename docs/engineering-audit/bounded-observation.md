# Bounded observation and executor recovery

Source baseline: `17d491dfc0cbcbdb0653c233cc2981091c0dc321`. This records the
bounded R32 application change and the available R33 historical inputs. It does
not claim the remaining W6 work or installed/native qualification complete.
The motivation is [REC-1 and REC-3](../adoption-audit/reactor-effect-client.md),
mapped to [R32/R33](requirements.md) and [W6](refactor-plan.md).

## R32 contract and ownership

The existing `runApplicationEffect` and `runApplication` mode argument accepts
either its existing `"run"` / `"observe"` strings or:

```ts
{
  mode: "observe",
  definitionIds: ["npm.publish", "github.publish"],
  budgetMilliseconds: 300_000,
  initialDelayMilliseconds: 10_000,
  maximumDelayMilliseconds: 10_000,
}
```

`BoundedObservationOptions` is the invocation-policy Schema and its corresponding
type, exported through the Node/Bun entries. `ApplicationMode` is the mode union.
The legacy strings/default retain their existing execution behavior and report
fields; only the object mode adds optional `FinalizedReport.visibility`.

The policy is copied, schema-admitted and frozen before application acquisition.
Durations are positive safe integer milliseconds; definitions are nonempty and
unique, the initial delay cannot exceed the maximum, and every selected
definition must occur in the admitted Plan. Invalid semantic selection/policy
fails with `application-observation`; malformed schema data retains the normal
`invalid-data` admission error. The policy is not durable release input.

| Existing owner                    | Decision and preserved contract                                                                                                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform/Application.ts`         | Keep one scoped application factory invocation and one captured application-options/host selection. Add a private observation loop to this existing interpreter; no new runner/service or publication authority.                                   |
| `Release.observeRelease`          | Keep its existing sweep. It refreshes every available provider observer, including operations outside the completion selection. It still admits complete history before provider effects and records real observations through normal journal CAS. |
| `internal/FinalizedReport.ts`     | Add optional derived visibility metadata. Keep existing Bundle/Plan/history admission rather than introducing a second trusted report constructor.                                                                                                 |
| Effect rc.115 Clock/Scope         | Use the installed monotonic clock, sleep and joined interruption. No native timer or detached polling task.                                                                                                                                        |
| Node/Bun entries                  | Export the existing runner's policy Schema/type and the mode union. No new execution facade.                                                                                                                                                       |
| `templates/npm-github/verify.mjs` | Integration owner replaces its repeated factory/native-sleep loop with one bounded call. Its named policy-Schema import must fail before invocation on an older executor.                                                                          |

The initial complete candidate admission precedes the observation budget. After
that, provider reads, journal work, report revalidation and backoff consume one
deadline computed from `Clock.monotonicTimeNanos`. Delay doubles to its configured
cap, and each sleep is clipped to the remaining budget. An in-flight sweep is
interrupted on deadline; work and cleanup are joined. A final history read after
timeout reconciles any append that settled during cancellation. A failed read
remains a failure, not invented pending evidence.

Admission, joined settlement, final reconciliation and application disposal may
extend total wall time. A native operation that cannot cancel and never settles
can delay completion. `elapsedMilliseconds` measures from the admitted-session
start through reconciliation; it may therefore exceed `budgetMilliseconds`.
The deadline is not a hard process-kill promise and is never serialized as an
absolute monotonic instant.

The factory, candidate-file intake, factory-owned provenance setup and scoped
resources are reused. This does **not** claim `loadPlan` runs once: existing
`observeRelease`, history and `reportFinalizedRelease` checks still revalidate
immutable metadata and fresh durable history. They do not reacquire the
application or reload candidate files. No additional admission cache or internal
trusted bypass was introduced.

For each selected operation, the latest event in validated journal order for
the same Plan with `evidenceKind: "Observation"` controls visibility:

- `Satisfied` and `Conflict` retain those visibility states.
- Missing evidence, `Absent`, `Pending` and `Inconclusive` produce `Pending`.
- Any selected conflict makes the aggregate `Conflict`; all selected satisfied
  makes it `Satisfied`; otherwise it is `Pending`.

Each row carries the operation ID and, when present, the latest observation's
event ID, original status and `observedAt`. This is the latest retained evidence,
not a new freshness-expiration policy. Providers without `observe` retain the
existing sweep's skip behavior: they add no event; a selected operation without
an admitted observation remains pending. A previously admitted observation is
still its latest evidence, with its original event/time visible in the report.
Receipt acknowledgement and the machine's overall `Satisfied` status are never
used as visibility evidence. The bounded branch cannot invoke `runRelease`,
transport dispatch or the authentication continuation. Application/provider
callbacks remain their owners' capabilities; this is not a sandbox for arbitrary
caller code. Only ordinary observation journal facts are appended.

### Failure and interruption review

Installed Effect is `4.0.0-rc.115`; its guide hash remains
`e155acab559b29e0a54acd0f5d8d4b7a428268ba6eb1aba4d62b4876d6b1a78e`.
In that version, `timeoutOption` uses `raceFirst`; `raceAllFirst` joins interrupted
losers through `fiberInterruptAll`, which discards their final Exit. An ordinary
failure/defect winning before the timeout is preserved, and external interruption
remains interruption rather than an `Option.none` result.

The observation boundary records each sweep's actual Exit using `onExit`.
After joined timeout it repropagates the original cause if it contains a typed
failure or defect, preserving composite causes. Only the timeout loser's pure
interruption can become a pending/derived visibility result. This is a local
correction for the pinned combinator behavior, not a generic timeout helper.
Application-scope cleanup remains outside the timeout and stays observable.

The new verifier must named-import `BoundedObservationOptions`: an older core
does not export it and will refuse before loading the application. This matters
because the old runner's `else runRelease` branch would interpret an unrecognized
object mode as a run. Inspecting `visibility` after that call would be too late.
The template additionally chooses `authorize: false`; the runtime import is the
early compatibility guard. Existing old string-mode callers remain supported.

## Necessary proof and actual chronology

One case was added to the existing kernel-owned `application.test.ts`. Existing
native-peer/distribution checks already protect actual transport bytes,
acknowledgement loss, fresh caches and no replay; none proves this new elapsed
budget or its timeout-loser cleanup behavior. The new case uses Effect's exact
TestClock and an explicit provider observation port. It does not certify a
registry, credentials, Sigstore or native network cancellation.

The case first acknowledges one publication. It retains a real absent observation,
then holds a subsequent observation until the 100 ms logical deadline. It checks
pending visibility despite overall acknowledgement, joined cancellation, one
acquire/release, and a fresh scoped observation reaching satisfied with the same
Bundle/Plan/history, one total dispatch, and no authentication continuation.
The same case subsequently makes timed-out observation cleanup die and requires
that exact defect in the returned cause. Bun teardown interrupts and joins the
root test fiber independently of any aborted runner signal.

1. On unchanged baseline production, the new object-mode invocation returned no
   `visibility.status: "Pending"`. The feature red was **exit 1**, 0 pass / 1 fail
   / 14 filtered, in `/tmp/ts-release-bounded-observation-red.log`. No production
   or API scaffold preceded it; temporary `@ts-expect-error` directives admitted
   the prospective mode at the test call sites. Application SHA256 was
   `0f40ca046f0a955b6a91aebfae8a7c0dbe152ef7e22709573fb4bae2e9f7e825`, report SHA256
   `3649f9773d971ac06753affcd822182676010929946fa19c216906453ca90dca`, test SHA256
   `11a26d14d8b762d8cd1a7660863a8fd3da41dee312611024b2f418e6f93266fe`.
2. Initial implementation exposed an overstrong fixture-timing assumption:
   advancing the clock over the first observation's asynchronous history hashing
   could cancel before its absent event was retained. The failed run remains
   `/tmp/ts-release-bounded-observation-green.log`. The fixture was corrected to
   await the existing public single-observe call before holding timed work; this
   does not change the original missing-visibility failure expectation. Temporary
   type directives were removed, and readonly provider construction was corrected.
   These are not byte-identical red/green test files.
3. The first complete application-file green was **exit 0**, 15 pass / 76
   assertions, `/tmp/ts-release-bounded-observation-application.log`.
4. The necessary cleanup-defect assertion then failed **before its handling was
   added**: expected Failure, received successful report; exit 1, 18 assertions
   reached, `/tmp/ts-release-bounded-observation-cleanup-red.log`. Initial
   implementation Application SHA256 was
   `33914635aabdcfce2428b3d65c37faea894050bc9ea50193801fd64ade4b442d`; test SHA256
   `4c02e6984d933386b0ad7d935093f1e680a51938ae0b3ff9c766956f77dc4509`.
5. After the local Exit handling, the application file passed **exit 0**, 15 tests
   / 80 assertions, `/tmp/ts-release-bounded-observation-final-application.log`.
   Focused strict lint also exited 0,
   `/tmp/ts-release-bounded-observation-final-lint.log`. The subsequent policy
   Schema rename/export adds the old-executor import guard; final combined static,
   generated-template and installed qualification belong to root integration.
6. Root's subsequent combined static check stopped before behavior at the test's
   four typed fixture factories: the narrower fixture input did not implement
   the public factory's `unknown` input contract. Calls now close over the
   already-owned input (`() => createApplication(input)`). The same check required
   `return yield*` for the intentionally never-completing observation branch.
   These are test-only typing/tooling corrections after the source green; no
   assertion, production API or behavior was weakened. The failed integrated
   check is retained at `/tmp/ts-release-coordinated-continuation-check-final.log`;
   root owns the subsequent complete qualification.

The behavior command used Bun 1.3.14:

```sh
TS_RELEASE_ACCEPTANCE_NODE=/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node \
  /tmp/ts-release-bun-qualification/node_modules/.bin/bun test \
  test/reimplementation/kernel/application.test.ts
```

Red runs added `--test-name-pattern 'bounded observation charges provider work'`.
Formatting used pinned Bun/Prettier on only the five owned source/test files.
Lint used `bun oxlint -c .oxlintrc.json --deny-warnings
--report-unused-disable-directives-severity error` with those same explicit files.
No build, packing, full profile or live operation was run by this owner.

## R33 retained evidence and bounded next qualification

The installer originally selected all engine/provider archives from the candidate
(`scripts/install-release-runtime.ts:22` at baseline). Merely checking out a
repaired workflow therefore still installed the old candidate engine. Root owns
the separate installer/workflow correction and its proof; this record does not
implement a generic compatibility registry or historical decoder migration.

The complete signed 0.4.1 candidate remains locally at:

`/tmp/ts-release-adoption-20260921/.release/hosted-35651390251-signed`

Read-only file inspection found all 16 owned artifacts: seven archives, seven
provenance bundles, source and notes. Every file's SHA256 and byte length matches
its Bundle content reference. Exact identities are:

| Input            | Identity                                                           |
| ---------------- | ------------------------------------------------------------------ |
| Bundle SHA256    | `2185a825efd159af8ff2dc0d957a21b3d4146147cb97c680d2f622b4f62ec951` |
| Plan file SHA256 | `9216b5ac391ea4c3a53635617e96021040899d6646daa9f721952674bfd91f57` |
| Plan ID          | `eb465a35ac4f3fd8a1b62f092cfe9464963c8f660bbf7a114b2573ea08a74e6d` |
| Journal ID       | `npm-github:mannyc2/ts-release:v0.4.1`                             |
| Source commit    | `543f04154b1f4acc3d2e3444b35d3c0fc6cd54a0`                         |

The retained local journal ref is
`refs/remotes/origin/ts-release-journal/b3d3aeb49ea4acc306492033e9e649b49def15092b1296880c5eba7f4ccab791`,
tip `c293747340c6f278d171e8f40e5bb3f8b6e3eba7`. Its 320 commits include the
original Plan's one observation and one supersession, **zero dispatches**.
Successor Plan `a9c7fcab82398b97c2c8e8fb53420a3bf9683811539f74c3f5f6b0202895739c`
has 26 dispatches, 10 accepted receipts and 282 observations. Its complete
candidate was not found in the inspected locations. Reactor local trees had
package archives/identity fixtures but no complete historical Bundle/Plan found.
This was a bounded search, not a claim of global artifact absence.

These original bytes can support unchanged historical admission, authentic
provenance verification and supersession refusal under a repaired executor.
They cannot establish recovery of an interrupted historical dispatch or provide
that original Plan's nonexistent dispatched-request fingerprints. Such a claim
requires the complete dispatched successor candidate and its original journal.
Keep executor identity/hashes separate from candidate source and content; never
rebuild/re-sign the retained candidate to make a compatibility check pass.

## Final coordinated qualification

The corrected source proof passed as part of the 354 passing full-suite cases;
the sole failed case was an unrelated overstrong OpenAI assertion, corrected
separately without a runtime change. Static checks and installed Bun/npm public
entry declarations passed, including the runtime policy export and bounded-mode
factory E/R inference. Packed providers, Action, and ordinary/interrupted installed
CLI/Action workflows also passed. The exact inputs, initial stopped stages,
archive hashes and limits are in [coordinated qualification](continuation-qualification.md).
The policy/report documentation was updated afterward; those Markdown edits do
not change the qualified runtime bytes. The installed historical executor probe
owns old-core verifier refusal and actual retained-candidate compatibility separately.
