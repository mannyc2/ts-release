# The staged plan/apply workflow

Every release moves through fixed stages in a fixed order:

```text
build < process < catalog < validate < publish < announce < verify
```

Local stages (`build`, `process`, `catalog`) write files inside the
workspace. `validate` may also perform read-only remote checks. `publish`
and `announce` are the only stages allowed to mutate the outside world, and
they require a separate publish confirmation.

## 1. Plan

```sh
ts-release plan --config release.config.json --out release-plan.json
```

- Reads the configuration exactly once, lowers it deterministically, and
  writes canonical `release-plan/v6` bytes.
- Prints `{ "planId": "..." }`. Persist both the bytes and the `PlanId`;
  apply requires the exact pair.
- Planning performs no writes to `.release/`, no network calls, and no
  publication. Never describe a plan as a release.

Summarize for the user after planning: stage counts, output paths, which
operations are `Exec` (trusted local execution), which are remote
publications, and which credentials (by name) each remote operation needs.

## 2. Review (doctor / review-only)

```sh
ts-release doctor release-plan.json --plan-id PLAN_ID --scope all
```

- Re-decodes the canonical bytes, verifies the `PlanId`, validates scope and
  topology, and derives the immutable execution challenge.
- Prints `executionReviewId` and the operation ids in scope. This is
  read-only; it mints no authority.
- `ts-release apply ... --review-only` derives the same challenge.

The `executionReviewId` is a challenge bound to the exact plan bytes and
scope. The user (or their review process) confirms it; you never invent one.

## 3. Apply through the local/validation frontier

```sh
ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --through validate \
  --new-run .release/run.json \
  --scope all \
  --confirm-execution EXECUTION_REVIEW_ID \
  --reviewer <reviewer-name>
```

- `--confirm-execution` must be the reviewed challenge for these exact bytes
  and scope; any mismatch fails closed.
- The run ledger at `.release/run.json` records every attempt, receipt, and
  materialized-output fact. Do not edit or delete it.
- Materialized outputs land under `.release/` and are digest-verified before
  any later stage may use them.
- Stop at `--through validate` unless the user has separately confirmed
  publication.

## 4. Publish review

When materialized facts exist and the run reaches the publish boundary,
apply reports a `publishReviewId` challenge and stops. Report it to the
user. The publish review is bound to the run, the plan, and the materialized
bytes. Never fabricate, infer, reuse, or auto-confirm it.

## 5. Resume with publish confirmation

```sh
ts-release apply release-plan.json \
  --plan-id PLAN_ID \
  --through verify \
  --resume .release/run.json \
  --confirm-publish PUBLISH_REVIEW_ID \
  --reviewer <reviewer-name>
```

- `--resume` continues the existing ledger; completed operations are not
  replayed.
- Remote mutations record receipts. An ambiguous remote outcome is recorded
  as committed-unknown and blocks blind retry (see `recovery.md`).

## 6. Verify

The `verify` stage re-checks published facts read-only. The final report to
the user names: `PlanId`, run path, completed frontier, receipt ids,
evidence locations, observed published targets, and remaining follow-ups.

## Durable files

| File | Meaning |
|---|---|
| `release-plan.json` (or chosen `--out`) | canonical immutable plan bytes |
| `PlanId` | domain-separated hash identity of those exact bytes |
| `.release/run.json` | append-only run ledger: attempts, receipts, facts |
| `.release/artifacts/*` | materialized outputs, digest-verified |
| `.release/facts/*` | derived digests and internal facts |

## Approval meanings

| Token | Grants |
|---|---|
| `executionReviewId` | permission to execute the reviewed scope locally through the requested frontier |
| `publishReviewId` | permission to perform the reviewed remote publications for this run only |
| receipts | proof a specific attempt happened; never reusable as new authority |
