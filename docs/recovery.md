# Progress and recovery

Retain the exact Bundle, content bytes, Plan and durable journal for the entire
recovery window. Reports are derived views and do not authorize dispatch.

```sh
ts-release --observe ./release.mjs ./release-input.json > release-report.json
```

Observation refreshes providers that implement observation and appends their
evidence to the journal. It does not dispatch publication. The application
factory still runs, so keep its setup appropriate for inspection. Library hosts
can call `reportRelease({ plan })` for stored progress or `observeRelease({ plan })`
for fresh provider evidence, providing the same `Host` at the runtime boundary.

| Status       | Meaning and next step                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Satisfied    | Exact evidence establishes completion; the engine skips this operation.                             |
| Unattempted  | No dispatch yet. Check the application's authorization and dispatch limit.                          |
| Pending      | Work or an unresolved dispatch remains. Refresh observations; absence alone does not permit resend. |
| Inconclusive | Evidence cannot establish the outcome. Restore observation access and inspect again.                |
| Conflict     | Destination evidence disagrees with the intended operation. Resolve the conflict explicitly.        |
| Rejected     | A dispatch was rejected. Inspect its evidence and the provider's noncommit/replay contract.         |
| Superseded   | This plan was explicitly superseded. Use the selected successor plan.                               |

After resolving the blocker, continue with the original invocation:

```sh
ts-release ./release.mjs ./release-input.json > release-report.json
```

A new runner may choose a fresh local Git journal cache. It must keep the same
remote journal identity, original Bundle and Plan, installed providers and
credential bindings. Do not replace the journal with an empty store. Loss of an
HTTP response or process interruption cannot prove noncommit.

The engine checks request/receipt correspondence and replay laws before sending.
An exact observation can establish completion. Conditional Git updates can replay
only against the protected request. Explicit `acceptRisk` and `supersedePlan`
remain library operations for deliberate operator workflows, not automatic error
recovery or CLI flags. A process failure never implicitly grants either.

A candidate that never dispatched can be explicitly superseded before preparing
a corrected candidate for the same release coordinate. Supply the original Plan
with its original providers in `Host.journal.supersededPlans`, alongside the
successor's single publication scope. The host validates both Plans and the
complete original journal. Every
historical Plan must have a `PlanSuperseded` event and **no `DispatchStarted`
event**, including acknowledged or rejected dispatches. Merely listing a Plan
does not supersede it. Reports retain these Plans separately from preparations.

The npm/GitHub application accepts `supersededCandidates` in its input, each
with `candidateDirectory`, `bundleSha256` and `planId`. It restores the original
Bundle and creates historical providers with no I/O capabilities.
`TS_RELEASE_SUPERSEDED_CANDIDATES`, a JSON array of retained candidate directories,
supplies these bindings to its input generator. Keep the original artifacts and
these bindings on every continuation. This cannot bypass an uncertain dispatched
release or move the successor into an empty journal.

For the Action, use the same application and input with `observe: 'true'` to
inspect; use `observe: 'false'` to continue under the application policy. Its
`plan-id` and `journal-revision` outputs identify progress, not a complete backup.
Interruption can truncate stdout; the shared journal is the recovery record.
