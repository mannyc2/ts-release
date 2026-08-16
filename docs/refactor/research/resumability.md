# Resumability

Status: recovered research checkpoint. This document compares mechanisms
against one external-mutation model. It does not implement Workflow/Activity or
select a durable execution system.

## Target user promise

The provisional target is:

> After interruption, continue a release without rebuilding completed artifacts
> or blindly repeating external mutations, while detecting changed inputs,
> code, credentials, and provider conflicts and preserving an honest record of
> what is known, observed, and still ambiguous.

This target is stronger than "rerun the command" and weaker than a distributed
transaction across registries. It requires explicit progress granularity and an
honest unknown state.

## External-mutation gap used for every comparison

All mechanisms are evaluated against the same sequence:

```text
local durable state says an operation may run
-> request reaches an independent provider
-> provider commits
-> response or worker disappears
-> local durable state lacks a terminal success receipt
```

A workflow engine, CI system, database, or lease can make local history durable.
It cannot infer the provider commit from local history alone. Safe continuation
requires one of:

- provider-native idempotency enforced by the provider;
- a conditional coordinate/write whose conflict is authoritative;
- an authoritative reconciliation read; or
- a human decision when the provider state remains irreducibly unknown.

## Write-ahead law

The minimum honest publication state machine is:

```text
Planned
  -> Dispatching     // durably recorded before sending
  -> Succeeded(receipt)
     | ProvenNotCommitted
     | ReconcileRequired
```

Required transition laws:

1. `Planned -> Dispatching` is durable before request dispatch.
2. A terminal `Succeeded(receipt)` records the documented provider success
   response and the non-secret identity needed to interpret it.
3. `ProvenNotCommitted` is used only when client/provider evidence proves that
   this attempt did not commit.
4. `ReconcileRequired` is used when dispatch may have happened but no terminal
   response was durably recorded, or when the provider documents another
   inspectable ambiguous state.
5. If a process disappears from `Dispatching`, continuation reconciles before
   considering a repeat write.
6. Reconciliation stores a fresh observation separately from the historical
   receipt/state that caused it.
7. No local transition claims exactly-once registry mutation.

This write-ahead law prevents the journal from later saying "dispatch was
impossible" when the request may actually have been sent. It does not fence or
undo the provider.

## Proposed durable data separation

A durable record needs separate types for historical execution evidence and
fresh external evidence:

```ts
interface HistoricalReceipt {
  readonly coordinate: unknown
  readonly providerAcceptedAt: string
  readonly providerFields: unknown
  readonly authorizationIdentity?: AuthorizationIdentity
}

interface FreshObservation {
  readonly coordinate: unknown
  readonly observedAt: string
  readonly observerIdentity?: AuthorizationIdentity
  readonly providerFields: unknown
  readonly classification: "Equivalent" | "Absent" | "Conflict" | "Inconclusive"
}
```

The CLI must not render a `HistoricalReceipt` as though it were a current
provider read. Conversely, a current read does not replace or rewrite the
historical record of the original attempt.

## Secrets and authorization identity

Never persist secret token material, private keys, session cookies, raw OIDC
credentials, or unredacted environment/config values.

Some non-secret authorization identity is relevant to safe continuation and may
be durable:

- registry account or username;
- cloud account/tenant/project;
- service principal or role ARN/name;
- repository installation/application identity;
- granted scopes/audience;
- approval identity and timestamp; and
- credential mechanism (token, trusted publishing, OIDC role), without the
  secret itself.

Continuation reacquires credentials through current Layers/configuration and
compares the non-secret identity/policy with the historical operation. A
credential that is valid but belongs to a different account is not equivalent.

## Leases and concurrency

A lease prevents cooperative concurrent continuation only when all contenders
honor the same durable lease. It cannot fence a stale request already in flight
at an external registry.

Therefore:

- lease acquisition must happen before forward execution;
- lease epoch/owner should be stored with local transitions;
- loss of lease stops future local dispatch;
- provider conditional writes and coordinates still handle races at the
  provider boundary; and
- a late response from an old owner is recorded as historical evidence and
  reconciled against the current run, not silently discarded or accepted.

A distributed lock with no provider conditional is not an exactly-once fence.

## Progress granularity and artifact rebuilding

The target sentence "never rebuild completed artifacts" is incompatible with
persisting only a final bundle when a build produces artifact 1 of N, records
nothing durable, and crashes while building artifact 2.

Three lawful promises are possible:

| Progress owner | Honest promise | Cost/counterexample |
| --- | --- | --- |
| Finalized-bundle boundary only | A completed finalized bundle is reused; an interrupted incomplete build may restart from the beginning. | Does not satisfy "never rebuild completed artifacts." |
| effect-build/build tool internal cache | Reuse depends on that tool's cache/key/retention laws; ts-release persists only final bundle identity. | Not generic across builders; a cache hit is not a durable release checkpoint unless exact inputs/outputs are recorded. |
| Release journal per artifact/object | Every accepted artifact/object and its build input/definition identity is durably recorded; continuation imports/reuses it and builds only missing nodes. | More journal/schema/storage complexity; must handle partially written objects and changed build definitions. |

**Recommendation for the provisional target:** release-level durable progress is
owned per artifact/object or build node by the release run, even when
effect-build performs the actual compilation. effect-build may return typed
artifacts and its own cache evidence, but it should not own release-run identity,
provider receipts, or cross-provider continuation. If maintainers choose
bundle-only persistence for the first cut, the user promise must be narrowed
explicitly.

## Identity and compatibility of durable work

A run identity should bind at least:

- source revision and dirty/workspace policy;
- release definition/module identity;
- dependency lock and relevant runtime/tool versions;
- finalized input artifact identities;
- provider coordinates and non-secret destination identity;
- durable Schema/format versions; and
- a program/operation-definition version.

Continuation must reject or explicitly migrate changed source, dependencies,
Schemas, provider coordinates, or release code. Replaying an old receipt through
new code without a compatibility decision is not safe continuation.

## Effect Workflow/Activity identity scenarios

Pinned source:

- beta.83: `cd7ab658994104bd6fe8f841f1440bea32c387f5`;
- rc.108: `bef7bf38ae4b73d5511043f707aed083de5da7cc`;
- current pin: `ee06c9c1eed73ebcf282541ceb1615ff1ba1730d`.

Source evidence relevant to identity:

- a Workflow has a tag, payload, idempotency function, and derived execution ID;
- an Activity has a stable name and success/error Schemas;
- `WorkflowEngine.activityExecute` receives the Activity and attempt;
- `Activity.CurrentAttempt` participates in retry execution; and
- `Activity.idempotencyKey(name, { includeAttempt })` hashes workflow execution
  ID, supplied name, and optionally the current attempt.

Thus Activity identity is more than a string label in isolation. Execution
identity, activity name, attempt policy, ordering/definition, and payload or
coordinate identity must be designed together. The compile-only probes do not
establish these semantics.

| Change to a release program | Replay/deduplication risk | Lawful treatment |
| --- | --- | --- |
| Reorder two provider coordinates while reusing positional Activity names | Stored result may be associated with a different conceptual coordinate if identity was position-derived. | Activity/step identity includes stable coordinate-derived identity, not array index alone; reject incompatible program definition. |
| Insert a new operation before old operations | Position/count-based identities shift. | Stable explicit operation IDs or coordinate hashes; insertion does not rename existing durable work. |
| Rename an Activity | Engine sees a new durable name while old result remains under prior name. | Treat as a versioned migration or new operation; do not silently assume equivalence. |
| Two assets for the same provider/release | Provider name alone collides. | Identity includes release coordinate plus unique asset coordinate/name/content identity. |
| Retry attempt changes | Including attempt in provider idempotency key can intentionally create a new provider request; excluding it can deduplicate attempts. | Decide per provider contract and record the policy. Do not use a generic default around non-idempotent writes. |
| Workflow execution ID changes for the same intended release | All Activity idempotency helpers may change. | Stable release-run identity and explicit resume lookup; starting a new run is not continuation unless receipts are imported/reconciled deliberately. |

No Activity naming scheme is selected here.

## Mechanism comparison

### Common criteria

Each mechanism is evaluated for:

- durable local progress and granularity;
- run/operation identity;
- leases/concurrency;
- cancellation;
- credential reacquisition;
- retention and old-code compatibility;
- custom provider participation; and
- the external-mutation gap.

### 1. Explicit ts-release journal

A release-owned journal can store the write-ahead state machine, artifact
progress, receipts, observations, leases, and compatibility versions directly.

| Dimension | Assessment |
| --- | --- |
| Durable progress | Exact granularity is under product control: bundle-only, per artifact, per provider coordinate. |
| Identity | Can bind release-run and operation IDs directly to provider/artifact coordinates. |
| Concurrency | Lease/epoch can serialize cooperative continuation. Does not fence stale provider requests. |
| Cancellation | Stops future dispatch and records cancellation; committed provider effects remain. |
| Credentials | Reacquired through Layers; journal stores only non-secret authorization identity. |
| Retention | Product/backend policy; expired artifacts/receipts become typed continuation limits. |
| Evolution | Requires explicit journal/schema/program versioning and migrations. |
| Custom providers | Provider package supplies coordinate, receipt, reconciliation, and durable Schemas. |
| External mutation gap | Still present; journal routes `Dispatching` to provider reconciliation. |

This is the most direct expression of the target but creates release-specific
persistence code and operational ownership.

### 2. Effect Workflow/Activity with in-memory engine

Primary source:

- https://github.com/Effect-TS/effect/blob/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d/packages/effect/src/unstable/workflow/WorkflowEngine.ts

The in-memory engine is useful for tests/local development. It does not survive
process loss, so it cannot satisfy durable continuation. Typed Activity results,
names, Schemas, poll/resume APIs, and interruption behavior are still useful
API research, but a passing in-memory replay test is not evidence of durable
execution.

External mutation gap: unchanged and potentially worsened by automatic retry if
an external write is placed in an Activity without provider recovery logic.

### 3. Effect Cluster WorkflowEngine

Primary source family:

- https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d/packages/effect/src/unstable/cluster
- https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d/packages/effect/src/unstable/workflow

Cluster can route Workflow/Activity messages through cluster sharding and
configured message storage. Durability therefore depends on the selected
cluster/message-storage implementation and its retention/availability, not on
the `Activity` type alone.

| Dimension | Assessment |
| --- | --- |
| Durable progress | Potentially fine-grained Activity/Workflow results with a persistent engine/storage. Exact guarantees require source and backend pin. |
| Identity | Workflow execution ID, Activity names, attempts, Schemas, and program definition become durable compatibility surface. |
| Concurrency | Cluster entity routing can serialize engine work; provider writes still require conditional/idempotent/reconcile laws. |
| Cancellation | Durable interrupt/resume machinery can stop future engine work; remote effects already sent remain. |
| Credentials | Activity Layers reacquire credentials; never encode secrets in payload/exit. |
| Retention | Message storage and artifact backend policy. |
| Evolution | Unstable APIs and durable name/Schema migrations are a real cost. |
| Custom providers | Ordinary Effects can be wrapped as Activities, but doing so adds a durable participation contract. |
| External mutation gap | Unchanged. Engine cannot infer provider commit before result storage. |

No Cluster deployment or Activity implementation is included.

### 4. CI-native artifacts and reruns

Primary sources:

- https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/re-running-workflows-and-jobs
- https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
- https://docs.github.com/en/actions/using-jobs/using-concurrency

| Dimension | Assessment |
| --- | --- |
| Durable progress | Uploaded artifacts and job boundaries; intra-job progress usually reruns unless explicitly journaled. |
| Identity | Commit/ref/run/job identity is available, but definition/dependency/bundle identity must still be bound explicitly. |
| Concurrency | CI concurrency groups reduce cooperative overlap; they do not fence stale registry requests. |
| Cancellation | Stops jobs; provider commits already made remain. |
| Credentials | Reacquired from secrets/OIDC under current workflow permissions. Original and current authorization identity must be recorded separately. |
| Retention | Finite, CI-controlled, configurable within platform limits. Expired artifacts can make continuation impossible. |
| Evolution | Rerun semantics are provider-specific; old artifacts may meet new code unless versioned explicitly. |
| Custom providers | Good when the user's workflow installs/imports them. |
| External mutation gap | Unchanged; rerun after lost response must reconcile. |

CI is a possible backend and user interface, not the semantic definition of
resumability.

### 5. Temporal

Pinned primary source used for the external-effect property:

- https://github.com/temporalio/documentation/blob/7f42b11f9ea68c1b463527fc1c13150a61c5cd16/docs/encyclopedia/activities/activity-definition.mdx

Temporal documents that an Activity can complete its business work, crash
before reporting completion, and then execute again. It recommends idempotent
Activities and explains that idempotency keys are enforced by the external
service being called, not by the Activity itself.

| Dimension | Assessment |
| --- | --- |
| Durable progress | Mature Workflow history and Activity scheduling/results. Granularity follows Activity design. |
| Identity | Workflow/Run/Activity IDs and versioning become durable program surface. |
| Concurrency | Workflow semantics can serialize decisions; external provider conditionals still required. |
| Cancellation | Durable cancellation/timeouts; external commits remain. |
| Credentials | Worker reacquisition; secrets outside durable history. |
| Retention | Temporal namespace/history/archival policy plus artifact storage. |
| Evolution | Requires deterministic Workflow/versioning discipline and Activity compatibility. |
| Custom providers | Worker code can call arbitrary providers with provider-local contracts. |
| External mutation gap | Explicitly unchanged: Activity may execute more than once if completion was not recorded. |

Temporal is representative evidence that mature durable execution does not
create exactly-once effects at an independent service boundary.

### 6. AWS Step Functions

Primary sources:

- https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html
- https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
- https://docs.aws.amazon.com/step-functions/latest/dg/using-eventbridge-scheduler.html

Step Functions persists state-machine progress and supports retry/catch/timeouts
according to workflow type and configuration. Service integrations may offer
provider-specific idempotency or execution naming; arbitrary registry calls do
not inherit exactly-once semantics merely because they run in a state machine.

| Dimension | Assessment |
| --- | --- |
| Durable progress | Managed state transitions; granularity follows state/task boundaries. |
| Identity | Execution and state names/input are durable; changing definitions requires compatibility policy. |
| Concurrency | Managed execution controls; no fence for a request already at npm/PyPI/GitHub. |
| Cancellation | Stops future state transitions; external commits remain. |
| Credentials | IAM/service roles are reacquired; store role/account/scope identity, not credentials. |
| Retention | Product/workflow-type/account policy. Artifacts need separate storage. |
| Evolution | State-machine definitions and task input/output formats are durable compatibility surface. |
| Custom providers | Lambda/container/HTTP tasks can call arbitrary providers, with packaging and IAM costs. |
| External mutation gap | Unchanged unless the called provider/integration supplies idempotency or reconciliation. |

### 7. Generic durable-run library

A generic library is coherent only if it excludes release-specific concepts and
states laws usable by at least two domains, for example releases and deployment
or migration orchestration.

Candidate laws:

1. stable run identity binds immutable input and program version;
2. named step identity is stable across continuation;
3. durable write-ahead `Dispatching` precedes external work;
4. terminal typed exits are replayed, not recomputed;
5. unfinished dispatch requires caller-supplied recovery before retry;
6. one lease epoch owns forward local execution;
7. secrets are execution requirements, not persisted values; and
8. retention/schema incompatibility returns typed limits.

This could reduce duplicated persistence machinery, but it is not justified by
an in-memory task graph or a second name for the ts-release journal. No generic
library is implemented.

## Mechanism summary

| Mechanism | Survives process loss | Fine-grained progress | Operational burden | External mutation exactly once |
| --- | --- | --- | --- | --- |
| Bundle-only rerun | yes for finalized bundle | no | low | no |
| Explicit release journal | yes with durable backend | chosen by product | medium | no |
| Effect in-memory engine | no | in-process only | low | no |
| Effect Cluster engine | potentially, with persistent stack | Activity-level | high/unstable | no |
| CI artifacts/reruns | yes within retention/job boundaries | coarse unless journaled | delegated to CI | no |
| Temporal | yes | Activity-level | managed/self-hosted platform | no |
| Step Functions | yes | state/task-level | cloud platform | no |
| Generic durable-run library | depends on backend | explicit step-level | library plus backend | no |

## Decision boundary

The evidence supports these recommendations without selecting implementation
syntax:

- preserve the write-ahead `Dispatching` state in any durable mechanism;
- route abandoned `Dispatching` operations to provider reconciliation;
- use per-artifact release progress if the product keeps the "never rebuild"
  promise;
- keep HistoricalReceipt and FreshObservation distinct in storage and CLI;
- record non-secret authorization identity and reacquire secrets;
- treat Activity/step names, execution identity, attempts, coordinates, and
  program versions as durable compatibility surface; and
- evaluate every durable system against the same provider commit-before-local
  record gap.

The remaining maintainer choice is whether the first production cut includes
fine-grained durable execution, bundle-bound rerun only, or no persisted resume.
No Workflow/Activity implementation begins in this PR.
