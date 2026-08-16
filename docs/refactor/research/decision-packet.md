# Maintainer decision packet

Status: accepted-decision projection. Canonical authorities remain `competitive-scope.md`, `provider-contracts.md`, `resumability.md`, and `artifact-storage.md`.

## Decisions closed

| Topic | Accepted decision |
| --- | --- |
| consumer testing | `ConsumerScenario`, durable acceptance records, and `ConsumerEvidenceRecorded` removed; application/CI Effects remain |
| replay authority | protection frozen at dispatch preparation and interpreted by core; `ReplaySafetyCapability` removed |
| replay events | deterministic `ReplayAuthorized` removed; `RiskAccepted` remains as a new human fact |
| replay algebra | append-only `replay.none/1`, `replay.idempotency-key/1`, `replay.cas/1`, `replay.exact-duplicate/1` |
| absence/status | absence never fences an in-flight request; request status is reconciliation evidence |
| ProviderDefinition | exactly definition ID, Intent Schema, schema version, behavior ID, and operation-ID projection |
| provider operations | prepare/observe/correct are optional provider-local services, not one lifecycle |
| automatic replay transport | only core-owned HTTP/Git prepared transports; no custom projection contract |
| opaque custom providers | valid dispatch/observe providers; uncertain continuation is `Inconclusive` or `RiskAccepted` |
| identity drift | behavior or lockfile mismatch blocks automatic replay, even with equal request fingerprint |
| migration | none in v1; new provider version observes, creates a new plan, or uses human risk acceptance |
| npm | one publish operation with a composite receipt/observation; no `memberOperationIds` |
| GitHub | release creation and each asset upload are separate operations |
| notarization | `effect-build-apple` owns submission/status/stapling/verification; only finalized bytes enter ts-release |
| bundle kernel | internal extraction-ready ts-release library; no planning/provider imports; not moved into effect-build |
| Workflow/Activity | deferred until six fixed distribution families are wire-complete; later remains `unstable` |
| vNext scope | 16 outcome families: D01-D06 plus P01-P10 |
| AI-native | A01-A03 architecture-proved only; later handoff is a pure validator, never a publication provider |
| deferred destinations | GitLab, Gitea, Cloudsmith, GemFury, Artifactory, Nexus |

## R1 closed: journal backend

One shared service is justified:

```text
JournalStore.appendIfRevision(expectedRevision, completeEvent)
```

v1 requires two first-party Layers because the deployment surfaces are genuinely different:

```text
LocalGenerationJournalStore
S3ConditionalJournalStore
```

SQLite satisfies the local law but is not a second required v1 local implementation. CI artifacts carry immutable bundles but do not become journal authority without external conditional state.

The race probe gives one winner and one loser for filesystem, SQLite, and conditional-object algorithms, and demonstrates that two artifact uploads still need one external-state winner.

## R2 closed: idempotency material

No shipping provider requires genuinely secret durable replay material. v1 is derived-key-only and removes plaintext key material and secret-manager references from the model.

The event stores key fingerprint, scope, base/final request fingerprints, and validity interval. A fresh core HTTP transport derives the same key from origin dispatch identity plus the base request fingerprint. Credentials are reacquired and never treated as replay keys.

## Critiques that survived

- resume-time provider code could change replay decisions;
- verdict-only replay records lacked evidence;
- static protection and live reconciliation answer different questions;
- `DispatchStarted` is the canonical protection record;
- consumer scenarios lacked a substitutability law and core consumer;
- immutable coordinates do not themselves make replay safe;
- CI artifacts do not supply journal CAS;
- opaque custom code cannot prove exact-send correspondence.

## Critiques refuted or narrowed

### All replay safety can be decided without provider facts

Refuted broadly. Provider protocol facts establish which exact prepared request satisfies a core-supported scheme. The law is frozen as evidence before dispatch rather than executed later.

### Request status is replay protection

Refuted. It may establish committed, terminal non-commit, or pending; it does not suppress duplicate effects.

### One blessed journal backend covers local and CI

Refuted. A local filesystem backend cannot honestly claim cross-machine CI semantics, while requiring cloud object storage for every local release is unnecessary. The same narrow Layer law with two implementations is the smallest decision-grade result.

### Secret-manager references are prudent future-proofing

Refuted for v1. No in-scope provider needs them. A future provider that proves secret replay capability is a new evidence-backed scheme, not justification for an unused union now.

## Product counts

Canonical counts are maintained only in `competitive-scope.md`:

```text
vNext acceptance:                    16
architecture-proved only:             3
deferred destination packages:        6
```

## Genuine implementation choices still open

- exact production TypeScript spelling of the frozen five fields and prepared transport values;
- precise S3 object layout, error types, retention defaults, and conformance tests;
- local generation-store platform support beyond the documented filesystem law;
- exact npm-compatible registry policy beyond npmjs;
- exact Warehouse-compatible repository policy beyond pinned Warehouse;
- GitHub tag-establishment policy;
- provider-specific observation match rules;
- final effect-build package layout after its Candidate C2 planning converges;
- exact Effect release target and migration sequence;
- later Workflow/Activity engine selection after wire completion.

None of these reopens the accepted event, replay, scope, or artifact-boundary laws.
