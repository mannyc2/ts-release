# Artifact model

Status: active research. Separate `ArtifactReader` and `ArtifactWriter` services are hypotheses, not accepted architecture.

## Requirements

The model must establish all of the following:

- generated output becomes release-owned immutable content rather than a mutable workspace path;
- durable output identifies the exact content used by publication;
- references resolve against the correct bundle;
- missing or changed content fails once at the load boundary;
- private storage paths cannot escape into npm, GitHub, commands, or other providers;
- integrations can obtain bytes, streams, or a scoped logical filename when necessary;
- finalization prevents further ingestion;
- zero, one, and many artifacts require no mode;
- two logical artifacts may share bytes without sharing domain meaning.

## Terminology

- **Content identity**: digest and size of immutable bytes.
- **Logical artifact identity**: the domain-specific role/name assigned to content.
- **Bundle identity**: identity of the finalized collection against which references resolve.
- **Private storage location**: backend path/key used to store bytes; it is not provider input.
- **Logical file**: a scoped presentation of bytes with a provider-appropriate filename, without revealing private storage layout.

## Candidate A: ambient `ArtifactReader` and `ArtifactWriter` services

Sketch:

```ts
const artifact = yield* ArtifactWriter.add(input)
const bytes = yield* ArtifactReader.bytes(artifact.ref)
```

Analysis:

| Property | Assessment |
| --- | --- |
| Canonical representation | Reference plus ambient active store/bundle |
| Bundle identity | Usually implicit in the Effect environment |
| Invalid states removed | Can separate read-capable and write-capable programs at the requirement level |
| Write after finalization | Not structurally impossible if a writer service value remains available; generally a checked failure |
| Backend assumptions | Can abstract filesystem/object storage |
| Effect requirements | Every operation carries ambient service requirements |
| Serialization | References need a loading/decoding service or later validation pass |
| Public API/LOC | Two services, constructors, Layers, errors, and store lifecycle |

Early concern: this split is not a filesystem permission boundary, cannot stop arbitrary code using `FileSystem`, makes wrong-bundle resolution easier to hide, and can represent a writer after finalization.

## Candidate B: `BundleDraft.add(...) -> finalize -> Bundle`

Sketch:

```ts
const draft = yield* BundleDraft.make(options)
const executable = yield* draft.add({
  name: "tool-linux-x64",
  source
})
const bundle = yield* draft.finalize(outputSchema, output)
```

After `finalize`, callers receive a different type with no `add` method.

Analysis:

| Property | Assessment |
| --- | --- |
| Canonical representation | Explicit draft state, finalized manifest, content objects, and output value |
| Bundle identity | Explicit on finalized `Bundle` and references |
| Invalid states removed | Write-after-finalization can be absent from the type surface; output/reference validation occurs during finalization/load |
| Filesystem/object storage | Draft implementation can stream to a backend; finalized Bundle can use a backend-neutral resolver |
| Effect requirements | Construction/finalization may require platform services; ordinary reads can be methods/functions on explicit values |
| Serialization | Finalized manifest and output Schema provide one durable boundary |
| Public API/LOC | Potentially smaller than two ambient services if state transition and storage backend are kept narrow |

Open question: TypeScript values can be retained or aliased before finalization. The implementation must ensure that an old draft handle cannot continue mutating after finalization; type-level absence alone is insufficient if the same mutable object escapes.

## Candidate C: immutable resolved artifact handles

Sketch:

```ts
const handle = bundle.resolve(ref)
const stream = handle.stream
const path = yield* handle.materialize({ name: "tool.exe" })
```

Analysis:

- bundle identity can be captured by the handle, eliminating repeated `(bundle, ref)` pairing;
- a handle can expose logical identity, size, digest, bytes/stream, and scoped logical-file materialization;
- provider code receives no private content-addressed path;
- handles are process-local and should not be serialized; durable state serializes references and resolves them once at load;
- backend substitutability is possible if handle operations close over a backend-neutral byte source;
- a handle can accidentally become too powerful if it exposes both storage internals and provider presentation.

This candidate composes naturally with Candidate B: load/finalize returns an immutable Bundle whose `resolve` operation produces handles.

## Candidate D: direct module functions accepting `(bundle, ref)`

Sketch:

```ts
const bytes = Bundle.bytes(bundle, ref)
const stream = Bundle.stream(bundle, ref)
```

Analysis:

- bundle identity is explicit at every call;
- wrong-bundle errors are visible rather than ambient;
- no new Effect services are required;
- easiest to make backend-neutral when Bundle is an explicit capability value;
- more repetitive than a resolved handle;
- public API can remain very small;
- nested output structures still require one load-boundary reference validation pass.

## Candidate E: capability-bearing `ArtifactRef<BundleId>`

A type-level bundle parameter can reduce accidental cross-bundle use:

```ts
interface ArtifactRef<BundleId> {
  readonly bundle: BundleId
  readonly logicalId: string
  readonly content: ContentId
}
```

Limits:

- branded generic IDs do not survive unknown JSON without decoding;
- runtime bundle identity remains necessary;
- compile-time brands do not prevent malicious or `any`-based construction;
- useful as an additional state reduction, not as the only check.

## Preliminary structural direction

The smallest promising model is currently:

```text
BundleDraft
  add logical artifacts and release-owned bytes
  finalize output Schema/value
      |
      v
immutable Bundle
  explicit bundle identity
  validated output
  resolve(ref) -> immutable handle
  scoped logical-file materialization
```

This is an **inference under test**, not a selected root API.

The model would establish these laws:

1. A finalized Bundle has no ingestion operation.
2. Every serialized reference names both its bundle and logical artifact.
3. Loading validates manifest, content digest/size, and all output references once.
4. A resolved handle belongs to exactly one loaded Bundle.
5. Provider-facing materialization uses the logical filename, not the backend path.
6. Logical artifacts and byte objects are separate: many logical artifacts may share one content identity.
7. Zero/one/many is represented by ordinary output data and Schema.

## Boundary validation

Proposed load sequence for evaluation:

```text
decode manifest and typed output
-> validate bundle identity and safe relative storage entries
-> load/inspect every referenced content object once
-> verify size and digest
-> validate every nested ArtifactRef against manifest and bundle ID
-> construct immutable Bundle and resolved output
```

After the boundary, internal operations should carry trusted values. Rehashing the same owned bytes before every provider call would recreate the current verification inversion.

## Scoped logical-file materialization

Command integrations may require a path. The required law is:

```text
handle.materialize(logicalName)
  -> scoped path whose basename is logicalName
  -> bytes equal the handle content
  -> path is removed when the scope closes
  -> no private bundle path is returned or embedded in command arguments
```

Direct HTTP integrations should normally use bytes/streams and avoid materialization.

## Backend comparison

| Backend | Draft behavior | Finalized behavior |
| --- | --- | --- |
| Local filesystem | copy/hash into private temporary storage; atomic manifest finalization | immutable directory/archive or copied content objects |
| Object storage | multipart/stream upload to temporary keys; commit manifest/root last | content-addressed or immutable objects referenced by manifest |
| CI artifact archive | construct ordinary directory, archive after finalization | extract and validate once on another runner |
| In-memory test | store bytes by content ID | deterministic fixture Bundle |

A backend abstraction is coherent when implementations satisfy the same ownership, immutability, reference, and failure laws. It need not wait for an existing adopter to be architecturally valid; whether to build it separately now is a priority decision.

## Generic-library test

A generic artifact-handoff library would be coherent only if its public contract excludes release-specific concepts and is independently useful for:

- build-to-deploy handoff;
- generated-code bundles;
- test-result or model artifact handoff;
- offline packaging pipelines;
- CI artifact transport.

Honest generic failures would include unsafe path, duplicate logical identity, source read failure, content digest mismatch, missing content, wrong bundle, output decode failure, and finalized draft. Provider names, release coordinates, publication status, and credentials do not belong in that library.

## Disposable compiling probe

A small probe will be committed under `docs/refactor/research/probes/` to answer one question only: can the public type transition make `add` absent after finalization while keeping bundle identity explicit and allowing two logical artifacts to share content? It is not production code.

## Remaining work

- Run the probe against the repository's pinned Effect/TypeScript versions.
- Compare Schema decoding service versus a private post-decode reference walk.
- Estimate production LOC for all candidates using the same local and object-storage laws.
- Exercise nested references in arrays, records, optional fields, and provider-owned Schema classes.
- Test path privacy with a fake command provider and fake HTTP provider.
- Determine whether a resolved handle should expose bytes, stream, and materialization directly or through small module functions.