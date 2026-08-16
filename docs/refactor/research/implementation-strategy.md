# Implementation-order comparison

Status: research-only. `competitive-scope.md` owns acceptance scope; this document owns sequence only.

## Acceptance scope versus build order

vNext acceptance contains 16 outcome families: D01-D06 plus P01-P10. That does not require implementing all 16 in ledger order.

The three AI-native outcomes A01-A03 are architecture-proved only. The six destination-only packages X01-X06 remain deferred.

## Selected sequence

### Research checkpoint

1. Two-process frozen-dispatch probe - complete.
2. R1 journal/CAS research and race probe - complete.
3. R2 secret idempotency-material survey - complete.
4. Canonical packet reconciliation around singular operations, strict identity, Apple finalization, and 16/3/6 counts - this pass.

### Implementation after research acceptance

1. Minimum immutable-content/bundle kernel in its own extraction-ready ts-release directory.
2. Canonical plan, singular-operation journal events, `JournalStore` law, pure replay decision, structured stops, and core HTTP/Git prepared transports.
3. Wire-complete npm slice.
4. Wire-complete Warehouse slice.
5. GitHub tag/release/asset slice.
6. Conditional Git, Homebrew formulas, and Scoop.
7. Arbitrary custom provider through both core-transport and opaque paths.
8. Exercise P01-P10 concrete production/trust integrations and adoption.
9. Non-manual ts-release self-release with injected interruption.

## Why npm and Warehouse remain first

They expose different laws early:

```text
npm
  one operation and one PUT
  composite version + initial-tag receipt/observation
  immutable version plus mutable tag
  no general automatic replay law

Warehouse
  one operation per distribution file
  partial progress
  exact duplicate same content accepted by pinned behavior
  filename/content conflict
```

A model that survives both has stronger wire evidence than one generalized from internal types.

## Replay implementation order

1. Implement the five-field definition law without adding lifecycle members.
2. Implement `core.http/1` and `core.git/1` immutable prepared requests.
3. Persist singular `DispatchStarted` evidence before send.
4. Implement append-only replay IDs and pure core decision.
5. Implement structured stop explanations and exact `RiskAccepted` assertions.
6. Implement local-generation and S3-conditional `JournalStore` Layers.
7. Prove two-runner CAS before any provider send.
8. Default opaque transports, unknown schemes, expired protection, and identity drift to no automatic replay.

Do not implement resume-time provider replay policy or provider-supplied normalized projections.

## Artifact-production sequence

P01-P10 are vNext acceptance families and must be exercised before release acceptance:

1. executable matrices;
2. archives and source archives;
3. uv/Poetry wheels and sdists;
4. nFPM/system packages;
5. Apple app bundle, DMG, and pkg construction;
6. local signing;
7. Apple notarization, stapling, and verification inside `effect-build-apple`;
8. ts-release adoption of the resulting finalized bytes.

No universal Builder is introduced.

## Consumer evidence

Install/import/execute checks remain ordinary CI/application Effects after publication or public visibility. They may fail release acceptance but never rewrite provider receipt truth or authorize mutation replay.

Required maintained gates include npm, Python, public GitHub asset, Homebrew, Scoop, and ts-release self-release scenarios appropriate to the shipped outcome. They are not one public extension interface.

## AI-native architecture proof

Before freezing the artifact model, demonstrate only that ordinary artifact/file/Git operations can represent:

- a plugin/skills package directory;
- a local/repository marketplace entry;
- a pure submission-handoff validator over package, listing metadata/assets, release notes, attestations, and required tests.

No OpenAI publication provider is implemented in vNext.

## Workflow/Activity

Deferred until all six fixed distribution families are wire-complete. A later engine remains behind `unstable` and must host the already-selected plan/journal/replay semantics exactly. Engine retry is never independent provider replay authority.

## Evidence gates

Each slice reports separately:

```text
compile/type surface
protocol-double behavior
scratch/live provider acceptance
fresh public observation
intended byte identity
clean consumer behavior
fresh-runner response-loss continuation
self-release
```

The decisive final gate is non-manual self-release through the rewritten product using the same finalized bundle and replay laws.
