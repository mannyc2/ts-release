# Custom-provider composition and fresh-runner loading

Status: continuation of `provider-contracts.md`.

## Ordinary Effect DI versus interchangeability

A concrete provider client is ordinary dependency injection:

```ts
class AcmeClient extends Context.Service<AcmeClient, AcmeClientService>()(
  "@acme/release/AcmeClient"
) {}
```

The application supplies a Layer. This does not imply that Acme, npm, Warehouse, and GitHub implement a common publication service.

A shared abstraction is justified only when implementations satisfy one law. The current justified shared boundary is provider-definition resolution for persisted Intents, not publication behavior.

## Fresh-runner application contract

A new runner has:

```text
durable bundle
durable release plan
durable journal
no previous process memory
new credentials
release application/configuration
```

The application supplies provider definitions and Layers:

```ts
ReleaseApplication.make({
  definitions: [
    Npm.definition,
    Warehouse.definition,
    Github.definition,
    Homebrew.definition,
    Scoop.definition,
    Acme.definition
  ],
  layer: Layer.mergeAll(
    Npm.layerConfig(...),
    Warehouse.layerConfig(...),
    Github.layerConfig(...),
    Acme.layer(...)
  )
})
```

The plan stores provider definition ID, Intent schema version, and behavior ID. It does not serialize a Layer, closure, client, or arbitrary executable policy.

## Behavior identity

A fresh runner may decode and observe an old operation only when the supplied provider definition is compatible with the persisted definition identity.

Automatic replay additionally requires:

- the same behavior ID;
- an equivalent newly prepared request fingerprint;
- compatible endpoint and authorization scope;
- unexpired recorded replay protection;
- a successful journal compare-and-swap.

If provider code changes request rendering, the fingerprint changes and automatic replay stops. If behavior identity changes, automatic replay stops even if the Intent Schema still decodes.

Observation under newer code may be allowed only through an explicit compatibility declaration or migration. That is a maintainer-facing schema/behavior migration question, not automatic provider admission.

## Remaining implementation dependency

Core can make the replay decision deterministic, but arbitrary executable provider code still has one unavoidable law:

> The dispatch operation must send the exact prepared mutation whose normalized projection and protection were recorded.

Built-in HTTP/Git integrations can make this stronger by handing an immutable prepared request to a core-owned transport. An opaque custom Effect can violate the law by sending something else. No type-only interface can prevent arbitrary code from performing additional effects.

For opaque custom providers, automatic replay should default to disabled unless the provider uses a core-supported prepared-dispatch form or the exact application/provider behavior is pinned and trusted.

## Dynamic CLI boundary

A dynamic TypeScript/Node CLI can load the consumer's release application and therefore provider packages unknown when the CLI package was built.

A sealed single-file executable has a separate package-resolution problem. Failure to load arbitrary unbundled packages from a sealed executable is not evidence for a closed provider union. Until a sealed loader is proved, the dynamic CLI is the honest extensibility surface.

## Closest Effect analogies

### Effect SQL

Transferable:

- common interface only where backend laws align;
- concrete backend clients and richer backend-specific operations;
- application-selected Layers.

Non-transferable:

- publication destinations are additive;
- provider commit units and receipts differ;
- no universal publish query/transaction law exists.

### Effect AI

Transferable:

- arbitrary provider implementations can supply a shared service;
- provider-specific metadata can be namespaced.

Cost:

- normalization into `AiError` simplifies callers but may erase provider-native distinctions. For ts-release, canonical receipts and observations should remain provider-native; normalized reporting is a derived projection.

### effect-build

Transferable:

- a common operation is lawful when all providers implement the same compile-executable contract;
- provider-correlated options and targets remain typed;
- concrete packages can add lower-level operations.

Non-transferable:

- producing an executable is one operation shape;
- npm, Warehouse, GitHub, and Git catalog mutations are not substitutes.

Pinned sources:

- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/sql/pg/src/PgClient.ts
- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/ai/openai/src/OpenAiLanguageModel.ts
- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/AiError.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Provider.ts
