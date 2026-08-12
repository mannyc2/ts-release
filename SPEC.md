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
records the clean source commit/tree and package-manifest digest.

## 3. Derived graph

The graph contains build, archive, checksum, catalog, command check, command
artifact, npm publication, and GitHub publication primitives. It is sorted and
linked inside one process. It is never serialized as authority and never
crosses a runner boundary.

## 4. Prepared release

`prepared-release/v1` is canonical JSON plus content-addressed blobs. A
`CompletePreparedReleaseRef` is the only public cross-process locator and
contains content identity, never a local path. The
manifest records source identity, project coordinates, artifact IDs, exact
sizes/digests/media types, and provider subjects. A prepared store refuses
missing, altered, extra, symlinked, or non-canonical content.

## 5. Observation

Publication is subject-based. `observe` uses a read-only report algebra.
`publish` observes every subject before mutation and again afterward.
Equivalent subjects are idempotent skips; only a typed provider decision may
authorize mutation; conflict or inconclusive state blocks. Provider correction
is typed, forward, and bound to the prepared digest. Credential unavailability
and unsupported authentication remain total report data with distinct tagged,
secret-free causes; they do not escape as publication control flow.

## 6. Native preparation

`CommandCheck` runs trusted argv code against declared inputs. `CommandArtifact`
generates or transforms declared regular-file outputs. `builder: "command"`
lowers to the same primitive. Generic preparation children inherit no host
environment. A nonempty authored environment request is rejected unless a
future dedicated capability certifies its safe build-time contract. There is
no generic hook or remote-publisher escape hatch.

## 7. Hosts

The supported execution hosts are Linux and macOS. Bun cross-build targets may
include Windows artifacts. Native Windows execution is not supported by this
candidate. The capability registry owns the machine-checked host/target table.

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
Announcements and unsupported providers remain outside the retained product.

## 10. Product evidence

[`docs/capabilities.md`](docs/capabilities.md) is generated from the executable
registry joined one-to-one with [`docs/capability-evidence.json`](docs/capability-evidence.json).
The evidence file records dated observations and sanitized references only; it
cannot configure runtime support.

## 11. Distribution

The canonical package identity is `@mannyc1/ts-release`. The canonical Action
is the monorepo subpath `apps/ts-release-action`; public consumer documents
bind its immutable candidate version only during candidate certification.

## 12. Non-goals

The engine does not transport host-gate identity, persist a graph ledger,
provide generic lifecycle hooks, or claim to be a language-specific clone of
another release product.

## 13. Root export audit

The root runtime exports are exactly:

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
