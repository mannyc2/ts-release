# Artifact and bundle design

Status: research checkpoint. This document records the recommended artifact laws and remaining ownership decisions. It does not implement the production bundle API.

## Current implementation evidence

The rewrite should start from laws already earned by ts-release rather than inventing a second identity format:

- [`src/model/canonical.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/canonical.ts) provides strict canonical JSON, normalized strings, deterministic object-key ordering, bounded integer rules, length framing, and domain-separated SHA-256 helpers.
- [`scripts/lib/canonical-json.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/scripts/lib/canonical-json.ts) is the script-side counterpart used by release tooling.
- [`test/core/canonical-identity.test.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/test/core/canonical-identity.test.ts) checks stable key ordering, Unicode normalization, and domain separation.
- [`src/release/prepared.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/release/prepared.ts) shows the current split between prepared identity, manifest digest, public artifact records, and provider-specific prepared publications.
- [`src/model/artifact-collection.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/artifact-collection.ts) demonstrates normalized member keys, declared cardinality, logical output identity, media/kind checks, and duplicate-sensitive collection laws.

The present direction is to simplify the public model while preserving these earned laws.

## Recommended root model

### Direct immutable construction

The public API constructs a finalized immutable bundle directly. A caller does not receive a public mutable builder that later changes phase.

An implementation may use an accumulator internally while ingesting streams, directories, compiler outputs, or archives. That accumulator remains private to the constructor and is not serializable, provider-visible, or reusable after finalization.

```text
inputs and producer outputs
  -> private ingestion accumulator
  -> validation, normalization, and byte ownership
  -> canonical manifest
  -> immutable Bundle
```

This avoids a public `Draft -> finalize -> Bundle` state machine when the only lawful externally visible value is already finalized.

### One canonical manifest

A bundle has one canonical manifest. There is no independently stored `bundleId` field beside a manifest digest that can disagree with it.

```text
manifestBytes = canonicalJson(manifest)
bundleId = domainHash("ts-release/bundle-manifest/v1", manifestBytes)
```

The serialized manifest does not contain its own `bundleId`. On load, the decoder:

1. rejects noncanonical bytes;
2. decodes the versioned manifest Schema;
3. recomputes the domain-separated bundle ID;
4. validates every artifact entry and referenced blob; and
5. creates bundle-bound handles.

A storage index may cache the derived ID, but the ID is derived data and must be checked rather than trusted.

## Proposed canonical envelope

Illustrative shape only:

```json
{
  "schemaVersion": "ts-release/bundle-manifest/v1",
  "release": {
    "name": "example",
    "version": "1.2.3"
  },
  "artifacts": [
    {
      "artifactId": "cli-linux-x64",
      "kind": "executable",
      "mediaType": "application/octet-stream",
      "bytes": 123456,
      "sha256": "...",
      "metadata": {
        "os": "linux",
        "arch": "x64"
      }
    }
  ],
  "documents": [],
  "providerIntents": []
}
```

The exact fields remain a maintainer choice. The laws are more important than this example:

- schema version is explicit;
- keys and strings use the existing canonical implementation;
- arrays have domain-defined ordering rules;
- integer, path, and text constraints are total and checked;
- artifact IDs are unique;
- each artifact has exact size and content digest;
- no private filesystem path appears in the manifest; and
- bundle ID is derived from canonical manifest bytes under a versioned domain.

Provider intents may be stored in the same release envelope or in a separately domain-hashed journal root. If stored in the bundle manifest, they reference artifacts by bundle-relative identity and do not introduce provider-specific fields into the core artifact entry.

## Artifact identity and logical meaning

Content identity and logical artifact identity are different facts.

Two logical artifacts may share identical bytes while differing in:

- target platform;
- media type or executable role;
- public filename;
- package-manager role;
- producer operation; or
- provider intent.

The bundle therefore stores:

```text
ArtifactId     - unique logical identity within the bundle
ContentDigest  - byte identity, reusable by multiple ArtifactIds
```

A content-addressed backend may deduplicate bytes by digest. It must not collapse logical artifacts or provider intents merely because bytes match.

## Bundle-relative and qualified references

### Inside one envelope

References within one manifest are bundle-relative:

```json
{
  "kind": "bundle-relative",
  "artifactId": "cli-linux-x64"
}
```

The serialized reference intentionally does not repeat the bundle ID. Its meaning is defined by the containing canonical envelope.

### At the load boundary

A relative reference is not structurally bound merely because its string appears inside JSON. The loader resolves it against the decoded bundle and returns a bundle-bound handle:

```ts
interface BoundArtifactHandle {
  readonly bundleId: BundleId
  readonly artifactId: ArtifactId
  readonly digest: Sha256Digest
  readonly bytes: number
  readonly open: Effect<ByteStream, ArtifactReadError, ArtifactStore>
}
```

The handle cannot be created by a public unchecked constructor. Resolution fails if the artifact is absent, duplicated, has mismatched bytes, or violates the manifest.

### Across envelopes

Only references that independently cross an envelope carry a bundle qualifier:

```json
{
  "kind": "qualified",
  "bundleId": "sha256:...",
  "artifactId": "cli-linux-x64"
}
```

Examples include a journal stored separately from the bundle, a catalog that points to an earlier release bundle, or a cache index spanning many bundles. Qualified references are resolved through an explicit bundle store and then become the same `BoundArtifactHandle` shape.

## Byte ownership and lifetime

An artifact record is useful only if its bytes remain readable for the lifetime promised by the owning layer.

### Finalized ts-release bundle

The release bundle must support:

- reuse after process loss;
- continuation hours or days later;
- multiple provider reads without rebuilding;
- exact byte comparison during reconciliation; and
- independent cleanup after the release journal no longer references it.

A durable bundle store therefore owns or durably references the bytes before a bundle becomes final. It cannot rely on a producer's temporary directory remaining alive.

### Producer output

A build or compiler library may produce an output whose bytes are valid only inside a scope. The producer should return an owned output value or reader, not ask downstream code to guess a path.

Illustrative shape:

```ts
interface ProducedOutput {
  readonly logicalName: string
  readonly kind: string
  readonly mediaType: string
  readonly bytes: number
  readonly digest: Sha256Digest
  readonly open: Effect<ByteStream, OutputReadError, Scope>
}
```

The release program adopts the output while the producer scope is alive. Adoption copies or transfers the bytes into the bundle store, validates the declared digest and size, and assigns a bundle-local `ArtifactId`.

### No storage paths in provider contracts

Providers receive bound readers or materialized scoped resources. They do not receive private store paths as stable identity. A provider may request a temporary file for a CLI or HTTP library, but that path is scoped implementation detail and never serialized into the bundle, intent, receipt, or journal.

## Root output ownership

The top-level release program owns the release bundle because it is the first layer that knows:

- which producer outputs participate in one release;
- their logical public roles;
- provider intents;
- durable continuation requirements; and
- cleanup authority.

Build libraries own their output creation and scoped lifetime. They do not own the release bundle or provider meaning.

Recommended boundary:

```text
producer library
  -> zero or more ProducedOutput values
release program
  -> adopts selected outputs
  -> creates logical ArtifactIds and provider-relative references
  -> finalizes one durable Bundle
provider package
  -> reads only the bound artifacts referenced by its Intent
```

This permits a build result to be used outside ts-release while keeping release-specific identity and durability in ts-release.

## Exact shared laws with effect-build

At the exercised pin, effect-build's public standalone artifact contains an absolute path, byte count, optional digest, target, and stage observations. See [`Artifact.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/standalone/Artifact.ts).

The exact laws plausibly shared by effect-build and ts-release are narrower than a complete bundle API:

1. output size is a nonnegative safe integer;
2. a present digest has one canonical algorithm and encoding;
3. an output has logical producer or target metadata distinct from bytes;
4. output bytes must be readable while the declared owner is alive;
5. consumers must not mutate finalized output metadata; and
6. duplicate logical identities within one owner are rejected.

The lifetime laws differ:

| Concern | effect-build output | ts-release bundle |
| --- | --- | --- |
| Typical owner | compiler/build scope | durable release store and journal |
| Expected lifetime | often one build invocation | process-independent continuation |
| Path exposure today | absolute path in public artifact | should be absent from serialized model |
| Identity scope | compiler operation/target | release bundle and provider intents |
| Cleanup | scope close or build cleanup | reference-aware release cleanup |

This difference may justify separate resource APIs even if a small immutable output-description type is shared.

## Generic-library boundary

The earlier rule that a second adopter must prove architectural validity is removed.

- **Laws determine validity.** A generic abstraction is valid when its semantics are coherent and its invariants are exact.
- **Adoption and maintenance determine packaging priority.** A separate package is worthwhile when multiple call sites, ownership boundaries, release cadence, or maintenance cost justify it.

A minimal generic output library is justified only if it can state exact laws without leaking either effect-build's scratch lifetime or ts-release's release semantics. Candidate shared pieces are canonical digest/size values and immutable output descriptions. Bundle manifests, provider references, durable stores, and journal integration remain ts-release-specific unless another domain independently has the same laws.

## Provider-facing artifact access

Provider packages should request the artifacts named by their own intent:

```text
Intent
  -> one or more bundle-relative ArtifactIds
  -> load-time BoundArtifactHandles
  -> provider-specific materialization or streaming
```

The core can enforce:

- reference belongs to the loaded bundle;
- expected logical kind and media type;
- exact digest and size;
- duplicate-reference policy; and
- scoped cleanup of temporary materializations.

The provider owns filename normalization, multipart or package assembly, and remote byte-observation laws.

## Probe evidence and limits

The disposable probes remain useful counterexamples and type experiments, not production designs.

### Owned-bundle probe

[`artifact-owned-bundle.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/docs/refactor/research/probes/artifact-owned-bundle.ts) demonstrates copied-byte ownership and duplicate checks. It still exposes `Bundle.fromValidated` and uses a provisional identity construction. It does not establish the production constructor, canonical manifest, durable store, or cleanup protocol.

### Reference-scope probe

[`artifact-reference-scope.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/docs/refactor/research/probes/artifact-reference-scope.ts) illustrates relative and qualified references. A serialized relative reference becomes structurally bundle-bound only after load-time resolution into a handle.

### Effect load-boundary probe

[`artifact-schema-load.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/docs/refactor/research/probes/artifact-schema-load.ts) demonstrates in-memory Schema decoding and typed load errors. It does not establish persistence, streaming, transactional storage, interruption safety, or recovery after process loss.

### Negative assertions

The corrected probe commit adds missing negative assertions and makes runtime failures propagate. This improves truthfulness of the experiment but does not promote the probe types into the production design.

## Recommended direction

1. Use direct immutable bundle construction as the public model.
2. Keep ingestion accumulators private.
3. Reuse the existing canonical JSON implementation and add an explicit `bundle-manifest/v1` hash domain.
4. Derive one bundle ID from one canonical manifest; do not persist an unchecked ID peer.
5. Use bundle-relative references inside one envelope.
6. Resolve references into nonforgeable bundle-bound handles at load time.
7. Use qualified references only when crossing envelopes independently.
8. Let the release program own durable root outputs and provider meaning.
9. Let producer libraries own construction and scoped output readers.
10. Share only laws that are exact across effect-build and ts-release; lifetime differences remain first-class.

## Genuine remaining choices

Maintainers still need to decide:

- whether provider intents live in the bundle manifest or in a separately hashed journal root;
- the durable bundle-store backend and transaction boundary;
- whether bundle adoption copies bytes eagerly or supports a durable transfer protocol;
- the exact public `ProducedOutput` and `BoundArtifactHandle` APIs;
- cleanup and retention policy after terminal or abandoned releases;
- which artifact metadata is canonical identity versus advisory observation; and
- whether the minimal shared output-description values remain duplicated, move to effect-build, move to ts-release, or become a small independent package.

These are implementation and packaging choices around an already supported set of artifact laws. No production implementation is included here.
