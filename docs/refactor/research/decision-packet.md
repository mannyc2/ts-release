# Maintainer decision packet

Status: research projection. Canonical authorities are listed in `README.md`;
`launch-scorecard.md` is the sole product-scope and product-decision authority.
This packet distinguishes final first-slice decisions from provisional seams.

## Accepted conclusions and maintainer decisions

1. vNext acceptance is 69 atomic leaves: 3 core delivery/reporting, 35
   provider/distribution, 28 artifact/trust, and 3 OpenAI plugin-delivery
   outcomes.
2. Ten evaluated candidate leaves are resolved to later work across nine
   maintainer choices; seven maintained provider packages are deferred and
   thirty leaves are named later work. No product-scope choice remains open.
3. `ConsumerScenario`, durable acceptance records, and
   `ConsumerEvidenceRecorded` are removed.
4. `ReplaySafetyCapability` and deterministic `ReplayAuthorized` are removed.
5. `RiskAccepted` remains because it records a new human authorization fact.
6. Replay protection is recorded before dispatch; observations remain separate.
7. Observed absence cannot fence an earlier in-flight request.
8. The replay vocabulary remains `None`, `IdempotencyKey`, `CompareAndSwap`, and
   `ExactDuplicateAccepted`, with append-only versioned scheme IDs.
9. Core-owned transports are required to prove request correspondence for
   automatic replay. v1 enables automatic replay only for structurally
   evidenced core compare-and-swap laws. npm uses `replay.none/1`: a lost
   response leads to observation and either satisfaction or an honest stop,
   never an absence-authorized resend.
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
16. Core owns strict canonical-JSON encoding and domain-separated,
    length-framed hashes for bundle, plan, and operation identity. The durable
    operation key is `(planId, operationId)`.
17. The first-party Bun CLI journal is local SQLite at an explicit state path.
    It is a local/default deployment choice, not a cross-host guarantee.
18. Production Effect packages align exactly on `4.0.0-beta.107`.

## Corrections to claims from the previous checkpoint

### The two-runner probe exercises; it does not discover

The probe-selected five-field provider shape and strict implementation-drift
policy are test inputs. Compilation and execution show internal consistency,
not minimality or architectural necessity.

### Provider-controlled operation ID is not required

Production decision:

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
exact-duplicate behavior. No non-structural remote law is enabled for automatic
replay in v1. A future application-trusted binding must be versioned and
durably selected before dispatch; it may not be asserted by a provider at
resume time.

### Local backend selection is closed

The `JournalStore` law remains accepted. Bun's native SQLite driver supplies a
transactional first-party local default without a new service account. The
database path is explicit, and one transaction performs the expected-revision
check and complete append. Dedicated Git ref, S3, filesystem generations, and
user-supplied Layers remain deployment options, not peer product families.

### Apple durable recovery remains open

Ownership is decided: effect-build-apple supplies concrete notary operations
and ts-release supplies the one release journal. The fresh-process correlation
path, especially acceptance before submission-ID recording, remains open.

## Current recommendations

| Topic | Recommendation | Confidence | Tradeoff |
| --- | --- | --- | --- |
| operation identity | core-derived from definition ID, codec version, and strict canonical Intent JSON; paired with plan ID as operation key | High | append-only codec versions require golden vectors |
| implementation identity | optional provenance/diagnostic | High for core transports | less conservative than whole-lockfile blocking |
| request correspondence | immutable core HTTP/Git transports | High | opaque custom transports cannot auto-replay |
| remote replay law | structural core CAS only in v1; nonstructural bindings are future application policy | High | fewer automatic continuations |
| provider definition minimum | ID + Schema version + Intent Schema/canonical encoding | High | optional operations resolved separately |
| backend interface | `JournalStore.appendIfRevision` | High | implementations must preserve ambiguous-storage outcomes |
| local backend | Bun SQLite at an explicit path | High | local/shared-file scope only |
| GitHub CI backend candidate | dedicated/orphan Git ref | Moderate | permission and policy constraints |
| S3 | optional backend for AWS deployments | High | not default infrastructure |
| Apple P10 | selected; concrete operations in effect-build-apple and one release journal in ts-release | High | commit-before-record gap can still end Inconclusive |

## Product choices

The nine launch-shaping maintainer choices are resolved only in
`launch-scorecard.md`: ipk, MSI/toolchain and MSI signing, OpenPGP, Cosign, OCI,
nightlies, SemVer derivation, release-note derivation, and universal macOS
output. All nine are finite later work. This packet does not create another
disposition for them.

## Final production decisions and provisional seams

Final for the first implementation slice:

- one immutable bundle, one durable plan, one append-only journal, and derived
  views only;
- strict canonical JSON and core-derived bundle/plan/operation identities;
- operation-local Layers resolved through ordinary imports;
- structural core CAS as the only automatic replay authority;
- Bun SQLite as the first-party local journal; and
- exact aligned Effect `4.0.0-beta.107` packages.

Provisional seams that do not alter those laws:

- final ProviderDefinition TypeScript spelling;
- future application-trusted nonstructural replay-law bindings;
- shared/remote JournalStore implementation and GitHub Actions default UX;
- Git-ref journal permissions, retention, and fork behavior;
- exact Apple correlation behavior when submission succeeds before its ID is
  recorded;
- exact request-fingerprint canonicalization;
- provider receipt/observation schema migration;
- any later Workflow/Activity adoption after wire-complete providers.

## Model-expansion review

The correction removes rather than adds peer facts:

- provider-authored operation identity is unnecessary;
- whole-lockfile identity is not a replay authority;
- probe-selected field lists are not declared exact;
- S3 is not a scope-implied mode; and
- effect-build ownership is not treated as proof of release-level notarization
  durability.
