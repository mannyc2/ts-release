# Effect package architecture, Workflow, and provider patterns

Status: continuation of [effect-patterns.md](./effect-patterns.md). It is part of the same research document and has the same guardrails.

## 7. Closest Effect architecture

No one Effect package is a perfect analogy. The strongest model combines several patterns.

## 7.1 Effect SQL: closest provider-extension analogy

Effect SQL defines a common `SqlClient` because backends obey shared query, transaction, streaming, and connection laws. PostgreSQL extends it with:

- PostgreSQL configuration;
- JSON fragments;
- LISTEN;
- NOTIFY; and
- PostgreSQL-specific construction.

Sources:

- [`SqlClient.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/sql/SqlClient.ts)
- [`PgClient.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/sql/pg/src/PgClient.ts)

### Transferable pattern

- define only the smallest lawful common capability;
- let concrete integrations expose richer provider-specific services;
- allow applications to depend on the concrete service when they need provider-specific operations.

### False analogy

npm, Warehouse, GitHub, Homebrew Git, and Scoop Git are not interchangeable implementations of one publication operation. They are additive destinations with different commit units.

## 7.2 Effect Platform: arbitrary implementations through Layers

Platform defines portable services. Node and Bun Layers provide implementations. Applications choose Layers without modifying a central allowlist.

### Transferable pattern

A fresh ts-release application loads provider definitions and Layers at its boundary. Core does not import every provider package.

### False analogy

Platform implementations are substitutes for the same service. Release providers are usually used together.

## 7.3 Effect AI: normalization tradeoff

Effect AI has a lawful common `LanguageModel` operation shape. Provider adapters normalize public failures into `AiError`, while provider-specific metadata and options are namespaced.

Sources:

- [`LanguageModel.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/LanguageModel.ts)
- [`AiError.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/AiError.ts)
- [`OpenAiLanguageModel.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/ai/openai/src/OpenAiLanguageModel.ts)

### Benefit

Shared categories make application handling easier.

### Cost

Provider-native distinctions can be erased or relegated to metadata. This is acceptable when callers primarily need one model operation, but dangerous for authority-bearing release receipts, conflicts, and replay laws.

### Recommendation

Normalize only genuinely common infrastructure failures, such as local configuration decoding or platform transport errors. Preserve provider-native receipt and error Schemas in durable release history.

## 7.4 effect-build: lawful common operation

effect-build defines common executable compilation operations and provider-specific targets/options/artifacts. Its `Provider.define` creates concrete services and Layers.

Source:

- [`Provider.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Provider.ts)

### Transferable pattern

A shared capability is valid when callers can select Bun, Deno, or Node SEA for the same compile operation.

### False analogy

Provider-definition machinery does not prove that unrelated release destinations share `publish`.

## 8. Provider definitions and optional common capabilities

A custom release provider needs durable definition identity and Intent decoding. It does not need to implement every optional capability.

Possible application composition:

```ts
const application = ReleaseApplication.make({
  definitions: [
    Npm.definition,
    Warehouse.definition,
    Github.definition,
    Homebrew.definition,
    Scoop.definition,
    MyProvider.definition
  ],
  layer: Layer.mergeAll(
    Npm.layerConfig(...),
    Warehouse.layerConfig(...),
    Github.layerConfig(...),
    MyProvider.layer(...)
  )
})
```

This is ordinary TypeScript and Layer composition.

A heterogeneous definition resolver is necessary at the persistence boundary. It is not a common provider service and does not make providers interchangeable.

Optional common capabilities can exist separately when laws are real:

```text
IntentDefinition
DispatchCapability
ObservationCapability
ReplaySafetyCapability
ConditionalGitUpdateCapability
ConsumerScenario
```

`ConditionalGitUpdateCapability` may be shared by Homebrew and Scoop publication because both can use the same exact ref compare-and-swap law. Their renderers and consumer scenarios remain distinct.

## 9. Layer boundaries

### Library

Library functions should return Effects with visible requirements. Provider packages expose concrete services and `make`, `layer`, and `layerConfig` where appropriate.

### Application/CLI

The application loads configuration, resolves provider definitions, and supplies Layers. It owns runtime selection.

### Tests

Tests provide protocol doubles or scratch-provider Layers. A test Layer proves only the named protocol behavior, not real provider acceptance.

### Fresh-runner resume

The same application/configuration must be loadable on another runner. Durable state contains definition identity/version, not a serialized Layer or closure.

## 10. Activity identity, replay, and persistence

At rc.108, rc.109, and the date-pinned current source:

```text
in-memory Activity result key =
  workflow execution ID / Activity name / attempt
```

Source:

- [`WorkflowEngine.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/workflow/WorkflowEngine.ts)
- [`Activity.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/workflow/Activity.ts)

### Call order

Call order is not an explicit component of the Activity cache key. It can still affect which names execute and when. Reordering code that reuses the same name can alias a stored result; renaming can make an old result unreachable.

Therefore Activity names must not be the canonical release Intent identity.

### Retry

The Activity constructor retries interruption according to its default policy. `Activity.retry` separately increments `CurrentAttempt` for application-level retries. Neither mechanism establishes external non-commit.

### Persistence

The in-memory engine stores in-process state. The cluster engine adds persistent messages/sharding. Workflow code is re-executed and stored results/messages are replayed. This is not a persisted arbitrary TypeScript instruction pointer.

### Exactly once

An Activity result may be observed once by the workflow while the Activity body executes more than once. Temporal documents the same distinction explicitly. External exactly-once behavior still depends on provider idempotency or reconciliation.

## 11. Workflow/Activity role in ts-release

Possible future role:

```text
schedule observation
wait with durable timers
acquire journal lease
append CAS event
invoke provider dispatch after authorization
resume after process loss
```

Not its role:

```text
define provider coordinate
replace canonical Intent
infer external commit after response loss
supply provider idempotency
replace the release journal
```

No Workflow/Activity implementation is recommended in this research PR.

## 12. effect-build improvements

Current granular source already distinguishes:

- scoped `withOwnedJavaScriptBundle`;
- caller-selected final-path `produceExecutable`; and
- provider-specific compiler Layers.

Sources:

- [`Integration.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts)
- [`JavaScriptBundle.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/JavaScriptBundle.ts)

No effect-build change is required for ts-release to ingest outputs.

Potential generic improvements, only if independently useful:

1. a reusable produced-output reader/adoption callback across compiler providers;
2. explicit lifetime metadata or naming for scoped versus caller-owned outputs;
3. a compatibility harness reusable by other Effect consumers; and
4. stable operation identity for build caches derived from input/tool/target/options.

Not valid effect-build changes:

- release bundle retention;
- npm/GitHub/PyPI coordinates;
- provider receipts;
- release journal;
- custom publication providers.

## 13. Probe evidence and limits

### Three version compile probes

Prove:

- a small public Effect surface compiles under each baseline.

Do not prove:

- repository migration;
- Workflow persistence;
- Activity retry behavior;
- provider integration;
- runtime semantics.

### Corrected alignment harness

Proves:

- both rc.108 and rc.109 install with effect-build;
- effect-build package/test/consumer gates pass;
- ts-release installs;
- ts-release source still fails typecheck.

Does not prove:

- runtime behavior after migration;
- release wire correctness;
- one candidate is semantically superior.

### Clean custom-provider consumer

Proves:

- consumer module imports an unknown provider package;
- consumer supplies its Layer;
- CLI dynamically imports an already-closed Effect.

Does not prove:

- durable provider definition resolution;
- plan Schema decoding;
- fresh-runner continuation;
- multi-provider journal execution;
- reconciliation.

### No additional probe in this pass

Source reading answers the current architecture questions. A new probe would add machinery without yet proving an external provider outcome. The next useful probe is the two-process custom-definition resolution test described in `provider-contracts.md`.

## 14. Recommendations and confidence

| Recommendation | Confidence | Tradeoff |
| --- | --- | --- |
| Plan the rewrite migration against exact published rc.109. | Moderate | Unstable modules remain a moving risk. |
| Treat Effect SQL as the closest extension analogy, with Platform and AI supplying narrower lessons. | High | No single upstream package maps exactly to release orchestration. |
| Use concrete provider services plus independently optional capability interfaces. | High | Application composition needs a heterogeneous definition resolver. |
| Preserve provider-native durable errors/receipts instead of one normalized publication error. | High | Generic reporting must project rather than replace them. |
| Keep Workflow/Activity outside provider correctness and canonical identity. | High | Journal and provider reconciliation remain separate work. |
| Require no effect-build API change for initial integration. | High | ts-release performs adoption into its durable bundle. |

## 15. Genuine maintainer choices

- Whether rc.109 migration happens before or alongside the greenfield package skeleton.
- Whether unstable Workflow/Activity is excluded from the first shipping implementation.
- Exact application definition-resolver API.
- Which infrastructure failures receive a common normalized error projection.
- Whether a narrow shared conditional-Git capability is exposed publicly.
- Which effect-build generic improvements are independently worth scheduling.

## 16. Unresolved contradictions

1. The rewrite should use current Effect patterns, but unstable Workflow source can change while the package version remains rc.109. Exact pinning and isolation reduce but do not remove this risk.
2. Provider-native durable errors preserve authority, while stock CLI users need coherent reporting. A projection layer is needed, but its minimum common vocabulary is not selected.
3. A heterogeneous provider resolver resembles a registry mechanically. Its law is runtime decoding, not admission. The API must keep this distinction obvious.
4. rc.109 is the strongest current target, but the complete behavior-preserving migration has not been executed. Recommendation confidence remains moderate until that gate passes.
