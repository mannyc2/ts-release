# Refactor research decision packet

Status: review-ready research checkpoint. Production implementation remains paused.

This packet consolidates provider, artifact, resumability, Effect, extensibility, product-scope, and acceptance research. It records decisions now fixed by evidence and choices that still belong to maintainers.

## Executive conclusion

The shipping rewrite is organized around:

1. one finalized immutable release bundle;
2. one canonical release plan containing provider-specific Intents;
3. operation IDs derived directly from canonical Intent bytes;
4. one append-only journal history whose current state is derived by folding events;
5. provider-local receipts, observations, errors, and reconciliation;
6. explicit outcome plus evidence-environment acceptance; and
7. a fixed provider scope: npm, PyPI/Warehouse, GitHub Releases/assets, Homebrew formulas, Scoop, and arbitrary custom providers.

Effect supplies composition, typed errors, Layers, scopes, and possibly later Workflow/Activity execution. It does not define provider facts, replace the journal, or make external mutations exactly once.

No production API, Effect migration, Workflow/Activity implementation, or live provider mutation is included in this PR.

## Fixed shipping product scope

The shipping rewrite includes all of these capabilities:

- npm;
- PyPI/Warehouse;
- GitHub Releases and release assets;
- Homebrew formulas;
- Scoop; and
- arbitrary custom providers.

This scope is not a recommended sample, a first-cut option, or a remaining maintainer choice.

Homebrew and Scoop may share an exact conditional Git publication implementation, but both renderers and both consumer outcomes ship. Arbitrary custom providers ship through the open library/configuration contract without a central provider allowlist.

Homebrew casks, OCI registries, object stores, GitLab Releases, Gitea Releases, Winget, and other destinations remain custom-provider candidates or later first-party packages. They do not replace or reduce the fixed list.

## Decisions supported by evidence

### 1. Intent is the sole canonical provider-operation representation

A versioned provider-specific Intent contains provider implementation, endpoint, coordinate, desired metadata, desired byte facts, mutation conditions, and bundle artifact references.

```text
OperationId = hashCanonical(
  "ts-release/provider-intent/v1",
  canonicalEncodedIntent
)
```

There is no serialized LogicalOperation peer that repeats Intent fields and then hashes those fields alongside an intent digest. A cached operation ID is accepted only after recomputation.

A correction creates a new Intent and therefore a new operation ID. It does not mutate the old Intent or history.

See [provider-contracts.md](./provider-contracts.md) and [resumability.md](./resumability.md).

### 2. Canonical events, derived state

The journal does not persist these as parallel authoritative representations:

```text
state
attempts
attempt terminal facts
receipts
observations
evidence
```

Instead, it stores one ordered event stream:

```text
DispatchStarted
DispatchRejectedBeforeCommit
ReceiptAccepted
ObservationRecorded
RiskRetryAuthorized
ConsumerEvidenceRecorded
```

Current state, attempt indexes, receipt indexes, and observation indexes are deterministic projections of the release plan plus events. A stored projection must be recomputable and checked.

This removes disagreement paths such as:

- `state = Accepted` with no acceptance receipt event;
- a terminal attempt fact that disagrees with the state field;
- an observation array not reflected in the state;
- a duplicated provider/coordinate record that differs from Intent; or
- an operation ID derived from fields different from the persisted Intent.

### 3. Intent, receipt, observation, and consumer evidence are separate

Persist independently through the plan and journal:

```text
Intent
ProviderNativeReceipt
FreshObservation
ConsumerEvidence
```

A receipt is not a fresh read. A fresh read is not proof that the mutation response returned. Consumer installation can remain `NotObserved` after provider acceptance without authorizing another mutation.

### 4. No universal publication service

The evidence continues to reject a universal `Publisher`, `publish`, `verify`, `verifyInstall`, or `ensurePublished` service.

npm versions and tags, Warehouse files, GitHub releases and assets, Homebrew formulas, Scoop manifests, conditional Git refs, and arbitrary providers have different coordinates, receipts, conflict laws, visibility, and irreducible uncertainty.

Generic orchestration:

- validates Intent;
- derives operation identity;
- appends journal events;
- folds current state;
- enforces write-ahead dispatch; and
- blocks blind repetition.

Provider packages own dispatch, receipts, observations, absence law, pending law, conflicts, correction, and typed errors.

### 5. Direct immutable bundle construction

The public artifact model constructs a finalized immutable bundle directly. Any ingestion accumulator remains private.

The bundle uses the existing canonical JSON and domain-separated hashing laws in:

- [`src/model/canonical.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/canonical.ts)
- [`scripts/lib/canonical-json.ts`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/scripts/lib/canonical-json.ts)

One bundle ID is derived from one versioned canonical manifest. There is no unchecked stored ID peer.

Bundle-relative references are resolved into nonforgeable bundle-bound handles at load time. Qualified references are used only when independently crossing envelopes.

See [artifact-model.md](./artifact-model.md).

### 6. The release program owns durable root outputs

Producer libraries own output construction and scoped readers. The release program owns:

- adoption into durable storage;
- logical artifact identity;
- provider meaning;
- canonical bundle finalization;
- release-plan construction;
- retention; and
- cleanup authority.

Architectural validity follows exact laws. A second adopter is not required to prove validity. Adoption and maintenance cost determine package extraction priority.

### 7. Write-ahead journal before provider dispatch

The normal mutation law is:

```text
Intent exists in canonical plan
  -> append and durably commit DispatchStarted
  -> cross provider mutation boundary
  -> append receipt, non-commit proof, or fresh observation
```

A new mutation attempt normally requires derived `ProvenNotCommitted`. `Inconclusive` never retries automatically. A risk-bearing retry requires an explicit audited `RiskRetryAuthorized` event.

### 8. Composite commands do not create composite duplicate operations

One physical command may affect several Intents. Example:

```text
npm publish --tag latest
```

The npm version Intent and dist-tag Intent each receive a `DispatchStarted` event with the same physical `dispatchId`. Each remains independently accepted, observed, conflicted, or inconclusive.

The same rule applies when one Git commit exposes several catalog files. The Git publication Intent is not a second copy of renderer facts; it references finalized rendered artifacts.

### 9. Homebrew formulas and Scoop both ship

Homebrew formula and Scoop outcomes each separate:

1. renderer correctness;
2. conditional Git publication acceptance and reconciliation; and
3. clean package-manager installation and execution.

They share exact Git laws but not rendering or consumer laws. The rewrite does not choose one generic catalog example in place of the two shipping destinations.

### 10. Effect alignment remains a separate migration decision

Corrected evidence shows rc.108 and rc.109 both pass:

- effect-build install;
- build;
- check;
- type tests;
- unit tests;
- 14/14 clean packed consumers; and
- aligned ts-release install.

Both fail at ts-release's TypeScript check because beta.83 source needs a broad migration. The former rc.108 platform mismatch and rc.109 `@effect/bun-test` 404 were harness defects.

No target is selected. Current evidence does not rank rc.108 and rc.109 migration cost or runtime suitability.

See [effect-patterns.md](./effect-patterns.md).

### 11. Workflow/Activity does not replace provider history

At the inspected Effect pins, Activity result identity uses workflow execution ID, Activity name, and attempt. That is engine identity, not release-provider identity.

Workflow/Activity may execute plan and journal transitions after it reads and CAS-appends the canonical history. It cannot infer remote commit after response loss and cannot replace provider-local reconciliation.

### 12. The GoReleaser comparison retains both audit layers

The current branch now retains two documents:

- [goreleaser-evidence-census.md](./goreleaser-evidence-census.md): the complete 151-case GoReleaser/current-ts-release/v0.0.7/rewrite comparison; and
- [goreleaser-outcomes.md](./goreleaser-outcomes.md): a derived outcome roadmap that references census case IDs.

The roadmap contains an exhaustive crosswalk in which every `C001-C115` and `P001-P036` case maps to a current outcome and disposition.

The census remains source traceability. The roadmap remains product interpretation. Neither replaces the other.

### 13. Native npm and native PyPI are explicit additions

GoReleaser's npm cases describe downloadable binary wrapper packages, not native publication of a TypeScript package. Its Python builder cases describe wheel/sdist construction, not native Warehouse publication.

The roadmap therefore includes native npm and native PyPI/Warehouse as fixed ts-release shipping outcomes and marks the corresponding census cases as contrast evidence rather than false equivalents.

### 14. Acceptance is outcome plus environment

Outcome claims include:

```text
L - structural law
R - local runtime law
X - extension law
A - provider acceptance
M - public or authoritative metadata
B - intended byte identity
C - consumer behavior
J - continuation/recovery
S - self-release
```

Evidence environments include:

```text
compile
in-process
clean-consumer
protocol-double
scratch-provider
public-provider
end-user
self-release
```

Each record names outcome, environment, subject, result, evidence reference, and limitations. A green check is not an unqualified product claim.

## Shipping provider outcomes

### npm

- immutable package-version Intent;
- mutable dist-tag Intent;
- one command may share a dispatch ID across both;
- npmjs and compatible registry implementations remain distinct;
- tarball integrity and clean install are separate evidence.

### PyPI/Warehouse

- one Intent per distribution filename;
- plural wheels and sdist continue independently;
- Warehouse and compatible indexes remain distinct implementations;
- Simple API metadata, exact bytes, and clean install/import are separate evidence.

### GitHub Releases and assets

- release metadata, tag-binding policy, and assets remain provider-local facts;
- each asset has requested-name and effective-stored-name rules;
- complete pagination is required before authoritative absence;
- release acceptance, asset acceptance, public bytes, and execution remain separate.

### Homebrew formulas

- formula renderer consumes finalized bundle facts;
- conditional tap Git publication is provider acceptance;
- ref/path observation is recovery evidence;
- `brew install` and executable smoke are consumer evidence.

### Scoop

- manifest renderer consumes finalized bundle facts;
- conditional bucket Git publication is provider acceptance;
- ref/path observation is recovery evidence;
- Scoop install and executable smoke are consumer evidence.

### Arbitrary custom providers

- providers supply versioned Intent, Receipt, observation, and error schemas;
- the core derives identity and enforces event-history laws;
- no allowlist or certification registry is required;
- providers that cannot prove non-commit may end `Inconclusive`.

## Decisive acceptance gate

The eventual integrated gate is:

> ts-release performs its own non-manual release through the rewritten product, using one finalized bundle and canonical plan, appending the journal before every external mutation, continuing any interrupted Intent without blind repetition, publishing intended public metadata and bytes, and passing clean consumer installation or execution for the shipping destinations exercised.

A decisive self-release record includes:

- bundle ID and canonical manifest;
- canonical release plan ID;
- every provider Intent and derived operation ID;
- dependency edges;
- dispatch, receipt, observation, and consumer evidence events;
- public byte comparisons;
- clean npm and Python consumer evidence;
- GitHub public asset evidence;
- Homebrew formula install evidence;
- Scoop install evidence on a Windows environment;
- arbitrary-provider extension evidence; and
- at least one intentionally interrupted operation continued without blind repetition.

## Suggested implementation sequence after approval

This is sequencing guidance, not a scope reduction:

1. Freeze bundle manifest, Intent identity, release-plan, and event-history laws.
2. Implement deterministic in-memory validation and folding for the full event model.
3. Add durable plan and journal storage with CAS and recovery.
4. Port npm and Warehouse/PyPI provider contracts.
5. Port GitHub Releases and assets.
6. Implement the shared conditional Git publication service.
7. Port Homebrew formula and Scoop renderers and consumer evidence.
8. Establish arbitrary custom-provider loading against the real contract.
9. Perform the behavior-preserving Effect migration as a separate project.
10. Add scratch/public provider evidence and the non-manual self-release gate.

Steps may be parallelized, but all six shipping capabilities remain in the rewrite definition.

## Genuine remaining maintainer choices

### Effect

- rc.108 versus rc.109 after a behavior-preserving migration design;
- whether Workflow/Activity is included in the first delivery;
- whether unstable CLI/test dependencies are isolated, replaced, or migrated.

### Bundle and plan

- exact `bundle-manifest/v1` fields and ordering;
- exact provider Intent schema versions;
- whether provider Intents live in the bundle envelope or a separately hashed release plan;
- durable bundle-store backend and transaction boundary;
- eager copy versus durable ownership transfer;
- retention and cleanup policy.

### Journal

- event schema details and storage backend;
- compare-and-swap and lease model;
- dispatch ID allocation for composite commands;
- provider-specific observation budgets;
- authoritative-absence thresholds;
- authority and UI for risk-bearing retry;
- compaction and redaction policy.

### Acceptance

- exact clean-consumer matrices for npm and Python;
- GitHub asset byte evidence policy;
- Homebrew host versions and smoke commands;
- Windows/Scoop host versions and smoke commands;
- which custom-provider evidence is required for shipping;
- self-release rollout and correction policy.

The provider scope itself is not in this list.

## Direct source index

### Research documents

- [provider contracts](./provider-contracts.md)
- [resumability and event history](./resumability.md)
- [artifact model](./artifact-model.md)
- [Effect patterns](./effect-patterns.md)
- [complete GoReleaser evidence census](./goreleaser-evidence-census.md)
- [derived GoReleaser outcome roadmap](./goreleaser-outcomes.md)

### ts-release implementation evidence

- [canonical identity](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/canonical.ts)
- [prepared release model](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/release/prepared.ts)
- [prepared store](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/release/prepared-store.ts)
- [artifact collections](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/model/artifact-collection.ts)
- [npm implementation](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/npm.ts)
- [PyPI implementation](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/pypi.ts)
- [GitHub implementation](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/github.ts)
- [catalog Git implementation](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/catalog-git.ts)
- [corrected probe commit](https://github.com/mannyc2/ts-release/commit/d57e7e91b58683d030201d278eb96cd5acd05a21)
- [corrected research run](https://github.com/mannyc2/ts-release/actions/runs/31950649319)

### Effect and effect-build

- [Effect beta.83](https://github.com/Effect-TS/effect/tree/cd7ab658994104bd6fe8f841f1440bea32c387f5)
- [Effect rc.108](https://github.com/Effect-TS/effect/tree/bef7bf38ae4b73d5511043f707aed083de5da7cc)
- [Effect rc.109](https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d)
- [effect-build exercised source](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13)

## Final recommendation

Approve the corrected research direction:

- fixed six-capability shipping scope;
- Intent as the only canonical provider-operation representation;
- operation IDs derived from canonical Intent bytes;
- append-only canonical journal events with derived state;
- immutable canonical bundles;
- provider-local contracts and reconciliation;
- retained 151-case census plus auditable roadmap crosswalk;
- open arbitrary-provider extensibility; and
- outcome/environment acceptance ending in self-release.

Do not reopen shipping scope, recreate peer representations, collapse the census into the roadmap, or replace provider evidence with internal green checks.
