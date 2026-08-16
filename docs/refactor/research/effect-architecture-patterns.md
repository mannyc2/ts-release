# Effect architecture patterns for ts-release

Status: semantic pattern research. It does not select the root production API.

## Principle

Use `Context.Service` and Layers for concrete replaceable dependencies. Add a
common service only when implementations satisfy one shared law.

## Closest analogy: Effect SQL

Transferable:

- a small common interface where backend laws align;
- concrete backend clients with richer provider-specific operations;
- application-selected Layers.

Non-transferable:

- release destinations are additive rather than alternatives;
- provider commit units, receipts, observations, and replay laws differ;
- no universal publication query language exists.

Source:

- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/sql/pg/src/PgClient.ts

## Concrete services versus durable definitions

Concrete provider services own configured clients, credentials, rate limits,
and provider-local operations.

A durable provider definition needs only enough information to decode canonical
Intent on a fresh runner:

```text
definition ID
Intent schema version
Intent Schema/canonical encoding
```

Core can derive operation identity. Behavior/package/lockfile provenance can be
reported separately and need not become Context requirements or replay gates.

## Effect AI normalization

Effect AI shows the benefit and cost of a common error vocabulary. Shared
`AiError` reasons simplify callers while provider-native detail can move into
metadata or be erased.

For ts-release, durable provider receipts and observations are authority-bearing
and should remain provider-native. CLI summaries can be derived projections.

Sources:

- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/ai/openai/src/OpenAiLanguageModel.ts
- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/AiError.ts

## effect-build

effect-build demonstrates a lawful common compile-executable operation and
provider-correlated options/targets. It also exposes concrete lower-level
operations and distinct output lifetimes.

It does not imply a universal publisher or builder. uv, Poetry, nFPM, archive,
and Apple operations may be concrete Effects and Layers without implementing
one shared root service.

Sources:

- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Provider.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts

## JournalStore as a lawful service

`JournalStore` is currently the clearest new common interface:

```text
appendIfRevision(expectedRevision, completeEvent)
```

SQLite, a conditional object store, a Git-ref implementation, and a local
filesystem algorithm can be evaluated against the same law. The interface does
not require choosing all implementations as first-party packages.

## Core transport and provider law

A core HTTP/Git service can make recorded request correspondence structural.
It cannot make remote idempotency structural. A provider protocol law remains a
separate input to replay decisions.

This distinction prevents a false Effect abstraction in which every provider
that returns an `IdempotencyKey` value is assumed substitutable under the same
remote law.

## Scope and Schema

Use Schema at durable and unknown boundaries:

- Intent;
- provider receipts/observations;
- journal events;
- bundle manifests;
- release plans; and
- typed public errors.

Use Scope for temporary source snapshots, producer outputs, credential files,
processes, and materialized logical filenames.

## Workflow/Activity

Workflow/Activity remains deferred. Stored messages/results and worker replay
do not make independent provider mutations exactly once. A later engine must
host the accepted plan/journal/replay semantics rather than redefine them.
