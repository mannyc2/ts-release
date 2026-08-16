# Fresh-runner continuation

Status: operational projection of `resumability.md`, `journal-backends.md`, and `idempotency-material.md`.

## Target

```text
new machine or process
no shared memory with the prior runner
durable bundle + plan + journal
credentials reacquired
release application/provider definitions loaded
no blind provider replay
```

## Required durable inputs

1. bundle locator, bundle ID, and finalized content digests;
2. canonical provider Intents and dependency edges;
3. provider definition ID and Intent schema version;
4. operation ID projection result;
5. ordered journal events and current revision;
6. journal resume locator;
7. provider behavior and lockfile identity recorded at dispatch;
8. non-secret replay protection facts.

No consumer-test output or plaintext idempotency key is required.

## Algorithm

1. Open the configured `JournalStore` from its resume locator.
2. Load and validate the plan, journal, and bundle binding.
3. Fold operation state from the plan and journal.
4. Load the release application and resolve provider definitions.
5. Decode and canonically re-encode each relevant Intent.
6. Run fresh observations where useful and supported.
7. Purely prepare a candidate request through `core.http/1` or `core.git/1`, or identify an opaque transport.
8. Compare definition, schema, operation, behavior, lockfile, endpoint, authorization, transport, fingerprints, protection scope, and expiry.
9. Derive the core replay/stop decision.
10. `appendIfRevision` the next `DispatchStarted`.
11. Send only when the append returns `Appended`.
12. Record receipt, terminal non-commit evidence, or observation through another CAS append.

## Installed-code divergence

```text
same recorded identity + same core-prepared request facts
  -> same core decision

behaviorId mismatch
or lockfile identity mismatch
or request fingerprint mismatch
or unknown replay scheme
or opaque transport
  -> structured non-automatic stop
```

Provider V2 cannot return a different replay verdict. Even when V2 prepares identical bytes, strict behavior/lockfile drift stops automatic replay in v1. The stop reports the equal fingerprint alongside the identity mismatch and constructs the exact `RiskAccepted` assertion.

No migration machinery exists in v1. Observation under newer code is an application responsibility; automatic mutation is not.

## Cooperative race

Suppose A and B load revision 41 and both derive the same automatic replay result:

```text
A appendIfRevision(41, DispatchStarted A) -> Appended(42)
B appendIfRevision(41, DispatchStarted B) -> RevisionMismatch(42)
A sends
B reloads and does not send
```

The two-process probe demonstrates one winner, one loser, one send, and one simulated external effect.

CAS does not fence a stale request sent by an earlier runner. Absence still does not prove that request cannot commit later.

## Journal backends

### Local generation store

Resume locator: durable journal directory. The plan under that root binds the bundle locator and digest.

Supported only on a documented local filesystem with the required link, synchronization, and crash-recovery semantics. Generic NFS, SMB, network home directories, and CI artifact mounts are not claimed.

### S3 conditional store

Resume locator: bucket plus journal prefix. The reachable head binds immutable event segments, plan, and bundle locator/digest.

The append algorithm uploads a complete immutable segment and conditionally replaces the head with `If-Match` against the observed ETag. A failed or ambiguous conditional write does not permit send; the runner reloads the head.

### SQLite

SQLite transactionally satisfies the local law and is covered by the race probe. It is not required in v1 because it does not add a deployment surface beyond the local generation store and is not a supported network-filesystem solution.

### CI artifacts plus external state

CI artifacts can carry immutable bundle bytes. They do not expose the mutable-head CAS needed by the journal. When paired with S3 conditional state, S3 remains the journal authority and artifacts remain transport.

## Retention and takeover

The journal, plan, and bundle must survive the configured recovery horizon. Object-store lifecycle policy and CI artifact retention must not silently expire required state.

A lease is optional for ownership display, throttling, or operator coordination. It cannot replace `appendIfRevision`, make an in-flight request absent, or authorize replay.

## Custom-provider ceilings

| Provider shape | Continuation after uncertain send |
| --- | --- |
| core transport + supported recorded protection | automatic exact replay may be available |
| authoritative request-status observation | observe committed, terminal non-commit, or pending |
| ordinary observation only | may establish satisfied/conflict; absence is not a fence |
| opaque write-only provider | `Inconclusive` or human `RiskAccepted` |
| unknown replay law | no automatic replay |
| behavior/lockfile drift | structured stop; no automatic migration |

This is capability-bounded resumability, not provider admission.

## Failure precision

Continuation can stop because the journal or bundle expired, the definition/schema is unavailable, provider identity drifted, protection expired, request-status retention expired, observation is no longer authoritative, or storage CAS is ambiguous. None permits rebuilding completed artifacts or blindly replaying mutation.
