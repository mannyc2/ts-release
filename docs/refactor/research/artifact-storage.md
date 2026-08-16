# Artifact ownership, persistence, and effect-build boundary

Status: canonical ownership research. The effect-build/ts-release boundary is
accepted; Apple notarization recovery remains unresolved within effect-build.

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

Release, provider, destination, public filename, platform role, package kind,
and consumer-test facts remain outside this kernel.

## Ownership transfer

A producer can return:

- a scoped intermediate valid only inside a callback; or
- a finalized output at a caller-selected path.

ts-release adopts either by streaming bytes into release-owned immutable
storage, deriving digest and length during the copy, and committing the content
object before the manifest references it.

Providers receive a bundle-bound handle or scoped logical filename, never a
private CAS path.

## Current effect-build lifetime evidence

The pinned granular branch exposes two useful contracts:

1. scoped JavaScript bundle access; and
2. `produceExecutable` publication to a caller-selected final path.

Sources:

- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/JavaScriptBundle.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts

The internal extraction-ready bundle library remains inside ts-release for now.
Its laws are independently coherent; packaging priority is separate from
architectural validity.

## Accepted responsibility boundary

```text
effect-build
  concrete artifact production and transformation
  tool discovery and execution
  scoped intermediate ownership
  producer-specific validation
  caller-selected finalized output

ts-release
  adoption into immutable release-owned content
  release planning
  provider mutation
  durable journal/recovery
  reporting
```

No universal `Builder` follows. Concrete uv, Poetry, nFPM, archive, and Apple
operations may share lower-level process and ownership infrastructure without
sharing one root operation type.

## Apple notarization ownership

The maintainer decision is:

```text
effect-build-apple owns
  submission
  polling
  response-loss recovery
  stapling
  final verification

ts-release adopts only finalized bytes
```

This resolves package responsibility, not the durable recovery design.
Notarization remains an asynchronous external mutation. A fresh process needs:

- a durable submission identifier or request fingerprint;
- exact pre-notarization input identity;
- Apple account/team/profile identity without secret persistence;
- polling state and terminal result;
- a rule for resubmission after response loss;
- durable access to the input bytes; and
- a path from acceptance to stapled, verified final bytes.

Possible effect-build designs include:

1. an effect-build-owned durable operation record;
2. a small generic durable production-run facility;
3. caller-supplied persistence callbacks/Layer; or
4. integration with a later durable engine while retaining the same external
   mutation law.

A same-process retry loop is insufficient for the vNext acceptance promise.

## P10 status

Apple notarization/stapling remains required in the 16-family vNext acceptance
scope, but its durable design is unresolved. It is not architecturally closed
merely because ownership moved to effect-build-apple.

The ts-release artifact law remains simple:

```text
notarization and stapling complete
-> effect-build-apple verifies final bytes
-> ts-release adopts final bytes
```

No pre-finalization ts-release journal is introduced.

## Validation boundaries

At adoption:

- stream producer bytes;
- derive digest and length;
- detect mutation during copy where possible;
- own the final object.

At an untrusted bundle import:

- decode the canonical manifest;
- validate IDs and references;
- verify content according to backend trust policy.

Inside one trusted immutable CAS domain, repeated full rehashing is not required
on every read.
