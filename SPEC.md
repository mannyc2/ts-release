# ts-release v6 specification

## 1. Scope

This document defines the current `plan`/`apply` contract. Normative words
MUST, MUST NOT, SHOULD, and MAY have their usual requirements meaning.

The core accepts values and emits or consumes canonical data. File formats,
file paths for configuration, command parsing, and CI input parsing belong to
application boundaries.

## 2. Concepts

The architecture has exactly eight durable concepts:

1. Config: strict JSON-compatible release intent supplied as a value.
2. Identity: name, semantic version, tag, commit, and snapshot marker.
3. Recipe: product-owned deterministic lowering data.
4. Op: one mechanism-tagged action with typed inputs and outputs.
5. Plan: immutable identity, ordered stage rows, and annotations.
6. Evidence: a non-authoritative projection of run state.
7. Driver: a capability implementation for an operation mechanism.
8. Invocation: canonical workspace and observed planning facts.

Scope, approvals, receipts, and ledger state are protocol structures attached
to plans and operations; they do not introduce alternate product concepts.

## 3. Configuration boundary

`plan` accepts exactly `{ config, workspace }`.

- `config` MUST be a plain, acyclic JSON-compatible value.
- Strings, sparse arrays, non-plain objects, floats, unsafe integers,
  negative zero, functions, symbols, and excess fields MUST be rejected.
- The core MUST NOT accept `configPath`, read files, or parse JSON/YAML.
- Configuration source path, whitespace, key order, encoding, and diagnostic
  label MUST NOT affect plan bytes or identity.
- `workspace` MUST be a non-empty absolute path to an existing directory.
- The API MUST realpath-normalize the workspace before effects.
- Workspace spelling and path MUST NOT enter plan bytes.

The CLI owns one read and one JSON parse. Without `--root`, a relative config
selects the current working directory and an absolute config selects its
containing directory. `--root` selects the workspace explicitly. The Action
always uses realpath-normalized `GITHUB_WORKSPACE` and requires its config
path to remain contained.

## 4. Plan document

The sole plan schema is `release-plan/v6`:

```text
schemaVersion
identity
  name, version, tag, commit, snapshot
stages
  build, process, catalog, validate, publish, announce, verify
annotations
```

Each operation has an `id`, typed inputs, typed output declarations, and one
mechanism tag. The sixteen mechanisms are `Check`, `Write`, `Pack`, `Digest`,
`Exec`, `HttpRead`, `ReviewedNoteTransform`, `HttpPublish`, `ForgeRelease`,
`PackageRegistryRelease`, `PackageStorePublish`, `SupplyChainPublish`,
`ProviderPublish`, `AnnouncementPublish`, `SmtpPublish`, and `OpaquePublish`.

The stage order is fixed:

```text
build < process < catalog < validate < publish < announce < verify
```

Plans MUST satisfy unique operation/output identity, dependency closure,
forward-only dependencies, safe relative materialization paths, declared
credentials, profile fixture binding, and operation-specific validation.

Canonical JSON uses NFC strings, Unicode code-point key order, safe integers,
no insignificant whitespace, and exactly one trailing newline. Acceptance
decodes strict JSON, validates v6, re-encodes it, and requires byte equality.
`PlanId` is a domain-separated framed SHA-256 identity of accepted bytes.

There is no v5 or permissive fallback reader.

## 5. Planning

Planning is deterministic for the same configuration value, canonical
workspace, and observed invocation facts. Recipe lowering produces operations;
drivers do not participate in planning.

Homebrew and Scoop defaults are product-owned immutable presets. Package and
provider profiles are product-owned immutable data bound to contract fixture
identities. Runtime registration or replacement of product profiles is
forbidden.

`plan` returns the decoded plan, its exact canonical bytes, and `PlanId`. The
returned value and parsed returned bytes MUST be structurally equal.

## 6. Scope and review

Execution scope is either all operation ids or an explicit subset. Scope
selection MUST validate ids and dependency closure, then store the exact
expanded operation-id list.

`reviewExecution` accepts canonical plan bytes, expected plan id, and the
requested scope. It returns the immutable scope and a domain-separated
execution review challenge.

A review challenge is not authority. A new run requires the exact challenge,
reviewer identity, fresh nonce, run identity, logical-run identity, timestamp,
and topology hash. These inputs mint an execution approval receipt bound to
that run. The same challenge cannot authorize a different run.

## 7. Apply boundary

`apply` accepts exactly canonical plan bytes, expected plan id, canonical
workspace, one new-or-resume selector, optional monotonic frontier, optional
publish confirmation, and explicit recovery requests.

`apply` MUST NOT accept configuration, call planning, accept a constructed
plan object, or execute bytes that fail canonical acceptance.

A new run requires:

```text
path, immutable scope, execution review id, reviewer, optional reason
```

A resume requires only the ledger path. Scope, topology, plan identity,
operation hashes, and the execution receipt come from that ledger and cannot
be replaced by the caller.

Before a driver is reached, apply validates plan identity, ledger schema,
scope, operation hashes, topology, receipts, materialized-output snapshots,
and stage authority.

## 8. Authority

Operation authority is derived from mechanism:

| Authority | Mechanisms |
|---|---|
| LocalRead | `Check` |
| LocalWrite | `Write`, `Pack`, `Digest` |
| LocalExec | `Exec` |
| RemoteRead | `HttpRead`, `ReviewedNoteTransform` |
| RemotePublish | `HttpPublish`, `ForgeRelease`, `PackageRegistryRelease`, `PackageStorePublish`, `SupplyChainPublish`, `ProviderPublish`, `AnnouncementPublish`, `SmtpPublish`, `OpaquePublish` |

Configuration cannot promote authority. Credentials are accessed through
read or publish capability stores and MUST NOT enter a plan, ledger, receipt,
error, or evidence projection.

Structured operations are replay-aware. `Exec` is trusted execution and is
made conspicuous during review. Remote publication requires a publish receipt.

## 9. Two-phase publication

Applying through `validate` materializes local outputs and records remote
read facts. When selected publication remains, apply returns
`publish-review-required` plus a challenge derived from the accepted plan,
run, execution receipt, topology, and observed materialized inputs.

The caller reviews those observed inputs and echoes the exact challenge with
reviewer identity. The boundary mints a fresh run-bound publish receipt.
Only then may apply advance through `publish`, `announce`, and `verify`.

Changing the plan, scope, run, execution receipt, topology, or observed input
invalidates the publish challenge.

## 10. Run ledger

The sole durable execution schema is `run-ledger/v1`. It records:

```text
run and logical-run ids
PlanId and operation hashes
immutable execution scope and topology hash
monotonic stage frontier and revision
per-operation attempts and checkpoint progress
execution and optional publish receipts
materialized-output snapshot identity, digest, size, and inode
```

The ledger is written atomically. Every transition increments the revision.
The frontier never moves backward. A resume validates the complete ledger
against the accepted plan before recovery or execution.

Attempt states are `Pending`, `RunningStructured`, `RunningTrustedExec`,
`DispatchingPublish`, `Passed`, `FailedBeforeCommit`, `CommitUnknown`,
`ManualReview`, `AssumedCommitted`, and `AssumedAbsent`.

Publication checkpoint states distinguish pending, durable dispatch intent,
passed, failed-before-commit, and unknown. A process interruption converts
replay-safe structured work to retryable failure, trusted execution to manual
review, and durable in-flight publication to unknown.

## 11. Recovery

Failed-before-commit work MAY retry when marked retryable. Unknown
publication MUST reconcile with a read-only probe or stop for an operator
decision. A resolution MUST name the operation, outcome (`committed` or
`absent`), operator, reason, and timestamp. Only explicit absent resolution
permits a later retry.

High-risk absence assumptions and trusted execution MUST remain conspicuous in
review surfaces. Recovery cannot widen scope or replace receipts.

## 12. Evidence

Evidence is derived from the validated ledger and contains plan/run identity,
revision, frontier, operation attempt statuses, and receipt fingerprints. It
MUST NOT be accepted as execution input or authority. The plan and ledger are
the only durable protocol documents.

## 13. Public surfaces

The root runtime exports are exactly:

- the lifecycle verbs and their boundary — `plan`, `reviewExecution`,
  `apply`, `makeReleaseApi`, `ReleaseApiError`, `defineRelease`;
- the service tags a caller composes a layer from — `ApprovalSigner`,
  `RunStore`, `CredentialStore`, `DriverCatalog`, `WorkspaceStore`, plus
  `ReleaseServicesLive` for everything but the two host capabilities;
- the permits an `ApprovalSigner` returns — `ExecutionPermit`,
  `PublishPermit`;
- the branded id constructors public inputs are built from — `PlanId`,
  `OperationId`, `ExecutionReviewId`, `PublishReviewId`, `Stage`.

The lifecycle verbs are exactly `plan` and `apply`; review is a pure
projection.

The CLI commands are exactly `init`, `doctor`, `plan`, and `apply`.
The Action commands are exactly `plan`, `doctor`, and `apply`.
`doctor` and review-only apply consume a plan and perform no publication.

Boundary failures are stable plain errors with phase and reason. Causes,
credentials, and secret-bearing process output MUST NOT cross the public
boundary.

## 14. Conformance

Conformance requires canonical round trips, strict excess-field rejection,
one-read app loading, workspace realpath equivalence, challenge/receipt drift
refusal, ledger transition coverage, driver fault cells, package boundary
checks, and app bundle checks.

Repository verification is read-only with respect to external publication.
