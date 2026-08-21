# Artifact kernel, ownership, and persistence boundaries

Status: research and design checkpoint. This document reopens the artifact conclusion and derives the smallest reusable kernel from artifact laws. It does not implement a production bundle API or choose a storage backend.

## Fixed product context

The shipping rewrite includes npm, PyPI/Warehouse, GitHub Releases/assets, Homebrew formulas, Scoop, and arbitrary custom providers. The artifact kernel must support all of them without containing their provider models.

## Source pins

- current canonical implementation: [`src/model/canonical.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/canonical.ts)
- script-side canonical implementation: [`scripts/lib/canonical-json.ts`](https://github.com/mannyc2/ts-release/blob/269b8673f596cd586e7ff6ae378a4e318fe0c331/scripts/lib/canonical-json.ts)
- current prepared manifest: [`src/release/prepared.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/release/prepared.ts)
- current prepared store: [`src/release/prepared-store.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/release/prepared-store.ts)
- artifact collection model: [`src/model/artifact-collection.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/artifact-collection.ts)
- effect-build granular branch: [`15c811bb9904142a33d119766b62082f3c689f13`](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13)

## 1. Universal artifact laws

A reusable artifact handoff needs only laws that hold independent of release provider, package manager, platform role, or consumer.

### Law A1: exact immutable content

A finalized content object has:

```text
ContentDigest
ByteLength
ReadableBytes
```

Reading the object yields exactly the bytes whose digest and length are recorded.

### Law A2: durable ownership

A finalized bundle owns or durably references its content for the bundle's declared lifetime. It does not depend on a mutable workspace path or a producer scope that has already closed.

### Law A3: logical identity differs from content identity

Two logical artifacts can share one content object.

```text
ArtifactId A -> digest X
ArtifactId B -> digest X
```

The kernel does not collapse A and B because their provider roles may differ.

### Law A4: one manifest commit

One canonical manifest names every logical artifact and referenced content object. Bundle identity is derived from that manifest. No unchecked stored bundle ID is a peer authority.

### Law A5: references resolve within an explicit bundle

A relative artifact reference is meaningful only inside one canonical bundle or plan envelope. At the load boundary it resolves into a bundle-bound value.

### Law A6: finalization is one-way

No public finalized bundle value supports ingestion or mutation. Any accumulator is private and cannot outlive construction.

## 2. Fields that do not follow from universal artifact law

The following facts may be useful elsewhere, but they are not universal artifact-kernel fields:

- release name or version;
- source commit;
- documents or release notes;
- provider Intents or destinations;
- npm package name/version;
- Python project/filename;
- GitHub public asset name;
- Homebrew formula semantics;
- Scoop manifest semantics;
- target OS/architecture;
- central `kind` such as executable/archive/package/digest;
- generic `metadata: Record<string, unknown>`;
- private storage path; and
- consumer acceptance status.

Putting these fields in the kernel enlarges the state space by allowing combinations such as an `archive` kind with nonarchive bytes, a provider destination without a release plan, or untyped metadata that downstream code casts differently.

Typed release and provider models can refer to artifact IDs without making those meanings kernel facts.

## 3. Candidate models

### Candidate K1: release-shaped bundle

```text
Bundle {
  release,
  documents,
  artifacts { kind, mediaType, metadata },
  providerIntents,
  objects
}
```

**Strength:** one envelope appears self-contained.

**Counterexamples:**

- the same artifact bundle can be reused by a different release plan or acceptance policy;
- provider Intents have independent schema evolution and authorization semantics;
- a generic metadata map becomes a second untyped model;
- one central kind union must grow for every producer or package manager.

**Conclusion:** rejected as a reusable artifact kernel. A higher release envelope may compose bundle, plan, and journal references.

### Candidate K2: content-only object set

```text
Bundle {
  objects: [{ digest, bytes }]
}
```

**Strength:** minimal immutable CAS.

**Counterexample:** two logical artifacts sharing bytes become indistinguishable, and provider Intents cannot refer to stable logical roles without inventing external path identity.

**Conclusion:** too small.

### Candidate K3: content objects plus logical artifact mapping

```text
ArtifactBundleManifest {
  schemaVersion,
  objects: [{ digest, byteLength }],
  artifacts: [{ artifactId, contentDigest }]
}
```

**Strengths:**

- exact content and logical identity are separate;
- duplicate bytes can be deduplicated;
- no provider or release facts leak in;
- zero, one, and many artifacts use one collection;
- the manifest is suitable for local files or object storage.

**Counterexample addressed:** provider filenames and target roles are modeled by typed plans referencing `artifactId`.

**Provisional recommendation:** strongest kernel, high confidence.

### Candidate K4: path manifest

```text
artifacts: [{ artifactId, path, digest, size }]
```

**Strength:** easy local implementation.

**Counterexamples:**

- path identity is backend-specific;
- path can escape the bundle root;
- mutable file replacement creates check-to-use gaps;
- object storage has no stable filesystem path.

**Conclusion:** path can be an implementation index, not canonical artifact identity.

## 4. Recommended minimal manifest

Illustrative only:

```json
{
  "schemaVersion": "artifact-bundle/v1",
  "objects": [
    {
      "digest": "sha256:...",
      "byteLength": 1234
    }
  ],
  "artifacts": [
    {
      "artifactId": "cli-linux-x64",
      "content": "sha256:..."
    }
  ]
}
```

Laws:

- arrays have one specified canonical order;
- object digests are unique;
- artifact IDs are unique;
- every artifact references exactly one declared object;
- unreferenced objects are rejected;
- bundle ID is the domain-separated hash of canonical manifest bytes;
- the manifest contains no bundle ID field;
- no path appears in the canonical model; and
- byte length is canonical on the content object, not repeated on each artifact.

## 5. Release plan and artifact references

A separate canonical release plan contains provider and release meaning:

```text
ReleasePlan {
  schemaVersion,
  bundleId,
  releaseFacts,
  intents,
  dependencyEdges
}
```

Provider Intents reference bundle-local artifact IDs:

```text
GithubAssetIntent {
  parentReleaseIntent,
  requestedName,
  contentType,
  artifact: ArtifactRef("cli-linux-x64")
}
```

Digest and size are resolved from the bundle. They are not repeated in the Intent unless they independently cross another envelope or are themselves part of a provider coordinate.

### Operation identity and bundle-relative references

If `IntentId` is derived from canonical Intent bytes and the Intent contains a relative artifact ID, the globally qualified operation is:

```text
(planId, IntentId)
```

The canonical `planId` binds one `bundleId` and all Intents. This avoids copying artifact digest and size into every provider Intent merely to make identity content-sensitive.

## 6. Provider-specific typed meanings

Examples outside the kernel:

```ts
interface ExecutableRole {
  readonly artifact: ArtifactRef
  readonly target: SystemTarget
}

interface NpmTarballRole {
  readonly artifact: ArtifactRef
  readonly packageName: string
  readonly version: string
}

interface WarehouseFileRole {
  readonly artifact: ArtifactRef
  readonly project: string
  readonly filename: string
}

interface PublicAssetRole {
  readonly artifact: ArtifactRef
  readonly requestedName: string
  readonly mediaType: string
}
```

These values can be Schema-backed within the release plan. They do not require a central artifact-kind union.

## 7. Bound artifact access alternatives

### Alternative H1: ambient `ArtifactStore`

```ts
handle.open: Effect<Stream, Error, ArtifactStore>
```

**Strength:** backend is replaceable through DI.

**Counterexamples:**

- the active store and bundle are implicit;
- a handle from bundle A can be evaluated with store B;
- every caller carries an environmental requirement even after resolution;
- tests can accidentally provide a store that contains another object with the same digest under different trust assumptions.

**Conclusion:** not entailed.

### Alternative H2: direct `(bundle, ref)` functions

```ts
Bundle.open(bundle, ref)
```

**Strength:** bundle identity is explicit and wrong-bundle resolution is visible.

**Tradeoff:** every use passes the bundle; provider code can retain a relative ref without a bound resolution step.

### Alternative H3: resolved handle closes over a backend-owned capability

```ts
interface ResolvedArtifact {
  readonly bundleId: BundleId
  readonly artifactId: ArtifactId
  readonly digest: Digest
  readonly byteLength: number
  readonly stream: Effect.Effect<Stream.Stream<Uint8Array, ReadError>>
  readonly materialize: Effect.Effect<LogicalFile, ReadError, Scope.Scope>
}
```

The constructor is private to the validated loader. The handle carries the backend operation internally rather than requiring a globally active store.

**Strengths:**

- bundle identity is explicit;
- provider code cannot forge or resolve wrong-bundle refs;
- backend remains replaceable at bundle-load time;
- provider APIs receive only readable content and logical materializations.

**Tradeoff:** a handle is process-local and not itself serializable.

**Provisional recommendation:** H3 for in-process use, with H2 as the lower-level implementation form. Confidence is moderate because exact Effect resource typing still needs a compiling design probe.

## Continued research

The remaining sections continue in [artifact-storage.md](./artifact-storage.md).
