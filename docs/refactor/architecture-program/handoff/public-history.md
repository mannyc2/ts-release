# Published 0.3.0: historical S3 implementation and hard-cut inventory

The published `@mannyc1/ts-release@0.3.0` contains a real AWS SDK adapter and a
substantial S3 operation journal. It is useful historical implementation evidence.
Its per-operation state machine and append authority differ from the replacement
contract, so it cannot become the replacement `JournalStore` through a wrapper.
The package also explicitly withholds live AWS and workflow qualification.

The [retained archive](public-history/ts-release-0.3.0.tgz) has SHA-256
`64df9e8ed395a6e055a94a72fa7a360d9b69af985238f43ce369dbbaf72dd5e3`.
[Registry observation](public-history.json) records publication provenance;
[the independent inventory](public-history-inventory.json) records every archive
member, source unit, supported export name, declaration origin and disposition.
No published code was installed or executed in this audit. Source presence does
not establish ancestry, external consumers, existing durable payloads, successful
AWS calls, or an activated workflow. The authorized hard cut remains applicable.

## What was shipped

The archive has 522 regular files, with unique safe relative paths and no links.
It includes 98 TypeScript source units: 96 product, one test and one example;
20,587 physical source lines across those lanes. These are separate published
historical costs, **not additions to the 22,971-line baseline or deletion credit**.
Fourteen source paths are absent from the current checkout: the eleven journal
units below and three units already represented in the historical migration
inventory. Thirteen units are new to that production inventory: those eleven
journal units, the packaged agent contract test and the portable CLI example.

| Supported export | Declaration names | Runtime names | Disposition |
| --- | ---: | ---: | --- |
| `.` | 55 | 39 | Retire old release/config/correction API; follow explicit per-symbol migration owners. |
| `./node` | 2 | 2 | Replace old host layer constructors. |
| `./bun` | 2 | 2 | Replace old host layer constructors. |
| `./store` | 16 | 11 | Retire old prepared-release/store formats and API. |
| `./host` | 42 | 20 | Replace old host/credential/claim composition contract. |
| `./provider-sdk` | 29 | 22 | Replace old adapter/coordinator/recovery contract. |
| `./operation-journal` | 38 | 16 | Retire old journal owner and five-record lifecycle. |
| `./operation-journal/aws` | 2 | 1 | Translate relevant native-boundary obligations into an optional replacement host adapter. |

There are 186 exported declaration names and 113 runtime names counted across
surfaces, or 182 and 111 distinct names respectively. All eight declaration and
runtime targets and the `ts-release` bin target exist. TypeScript compiler export
and alias traversal resolved every declared name; independent parsing of the
shipped JavaScript found each runtime name. Own syntactic members are retained;
this is not a fresh build, semantic ABI comparison, or enumeration of inherited
Effect members. All old exports receive explicit no-alias dispositions in the
inventory, including the previously omitted journal API.

The manifest pins Effect peers to `4.0.0-beta.83`, AWS IAM/S3/STS clients to
`3.1123.0`, and platform-node-shared to beta.83. Its engines require Bun 1.3.14 or
the stated supported Node ranges. These are historical package coordinates;
they do not supersede the replacement's centrally selected coordinates.

## Implemented journal contract

All references below are **archive entry names and one-based source lines**.
For example, `src/operation-journal/model.ts:37` means
`package/src/operation-journal/model.ts` inside the retained archive, not a file
assumed to exist in the current branch. The inventory binds each entry's bytes.

| Property | Published implementation | Replacement consequence |
| --- | --- | --- |
| Scope | `{releasePoint, operationKey}`, one namespace per operation (`model.ts:22`, `canonical.ts:197`). | Preserve one explicit release-global `journalId` and global revision; no peer per-operation owner. |
| Append | `append({releasePoint, operationKey, tag, codecId, payload})` returns an acknowledgement (`model.ts:37`, `model.ts:76`). | No caller `expectedRevision`, caller event ID, or `Appended`/`AlreadyRecorded` distinction exists here; implement the selected CAS protocol directly. |
| Identity | Internally generated transaction UUID; sequence assigned after loading/reconciling (`s3.ts:862`). | Old acknowledgement cannot be treated as a fresh dispatch permit. |
| Lifecycle | Intent → Receipt or OutcomeUnknown; Receipt → Observation or Terminal; repeated Observation → Observation or Terminal. Terminal and OutcomeUnknown have no successors (`reducer.ts:13`). | Retire this reducer. Selected six event families support linked dispatch, native facts, late observations, supersession and risk authorization. |
| Recovery | Exact-version reread, one bounded conditional head retry, possible rebase; explicit reconciliation can finish a killed writer's orphan (`s3.ts:574`, `s3.ts:633`, `s3.ts:661`, `s3.ts:776`). | Borrow uncertainty and exact-read obligations; do not rebase a caller's `DispatchStarted` or manufacture dispatch authority from recovered acknowledgement. |
| Capacity | Identity 65,536 bytes; opaque payload 1,048,576; stored object 1,500,000 (`model.ts:13`). Namespace listing capped at 512 versions (`s3.ts:838`). | Historical 1 MiB **payload** is not proposed 1 MiB **full JournalEvent** authority. The product profile remains explicit. |

The old storage retries are bounded conditional journal operations; this audit
does not label them blind provider resends. They implement a different API.
For example, a lost acknowledgement can be recovered by exact transaction and
version readback, or an admissible transaction can move to a later sequence.
The new core requires the caller's exact revision to determine whether that
invocation obtained fresh dispatch authority. A wrapper cannot recover that
missing distinction from the returned old acknowledgement.

The retained formats are `operation-journal/v1/`,
`ts-release-operation-journal-event/v1` and
`ts-release-operation-journal-head/v1` (`canonical.ts:149`, `canonical.ts:158`,
`canonical.ts:197`). Events use `events/<8-digit sequence>/<UUID>.bin`; heads use
`head.bin`. Payload codecs remain consumer-owned opaque byte codecs. All these
formats are hard-cut historical evidence. No automatic import, dual reader,
compatibility alias, or migration of unknown real payloads is implied.

## Native S3 and authority obligations worth retaining

`src/operation-journal/s3.ts:240` reloads and validates the namespace before
returning a snapshot. It rejects truncated listings, delete markers, duplicate
versions, unexpected keys, inconsistent latest versions, extra head branches,
and invalid orphan relationships. It follows exact predecessor head versions
and ETags, binds each head to an event version/checksum/digest, checks sequence,
transaction uniqueness, workflow correspondence and the finite reducer. Each
listed retained version is read and checked. With one event version and one
head version per accepted record, the 512-version cap permits at most 256
accepted records without orphans; this is a derivation from the implementation,
not a documented replacement capacity.

The AWS implementation is operational source rather than a fake port:

- `src/operation-journal/aws.ts:21` validates sealed options, acquires one OIDC/STS
  session, and constructs IAM/S3/STS clients with explicit credentials and
  `maxAttempts: 1`. S3 region redirects are disabled. The public options offer no
  credential, endpoint, profile or fallback override.
- `aws/oidc.ts:288` restricts the Actions OIDC request URL, audience, response,
  redirect behavior and bounds. `aws/oidc.ts:346` rejects ambient AWS credentials,
  verifies exact admitted claims, calls STS `AssumeRoleWithWebIdentity`, checks
  temporary credential expiry and confirms the resulting caller identity. STS
  authenticates the web identity token; parsing claims alone is not the trust
  boundary. No token values were printed or retained by this audit.
- `aws/s3-boundary.ts:213` observes role identity, inline/attached policy shape,
  caller identity, bucket versioning, ten-year COMPLIANCE retention, ownership,
  public-access blocking and exact policy digests. `aws/policy.ts:454` validates
  policies against generated exact expected structures before hashing them.
- `aws/s3-boundary.ts:416` pins `GetObject` to `VersionId` and expected bucket
  owner; it independently checks retention and object attributes, including
  FULL_OBJECT checksum and size. `aws/s3-boundary.ts:149` bounds content length,
  allocation and streaming with abort cleanup. Network/stream deadlines are
  10,000 ms (`aws/deadline.ts:1`).
- `aws/s3-boundary.ts:499` sends a conditional `PutObject`, exact checksum,
  content length and expected owner, then validates returned metadata. Its
  native 409 and 412 responses share `PreconditionFailed` (`:536`); the new
  protocol's explicit 409/unknown treatment must not be lost during translation.

These checks are narrower than a generic S3 store: one sealed GitHub-hosted
workflow activation, exact session/authority, a fixed namespace, exact policies
and ten-year retention. Their policy constraints and source cost must be
reviewed for the chosen optional host profile rather than silently removed or
made universal to SQLite/Git/library hosts.

## Qualification and source-cost consequences

The package README, lines 431–442, describes the reusable workflow as inert and
states that activation needs provisioned infrastructure, reviewed caller/callee
transport and exact retained-object qualification. Lines 436–437 explicitly
exclude serialized requests, structural boundaries and fake tests from live AWS
or workflow qualification. The archive is not independent evidence that the
referenced workflow was deployed, nor does this audit rerun its historical tests.

The journal source is **3,476 physical lines in eleven units**:

| Lane | Archive source units | Lines | Disposition |
| --- | --- | ---: | --- |
| AWS host/auth/governance | `authority.ts` 162, `aws.ts` 60, `aws/deadline.ts` 41, `aws/oidc.ts` 439, `aws/policy.ts` 491, `aws/s3-boundary.ts` 562 | 1,755 | Concrete donor responsibilities for an optional host. |
| Old journal semantics and codec | root `operation-journal.ts` 51, `model.ts` 301, `canonical.ts` 373, `reducer.ts` 112, `s3.ts` 884 | 1,721 | Retire the old owner/API; retain relevant test obligations. |

The new 145-line S3 algorithm model proves a bounded local protocol only. It
does not include those 1,755 lines of credential, governance and native-response
responsibility. Any translated maintained implementation, tests and metadata
must appear in the replacement numerator. Neither copying all donor lines nor
assuming their cost disappears is justified. The central [forecast](forecast.json)
owns the full estimate; the source ceiling remains **11,485**.

This discovery corrects the historical inventory and host-cost evidence. It does
not change the recommended global journal algorithm, add a mandatory S3 default,
or reverse the immutable upstream npm-only amendment. Upstream Apple/AWS release
qualification remains explicitly deferred and not passed. All 69 selected
ts-release outcomes and the eventual chosen host's deployment obligations remain
intact. Local algorithm proof and published source are available now; native AWS
and hosted workflow acceptance require the actual selected deployment.

## Reproduce archive verification

Run from the repository root; these commands read the retained archive only:

```sh
python3 tools/architecture-lab/public-history-inventory.py --check
sha256sum docs/refactor/architecture-program/handoff/public-history/ts-release-0.3.0.tgz
tar -tzf docs/refactor/architecture-program/handoff/public-history/ts-release-0.3.0.tgz
tar -xOf docs/refactor/architecture-program/handoff/public-history/ts-release-0.3.0.tgz package/src/operation-journal/model.ts
tar -xOf docs/refactor/architecture-program/handoff/public-history/ts-release-0.3.0.tgz package/README.md
```

The retained Python generator and TypeScript syntax helper reproduce the entire
inventory from the archive without network access or package execution.
The inventory supplies SHA-256, byte size and mode for all 522 members and exact
hashes for every source unit and public declaration origin. It also records the
compiler inventory method and its limits. No historical package is imported by
the executable replacement or by these verification commands.
