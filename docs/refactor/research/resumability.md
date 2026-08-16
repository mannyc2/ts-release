# Resumability and durable release history

Status: research checkpoint. This document defines the durable history and derived state model. It does not implement a journal, Workflow, Activity, or provider mutation.

## Target user experience

A release can stop after any provider-local coordinate and later continue by:

1. loading the same finalized bundle;
2. loading the same canonical release plan;
3. replaying the ordered journal history;
4. preserving every accepted or observed-equivalent operation;
5. observing uncertain operations before any new dispatch;
6. creating a new attempt only when provider-local evidence permits it; and
7. presenting conflicts or irreducible uncertainty instead of blindly repeating work.

Artifacts are finalized once and reused. Continuation is per Intent, not an all-or-nothing rerun.

## No LogicalOperation peer

### Canonical release plan

The canonical plan stores each desired provider fact exactly once as a provider-specific Intent.

```text
ReleasePlan = {
  schemaVersion,
  bundleId,
  intents,
  dependencyEdges
}
```

Each Intent already contains provider implementation, endpoint, coordinate, desired metadata, desired byte facts, and bundle artifact references.

```text
OperationId = hashCanonical(
  "ts-release/provider-intent/v1",
  canonicalEncodedIntent
)
```

There is no serialized `LogicalOperation` record that repeats the Intent fields. There is no separately stored intent digest beside an operation ID. A plan index may cache derived operation IDs only if loading recomputes and validates them.

Dependency edges reference derived operation IDs. They express orchestration order and do not repeat provider facts.

### Canonical journal history

The journal stores one ordered event history. It does not store these as independent peers:

- current state;
- attempts;
- attempt terminal facts;
- receipts;
- observations; and
- evidence arrays.

Those facts enter through events. Current state is a deterministic fold.

```text
Journal = {
  schemaVersion,
  planId,
  events
}
```

```text
JournalEvent =
  | DispatchStarted
  | DispatchRejectedBeforeCommit
  | ReceiptAccepted
  | ObservationRecorded
  | RiskRetryAuthorized
  | ConsumerEvidenceRecorded
```

A materialized state table, attempt index, or observation index is a disposable projection. It must be reproducible from the release plan and ordered event history. It cannot be accepted as a second source of truth.

## Event identities

### DispatchStarted

`DispatchStarted` is appended atomically before crossing the external mutation boundary.

```text
DispatchStarted = {
  eventId,
  operationId,
  attemptId,
  dispatchId,
  authorizationFacts,
  providerIdempotencyKeyIfAny,
  startedAt
}
```

`attemptId` is derived from the operation ID and the journal sequence allocated for this dispatch start. A separate mutable attempt counter is not canonical.

`dispatchId` identifies one physical mutation boundary. Several operation histories may reference the same dispatch ID when one command can affect several Intents. For example, one npm command may affect an immutable version Intent and a mutable dist-tag Intent.

### Terminal and observation events

A later event references the attempt or operation it classifies:

```text
DispatchRejectedBeforeCommit(attemptId, proof)
ReceiptAccepted(attemptId, providerNativeReceipt)
ObservationRecorded(operationId, attemptIdIfRelevant, freshObservation)
RiskRetryAuthorized(operationId, priorAttemptId, maintainerDecision)
ConsumerEvidenceRecorded(operationIdOrRelease, evidenceEnvironment, result)
```

Receipt and observation payloads remain provider-native and versioned. Secrets, temporary paths, and unbounded bodies are not persisted.

## Derived operation states

The fold of plan plus events produces one state per operation.

| Derived state | Required history | Next lawful action |
| --- | --- | --- |
| `Planned` | Intent exists and no dispatch event exists. | Append `DispatchStarted`, then cross the mutation boundary. |
| `Dispatching(attempt)` | Latest relevant event is `DispatchStarted` with no conclusive later event. | Observe or append a returned receipt/proof. Never blindly start another attempt. |
| `Accepted(receipt)` | `ReceiptAccepted` proves provider acceptance for the Intent. | Preserve; gather metadata, byte, or consumer evidence as separate events. |
| `SatisfiedByObservation(observation)` | A fresh observation proves the Intent equivalent. | Preserve; gather consumer evidence if required. |
| `ProvenNotCommitted(proof)` | Provider-local or trusted local evidence proves the prior attempt did not commit. | A new attempt may be started if still authorized. |
| `AbsentRetryable(observation, policy)` | Fresh absence is not yet authoritative because visibility may lag. | Observe again under the bounded policy. |
| `Pending(observation, policy)` | Provider reports accepted but nonterminal processing or indexing. | Observe again. Do not duplicate. |
| `Conflict(observation)` | Fresh facts contradict the Intent. | Stop automatic progress; correct or supersede explicitly. |
| `Inconclusive(evidence)` | Available evidence cannot prove commit, non-commit, equivalence, or conflict. | Stop automatic progress; obtain stronger evidence or append an explicit risk decision. |

`Accepted` and `SatisfiedByObservation` are different evidentiary paths to a satisfied operation. The fold preserves the receipt or observation event that established the result.

## Fold laws

### Minimum write-ahead law

```text
canonical Intent exists in ReleasePlan
  -> append DispatchStarted
  -> durably commit the event
  -> cross the external mutation boundary
  -> append receipt, proof, or observation event
```

The external mutation must never occur before `DispatchStarted` is durable.

### Permitted histories

```text
Planned
  -> Dispatching(N)

Dispatching(N)
  -> Accepted
  -> ProvenNotCommitted
  -> SatisfiedByObservation
  -> AbsentRetryable
  -> Pending
  -> Conflict
  -> Inconclusive

AbsentRetryable
  -> SatisfiedByObservation
  -> ProvenNotCommitted
  -> Pending
  -> Conflict
  -> Inconclusive

Pending
  -> Accepted
  -> SatisfiedByObservation
  -> ProvenNotCommitted
  -> Conflict
  -> Inconclusive

ProvenNotCommitted
  -> Dispatching(N + 1)

Inconclusive
  -> Dispatching(N + 1) only after RiskRetryAuthorized
```

A risk-bearing retry is an exceptional audited maintainer decision. It is not evidence that duplicates are safe and it does not rewrite the prior inconclusive history.

### Forbidden histories

```text
Dispatching(N) -> Dispatching(N + 1) without proof or explicit risk authorization
Pending -> Dispatching without proof or risk authorization
Conflict -> automatic overwrite
Accepted -> repeated create because consumer evidence is missing
SatisfiedByObservation -> repeated create because a receipt is absent
```

## Storage requirements

A production release plan and journal need:

- versioned canonical encoding;
- domain-separated plan, Intent, and event identities;
- atomic append or compare-and-swap;
- torn-write and conflicting-writer detection;
- one-writer lease or operation-level CAS for continuation;
- durable linkage to the finalized bundle;
- versioned provider Receipt and FreshObservation schemas;
- bounded and redacted evidence payloads;
- immutable prior history;
- deterministic folding; and
- validation that any cached projection equals the fold result.

The backend remains a maintainer choice. These laws apply to local files, SQLite, an object store, or another durable service.

## Dependency and physical dispatch groups

A release plan is a graph of Intents.

- An npm dist-tag Intent depends on the intended version Intent being satisfied.
- A GitHub asset Intent depends on the release Intent being satisfied.
- A Homebrew formula Git publication Intent depends on finalized download URLs and checksums.
- A Scoop bucket publication Intent depends on finalized manifest bytes and referenced artifact URLs.
- Consumer installation depends on provider acceptance or public visibility but is not a provider mutation.

A physical command may affect several Intents. The journal expresses this by appending one `DispatchStarted` event per affected operation with the same `dispatchId`. It does not create a composite operation that duplicates the child Intents.

If a grouped command returns success, the adapter appends a provider-native receipt event for each Intent the response proves. Any unproved child remains `Dispatching` and must be observed.

## Worked trace 1: ordinary npm success

Canonical plan:

```text
V = NpmVersionIntent(
  registry.npmjs.org,
  @scope/pkg,
  1.2.3,
  tarball integrity X
)

T = NpmDistTagIntent(
  registry.npmjs.org,
  @scope/pkg,
  latest -> 1.2.3
)

Dependency: V before T
```

Derived IDs:

```text
V.id = hashCanonical(V)
T.id = hashCanonical(T)
```

The adapter elects one physical command:

```text
D1 = npm publish package.tgz --tag latest
```

Before execution, append:

```text
DispatchStarted(V.id, V1, D1)
DispatchStarted(T.id, T1, D1)
```

The command returns success and proves both effects:

```text
ReceiptAccepted(V1, NpmVersionReceipt)
ReceiptAccepted(T1, NpmDistTagReceipt)
```

The fold yields:

```text
V = Accepted(version receipt)
T = Accepted(tag receipt)
```

Later metadata reads append separate observations:

```text
ObservationRecorded(V.id, Equivalent(name, version, integrity, shasum))
ObservationRecorded(T.id, Equivalent(latest -> 1.2.3))
```

A clean npm install may still be:

```text
ConsumerEvidenceRecorded(release, clean-npm, NotObserved)
```

If the process dies after registry commit but before receipt events, both operations fold to `Dispatching`. Recovery reads package metadata and appends independent observations:

```text
V -> SatisfiedByObservation(version and bytes equivalent)
T -> SatisfiedByObservation(tag equivalent)
```

If the version is equivalent but `latest` points to `1.2.2`, V remains satisfied while T becomes `Conflict` or is superseded by a separately authorized tag-correction Intent. The package version is never republished.

## Worked trace 2: partial PyPI progress

Canonical plan contains one Warehouse file Intent per distribution:

```text
A = package-1.2.3.tar.gz
B = package-1.2.3-py3-none-any.whl
C = package-1.2.3-cp313-manylinux_x86_64.whl
```

First run events:

```text
DispatchStarted(A, A1, D1)
ReceiptAccepted(A1, WarehouseUploadReceipt)

DispatchStarted(B, B1, D2)
# response lost, no later event

DispatchStarted(C, C1, D3)
DispatchRejectedBeforeCommit(C1, credential-preflight-proof)
```

Folded states:

```text
A = Accepted(receipt)
B = Dispatching(B1)
C = ProvenNotCommitted(preflight proof)
```

Continuation:

1. Load the same bundle and plan.
2. Fold the journal.
3. Do not upload A.
4. Read the Warehouse Simple API for B.
5. If filename, size, and SHA-256 match, append `ObservationRecorded(...Equivalent...)`.
6. If B is absent but indexing may lag, append `AbsentRetryable` and observe again.
7. Repair credentials for C and append `DispatchStarted(C, C2, D4)` only because C1 proved non-commit.

The parent PyPI outcome is complete only when every required file Intent is satisfied. Partial success is normal durable history.

## Worked trace 3: lost GitHub asset response

Prerequisites:

```text
Release Intent = Accepted(releaseId 42)
Asset Intent = release 42 / requested name tool-linux-x64.tar.gz / digest X
```

Events:

```text
DispatchStarted(asset, A1, D1)
POST asset bytes
# response lost
```

The fold yields `Dispatching(A1)`.

Recovery:

1. List all assets for release 42 and follow pagination to completion.
2. Apply the Intent's explicit requested-name to stored-name normalization rule.
3. Compare effective stored name, state, size, media type, and digest or downloaded bytes.

Possible appended observations:

```text
matching uploaded asset -> Equivalent -> SatisfiedByObservation
same effective name, different bytes -> Conflict
provider processing state -> Pending
complete authoritative absence after visibility budget -> AuthoritativelyAbsent -> ProvenNotCommitted
incomplete listing or unavailable identity -> Inconclusive or AbsentRetryable
```

Only `ProvenNotCommitted` normally permits A2. A timeout alone does not.

## Worked trace 4: Homebrew formula publication

The finalized bundle contains:

```text
F = rendered formula artifact
G = conditional tap Git publication Intent
C = Homebrew consumer evidence target
```

The formula rendering law is established before publication by exact URLs, checksums, class/token name, and install stanza validation. It is not a second provider operation record.

Events:

```text
DispatchStarted(G, G1, D1)
create Git blobs/tree/commit
conditional ref update P -> Q
```

Normal response:

```text
ReceiptAccepted(G1, GitRefReceipt(previous P, commit Q))
```

Lost-response recovery reads the ref and exact formula path:

```text
ref == Q and formula bytes equivalent -> SatisfiedByObservation
ref advanced to unrelated commit -> Conflict
ref remains P with authoritative rejected update -> ProvenNotCommitted
read cannot establish ref or managed path -> Inconclusive
```

A clean `brew install` and executable smoke are consumer evidence. Missing consumer evidence never repeats an accepted ref update.

## Worked trace 5: Scoop publication

The finalized bundle contains:

```text
M = Scoop manifest artifact with exact URLs and hashes
G = conditional bucket Git publication Intent
C = Windows Scoop consumer evidence target
```

The Git flow is the same provider law used by Homebrew, but the renderer and consumer environment differ.

After response loss:

```text
bucket ref and manifest bytes equivalent -> SatisfiedByObservation
bucket ref changed to unrelated commit -> Conflict
old ref remains and conditional update was rejected -> ProvenNotCommitted
Scoop install not run -> ConsumerEvidence = NotObserved
```

The rewrite ships both Homebrew formula and Scoop outcomes. They are not an either/or catalog choice.

## Worked trace 6: unknown custom provider

A custom provider has an exact Intent and mutation receipt schema, but its read API exposes only an incomplete listing with no digest.

Events:

```text
DispatchStarted(O, O1, D1)
provider may commit
# response lost
ObservationRecorded(O, Inconclusive(
  "provider cannot distinguish committed coordinate from absence"
))
```

The fold yields `Inconclusive`.

The core presents:

- the canonical Intent;
- derived operation ID;
- finalized artifact digest;
- dispatch event and authorization facts;
- all available provider observations; and
- provider-declared absence limitations.

The core does not append O2 automatically. A maintainer may provide stronger evidence, abandon the operation, supersede it with another Intent, or append `RiskRetryAuthorized` and accept duplicate risk.

## Workflow and Activity relationship

Effect Workflow or Activity may later execute timers, observations, and dispatch commands. They do not define the canonical provider Intent or journal history.

Activity identity at the inspected Effect pins depends on workflow execution ID, Activity name, and attempt. That is engine identity, not provider operation identity. The release operation ID is derived directly from canonical Intent bytes.

Before a Workflow or Activity dispatches a provider mutation, it must CAS-append `DispatchStarted`. Engine replay cannot infer whether npm, Warehouse, GitHub, Git, or a custom provider committed after a response was lost.

## Default retry policy

```text
retry observation according to provider policy;
retry mutation after ProvenNotCommitted;
allow risk-bearing retry only after an explicit audited decision;
never retry Conflict automatically;
never interpret missing consumer evidence as permission to mutate.
```

Provider-native idempotency keys and conditional writes improve the proof surface. The journal records which key or condition was used, but their existence does not eliminate the history.

## Correction and supersession

A correction creates a new canonical Intent and therefore a new derived operation ID. A supersession event or plan edge links the new Intent to the prior one while preserving:

- the original Intent;
- every dispatch event;
- every receipt and observation;
- correction authority; and
- the new desired provider fact.

Prior history is immutable.

## Genuine remaining maintainer choices

The shipping provider scope is not a remaining choice. Maintainers still need to decide:

- journal backend and transaction model;
- release-plan and event schema details;
- operation-level lease duration and concurrent continuation behavior;
- exact dispatch-group allocation for composite commands;
- provider-specific observation budgets and authoritative-absence rules;
- the UI and authority model for `RiskRetryAuthorized`;
- retention, compaction, and secret-redaction policy;
- whether Workflow or Activity is included in the first delivery; and
- which consumer evidence is required before the whole release is called complete.

## Conclusions

1. Intent is the sole canonical desired provider representation.
2. Operation ID is derived directly from canonical Intent bytes.
3. There is no serialized LogicalOperation peer.
4. Ordered journal events are canonical; current state and indexes are derived.
5. `DispatchStarted` is a write-ahead uncertainty boundary, not permission to retry.
6. Accepted receipts and equivalent observations are separate evidentiary paths.
7. Proven non-commit is the normal gateway to another mutation attempt.
8. Absent-retryable, pending, conflict, and inconclusive are first-class derived states.
9. npm, plural Warehouse files, GitHub assets, Homebrew formulas, Scoop, and custom providers continue per Intent against the same finalized bundle.
10. Workflow or Activity may execute the model but cannot replace provider reconciliation.
