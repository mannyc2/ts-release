# Resumability and durable release state

Status: research checkpoint. This document defines the durable state model and worked recovery traces. It does not implement a journal, Workflow, Activity, or provider mutation.

## Target user experience

A release can stop after any provider-local coordinate and later continue by:

1. loading the same finalized bundle;
2. loading the journal for that bundle and release intent;
3. preserving every accepted or observed-equivalent coordinate;
4. observing uncertain coordinates before any new dispatch;
5. creating a new attempt only after provider-local evidence permits it; and
6. presenting conflicts or irreducible uncertainty instead of blindly repeating work.

The user does not rebuild artifacts merely because a provider operation failed or the process died. Continuation is per coordinate, not an all-or-nothing rerun.

## Stable logical operation versus attempt

### `LogicalOperation`

A logical operation is the durable identity of one intended provider-local outcome. It is stable across process restarts, engine retries, and operator continuation.

```text
LogicalOperation = {
  operationId,
  providerImplementation,
  endpointOrNamespace,
  coordinate,
  intentDigest,
  bundleId,
  artifactReferences,
  dependencies
}
```

```text
operationId = hash(
  providerImplementation,
  endpointOrNamespace,
  canonicalCoordinate,
  canonicalIntentDigest
)
```

Changing the intended bytes, metadata, endpoint, or provider coordinate creates a new logical operation. A correction does not rewrite the old operation's history.

### `Attempt`

An attempt is one possible dispatch of a logical operation.

```text
Attempt = {
  attemptId,
  operationId,
  ordinal,
  dispatchId,
  startedAt,
  authorizationFacts,
  idempotencyKeyIfAny,
  terminalFact
}
```

```text
attemptId = operationId + ordinal
dispatchId = unique physical mutation boundary
```

One physical provider command may cover more than one logical operation. For example, `npm publish --tag next` can create an immutable version and move a mutable tag in one command. Both logical operations record the same `dispatchId` while keeping separate terminal facts and reconciliation.

An attempt ordinal is not proof of non-commit and is not automatically a provider idempotency key.

## Durable operation states

The journal preserves one of these states for each logical operation.

| State | Meaning | Next lawful action |
| --- | --- | --- |
| `Planned` | Canonical intent and dependencies are durable; no attempt is known to have crossed dispatch. | Validate authorization, then create a dispatch attempt. |
| `Dispatching(attempt)` | The journal recorded the attempt before calling the mutating boundary. The final provider outcome may be unknown. | Record a returned receipt, a proven pre-dispatch failure, or perform fresh observation. Never blindly start another attempt. |
| `Accepted(receipt)` | The provider returned a provider-native acceptance receipt for the exact intent. | Preserve; optionally gather M/B/C evidence. |
| `SatisfiedByObservation(freshObservation)` | A fresh provider read proves the coordinate equivalent to the intent. | Preserve; optionally gather consumer evidence. |
| `ProvenNotCommitted(proof)` | Provider-local evidence or a trusted local boundary proves the prior attempt did not commit. | A new attempt is permitted if policy and authorization still allow it. |
| `AbsentRetryable(freshObservation, policy)` | The coordinate is currently absent, but visibility or propagation rules prevent treating absence as proof of non-commit. | Observe again under a bounded policy; do not mutate yet. |
| `Pending(freshObservation, policy)` | The provider reports accepted but nonterminal processing, indexing, scanning, or publication. | Observe again; do not duplicate. |
| `Conflict(freshObservation)` | The coordinate exists with facts incompatible with the intent. | Stop, preserve evidence, and require correction or maintainer choice. |
| `Inconclusive(evidence)` | Available evidence cannot distinguish commit, non-commit, equivalence, or conflict. | Stop automatic progress. Require stronger evidence or a maintainer decision. |

`Accepted` and `SatisfiedByObservation` are two different ways to satisfy the same logical operation. Both remain durable because the receipt and observation have different evidentiary value.

## Journal transition law

The minimum write-ahead law is:

```text
persist Planned
  -> persist Dispatching(attempt N)
  -> cross the external mutation boundary
  -> persist one terminal or observation classification
```

The external side effect must never occur before `Dispatching` is durable.

After process loss, any operation still in `Dispatching` is treated as an unknown provider outcome. The next process observes the provider. It does not infer non-commit from the absence of a local receipt.

### Permitted transitions

```text
Planned
  -> Dispatching(N)

Dispatching(N)
  -> Accepted(receipt)
  -> ProvenNotCommitted(preDispatchProof)
  -> SatisfiedByObservation(observation)
  -> AbsentRetryable(observation)
  -> Pending(observation)
  -> Conflict(observation)
  -> Inconclusive(evidence)

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
```

A new observation may enrich `Accepted` or `SatisfiedByObservation` with metadata and byte evidence, but it does not erase the original receipt or trace.

### Forbidden transitions

```text
Dispatching(N) -> Dispatching(N + 1) without reconciliation
Pending -> Dispatching without proof of non-commit
Inconclusive -> automatic retry
Conflict -> automatic overwrite
Accepted -> repeated create because consumer evidence is missing
```

## Journal record shape

Illustrative durable shape:

```json
{
  "schemaVersion": "ts-release/journal/v1",
  "releaseId": "...",
  "bundleId": "...",
  "operations": {
    "operation-id": {
      "provider": "npmjs",
      "coordinate": {},
      "intent": {},
      "state": { "tag": "Dispatching", "attemptId": "..." },
      "attempts": [],
      "observations": [],
      "consumerEvidence": []
    }
  }
}
```

The journal stores canonical values and redacted provider-native evidence. It must not persist bearer tokens, private keys, temporary paths, or unbounded response bodies.

## Persistence requirements

A production journal needs:

- versioned canonical encoding;
- domain-separated record identity;
- atomic append or compare-and-swap transition;
- detection of torn or conflicting writes;
- one-writer lease or operation-level CAS for concurrent continuation;
- durable linkage to the finalized bundle;
- provider receipt and observation Schema versions;
- bounded evidence payloads with raw-fact fingerprints where necessary;
- explicit secret redaction; and
- an audit history that does not rewrite prior attempts.

The storage backend is a maintainer choice. These laws apply whether the first implementation uses local files, SQLite, an object store, or another durable service.

## Dependency and dispatch groups

A release is a graph of logical operations.

- An npm dist-tag operation depends on the intended version being satisfied.
- A GitHub asset depends on the release resource and tag policy.
- A Homebrew formula Git publication depends on finalized public download URLs and checksums.
- Consumer installation depends on provider acceptance and public visibility but is not itself a provider mutation.

A dispatch group records when one physical command can mutate several coordinates. Every child logical operation still has its own state.

If a grouped command returns success, the provider adapter maps the command receipt into provider-native receipt facts for each child it can prove. Any child not proved by the receipt remains subject to fresh observation.

## Worked trace 1: ordinary npm success

Desired outcome:

```text
Version: registry.npmjs.org / @scope/pkg / 1.2.3 / tarball integrity X
Tag:     registry.npmjs.org / @scope/pkg / latest -> 1.2.3
```

Journal:

```text
V = Planned(NpmVersionIntent)
T = Planned(NpmDistTagIntent), depends on V
```

The adapter elects one physical command:

```text
D1 = npm publish package.tgz --tag latest
```

Before execution:

```text
V -> Dispatching(V-attempt-1, dispatchId D1)
T -> Dispatching(T-attempt-1, dispatchId D1)
```

The command returns success and provider response facts:

```text
V -> Accepted(NpmVersionReceipt)
T -> Accepted(NpmDistTagReceipt)
```

A later metadata read can add:

```text
V metadata = Equivalent(name, version, integrity, shasum)
T metadata = Equivalent(latest -> 1.2.3)
```

Clean install remains a separate consumer result:

```text
C = NotObserved
```

If the process dies after the registry commits but before either receipt is stored, both remain `Dispatching(D1)`. Recovery reads package metadata once and classifies independently:

```text
V -> SatisfiedByObservation(version and bytes equivalent)
T -> SatisfiedByObservation(tag equivalent)
```

If the version is equivalent but `latest` points to `1.2.2`, V remains satisfied while T becomes `Conflict` or a separately authorized tag-correction operation. The package version is never republished.

## Worked trace 2: partial PyPI progress

Desired files:

```text
A = package-1.2.3.tar.gz
B = package-1.2.3-py3-none-any.whl
C = package-1.2.3-cp313-manylinux_x86_64.whl
```

Each filename is its own logical operation.

First run:

```text
A -> Dispatching(A1) -> Accepted(WarehouseUploadReceipt)
B -> Dispatching(B1) -> process loses response
C -> local credential validation fails before dispatch
```

Durable states:

```text
A = Accepted(receipt)
B = Dispatching(B1)
C = ProvenNotCommitted(preDispatchCredentialFailure)
```

Continuation:

1. Load the same finalized bundle.
2. Do not upload A.
3. Read the Warehouse Simple API for B.
4. If B is listed with the exact filename, size, and SHA-256, record `SatisfiedByObservation`.
5. If B is absent but indexing may still be delayed, record `AbsentRetryable` and observe under the bounded policy.
6. Repair credentials for C and create `C2` only because the prior failure proved no dispatch.

The parent PyPI publication is complete only when A, B, and C are satisfied. Partial success is normal state, not a rollback trigger.

## Worked trace 3: lost GitHub asset response

Prerequisites:

```text
Tag ref = satisfied
Release resource = Accepted(releaseId 42)
Asset = release 42 / effective stored name tool-linux-x64.tar.gz / digest X
```

Mutation:

```text
Asset -> Dispatching(A1)
POST upload bytes
connection disappears before response is recorded
```

Recovery:

1. List all assets for release 42, following pagination to a complete listing.
2. Apply the explicit requested-name to effective-stored-name rule.
3. Compare returned name, state, size, media type, and digest or downloaded bytes.

Outcomes:

```text
matching asset -> SatisfiedByObservation
same name, different bytes -> Conflict
asset in processing state -> Pending
complete authoritative absence after visibility policy -> ProvenNotCommitted
incomplete listing or unavailable digest/read -> Inconclusive or AbsentRetryable
```

Only `ProvenNotCommitted` permits A2. A response-loss timeout by itself does not.

## Worked trace 4: catalog Git publication

The finalized bundle contains the exact catalog target and managed-state bytes. Three outcomes are tracked separately:

```text
G = conditional Git ref publication
R = catalog rendering correctness
C = package-manager installation
```

Before mutation:

```text
G = Planned(expected predecessor SHA P, target tree digest X)
R = local structural evidence for the finalized catalog bytes
C = NotObserved
```

Dispatch:

```text
G -> Dispatching(G1)
create blobs/tree/commit
conditional ref update P -> Q
```

Normal success:

```text
G -> Accepted(GitRefReceipt(commit Q, ref, previous P))
```

If the response is lost, recovery reads the ref and exact managed paths:

```text
ref == Q and bytes equivalent -> SatisfiedByObservation
ref advanced to unrelated commit -> Conflict
ref remains P and no created commit can be authoritative for the ref update -> ProvenNotCommitted for the ref operation
read cannot establish the managed paths -> Inconclusive
```

Neither Git acceptance nor local rendering evidence is a package-manager installation result. C remains `NotObserved` until a clean Scoop, Homebrew, or other consumer resolves and installs the intended bytes.

Continuation never repeats a satisfied ref update merely because consumer testing has not run.

## Worked trace 5: unknown custom provider

A consumer package supplies a provider whose mutation endpoint returns a receipt on success but whose read API cannot query exact coordinates.

```text
O = Planned(custom coordinate K, intent digest X)
O -> Dispatching(O1)
provider may commit
process loses response
```

The provider's observe operation can report only an unscoped listing that is incomplete and has no digest.

```text
O -> Inconclusive({
  reason: "Provider cannot distinguish committed K from absent K after response loss",
  attempt: O1,
  availableFacts: ...
})
```

The core does not call O2 automatically. It presents:

- exact intent and finalized artifact digest;
- the lost attempt boundary;
- all available provider facts;
- provider-declared lack of authoritative absence; and
- maintainer actions such as supply external evidence, abandon, or explicitly authorize a risk-bearing retry.

An explicit risk-bearing retry is a new audited maintainer decision, not a normal automatic transition and not proof that duplicates are safe.

## Workflow and Activity relationship

Effect Workflow or Activity can later provide execution, timers, encoded engine state, and process resumption. They do not replace the release journal.

The journal remains authoritative because it provides:

- provider-local intent and coordinate identity;
- stable operation identity independent of Activity names;
- grouped physical dispatch records;
- provider receipts and fresh observations;
- proof of non-commit, pending, conflict, and inconclusive states;
- finalized bundle linkage; and
- consumer evidence.

The engine may execute a transition such as `observe operation O` or `dispatch attempt O2`. It must first read and CAS the journal state. Engine replay cannot infer a remote npm, Warehouse, GitHub, Git, or custom-provider commit whose response was lost.

## Default retry policy

The core default is:

```text
retry observation according to provider policy;
retry mutation only after ProvenNotCommitted;
never retry Conflict or Inconclusive automatically.
```

Provider-native idempotency keys and conditional writes improve the proof surface, but they do not remove the journal. The journal records which key or condition was used and what the provider later established.

## Consumer evidence

Consumer outcomes are attached to satisfied provider operations or the release as a whole:

```text
ObservedEquivalent
ObservedDifferent
ObservedFailure
NotObserved
```

Each carries an evidence environment. Missing consumer evidence never causes provider mutation replay.

## Correction and supersession

A correction creates a new canonical intent and therefore a new logical operation ID. The journal links it as superseding or correcting an earlier operation while preserving:

- the original intent;
- every attempt;
- receipt or conflicting observation;
- correction authority; and
- new provider-local coordinate or conditional baseline.

The old history is immutable.

## Genuine remaining choices

Maintainers still need to decide:

- journal storage backend and transaction model;
- operation-level lease duration and concurrent-run behavior;
- exact dispatch-group representation for composite provider commands;
- provider-specific observation budgets and when absence becomes authoritative;
- how a maintainer records an explicit risk-bearing retry after inconclusive evidence;
- journal retention, compaction, and secret-redaction policy;
- whether Workflow or Activity is included in the first delivery; and
- which consumer evidence is required before a release is called complete.

## Conclusions

1. Stable logical operations and individual attempts are different durable entities.
2. `Dispatching` is a write-ahead uncertainty boundary, not permission to retry.
3. Accepted receipts and equivalent observations are separate terminal evidence.
4. Proven non-commit is the normal gateway to another mutation attempt.
5. Absent-retryable, pending, conflict, and inconclusive are first-class states.
6. Partial provider progress is preserved per coordinate against the same finalized bundle.
7. Workflow or Activity may execute the model but cannot replace provider reconciliation.
8. The intended experience is continuation without rebuilding and without blind repetition.
