# Resumability, physical dispatch, and retry authority

Status: research and design checkpoint. This document compares durable-history and execution mechanisms. It does not implement a journal, Workflow, Activity, or provider mutation.

## Fixed product promise under investigation

> A release is resumable when, after the original process or runner disappears at any point, another authorized runner can continue the same logical release from durable progress and exact finalized inputs, without rebuilding completed artifacts, losing completed work, or blindly repeating an externally visible mutation. It either converges to the intended terminal state or stops with a precise conflict or unknown-state report and the minimum human decision required.

The fixed shipping provider scope is npm, PyPI/Warehouse, GitHub Releases/assets, Homebrew formulas, Scoop, and arbitrary custom providers.

## 1. Canonical desired state

The canonical release plan stores each desired provider-local fact once as an Intent.

```text
ReleasePlan = {
  schemaVersion,
  bundleId,
  intents,
  dependencyEdges
}
```

A provider Intent contains the provider definition identity, endpoint/namespace, provider-local coordinate or parent references, desired metadata, mutation conditions, and bundle-relative artifact references.

```text
IntentId = hashCanonical(
  "ts-release/provider-intent/v1",
  canonicalEncodedIntent
)
```

When an Intent contains bundle-relative artifact references, its globally unambiguous operation key is `(planId, IntentId)`. The Intent does not repeat artifact size or digest merely to make the hash change; the canonical plan binds the Intent to one bundle.

There is no serialized `LogicalOperation` peer that repeats Intent fields.

## 2. Canonical history, not peer state tables

The journal is one ordered event history. State, attempts, receipts, observations, and evidence indexes are derived folds.

Possible event vocabulary, illustrative only:

```text
DispatchStarted
DispatchRejectedBeforeCommit
DispatchReturned
ObservationRecorded
ReplayAuthorized
ConsumerEvidenceRecorded
PlanSuperseded
```

A storage backend may materialize indexes, but it must recompute and validate them from the plan and events.

## 3. Logical Intent versus physical dispatch

A provider Intent is desired state. A physical dispatch is a historical fact: one request, command, transaction, or conditional ref update crossed a mutation boundary.

One physical dispatch can affect:

- one Intent;
- several Intents, if the provider operation genuinely co-establishes them; or
- one composite Intent with several observable facets.

The representation should not force one of these provider-specific facts into the others.

## 4. Physical-dispatch alternatives

### Alternative D1: one canonical dispatch event with all member attempts

```text
DispatchStarted = {
  dispatchId,
  members: NonEmptyArray<{ planId, intentId, attemptId }>,
  requestFingerprint,
  authorizationIdentity,
  providerIdempotencyKeyOrCondition,
  startedAt
}
```

The event is appended atomically before the external call.

**Laws:**

- one external request has one durable start time;
- authorization identity, replay key, condition, and request fingerprint have one canonical representation;
- every affected Intent points to the same physical boundary; and
- crash recovery cannot see only half of a grouped dispatch.

**Per-Intent progress:** later provider-specific receipt/observation interpretation can satisfy, conflict, or leave individual member Intents unresolved.

**Counterexample risk:** if grouping is used merely because an implementation happened to batch unrelated operations, it can hide independent provider commit units.

### Alternative D2: separate member events appended transactionally

```text
DispatchStarted(intent A, dispatchId D)
DispatchStarted(intent B, dispatchId D)
```

The journal backend must append all member events in one atomic transaction.

**Strength:** every Intent history is locally complete.

**Weaknesses:**

- shared authorization, time, request identity, and replay condition must be repeated or moved into another peer record;
- partial transaction visibility is catastrophic if the backend does not provide exact atomicity; and
- a returned physical response has no single canonical parent unless another dispatch record is introduced.

**Conclusion:** weaker than D1 for a genuinely grouped request.

### Alternative D3: provider-specific grouping outside the journal

The provider writes one generic `DispatchStarted` per Intent or none, while its internal code batches requests.

**Strength:** generic journal remains simple.

**Counterexample:** after process loss, the durable history cannot prove which Intents shared one in-flight request, one credential, or one idempotency key. Recovery can authorize conflicting replays.

**Conclusion:** rejected for mutation grouping.

### Alternative D4: make every physical provider mutation one composite Intent

Examples:

- initial npm publish contains version bytes and initial tag;
- one Git ref update contains all managed formula/Scoop paths.

**Strength:** no multi-member dispatch is needed when provider desired state naturally matches one physical atomic operation.

**Counterexample:** a general batch endpoint may accept or fail members independently. One composite Intent would erase partial success.

**Conclusion:** preferred when the provider mutation is one authoritative commit unit, but not universal.

## 5. Recommended dispatch representation

Use both rules:

1. Define Intent granularity around provider desired-state and commit laws, not convenience batching.
2. Record one canonical `DispatchStarted` event for every physical mutation boundary, with a nonempty member set only when several Intents genuinely share that request.

This is a provisional recommendation with high confidence.

The dispatch event is not another desired operation model. It is historical evidence. It contains only facts not recoverable from the plan:

- dispatch identity;
- member attempt references;
- non-secret authorization identity;
- provider idempotency key or conditional baseline actually used;
- request fingerprint;
- start time; and
- transport boundary identity.

The request body remains derivable from canonical Intent(s) and finalized artifacts. The event should not copy the entire request as another authority.

## 6. npm physical behavior

Pinned npm source:

- [`libnpmpublish/lib/publish.js`](https://github.com/npm/cli/blob/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862/workspaces/libnpmpublish/lib/publish.js)
- [`npm publish`](https://github.com/npm/cli/blob/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862/lib/commands/publish.js)

Normal npmjs publication sends one package document containing:

```text
versions[version]
dist-tags[tag] = version
attachment bytes and integrity
```

Therefore:

- the initial tag is not a prerequisite request that must happen after version publication;
- version bytes and initial tag are co-requested in one physical PUT;
- they remain independently observable because the version is immutable and the tag is mutable later; and
- pinned source does not prove that npmjs partially commits version and initial tag within that PUT.

Strongest current model:

```text
NpmPublishIntent {
  immutable version and tarball facts,
  initial tag desired by the same PUT
}
```

Later tag movement uses a separate `NpmDistTagIntent`.

An alternate two-Intent model remains possible if the product strongly values independent derived states, but it must represent one physical dispatch and one provider response canonically.

## 7. Three independent retry authorities

A later dispatch is authorized by one of three different facts.

### 7.1 Earlier request proven unable to commit later

```text
ProvenUnableToCommit
```

Examples:

- local validation failed before the transport boundary;
- credential acquisition failed before the transport boundary;
- transport proves no request bytes were dispatched;
- provider returned a definitive synchronous rejection that cannot later complete; or
- provider request-status API proves terminal failure and no pending job.

This is the strongest retry basis.

### 7.2 Repeating the request is provider-proven safe

```text
ProviderReplaySafe
```

Examples:

- provider-enforced idempotency key returns the original result for the same canonical request;
- compare-and-swap or conditional create makes duplicate or stale application impossible;
- a provider documents and tests that exact duplicate content at the same immutable coordinate is a no-op or returns equivalent success; or
- request identity can be queried authoritatively.

This basis can authorize replay even when the earlier request may have committed.

Important counterexamples:

- immutable coordinate alone may only turn replay into conflict; it does not prove equivalent success;
- an idempotency key that includes attempt number intentionally disables deduplication across attempts;
- a local UUID is not an idempotency key unless the provider enforces it;
- a read showing current absence does not prevent an earlier request from committing later.

### 7.3 Operator explicitly accepts risk

```text
RiskAccepted
```

The operator may authorize another dispatch despite irreducible uncertainty. The event must record:

- exact prior attempt;
- exact duplicate/conflict risk;
- provider and coordinate;
- maintainer identity;
- reason; and
- authorization time.

This is not normal retry and must be visible in reports and self-release evidence.

## 8. Replay decision law

```text
another dispatch is lawful when:

  no prior DispatchStarted exists
  OR ProvenUnableToCommit
  OR ProviderReplaySafe
  OR explicit RiskAccepted
```

The earlier rule "retry only after ProvenNotCommitted" was too narrow. It excluded provider-enforced replay safety.

The core must not infer replay safety from generic provider categories. The provider capability supplies the law and evidence; the journal records which law authorized the dispatch.

## 9. Absence, visibility, and polling budgets

### Observation of absence cannot fence an in-flight request

After `DispatchStarted`, a fresh read showing absence means only:

```text
not observed at read time
```

It does not prove:

```text
the earlier request cannot commit later
```

This remains true after many polls unless the provider contract establishes a terminal request-status or fencing mechanism.

### What a visibility budget proves

A bounded budget can prove:

- how long and how often the system looked;
- which endpoints and credentials were used;
- that the coordinate was not observed within that policy; and
- that automatic waiting is exhausted.

It cannot prove non-commit merely by expiring.

### State transition

After response loss:

```text
fresh absence during plausible propagation
  -> AbsentRetryable

budget exhausted without fencing evidence
  -> Inconclusive
```

`ProvenUnableToCommit` requires stronger evidence than elapsed time.

## Continued research

The remaining sections continue in [fresh-runner-resumability.md](./fresh-runner-resumability.md).
