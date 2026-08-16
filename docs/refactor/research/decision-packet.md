# Refactor research decision packet

Status: research checkpoint for maintainer review. Production implementation remains paused.

## Fixed shipping scope

The rewrite ships:

- npm;
- PyPI/Warehouse;
- GitHub Releases and assets;
- Homebrew formulas;
- Scoop; and
- arbitrary custom providers.

The research below evaluates architecture and implementation order without reducing that scope.

## Executive result

The evidence currently supports a system composed from five distinct structures:

1. **Artifact bundle:** immutable content objects plus bundle-local logical artifact IDs.
2. **Release plan:** canonical provider-specific Intents and dependency edges, bound to one bundle.
3. **Application provider definitions:** versioned Intent decoders and independently optional capabilities supplied by ordinary TypeScript and Layers.
4. **Journal:** one ordered history of physical dispatch, provider receipt, fresh observation, replay authority, consumer evidence, and plan supersession events.
5. **Acceptance records:** explicit outcome plus evidence environment.

No one structure should repeat the canonical facts owned by another.

## Decision ledger

## A. Conclusions derived from laws or provider evidence

These are not left as product choices unless new contradictory evidence appears.

| Conclusion | Basis | Confidence |
| --- | --- | --- |
| Shipping scope is npm, Warehouse/PyPI, GitHub, Homebrew formulas, Scoop, and arbitrary custom providers. | Maintainer-fixed product scope. | Fixed |
| Intent is canonical desired provider state; no `LogicalOperation` peer repeats provider/endpoint/coordinate/facts. | One canonical representation per fact. | High |
| Journal state, attempts, receipts, observations, and evidence indexes are derived from one event history. | Peer representations can disagree. | High |
| A provider may be valid without an authoritative observation endpoint. | Real write-only/custom protocols exist. | High |
| Consumer evidence and evidence environments do not belong to provider admission. | Consumer outcome depends on release policy and environment. | High |
| One physical mutation boundary needs one canonical durable start event. | Crash consistency and request identity. | High |
| Observation of absence alone cannot fence an already-dispatched request. | Distributed request can commit later. | High |
| Safe replay can be authorized by provider-enforced idempotency/conditions even without proof of noncommit. | Provider replay law differs from noncommit proof. | High |
| Credential failure before the mutation boundary creates no dispatch attempt. | No request can have committed. | High |
| Warehouse commit/progress unit is one distribution file. | Pinned Warehouse source. | High |
| npmjs initial version, tarball, and selected tag are co-requested in one package PUT. | Pinned npm source. | High |
| GitHub asset numeric release ID is response/observation-bound, not plan-known. | GitHub release API. | High |
| One conditional Git ref update can expose several managed paths atomically. | Git object/ref law. | High |
| Artifact kernel does not require release/provider/destination/kind/generic metadata fields. | Universal artifact law counterexamples. | High |
| Current dual canonical-JSON implementations cannot remain coequal identity authorities. | Different implementations can diverge. | High |
| Workflow/Activity cannot provide external exactly-once publication. | Effect/Temporal retry and external-effect gap. | High |
| GoReleaser Verify is public SCM asset/CDN/signature evidence, not native npm/PyPI installation. | Current official documentation. | High |

## B. Provisional recommendations

These are the strongest current designs but still deserve maintainer review.

| Recommendation | Confidence | Tradeoff / reason not fixed |
| --- | --- | --- |
| Versioned provider definition plus independent optional capabilities. | High | Exact TypeScript shape and resolver placement remain open. |
| Application-supplied heterogeneous provider-definition resolver on every runner. | High | Mechanically resembles a registry; must not become admission. |
| One canonical `DispatchStarted` event per physical request, containing all genuine member attempts. | High | Provider grouping semantics must be explicit. |
| Prefer provider Intent granularity that matches the authoritative commit unit. | High | npm composite desired facts still raise public state-shape questions. |
| Model initial npmjs publish as one composite Intent; later dist-tag changes separately. | High for npmjs | Compatible registries may differ; facet reporting needs design. |
| Model Warehouse upload and yank as separate Intents. | High for Warehouse | Compatible indexes may expose different yank laws. |
| GitHub asset Intent references parent release Intent; release ID is bound later. | High | Dispatch requires parent receipt/observation resolution. |
| Explicit GitHub tag establishment when ts-release owns tag creation. | Moderate | Extra request/race versus composite release-create convenience. |
| Artifact kernel is content objects plus logical artifact mapping. | High | Provider roles move into plan models. |
| Bound artifact handles should not require an ambient active `ArtifactStore`. | Moderate | Exact Effect resource API needs a focused type probe. |
| Verify bytes at adoption/import, then trust immutable CAS within that trust domain. | High | Weak backends may need first-read or explicit audit checks. |
| Use published `effect@4.0.0-rc.109` as migration target. | Moderate | Full behavior-preserving ts-release migration has not passed. |
| Use hybrid wire-complete vertical slices. | High | Accept early refactoring after provider evidence. |
| Keep explicit journal even if Workflow/Activity is later used. | High | Additional model/storage work. |
| Implement artifact laws in ts-release workspace before extracting a generic package. | Moderate | Packaging priority, not semantic validity. |

## C. Genuine maintainer/product choices

These cannot currently be answered solely from provider law.

### Public API and application composition

- exact provider definition and optional-capability interfaces;
- explicit resolver value versus Context service;
- release definition/configuration module shape;
- CLI dynamic-loading and trust policy;
- sealed executable requirement, if any.

### Bundle and persistence

- exact manifest fields and ordering;
- digest algorithm policy for v1;
- local/SQLite/remote object store backend;
- eager copy versus durable transfer;
- eager existence checks on trusted-store load;
- retention and cleanup;
- canonical JSON bootstrap strategy.

### Journal and concurrency

- exact event Schemas;
- backend and compare-and-swap model;
- lease duration and takeover;
- request fingerprint fields;
- grouped response mapping;
- risk-retry CLI/approval UX;
- evidence retention/compaction.

### Provider product policy

- npm-compatible registry support beyond npmjs;
- compatible Python repositories beyond Warehouse;
- explicit versus implicit GitHub tag creation policy;
- required public download/execute evidence for GitHub;
- Homebrew/Scoop platform matrix and completion policy;
- custom provider schema migration policy.

### Effect and delivery

- whether Workflow/Activity is in the first shipping implementation;
- whether Effect migration is a separate series or greenfield prerequisite;
- exact behavior gate for rc.109;
- maintained scratch-provider resources;
- self-release rollout and rollback policy.

## 1. Custom-provider boundary

### Alternatives considered

| Alternative | Eliminating counterexample | Result |
| --- | --- | --- |
| monolithic provider lifecycle | write-only provider has no observation/correction/consumer capability | rejected as mandatory |
| ordinary TypeScript only | fresh runner cannot decode persisted custom Intent from a closure | insufficient alone |
| versioned definition + optional capabilities | no counterexample found that requires unsupported flags | recommended |
| opaque `advance(history)` | provider can mutate before generic write-ahead boundary | rejected as safety boundary |

### Recommendation

Mandatory durable definition facts:

```text
implementation ID
schema version
Intent Schema/canonical encoding
```

Capabilities are independent:

```text
dispatch
fresh observation
replay safety
correction
consumer scenario
```

A provider with no observation is valid; lost response may end `Inconclusive`.

### Fresh runner

The application imports the custom package and supplies its definition and Layer. Core resolves persisted definition ID/version through an application-local resolver. This is not a built-in allowlist.

See [provider-contracts.md](./provider-contracts.md).

## 2. Physical dispatch

### Alternatives considered

| Alternative | Counterexample | Result |
| --- | --- | --- |
| one dispatch event with members | can be misused for unrelated batching | recommended only for genuine one request |
| separate member events transactionally | duplicates shared authorization/request identity or needs a peer dispatch record | weaker |
| grouping outside journal | crash loses which Intents shared in-flight request | rejected |
| every mutation one composite Intent | Warehouse batch can partially commit per file | provider-specific only |

### Recommendation

One canonical physical-dispatch event, with one member normally and a nonempty member set only when the provider request genuinely spans several Intents. Prefer Intent granularity matching provider commit law.

See [resumability.md](./resumability.md).

## 3. Retry authority

The journal records exactly one authority for another dispatch:

```text
ProvenUnableToCommit
ProviderReplaySafe
RiskAccepted
```

Counterexample to the earlier narrower rule:

- a conditional Git update can be safely replayed with the same expected predecessor even when the first response was lost; proof of noncommit is unnecessary because the condition fences incompatible repetition.

Counterexample to absence-based retry:

- stale request D1 can commit after a fresh read reports absence and after runner B starts.

See [resumability.md](./resumability.md) and [adversarial-traces.md](./adversarial-traces.md).

## 4. Artifact kernel

### Alternatives considered

| Alternative | Counterexample | Result |
| --- | --- | --- |
| release-shaped bundle with providers/kinds/metadata | untyped combinations and provider schema evolution | rejected as kernel |
| content objects only | two logical artifacts sharing bytes lose identity | too small |
| content objects + logical artifact mapping | satisfies all universal laws | recommended |
| path manifest | mutable/path/backend-specific identity | implementation only |

### Recommendation

```text
ArtifactBundleManifest {
  schemaVersion,
  objects { digest, byteLength },
  artifacts { artifactId, contentDigest }
}
```

Release facts and provider Intents live in the plan. Digest/size are derived through artifact references.

See [artifact-model.md](./artifact-model.md).

## Continued research

The remaining sections continue in [decision-packet-details.md](./decision-packet-details.md).
