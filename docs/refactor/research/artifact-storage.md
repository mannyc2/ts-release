# Artifact ownership, persistence, and effect-build boundary

Status: canonical ownership research. The effect-build/ts-release boundary is
accepted; ts-release owns release-level Apple continuation and history.

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
  stapling
  final verification

ts-release owns
  immutable pre-notary input identity
  dispatch and provider-native submission/status history
  response-loss observation and continuation decisions
  adoption of finalized bytes
```

This resolves package responsibility, not the remaining Apple correlation seam.
Notarization remains an asynchronous external mutation. A fresh process needs:

- a durable submission identifier or request fingerprint;
- exact pre-notarization input identity;
- Apple account/team/profile identity without secret persistence;
- polling state and terminal result;
- a rule for resubmission after response loss;
- durable access to the input bytes; and
- a path from acceptance to stapled, verified final bytes.

The selected coordinated direction keeps one release history. effect-build-apple
exposes concrete submit/info/staple/validate Effects and typed values;
ts-release records the dispatch, submission identity/status, and continuation
facts in its release journal. A later durable engine may host that history but
must not create a peer operation record.

A same-process retry loop is insufficient for the vNext acceptance promise.

## P10 status

Apple submission, fresh-runner polling, stapling, and Gatekeeper verification
remain four selected atomic vNext leaves. The pre-recorded-submission-ID
correlation gap is unresolved. It is not architecturally closed merely because
concrete operations live in effect-build-apple.

The ts-release artifact law remains simple:

```text
ts-release records exact pre-notary input and DispatchStarted
-> effect-build-apple performs concrete notary operations
-> ts-release records provider-native submission/status facts
-> effect-build-apple staples and verifies final bytes
-> ts-release adopts final bytes into the immutable bundle
```

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
