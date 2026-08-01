# Architecture

`ts-release` has one deterministic planning core and one receipt-gated apply
machine. Applications translate files or CI inputs into public value calls;
they do not own release semantics.

## Eight concepts

1. Config — strict JSON-compatible intent supplied as an in-memory value.
2. Identity — name, version, tag, commit, and snapshot marker.
3. Recipe — immutable product-owned lowering data.
4. Op — a typed mechanism row with declared inputs and outputs.
5. Plan — accepted canonical intent and its identity.
6. Evidence — a derived, non-authoritative run projection.
7. Driver — mechanism capability for local or remote effects.
8. Invocation — canonical workspace and observed planning facts.

## Permanent ownership

```text
src/model     schemas, primitives, operations, state, canonical encoding
src/recipes   deterministic feature/profile lowering
src/config    strict value decoding
src/plan      compilation, validation, canonical acceptance, review
src/drivers   capability interfaces and live mechanism implementations
src/apply     approvals, ledger, transitions, orchestration
src/view      projections from accepted plans and ledgers
src/platform  per-host layers closing the spawn and HTTP capabilities
src/api       Promise boundary, exact inputs, immutable layer binding
src/index.ts  sole package entrypoint
apps/release-ts
apps/ts-release-action
```

There is no rewrite, legacy, compatibility, v5, mutable runtime, or
translation namespace.

## Dependency DAG

```text
model
├── recipes
│   └── config
├── plan/accepted
│   ├── plan ← config + recipes
│   ├── apply ← drivers
│   ├── view
│   └── platform ← drivers + apply
└── api ← plan + apply + view + drivers + platform
    └── public root + ./node + ./bun
        ├── CLI    → ./bun
        └── Action → ./node
```

Model imports no product owner. Recipes depend only on model. Config decodes
recipe configuration. Accepted-plan code depends only on model. Planning may
use model, config, recipes, and acceptance. Drivers depend only on model.
Apply uses model, accepted plans, and drivers. Views use model and accepted
plans. Platform closes host capabilities. The API is the composition
boundary. Apps import only published package entrypoints.

Architecture checks enforce this graph and reject runtime registration,
dynamic evaluation, workflow-level Effect execution, provider-name branches
inside generic drivers, temporary namespaces, and excluded test/oracle
imports.

## Host boundaries

The drivers are written once. Only three capabilities differ or carry ambient
authority across hosts, so only those are injected:

```text
src/drivers            LiveDriversLayer
                         provides WorkspaceStore, DriverCatalog, CredentialStore
                         requires ChildProcessSpawner, HttpClient
                         reads environment through effect/Config
src/platform/services  ReleaseServicesLive = live drivers + run store + signer
src/platform/node.ts   NodeReleaseLayer  ("@mannyc1/ts-release/node")
src/platform/bun.ts    BunReleaseLayer   ("@mannyc1/ts-release/bun")
```

The layer acquires the two capabilities once at construction and closes over
them, so every service method keeps `R = never` and a fake is a plain shape.
The CLI composes the Bun layer, the Action composes the Node layer, and the
root convenience functions bind the Node layer, which is correct under both
runtimes. The Bun module is unreachable from the package root, so importing
`@mannyc1/ts-release` under Node never loads a Bun module.

File I/O deliberately stays direct `node:fs`: it is identical on both hosts,
and the security discipline it carries — `O_NOFOLLOW` opens with fstat/lstat
identity comparison, `O_EXCL` leases, fsync, atomic rename — is not
expressible through `effect/FileSystem` string open flags. `node:crypto` and
`node:zlib` are pure computation. Import rules confine `node:fs` to the named
files that hold that discipline and ban the `Bun` global and global `fetch`
from `src/` outright.

## Data flow

```text
config value
  → validate and lower
  → canonical release-plan/v6 bytes + PlanId
  → select immutable scope
  → execution review challenge
  → new run-bound execution receipt
  → apply through validate
  → observe materialized outputs and read facts
  → publish review challenge
  → run-bound publish receipt
  → apply through verify
  → run-ledger/v1
  → evidence projection
```

Planning never calls a driver. Apply never accepts configuration or calls the
planner.

## Durable documents

Exactly two protocol documents persist:

- `release-plan/v6` is immutable intent. Strict acceptance re-encodes and
  compares exact canonical bytes before deriving `PlanId`.
- `run-ledger/v1` is execution state. It binds plan id, operation hashes,
  immutable scope, topology, monotonic frontier, receipts, attempts,
  checkpoints, and materialized-output snapshots.

Evidence is derived from the ledger and cannot authorize or resume work.
There is no fallback reader for earlier plan or evidence formats.

## Authority

Mechanism determines authority:

```text
Check                                      LocalRead
Write, Pack, Digest                        LocalWrite
Exec                                       LocalExec
HttpRead, ReviewedNoteTransform            RemoteRead
HttpPublish, ForgeRelease,
PackageRegistryRelease, PackageStorePublish,
SupplyChainPublish, ProviderPublish,
AnnouncementPublish, SmtpPublish,
OpaquePublish                              RemotePublish
```

Recipes select mechanisms but cannot redefine their authority. Runtime
configuration cannot register profiles. Homebrew, Scoop, package registry,
and provider data is immutable and product-owned.

The execution review challenge proves only what was reviewed. A nonce,
reviewer, timestamp, topology, and run identity mint the execution receipt.
Publication is separately authorized only after materialized inputs are
observed. Credentials remain capability values and never enter durable data.

## State and recovery

The ledger frontier advances in fixed stage order:

```text
build → process → catalog → validate → publish → announce → verify
```

Structured local work is replay-aware. Trusted execution stops for manual
review after interruption. Remote publication records durable dispatch
intent and checkpoint reconciliation keys before network dispatch. An
ambiguous outcome becomes `CommitUnknown`; read-only reconciliation or an
explicit operator resolution is required before progress.

Every resume revalidates the plan, ledger, scope, topology, operation hashes,
receipts, and recorded output snapshots before reaching a driver.

## Boundaries

The library accepts only values and absolute existing workspaces. The API
realpath-normalizes workspace roots and maps internal failures to stable
plain errors. Its default functions share one immutable live layer bound to
the Node host; `makeReleaseApi(layer)` supplies explicit alternate services,
built from the exported service tags and shapes, a published host layer, or
`ReleaseServicesLive` plus a platform of the caller's choosing.

The CLI owns one-read JSON loading and workspace selection. Its commands are
`init`, `doctor`, `plan`, and `apply`.

The Action owns one-read, workspace-contained JSON loading. Its commands are
`plan`, `doctor`, and `apply`. Its bundle is checked against source and then
executed under real `node` against a fixture release covering every local
mechanism, because the Action runs `node20` and a Bun-only call there fails
mid-run rather than at load.

Both apps pass canonical plan bytes to apply. Neither can inject
configuration, authority, credentials, scope changes, or risk changes into
an accepted plan.

## Verification lanes

Behavior tests, fault injection, driver conformance, import rules, public
package checks, and CLI/Action tests verify the release machinery. Driver
conformance and the remote-driver suite run the live drivers under injected
spawn and HTTP doubles; the action-bundle gate runs them for real under node.
Verification does not dispatch publication.
