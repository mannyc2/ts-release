# Decision packet details and source index

Status: evidence and tradeoff supplement to `decision-packet.md`. It does not own a peer scope list, event model, or provider contract.

## Two-runner probe

The disposable probe under `probes/two-runner/` runs runner A and runner B as separate Node processes. Durable JSON is their only shared state.

### Field list discriminated

The compile assertion uses exactly:

```text
ProviderDefinition
  definitionId
  intentSchema
  intentSchemaVersion
  behaviorId
  operationId

DispatchStarted
  one operationId
  no memberOperationIds
```

### Runtime traces

- runner A records `DispatchStarted` and stops before send; runner B re-prepares and continues;
- runner A commits one simulated remote effect and loses the response; runner B sends the same derived key and receives the original result;
- the durable plan/journal contains the key fingerprint but not plaintext key material;
- provider V2 produces the same request fingerprint but a different behavior/lockfile identity and receives `provider-identity-drift`;
- unknown replay scheme and opaque transport stop;
- two fresh runners race at the same journal revision: one appends, one loses, one sends.

The V2 stop contains every comparison and the exact assertion a later `RiskAccepted` would make. This demonstrates that equal bytes do not silently relax strict identity.

## Frozen definition and transport consequences

The probe supports the five-field law but does not choose production generics, classes, tags, or constructor spelling.

Automatic replay requires a core-owned prepared transport. There is no `NormalizedRequestProjection` method for provider authors. The structural distinction is:

```text
imports core HTTP/Git transport
  -> eligible for supported automatic replay schemes

dispatches arbitrary provider Effect
  -> initial dispatch and observation only
```

This removes one subtly unsafe extension contract rather than adding an admission mechanism.

## Structured stop explanation

Every blocked automatic replay reports:

- the decision code;
- all recorded and candidate facts examined;
- match, mismatch, unsupported, or expired result;
- the consequence of each result;
- prior dispatch and operation;
- candidate request fingerprint;
- accepted duplicate/conflict/overwrite/provider-drift risks;
- the exact first-person authorization assertion.

The shape is intentionally more detailed than the strict v1 rule needs. A future relaxation that permits equal core-prepared bytes across behavior drift could change only the decision rule and preserve the same recorded evidence and explanation format.

## R1: journal mechanism findings

Canonical note: `journal-backends.md`.

### Local filesystem

A direct `O_EXCL` event-file open provides exclusive creation but exposes an incomplete-file crash window. The selected local algorithm prewrites and synchronizes a complete candidate, then atomically hard-links it to the unique next-generation path. Existing destination means revision mismatch. The backend is supported only on documented local filesystems; generic NFS/SMB/network mounts are excluded.

Sources:

- https://www.man7.org/linux/man-pages/man2/open.2.html
- https://man7.org/linux/man-pages/man2/link.2.html
- https://www.man7.org/linux/man-pages/man3/fsync.3p.html

### SQLite

`BEGIN IMMEDIATE` plus a conditional head update and event insert gives one writer/transaction winner. SQLite is a valid local implementation, but its own documentation warns against depending on network-filesystem locking. It does not add a deployment surface beyond the local generation store, so it is not required in v1.

Sources:

- https://www.sqlite.org/lang_transaction.html
- https://www.sqlite.org/rescode.html
- https://www.sqlite.org/lockingv3.html

### S3 conditional object store

The algorithm uploads a complete immutable event segment, reads the current head/ETag, and conditionally replaces the small head object with `If-Match`. The first matching write wins; stale writes receive precondition failure. Strong read-after-write consistency allows a fresh runner to reload the current head.

Sources:

- https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html

### CI artifacts plus external state

Modern GitHub Actions artifacts are immutable uploads and have bounded retention. Two runners can both upload artifacts, so artifact creation does not select the dispatch winner. When paired with S3 conditional state, S3 is the journal and the artifact is bundle transport.

Sources:

- https://github.com/actions/upload-artifact
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository

### Executable race result

`probes/journal-backends/probe.mjs` launches two processes for each candidate:

```text
filesystem:                    winners=1 losers=1 finalRevision=2
SQLite:                        winners=1 losers=1 finalRevision=2
conditional object double:     winners=1 losers=1 finalRevision=2
CI artifact uploads:           uploads=2
external conditional state:    winners=1 losers=1 finalRevision=2
```

The object service is a protocol double; official S3 documentation is the authority for live service semantics.

## R2: idempotency material findings

Canonical note: `idempotency-material.md`.

### Fixed provider set

- npm's pinned client exposes no documented idempotency-key input;
- Warehouse exact-duplicate protection uses filename/content hashes;
- GitHub release and asset endpoints expose no general idempotency key;
- conditional Git uses expected/desired object IDs;
- custom core HTTP keys are client-derived;
- opaque custom providers receive no automatic replay.

No case requires a server-generated secret replay capability.

### Derived-key record

```text
replay.idempotency-key/1 {
  originDispatchId,
  baseRequestFingerprint,
  keyFingerprint,
  scopeFingerprint,
  requestFingerprint,
  validFrom,
  expiresAt
}
```

The key value is recomputed by core and never persisted. Authentication secrets are reacquired separately. A future first-party provider that proves a secret capability requirement must introduce a new scheme and durable-secret design at that time.

## npm operation decision

Pinned npm code sends one document with version metadata, attachment, and initial dist-tag. Therefore:

- one `NpmPublishOperation`;
- one `DispatchStarted.operationId`;
- one composite receipt with version and tag facets;
- later observation reports both facets;
- later tag movement is a new operation.

This removes the previously speculative member-operation model.

## Apple finalization decision

`effect-build-apple` owns the notary submission identifier and all status recovery. Stapling and verification occur before the artifact becomes finalized. ts-release adopts only the final bytes, so no Apple event enters the distribution journal and no pre-finalization bundle state is introduced.

## Scope decision

The canonical count is 16/3/6:

- 16 vNext acceptance families;
- 3 AI-native architecture proofs only;
- 6 deferred destination packages.

The later OpenAI handoff is a pure directory validator. It is never a provider, receipt, or publication operation.

## Standing model-expansion check

This pass forces exactly one new shared interface: `JournalStore`, because two backends satisfy one append-if-revision law and both deployment surfaces are required.

It does not force:

- a release mode;
- a provider capability registry;
- a member-operation union;
- a synchronized peer state table;
- a custom request-projection contract;
- a secret-reference union;
- a pre-finalization ts-release journal.
