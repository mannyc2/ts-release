# Resumability, replay protection, and journal laws

Status: canonical replay/journal authority for the v1 implementation. This
revision closes the first-slice replay policy while keeping future
non-structural protocol bindings outside the kernel.

## User promise

A release is resumable when another authorized runner can load exact finalized
inputs and durable progress, reuse completed work, continue per provider
coordinate without blindly repeating a mutation, and stop with a precise
satisfied, conflict, pending, or irreducibly inconclusive explanation.

## Canonical authorities

```text
Bundle
  exact immutable content

ReleasePlan
  canonical provider-local Intents and dependency edges

Journal
  ordered historical events
```

Materialized indexes are disposable folds. Consumer install or execution output
is application/CI evidence, not mutation-journal state.

## Core-derived operation identity

A provider-controlled `operationId(intent)` is not required.

```text
operationId = hashCanonical(
  "ts-release/operation/1",
  {
    providerDefinitionId,
    intentSchemaVersion,
    canonicalIntent
  }
)

operationKey = { planId, operationId }
```

The plan-scoped key binds bundle-relative references without copying the whole
plan identity into the provider-local operation digest. Core encodes the
Schema output as strict canonical JSON and uses domain-separated,
length-prefixed SHA-256 framing. Codec versions and golden vectors are
append-only. Neither identity is projected by installed provider code.

## Minimal event families

```text
DispatchStarted
DispatchRejectedBeforeCommit
ReceiptAccepted
ObservationRecorded
RiskAccepted
PlanSuperseded
```

`ReplayAuthorized` remains removed because a deterministic replay verdict is a
projection, not a new external fact. `ConsumerEvidenceRecorded` remains
removed.

## DispatchStarted candidate

```text
DispatchStarted {
  dispatchId,
  attempt,
  operationId,
  providerDefinitionId,
  transportId,
  endpointIdentity,
  requestFingerprint,
  authorizationIdentity,
  replayProtection,
  replayBasis,
  implementationProvenance?,
  startedAt
}
```

`implementationProvenance` may contain package/source/lockfile facts for audit.
It is not a replay gate under the current recommendation.

The original probe-selected fields remain exercised in the fixture. The probe
no longer claims that its list is exact or minimal.

## Mutation uncertainty boundary

An attempt begins only after `DispatchStarted` is durably appended and before a
core transport may send.

Before that boundary these failures create no attempt:

- request validation;
- artifact resolution;
- credential acquisition;
- local signing needed to construct the request; and
- inability to append the journal event.

After the boundary, a missing response is uncertain unless transport or
provider evidence proves non-dispatch or non-commit.

## Four ways a later attempt can be lawful

The prior document incorrectly said "three facts" while listing four cases.
The complete set is:

1. no earlier `DispatchStarted` exists;
2. the earlier attempt is proven unable to commit now or later;
3. exact replay is authorized by recorded, trusted provider-enforced
   protection; or
4. a maintainer records `RiskAccepted`.

Observed absence is never proof of case 2.

## Request correspondence versus remote replay law

### Correspondence evidence

A core-owned immutable transport can prove:

- what request was recorded;
- what request crossed the transport boundary;
- whether a newly prepared request has the same fingerprint;
- endpoint and non-secret authorization identity; and
- the replay key or conditional values actually placed on the request.

### Remote-law evidence

Correspondence does not prove that the remote service honors the key,
condition, scope, expiry, or exact-duplicate behavior.

Examples:

- an arbitrary server may ignore an `Idempotency-Key` header;
- Warehouse exact-duplicate behavior is a Warehouse law, not an HTTP law;
- Git compare-and-swap is a Git remote-ref law;
- a duplicate npm version may conflict rather than return equivalent success.

Therefore a recorded scheme has two parts:

```text
request protection facts
trusted protocol-law authority
```

The first is structural journal evidence. The second remains provider-specific.
For v1, automatic replay is enabled only for structurally evidenced core
compare-and-swap requests. No provider-authored assertion, allowlist, behavior
ID, or resume-time capability may supply a non-structural authority.

## Replay-protection data algebra

The accepted vocabulary remains:

```text
replay.none/1
replay.idempotency-key/1
replay.cas/1
replay.exact-duplicate/1
```

Unknown versions never replay automatically. Scheme identifiers are append-only
and old events are never reinterpreted.

This algebra records facts; it does not, by itself, prove a provider law.

## Implementation identity alternatives

### Strict implementation blocking

Block when provider behavior or whole-lockfile identity differs, even when the
immutable request and protection facts match.

Benefit: maximally conservative.

Costs:

- unrelated dependency changes can disable safe continuation;
- a lockfile proves dependency identity, not remote semantics;
- provider source can change without a lockfile change; and
- manually maintained behavior IDs can be stale.

### Wire-sufficient replay

For a core-owned transport, authorize based on:

```text
same operation ID
same endpoint
same authorization identity/scope
same immutable request fingerprint
same replay-protection facts
protection unexpired
trusted remote replay law
successful journal CAS
```

No concrete fixed-provider counterexample was found in which these facts match
but local code drift alone makes sending unsafe. Response decoding and
observation compatibility remain separate concerns.

Production decision: use wire-sufficient replay only for the core-owned
compare-and-swap law and keep implementation identity as diagnostics/provenance.
Opaque provider Effects and npm response-loss cases do not auto-replay.

## Pure decision path

```text
decideNextAttempt(plan, journal, preparedRequest, now)
```

returns:

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

Installed code can change whether it successfully reconstructs the historical
request. If the fingerprint changes, replay stops. If the exact request and
protection facts match, package or lockfile drift alone does not change the
recommended decision.

## Concurrent runners

Two runners may derive the same decision. Only one may append the next
`DispatchStarted` through `JournalStore.appendIfRevision`. The loser reloads and
must not send.

This is cooperative dispatch fencing. It cannot stop an earlier request already
in flight at the provider.

## Cancellation and correction

Cancellation prevents future local effects; it cannot roll back or fence a
provider request already sent.

Historical Intents and events remain immutable. Correction creates a new plan
revision or superseding Intent. New code never rewrites a historical request.

## Provisional extension seam

A future application may bind a versioned non-structural protocol law before
dispatch and persist that selection with the request facts. That seam is not
part of the v1 kernel. It must not become a hidden provider allowlist, a weak
provider-authored assertion, or a capability queried during resume.
