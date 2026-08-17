# Maintainer decision packet

Status: research projection. Canonical authorities are listed in `README.md`.
This revision distinguishes accepted laws from implementation choices reopened
by review.

## Accepted conclusions and maintainer decisions

1. vNext acceptance is 16 outcome families: D01-D06 and P01-P10.
2. A01-A03 are architecture proofs only; X01-X06 are deferred.
3. `ConsumerScenario`, durable acceptance records, and
   `ConsumerEvidenceRecorded` are removed.
4. `ReplaySafetyCapability` and deterministic `ReplayAuthorized` are removed.
5. `RiskAccepted` remains because it records a new human authorization fact.
6. Replay protection is recorded before dispatch; observations remain separate.
7. Observed absence cannot fence an earlier in-flight request.
8. The replay vocabulary remains `None`, `IdempotencyKey`, `CompareAndSwap`, and
   `ExactDuplicateAccepted`, with append-only versioned scheme IDs.
9. Core-owned transports are required to prove request correspondence for
   automatic replay.
10. npm initial publication is one operation with a composite version/tag
    receipt and observation; `memberOperationIds` remains removed.
11. effect-build-apple owns notarization through final verified/stapled bytes.
12. The immutable-content/bundle kernel remains internal to ts-release for now.
13. Workflow/Activity remains deferred until the six fixed distribution
    families are wire-complete.
14. `JournalStore.appendIfRevision` is a lawful shared storage interface.
15. No fixed provider requires durable plaintext secret idempotency material.

## Corrections to claims from the previous checkpoint

### The two-runner probe exercises; it does not discover

The probe-selected five-field provider shape and strict implementation-drift
policy are test inputs. Compilation and execution show internal consistency,
not minimality or architectural necessity.

### Provider-controlled operation ID is not required

Current recommendation:

```text
operationId = core hash(definitionId, schemaVersion, canonical Intent), paired with planId as the operation key
```

The focused identity comparison shows that a provider projection can create
different IDs for identical Intent bytes.

### Behavior and lockfile identity are provenance, not replay authority

No fixed-provider counterexample was found where the exact core-owned request,
endpoint, authorization scope, replay protection, validity, and trusted remote
law match, but package/lockfile drift alone makes sending unsafe.

Current recommendation: report implementation provenance diagnostically. Do not
block replay solely on whole-lockfile or manually maintained behavior identity.

### Core transport does not prove remote idempotency

Core can prove recorded/sent request correspondence. A separate provider
protocol law must establish idempotency-key, compare-and-swap, or
exact-duplicate behavior. The authority representation for non-structural laws
is unresolved.

### Backend selection is reopened

The `JournalStore` law remains accepted. The required first-party backend set
does not follow from the 16 outcome families. SQLite, dedicated Git ref, S3,
filesystem generations, and user-supplied Layers remain candidates.

### Apple durable recovery remains open

Ownership is decided; effect-build-apple still needs a durable fresh-process
notarization/submission design.

## Current recommendations

| Topic | Recommendation | Confidence | Tradeoff |
| --- | --- | --- | --- |
| operation identity | core-derived from plan and canonical Intent | High | exact framing still to select |
| implementation identity | optional provenance/diagnostic | High for core transports | less conservative than whole-lockfile blocking |
| request correspondence | immutable core HTTP/Git transports | High | opaque custom transports cannot auto-replay |
| remote replay law | keep separate from transport evidence | High | authority representation unresolved |
| provider definition minimum | ID + Schema version + Intent Schema/canonical encoding | High | optional operations resolved separately |
| backend interface | `JournalStore.appendIfRevision` | High | backend set still open |
| local backend candidate | compare SQLite against filesystem generations | Moderate | deployment-specific |
| GitHub CI backend candidate | dedicated/orphan Git ref | Moderate | permission and policy constraints |
| S3 | optional backend for AWS deployments | High | not default infrastructure |
| Apple P10 | required and effect-build-owned, durable design open | High | separate effect-build research required |

## Genuine unresolved choices

- final ProviderDefinition TypeScript spelling;
- operation-ID domain/framing and plan binding;
- representation of trusted provider replay-law authority;
- whether `replay.idempotency-key/1` or
  `replay.exact-duplicate/1` is enabled for any custom provider in v1;
- first-party JournalStore backend set;
- Windows/macOS support for a filesystem generation store;
- Git-ref journal permissions, retention, and fork behavior;
- Apple notarization durable-state mechanism;
- exact request-fingerprint canonicalization;
- provider receipt/observation schema migration;
- Workflow/Activity adoption after wire-complete providers.

## Model-expansion review

The correction removes rather than adds peer facts:

- provider-authored operation identity is unnecessary;
- whole-lockfile identity is not a replay authority;
- probe-selected field lists are not declared exact;
- S3 is not a scope-implied mode; and
- effect-build ownership is not treated as proof of notarization durability.
