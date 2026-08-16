# Resumability, frozen dispatch evidence, and journal laws

Status: canonical replay and journal analysis. Research only; no production API is selected here.

## User promise

A fresh authorized runner can load exact finalized inputs and durable progress, reuse completed work, continue without blindly repeating an external mutation, and stop with a precise satisfied, conflicting, pending, or irreducibly inconclusive result plus the minimum human decision required.

## Canonical authorities

```text
Bundle
  exact finalized immutable content

ReleasePlan
  provider-local Intents and dependency edges

Journal
  one ordered event history
```

Current state is a pure fold over plan and journal. Materialized indexes are disposable. Consumer install/execute results are application/CI outcomes and are not journal facts.

## Event vocabulary

```text
DispatchStarted
DispatchRejectedBeforeCommit
ReceiptAccepted
ObservationRecorded
RiskAccepted
PlanSuperseded
```

Removed:

- `ReplayAuthorized`: deterministic replay permission adds no new fact;
- `ConsumerEvidenceRecorded`: consumer results do not affect mutation recovery;
- durable acceptance records;
- resume-time `ReplaySafetyCapability`.

`RiskAccepted` remains because it records a new human authorization.

## One operation, one physical dispatch

`operationId` names one logical provider operation. One external request receives one canonical event:

```text
DispatchStarted {
  type,
  dispatchId,
  attempt,
  operationId,
  providerDefinitionId,
  providerBehaviorId,
  providerLockfileIdentity,
  transportId,
  endpointIdentity,
  requestFingerprint,
  authorizationIdentity,
  replayProtection,
  replayBasis,
  startedAt
}
```

`memberOperationIds` is removed. No second provider currently justifies a one-request-many-operations model.

npm's initial publish is one operation because one PUT co-requests the immutable version/tarball and mutable initial dist-tag. Its composite receipt and later observation expose both remote facets. A later dist-tag move is a separate operation.

GitHub release creation and each asset upload are separate wire requests and therefore separate operations. A conditional Git ref update may publish many rendered files, but the operation is the one desired ref/tree transition.

## Mutation uncertainty boundary

Preparation must finish before journal append and must not mutate the provider. A runner may send only after `appendIfRevision` durably commits `DispatchStarted`.

Failures before that append create no attempt. After send may have begun, a missing response is uncertain unless transport or authoritative provider evidence proves non-dispatch or terminal non-commit.

## Replay authorities

A later attempt is lawful only through one of three facts:

1. no earlier `DispatchStarted` exists;
2. the earlier request is proven unable to commit now or later;
3. the exact earlier prepared request carried an unexpired core-supported protection; or
4. a maintainer recorded `RiskAccepted`.

Observed absence is never a fence for an earlier in-flight request. Request-status evidence is reconciliation, not replay protection.

## Append-only replay protection IDs

The v1 algebra is intentionally closed and versioned by meaning:

```text
replay.none/1

replay.idempotency-key/1 {
  originDispatchId,
  baseRequestFingerprint,
  keyFingerprint,
  scopeFingerprint,
  requestFingerprint,
  validFrom,
  expiresAt
}

replay.cas/1 {
  coordinateFingerprint,
  expectedRevision,
  desiredRevision,
  requestFingerprint
}

replay.exact-duplicate/1 {
  coordinateFingerprint,
  contentFingerprint,
  requestFingerprint,
  expiresAt?
}
```

An unknown identifier or later major version never receives automatic replay. Existing event meaning is immutable; semantic change requires a new ID.

## Derived idempotency keys; no secret references

No fixed vNext provider requires secret durable replay material. v1 therefore contains neither plaintext key material nor a secret-manager-reference union.

For a supported core HTTP transport:

```text
baseRequestFingerprint = fingerprint(
  exact prepared request before the derived idempotency field,
  excluding reacquired authentication bytes
)

key = Encode(SHA-256(
  "ts-release/replay.idempotency-key/1" ||
  originDispatchId ||
  baseRequestFingerprint
))

requestFingerprint = fingerprint(
  exact immutable request after key insertion
)
```

The journal stores the key fingerprint, never the key value. A fresh runner derives the same key and verifies both fingerprints. Scope and expiry remain mandatory.

See `idempotency-material.md`.

## Core-owned transport rule

Automatic replay is structural, not an author assertion.

- `core.http/1` owns canonical request construction, derived key insertion, fingerprinting, immutability, and send.
- `core.git/1` owns the exact conditional update projection and send.
- `provider.opaque/1` may perform initial dispatch and observation but never receives automatic replay in v1.

There is no provider-supplied normalized projection contract.

## Strict request equivalence

Before automatic replay, core compares:

1. definition ID;
2. Intent schema version and canonical Intent/operation ID;
3. behavior ID;
4. provider/application lockfile identity;
5. core transport ID;
6. endpoint/coordinate identity;
7. non-secret authorization principal/account/tenant/scope;
8. base and final request fingerprints as applicable;
9. replay scheme, condition/key fingerprint, and scope;
10. validity interval;
11. fresh evidence of satisfaction, conflict, or pending work;
12. journal revision.

Any behavior or lockfile mismatch blocks automatic replay even when request bytes are equal. No bytes-sufficient relaxation exists in v1.

## Structured non-automatic verdict

Every stop reports:

```text
ReplayStopExplanation {
  code,
  comparisons: [
    { fact, recorded, candidate, result, consequence }
  ],
  riskAcceptance: {
    priorDispatchId,
    operationId,
    candidateRequestFingerprint,
    acceptedRisks,
    exactAssertion
  }
}
```

A bare `false`, generic refusal, or unstructured incompatibility error is a defect. The explanation shape is designed so a future bytes-sufficient relaxation could loosen the decision without changing historical events.

## Pure decision path

```text
decideNextAttempt(plan, journal, preparedRequest, now)
```

returns one of:

```text
InitialAttempt
ReplayFromNonCommitProof
ReplayFromRecordedProtection
RequiresRiskAcceptance(explanation)
ObserveOrWait(explanation)
StopSatisfied
StopConflict
StopInconclusive(explanation)
```

For identical durable history, time, and re-prepared core request facts, two runners derive the same result. Installed provider code cannot reinterpret old safety evidence; drift appears as a comparison mismatch.

## Journal compare-and-swap

All backends satisfy one law:

```text
appendIfRevision(expectedRevision, completeEvent)
  -> Appended(newRevision) | RevisionMismatch(actualRevision)
```

Only `Appended` permits send. Two runners may compute the same replay result, but only one can append the next dispatch event.

R1 established two required v1 Layers:

```text
LocalGenerationJournalStore
S3ConditionalJournalStore
```

The first uses prewritten, synchronized generation files atomically installed at a unique revision path. The second uses immutable event segments plus an S3 head-object `If-Match` conditional write. SQLite is a valid local alternative but is not a second required v1 implementation. CI artifacts transport immutable bundles; without external conditional state they are not a journal authority.

See `journal-backends.md` and `probes/journal-backends/`.

## Provider evidence consequences

- npm immutability aids observation but does not authorize replay.
- pinned Warehouse exact-duplicate behavior can satisfy `replay.exact-duplicate/1` for equivalent filename/content/request facts.
- explicit Git expected-old to desired-new update satisfies `replay.cas/1`.
- GitHub release and asset creation expose no general idempotency key; lost responses use observation and may remain inconclusive.
- an authoritative request-status endpoint may prove committed, terminal non-commit, or pending, but the token itself is not replay protection.

## Cancellation, takeover, and correction

A lease may improve liveness or diagnostics but is not the safety authority and cannot fence a stale provider request. CAS selects one cooperative continuation.

Historical Intent and events are immutable. Correction creates a new operation/plan revision and may append `PlanSuperseded`. New provider code never reinterprets the old request as the new operation.
