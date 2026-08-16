# Effect architecture patterns for ts-release

Status: semantic pattern research. It does not select the root API.

## Principle

Use `Context.Service` and Layers for concrete replaceable dependencies. Introduce a common service only when implementations are substitutable under one law.

## Closest analogy: Effect SQL

Effect SQL provides a common `SqlClient` because PostgreSQL, SQLite, MySQL, and other backends support a shared query/transaction vocabulary. Backend packages can extend that interface with operations such as PostgreSQL LISTEN/NOTIFY.

Transfer to ts-release:

- provider clients are concrete services;
- provider packages expose `make`, `layer`, and `layerConfig` where useful;
- application/runtime/test boundaries supply Layers;
- provider-specific operations and errors remain in the provider package;
- a shared interface should include only a proved common law.

Where the analogy stops:

- release destinations are additive, not alternatives;
- commit units differ;
- receipts and conflict laws differ;
- there is no universal publish query/transaction language.

Primary source:

- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/sql/pg/src/PgClient.ts

## Effect AI normalization

Effect AI demonstrates a genuine common `LanguageModel` service. Provider adapters normalize many failures into shared `AiError` reasons while retaining namespaced provider metadata.

Benefit:

- callers can handle common transport, authentication, rate-limit, and output failures uniformly.

Cost:

- provider-native distinctions can be erased or moved into generic metadata.

ts-release durable receipts, observations, conflict facts, and replay protection are authority-bearing. They should remain provider-native. A normalized report can be derived for the CLI, but it should not replace canonical provider evidence.

Sources:

- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/ai/openai/src/OpenAiLanguageModel.ts
- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/AiError.ts

## effect-build

effect-build's provider definitions share a compile-executable operation shape with provider-correlated options, targets, stages, and artifacts. That is a lawful common operation.

Its granular branch also exposes concrete lower-level operations:

- scoped JavaScript-bundle production;
- executable publication to a caller-selected final path.

Transfer:

- concrete integrations can share low-level ownership and process infrastructure;
- not every integration must be projected into one root service;
- provider packages can add richer provider-specific operations.

False analogy:

- the existence of a compiler provider definition does not imply a publisher provider definition;
- uv, Poetry, nFPM, and Apple packaging do not automatically implement one universal `Builder`.

Sources:

- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Provider.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts

## Removed pseudo-capabilities

### ConsumerScenario

No substitutability law was found. Consumer install/execute checks are application policy or CI tests.

### ReplaySafetyCapability

Replay safety for an old dispatch must not vary with newly installed provider code. Protection is recorded when the request is prepared, then interpreted by core.

### Universal Publisher

Destinations are additive and have different inputs, commit units, receipts, and errors.

## Provider definition versus service

Provider definition:

```text
durable decoding and behavior identity
```

Concrete provider service:

```text
configured client, credentials, transport, rate limiting, observation
```

These should not be conflated.

A custom provider can be ordinary TypeScript plus a Layer without a central allowlist. Durable resumption adds a stable definition ID, schema version, and behavior ID so the same application can decode persisted Intent on a fresh runner.

## Schema and boundary rules

Use Schema for:

- persisted Intents;
- provider-native receipts and observations;
- journal events;
- bundle manifests;
- cross-process release plans;
- public typed errors.

Do not repeatedly decode already trusted in-process values.

Schema services may help load bundle-relative references into bound handles, but that mechanism need not become an ambient public ArtifactStore service.

## Scope and process ownership

Use Scope for temporary source snapshots, staged outputs, temporary credentials/configuration files, processes, and materialized logical filenames.

The release bundle owns durable bytes. A scoped effect-build output must be adopted before its scope closes.

## Workflow/Activity

Workflow/Activity stores and replays encoded results/messages. It does not persist a JavaScript code cursor and does not make an independent provider exactly once.

Activity constructor interruption retry and `Activity.retry` are different mechanisms. Neither proves an external request did not commit.

Activity names and attempts participate in identity in the inspected engine. Release operation identity remains the canonical Intent digest, not call order or Activity name.

## Version recommendation

The corrected alignment harness shows rc.108 and rc.109 both satisfy effect-build's exercised dependency set and both reach ts-release's broad beta.83 source-migration boundary.

Provisional recommendation: plan the rewrite against the exact published rc.109 family, with moderate confidence, because beta.83 is outside effect-build's peer range and no semantic advantage for rc.108 has been demonstrated. Do not modify production dependencies until a behavior-preserving migration plan exists.

Pins:

- beta.83: https://github.com/Effect-TS/effect/tree/cd7ab658994104bd6fe8f841f1440bea32c387f5
- rc.108: https://github.com/Effect-TS/effect/tree/bef7bf38ae4b73d5511043f707aed083de5da7cc
- rc.109: https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d
- current source research: https://github.com/Effect-TS/effect/tree/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6
