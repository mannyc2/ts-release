# Artifact byte ownership, persistence, and effect-build boundary

Status: continuation of [artifact-model.md](./artifact-model.md). It is part of the same research document and has the same guardrails.

## 8. Byte ownership and copying

### Producer boundary

A producer may return:

- a scoped intermediate whose bytes exist only during a callback; or
- a final file at a caller-selected path.

The release system adopts bytes while the producer's ownership remains valid.

### Adoption boundary

Adoption should:

1. open the producer output;
2. stream it into the bundle store;
3. compute digest and length while copying;
4. atomically publish the content object under its digest;
5. reject a same-digest/different-content storage violation;
6. create the logical artifact mapping; and
7. make the bundle manifest visible only after every required object is durable.

This is the main untrusted producer-to-bundle crossing. Verification should happen here once.

### Transfer rather than copy

A durable ownership-transfer protocol could avoid copying when source and destination share a trusted CAS. It must prove:

- same digest algorithm and canonical encoding;
- source object immutability;
- destination retention;
- atomic reference acquisition; and
- cleanup authority.

Without those laws, eager streaming copy is the honest default.

## 9. Persistence boundary and commit protocol

Recommended content-addressed protocol:

```text
write/verify immutable objects by digest
  -> fsync or provider durability acknowledgment
  -> encode canonical manifest
  -> atomically publish manifest/commit marker last
```

The manifest is the commit marker. An object without a committed manifest is garbage-collectable staging; a manifest may never reference an unavailable object.

### Trust domains

#### Untrusted import

Examples:

- producer workspace;
- downloaded CI artifact;
- copied bundle from another store;
- user-provided directory.

At this boundary:

- parse strict canonical manifest;
- recompute bundle ID;
- validate IDs and references;
- stream every referenced object into the trusted store;
- verify digest and length while importing; and
- publish the trusted manifest last.

#### Trusted store load

If the store guarantees immutable content-addressed objects and manifest-after-object commit:

- parse and validate manifest;
- recompute bundle ID;
- resolve object references;
- verify presence according to backend contract; and
- do not rehash every object on every load.

This follows the design value "verify at trust-domain crossings, then carry proof structurally."

## 10. Eager versus lazy object validation

### Alternative V1: rehash every object at every load

**Strength:** every load detects disk corruption immediately.

**Costs:**

- O(total bytes) startup;
- remote stores require full downloads before any operation;
- repeats work inside one trusted domain;
- increases check-to-use gaps if files are closed and reopened later.

### Alternative V2: trust manifest and object names without byte verification

**Strength:** fast.

**Counterexample:** an untrusted directory can place arbitrary bytes under a digest-shaped filename.

**Conclusion:** valid only after a prior trusted import and under a backend immutability law.

### Alternative V3: verify at import, then trust immutable CAS; verify on first stream only when backend trust is weaker

**Strength:** verification aligns with actual trust crossings and scales to remote storage.

**Tradeoff:** a weak local filesystem backend may discover latent corruption when an object is first used rather than at metadata load.

**Provisional recommendation:** V3, high confidence as a law, moderate confidence on the first local backend. An explicit `verifyAll` operation can audit a store or transferred bundle without making every load O(total bytes).

### Unresolved requirement tension

Earlier research required "missing or changed content fails once at load." That is achievable for a small untrusted directory, but conflicts with scalable remote CAS loading. The stronger universal requirement should be:

> No provider receives bytes until the bundle loader or trusted store has established that those bytes satisfy the canonical content reference.

Whether all objects are eagerly touched before the first provider operation is a backend and acceptance-policy choice.

## 11. Canonical JSON authority

The repository currently has two implementations:

1. `src/model/canonical.ts`
2. `scripts/lib/canonical-json.ts`

They overlap but are not identical:

- the runtime module includes strict parsing and canonical round-trip checks;
- the script module has a different public API;
- object prototype acceptance differs; and
- independent edits can change hash identity.

This is a peer-authority risk.

### Alternatives

#### C1: one normative module imported everywhere

**Strength:** one implementation and one test suite.

**Tradeoff:** bootstrap/release scripts may need compiled package output before the package is built.

#### C2: normative specification plus two implementations checked by golden vectors

**Strength:** permits a bootstrap script implementation.

**Tradeoff:** two code paths remain and every change needs cross-implementation conformance.

#### C3: retain both as coequal implementations

**Conclusion:** rejected. Hash identity cannot have two coequal authorities.

**Provisional recommendation:** C1 if build/bootstrap order permits it; otherwise C2 with one normative specification, fixed versioned domains, and exhaustive golden vectors. Confidence is high that C3 is invalid; exact migration is a maintainer choice.

## 12. effect-build comparison

Pinned source:

- [`Integration.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts)
- [`JavaScriptBundle.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/JavaScriptBundle.ts)
- [`Bun Bundle.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build-bun/src/Bundle.ts)
- [`standalone/Artifact.ts`](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/standalone/Artifact.ts)

### Scoped intermediate bundle

`withOwnedJavaScriptBundle` creates a private temporary root, validates a live artifact, runs a callback, and deletes the root afterward. This is intentionally scope-bound.

### Caller-selected final executable

`produceExecutable` receives a caller-selected `outfile`, builds to a staged candidate, validates the native executable, atomically publishes it to the final destination, and returns a stable file artifact.

These are different lifetime contracts. ts-release should not require effect-build to produce a durable release bundle.

### Existing integration path

ts-release can:

1. choose a private adoption destination;
2. call effect-build `produceExecutable`;
3. import the resulting final file into its own content-addressed bundle; and
4. clean the adoption directory after bundle commit.

For scoped `withOwnedJavaScriptBundle`, ts-release must adopt the bytes inside the callback.

### Potential generic effect-build improvement

No effect-build change is required by current evidence.

A generic improvement could be an explicit produced-output reader or adoption callback that works across compiler integrations, but it is justified only if non-release consumers also need ownership transfer. It must not contain release plan, provider Intent, journal, or retention concepts.

## 13. Generic library boundary

A content bundle abstraction can be architecturally valid before it has a second adopter. Packaging it separately is a different question.

### Independent laws

The K3 kernel is independently useful for:

- build handoff;
- CI artifacts;
- test fixture packs;
- cache export/import;
- deployment bundles; and
- release artifacts.

### Packaging alternatives

1. keep private inside ts-release until APIs settle;
2. add a package within the ts-release workspace;
3. create an independent artifact-handoff library;
4. move shared values into effect-build.

**Provisional recommendation:** implement the laws inside the ts-release workspace first, with package boundaries kept extractable. Do not put the durable bundle in effect-build because effect-build's scoped and caller-path lifetimes are intentionally broader/different. Confidence is moderate; this is packaging priority, not semantic validity.

## 14. Recommendations and confidence

| Recommendation | Confidence | Tradeoff |
| --- | --- | --- |
| Content objects plus logical artifact mapping are the smallest universal kernel. | High | Provider-specific roles require separate typed plan values. |
| Exclude release, document, provider, destination, kind, and generic metadata fields from the kernel. | High | More composition between bundle and plan. |
| Store digest/size once on content objects and derive provider expectations through artifact refs. | High | Provider adapters need resolved handles. |
| Prefer bundle-bound handles without an ambient active `ArtifactStore`. | Moderate | Exact Effect typing needs a focused probe. |
| Verify producer bytes at adoption/import, then trust an immutable CAS within its domain. | High | Weak backends need first-read or explicit audit checks. |
| Publish the canonical manifest last as the commit marker. | High | Backend transaction details vary. |
| Eliminate coequal canonical-JSON implementations. | High | Bootstrap constraints may require conformance-tested duplication. |
| Require no effect-build change for the initial integration. | High | ts-release owns one extra adoption/copy step. |

## 15. Genuine maintainer choices

- Exact manifest fields, ordering, and unreferenced-object policy.
- Digest algorithm extensibility versus fixed SHA-256 for v1.
- Local filesystem, SQLite/blob, or remote object-store backend.
- Eager local copy versus a durable transfer protocol.
- Exact bound-handle Effect API.
- Whether trusted-store load checks object existence eagerly.
- Cleanup and retention policy.
- Canonical JSON bootstrap strategy.
- Package extraction timing.

## 16. Unresolved contradictions

1. "Fail every missing object at load" conflicts with scalable remote lazy loading. The trust-domain requirement is clear; eager traversal remains backend-specific.
2. An artifact ID is logical identity, but its semantics live outside the kernel. The plan must prevent two provider roles from accidentally interpreting the same ID incompatibly.
3. A provider Intent should not repeat digest/size, yet operation identity must change when referenced bytes change. Binding operation keys to the canonical plan and bundle resolves this, but exact ID syntax remains open.
4. A bound handle that closes over backend access is explicit and safe, but may be harder to serialize/test than `(bundle, ref)` functions. A type probe should compare the two without promoting either prematurely.
