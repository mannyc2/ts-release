# Effect architecture patterns for ts-release

Status: semantic pattern research. It does not select the root public API.

## Rule

Use `Context.Service` and Layers for replaceable dependencies. Introduce one shared service only when implementations satisfy one substitutability law.

## Shared laws that survived

### Provider definition resolution

A fresh application can resolve `(definitionId, intentSchemaVersion)` and decode a persisted Intent. This reconstructs durable type erasure; it is not a universal publication service.

### Core transports

`core.http/1` and `core.git/1` have a shared structural role: core constructs, fingerprints, freezes, and sends the exact prepared request after journal CAS. Provider packages contribute provider-local preparation inputs and response decoding, not a custom normalization contract.

### JournalStore

Two deployment surfaces genuinely need the same law:

```text
appendIfRevision(expectedRevision, completeEvent)
  -> Appended | RevisionMismatch
```

`LocalGenerationJournalStore` and `S3ConditionalJournalStore` may therefore be Layers for one narrow service. This is the only new shared abstraction forced by R1. It introduces no release mode, provider registry, or synchronized peer state.

## Closest analogy: Effect SQL

Effect SQL exposes common query/transaction operations because its backends satisfy those laws, while concrete packages retain backend-specific extensions. Transfer to ts-release:

- concrete provider clients and storage backends are services;
- application/runtime/test boundaries supply Layers;
- provider-native receipts, observations, and errors remain typed;
- common services stop exactly where the laws stop.

Release destinations are additive and their commit units differ, so there is no universal `Publisher`.

Primary source:

- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/sql/pg/src/PgClient.ts

## Removed pseudo-capabilities

- `ConsumerScenario`: application/CI policy, no provider substitutability law.
- durable acceptance records and `ConsumerEvidenceRecorded`: no mutation/recovery consumer.
- `ReplaySafetyCapability`: old replay safety cannot depend on newly installed provider code.
- `ReplayAuthorized`: deterministic projection, not a new fact.
- universal `Publisher`: destinations are not substitutes.
- universal `Builder`: concrete artifact tools have no demonstrated common operation law.

`RiskAccepted` remains because it records a new human decision.

## Provider definition versus provider services

```text
ProviderDefinition
  definitionId
  Intent Schema and version
  behaviorId
  operationId projection

provider-local services
  prepare
  observe
  correct
  configured client and credentials
```

The five definition fields are frozen as a law; exact TypeScript spelling remains for implementation. `prepare`, `observe`, and `correct` are optional services, not members of one mandatory lifecycle.

## Schema boundaries

Use Schema for persisted Intents, provider-native receipts/observations, journal events, bundle manifests, cross-process plans, and public typed errors.

Do not repeatedly decode trusted in-process values. Core transport prepared requests are immutable runtime values whose fingerprints and replay facts are persisted, not arbitrary provider projections.

## Scope and artifact ownership

Use Scope for temporary snapshots, staging, subprocesses, credential/config files, and materialized logical filenames. A scoped producer output must be adopted before scope close.

The immutable-content/bundle kernel stays an internal extraction-ready ts-release library in its own directory and imports nothing from planning or providers. It does not move into effect-build.

Concrete effect-build integrations may produce archives, wheels/sdists, system packages, Apple packages, signatures, and fully notarized/stapled artifacts. No universal Builder follows.

## Workflow/Activity

Workflow/Activity can host the same plan/journal semantics later but cannot redefine them or make an external provider exactly once. Activity retry remains unsafe without the same recorded provider protection.

Adoption is deferred until all six fixed distribution families are wire-complete. Any later engine remains behind `unstable` and must preserve:

- singular operation identity;
- frozen `DispatchStarted` evidence;
- core-owned transport correspondence;
- structured stops;
- `JournalStore` CAS semantics;
- provider-native receipts and observations.

## Effect version

The existing alignment probes remain informational. Planning against the exact published rc.109 family remains the current moderate-confidence direction, with no dependency migration in this research checkpoint.

Pins:

- rc.109: https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d
- current source research: https://github.com/Effect-TS/effect/tree/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6
- effect-build granular branch: https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13
