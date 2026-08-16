# Custom-provider Effect composition and fresh-runner loading

Status: continuation of [provider-contracts.md](./provider-contracts.md). It is part of the same research document and has the same guardrails.

## 5. Effect architecture comparison

### Effect SQL: closest analogy

Effect SQL defines a lawful common `SqlClient`. PostgreSQL extends it with provider-specific configuration, JSON fragments, and LISTEN/NOTIFY operations. The common service exists because backends implement the same query/transaction law; backend-specific operations remain outside it.

Primary source:

- [`SqlClient.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/sql/SqlClient.ts)
- [`PgClient.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/sql/pg/src/PgClient.ts)

**Transferable pattern:** define common capabilities only where two implementations obey the same law; let concrete packages extend them.

**Where the analogy stops:** npm publication, Warehouse upload, GitHub assets, and Git ref updates do not share SQL-like operation semantics.

### Effect Platform: implementation selection

Effect Platform defines portable services and lets Node or Bun Layers implement them. The application selects the implementation without a central allowlist.

**Transferable pattern:** a fresh runner composes concrete Layers at the application boundary.

**Where the analogy stops:** platform implementations are substitutes for the same filesystem/path/process laws. Release providers are additive destinations.

### Effect AI: normalization benefits and costs

Effect AI defines a common `LanguageModel` service because provider implementations expose the same generate/stream operations. OpenAI and Anthropic adapters normalize public failures into `AiError`, while provider-specific options and metadata are namespaced.

Primary sources:

- [`LanguageModel.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/LanguageModel.ts)
- [`Model.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/Model.ts)
- [`AiError.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/AiError.ts)
- [`OpenAiLanguageModel.ts`](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/ai/openai/src/OpenAiLanguageModel.ts)

**Benefit:** common retry/auth/transport categories can be handled uniformly.

**Cost:** normalization can erase provider-native distinctions. Effect AI mitigates this with provider metadata, but release receipts and conflicts are too authority-bearing to reduce to one shared error algebra prematurely.

### effect-build: lawful operation shape

effect-build defines common executable compilation operations and provider-specific targets, options, artifacts, and errors. Its common operation is lawful because Bun, Deno, and Node SEA all compile an entrypoint into a native executable under a shared contract.

Primary source:

- [`Provider.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Provider.ts)

**Transferable pattern:** shared operation, concrete service, provider-specific extension.

**Where the analogy stops:** release destinations are additive and have unrelated coordinates and commit laws.

## 6. Fresh-runner custom-provider continuation

Required sequence:

```text
new runner starts
  -> loads exact release application/configuration
  -> imports custom provider package
  -> constructs application ProviderDefinitions resolver and Layers
  -> loads canonical plan, bundle, and journal
  -> resolves provider definition ID and schema version
  -> decodes Intent
  -> derives current operation state from journal events
  -> reacquires credentials
  -> invokes observation or an authorized dispatch capability
```

No global runtime registry is necessary. Some in-memory heterogeneous lookup is necessary after application composition because durable bytes are type-erased.

### What the existing clean-consumer probe proves

It proves only:

- a clean Node consumer can install independently packed core, CLI, and custom provider packages;
- the consumer module can import a provider unknown to CLI core at build time;
- the consumer can supply its own Layer; and
- the CLI can dynamically import and execute an already-closed Effect.

It does not prove:

- a persisted provider definition ID can be resolved in a second process;
- durable Intent Schema decoding;
- provider version migration;
- plan or journal integration;
- typed provider results in CLI reporting;
- multiple provider definitions in one release;
- response-loss reconciliation; or
- safe fresh-runner continuation.

### Focused future probe

A useful disposable probe would use two clean processes:

1. process A writes a plan containing a custom provider definition ID, schema version, and encoded Intent;
2. process B loads the same consumer configuration, resolves the definition, decodes the Intent, folds a journal containing `DispatchStarted`, and performs an observation-only continuation.

It should not perform a real provider mutation. Its result would establish persistence and application-supplied definition resolution, not provider safety.

## 7. Provider wire models

Detailed npmjs, Warehouse, GitHub, Homebrew/Scoop Git, and arbitrary-provider wire analysis is in [provider-wire-models.md](./provider-wire-models.md).

## 8. Recommendations and confidence

| Recommendation | Confidence | Tradeoff |
| --- | --- | --- |
| Replace one mandatory provider lifecycle with a versioned definition plus optional capabilities. | High | A heterogeneous resolver is still needed at the application boundary. |
| Permit providers with no observation capability. | High | Lost-response completion may remain permanently inconclusive. |
| Keep consumer evidence and evidence environments outside provider admission. | High | Release policy must explicitly choose required consumer gates. |
| Use an application-supplied provider-definition resolver on every fresh runner. | High | Definition/version migration becomes an explicit operational responsibility. |

## 9. Genuine remaining choices

- Exact TypeScript shape of provider definitions and optional capability values.
- Whether the application resolver is an explicit value, a Context service, or both.
- Schema migration policy for persisted custom-provider Intents.
- Which common infrastructure errors receive a non-authoritative CLI projection.

## 10. Unresolved contradictions

1. A provider with no observation endpoint is valid, yet the target resumability promise cannot always converge automatically after response loss.
2. A heterogeneous runtime resolver is operationally a lookup table, but it is not an allowlist. Documentation and naming must prevent it from becoming provider admission.
3. Durable custom-provider participation requires versioned decoding, while ordinary in-process Effect DI alone does not.
