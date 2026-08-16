# Artifact ownership, persistence, and effect-build boundary

Status: canonical byte-ownership continuation of `artifact-model.md`.

## Internal immutable-content kernel

The kernel remains an internal extraction-ready library within ts-release:

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

It lives in its own directory, imports nothing from release planning or providers, and can later be extracted without changing its laws. It does not move into effect-build and does not acquire provider, destination, acceptance, or journal concepts.

Revisit separate packaging only if effect-build planning, currently Candidate C2 in its PR #4, converges on directly emitting into this exact persistent kernel. That is a sequencing decision, not a challenge to the kernel's coherence.

## Adoption law

A producer returns either a scoped intermediate or a finalized output at a caller-selected path. ts-release adopts finalized bytes by:

1. streaming them into release-owned storage;
2. computing digest and length during copy;
3. rejecting mutation during adoption;
4. committing the content object before manifest reference;
5. publishing the manifest/commit marker last.

Providers receive bound artifact handles or scoped materialized filenames, never private CAS paths.

## effect-build boundary

```text
effect-build
  generic concrete artifact production and transformation
  tool discovery and execution
  scoped staging and intermediate ownership
  caller-selected finalized outputs
  artifact-specific validation

ts-release
  adoption into immutable release bundle
  provider planning and mutation
  durable journal/recovery
  provider-native evidence and reporting
```

The current effect-build statement that it is not a generic packager describes its current consumers. The coherent domain law is concrete transformation from explicit inputs to validated artifact outputs with explicit lifetime and ownership.

This supports concrete integrations such as:

```text
effect-build-archive
effect-build-uv
effect-build-poetry
effect-build-nfpm
effect-build-apple
```

without a universal Builder.

## Apple finalization law

`effect-build-apple` owns:

- app bundle construction;
- DMG/pkg construction;
- local codesign/productsign work;
- notary submission;
- status recovery through Apple's submission identifier;
- stapling;
- final verification.

An Apple artifact is not finalized until notarization acceptance, stapling where applicable, and verification complete. ts-release sees only the finalized artifact and therefore preserves:

```text
finalize every artifact
-> adopt immutable bytes
-> plan and perform distribution mutations
```

The notary call is a remote and potentially ambiguous operation, but that ambiguity is internal to artifact production. `effect-build-apple` must recover it by submission identifier. It never enters ts-release's provider journal, and the bundle kernel needs no pre-finalization durability.

A failed or abandoned Apple production run produces no final artifact for adoption. Re-running artifact production is distinct from replaying a ts-release distribution mutation.

## Production outcome ownership

The canonical vNext production/trust families are P01-P10 in `competitive-scope.md`. This file does not maintain a second count.

- executable matrices remain concrete compiler integrations;
- wheels/sdists belong to uv/Poetry production integrations;
- Warehouse publication belongs to ts-release;
- nFPM creates package artifacts; later repository publication is separate;
- Apple construction/signing/notarization/stapling belongs to `effect-build-apple`;
- archives are concrete transformations.

## Validation boundaries

At adoption:

- derive digest and length from bytes actually copied;
- own the resulting object;
- verify producer output is stable through the copy.

At untrusted bundle import:

- decode canonical manifest;
- validate IDs/references;
- verify content objects according to backend trust policy.

Within one trusted immutable store, repeated reads need not rehash every object. Verification may be lazy or explicit.

## What this decision does not add

- no universal Builder;
- no cross-project artifact registry;
- no pre-finalization ts-release journal;
- no Apple publication provider in ts-release;
- no synchronized effect-build/ts-release state model.
