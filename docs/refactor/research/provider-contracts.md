# Provider boundaries and optional services

Status: canonical provider-extension analysis. Provider wire facts are in `provider-wire-models.md` and `provider-wire-github-catalogs.md`.

## Frozen provider-definition law

The durable definition has exactly five conceptual fields:

```text
definitionId
intentSchema
intentSchemaVersion
behaviorId
operationId(intent)
```

The two-runner compile probe asserts that exact field list. This document does not choose the production TypeScript spelling.

The fields establish these laws:

1. `definitionId` identifies the provider definition loaded by a fresh application.
2. `intentSchema` and `intentSchemaVersion` decode the canonical provider-local Intent.
3. `behaviorId` identifies the declared remote/request behavior used by automatic replay checks.
4. `operationId(intent)` projects one stable logical operation identity.

Provider identity recorded for dispatch additionally binds the application/source lockfile identity. In v1, behavior or lockfile drift blocks automatic replay. There is no automatic migration machinery.

## Optional provider-local services

A definition does not contain one mandatory lifecycle. A package may separately expose ordinary Effect services or operations for:

```text
prepare
observe
correct
```

Their laws differ:

- `prepare` is pure with respect to external mutation. It resolves one exact operation into a prepared dispatch.
- `observe` performs a fresh provider read and returns provider-native evidence.
- `correct` constructs a new Intent or plan supersession. It never rewrites historical facts.

A write-only provider may omit observation. An immutable provider may omit correction. Unsupported operations are absent, not encoded as fake no-op members.

## Prepared dispatch and transport ownership

Automatic replay is available only when request correspondence is structural.

### Core HTTP and Git transports

A provider using a supported core transport supplies provider-local input to the transport constructor. Core owns:

- canonical request/command construction;
- insertion of any supported derived idempotency key or condition;
- request fingerprinting;
- immutable prepared-request representation;
- the actual send operation.

The transport consumes only the prepared dispatch after the journal append succeeds. The provider cannot supply its own normalized request projection in v1.

### Opaque custom transport

A custom provider may dispatch through its own Effect, but core cannot prove that arbitrary executable code sends the recorded request. Such a provider remains valid and may observe or correct, but after an uncertain dispatch it has no automatic replay path. It stops `Inconclusive` unless authoritative observation, terminal non-commit evidence, or human `RiskAccepted` resolves the state.

The capability difference is visible in the imported transport, not in an author-implemented projection contract.

## Removed abstractions

### ConsumerScenario and durable acceptance records

Removed completely from provider definitions and the canonical mutation journal.

A clean install, import, download, or execution depends on product policy and environment. It may run after provider acceptance, after public visibility, or in another workflow. Its failure can fail CI without changing historical provider acceptance or authorizing replay.

| Outcome | Owner |
| --- | --- |
| provider accepted mutation | provider receipt |
| fresh metadata or byte observation | provider observation operation |
| package installs or executes in an environment | application/CI Effect |
| ts-release releases itself | maintained project end-to-end gate |
| reusable custom acceptance work | ordinary user-supplied Effect |

### ReplaySafetyCapability

Removed. Old dispatch safety is not executable provider policy on a new runner. Protection is frozen into `DispatchStarted` and interpreted by a versioned core algebra.

### Universal Publisher or Builder

Rejected. Destinations are additive and have different coordinates, commit units, receipts, observations, and correction laws. Artifact tools likewise retain concrete operations until a genuine shared law is demonstrated.

## Provider resolution is not admission

A fresh release application supplies definitions and Layers for all providers used by the persisted plan. Core performs heterogeneous lookup by definition ID and schema version. This is reconstruction of durable type erasure, not an allowlist or certification registry.

The resolver rejects:

- unknown definition IDs;
- unsupported Intent schema versions;
- duplicate definition identities;
- Intent bytes that do not reproduce canonical encoding;
- unavailable declared behavior/lockfile identity for automatic replay.

A newer provider may still perform read-only observation if the application explicitly supports decoding the old Intent. It may not automatically replay the old operation.

## Separate shared law: JournalStore

Research question R1 demonstrated one genuine storage abstraction:

```text
appendIfRevision(expectedRevision, completeEvent)
  -> Appended(newRevision) | RevisionMismatch(actualRevision)
```

Local generation files and S3 conditional writes satisfy the same safety law across different deployment surfaces. This `JournalStore` Layer is unrelated to provider interchangeability and adds no release mode or peer state representation. See `journal-backends.md`.

## Evidence

- `probes/two-runner/shape.ts` asserts the five-field definition and singular-operation dispatch shape.
- `probes/two-runner/probe.mjs` exercises separate fresh processes, strict V2 drift, structured stops, and CAS-before-send.
- `idempotency-material.md` establishes derived-key-only v1 replay material.
- `journal-backends.md` establishes the journal CAS law and required Layers.
