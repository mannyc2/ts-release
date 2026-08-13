# ts-release specification

## 1. Public operations

The root package exports `inspect`, `prepare`, `observe`, `publish`, `release`,
and `correct`, plus `makeReleaseApi`, durable-reference codecs, configuration helpers, and
tagged input/runtime errors. The total observation and release report schemas,
transient credential acquisition errors, and their secret-free durable causes
are also public. The constructed API adds `dispose` for its host runtime. CLI
and Action boundaries call these same operations.

## 2. Authored and verified forms

Authored configuration is decoded strictly. Resolution combines it with
observed package and Git facts; disagreement is an error. Verified context
records the clean source commit/tree and package-manifest digest. Preparation
materializes that exact commit into a fresh private staging root. Changed,
ignored, or untracked workspace bytes are never implicit inputs.

## 3. Derived graph

The graph contains imported artifacts, build, archive, checksum, command check,
command artifact, typed Homebrew/Scoop rendering, npm publication, exact-file
PyPI publication, GitHub Release publication, and catalog Git publication
primitives. It is
sorted and linked inside one process. It is never serialized as authority and
never crosses a runner boundary.

## 4. Prepared release

`prepared-release/v2` is canonical JSON plus content-addressed blobs. A
`CompletePreparedReleaseRef` is the only public cross-process locator and
contains content identity, never a local path. The complete manifest records
materialized source identity, project coordinates, artifact IDs, exact
sizes/digests/media types, input basis, execution provenance, and provider
subjects. A prepared store refuses missing, altered, extra, symlinked,
non-canonical, or producer-mismatched content.

An npm trusted-publishing subject also binds the exact verified source commit
and a versioned GitHub/npm provenance-environment contract. The host validates
all npm-consumed GitHub run facts before reading OIDC authority, snapshots them
privately onto the issued workload grant, and projects only that snapshot plus
the two OIDC request values into the closed npm child.

A PyPI publication records one independent subject per prebuilt wheel or gzip
sdist. Preparation parses archive structure and embedded metadata and requires
project/version/filename agreement before the file can enter a prepared
manifest. Each subject binds the closed PyPI/TestPyPI Simple and upload
endpoints, exact filename, size, SHA-256, media type, and distribution tags.

## 5. Observation

Publication is subject-based. `observe` uses a read-only report algebra.
`publish` observes every subject before mutation and again afterward.
Equivalent subjects are idempotent skips; only a typed provider decision may
authorize mutation; conflict or inconclusive state blocks. Provider correction
intent is typed and bound to the prepared digest. npm and GitHub Release
requests produce external proposals; catalog Git admits one SemVer-forward
conditional replacement of its exact target/state pair. Credential unavailability
and unsupported authentication remain total report data with distinct tagged,
secret-free causes; they do not escape as publication control flow.

PyPI observation accepts only a standards-shaped JSON Simple response with
API major 1 and the API 1.1 equality fields. A visible project page that omits
the exact filename can authorize token upload only after the host atomically
creates a shared, durable, terminal claim for the prepared subject. Claim
unavailability or occupation blocks before credential acquisition. A project
404 never authorizes first creation. Yanked files conflict; no yank mutation
is installed. Trusted publishing is an external PyPA Action path and is
rejected by the stock coordinator before dispatch.

Catalog observation reads the exact branch ref, commit, complete untruncated
recursive tree, and both managed blobs. Mutation creates exact blobs and a tree
with the observed root as `base_tree`, verifies every unrelated object and mode
in the proposed full tree, creates a commit with the observed commit as its
sole parent, and updates the ref with `force: false`. A catalog subject depends
on convergence of its configured GitHub release asset subjects.

## 6. Native preparation

`CommandCheck` runs trusted argv code against declared inputs. `CommandArtifact`
generates or transforms declared regular-file outputs. `builder: "command"`
lowers to the same primitive. Generic preparation children inherit no host
environment. A nonempty authored environment request is rejected unless a
future dedicated capability certifies its safe build-time contract. There is
no generic hook or remote-publisher escape hatch. The public API recognizes
reserved partition and merge preparation modes and rejects them with
`PreparationModeUnsupported`; it creates no partial durable object.

## 7. Hosts

The capability registry owns separate execution-host, artifact-target, and
native-tool-host axes. Linux is the only installed execution host. The exact
advertised artifact targets are Linux x64/arm64 and macOS x64/arm64; macOS
binaries are cross-compiled artifacts, not execution-host evidence. Windows is
neither an execution host nor an advertised artifact target, and the
self-release does not distribute a Windows ts-release binary. WSL is Linux for
this contract.

The checked-in Action is a Linux workflow boundary: its composite step
requires Bash and a workflow-installed, pinned Bun runtime. The distributed
package and CLI run under the declared Node engine, but preparation and
network-denied command execution delegate to an external Bun executable whose
Linux child loads `libseccomp.so.2`. The standalone CLI is therefore not a
self-contained preparation sandbox. These declared axes still require the
clean-candidate public-entrypoint smoke matrix before release certification.

## 8. Error and safety contract

Structured Effect errors cross the library boundary. A pre-commit preparation
failure proves no remote mutation; a post-commit abort carries the exact
durable reference. Filesystem paths are contained and symlink-checked. Public
inputs contain no credential values. Secrets are acquired through host layers,
consumed only by audience- and purpose-checking sinks, and redacted at process
output boundaries. Host credential error text never enters durable reports;
only request-derived, secret-free cause data does. The Action validates its
inputs before calling the library.

## 9. Recovery limits

Rerun the same prepared bytes. A partial release is possible; atomic rollback,
deletion, exactly-once publication, and universal correction are not claimed.
PyPI filenames remain consumed after deletion and uncertain token uploads are
never blindly replayed; the required terminal claim survives process loss and
must be shared by every runner capable of dispatching that subject.
Read-convergence timing defaults are conservative assumed bounds until live
post-write evidence measures them. Announcements and unsupported providers
remain outside the retained product.

## 10. Product evidence

In the source distribution, the generated capability inventory is joined
one-to-one from executable module values and dated evidence. Evidence records
contain sanitized references only and cannot configure runtime support. A
source checkout, configuration field, detached test, or protocol double is not
release certification.

## 11. Distribution

The canonical package identity is `@mannyc1/ts-release`. The canonical Action
is the monorepo subpath `mannyc2/ts-release/apps/ts-release-action`. Public
consumer documents bind an immutable version only when its tag targets the
exact certified result commit before the package README becomes visible.
Installed Node package consumers require
`^22.22.2 || ^24.15.0 || >=26.0.0`. The checked-in Action declares a composite
runtime and runs `dist/index.js` with the pinned Bun installed earlier in each
advertised Linux workflow. Its entrypoint evidence is separate from installed
package evidence and does not alter the package's Node engine. The packaged
Node CLI still requires external Bun and, for network-denied commands on its
Linux execution host, `libseccomp.so.2`.

## 12. Non-goals

The engine does not transport host-gate identity or persist execution history as authority,
provide generic lifecycle hooks, or claim to be a language-specific clone of
another release product. Arbitrary catalog templates, engine-owned downstream
announcements, dynamic adapter discovery, and command publishers are not
capabilities installed in the stock kernel.

## 13. Root export audit

The root runtime exports are exactly:

- `AuthoredGithubReleaseAmendment`
- `AuthoredCatalogForwardCorrection`
- `AuthoredNpmDeprecation`
- `CompletePreparedReleaseRef`
- `CorrectionReport`
- `CredentialFailureCause`
- `CredentialStrategyUnsupported`
- `CredentialStrategyUnsupportedCause`
- `CredentialUnavailable`
- `CredentialUnavailableCause`
- `GitHubActionsCompletePreparedReleaseRef`
- `LocalCompletePreparedReleaseRef`
- `ObservationReport`
- `PreparationModeUnsupported`
- `PreparedReleaseRefCodecError`
- `PreparedReleaseRefMalformedError`
- `PreparedReleaseRefUnknownSchemeError`
- `ReleaseAbortedError`
- `ReleaseIncompleteError`
- `ReleasePreparationError`
- `ReleaseReport`
- `correct`
- `decodeAuthoredCorrection`
- `decodeCompletePreparedReleaseRef`
- `defineRelease`
- `encodeCompletePreparedReleaseRef`
- `encodeResolvedConfig`
- `inspect`
- `makeGitHubActionsCompletePreparedReleaseRef`
- `makeLocalCompletePreparedReleaseRef`
- `makeReleaseApi`
- `observe`
- `prepare`
- `publish`
- `release`
- `ReleaseInputError`
- `ReleaseRuntime`
- `resolveConfig`
- `unsupportedExecutionHost`

## 14. License

MIT.
