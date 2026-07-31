# Recovery, resumption, and reconciliation

The run ledger (`.release/run.json` or the path given to `--new-run`) is the
single source of truth for what happened. Read it before proposing any
recovery action, and never edit it by hand.

## Ledger facts

Each operation records attempts with purpose (`execute` or `publish`),
receipts, and materialized-output facts (digests, sizes). Completed
operations are never replayed on resume; their recorded facts are
re-verified instead.

## Interruption before publish

If apply stops before the publish frontier (crash, ctrl-c, failed local
operation):

1. Re-run apply with `--resume <run-path>` and the same plan bytes and
   `PlanId`.
2. Completed local operations are skipped; the failed operation retries.
3. If materialized bytes changed under the run (digest mismatch), apply
   fails closed. Re-plan; a new `PlanId` requires a new review.

## Remote outcomes

Remote publications end in one of three recorded results:

| Result | Meaning | Next step |
|---|---|---|
| `NotDispatched` | the request never left | safe to retry via resume |
| `Committed` | the remote observed the mutation | done; receipt recorded |
| `CommitmentUnknown` | sent, outcome unobserved | do NOT retry blindly |

## CommitUnknown handling

A committed-unknown outcome blocks the operation and the frontier. Never
blindly retry the mutation. In order:

1. **Reconcile read-only.** `ts-release apply ... --resume <run-path>
   --reconcile <operationId>` performs the operation's read-only
   reconciliation (for example, GET the same resource) and records the
   observed state.
2. **Operator resolution.** When reconciliation cannot decide (or the
   profile is manual-only), the user states the truth explicitly:

   ```sh
   ts-release apply release-plan.json \
     --plan-id PLAN_ID \
     --resume .release/run.json \
     --resolutions '[{"operationId":"publish:github","outcome":"committed","operator":"<name>","reason":"release visible in UI"}]' \
     --reviewer <reviewer-name>
   ```

   `outcome` is `committed` (the mutation happened; skip it) or `absent`
   (it did not; allow a retry). The resolution is recorded durably with the
   operator's name and reason.
3. Only after the ledger records a decided state does the frontier advance.

## Rules

- Resume never re-derives authority: the original execution receipt binds
  the run, and publication still requires its own confirmed review.
- A changed plan is a new plan: new `PlanId`, new reviews, new run.
- Custom (`OpaquePublish`) operations are always manual-reconciliation:
  their unknown outcomes require operator resolution, never automatic
  retry.
- If the ledger itself fails verification (hash mismatch, truncation),
  stop and report; do not reconstruct or edit ledger state.
