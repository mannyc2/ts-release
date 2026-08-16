# Provider contracts

Status: recovered research checkpoint. This is a provider-fact and experiment
plan, not a selected root publication API. No live mutation was run for this
checkpoint.

Research pins:

- current ts-release source: `1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`;
- released ts-release v0.0.7 source:
  `af59436cff908fb52773cf18dd95d154f892b8de`; and
- GoReleaser source/docs index pin is recorded in `goreleaser-outcomes.md`.

## Claim labels

- **Provider-specified:** directly stated by provider documentation or protocol.
- **Source-observed:** visible in pinned provider or client source.
- **ts-release-observed:** visible in a pinned ts-release generation.
- **Inferred:** a conclusion from the cited provider facts.
- **Proposed experiment:** a disposable scratch test whose result is not yet
  available.
- **Design proposal:** a possible ts-release expression, not a provider fact.

A normal documented success response is success. Reconciliation is reserved for
an unavailable response or another provider-specific ambiguous state. This
research does not add a universal `verify`, `verifyInstall`, `ensurePublished`,
or automatic re-download after successful publication.

## Outcome separation

Every provider is evaluated against four distinct outcomes:

```text
provider accepted publication
public metadata observed
intended byte identity observed
clean consumer installation or execution succeeded
```

A provider receipt may establish one or more of the first three. It does not
silently establish the fourth.

## npm-compatible registry

Primary sources:

- https://docs.npmjs.com/cli/publish/
- https://docs.npmjs.com/cli/v11/commands/npm-publish
- https://docs.npmjs.com/cli/v11/commands/npm-dist-tag
- https://docs.npmjs.com/policies/unpublish/
- https://github.com/npm/libnpmpublish/blob/e45d51c357705bfd596cbef661b95bd59c7e629e/publish.js

### npm package-version coordinate

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | **Provider-specified:** registry destination + package name + exact version. The package-version coordinate is separate from mutable dist-tags. |
| Exact normal success | **Provider-specified/inferred:** `npm publish` completes successfully only when the publisher reports success for the registry publication operation. "A process exited" is not enough; the process must exit successfully after the publisher accepted the operation. A successful publisher exit is the normal success evidence returned by the client, not an automatic unknown outcome. |
| Proven pre-dispatch failure | Local manifest/pack/tarball validation failure; credential/config failure before the request is sent; or a transport failure for which the client can prove no request bytes were dispatched. An arbitrary nonzero exit does not by itself prove this state. |
| Possible dispatch / response loss | The request may have reached the registry, but the process dies, is interrupted, or loses the response before successful completion can be recorded. This is the narrower `ReconcileRequired` case. |
| Durable receipt | Successful client completion plus registry response metadata available to the client. The submitted package metadata includes `dist.shasum` (SHA-1) and `dist.integrity` (SHA-512 SRI) for the tarball. Persist package name, version, registry identity, returned request/response identifiers when exposed, and intended tarball digest/size. Do not persist auth tokens. |
| Immutability / overwrite law | **Provider-specified:** a published package name/version cannot be reused. Unpublish does not make the coordinate reusable. Deprecation and dist-tags are separate mutable coordinates. |
| Partial-success unit | One package version. A workspace/multi-package release can contain independently accepted and failed package versions. A package upload and a later nondefault dist-tag change may also be separate effects. |
| Duplicate / conflict | Republishing an existing name/version fails. Existing is not equivalent to idempotent success; compare authoritative metadata with the intended tarball before classifying an ambiguous rerun as equivalent or conflict. |
| Visibility / consistency | Registry acceptance, packument/version metadata visibility, tarball delivery/CDN availability, resolver selection, and install/import/bin execution are distinct. No timing guarantee is asserted here beyond provider documentation. |
| Authoritative reconciliation observations | Read exact version metadata from the intended registry; compare package name/version and `dist.integrity`/`dist.shasum` with the intended packed tarball. Inspect the intended dist-tag separately. |
| Irreducibly unknown | A registry-compatible endpoint that accepted a write but exposes no trustworthy matching version/tarball identity; incomplete/malformed metadata; or an unavailable authoritative read surface after response loss. Human decision may remain necessary. |
| Consumer-installability guarantee | None from publication acceptance alone. A clean `npm install`/`npm pack`, import, bin invocation, or application-specific smoke test is a separately named acceptance operation. |

### npm dist-tag coordinate

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | Registry + package name + dist-tag name. Its value is an exact package version. |
| Exact normal success | Successful completion of the documented dist-tag mutation. |
| Proven pre-dispatch failure | Local/tag validation or client-proved no-dispatch failure. |
| Possible dispatch / response loss | The tag update may have committed before the response disappeared. |
| Durable receipt | Package, tag, intended version, registry, and provider/client response identifiers when exposed. |
| Immutability / overwrite law | Mutable pointer. Later writes may move the same tag to another version. |
| Partial-success unit | One tag update, separate from immutable package-version acceptance. |
| Duplicate / conflict | Setting a tag to its current intended version is observationally equivalent; setting it to a different version is a conflict for the intended release state. |
| Visibility / consistency | `npm view <pkg> dist-tags` or equivalent authoritative packument metadata. Install resolution through the tag is a later consumer outcome. |
| Authoritative reconciliation observations | Read the tag mapping from the target registry and compare exact version. |
| Irreducibly unknown | Authoritative tag metadata cannot be read or cannot be attributed to the intended registry/account. |
| Consumer-installability guarantee | None. A tag resolving to a version does not prove the tarball installs or executes. |

### ts-release observation and experiment

- **Released-code-observed:** v0.0.7 invoked `npm publish` and later checked
  version visibility, but did not compare published tarball identity.
- **ts-release-observed:** current main computes SHA-512 integrity and SHA-1
  shasum and can compare exact registry metadata. It converts a completed
  publisher attempt to `OutcomeUnknown`, which is an architecture policy rather
  than an npm protocol requirement.
- **Proposed experiment:** publish a unique scratch package/version to a local
  Verdaccio instance and, separately, an explicitly approved disposable npm
  test destination. Capture publisher exit, HTTP result, packument fields, and
  clean install. Inject response loss only through a proxy under our control.
  Evidence produced: exact distinction among pre-dispatch failure, accepted
  success, response-loss/equivalent, response-loss/conflict, and visibility
  timing. Do not use a production package coordinate.

## PyPI-compatible registry

Primary sources:

- https://docs.pypi.org/api/upload/
- https://packaging.python.org/en/latest/specifications/simple-repository-api/
- https://docs.pypi.org/api/index-api/
- https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py

### Individual distribution-file coordinate

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | Repository base URL + normalized project + version metadata + exact distribution filename. The upload request and duplicate law are per file. |
| Exact normal success | **Provider-specified:** successful legacy upload returns HTTP 200 for that distribution. That response establishes acceptance of that file request; it is not merely "started." |
| Proven pre-dispatch failure | Local archive/metadata validation, `twine check`, credential/config failure, or client-proved no-dispatch failure. A duplicate/conflict response is a provider result, not automatically pre-dispatch. |
| Possible dispatch / response loss | Multipart request may have been accepted before HTTP 200 was lost or the process died. |
| Durable receipt | Persist repository identity, normalized project/version, filename, intended hash(es), size, upload response status/headers and request identifiers when exposed. The legacy success body is not a rich object receipt. |
| Immutability / overwrite law | **Provider-specified/source-observed for Warehouse:** an existing distribution filename is not replaced with different bytes. Yank state and some project metadata are separately mutable. |
| Partial-success unit | One distribution file. A project version with an sdist and several wheels can be partially published file by file. Preserve each accepted receipt independently. |
| Duplicate / conflict | Warehouse distinguishes exact duplicate content from a filename conflict internally; public/client behavior and other PyPI-compatible registries may differ. Provider-local code must not assume one universal duplicate response. |
| Visibility / consistency | Upload acceptance, Simple API project visibility, exact file listing, file delivery, resolver selection, wheel compatibility, install, import, and console script execution are distinct. |
| Authoritative reconciliation observations | Read the target repository's Simple API or documented file index; locate the exact filename; compare the strongest exposed hash and size. Preserve per-file observations. |
| Irreducibly unknown | The compatible registry does not expose the filename or a trustworthy content identity; a first project/version is not yet visible and the response was lost; or index/file surfaces disagree without a documented authority. |
| Consumer-installability guarantee | None. `pip download`, clean `pip install`, import, and console-script execution are separate acceptance outcomes and may vary by Python/platform. |

### ts-release observation and experiment

- **Released-code-observed:** v0.0.7 accepted an arbitrary repository URL,
  checked all distributions, and uploaded plural files through one `twine`
  command. The provider's true commit unit was still each distribution file.
- **ts-release-observed:** current main models one subject per distribution and
  compares Simple API filename, size, SHA-256, and yanked state, but requires a
  narrow JSON API/equality surface and treats any 2xx as only `Started`.
- **Proposed experiment:** use a disposable local Warehouse-compatible server
  and TestPyPI only after explicit approval. Upload unique sdist/wheel files one
  at a time, inject a response loss for exactly one file, and query both HTML
  and JSON Simple API variants. Evidence produced: per-file partial success,
  duplicate-identical/conflict behavior, first-version behavior, and which
  hashes/sizes are authoritative. Do not mutate a production project.

## GitHub Releases

Primary sources:

- https://docs.github.com/en/rest/releases/releases#create-a-release
- https://docs.github.com/en/rest/releases/assets#upload-a-release-asset
- https://docs.github.com/en/rest/releases/assets#list-release-assets
- https://docs.github.com/en/rest/releases/assets#get-a-release-asset

GitHub release objects and assets have different commit boundaries and receipts.

### Release-object coordinate

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | GitHub host/API + repository + release ID; tag name is an alternate lookup coordinate with its own uniqueness/race implications. |
| Exact normal success | **Provider-specified:** create release returns HTTP 201 and a release resource. Update/publish operations return their documented successful response. |
| Proven pre-dispatch failure | Local validation or client-proved no-dispatch; documented validation/auth rejection establishes that the attempted new release was not created only when the endpoint contract makes that clear. |
| Possible dispatch / response loss | Release may have been created or updated before the response was lost. |
| Durable receipt | Release numeric ID, tag name, target commitish, draft/prerelease state, HTML/API URL, timestamps, and request identifiers when exposed. |
| Immutability / overwrite law | Ordinary release metadata and draft/prerelease state are mutable. Tag/Git object laws are separate. GitHub's immutable release feature is not assumed by this matrix. |
| Partial-success unit | Release creation/update is separate from every asset upload and from draft-to-public transition. |
| Duplicate / conflict | Existing release/tag may be equivalent or conflicting depending on target, state, and metadata. It requires observation, not blanket success. |
| Visibility / consistency | API receipt, release-by-tag lookup, release page visibility, and public listing are separate observations. |
| Authoritative reconciliation observations | Get release by numeric ID when receipt exists, otherwise by tag; compare tag, target, draft/prerelease, and fields relevant to the intended operation. |
| Irreducibly unknown | Lost response and no unique tag/ID that can distinguish this request from another concurrent actor; deleted/recreated release; or permission prevents authoritative lookup. |
| Consumer-installability guarantee | None. A release object without correct assets is not consumable. |

### Individual release-asset coordinate

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | GitHub host/API + repository + release ID + asset name. Successful response also assigns numeric asset ID. |
| Exact normal success | **Provider-specified:** upload returns HTTP 201 and an asset resource whose state is `uploaded`; the resource includes name, content type, size, digest (currently SHA-256 in the documented response), API URL, and browser download URL. |
| Proven pre-dispatch failure | Local content/name validation or client-proved no-dispatch. A same-name 422 means the attempted new asset was not created, although an older asset exists. |
| Possible dispatch / response loss | Request may have produced an uploaded or starter asset before the response disappeared. This differs from the documented 502 case. |
| Documented 502 starter case | **Provider-specified:** a 502 is a known failed upload response that may leave an empty asset in `starter` state. It is not the unknown-response case. The provider state should be listed and handled explicitly. |
| Durable receipt | Asset ID, release ID, name, state, content type, size, digest, API/download URLs, timestamps, and request ID when exposed. |
| Immutability / overwrite law | Asset metadata can be edited and assets deleted. Uploading the same name conflicts; bytes are not overwritten in place through upload. Do not infer immutable-release semantics. |
| Partial-success unit | One asset. A multi-asset release can contain accepted, failed, starter, and unattempted assets simultaneously. |
| Duplicate / conflict | Same-name upload returns conflict/validation behavior. An existing uploaded asset with matching size/digest can reconcile as equivalent; mismatched bytes are a conflict; starter is a provider-specific recoverable state. |
| Visibility / consistency | 201 asset receipt, list/get API visibility, browser URL availability, delivered byte identity, and application execution are separate. Receipt digest can establish provider-recorded identity without automatic re-download after every successful upload. |
| Authoritative reconciliation observations | Get/list assets on the exact release; compare name, numeric ID when known, state, content type, size, and digest. Delete/retry policy for starter/conflicting assets remains provider-local. |
| Irreducibly unknown | Response lost and concurrent actors created/deleted/replaced same-name assets such that no receipt ID or digest can attribute the observed asset; API unavailable or digest absent/inconsistent. |
| Consumer-installability guarantee | None. Public download or execution is a separate acceptance test. |

### ts-release observation and experiment

- **Released-code-observed:** v0.0.7 created a release with plural assets and
  later compared release metadata and asset names, not size/digest.
- **ts-release-observed:** current main preserves release/asset granularity and
  compares state, size, media type, and digest. Mandatory post-success
  observation remains architecture policy, not a requirement of 201.
- **Proposed experiment:** in a scratch repository, create a unique draft
  release and upload generated small assets. A proxy can drop a successful
  response; a separate deliberately invalid upload can exercise documented
  failure. Evidence produced: 201 receipt fields, starter cleanup behavior,
  response-loss reconciliation, and public-download timing. Propose the exact
  scratch repository and cleanup plan before running it.

## Git hosting protocol for catalog publication

This table describes Git publication independently of Homebrew or Scoop file
semantics. It applies to any Git host that supports the required object/ref
operations; GitHub Git-data APIs are one implementation, not the contract.

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | Git remote/host identity + repository + target ref + expected old ref + resulting commit/tree/blob identities. Managed file paths are content within the commit, not the ref identity itself. |
| Exact normal success | Remote accepts the conditional/non-force ref update to the intended new commit. Local object creation alone is not publication. |
| Proven pre-dispatch failure | Local render/tree/commit failure; auth/config failure before dispatch; or conditional ref rejection that proves this attempted update did not move the ref. |
| Possible dispatch / response loss | Remote may have accepted the ref update before client response loss. |
| Durable receipt | Remote identity, ref, expected old SHA, new commit SHA, tree SHA, relevant blob SHAs, and transport/request identifiers when exposed. |
| Immutability / overwrite law | Git blobs, trees, and commits are content-addressed immutable objects. Refs are mutable pointers. |
| Partial-success unit | One accepted ref update can atomically expose many file changes in one repository. Different refs/repositories and upstream artifact publication are separate units. |
| Duplicate / conflict | If ref already equals intended commit, it is equivalent. If ref moved to another commit, classify against expected parent and managed bytes; never force-overwrite by default. |
| Visibility / consistency | Server ref acceptance, fetch/clone visibility, hosting UI, raw file delivery, and consumer package-manager refresh are distinct. |
| Authoritative reconciliation observations | Read target ref, commit, tree, and exact managed blobs; compare new commit and/or canonical managed bytes with intended state and expected base. |
| Irreducibly unknown | Host does not expose an authoritative ref/object read; force/rewrite history erased attribution; concurrent writer produced the same visible bytes through a different commit and provenance matters; or credentials cannot read after write. |
| Consumer-installability guarantee | None. Git acceptance says nothing yet about Homebrew formula validity or Scoop installation. |

## Homebrew tap contract

Primary sources:

- https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap
- https://docs.brew.sh/Taps
- https://docs.brew.sh/Formula-Cookbook

### Formula/cask consumer coordinate

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | Tap remote + ref + formula/cask path + formula/cask name/version; artifact URL/checksum and platform branches are content facts. The Git ref update is governed by the separate Git matrix. |
| Exact normal success | For publication: Git ref update success from the Git matrix. For consumer acceptance: the specifically named Homebrew command/test exits successfully in a clean supported environment. Do not collapse them. |
| Proven pre-dispatch failure | Render/schema/audit failure before Git dispatch; or a consumer test that fails before network install does not roll back a previously pushed tap. |
| Possible dispatch / response loss | Git response loss is handled by Git reconciliation. Homebrew install process loss is a test outcome, not ambiguity about the already-recorded Git commit. |
| Durable receipt | Publication receipt is commit/ref/blob identity. A consumer receipt should separately record Homebrew version, OS/architecture, tap ref/commit, formula/cask path, resolved artifact URL/checksum, command, exit, and logs. |
| Immutability / overwrite law | Git objects immutable, ref/path mutable. Formula versions and artifact URLs/checksums are policy/content, not a universal immutable coordinate. |
| Partial-success unit | One Git ref update per tap repository. Formula render, push, public fetch, artifact availability, checksum, install, and execution can each diverge. Multiple tap repositories are independent. |
| Duplicate / conflict | Conditional Git conflict is handled by Git matrix. Existing identical formula bytes at intended ref are equivalent for publication; existing different bytes are conflict. Homebrew's own formula/version policies remain content validation. |
| Visibility / consistency | Ref acceptance, clone/fetch, `brew update`, formula evaluation, artifact download, checksum verification, installation, and execution are separate. |
| Authoritative reconciliation observations | Publication: ref/tree/blob. Consumer: fresh tap checkout/update plus explicit formula inspection and optional install/test. Historical publication receipt must not be presented as a fresh consumer observation. |
| Irreducibly unknown | Artifact URL is mutable or unavailable and no content identity can bind it; Homebrew environment/platform differs from claimed support; tap ref was later moved; or consumer test environment is unavailable. |
| Consumer-installability guarantee | Only an explicit clean `brew install`/`brew test`/execution outcome for a recorded environment establishes this tier. Git publication never establishes it alone. |

### ts-release observation and experiment

- **Released-code-observed:** v0.0.7 accepted plural artifact IDs and used a
  generic Git target/directory; Homebrew was not inherently GitHub-specific.
- **ts-release-observed:** current main has a strong conditional GitHub Git-data
  update but couples the catalog to GitHub release subjects and a GitHub host.
- **Proposed experiment:** create a disposable local/bare Git tap remote and a
  generated formula pointing to a local immutable HTTP fixture; exercise
  conditional push, lost response, clone, `brew audit` and, on an approved macOS
  runner, clean install. Evidence produced separately for Git acceptance,
  formula validity, byte identity, and installation. No production tap.

## Scoop bucket contract

Primary sources:

- https://github.com/ScoopInstaller/Scoop/wiki/Buckets
- https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests
- https://github.com/ScoopInstaller/Scoop/wiki/App-Manifest-Autoupdate

### Manifest consumer coordinate

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | Bucket remote + ref + manifest path + app/version; architecture-specific URLs, hashes, extraction, shims, and scripts are manifest content. Git transport follows the separate Git matrix. |
| Exact normal success | Publication: accepted conditional Git ref update. Consumer: specifically named `scoop download`/`scoop install`/command smoke test succeeds in a clean supported Windows environment. |
| Proven pre-dispatch failure | Manifest render/parse/hash validation before Git dispatch; or client-proved no-dispatch. A later consumer failure does not undo Git publication. |
| Possible dispatch / response loss | Git response-loss classification is the Git matrix. A lost install process is a consumer test result and does not change publication receipt. |
| Durable receipt | Publication commit/ref/blob receipt. Consumer observation records Scoop version, Windows/architecture, bucket ref/commit, manifest bytes/path, resolved URL/hash, command, exit, logs, and installed shim/command result. |
| Immutability / overwrite law | Git objects immutable; ref and manifest path mutable. URLs may point to immutable or mutable external content, so manifest hash is essential but not proof the URL remains available. |
| Partial-success unit | One ref update per bucket repository. Push, bucket refresh, manifest discovery, download, hash, extraction, scripts, shims, and execution are distinct. |
| Duplicate / conflict | Conditional Git conflict as above. Identical manifest bytes at intended ref are equivalent publication state; different managed bytes are conflict. |
| Visibility / consistency | Ref acceptance, public fetch, `scoop update`, manifest lookup, download, hash check, install, and execution are separate. |
| Authoritative reconciliation observations | Ref/tree/blob for publication; clean bucket refresh and explicit download/install for consumer acceptance. Keep historical receipt and fresh observation separate. |
| Irreducibly unknown | Mutable/unavailable asset URL, later bucket ref movement, platform-specific script behavior, missing clean Windows environment, or insufficient artifact identity. |
| Consumer-installability guarantee | Only a recorded clean install/execute result for the intended architecture establishes this tier. |

### ts-release observation and experiment

- **Released-code-observed:** v0.0.7 rendered manifests with SHA-256 and published
  through a generic Git bucket directory.
- **ts-release-observed:** current main shares the GitHub-specific catalog
  provider with Homebrew. The conditional update is useful; GitHub coupling is
  not a Scoop law.
- **Proposed experiment:** use a disposable bare Git bucket and local immutable
  HTTP artifact on an approved Windows runner; inject conditional-ref and
  response-loss cases, then run clean `scoop download`, install, and shim
  execution. Record each outcome separately. No production bucket.

## Arbitrary custom provider: Amazon S3 PutObject

S3 is the arbitrary-provider case because it differs from package registries and
Git catalogs while still exposing useful conditional and read surfaces.

Primary sources:

- https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
- https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html

### S3 object coordinate

| Contract field | Evidence-granular result |
| --- | --- |
| Coordinate | Bucket + key. When versioning is enabled, a successful write's version ID identifies the exact stored version. Endpoint and region are routing/configuration, not the basic object identity. Account/tenant/principal are authorization identity and may need durable non-secret recording. |
| Exact normal success | **Provider-specified:** successful `PutObject` stores the whole object; S3 never exposes a partially added object. Response can include version ID and checksum fields depending on request/bucket. |
| Proven pre-dispatch failure | Local/client-proved no-dispatch; or a documented conditional precondition failure such as `If-None-Match: *` that establishes this attempted create did not replace/create the object. |
| Possible dispatch / response loss | PUT may have committed before transport/process response loss. |
| Durable receipt | Bucket, key, version ID when enabled, requested checksum algorithm/value, returned checksum fields, size/content metadata, account/principal identity, request ID, and ETag as an opaque provider field. Persist no secret credentials. |
| Immutability / overwrite law | Unversioned same-key PUT replaces current content. Versioned PUT creates a new version while the current pointer changes. Object Lock is a separate optional law and is not assumed. |
| Partial-success unit | One object key/version. A logical release containing many keys can be partial. |
| Duplicate / conflict | `If-None-Match: *` supports create-only behavior; `If-Match` supports conditional replacement where applicable. Existing same bytes may be equivalent after checksum/GET comparison; different bytes are conflict. |
| Visibility / consistency | S3 documents strong read-after-write consistency for PUT/DELETE. Authorization, replication, CDN/front-door delivery, and application consumption may add separate surfaces. |
| Authoritative reconciliation observations | `HeadObject`/`GetObject` on exact bucket/key and, when available, version ID; compare explicit checksum and size/metadata. GET can hash bytes when the stored checksum surface is insufficient. |
| ETag law | ETag is not a universal content digest. Multipart upload, encryption, and other modes change its meaning. Store it as opaque receipt metadata unless the exact request mode proves a stronger interpretation. |
| Irreducibly unknown | No versioning and another writer overwrote the key after the lost response; no trustworthy checksum and GET is forbidden/unavailable; or account/routing ambiguity means the observed object is not attributable to the intended destination. |
| Consumer-installability guarantee | None. S3 has no package-manager install meaning. A GET/download or application-specific load/execute test is separately named. |

### Custom-provider architecture implication and experiment

An S3 provider can live in another package with its own client service, Layer,
coordinate, receipt, conflict, and reconciliation logic. Core does not need an
`s3` string, allowlist, registry, or certification gate. The clean-consumer
probe in this PR demonstrates only consumer-owned module/Layer closure, not this
full provider contract.

**Proposed experiment:** use MinIO or LocalStack in a disposable CI service for
required tests. Exercise create-only PUT, versioned PUT, response loss, overwrite
race, HEAD/GET reconciliation, multipart/ETag non-digest behavior, and many-key
partial success. A live AWS experiment, if later needed, must be proposed with a
scratch bucket/account, cost/cleanup limits, and no production keyspace before
it is run.

## Cross-provider conclusions

1. Provider acceptance and response-loss reconciliation are different paths.
2. Multiplicity lives in coordinates and ordinary collections: package
   versions, PyPI files, GitHub assets, Git commits/files, and S3 keys have
   different independent commit units.
3. Receipts are provider-local. The fields needed for recovery must not be
   erased into a universal success token.
4. Historical receipts and fresh observations must be stored and displayed as
   different data.
5. Consumer installation/execution is a separate promise and should be run only
   when the product explicitly claims that tier.
6. No provider fact requires a universal `verify`, `verifyInstall`,
   `ensurePublished`, or automatic post-success re-download.
7. Where documentation cannot classify a failure or duplicate case, the
   smallest scratch experiment is recorded above rather than guessed.

No production destination or live provider was mutated in this checkpoint.
