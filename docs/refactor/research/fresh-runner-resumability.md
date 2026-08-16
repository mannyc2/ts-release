# Mutation uncertainty and fresh-runner resumability

Status: continuation of [resumability.md](./resumability.md). It is part of the same research document and has the same guardrails.

## 10. Mutation uncertainty boundary

The boundary should occur after all local work that can safely happen without a remote side effect:

1. canonical Intent and artifacts loaded;
2. provider definition and capability resolved;
3. request encoded and locally validated;
4. credentials acquired and non-secret principal/scope recorded;
5. idempotency key or conditional baseline chosen;
6. `DispatchStarted` durably appended;
7. transport is allowed to send the request.

A credential acquisition or validation failure before step 6 is not a dispatch attempt. It can be a run diagnostic or authorization event, but no `attemptId` is necessary.

A failure after step 6 must classify as:

- proven no-dispatch/non-commit; or
- uncertain until provider-specific evidence says otherwise.

## 11. Cancellation and stale in-flight work

Cancellation stops future local Effects. It does not retract a request already sent.

Rules:

- before `DispatchStarted`: cancellation creates no attempt;
- after `DispatchStarted` but before transport proves no send: operation remains uncertain;
- a cooperative lease prevents another runner from starting new work but cannot fence an old external request;
- a stale request can complete after a new runner starts;
- safe continuation therefore needs provider replay safety, a provider-side fence, or observation.

Temporal documentation supplies a concrete analogue: pausing retries does not stop a non-heartbeating Activity already in flight, and an Activity can complete after local control has changed. Temporal also recommends idempotent Activities because a worker can complete an external effect and crash before recording completion.

Primary sources:

- [`activity-definition.mdx`](https://github.com/temporalio/documentation/blob/7f42b11f9ea68c1b463527fc1c13150a61c5cd16/docs/encyclopedia/activities/activity-definition.mdx)
- [`activity-operations.mdx`](https://github.com/temporalio/documentation/blob/7f42b11f9ea68c1b463527fc1c13150a61c5cd16/docs/encyclopedia/activities/activity-operations.mdx)

## 12. Fresh-runner continuation

Target trace:

```text
new CI runner
no previous workspace or process memory
durable bundle + plan + journal available
exact application/configuration loaded
custom provider definition resolved
credentials reacquired
journal lease/CAS acquired
uncertain operations observed or replay-authorized
continuation proceeds per Intent
```

Required durable facts:

- canonical bundle and content;
- canonical release plan;
- ordered journal events;
- provider definition ID and schema version in every Intent;
- source/application identity policy;
- non-secret authorization identity when relevant;
- retention and migration metadata.

No secret material or temporary path is persisted.

## 13. Mechanism comparison

| Mechanism | Fresh runner | Mutable CAS history | Exact external mutation guarantee | Custom provider | Main limitation |
| --- | --- | --- | --- | --- | --- |
| Local files | Only same durable disk | Possible with locking/fsync | None | Yes | Host loss and shared-runner access |
| SQLite | Same or shared durable volume | Strong local transactions | None | Yes | Single-file placement and remote runner access |
| Remote object store | Yes | Needs conditional writes/versioning | None | Yes | Journal append/CAS design and consistency |
| Remote database | Yes | Strongest general CAS/transactions | None | Yes | Infrastructure and schema operations |
| CI artifacts plus job rerun | Bundle transport yes | Poor mutable journal without another store | None | Yes if application restored | Finite retention, attempt naming, weak concurrency |
| Explicit release journal | Yes with durable backend | Designed for provider facts | None by itself | Yes | Must implement provider reconciliation |
| Effect Workflow/Activity | Yes only with persistent engine | Engine results/messages | None at registry boundary | Yes if definitions loaded | Activity replay still needs idempotency/reconciliation |
| Temporal | Yes | Durable event history and Activity state | Activity observed complete once, but body may execute more than once | Yes | External service must enforce idempotency |
| Generic durable-run library | Potentially | Depends on backend | None by itself | Yes | Must not erase release-provider facts |

## 14. Effect Workflow/Activity relationship

Effect Activity persists encoded results through a configured WorkflowEngine. At the inspected rc.109/current pin:

- Activity identity includes workflow execution ID, Activity name, and attempt in the in-memory engine;
- constructor-level interruption retry can re-run the Activity body;
- `Activity.retry` increments `CurrentAttempt`;
- the engine stores results/messages and reruns workflow code;
- it does not provide a provider-side fence; and
- call order is not itself the explicit durable Activity key, though reordering/renaming code can change which names are invoked.

Workflow/Activity may execute:

```text
load operation state
observe provider
append event
dispatch authorized attempt
wait or resume
```

It cannot replace the canonical release plan, event journal, or provider replay law.

## 15. Ideal user experience

### Normal continuation

```text
ts-release continue <release-ref>
```

The command:

1. loads the exact plan and finalized bundle;
2. reports completed, pending, conflicted, and uncertain Intents;
3. acquires a cooperative lease;
4. resolves provider definitions from the application;
5. reacquires credentials only for work that needs them;
6. observes or safely replays uncertain operations;
7. reuses all finalized artifacts; and
8. stops with the minimum explicit decision when automation is unsafe.

### User-visible uncertainty

A report must distinguish:

```text
accepted by provider
satisfied by fresh observation
not observed yet
pending
replay-safe despite uncertainty
proven unable to commit
conflict
inconclusive
risk retry authorized
consumer evidence not observed
```

"Retrying" must never hide which authority permitted the mutation.

## 16. Adversarial cases summarized

Detailed traces live in [adversarial-traces.md](./adversarial-traces.md).

| Case | Required law |
| --- | --- |
| normal npm success | one physical PUT, provider success receipt, independent version/tag observation facets |
| lost GitHub asset response | complete asset listing and digest/name comparison before replay |
| stale in-flight mutation | absence cannot fence; lease cannot cancel provider work |
| safe replay | provider idempotency/CAS law recorded in `ReplayAuthorized` |
| risky replay | explicit maintainer event, not automatic retry |
| partial Warehouse publication | one file Intent and one attempt per upload |
| plan correction | new canonical Intent and plan supersession, old history retained |
| fresh-runner custom provider | application reloads exact provider definition and schema |

## 17. Recommendations and confidence

| Recommendation | Confidence | Tradeoff |
| --- | --- | --- |
| One canonical `DispatchStarted` event per physical mutation boundary. | High | Journal event is slightly richer than one event per Intent. |
| Prefer Intent granularity matching provider commit law; use member sets only for genuine grouped requests. | High | Provider adapters must expose physical request structure. |
| Recognize three retry authorities: non-commit proof, provider replay safety, and explicit risk acceptance. | High | More vocabulary, but each state has different safety meaning. |
| Treat polling-budget exhaustion as `Inconclusive`, not non-commit. | High | Some releases require operator decisions after long outages. |
| Acquire credentials before creating a dispatch attempt. | High | Short-lived credentials must remain valid across immediate journal append and send. |
| Use an explicit release journal even if Workflow/Activity is later adopted. | High | Additional durable model and storage work. |
| Prefer remote transactional/CAS storage for cross-runner continuation; support local/SQLite only under explicit durable-volume assumptions. | Moderate | Remote infrastructure raises first-use complexity. |

## 18. Genuine maintainer choices

- Exact journal event Schemas and storage backend.
- Whether physical dispatch events store a provider request fingerprint only or additional bounded request metadata.
- How grouped provider responses are mapped into per-Intent derived states.
- Lease duration, ownership, and takeover rules.
- Required authorization identity fields and redaction policy.
- Provider-specific visibility budgets.
- UI and CLI for explicit risk-bearing replay.
- Whether Workflow/Activity is present in the first shipping implementation.

## 19. Unresolved contradictions

1. The ideal promise says another runner can continue automatically, but a valid custom provider may expose neither observation nor replay safety. The honest result is bounded resumability ending in `Inconclusive`.
2. A composite provider request can establish several facts, but decomposing every fact into an Intent can recreate peer representations. The exact npm Intent shape remains provisional.
3. Remote transactional storage best satisfies cross-runner continuation, while a zero-infrastructure CLI favors local files. Both cannot be the only default without an explicit deployment model.
4. A cooperative lease is useful for ordinary concurrency but cannot fence stale external requests. Documentation must not market leases as exactly-once protection.
