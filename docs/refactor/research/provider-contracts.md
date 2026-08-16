# Provider boundaries and optional capabilities

Status: canonical provider-extension analysis for PR #19. Provider wire facts are indexed in `provider-wire-models.md` and `provider-wire-github-catalogs.md`.

## Conclusion

The previous monolithic provider contract was too large. Dispatch, authoritative observation, correction, and public-consumption testing are not universally substitutable capabilities.

The smallest durable provider boundary is a versioned definition that can decode and identify its provider-local Intent:

```ts
interface ProviderDefinition<I> {
  readonly id: string
  readonly intentSchemaVersion: number
  readonly behaviorId: string
  readonly intentSchema: Schema.Schema<I>
  readonly operationId: (intent: I) => OperationId
}
```

Representative provider packages may additionally expose ordinary operations or services:

```text
prepare/dispatch
observe
correct
```

Those operations remain provider-local. They are not members of one mandatory lifecycle.

## What every resumable provider must supply

A provider that participates in durable continuation must supply:

1. a stable definition ID;
2. an Intent Schema/version and canonical encoding;
3. a behavior identity that a fresh runner can compare with the persisted plan;
4. enough application composition to load that definition on the new runner.

A provider does not have to supply an authoritative observation endpoint. A write-only provider is valid; after a lost response it may honestly remain `Inconclusive`.

A provider does not have to supply correction. A provider may define immutable coordinates or no lawful corrective operation.

## Removed abstraction: ConsumerScenario

`ConsumerScenario` is removed from the provider boundary.

### Why

A clean install or execution depends on application policy, operating system, architecture, package-manager configuration, dependency state, command selection, and the product promise being tested. These scenarios are additive and heterogeneous, not substitute implementations of one provider law.

Concrete examples:

```text
npm registry acceptance
  != npm install in Node 24 on Linux
  != import through an ESM entrypoint
  != run a CLI smoke command

GitHub asset acceptance
  != public asset download
  != execute the downloaded binary
  != install through Homebrew
```

No current provider mutation, reconciliation, or resume decision requires a consumer scenario. Removing the abstraction makes only these framework conveniences unavailable:

- one generic core registry of consumer tests;
- one generic durable consumer-test status;
- automatic resumption of arbitrary acceptance tests through the publication journal.

Those conveniences have no demonstrated product need. Applications and CI can sequence ordinary Effects and preserve their normal test artifacts.

## Consumer evidence placement

The following remain useful outcomes, but they are not provider capabilities:

| Outcome | Owner |
| --- | --- |
| Provider accepted mutation | provider dispatch result |
| Fresh public metadata/byte observation | provider observation operation |
| Clean install/import/execute in a selected environment | application policy or CI test |
| ts-release releases itself successfully | maintained project end-to-end gate |
| Reusable custom acceptance workflow | ordinary user-supplied Effect, not a core interface |

Consumer checks may run after provider acceptance, after public visibility, or in an independent later workflow. Their failure can fail that CI policy. It does not make a documented provider success uncertain, and it does not authorize replay of the mutation.

## Optional provider operations

### Dispatch

A dispatch-capable provider prepares one exact mutation before core records `DispatchStarted`. Preparation produces:

- provider definition and behavior identity;
- endpoint and coordinate identity;
- normalized request projection and fingerprint;
- non-secret authorization identity;
- replay-protection evidence, if any;
- a provider-local response decoder.

Core records those facts, then permits the prepared mutation to cross the uncertainty boundary.

### Observation

Observation is optional and provider-local. It can report facts such as:

```text
satisfied
conflict
pending
absent
provider-specific state
```

Observed absence does not prove that an already-dispatched request cannot commit later.

### Correction

Correction is optional and provider-local. It must name a new Intent or an explicit supersession; it cannot mutate historical Intent or receipts.

## No resume-time ReplaySafetyCapability

The previous `ReplaySafetyCapability` is removed. Provider code no longer receives old Intent/receipt/observation facts and returns a replay verdict on each fresh runner.

Replay safety is instead declared in the prepared dispatch and recorded before sending. Core later applies a small, versioned replay-protection algebra. Unsupported provider laws produce no automatic replay.

See `resumability.md`.

## Arbitrary providers without an allowlist

A custom package can define its own Intent, client service, Layer, preparation/dispatch Effect, observation Effect, errors, and receipts.

A fresh runner loads the same release application/configuration, which supplies the provider definition and Layers. Core performs heterogeneous lookup by persisted definition ID and schema version. This is resolution, not admission or certification.

Effect SQL is the closest package analogy: a lawful shared SQL interface exists where backend operations are substitutable, while PostgreSQL retains backend-specific configuration and LISTEN/NOTIFY. Release destinations are additive rather than alternative implementations of one `Publisher`, so the analogy stops before a universal publish service.

## Counterexamples

| Proposed universal member | Counterexample |
| --- | --- |
| `observe` | write-only custom endpoint with no request-status or read API |
| `classifyReplay` | same history produces different verdicts under provider package versions |
| `correct` | immutable npm/PyPI coordinate with no lawful overwrite |
| `ConsumerScenario` | Homebrew install and npm import do not share one provider law |
| evidence-environment declaration | test matrix is release/application policy, not provider admission |

## Probe evidence and limits

The clean-consumer probe establishes only that a consumer module can import a provider unknown to core, provide its own Layer, and export an already-closed Effect that a dynamic Node CLI executes.

It does not establish:

- persisted custom Intent decoding;
- provider behavior identity matching;
- durable journal folding;
- replay protection;
- fresh-runner continuation;
- multi-provider orchestration;
- provider-native reporting.

A future two-process probe should test only those missing definition-resolution and continuation properties.
