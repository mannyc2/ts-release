# Resumability, replay protection, and journal laws

Status: canonical replay/journal analysis for PR #19. Research only.

## User promise

A release is resumable when another authorized runner can load exact finalized inputs and durable progress, reuse completed work, continue per provider coordinate without blindly repeating a mutation, and terminate as satisfied, conflicting, pending, or irreducibly inconclusive with the minimum human decision required.

## Canonical authorities

```text
Bundle
  exact immutable content

ReleasePlan
  canonical provider-local Intents and dependency edges

Journal
  ordered historical events
```

Current status is a pure fold over the plan and journal. Materialized indexes are disposable and must be checked against the canonical history.

Consumer installation or execution results are not part of this journal. They are application/CI outcomes that may run after publication.

## Events

The minimal event families are:

```text
DispatchStarted
DispatchRejectedBeforeCommit
ReceiptAccepted
ObservationRecorded
RiskAccepted
PlanSuperseded
```

`ReplayAuthorized` is removed. Deterministic replay permission does not introduce a new external fact. The next `DispatchStarted` records which already-durable basis authorized that attempt.

`ConsumerEvidenceRecorded` is removed. Consumer tests do not affect mutation correctness or recovery.

## Logical Intent versus physical dispatch

Intent is canonical desired provider state. A physical request can act on one or more Intents.

One real external request receives one canonical `DispatchStarted` event:

```text
DispatchStarted {
  dispatchId,
  attempt,
  memberOperationIds,
  providerDefinitionId,
  providerBehaviorId,
  endpointIdentity,
  requestFingerprint,
  authorizationIdentity,
  replayProtection,
  replayBasis,
  startedAt
}
```

This avoids separate member events repeating shared request identity, authorization, timing, and replay protection.

A provider response can record one receipt with per-member results. Per-Intent status is derived from that receipt and later observations.

A single conditional Git ref update that publishes several Homebrew/Scoop files is one physical dispatch with one Git-ref Intent if the desired fact is the resulting tree/ref state. The individual rendered files remain artifacts, not peer remote operations.

## Mutation uncertainty boundary

An attempt begins only after core durably commits `DispatchStarted` and before transport may send.

Before that boundary, these failures create no attempt:

- request validation;
- artifact resolution;
- credential acquisition;
- local signing required to construct the request;
- inability to record the journal event.

After the boundary, a missing response is uncertain unless transport or provider evidence proves non-dispatch or non-commit.

## Three replay authorities

### 1. Proven unable to commit

Evidence proves the earlier request cannot commit now or later.

Examples:

- transport proves no bytes were sent;
- provider request status is terminal rejected with no mutation;
- conditional request was rejected before mutation;
- provider cancellation returns a terminal fenced state.

Observed absence alone is not this proof.

### 2. Provider-enforced replay protection

The exact historical prepared request carried a protection that makes exact replay safe even if the first request committed.

Examples:

- an unexpired, correctly scoped idempotency key;
- a compare-and-swap condition on an expected remote revision;
- a documented exact-duplicate-equals-success law for the same coordinate and content.

This authority is recorded before dispatch and interpreted later by core. Provider code does not recompute the verdict from old history.

### 3. Human risk acceptance

A maintainer explicitly accepts duplicate, conflict, charge, overwrite, or other risk. `RiskAccepted` is a real authorization fact and therefore remains an event.

The following `DispatchStarted` references that event as its replay basis.

## Replay-protection data algebra

The smallest currently evidenced algebra is:

```text
None

IdempotencyKey {
  schemeId,
  keyMaterial,
  scopeFingerprint,
  requestFingerprint,
  validFrom,
  expiresAt
}

CompareAndSwap {
  schemeId,
  coordinateFingerprint,
  expectedRevision,
  desiredRevision,
  requestFingerprint
}

ExactDuplicateAccepted {
  schemeId,
  coordinateFingerprint,
  contentFingerprint,
  requestFingerprint,
  expiresAt?
}
```

`RequestStatusToken` is not replay protection. It is a provider receipt or observation handle used to learn whether an earlier request committed, failed, or remains pending.

### Key material

Idempotency keys are often not authentication secrets, but the model must not assume they are public.

`keyMaterial` is either:

```text
PersistedValue
DurableSecretReference
```

If the exact key cannot be recovered on the fresh runner, automatic replay is unavailable.

Credentials themselves are reacquired. The journal persists non-secret authorization identity such as principal, account, tenant, project, and scopes so a replay cannot silently change authority domain.

## Request equivalence

A fresh runner prepares the candidate request before replay. Core requires:

1. matching provider definition and behavior identity;
2. matching endpoint and coordinate;
3. matching authorization identity/scope;
4. matching normalized request fingerprint;
5. matching protection key/condition and scope;
6. protection not expired;
7. no fresh evidence of satisfaction, conflict, or pending work;
8. successful compare-and-swap append of the new `DispatchStarted`.

If provider code renders different request bytes or semantic projection, automatic replay stops. It does not call provider code to reinterpret the old safety verdict.

For HTTP integrations, the strongest design is a core-dispatched immutable prepared request. For opaque custom Effects, exact-send correspondence remains a provider law; automatic replay should default off unless a core-supported prepared form is used.

## Provider evidence

### Idempotency keys with scope and expiry

Official examples show that an idempotency key is not sufficient without scope and time:

- Stripe API v1: same key within 24 hours; API v2: same API, same account/sandbox, within 30 days.
- AWS Cloud Control: client token expires after 36 hours.
- Google APIs commonly guarantee duplicate suppression for at least 60 minutes.

Sources:

- https://docs.stripe.com/api-v2-overview
- https://docs.aws.amazon.com/cloudcontrolapi/latest/APIReference/API_CreateResource.html
- https://docs.cloud.google.com/backup-disaster-recovery/docs/reference/rest/v1/projects.locations.serviceConfig/initialize

### Conditional Git update

`git push --force-with-lease=<ref>:<expect>` changes the ref only when its current value equals the expected value. Replaying the same expected-old to desired-new update cannot apply the mutation twice; after first success, the precondition fails or the ref is already desired.

Source:

- https://git-scm.com/docs/git-push

### npm immutable version

Immutability is not a replay key. An exact repeated publish can conflict, and the initial npm request can also establish a mutable dist-tag. After response loss, observation is preferred. No automatic replay follows merely from version immutability.

### Warehouse exact duplicate

Pinned Warehouse source returns HTTP 200 for the same filename and matching hashes, while the same filename with different content returns a conflict. This can support `ExactDuplicateAccepted` for the exact Warehouse implementation and request fingerprint.

Source:

- https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py

### GitHub release/assets

GitHub create/upload endpoints do not provide a general idempotency key. Lost-response recovery uses provider reads. Absence while the prior request may still be in flight is not permission to replay.

### Custom request-status provider

A returned request token plus an authoritative status endpoint can produce:

```text
committed
terminal non-commit
pending
unknown
```

AWS Cloud Control is an example: the mutation returns a `RequestToken`, and `GetResourceRequestStatus` observes it. This is reconciliation, not replay protection by itself.

Source:

- https://docs.aws.amazon.com/cloudcontrolapi/latest/APIReference/API_GetResourceRequestStatus.html

## Pure replay decision

```text
decideNextAttempt(plan, journal, newlyPreparedRequest, now)
```

returns one of:

```text
InitialAttempt
ReplayFromNonCommitProof
ReplayFromRecordedProtection
RequiresRiskAcceptance
ObserveOrWait
StopSatisfied
StopConflict
StopInconclusive
```

The decision is deterministic for identical durable history, time, and newly prepared request facts. Provider package version cannot change it because behavior identity and request fingerprint mismatches stop replay.

## Concurrent runners

Two runners can independently compute the same decision. Only one can append the next `DispatchStarted` because the journal write uses compare-and-swap against the same prior version.

This prevents cooperative duplicate continuation. It cannot fence a stale request already sent by an earlier runner.

## Cancellation

Cancellation prevents future local effects. It does not roll back accepted provider effects and cannot prove that an in-flight request stopped.

After cancellation:

- no `DispatchStarted`: safe to run later;
- `DispatchStarted` plus terminal non-commit proof: safe retry authority;
- `DispatchStarted` plus valid recorded protection: exact replay may be safe;
- otherwise: observe, wait, or stop inconclusive.

## Plan correction

Historical Intent and events are immutable. Correction creates a new plan revision or superseding Intent. It does not reinterpret a historical dispatch under new provider code.

## Removed concepts

- resume-time `ReplaySafetyCapability`;
- deterministic `ReplayAuthorized` event;
- `ConsumerEvidenceRecorded`;
- core durable acceptance-record structure.

Only `RiskAccepted` remains an explicit replay authorization event because it records a new human decision rather than repeating derived facts.
