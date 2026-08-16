# Provider boundaries and provider-local contracts

Status: research and design checkpoint. This document compares provider-extension models and provider-specific wire facts. It does not select the production root API, implement a provider runtime, or introduce an allowlist.

## Fixed shipping scope

The shipping rewrite includes:

1. npm;
2. PyPI/Warehouse;
3. GitHub Releases and release assets;
4. Homebrew formulas;
5. Scoop; and
6. arbitrary custom providers.

This scope is not reopened by the alternatives below.

## Evidence labels

- **Provider-specified:** official protocol or product documentation.
- **Source-observed:** pinned provider, client, or ts-release source.
- **Inferred:** a conclusion that follows from cited facts.
- **Provisional recommendation:** the strongest current design, still subject to maintainer review.
- **Maintainer choice:** behavior not determined by provider law or current evidence.

## Source pins

| Source | Pin |
| --- | --- |
| current ts-release research head before this pass | `269b8673f596cd586e7ff6ae378a4e318fe0c331` |
| current ts-release implementation evidence | `d57e7e91b58683d030201d278eb96cd5acd05a21` |
| ts-release v0.0.7 | `af59436cff908fb52773cf18dd95d154f892b8de` |
| npm CLI and bundled `libnpmpublish` | [`51c2bf81fa2c31547d0fec44fff2aaac3d9a9862`](https://github.com/npm/cli/tree/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862) |
| Warehouse upload implementation | [`4bdd89d85bc522a0d555a871ffe250d644c660dc`](https://github.com/pypi/warehouse/tree/4bdd89d85bc522a0d555a871ffe250d644c660dc) |
| GitHub REST description | [`67c14c7efb01cdeeac0ecd8cee9fae8d7a80e2aa`](https://github.com/github/rest-api-description/tree/67c14c7efb01cdeeac0ecd8cee9fae8d7a80e2aa) |
| GitHub documentation | [`81ade08c26f13325c0cde8a23cd3bfb85bd0778e`](https://github.com/github/docs/tree/81ade08c26f13325c0cde8a23cd3bfb85bd0778e) |
| Homebrew | [`78dc68a15f167a973207437a4454381641a2f82f`](https://github.com/Homebrew/brew/tree/78dc68a15f167a973207437a4454381641a2f82f) |
| Scoop | [`b588a06e41d920d2123ec70aee682bae14935939`](https://github.com/ScoopInstaller/Scoop/tree/b588a06e41d920d2123ec70aee682bae14935939) |
| Effect current source | [`397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6`](https://github.com/Effect-TS/effect/tree/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6) |
| effect-build granular integration branch | [`15c811bb9904142a33d119766b62082f3c689f13`](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13) |

## 1. Provider participation is not provider interchangeability

Two separate questions were previously conflated:

1. **Participation:** how can arbitrary application code define and resume provider work?
2. **Interchangeability:** which provider implementations satisfy one common service law and can replace one another at a call site?

Effect dependency injection solves participation without proving interchangeability. A concrete `NpmClient`, `WarehouseClient`, or custom service can be supplied by a Layer even when no shared `Publisher` exists.

A persisted release creates one extra requirement beyond ordinary in-process DI: a fresh process must recover the implementation that knows how to decode and execute an Intent written by an earlier process.

## 2. Custom-provider boundary alternatives

### Alternative A: one monolithic `ProviderContract`

Illustrative shape:

```ts
interface ProviderContract<I, R, O, E> {
  readonly implementationId: string
  readonly Intent: Schema.Schema<I>
  readonly Receipt: Schema.Schema<R>
  readonly Observation: Schema.Schema<O>
  readonly dispatch: (intent: I) => Effect.Effect<R, E, Requirements>
  readonly observe: (intent: I) => Effect.Effect<O, E, Requirements>
  readonly reconcile: ...
  readonly correction: ...
  readonly visibility: ...
  readonly evidenceEnvironments: ...
}
```

**Purported law:** every publication provider exposes the same complete lifecycle.

**Counterexamples:**

- A write-only custom endpoint can return a success receipt but expose no authoritative exact-coordinate read.
- A Git ref update supports exact conditional replay and read-back; a Warehouse file upload does not have the same conditional mutation contract.
- Consumer installation is release policy and environment-specific, not a property every mutation provider can perform.
- Correction differs by provider and may be absent by law, not missing implementation work.

**State-space effect:** the abstraction reduces call-site vocabulary but creates fake capability states such as "unsupported observer", "no correction", or generic unknown fields. It also pressures provider-local facts into a common result algebra.

**Conclusion:** rejected as a mandatory boundary. The concerns are analogous, but the complete capability set is not substitutable.

### Alternative B: ordinary TypeScript only, with no durable provider definition

Illustrative shape:

```ts
yield* MyProvider.publish(input)
```

**Law:** application code owns all behavior; Effect and TypeScript already compose it.

**Strength:** this is the smallest in-process extension model. It has no registry, union, or admission process.

**Counterexample:** after the original process disappears, a new runner can load a durable Intent only if it can identify the package and Schema that decode it. A closure or an already-closed Effect cannot be reconstructed from durable JSON.

**Conclusion:** sufficient for one-process composition, insufficient by itself for durable fresh-runner continuation.

### Alternative C: one versioned definition plus optional capabilities

Illustrative, not selected API:

```ts
interface ProviderDefinition<I> {
  readonly implementationId: string
  readonly schemaVersion: string
  readonly Intent: Schema.Schema<I>
}

interface DispatchCapability<I, R, E, Rq> {
  readonly Receipt: Schema.Schema<R>
  readonly Error: Schema.Schema<E>
  readonly prepareDispatch: (
    intent: I,
    context: DispatchPreparationContext
  ) => Effect.Effect<PreparedDispatch<R>, E, Rq>
}

interface ObservationCapability<I, O, E, Rq> {
  readonly Observation: Schema.Schema<O>
  readonly observe: (
    intent: I,
    context: ObservationContext
  ) => Effect.Effect<O, E, Rq>
}

interface ReplaySafetyCapability<I, R, O> {
  readonly classifyReplay: (
    facts: ReplayFacts<I, R, O>
  ) => ReplayAuthority
}
```

Other capabilities, such as correction or consumer acceptance, remain independent.

**Law:** a provider definition gives durable identity and decoding. Each capability states one narrower substitutability law.

**Representative implementations:**

- npmjs and a named npm-compatible registry can both provide `DispatchCapability`, but they need not share replay or observation laws.
- GitHub and GitLab release packages can expose provider-specific services while optionally satisfying a narrower SCM-release capability if their operations truly align.
- A write-only custom provider can define Intent and dispatch but omit observation.

**Counterexample eliminated:** the absence of an exact observation endpoint no longer makes the provider invalid. A lost response honestly ends `Inconclusive` unless another replay authority exists.

**State-space effect:** unsupported capabilities are absent rather than represented by flags. Provider-local coordinates, receipts, observations, and errors stay typed.

**Provisional recommendation:** strongest current direction, with high confidence. The exact TypeScript spelling remains open.

### Alternative D: one generic `advance(intent, history)` operation

A provider receives durable history and returns the next event.

**Strength:** provider-specific sequencing and optional capabilities are hidden behind one operation.

**Counterexamples:**

- Core cannot durably record the physical mutation boundary before dispatch unless `advance` exposes a structured dispatch continuation.
- Testing cannot distinguish provider observation from mutation without inspecting opaque code.
- A provider could perform a remote mutation before the journal records `DispatchStarted`.

**Conclusion:** rejected as the low-level safety boundary. A higher-level helper may be built on top of explicit dispatch and observation capabilities.

## 3. Smallest durable provider definition

The evidence supports the following minimum facts for any persisted custom Intent:

```text
ProviderDefinitionId
ProviderDefinitionSchemaVersion
IntentSchema
CanonicalIntentEncoding
```

A release plan can then store:

```text
{
  providerDefinitionId,
  schemaVersion,
  encodedIntent
}
```

The application loaded on a fresh runner supplies the matching definition. This is a heterogeneous application-level resolver, not an allowlist of approved providers.

A provider definition is valid even if it supplies no observation capability. A release that needs to mutate through it additionally requires a dispatch capability at runtime. Missing runtime capability is a precise load or execution error, not grounds for excluding the provider model.

### Application-supplied resolver

Possible composition:

```ts
const definitions = ProviderDefinitions.make(
  Npm.definition,
  Warehouse.definition,
  Github.definition,
  Homebrew.definition,
  Scoop.definition,
  MyCustomProvider.definition
)

const program = Release.resume(reference).pipe(
  Effect.provide(ProviderDefinitions.layer(definitions)),
  Effect.provide(AppServices)
)
```

This illustrative resolver exists because durable type erasure needs recovery. It does not claim that providers implement one common publication service.

The resolver must reject:

- unknown definition IDs;
- unsupported schema versions;
- duplicate `(definitionId, schemaVersion)` entries;
- a definition whose decoded Intent does not reproduce its canonical bytes; and
- a provider package whose migration policy cannot interpret the stored version.

## 4. Optional capabilities

| Capability | Mandatory for definition? | Law | Counterexample |
| --- | --- | --- | --- |
| Intent decoding and identity | Yes | Same durable bytes decode to the same provider-local desired fact. | A closure-only provider cannot resume in a fresh process. |
| Dispatch | Only for mutation | Executes one prepared physical request after the journal write-ahead boundary. | Observation-only integrations do not mutate. |
| Fresh observation | No | Reads provider state without mutating and returns provider-native facts. | A webhook sink may have no exact read API. |
| Reconciliation | No separate mandatory method | A provider can classify observations and receipts when enough evidence exists. | A provider with no read surface remains inconclusive. |
| Replay safety | No | States a provider-enforced law under which another dispatch cannot create an extra incompatible effect. | An immutable coordinate alone may only turn a replay into conflict. |
| Correction | No | Creates a new desired fact under provider-specific authority. | Warehouse upload bytes cannot be replaced at the same filename. |
| Consumer acceptance | No | Exercises a named consumer outcome in a named environment. | npm installation and GitHub asset download are different policies. |
| Evidence-environment declaration | No | Belongs to release policy and tests. | A provider package cannot certify every end-user environment. |

## Continued research

The remaining sections continue in [provider-extension-runtime.md](./provider-extension-runtime.md).
