# Effect patterns

Status: active research. This document studies semantic patterns and laws; it does not select the root ts-release API or copy Effect package topology.

Source baselines:

- Effect pinned by the effect-build research branch: `effect@4.0.0-rc.108`, commit `bef7bf38ae4b73d5511043f707aed083de5da7cc`
- current Effect source: `189b003a2367fa44dd4b8544aa62979f0345d179`
- effect-build granular integration branch: `15c811bb9904142a33d119766b62082f3c689f13`

## Evaluation rule for a shared abstraction

For every proposed abstraction, the research must state:

1. its behavioral law;
2. at least two genuinely substitutable implementations;
3. a counterexample that does not satisfy the law;
4. the invalid states or duplicated decisions it removes;
5. provider-specific information that remains outside it.

Concrete dependency-injection services do not require multiple implementations to be useful. A unifying domain abstraction does.

## Pattern 1: genuinely substitutable service - Effect AI `LanguageModel`

Primary sources:

- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/unstable/ai/LanguageModel.ts
- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/unstable/ai/Model.ts
- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/ai/openai/src/OpenAiLanguageModel.ts
- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/ai/anthropic/src/AnthropicLanguageModel.ts

### Law

A `LanguageModel` implementation accepts the shared prompt/tool/options model and returns the shared response/stream semantics. An application can select one implementation without rewriting the calling program's conceptual operation.

### Representative implementations

- OpenAI language model Layer.
- Anthropic language model Layer.

### Counterexample

npm publication and GitHub Release asset upload do not satisfy one shared operation law merely because both send bytes remotely. Their coordinates, success receipts, conflict semantics, multiplicity, mutability, and recovery reads differ.

### State-space reduction

The shared model removes provider selection from the calling program's core generation logic and centralizes prompt/response/tool semantics.

### Provider-specific remainder

Provider options, model IDs, authentication, raw metadata, unsupported features, and provider-specific errors remain outside or alongside the shared service.

### ts-release implication

**Inferred:** Effect AI is evidence for an arbitrary implementation of a real shared service. It is not evidence that unrelated release destinations need a `Publisher` service.

## Pattern 2: concrete client services - Effect SQL and integrations

Primary sources:

- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/unstable/sql/SqlClient.ts
- https://github.com/Effect-TS/effect/tree/189b003a2367fa44dd4b8544aa62979f0345d179/packages/sql
- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/ai/openai/src/OpenAiClient.ts

### Law

A configured client service owns a coherent external protocol/resource: connection acquisition, request execution, transactions or provider request helpers, and lifecycle. Programs depend on the client; applications provide its Layer.

### Representative implementations

- PostgreSQL and SQLite drivers provide SQL clients satisfying common SQL laws while retaining driver configuration.
- OpenAI's concrete client service owns OpenAI request/authentication behavior without pretending to be every AI provider client.

### Counterexample

A `Release` value, one npm package artifact, or a single `publishPackage` operation is not a long-lived configured client capability. Turning every noun or function into a Context service would make requirements ambient without reducing state.

### State-space reduction

The service removes repeated client construction, auth/header wiring, connection/resource management, and test replacement from each operation.

### Provider-specific remainder

Provider request/response types, coordinates, authentication choices, error types, rate limits, and reconciliation policies remain in the provider package.

### ts-release implication

A likely provider shape is:

```ts
NpmClient.make(options)
NpmClient.layer(options)
NpmClient.layerConfig(config)

Npm.publish(input) // ordinary Effect requiring NpmClient
```

This is a research pattern, not a finalized API name.

## Pattern 3: lawful compiler/provider abstraction - effect-build

Primary sources:

- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Provider.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/JavaScriptBundle.ts
- https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build-bun
- https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build-deno

### Law

A compiler provider implements executable compilation and matrix compilation with correlated options, targets, artifacts, and typed failures. Bun and Deno are substitutable for that operation where their target support overlaps.

### Representative implementations

- Bun standalone compiler provider.
- Deno standalone compiler provider.

### Counterexample

An esbuild JavaScript bundle and an npm package publication are not executable compilation providers. The granular branch correctly exposes lower-level integration programs rather than forcing every build capability into the standalone compiler service.

### State-space reduction

The compiler abstraction centralizes target validation, tool discovery, staging, output validation, matrix concurrency, and artifact result shape.

### Provider-specific remainder

Compiler flags, native target tokens, tool diagnostics, and stages remain provider-correlated.

### ts-release implication

Use effect-build for capabilities it honestly owns. Proposed improvements must be generic build capabilities, for example:

- immutable or scoped owned build outputs;
- JavaScript bundle integration programs;
- executable matrix output handoff;
- generic logical filename preservation.

Do not add release destinations, registry coordinates, release manifests, or publication concepts to effect-build.

## Pattern 4: explicit Effects and Layer provision boundaries

Primary sources:

- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/Effect.ts
- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/Layer.ts
- https://github.com/Effect-TS/examples/blob/main/templates/cli/src/Cli.ts

Research guidance:

- use `Effect.fn` for reusable named operations;
- use `Effect.gen` for workflows whose sequencing and returned values matter;
- keep service requirements visible in returned Effects;
- provider libraries expose requirements rather than closing over application Layers;
- CLI/runtime/test entrypoints compose and provide Layers;
- runtime execution occurs at the application boundary;
- build Effects must not acquire publication credentials simply because the application also has publication Layers.

Counterexample:

```ts
const publish = input => program(input).pipe(Effect.provide(PublishLive))
```

inside the authored release definition hides the client requirements, narrows test replacement, and makes credential acquisition timing harder to inspect.

Preferred semantic form under investigation:

```ts
const publish = input => program(input)

// CLI/test/runtime boundary
publish(input).pipe(Effect.provide(PublishLive))
```

No exact `ReleaseDefinition` shape is selected by this pattern.

## Pattern 5: Schema services and boundary decoding

Primary sources:

- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/Schema.ts
- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/unstable/workflow/Activity.ts

Observed semantics:

- Schema codecs can require services during decoding and encoding.
- Durable Activity values carry success/error Schemas so results can be encoded, stored, decoded, and replayed.
- Schema services can establish contextual reference resolution, but making bundle identity ambient is an architectural choice, not a Schema requirement.

Research question:

Compare:

1. `ArtifactRef` decoding that requires a bundle-resolution service;
2. ordinary Schema decoding followed by a private recursive reference-validation pass;
3. Schema transformations that produce resolved process-local handles.

The public API should expose a Schema service only if it removes invalid states without hiding which bundle is active.

## Pattern 6: scoped filesystem and process operations

Primary sources:

- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/FileSystem.ts
- https://github.com/Effect-TS/effect/blob/189b003a2367fa44dd4b8544aa62979f0345d179/packages/effect/src/unstable/process/ChildProcess.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts

Useful semantic laws:

- temporary directories and logical files are acquired and finalized through Scope;
- child processes are interruptible resources whose stdout/stderr/exit are Effects;
- a scoped path must not escape after its lifetime;
- provider command arguments may receive a scoped logical filename, never a private bundle storage path;
- HTTP integrations should prefer streams/bytes when no path is needed.

Counterexample:

Hash a mutable workspace path, close the handle, and later reopen the same path for publication. This creates a check-to-use gap rather than carrying proof structurally.

## Pattern 7: Workflow/Activity

Workflow/Activity semantics are documented in `resumability.md`. The Effect pattern relevant here is narrower:

- Workflow is a typed durable execution definition with stable identity and Schemas.
- Activity is an Effect-like value whose result may be stored/replayed by an engine.
- The durable cluster implementation requires sharding and message storage.
- External mutation safety is not supplied by Effect alone.

**Inferred:** ts-release should not encode provider mutations as Activities until provider replay/reconciliation laws and the ideal resumability contract are established.

## Arbitrary custom provider without registration

Ordinary composition target:

```ts
// @acme/ts-release-s3
export class S3Client extends Context.Service<...>()("@acme/S3Client") {}

export const upload = Effect.fn("S3.upload")(function* (input) {
  const client = yield* S3Client
  // provider-local protocol and errors
})

// release.config.ts
const result = yield* S3.upload(input)
```

The core package does not contain:

- provider name `s3`;
- a union member;
- registration or certification;
- package discovery;
- a shared Publisher implementation.

A clean-consumer fixture must prove that an imported third-party package plus its Layer typechecks and runs when the CLI executes TypeScript dynamically.

### Separate distribution question

An already-built standalone executable cannot assume an unknown package is embedded. Dynamic external module loading depends on package resolution and bundler/runtime behavior. This must be tested separately; failure would argue for a dynamic TypeScript CLI, not for narrowing the extension model to a built-in allowlist.

## Candidate abstractions to evaluate next

| Abstraction | Provisional law | Candidate implementations | Counterexample |
| --- | --- | --- | --- |
| Immutable artifact bundle | owns exact bytes; finalization closes ingestion; refs resolve only within bundle | local directory/archive; object-storage manifest | mutable workspace directory |
| Release-run store | stable run identity; compare-and-set progress; leases; typed durable checkpoints | local SQLite/files; remote SQL/object store | CI log text |
| Compiler | compile executable for correlated target/options | Bun; Deno; Node SEA where laws align | npm publisher |
| Package registry client | provider-specific package protocol | npm client implementations/tests | GitHub Release client |
| Generic Publisher | not yet a lawful abstraction | none established | npm, GitHub, PyPI differ materially |

## Required probes

Only add compiling probes when source reading cannot settle a question. Planned probes:

1. custom provider imported by a packed clean consumer without registration;
2. Effect requirements remain visible through an authored release value;
3. Schema decoding service versus explicit bundle resolution for nested refs;
4. dynamic TypeScript CLI versus standalone executable loading an unknown package.

No production root API or Workflow implementation is part of this checkpoint.