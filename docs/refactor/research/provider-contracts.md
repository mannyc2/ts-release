# Provider contracts and reconciliation facts

Status: research checkpoint. This document fixes the shipping provider scope and the provider-local fact model. It does not implement production APIs or mutate any provider.

## Shipping rewrite scope

The shipping rewrite scope is fixed:

1. npm;
2. PyPI/Warehouse;
3. GitHub Releases and release assets;
4. Homebrew formulas;
5. Scoop; and
6. arbitrary custom providers.

This is the shipping product scope and is not a remaining product-scope choice. Homebrew casks, OCI registries, object stores, GitLab Releases, Gitea Releases, Winget, and other destinations may be discussed as comparisons or later provider packages, but they do not replace or reduce the shipping scope above.

## Evidence discipline

Claims use these labels:

- **Provider-specified:** stated by official provider protocol or documentation.
- **Source-observed:** visible in pinned provider, client, or ts-release source.
- **Inferred:** a design consequence of provider-specified or source-observed facts.
- **Proposed:** a rewrite contract that still requires implementation evidence.

Current source evidence:

- [npm adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/npm.ts)
- [PyPI adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/pypi.ts)
- [GitHub adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/github.ts)
- [catalog Git adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/catalog-git.ts)
- [current report model](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/report.ts)

## One canonical desired representation

### Intent is the operation definition

A provider-specific `Intent` is the single canonical representation of one desired provider-local outcome. It contains:

- provider implementation identity;
- endpoint or namespace identity;
- provider-local coordinate;
- exact desired metadata and byte facts;
- referenced bundle artifacts;
- mutation mode and conditions relevant to the provider; and
- an explicit schema version.

There is no serialized `LogicalOperation` peer that repeats provider, endpoint, coordinate, artifact references, or desired facts.

```text
OperationId = hashCanonical(
  "ts-release/provider-intent/v1",
  canonicalEncodedIntent
)
```

`OperationId` is derived from the validated Intent. It is not stored as an unchecked peer and it is not computed by hashing duplicated fields alongside an intent digest. A cache or index may store the derived ID only if loading recomputes and checks it.

### Release plan and dependencies

A canonical release plan contains:

```text
ReleasePlan = {
  bundleId,
  intents,
  dependencyEdges
}
```

Each dependency edge references derived operation IDs. Dependencies are orchestration facts, not duplicate provider facts. The plan ID is derived from the canonical plan bytes.

### Journal events, not parallel peer records

The journal appends events that reference an operation ID. It does not separately persist a current state, an attempts array, an observations array, terminal facts, and evidence collections that can disagree.

```text
JournalEvent =
  | DispatchStarted
  | DispatchRejectedBeforeCommit
  | ReceiptAccepted
  | ObservationRecorded
  | RiskRetryAuthorized
  | ConsumerEvidenceRecorded
```

The current operation state is a deterministic fold of the release plan and ordered journal events. Attempts, terminal facts, receipts, observations, and evidence are carried by or referenced from the events that introduced them. A materialized state projection is a disposable index and must be reproducible from the canonical event history.

## Four independent facts

### Intent

The requested provider-local outcome before dispatch. Intent is desired state, not evidence.

### Provider-native Receipt

A mutation response that the provider or trusted client reports as accepted. It preserves provider-native identifiers and response facts rather than reducing every provider to one generic publication ID.

Examples:

- npm package/version, effective tag facts, and registry response identifiers;
- Warehouse repository, normalized project, filename, and upload response;
- GitHub release ID or asset ID, returned stored name, state, size, digest, and URLs;
- Git commit and conditional ref-update result.

A receipt is not a fresh read. It may be absent after a committed write whose response was lost.

### FreshObservation

A provider read performed after a named dispatch or recovery point. It records:

- provider implementation and endpoint observed;
- exact coordinate queried;
- request time and request identity when available;
- provider-native facts needed for audit;
- comparison with one canonical Intent; and
- classification.

A cached package index, local lockfile, prior receipt, or stale listing is not a fresh observation unless the provider contract explicitly makes it authoritative.

### ConsumerEvidence

An install, download, import, execution, or package-manager result in a named environment. Consumer evidence is separate from provider acceptance and reconciliation.

## Observation classifications

| Classification | Meaning | Another mutation attempt? |
| --- | --- | --- |
| `Equivalent` | Fresh provider facts satisfy the exact Intent. | No. The operation is satisfied. |
| `Conflict` | The coordinate exists with facts that contradict the Intent. | No automatic retry. |
| `AuthoritativelyAbsent` | Provider-local evidence proves the exact coordinate is not committed. | Yes, if creation remains authorized. |
| `AbsentRetryable` | The coordinate is absent, but visibility or propagation prevents a non-commit conclusion. | Observe again; do not mutate. |
| `Pending` | The provider reports accepted but nonterminal processing, indexing, scanning, or publication. | Observe again; do not duplicate. |
| `Inconclusive` | Available reads cannot prove equivalence, conflict, or non-commit. | No automatic retry. |

`Inconclusive` is not a temporary spelling of `AuthoritativelyAbsent`. Some custom providers cannot resolve response-loss uncertainty at all.

## npm

Official references:

- [`npm publish`](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
- [dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/)
- [package metadata response shape](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md)
- [trusted publishing](https://docs.npmjs.com/trusted-publishers/)

### Composite command, separate intents

One `npm publish --tag X` command can request two outcomes:

```text
NpmVersionIntent = {
  registryImplementation,
  registryOrigin,
  packageName,
  version,
  tarballIntegrity,
  shasum,
  access,
  provenancePolicy
}

NpmDistTagIntent = {
  registryImplementation,
  registryOrigin,
  packageName,
  tag,
  targetVersion
}
```

The physical command may share one `dispatchId`, but each Intent has its own derived operation ID and its own event fold. The version can be accepted while the tag is missing or points elsewhere. A tag can later move without changing immutable version bytes.

### Reconciliation law

- Compare version metadata and tarball integrity with `NpmVersionIntent`.
- Compare the dist-tag mapping with `NpmDistTagIntent`.
- Do not repair a version conflict by moving a tag.
- Do not classify correct version bytes as conflicting merely because a tag differs.
- Do not republish an already satisfied immutable version because consumer evidence is absent.

### npmjs versus compatible registries

The current adapter parses npm package metadata, versions, integrity, shasum, and dist-tags. npmjs uniqueness, deletion, provenance, trusted-publishing, and visibility laws are implementation laws. A compatible registry must declare its own implementation identity and recovery capabilities. Sharing an npm-like HTTP shape is insufficient.

## PyPI/Warehouse

Official references:

- [PyPI upload API](https://docs.pypi.org/api/upload/)
- [Simple Repository API](https://packaging.python.org/en/latest/specifications/simple-repository-api/)
- [file yanking](https://packaging.python.org/en/latest/specifications/file-yanking/)
- [PyPI trusted publishing](https://docs.pypi.org/trusted-publishers/using-a-publisher/)

### Per-file Intent

A PyPI release is plural. Each distribution filename is independently accepted and observed.

```text
WarehouseFileIntent = {
  repositoryImplementation,
  repositoryOrigin,
  normalizedProject,
  version,
  filename,
  size,
  sha256,
  distributionType,
  yankedExpectation
}
```

An sdist and five wheels therefore produce six Intents and six derived operation IDs. Accepted files are preserved while unresolved files continue.

### Warehouse versus compatible indexes

Warehouse upload and Simple API behavior are evidence for pypi.org. Compatible indexes may differ in duplicate handling, filename normalization, response status, indexing delay, metadata fields, yanking, and authorization. The provider implementation identity must state `Warehouse` only when Warehouse laws are actually relied on.

## GitHub Releases and assets

Official references:

- [Git references](https://docs.github.com/en/rest/git/refs)
- [Git tag objects](https://docs.github.com/en/rest/git/tags)
- [releases](https://docs.github.com/en/rest/releases/releases)
- [release assets](https://docs.github.com/en/rest/releases/assets)

### Release Intent

A GitHub release Intent includes repository identity, tag name, required tag-binding policy, target commit or tag object, release title/body, draft state, and prerelease state. If release creation can create a missing tag, that tag mutation is still represented and journaled as a provider fact within the GitHub release capability. It does not create a new shipping destination category.

### Asset Intent and effective stored name

```text
GitHubAssetIntent = {
  apiOrigin,
  repositoryId,
  releaseId,
  requestedPublicName,
  acceptedNameNormalizationRule,
  mediaType,
  size,
  sha256,
  artifactReference
}
```

The receipt records the returned asset ID, API URL, effective stored name, state, size, media type, digest, and download URL. A fresh listing must follow pagination to completion before absence can be authoritative.

A lost response is reconciled by applying the explicit name-normalization rule and comparing state, size, media type, and digest or downloaded bytes. Unexpected renaming is a conflict or inconclusive mapping, not automatic success.

## Homebrew formulas

Homebrew formulas are in the fixed shipping scope. Homebrew casks are not a substitute.

The release plan separates three outcomes:

1. formula rendering is structurally correct and references intended URLs and checksums;
2. the tap Git ref accepts the intended commit; and
3. a clean Homebrew consumer installs and executes the intended bytes.

```text
HomebrewFormulaIntent = {
  tapGitImplementation,
  remoteIdentity,
  ref,
  expectedPredecessor,
  formulaPath,
  formulaName,
  renderedFormulaArtifact,
  referencedArtifactDigests
}
```

The provider-native acceptance fact is the conditional Git publication. Formula semantics and `brew install` evidence remain separate.

## Scoop

Scoop is in the fixed shipping scope.

The release plan separates:

1. Scoop manifest rendering and URL/hash correctness;
2. bucket Git publication through a conditional ref update; and
3. clean Scoop installation and executable smoke behavior.

```text
ScoopManifestIntent = {
  bucketGitImplementation,
  remoteIdentity,
  ref,
  expectedPredecessor,
  manifestPath,
  manifestArtifact,
  referencedArtifactDigests
}
```

A successful Git ref update does not by itself prove that Scoop resolved, downloaded, installed, or executed the intended artifact.

## Git publication shared by Homebrew and Scoop

Git rendering and Git publication are distinct laws:

- rendered catalog bytes are finalized bundle artifacts;
- Git blobs, trees, and commits are content-addressed;
- the target ref is a mutable pointer;
- a conditional update is accepted only against its expected predecessor;
- response loss is reconciled by reading the ref and exact managed paths;
- a ref advanced to unrelated content is a conflict; and
- consumer installation remains separate evidence.

A shared Git publication implementation is valid because Homebrew and Scoop share these exact Git laws. Their renderers and consumer environments remain different.

## Arbitrary custom providers

Arbitrary custom providers are in the fixed shipping scope. The core does not certify or allowlist providers.

A provider package supplies:

- a stable implementation identity;
- a versioned canonical Intent schema;
- provider-native Receipt, observation, and error schemas;
- dispatch behavior;
- fresh observation and classification behavior;
- authoritative-absence rules, if any;
- pending and visibility policy;
- correction capabilities, if any; and
- evidence-environment declarations for claimed outcomes.

Illustrative boundary only:

```ts
interface ProviderContract<I, R, O, E, Requirements> {
  readonly implementationId: string
  readonly Intent: Schema.Schema<I>
  readonly Receipt: Schema.Schema<R>
  readonly Observation: Schema.Schema<O>
  readonly dispatch: (
    intent: I,
    context: DispatchContext
  ) => Effect.Effect<R, E, Requirements>
  readonly observe: (
    intent: I,
    context: ObservationContext
  ) => Effect.Effect<ObservationClassification<O>, E, Requirements>
}
```

There is deliberately no generic `Publisher`, `publish`, `verify`, `ensurePublished`, or universal receipt union. Generic orchestration validates Intent, derives operation identity, appends journal events, and folds state. Provider packages own the provider laws.

## Non-shipping comparisons

### Homebrew casks

Casks use a different language, artifact model, installation behavior, and consumer environment. They remain later product work and do not weaken the formula commitment.

### AWS S3 and compatible object stores

AWS S3 and each compatible implementation need explicit endpoint and implementation identity. ETags are not universal content hashes. They are valid custom-provider candidates, not fixed first-party shipping providers in this rewrite.

### Other SCM releases and package catalogs

GitLab Releases, Gitea Releases, Winget, AUR, Nix, Krew, OCI registries, and similar destinations may be implemented through arbitrary custom providers or later first-party packages. Their absence from the first-party list does not narrow the six fixed shipping capabilities.

## Consumer acceptance

Consumer evidence is recorded as:

```text
ObservedEquivalent
ObservedDifferent
ObservedFailure
NotObserved
```

Each result carries an evidence environment. Examples include clean npm consumer, clean Python virtual environment, public GitHub download, clean Homebrew host, clean Windows Scoop host, and self-release.

`NotObserved` is not a provider observation classification. A provider can be accepted or satisfied while consumer evidence remains `NotObserved`.

## Conclusions

1. The shipping provider scope is fixed: npm, PyPI/Warehouse, GitHub Releases/assets, Homebrew formulas, Scoop, and arbitrary custom providers.
2. Intent is the single canonical desired representation.
3. Operation identity is derived directly from canonical Intent bytes.
4. No serialized LogicalOperation peer repeats Intent fields.
5. Journal events are canonical; current state and evidence indexes are derived projections.
6. Intent, receipt, fresh observation, and consumer evidence remain separate facts.
7. npm version/tag and plural Warehouse files remain independently recoverable even when a command is composite.
8. Homebrew and Scoop share Git publication laws but retain separate rendering and consumer laws.
9. Provider-local coordinates, receipts, errors, and reconciliation remain provider-local.
10. The evidence does not support a universal Publisher, verify, or ensurePublished abstraction.
