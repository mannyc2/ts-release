# Artifact model

Status: recovered research checkpoint. No root artifact API is selected.

This document separates facts demonstrated by disposable probes from laws that
would still have to be implemented and tested. The probes are not production
code and are not evidence that a release store, archive format, or public API
has been selected.

## Required laws

Any later artifact model must satisfy these laws independently of its syntax:

1. **Owned bytes.** After ingestion, later mutation of caller-owned memory or a
   workspace file cannot change the bytes used by publication.
2. **Content identity.** A content identifier is derived from, or checked
   against, the bytes it names. The identity format is versioned and domain
   separated.
3. **Logical identity.** Duplicate logical artifact identifiers are rejected;
   no map insertion may silently replace an earlier artifact.
4. **Bundle identity.** A finalized bundle identity changes when its canonical
   manifest or referenced bytes change. Canonicalization is deterministic
   across hosts and locales.
5. **Construction boundary.** Callers cannot construct a trusted finalized
   bundle merely by asserting that unvalidated maps and identities are valid.
6. **Load boundary.** Schema decoding, content checks, duplicate checks, and
   reference checks happen before provider work and return typed failures.
7. **Finalization.** A finalized value exposes no ingestion operation. If a
   mutable draft design is used, an aliased pre-finalization handle must also be
   closed at runtime after finalization.
8. **Reference ownership.** A durable reference can be resolved only by its
   owning bundle. A relative reference becomes safe only after load-time
   resolution into a bundle-bound value or handle.
9. **Path privacy.** A provider sees a logical name and bytes, stream, or scoped
   materialization. It does not receive a private content-store path.
10. **Cardinality.** Zero, one, and many artifacts are ordinary collections.
    Multiplicity is not a feature flag.
11. **Shared content.** Two logical artifacts may share the same immutable byte
    object without sharing logical identity or meaning.

## What the original probe actually establishes

`probes/artifact-finalization.ts` is intentionally a counterexample-rich type
probe. Its returned Bundle type has no add method. It also shows that a
provider-facing `LogicalFile` type can expose a logical name, media type, and
bytes without exposing a private storage path.

Those are the only positive conclusions established by that probe. In
particular, the probe also demonstrates why the stronger sentence
"write-after-finalization is unrepresentable" was not justified:

- a retained persistent draft can be finalized repeatedly;
- two finalizations can use the same caller-supplied bundle ID while containing
  different logical artifacts;
- input and output `Uint8Array` values alias internal storage;
- the byte-object ID is supplied by the caller rather than derived or checked;
- duplicate artifact and byte-object IDs overwrite entries;
- `Bundle` has a public constructor; and
- missing and wrong-bundle lookups throw generic `Error` values outside the
  Effect error channel.

The narrower result is therefore:

> The static type of one returned value can omit `add`, and one provider-facing
> projection can omit a private path. The probe does not establish immutable
> ownership, trustworthy identity, unique finalization, private construction,
> or typed load failures.

## Probe results and remaining counterexamples

### Owned-bundle probe

`probes/artifact-owned-bundle.ts` tests a persistent immutable draft candidate.
It currently demonstrates, within one in-memory process:

- ingestion copies caller-owned bytes;
- object IDs are derived from SHA-256 bytes;
- duplicate logical artifact IDs return a typed result;
- two logical artifacts can share one content object;
- repeated finalization of the same persistent value is deterministic in the
  tested process;
- divergent persistent drafts produce different bundle IDs in the tested
  examples;
- resolved bytes are copied before being returned;
- encoding and decoding reject missing objects, duplicate IDs, changed object
  bytes, and a mismatched bundle identity.

It does **not** establish a production bundle law. Important counterexamples and
limitations remain visible in the file:

- `Bundle.fromValidated` is public and accepts a claimed trusted state;
- bundle identity uses ad hoc JSON encoding rather than a specified canonical
  binary or text encoding;
- code-unit sorting avoids locale dependence but is not yet a versioned
  canonicalization specification;
- the bundle hash is not domain separated from object hashes and its identity
  input has no explicit hash-domain version;
- the manifest identity includes object IDs and sizes but not an independently
  specified serialization of every manifest field;
- the SHA-256 collision or corrupted-map branch is an unchecked defect;
- no filesystem, object-store, streaming, crash, atomic-manifest, symlink, or
  archive extraction law is tested; and
- a persistent draft may be finalized more than once by design. This is lawful
  only if finalization means deterministic construction, not one-shot closure.

The probe compiles and runs, but that proves only its executable assertions.

### Effect load-boundary probe

`probes/artifact-schema-load.ts` tests private construction and typed Effect
failures at a load boundary. It demonstrates that a decoded bundle can reject
malformed manifests, duplicate artifact/object IDs, missing objects, missing
artifacts, and a qualified wrong-bundle lookup without generic throws. It also
copies bytes on load and on resolution.

Its limits are deliberate:

- manifest and object IDs are strings supplied by the fixture, not derived;
- a bundle ID is not checked against manifest or byte content;
- it validates one in-memory shape, not a durable backend;
- the relative resolver is safe only because the caller already has a loaded
  `Bundle`; and
- it does not prove one traversal can discover arbitrary nested references in a
  caller-defined output Schema.

### Reference-scope probe

`probes/artifact-reference-scope.ts` compares two representations:

```text
BoundOutput { bundleId, value containing relative artifact IDs }
QualifiedArtifactRef { bundleId, artifactId }
```

The probe illustrates the representation tradeoff. A relative reference is not structurally tied
to its bundle and can be copied out of the envelope. The
strong relative-reference law would require load-time resolution into a
bundle-bound handle or value whose constructor is private. A globally qualified
reference carries duplicate bundle identity but preserves wrong-bundle checking
when transported independently.

The probe therefore does not choose relative references. It identifies the law
that a relative design must add.

## Small candidates still under consideration

The LOC figures below are research-probe LOC, not production estimates. They
make the comparison concrete without pretending that backend, Schema, tests,
streaming, and migration code are free.

| Candidate | Probe basis | Probe LOC | Core law | Counterexample that disqualifies an implementation |
| --- | --- | ---: | --- | --- |
| Direct immutable build | `artifact-owned-bundle.ts` without an exposed draft | 335 total in current combined probe | Ingest all declared inputs, copy/hash them, validate duplicates, then privately construct one Bundle. | Constructor accepts caller IDs or mutable byte aliases. |
| Persistent immutable draft | `artifact-owned-bundle.ts` | 335 | `add` returns a new value; any retained earlier value remains valid but cannot mutate later values; finalization is deterministic for a draft value. | Internal maps/bytes are shared mutably, or divergent contents can retain one bundle identity. |
| Runtime-closed mutable draft | Original type transition plus a closed-state check; no complete probe yet | estimated 120-180 for only the in-memory kernel | First successful finalization atomically closes every alias to the shared mutable state; later add/finalize calls fail with typed `DraftClosed`. | An old alias continues to ingest or finalizes a divergent bundle after closure. |
| Bundle-bound resolved handle | `artifact-schema-load.ts` plus a private handle constructor | 177 in the current load probe | Load resolves a relative ID against exactly one Bundle and returns a handle that cannot be rebound. | A plain relative ID escapes and is resolved against whichever bundle is later supplied. |
| Globally qualified durable ref | `artifact-reference-scope.ts` | 95 | Every independently transportable reference names both bundle and artifact and is checked at load/use. | Decoder accepts a ref whose bundle ID differs from the enclosing durable record without rejecting it. |

These candidates can be combined. For example, a persistent immutable draft can
finalize into a Bundle whose decoded output contains bundle-bound handles. The
point of the table is to keep the decisions separate:

- draft mutability/lifetime;
- durable identity and canonical encoding;
- durable reference qualification; and
- runtime provider-facing access.

## Candidate laws in more detail

### Candidate A: direct immutable build

Shape:

```ts
Bundle.build({ artifacts, outputSchema, output })
```

Required laws:

- input enumeration finishes before the Bundle exists;
- duplicate logical IDs fail before any trusted Bundle is returned;
- bytes are copied or transferred into release ownership;
- object identity is derived from the owned bytes;
- bundle identity is derived from one documented canonical manifest format;
- construction is private outside the validating function; and
- build failure returns typed errors without exposing a partially trusted
  Bundle.

This is the smallest state space when callers can enumerate all artifacts at
once. Counterexample: a compiler that discovers output incrementally and must
stream large files would need buffering or another builder protocol.

### Candidate B: persistent immutable draft

Shape:

```ts
const next = yield* Draft.add(previous, input)
const bundle = yield* Draft.finalize(next, schema, output)
```

Required laws:

- `add` never mutates `previous`;
- every draft owns or immutably shares content objects;
- repeated finalization of one value returns the same identity and bytes;
- finalizing an earlier retained value is legal and produces the earlier
  content, not a conflicting bundle with a shared claimed ID; and
- IDs are derived, never assigned to make two drafts appear identical.

This model avoids a runtime closed-state but does not make finalization one-shot.
That is not a defect if the public law is deterministic immutable construction.
Counterexample: claiming "no finalization after finalization" while exposing
persistent earlier values would be a false law.

### Candidate C: runtime-closed mutable draft

Shape:

```ts
const draft = yield* Draft.make()
yield* draft.add(input)
const bundle = yield* draft.finalize(schema, output)
```

Required laws:

- aliases share one internal state machine;
- the state transition from Open to Finalized is atomic;
- all mutation methods check the shared state;
- finalization publishes no trusted value until manifest/content validation
  finishes;
- a failed finalization has an explicitly chosen retry/closed law; and
- cancellation cannot leave a trusted manifest pointing at incomplete bytes.

This model can support streaming and incremental discovery with fewer copied
maps. It relies on runtime state, not TypeScript linearity. Counterexample: a
method returning a `Bundle` type with no `add` while an old draft alias remains
open does not satisfy the law.

## Construction and decoding boundary

A production load operation would need a versioned format and a sequence at
least as strong as:

```text
decode format/version
-> validate canonical manifest shape and safe storage entries
-> reject duplicate logical and object IDs
-> load each referenced unique object
-> derive/check digest and size
-> validate every logical entry points at a present object
-> decode typed output
-> resolve every output reference against this Bundle
-> construct Bundle and bundle-bound runtime values privately
```

A backend may defer reading large content until streaming, but then the load law
must state what was checked eagerly and what typed read-integrity failure can
still occur later. Saying "validated once" is only true if the backend prevents
or detects later mutation.

## Provider-facing values

Provider code should not learn a private digest path. Small lawful projections
include:

```ts
interface LogicalFile {
  readonly logicalName: string
  readonly mediaType: string
  readonly size: bigint
  readonly bytes: Effect.Effect<Uint8Array, ArtifactReadError>
}
```

or a scoped materialization:

```text
materialize(logicalName)
-> path basename equals the requested safe logical name
-> bytes equal the bundle-bound content
-> private store path is not returned
-> temporary path is removed when Scope closes
```

Direct HTTP providers should normally consume bytes or streams. Command-based
providers may need scoped materialization. This requirement does not by itself
entail ambient `ArtifactReader` or `ArtifactWriter` services.

## Backend questions not proved

No current probe establishes these backend laws:

- atomic manifest commit after all objects are durable;
- crash recovery during object ingestion;
- immutable or integrity-checked object reads after load;
- safe archive extraction and symlink handling;
- content garbage collection and retention;
- multipart upload recovery;
- cross-machine bundle transfer;
- CI artifact archive import;
- object-store authorization boundaries; or
- scoped temporary-file cleanup under interruption.

A backend abstraction is justified only when two implementations satisfy the
same externally visible ownership, identity, load, and failure laws. The
existence of a filesystem and an object store does not by itself require two
ambient public services.

## Remaining maintainer choices

The evidence is sufficient to frame, but not decide, these questions:

1. Does the first implementation need incremental streaming construction, or
   can it build one immutable Bundle from a complete artifact list?
2. Is persistent immutable finalization acceptable, or is one-shot runtime
   closure a product requirement?
3. Are durable references globally qualified, or are they relative only inside
   a decoded envelope that resolves immediately to bundle-bound handles?
4. Which canonical encoding and domain-separated identity format is supported
   and versioned?
5. Which integrity checks are eager at load and which remain typed read-time
   checks?
6. Is artifact handoff an internal ts-release module first, or a separately
   versioned generic library after a second adopter exists?

No root artifact API is selected. The next implementation step must wait for
those choices and for a production-grade format/backend proof; this checkpoint
contains neither.
