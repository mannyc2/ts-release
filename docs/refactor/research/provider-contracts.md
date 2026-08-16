# Provider contracts and reconciliation facts

Status: research checkpoint. This document specifies provider-local facts and recovery laws. It does not define a universal `Publisher`, `verify`, `ensurePublished`, or provider admission mechanism.

## Evidence discipline

Claims in this document use four labels:

- **Provider-specified:** stated by the provider's official protocol or product documentation.
- **Source-observed:** implemented or parsed by current ts-release source at a pinned commit.
- **Inferred:** a design consequence drawn from provider-specified or source-observed facts.
- **Proposed:** a contract for the rewrite that still requires implementation and provider acceptance evidence.

The current implementations are useful evidence, not the final architecture:

- [npm adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/npm.ts)
- [PyPI adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/pypi.ts)
- [GitHub adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/github.ts)
- [catalog Git adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/catalog-git.ts)
- [current correction intent](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/correction/intent.ts)

## Three separate provider facts

A durable release record must not collapse these values into one generic result.

### `Intent`

`Intent` is the canonical statement of the requested provider-local outcome before dispatch. It includes:

- provider implementation identity;
- endpoint or namespace identity;
- provider-local coordinate;
- artifact or metadata digest requirements;
- mutable pointer requirements, if any;
- authorization and mutation mode relevant to the request; and
- an intent schema version and canonical digest.

An `Intent` is not evidence that a provider accepted anything.

### Provider-native `Receipt`

A `Receipt` is returned by the mutation boundary after the provider reports acceptance. It preserves provider-native identifiers and response facts rather than reducing them to a universal publication ID. Examples include:

- npm registry name, version, effective tag, and registry response facts;
- Warehouse upload response and exact filename coordinate;
- GitHub release ID, asset API URL, returned asset name, and digest field;
- a Git commit SHA and updated ref;
- AWS S3 ETag, version ID, checksum, request ID, and endpoint facts.

A receipt is not a fresh read and may be absent after a committed write whose response was lost.

### `FreshObservation`

A `FreshObservation` records a read performed after a specified dispatch or recovery point. It contains:

- the provider implementation and endpoint observed;
- the exact coordinate queried;
- observation time and request identity;
- raw provider-native facts needed for later audit;
- the comparison against one canonical `Intent`; and
- the observation classification.

A cached package index, local lockfile, prior receipt, or stale listing is not a `FreshObservation` unless the provider contract explicitly makes it authoritative for that coordinate.

## Observation classifications

The rewrite should use provider-local observation evidence to produce one of these classifications:

| Classification | Meaning | May dispatch another attempt? |
| --- | --- | --- |
| `Equivalent` | Fresh provider facts satisfy the exact intent. | No; operation is satisfied. |
| `Conflict` | The coordinate exists, but provider facts contradict the intent. | No; requires correction or maintainer decision. |
| `AuthoritativelyAbsent` | The provider gives authoritative evidence that the exact coordinate is not committed. | Yes, if provider policy permits creation. |
| `AbsentRetryable` | The coordinate is absent, but the absence may still be a visibility or propagation state. | Not yet; follow the bounded observation policy. |
| `Pending` | Provider reports an accepted, processing, scanning, indexing, or otherwise nonterminal state. | No blind retry; observe until terminal or budget exhaustion. |
| `Inconclusive` | The read cannot prove equivalence, conflict, or absence. | No blind retry. Preserve uncertainty. |

`Inconclusive` is not a temporary synonym for `AuthoritativelyAbsent`. Some operations remain irreducibly inconclusive because the provider exposes no read that can distinguish response loss from non-commit.

## Stable logical operation and attempt identity

A provider mutation is one stable logical operation with zero or more dispatch attempts:

```text
LogicalOperationId = hash(
  provider implementation identity,
  endpoint or namespace identity,
  provider-local coordinate,
  canonical Intent digest
)

AttemptId = LogicalOperationId + attempt ordinal
```

The provider coordinate is not a generic string. Each provider owns its coordinate type, receipts, errors, and reconciliation rules.

## npm and npm-compatible registries

Official npm references:

- [`npm publish`](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
- [dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/)
- [package metadata response shape](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md)
- [trusted publishing](https://docs.npmjs.com/trusted-publishers/)

### Exact desired outcome

One user-facing npm publication commonly asks for two different provider facts:

1. an immutable package-version outcome, including the tarball bytes and integrity fields; and
2. a mutable dist-tag pointer, such as `latest -> 1.2.3`.

`npm publish --tag X` may request both through one CLI operation, but recovery must compare them independently. The version can be accepted while the intended tag is absent or points elsewhere. Conversely, a tag can later move without changing the immutable version.

### Proposed coordinates

```text
NpmVersionCoordinate = {
  registryImplementation,
  registryOrigin,
  packageName,
  version
}

NpmDistTagCoordinate = {
  registryImplementation,
  registryOrigin,
  packageName,
  tag
}
```

The version `Intent` includes tarball SHA-512 integrity, legacy shasum if required by the implementation, package metadata identity, access mode, and provenance policy. The tag `Intent` includes the exact target version.

### Reconciliation law

- Version metadata and tarball integrity are compared against the version intent.
- The dist-tag map is compared against the tag intent.
- A version conflict is not repaired by moving a tag.
- A tag difference does not make already-correct immutable bytes conflicting.
- A returned npm CLI success is a receipt for the command, but the journal still records version and tag facts separately.

### npmjs versus compatible registries

The current adapter parses npm registry package metadata and dist-tags. Those exact response, uniqueness, provenance, trusted-publishing, and deletion laws are **npmjs implementation laws**, not automatically laws of every registry that accepts an npm-like protocol.

An arbitrary compatible registry therefore needs its own `registryImplementation` identity and capability facts. Sharing an HTTP shape does not prove equivalent conflict, visibility, immutability, tag, or authorization behavior.

## Warehouse and PyPI-compatible repositories

Official references:

- [PyPI upload API](https://docs.pypi.org/api/upload/)
- [Python Simple Repository API](https://packaging.python.org/en/latest/specifications/simple-repository-api/)
- [file yanking](https://packaging.python.org/en/latest/specifications/file-yanking/)
- [PyPI trusted publishing](https://docs.pypi.org/trusted-publishers/using-a-publisher/)

### Exact desired outcome

A PyPI release is a set of independently observable file coordinates. Wheels and source distributions can make partial progress. Project and version pages are derived views and must not erase the per-file commit boundary.

```text
PyPiFileCoordinate = {
  repositoryImplementation,
  repositoryOrigin,
  normalizedProject,
  filename
}
```

The file intent includes the exact filename, size, SHA-256 digest, project/version relationship, file type, and yanked expectation when relevant.

### Warehouse versus compatible implementations

Warehouse upload behavior and its Simple API representation are implementation-specific evidence for pypi.org. A private or compatible index may differ in duplicate handling, filename normalization, upload response, indexing delay, yanking, metadata fields, and authorization.

The rewrite should therefore name `Warehouse` when relying on Warehouse laws and otherwise record an explicit compatible implementation. It should not label every compatible endpoint as `PyPI` and inherit pypi.org recovery conclusions.

### Partial progress

For a release containing files `A`, `B`, and `C`:

- `A = Equivalent` is terminal and must not be uploaded again;
- `B = AuthoritativelyAbsent` may be dispatched if creation is authorized;
- `C = Pending` or `Inconclusive` remains blocked from blind repetition; and
- the parent publication is complete only when every required file coordinate is satisfied.

## GitHub tags, releases, and assets

Official references:

- [Git references](https://docs.github.com/en/rest/git/refs)
- [Git tag objects](https://docs.github.com/en/rest/git/tags)
- [releases](https://docs.github.com/en/rest/releases/releases)
- [release assets](https://docs.github.com/en/rest/releases/assets)

### Separate coordinates

A GitHub release flow can contain at least four distinct facts:

1. a lightweight tag ref pointing directly to a commit;
2. an annotated tag object, whose ref points to the tag object;
3. a release resource associated with `tag_name`; and
4. one asset per effective stored asset name.

These are not one atomic provider coordinate.

```text
GitTagRefCoordinate = { apiOrigin, repositoryId, refName }
GitTagObjectCoordinate = { apiOrigin, repositoryId, tagObjectSha }
GitHubReleaseCoordinate = { apiOrigin, repositoryId, tagName }
GitHubAssetCoordinate = { apiOrigin, repositoryId, releaseId, effectiveStoredName }
```

### Tag creation

The intent must state whether the desired tag is lightweight or annotated and what commit or tag object it must resolve to. Observing only that a release has the right `tag_name` does not prove the ref binding. If release creation is allowed to create a missing tag implicitly, that implicit mutation is still journaled as a separate desired and observed fact.

### Asset-name normalization

GitHub's upload API accepts a requested `name` and returns a stored asset object. The rewrite must not assume that a local filename, requested name, and returned stored name are necessarily identical.

- Before dispatch, the intent records the requested public asset name.
- The receipt records the returned asset ID, API URL, stored name, state, size, media type, and digest when available.
- A fresh listing compares the **effective stored name** and bytes against the intent.
- Any accepted normalization rule must be explicit and deterministic. Unexpected renaming is a conflict or an inconclusive mapping, not automatic success.

A lost upload response is recovered by listing all assets, finding the effective name under the explicit normalization rule, and comparing size and digest. Absence from an incomplete or paginated listing is not authoritative absence.

## Homebrew formulas and casks

Official references:

- [Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Cask Cookbook](https://docs.brew.sh/Cask-Cookbook)

A formula and a cask are different publication and installation languages:

- formulas describe source or binary package build/install behavior through Ruby formula definitions;
- casks describe macOS application artifacts, artifacts such as `app`, `pkg`, or `binary`, uninstall behavior, and cask-specific version/checksum rules.

They must not share one generic `HomebrewPackageCoordinate` merely because both are stored in Git repositories.

```text
HomebrewFormulaCoordinate = { gitRemote, ref, formulaPath, formulaName }
HomebrewCaskCoordinate = { gitRemote, ref, caskPath, token }
```

The Git ref update is one provider acceptance fact. Formula or cask rendering correctness and an actual `brew install` or `brew install --cask` are separate evidence outcomes.

## Catalog Git publication

The current catalog adapter builds and conditionally publishes an exact target/state pair through GitHub Git-data APIs. The rewrite should preserve three independent outcomes:

1. **Git publication:** a commit exists and the intended ref resolves to it;
2. **catalog rendering:** files at the intended paths encode the correct version, downloads, checksums, and managed state; and
3. **consumer installation:** the package manager resolves the catalog and installs or executes the intended bytes.

A successful conditional ref update is a provider-native receipt for Git publication. It does not prove that the rendered catalog is semantically correct or that downstream package managers have observed the ref.

The coordinate includes remote implementation, repository, ref, expected predecessor, and managed paths. A conflict on the ref is not equivalent to a rendering conflict and should preserve the observed predecessor SHA.

## AWS S3 and S3-compatible object stores

Official AWS references:

- [S3 API operations](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Operations_Amazon_Simple_Storage_Service.html)
- [virtual-hosted and path-style request identity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html)
- [bucket naming and uniqueness](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html)

### AWS coordinate

```text
AwsS3ObjectCoordinate = {
  partition,
  accountOrAuthorityScope,
  endpointOrigin,
  region,
  bucket,
  key,
  versionIdPolicy
}
```

The intent may include checksum algorithm/value, content length, content type, metadata, object-lock conditions, encryption policy, and conditional headers. A receipt preserves request IDs, ETag, checksum fields, and version ID when versioning is enabled.

ETag must not be treated as a universal content hash. Its meaning depends on upload mode, encryption, and implementation.

### Generic compatible endpoints

An endpoint that implements an S3-like API is not automatically AWS S3. MinIO, cloud-provider object stores, proxies, and local emulators can differ in endpoint identity, consistency, checksums, versioning, conditional writes, multipart ETags, listing, and authorization.

The provider implementation and endpoint origin therefore participate in the coordinate. `bucket + key` alone is insufficient and can alias independent stores.

## Unknown custom providers

An arbitrary provider package supplies:

- its provider implementation identity;
- a canonical coordinate Schema;
- an `Intent` Schema and digest law;
- provider-native receipt and error Schemas;
- an observe operation and classification rules;
- explicit evidence for authoritative absence, if available;
- retry and correction capabilities; and
- an evidence-environment declaration for each claimed outcome.

The core does not certify the provider. It persists opaque provider-native values under the provider's versioned Schemas and enforces the generic journal transitions. A provider that cannot distinguish non-commit from response loss can still participate, but its operation may end `Inconclusive` and require a maintainer decision.

## Consumer acceptance is a separate model

Provider observation does not answer whether a consumer can use the release.

`NotObserved` is therefore a **consumer-evidence result**, not a provider observation classification. It means the requested consumer outcome was not exercised in the stated environment. Examples:

- npm version accepted, but clean installation was not run;
- GitHub asset equivalent, but public download was not exercised;
- Git ref updated, but Homebrew rendering or installation was not observed.

Consumer evidence can be:

```text
ObservedEquivalent
ObservedDifferent
ObservedFailure
NotObserved
```

Each result is paired with an evidence environment such as clean local consumer, scratch registry, public registry, end-user host, or self-release. A provider can be `Accepted(receipt)` while the consumer outcome remains `NotObserved`.

## Proposed provider boundary shape

This is illustrative, not a production API:

```ts
interface ProviderContract<Coordinate, Intent, Receipt, Observation, Error> {
  readonly implementationId: string
  readonly intentDigest: (intent: Intent) => Digest
  readonly coordinateOf: (intent: Intent) => Coordinate
  readonly observe: (
    coordinate: Coordinate,
    intent: Intent
  ) => Effect<ObservationClassification<Observation>, Error, Requirements>
  readonly dispatch: (
    intent: Intent,
    attempt: AttemptContext
  ) => Effect<Receipt, Error, Requirements>
}
```

There is deliberately no shared `verify`, `ensurePublished`, `publish`, correction, or success-receipt union. Generic orchestration acts on journal transitions while provider packages own the actual mutation and observation laws.

## Conclusions

1. Intent, receipt, fresh observation, and consumer evidence are separate facts.
2. Provider implementation and endpoint identity are part of the coordinate whenever compatible implementations can differ.
3. Mutable pointers and immutable bytes are separate coordinates even when one command requests both.
4. Pending and inconclusive states are durable product states, not errors to erase through retries.
5. `NotObserved` belongs to consumer acceptance, not provider reconciliation.
6. Provider-local coordinates, receipts, errors, and reconciliation must remain provider-local.
7. No universal `Publisher`, `verify`, or `ensurePublished` contract is supported by the evidence.
