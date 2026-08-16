# Refactor research decision packet

Status: review-ready research checkpoint. Production implementation remains paused.

This packet consolidates the provider, artifact, resumability, Effect, extensibility, and product-outcome research. It identifies decisions supported by evidence and choices that still belong to maintainers.

## Executive conclusion

The rewrite should be organized around four independent structures:

1. **One finalized immutable release bundle** with a versioned canonical manifest and durable byte ownership.
2. **Provider-local logical operations** whose coordinates, intents, receipts, errors, and observations remain provider-specific.
3. **One explicit durable journal** that separates a stable logical operation from its individual dispatch attempts and preserves uncertainty instead of blindly retrying.
4. **Two-dimensional acceptance evidence** that states both the outcome claimed and the environment in which it was observed.

Effect supplies useful composition, typed errors, Layers, scopes, and possibly later Workflow or Activity execution. It does not define the provider model, replace the journal, or make external mutations exactly once.

No production API, Effect migration, Workflow or Activity implementation, or provider mutation is included in this PR.

## Decisions supported by evidence

### 1. No universal publication service

The evidence does not support one universal `Publisher`, `verify`, `verifyInstall`, or `ensurePublished` interface.

npm versions and tags, Warehouse files, GitHub refs/releases/assets, Git catalog refs, Homebrew formulas, Homebrew casks, and object-store objects have different coordinates, mutation boundaries, receipts, conflict laws, and reconciliation evidence.

Generic orchestration should operate on journal transitions. Provider packages own:

- canonical coordinate and intent Schemas;
- provider-native receipt and error Schemas;
- dispatch operations;
- fresh observation and classification;
- authoritative-absence rules;
- pending and irreducible-uncertainty behavior; and
- correction capabilities.

See [provider-contracts.md](./provider-contracts.md).

### 2. Intent, receipt, observation, and consumer evidence are separate

The rewrite should persist these facts independently:

```text
Intent
ProviderNativeReceipt
FreshObservation
ConsumerEvidence
```

A successful mutation receipt is not a fresh read. A fresh read is not proof that the mutation attempt returned. A provider can be accepted while consumer installation remains `NotObserved`.

### 3. Direct immutable bundle construction

The public artifact model should construct a finalized immutable bundle directly. Any mutable ingestion accumulator stays private.

The bundle ID is derived from one versioned, domain-separated canonical manifest using the existing canonical implementation in:

- [`src/model/canonical.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/canonical.ts)
- [`scripts/lib/canonical-json.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/scripts/lib/canonical-json.ts)

There is no unchecked stored ID peer beside the manifest. Bundle-relative references are resolved into bundle-bound handles at load time. Qualified references are used only when independently crossing envelopes.

See [artifact-model.md](./artifact-model.md).

### 4. The release program owns durable root outputs

Producer libraries own output construction and scoped readers. The root release program owns:

- adoption into durable storage;
- logical artifact identity;
- provider meaning;
- the canonical manifest;
- bundle finalization; and
- retention and cleanup authority.

An effect-build compiler artifact and a ts-release release bundle share some value laws, but their lifetime laws differ. effect-build commonly owns build-scope scratch output; ts-release must continue after process loss. Shared laws may justify small shared values, while different lifetimes may justify separate resource APIs.

The earlier rule that a second adopter proves architectural validity is removed. Laws determine validity. Adoption and maintenance cost determine package-extraction priority.

### 5. Explicit journal before Workflow or Activity

The durable product state separates:

```text
LogicalOperation
Attempt
```

Normal operation states are:

```text
Planned
Dispatching(attempt)
Accepted(receipt)
SatisfiedByObservation(freshObservation)
ProvenNotCommitted(proof)
AbsentRetryable(observation, policy)
Pending(observation, policy)
Conflict(observation)
Inconclusive(evidence)
```

The core mutation rule is:

```text
persist Dispatching before crossing the provider boundary;
start another mutation attempt only after ProvenNotCommitted.
```

Workflow or Activity may later execute journal transitions. Engine replay does not infer a provider commit after response loss.

See [resumability.md](./resumability.md).

### 6. Effect alignment is a migration decision, not a manifest edit

Corrected candidate evidence from [research run 31948959001](https://github.com/mannyc2/ts-release/actions/runs/31948959001) shows:

- rc.108 and rc.109 both pass effect-build install, build, check, type tests, unit tests, and clean packed-consumer tests;
- ts-release installs successfully with each aligned family; and
- both candidates fail at ts-release's own TypeScript check because beta.83 source needs a broad migration.

The former rc.108 platform mismatch and rc.109 `@effect/bun-test` 404 were harness defects, not compatibility evidence.

No target is selected. The evidence does not currently rank rc.108 and rc.109 because both stop at the same cross-cutting source migration. Choosing rc.108 because effect-build develops against it or rc.109 merely because it is later would outrun the evidence.

See [effect-patterns.md](./effect-patterns.md).

### 7. First-cut outcome set

The outcome roadmap supports a first cut containing:

1. native npm version and dist-tag outcomes;
2. native Warehouse/PyPI per-file outcomes;
3. GitHub tag, release, and asset outcomes; and
4. one conditional Git catalog path.

Together these exercise immutable versions, mutable pointers, partial multi-file progress, response-loss reconciliation, conditional Git refs, and consumer evidence.

Build matrices, archives, checksums, SBOMs, signing, and provenance should initially compose through owned outputs and neighboring tools unless ts-release later earns a dedicated implementation.

See [goreleaser-outcomes.md](./goreleaser-outcomes.md).

### 8. Library extensibility before sealed-executable extensibility

The clean Node consumer probe establishes only this:

> A CLI can dynamically import a consumer module that has already supplied its own Layer and exported an already-closed Effect, even when the CLI core did not know that provider package at build time.

That is sufficient evidence for an open library/configuration boundary. It does not prove a ts-release provider contract, durable preparation, typed CLI reporting, multi-provider orchestration, resumability, or sealed-executable discovery.

The prebuilt single-file experiment remains informational and reports `loadedUnknownProvider: false`. A requirement for a sealed standalone CLI would need a separately designed loader, trust policy, package-resolution mechanism, and reporting contract.

## Corrected research conclusions

The following conclusions changed during reconciliation and the corrected pass:

| Earlier interpretation | Supported interpretation now |
| --- | --- |
| rc.108 failed from Effect/platform mismatch | Harness defect. effect-build's full package and consumer gate passes at rc.108. |
| rc.109 failed because `@effect/bun-test` was unavailable | Harness defect. The corrected harness preserves the vendored package; the aligned install succeeds. |
| Candidate compatibility stopped during dependency setup | Both candidates reach ts-release's own TypeScript migration boundary. |
| Artifact validity depended on a second adopter | Architectural validity follows exact laws; extraction priority follows adoption and maintenance cost. |
| Relative references were inherently bundle-bound | They become bundle-bound only after validated load-time resolution into a handle. |
| One verification tier could summarize readiness | Outcome claimed and evidence environment are independent dimensions. |
| The 151 GoReleaser rows were a feature backlog | The rows are a traceability census; the product roadmap is outcome-oriented and classifies mechanisms separately. |

## Acceptance model

The rewrite should replace one-dimensional tiers with two axes.

### Axis 1: outcome claimed

| Outcome code | Claim |
| --- | --- |
| `L` | Static or structural law: types, canonical identity, duplicate rejection, reference binding. |
| `R` | Local runtime law: bytes copied/read, interruption, cleanup, typed failure propagation. |
| `X` | Extension law: a clean consumer can supply an unknown provider/program through the supported boundary. |
| `A` | Provider accepted the intended coordinate or mutation. |
| `M` | Fresh public or authoritative metadata matches the intent. |
| `B` | Provider-visible or downloaded bytes match the finalized bundle. |
| `C` | A clean consumer discovers, installs, downloads, imports, or executes the release. |
| `J` | Recovery law: response loss or process death continues per coordinate without blind repetition. |
| `S` | Self-release law: the rewritten product performs its own non-manual release. |

### Axis 2: evidence environment

| Environment code | Environment | What it cannot prove alone |
| --- | --- | --- |
| `compile` | TypeScript compile/type test | Runtime behavior, provider acceptance, durability. |
| `in-process` | Disposable local runtime probe | Clean packaging, process loss, real provider behavior. |
| `clean-consumer` | Fresh package installation in an isolated project | Public registry behavior or durable provider recovery. |
| `protocol-double` | Deterministic provider/client double | Actual provider policy, propagation, or public availability. |
| `scratch-provider` | Authorized scratch namespace on a real provider | Production namespace policy or representative end-user behavior. |
| `public-provider` | Real public release coordinate | Consumer behavior across hosts and recovery under controlled faults. |
| `end-user` | Representative clean OS/package-manager/runtime | Provider mutation semantics or journal durability by itself. |
| `self-release` | ts-release releases ts-release through the rewritten product | Nothing broader than the exact providers and environments exercised, but it is the decisive integrated gate. |

### Evidence record

Each claim is recorded as:

```text
{
  outcome,
  environment,
  subject,
  evidenceRef,
  result,
  limitations
}
```

Examples:

```text
L / compile / bundle-relative reference / pass
X / clean-consumer / unknown provider module / pass with narrow Layer-closed conclusion
A / scratch-provider / npm version 1.2.3 / accepted(receipt)
M / public-provider / npm dist-tag latest / observed equivalent
B / public-provider / GitHub asset / downloaded digest equivalent
C / end-user / Homebrew formula / NotObserved
J / scratch-provider / lost GitHub asset response / satisfied by observation
```

A green check is not a claim unless the check names its outcome and environment. Missing evidence remains `NotObserved`.

## Decisive acceptance gate

The eventual integrated gate is:

> ts-release performs its own non-manual release through the rewritten product, reuses one finalized bundle, persists its journal before every external mutation, reconciles any interrupted coordinate without blind repetition, publishes the intended public bytes and metadata, and is installed or executed by clean consumers.

This is not required in the research PR. It is the acceptance target that prevents local internal checks from substituting for the released product outcome.

A decisive self-release record should include:

- final bundle ID and canonical manifest;
- every provider-local intent and logical operation ID;
- attempts, receipts, and fresh observations;
- public byte comparisons;
- clean npm import or CLI execution;
- any package-manager/catalog installation included in the release;
- recovery trace for at least one intentionally interrupted coordinate; and
- no manual provider mutation outside the journaled program.

## Suggested implementation sequence after approval

This is sequencing guidance only; implementation remains out of scope for this PR.

1. Freeze the canonical bundle manifest and bound-handle laws.
2. Define a versioned journal Schema and deterministic in-memory transition model.
3. Port one provider at a time to provider-local intents, receipts, observations, and attempts.
4. Establish the clean Node extension boundary against the real provider contract.
5. Add scratch-provider acceptance and recovery evidence for the first-cut providers.
6. Decide whether Workflow or Activity adds enough value to the first delivery after the journal works without it.
7. Perform the behavior-preserving Effect migration as a separate project.
8. Add public consumer evidence and the non-manual self-release gate.

## Genuine remaining maintainer choices

The research narrows but does not eliminate these decisions:

### Effect

- rc.108 versus rc.109 after a behavior-preserving migration plan and source-delta review;
- whether Workflow or Activity is present in the first delivery at all;
- whether unstable CLI/test dependencies are isolated, replaced, or carried through migration.

### Bundle and storage

- exact `bundle-manifest/v1` fields and ordering rules;
- whether provider intents live in the bundle envelope or a separately hashed journal root;
- durable bundle-store backend and transaction boundary;
- eager copy versus durable ownership transfer;
- retention and cleanup policy;
- exact shared-value boundary with effect-build.

### Journal and recovery

- journal backend, compare-and-swap model, and operation leases;
- dispatch-group representation for composite commands such as npm publish plus dist-tag;
- provider-specific visibility budgets and authoritative-absence rules;
- how maintainers explicitly authorize a risk-bearing retry after `Inconclusive`;
- correction and supersession authority.

### Product scope

- exact first-cut built-ins beyond npm, Warehouse/PyPI, GitHub, and one Git catalog;
- whether Homebrew formula support is in the first cut or immediately after it;
- which consumer outcomes are required before a release is called complete;
- Node library/config loading versus a separately specified standalone executable requirement;
- self-release rollout order and rollback/correction policy.

## Direct source index

### ts-release

- [canonical identity](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/canonical.ts)
- [current prepared model](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/release/prepared.ts)
- [artifact collections](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/artifact-collection.ts)
- [npm implementation](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/npm.ts)
- [PyPI implementation](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/pypi.ts)
- [GitHub implementation](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/github.ts)
- [catalog Git implementation](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/catalog-git.ts)
- [corrected probe commit](https://github.com/mannyc2/ts-release/commit/d57e7e91b58683d030201d278eb96cd5acd05a21)
- [corrected research run](https://github.com/mannyc2/ts-release/actions/runs/31948959001)

### Effect and effect-build

- [Effect beta.83 source](https://github.com/Effect-TS/effect/tree/cd7ab658994104bd6fe8f841f1440bea32c387f5)
- [Effect rc.108 source](https://github.com/Effect-TS/effect/tree/bef7bf38ae4b73d5511043f707aed083de5da7cc)
- [Effect rc.109 source](https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d)
- [effect-build exercised source](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13)
- [effect-build artifact value](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/standalone/Artifact.ts)

### Product comparison

- [preserved 151-case census](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/docs/refactor/research/goreleaser-outcomes.md)
- [GoReleaser source pin](https://github.com/goreleaser/goreleaser/tree/92453c1dbdf592d227cb236600093a503f2351f3)

## Final recommendation

Approve the research direction, not production implementation:

- immutable canonical bundles;
- provider-local contracts;
- explicit durable journal;
- per-coordinate continuation;
- open Node library/config extensibility;
- outcome-oriented product roadmap; and
- two-dimensional acceptance ending in self-release.

Defer Effect target selection and Workflow or Activity adoption until the separate migration and delivery choices are reviewed. Do not reopen a universal publisher abstraction or replace provider evidence with internal green checks.
