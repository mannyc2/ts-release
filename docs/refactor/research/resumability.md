# Resumability

Status: active research. No orchestration mechanism is selected, and Workflow/Activity is not being implemented in this checkpoint.

## Target user contract

> A release is resumable when, after the original process or runner disappears at any point, another authorized runner can continue the same logical release from durable progress and exact finalized inputs, without rebuilding completed artifacts, losing completed work, or blindly repeating an externally visible mutation. It either converges to the intended terminal state or stops with a precise conflict or unknown-state report and the minimum human decision required.

## Vocabulary

- **Retry**: repeat an operation inside the same logical attempt, usually according to a schedule.
- **Rerun**: start the natural command again. A rerun may rediscover and reuse durable work, or may start over.
- **Continue**: execute work after already completed steps without implying durable process recovery.
- **Resume**: continue the same identified release run from durable progress after the original runner is gone.
- **Reconcile**: compare intended state, durable progress, and external state to classify an ambiguous or partial result.
- **Safely re-execute**: execute an operation again only when provider laws prove repetition is harmless, conditional, or already satisfied.

These terms must remain distinct in CLI text and implementation contracts.

## Required release identity

The provisional identity inputs are:

- exact source revision and tree;
- exact release-definition identity or executable code identity;
- schema/version information needed to decode durable state;
- exact finalized artifact identities;
- user-visible release coordinates;
- one stable logical release-run ID.

**Proposal:** credentials are reacquired and never included in durable identity or state.

## Failure matrix

| Interruption point | Durable artifacts only | Additional progress required for ideal resume | External risk |
| --- | --- | --- | --- |
| Before artifact finalization | Nothing safe to reuse unless the builder has its own checkpoint | Rebuild or builder-native checkpoint | None unless builder has external effects |
| After artifacts become durable | Reuse exact finalized inputs | Record release identity and artifact bundle | None |
| Before external mutation | Rerun can restart publication | Durable intent/progress distinguishes not-started from unknown | None |
| Request in flight | Bundle cannot determine outcome | Provider-native reconciliation plus dispatch evidence | Mutation may have committed |
| Provider committed before response was recorded | Whole-phase rerun may conflict or duplicate | Reconcile exact coordinate, receipt fields, and bytes before replay | Highest ambiguity |
| Some assets or destinations succeeded | Whole-phase rerun rediscoveries vary by provider | Per-independent-coordinate progress and provider reads | Partial public release |
| GitHub succeeded before Homebrew/Scoop | Bundle preserves inputs but not completion | Durable GitHub receipt or authoritative rediscovery; continue catalog publication | Dependency result may need reconstruction |
| Credentials expired | Reuse durable non-secret state | Reacquire scoped credentials | No rollback implied |
| Cancellation during publication | Future work can stop | Record cancellation separately from completed public effects | Completed effects remain public |
| Concurrent resume attempts | Bundle alone does not coordinate ownership | Lease, compare-and-set ownership, or idempotent/conditional provider operations | Duplicate/conflicting mutations |
| Source/dependencies/schema/code changed | Bundle preserves artifacts but may load with different behavior | Refuse silent continuation unless compatible definition identity/evolution is proven | Wrong code may interpret old progress |
| Artifacts or execution state expired | Resume may be impossible | Precise retention-expired report and minimal rebuild/republication decision | External state may outlive local evidence |

## Mechanisms under comparison

### Bundle plus whole-phase rerun

User experience:

```text
ts-release release
# runner disappears
ts-release release
```

The rerun reloads exact finalized artifacts and reruns publication code.

Strengths:

- small infrastructure footprint;
- custom providers participate naturally as ordinary code;
- exact artifacts can be reused;
- provider-native immutable-coordinate conflicts may reveal already completed work.

Limits:

- no durable record of which provider calls started or completed;
- cannot distinguish not-started from response-lost without provider observation;
- repeats all discovery and provider-local setup;
- concurrency requires an external lock or provider-native conditionality;
- a changed release definition may silently alter rerun behavior unless identity is checked.

### Explicit durable checkpoints or operation journal

A run records state transitions and provider receipts at independent commit boundaries.

Strengths:

- exact partial progress can be inspected and continued;
- successful receipts avoid unnecessary provider rereads;
- response-loss ambiguity can be represented explicitly;
- cancellation and ownership can be recorded separately from external state.

Limits:

- journal append and external mutation cannot be one transaction across independent providers;
- provider-specific reconciliation is still required after commit-before-record loss;
- schema and code evolution become product obligations;
- a universal operation model may erase provider facts if designed too early.

### CI-native artifacts and job reruns

Examples include GitHub Actions artifacts, protected environments, job retries, and workflow concurrency groups.

Strengths:

- readily available artifact transfer and credential reacquisition;
- protected publication jobs and approval fit existing CI UX;
- job-level cancellation and concurrency controls are available.

Limits:

- CI job status does not prove external mutation outcome;
- retention is platform policy;
- portability across CI providers is limited;
- job rerun is not automatically logical release resume;
- custom local execution needs another mechanism.

### Effect Workflow/Activity

Pinned source baseline used by effect-build: Effect `effect@4.0.0-rc.108`, commit `bef7bf38ae4b73d5511043f707aed083de5da7cc`.

Current upstream baseline: commit `189b003a2367fa44dd4b8544aa62979f0345d179`.

Observed semantics:

- **Source-observed:** Workflow definitions have stable tags, payload/success/error Schemas, deterministic execution IDs, polling, interruption, resume, and handler registration.
- **Source-observed:** Activity is an Effect with a stable name and success/error Schemas. The engine can store and replay its encoded result.
- **Source-observed:** Activity execution retries interruption by default according to an interrupt retry policy.
- **Source-observed:** the in-memory WorkflowEngine is intended for testing/local development.
- **Source-observed:** ClusterWorkflowEngine adds cluster sharding and persisted message storage; this is materially more infrastructure than a local library.

External-mutation gap:

```text
activity sends provider mutation
provider commits
runner disappears before activity result is durably stored
engine replays activity
```

**Inferred:** Workflow/Activity cannot provide exactly-once publication at an independent registry boundary. Safe replay still depends on provider-native idempotency, a conditional operation, or provider-specific reconciliation. Default retry-on-interrupt is particularly important to analyze before wrapping non-idempotent publication in an Activity.

Primary sources:

- https://github.com/Effect-TS/effect/blob/bef7bf38ae4b73d5511043f707aed083de5da7cc/packages/effect/src/unstable/workflow/Workflow.ts
- https://github.com/Effect-TS/effect/blob/bef7bf38ae4b73d5511043f707aed083de5da7cc/packages/effect/src/unstable/workflow/Activity.ts
- https://github.com/Effect-TS/effect/blob/bef7bf38ae4b73d5511043f707aed083de5da7cc/packages/effect/src/unstable/workflow/WorkflowEngine.ts
- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/unstable/cluster/ClusterWorkflowEngine.ts

### Generic durable-execution or release-run library

Possible coherent laws:

- stable run identity;
- append-only or compare-and-set progress;
- lease/ownership and concurrent resume exclusion;
- typed durable checkpoints with explicit schema evolution;
- exact durable input references;
- no claim of atomicity with independent external providers;
- extension operations retain provider-specific reconciliation logic.

This could be independently useful, but architectural validity and implementation priority are separate questions. Research must determine whether the generic boundary removes state rather than merely relocating ts-release vocabulary.

### Stronger discovered model: receipts plus uncertain dispatch records

A candidate model is not a universal serialized task graph. It consists of:

1. exact durable finalized inputs;
2. stable logical run identity;
3. durable completion receipts for operations whose success response was recorded;
4. a narrow uncertain-dispatch record when dispatch may have occurred but no result was recorded;
5. provider-local code that reconciles uncertain dispatch before any replay;
6. ownership/lease preventing concurrent continuation.

**Inferred:** this is stronger than whole-phase rerun and smaller than recording every internal operation. It remains a hypothesis until walked through every released provider.

## Comparison criteria

Each mechanism will be scored on:

- CLI and CI experience;
- infrastructure requirements;
- release identity;
- artifact and definition fidelity;
- partial-success behavior;
- ambiguous-response recovery;
- concurrency and ownership;
- cancellation semantics;
- credential handling;
- retention;
- schema/code evolution;
- arbitrary custom-provider participation;
- guarantees impossible across independent registry boundaries.

## Questions still requiring evidence

- What is the smallest durable progress unit for npm package versions, PyPI files, GitHub releases/assets, and Git catalog commits?
- Can a natural rerun provide ideal resume without an explicit `resume` command?
- Which receipts eliminate provider rereads, and which must still be reconciled?
- How should definition-code identity be established without serializing provider operations?
- What lease backend is sufficient for local, CI, and hosted execution?
- How do expired artifacts differ from expired journal state?
- Can Workflow/Activity be adapted without its retry/replay semantics defining provider operations?

No Workflow or Activity implementation will be added before these questions are resolved.