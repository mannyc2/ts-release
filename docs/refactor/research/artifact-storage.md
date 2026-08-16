# Artifact ownership, persistence, and effect-build boundary

Status: continuation of `artifact-model.md`.

## Universal artifact kernel

```text
ContentObject {
  digest,
  byteLength
}

LogicalArtifact {
  artifactId,
  contentDigest
}
```

Release, provider, destination, filename, platform role, package type, and consumer-test facts remain outside this kernel.

## Ownership transfer

A producer can return:

- a scoped intermediate that must be consumed before scope close; or
- a finalized output at a caller-selected path.

ts-release adopts either form by streaming bytes into release-owned storage, computing digest and length during the copy, and committing the content object before referencing it from the manifest.

No provider receives a private CAS path. It receives a bound handle that can stream bytes or materialize a scoped logical filename.

## Current effect-build lifetime evidence

The pinned granular branch already has two distinct laws:

1. `JavaScriptBundle.withFile`/owned bundle operations: a scoped artifact is valid only during a callback.
2. `Integration.produceExecutable`: validates and atomically publishes an executable to a caller-selected destination.

Sources:

- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/JavaScriptBundle.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts

ts-release can adopt a scoped output inside the callback or choose a private adoption path as the finalized destination.

## Is packaging inside effect-build's domain?

The current README says effect-build is not a generic build orchestrator or packager. That accurately limits the shipped product. It is not by itself a semantic proof that archives, wheels, system packages, app bundles, DMGs, and pkgs belong elsewhere.

The coherent shared law is narrower:

> A concrete integration transforms explicit inputs into validated artifact outputs with explicit lifetime and ownership.

This law supports concrete packages such as:

```text
effect-build-uv
effect-build-poetry
effect-build-nfpm
effect-build-apple
effect-build-archive
```

without introducing a universal Builder service.

Each integration can retain provider/tool-specific input, errors, stages, and outputs. The common infrastructure may include process execution, scoped staging, final-path publication, digesting, and artifact adoption.

## Notarization tension

Local signing is an artifact transformation. Apple notarization is an external mutation followed by status polling, and stapling may change final bytes.

Alternatives:

1. effect-build owns the complete operation, including remote notary calls;
2. ts-release owns notary submission/recovery, then invokes an effect-build stapling transform;
3. a dedicated Apple release-run integration owns both and participates in the same journal;
4. notarization occurs before the release bundle and uses a separate durable production journal.

Counterexample to a simple boundary:

```text
all artifacts finalized
-> all provider mutations
```

A notarized/stapled DMG cannot be finalized before the remote notary outcome if stapling is part of the promised bytes.

Recommendation: include one notarization trace/prototype before freezing the production/release phase boundary. Do not force notarization into effect-build merely because it produces an artifact, and do not force it into ts-release merely because it calls a remote service.

## Generic-library packaging

Artifact-handoff laws can be independently valid even with one current adopter. Packaging priority depends on:

- independent usefulness;
- maintenance and release cadence;
- whether effect-build and ts-release need the exact same persistent-lifetime law;
- whether the abstraction reduces rather than adds states.

Lifetime differences matter:

- effect-build scoped intermediates can disappear after use;
- ts-release bundle objects must survive process and runner loss.

A shared package should therefore contain only immutable content/logical-reference laws, not ts-release retention, provider Intent, or release journal concepts.

## Validation boundaries

At adoption:

- copy/read producer bytes;
- derive digest and length;
- reject mutation during copy;
- own the final object.

At untrusted bundle import:

- decode canonical manifest;
- validate IDs and references;
- verify content objects according to backend trust policy.

Inside one trusted immutable CAS domain:

- do not rehash every object on every read;
- verify lazily on first access or through an explicit audit when the backend needs it.

A manifest/commit marker published last prevents readers from accepting a partially written bundle.

## Competitive-scope projection

The canonical list of production outcomes is `competitive-scope.md`. This file does not maintain a separate scope list.
