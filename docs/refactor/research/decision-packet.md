# Maintainer decision packet

Status: research projection. Canonical authorities are listed in `README.md`;
`launch-scorecard.md` is the sole product-scope and product-decision authority.
This packet distinguishes accepted architecture laws from implementation
choices reopened by review.

## Accepted conclusions and maintainer decisions

1. vNext acceptance is 69 atomic leaves: 3 core delivery/reporting, 35
   provider/distribution, 28 artifact/trust, and 3 OpenAI plugin-delivery
   outcomes.
2. Ten candidate leaves remain unresolved as nine maintainer choices; seven
   maintained provider packages are deferred and twenty leaves are named later
   work.
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
11. effect-build-apple owns concrete notarization operations through final
    verified/stapled bytes; ts-release owns the release journal and
    continuation decisions.
12. The immutable-content/bundle kernel remains internal to ts-release for now.
13. Workflow/Activity remains deferred until the selected fixed-provider wire
    slices and journal semantics are complete.
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
does not follow from the selected product leaves. SQLite, dedicated Git ref,
S3, filesystem generations, and user-supplied Layers remain candidates.

### Apple durable recovery remains open

Ownership is decided: effect-build-apple supplies concrete notary operations
and ts-release supplies the one release journal. The fresh-process correlation
path, especially acceptance before submission-ID recording, remains open.

## Current recommendations

| Topic | Recommendation | Confidence | Tradeoff |
| --- | --- | --- | --- |
| operation identity | core-derived from definition ID, codec version, and canonical Intent; paired with plan ID as operation key | High | production canonical encoder still to select |
| implementation identity | optional provenance/diagnostic | High for core transports | less conservative than whole-lockfile blocking |
| request correspondence | immutable core HTTP/Git transports | High | opaque custom transports cannot auto-replay |
| remote replay law | keep separate from transport evidence | High | authority representation unresolved |
| provider definition minimum | ID + Schema version + Intent Schema/canonical encoding | High | optional operations resolved separately |
| backend interface | `JournalStore.appendIfRevision` | High | backend set still open |
| local backend candidate | compare SQLite against filesystem generations | Moderate | deployment-specific |
| GitHub CI backend candidate | dedicated/orphan Git ref | Moderate | permission and policy constraints |
| S3 | optional backend for AWS deployments | High | not default infrastructure |
| Apple P10 | selected; concrete operations in effect-build-apple and one release journal in ts-release | High | commit-before-record gap can still end Inconclusive |

## Product choices

The nine launch-shaping maintainer choices are represented only in
`launch-scorecard.md`: ipk, MSI/toolchain and MSI signing, OpenPGP, Cosign, OCI,
nightlies, SemVer derivation, release-note derivation, and universal macOS
output. This packet does not create another disposition for them.

## Genuine unresolved architecture choices

- final ProviderDefinition TypeScript spelling;
- production canonical encoding/framing for the selected operation-ID law;
- representation of trusted provider replay-law authority;
- whether `replay.idempotency-key/1` or
  `replay.exact-duplicate/1` is enabled for any custom provider in v1;
- first-party JournalStore backend set;
- Windows/macOS support for a filesystem generation store;
- Git-ref journal permissions, retention, and fork behavior;
- exact Apple correlation behavior when submission succeeds before its ID is
  recorded;
- exact request-fingerprint canonicalization;
- provider receipt/observation schema migration;
- Workflow/Activity adoption after wire-complete providers.

## Model-expansion review

The correction removes rather than adds peer facts:

- provider-authored operation identity is unnecessary;
- whole-lockfile identity is not a replay authority;
- probe-selected field lists are not declared exact;
- S3 is not a scope-implied mode; and
- effect-build ownership is not treated as proof of release-level notarization
  durability.
