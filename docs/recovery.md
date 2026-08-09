# When a release stops halfway

A run writes a durable ledger, so a release that fails partway does not start
over — it continues. This page is the map from the state a run is in to the
command that gets it out.

Every command here is something a person runs deliberately. Nothing in
ts-release reconciles, resolves, or retries on its own, in CI or in one-shot
mode: those are judgments about the outside world, and the tool refuses to make
them for you.

## The states a run can be in

<!-- claim test:test/core/apply.test.ts -->
Per-operation attempt states are `Pending`, `RunningStructured`,
`RunningTrustedExec`, `DispatchingPublish`, `Passed`, `FailedBeforeCommit`,
`CommitUnknown`, `ManualReview`, `AssumedCommitted`, and `AssumedAbsent`. Four
of them are places a stopped run actually rests:

- **`FailedBeforeCommit`** — the operation failed and provably did not reach the
  outside world. Nothing was published; the operation can be attempted
  again.
- **`CommitUnknown`** — the request went out and no answer came back. Whether it
  landed is unknown, and the tool will not guess. The run stops here.
- **`ManualReview`** — a trusted `Exec` operation was interrupted. Because its
  effects are not knowable from the outside, a person has to look.
- **`Passed`** — done, and it will never be re-dispatched on a resume.

## Getting out

First, resume — most stops need nothing else. The same plan file, the same
run directory:

```sh
ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --resume .release/runs \
  --through verify \
  --reviewer you
```

Retryable work is picked up where it stopped, and completed work is not redone.

**Observe what actually happened out there** — for an operation whose outcome is
unknown, ask the remote:

```sh
ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --resume .release/runs \
  --reconcile publish:npm:package \
  --reviewer you
```

Reconciliation is read-only. It records what the remote says and nothing else.

**Judge it yourself** when the remote cannot answer — a registry with no
queryable state, a channel with no receipt:

```sh
ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --resume .release/runs \
  --resolutions '[{"operationId":"publish:npm:package","outcome":"committed","operator":"you","reason":"verified by hand in the registry UI"}]' \
  --reviewer you
```

The reason is recorded in the ledger with your name on it. That is the point:
someone decided, and the record says who and why.

**Re-attempt** an operation that failed before committing, or one a resolution
declared absent:

```sh
ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --resume .release/runs \
  --retry publish:npm:package \
  --reviewer you
```

Retry refuses anything else. An operation that might have landed is not
eligible — that is what reconcile and resolutions are for.

## One-shot runs stop the same way

<!-- claim test:test/core/ship-cutover.test.ts -->
`ts-release ship` writes the same ledger, so everything above applies to it
unchanged. When it stops, it prints the exact staged command that continues the
run, with absolute paths — and the receipts already written keep saying
`self:one-shot`, while whatever a person approves afterwards carries their name.
