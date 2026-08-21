# Custom-provider composition and fresh-runner loading

Status: operational companion to `provider-contracts.md`.

## Ordinary Effect composition

A provider client is an ordinary concrete service supplied by a Layer. This
solves dependency injection; it does not imply that npm, Warehouse, GitHub, and
a custom endpoint implement one interchangeable publisher service.

```ts
class AcmeClient extends Context.Service<AcmeClient, AcmeClientService>()(
  "@acme/release/AcmeClient"
) {}
```

The release application imports provider packages and supplies their Layers.
No core allowlist is required.

## Durable definition resolution

A fresh runner has:

```text
immutable bundle
release plan
journal
release application/configuration
new credentials
no process memory from the earlier runner
```

The plan stores:

```text
providerDefinitionId
intentSchemaVersion
canonical encoded Intent
```

Core derives:

```text
operationId = hash(
  "ts-release/operation/1",
  definitionId,
  schemaVersion,
  canonicalIntent
)

operationKey = (planId, operationId)
```

The provider-local identity is stable across plans; `operationKey` supplies
the owning release envelope. The application supplies the matching Schema and
optional operations. It does not need to reproduce a provider-authored
operation-ID function.

## Implementation provenance

Package version, source revision, and lockfile identity can be useful for:

- diagnostics;
- audit trails;
- reproduction of a historical bug;
- deciding whether a maintainer wants to trust a new observation decoder; and
- explaining why newly prepared request bytes changed.

They are not automatic replay authorities when a core-owned transport produces
an identical immutable request with the same endpoint, authorization scope,
replay protection, and validity interval.

The corrected identity probe compares both policies:

```text
same wire facts, different behavior/lockfile provenance

strict implementation policy -> stop
wire-correspondence policy    -> allow
```

The probe does not prove remote idempotency. It shows that implementation
identity is an additional conservative policy, not a fact entailed by request
correspondence.

## Fresh-runner replay dependency

Automatic replay still depends on two separate proofs:

1. **Correspondence:** core can prove the new immutable request equals the
   historical request under the recorded scope.
2. **Remote law:** a trusted protocol-law authority establishes that replaying
   that request is safe.

A provider package cannot obtain automatic replay merely by returning
`replay.idempotency-key/1` or `replay.exact-duplicate/1`. v1 enables only the
structural core compare-and-swap law; a future non-structural binding is
application-owned policy selected before dispatch, not a resume-time provider
capability.

## Opaque custom effects

A provider that performs arbitrary effects outside a core-owned transport is
valid for initial dispatch and optional observation. Core cannot prove that a
later invocation sends the historical request and performs no additional
mutation.

Therefore uncertain opaque dispatches do not replay automatically. They
continue through observation, terminal non-commit evidence, or explicit
`RiskAccepted`.

## Dynamic CLI boundary

A dynamic TypeScript/Node CLI can load the consumer's release application and
therefore provider packages unknown when the CLI package was built.

A sealed single-file executable has a separate package-resolution problem. That
packaging limitation does not justify a provider union or registry.

## Closest Effect analogy

Effect SQL remains the closest partial analogy:

- common interfaces exist only where backend laws align;
- concrete backend clients retain richer provider-specific behavior;
- application Layers choose implementations.

The analogy stops because release destinations are additive and have different
commit units, receipts, and replay laws.
