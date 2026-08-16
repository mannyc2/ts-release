# Provider contracts

Status: active research. This checkpoint records the research method, source index, and early findings. It does not select a root API.

Research baselines:

- current ts-release: `1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`
- released ts-release v0.0.7: `af59436cff908fb52773cf18dd95d154f892b8de`

## Claim labels

Every material claim in this document will be marked as one of:

- **Provider-specified**: stated by primary provider documentation or protocol specification.
- **Current-code-observed**: observed in current ts-release source.
- **Released-code-observed**: observed in v0.0.7 source.
- **Inferred**: a conclusion drawn from cited evidence.
- **Proposal**: a design recommendation, not a domain fact.

## Questions applied to every provider

For npm, PyPI-compatible registries, GitHub Releases, Homebrew, Scoop, and one arbitrary custom provider, establish:

- publication coordinates and zero/one/many multiplicity;
- the documented successful response and exactly what it establishes;
- failures proving that no mutation committed;
- failures leaving the remote result genuinely unknown;
- immutable and mutable remote objects;
- native idempotency, conditional operations, and conflict behavior;
- authoritative recovery after a lost response;
- partial-success boundaries and visibility delays;
- returned identities, sizes, hashes, digests, and receipts;
- public-read and consumer surfaces;
- whether provider acceptance, public visibility, byte identity, and consumer usability are distinct outcomes;
- current behavior, v0.0.7 behavior, wire facts, and architectural policy.

The working assumption is that a provider's documented successful response is normal success. Reconciliation is investigated separately for the narrower case where a mutation may have committed but the response was not received or recorded.

## Early findings

### npm

- **Provider-specified:** package name plus version identifies a package version; an existing version cannot be overwritten or reused after unpublish. Dist-tags are separately mutable.
- **Provider-specified:** npm publication metadata contains tarball `dist.integrity` and legacy `dist.shasum` values. The npm implementation builds SHA-512 integrity and SHA-1 shasum before the registry PUT.
- **Inferred:** a completed documented publish should be returned as success. A connection/process loss after possible dispatch requires a read of exact version metadata and comparison of integrity/shasum; it does not justify treating every completed publisher process as unknown.
- **Current-code-observed:** current ts-release converts `PublisherExited` to `OutcomeUnknown` and requires re-observation even when the publisher exited normally.
- **Released-code-observed:** v0.0.7 ran `npm publish`, then only checked `npm view package@version version`; it did not compare published tarball integrity.

Primary sources:

- https://docs.npmjs.com/cli/v11/commands/npm-publish/
- https://docs.npmjs.com/policies/unpublish/
- https://github.com/npm/libnpmpublish/blob/e45d51c357705bfd596cbef661b95bd59c7e629e/publish.js
- https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/src/publication/npm.ts
- https://github.com/mannyc2/ts-release/blob/af59436cff908fb52773cf18dd95d154f892b8de/src/targets/npm.ts

### PyPI-compatible registries

- **Provider-specified:** upload operates on individual distribution files; one project/version can have multiple wheels and source distributions.
- **Provider-specified:** the Simple Repository API can expose exact filename, size, hashes, yanked state, and upload time. Each file is an independently observable coordinate.
- **Inferred:** partial success is naturally per distribution file. A successful upload response establishes acceptance of that file; a lost response can be reconciled through an exact filename plus hash/size read when the registry exposes those fields.
- **Current-code-observed:** current ts-release represents every upload `2xx` as `Started`, then relies on Simple API re-observation before declaring the file equivalent.
- **Released-code-observed:** v0.0.7 accepted arbitrary repository URLs and plural distribution paths, but had no post-upload read step.

Primary sources:

- https://docs.pypi.org/api/upload/
- https://packaging.python.org/en/latest/specifications/simple-repository-api/
- https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py
- https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/src/publication/pypi.ts
- https://github.com/mannyc2/ts-release/blob/af59436cff908fb52773cf18dd95d154f892b8de/src/targets/pypi.ts

### GitHub Releases

- **Provider-specified:** a release is addressed within a repository, and release assets are independently named resources attached to that release.
- **Provider-specified:** successful asset upload returns an asset resource including upload state, size, and SHA-256 digest. GitHub also documents an ambiguous failure case where a failed upload may leave a `starter` asset.
- **Inferred:** release creation and each asset upload are distinct partial-success boundaries. A normal `201` asset response can be returned directly; a lost response can be reconciled by reading the release and matching asset name, state, size, content type, and digest.
- **Released-code-observed:** v0.0.7 used `gh release create` with all selected assets, then checked release fields and asset names, not byte identity.
- **Current-code-observed:** current ts-release has exact asset digest comparison and response-loss recovery, but applies the shared observe/decide/mutate/reobserve protocol to normal success as well.

Primary sources:

- https://docs.github.com/en/rest/releases/releases
- https://docs.github.com/en/rest/releases/assets
- https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/src/publication/github.ts
- https://github.com/mannyc2/ts-release/blob/af59436cff908fb52773cf18dd95d154f892b8de/src/targets/github.ts

### Homebrew and Scoop

- **Provider-specified/inferred:** arbitrary taps and buckets are Git repositories. Publication coordinates are repository, ref, and managed formula/cask/manifest path. Immutable Git objects and a mutable conditional ref update provide the natural reconciliation surface.
- **Released-code-observed:** v0.0.7 supported plural Homebrew artifact IDs and generic Git directory delivery; Homebrew and Scoop were not inherently coupled to the stock GitHub Release provider.
- **Current-code-observed:** current ts-release uses GitHub Git-data APIs and couples catalog prerequisites to prepared GitHub release subjects. The conditional full-tree update is useful; the GitHub-only coupling is architectural policy.
- **Inferred:** successful Git publication, artifact availability, and clean `brew install` or `scoop install` are distinct outcomes.

Primary sources:

- https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap
- https://docs.brew.sh/Formula-Cookbook
- https://github.com/ScoopInstaller/Scoop/wiki/Buckets
- https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests
- https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/src/publication/catalog-git.ts
- https://github.com/mannyc2/ts-release/blob/af59436cff908fb52773cf18dd95d154f892b8de/src/targets/homebrew.ts
- https://github.com/mannyc2/ts-release/blob/af59436cff908fb52773cf18dd95d154f892b8de/src/targets/scoop.ts

### Arbitrary provider: Amazon S3 PutObject

S3 is the first arbitrary provider because its laws differ materially from package registries and Git catalogs.

- **Provider-specified:** the coordinate is endpoint/region, bucket, and key; versioned buckets add a version ID.
- **Provider-specified:** successful PUT stores the whole object atomically and can return ETag, checksum, and version ID depending on request/configuration.
- **Provider-specified:** `If-None-Match: *` supports create-only behavior; `If-Match` supports conditional replacement.
- **Provider-specified:** S3 provides strong read-after-write consistency for PUT/DELETE and subsequent reads.
- **Inferred:** an ordinary external package can expose an S3 client service/Layer and provider-local Effects without a core allowlist or registry. Dynamic loading by an already-built standalone executable is a separate distribution question.

Primary sources:

- https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
- https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel

## Vocabulary checkpoint

The evidence currently favors the smallest provider-local vocabulary:

- `publish`, `upload`, or `push` returns the provider's documented success receipt;
- provider-specific failures distinguish proven pre-dispatch rejection, conflict, and genuinely unknown completion;
- an internal or explicit provider-local reconciliation operation is used after response loss;
- public delivery and consumer acceptance are named only when the product promises those stronger outcomes.

This is not yet a root API decision.

## Remaining work

- Build full provider fact tables with exact status codes and response fields.
- Exercise scratch endpoints and inject response loss after dispatch.
- Measure visibility delays instead of preserving assumed retry budgets.
- Establish native npm partial success around package upload and dist-tag updates.
- Test duplicate identical PyPI files on PyPI and another compatible registry.
- Separate GitHub release mutability from immutable-release policy imposed by ts-release.
- Exercise Homebrew and Scoop through clean consumer installs.