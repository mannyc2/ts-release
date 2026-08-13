# Plan 232 — Native extension model

Input-Commit: 410c31675b92d4084f87a9059c090740f92b1dc2
Result-Commit: SELF
Evidence-Commit: SELF
Status: LOCAL IMPLEMENTATION COMPLETE / DELTA CERTIFICATION AND LIVE RELEASE GATED
Outcome: TYPED PREPARATION + LIBRARY PROVIDER SDK / ZERO LIVE MUTATION
Date: 2026-08-13

## Non-authority statement

This handoff adds no public-provider mutation authority. No credential was
acquired and no remote resource was read or changed. Delta certification/live
release remains gated on Plan 234 and a separately dispatched wave packet.

## Re-audit and taxonomy

The Plan-207 ledger now carries a validator-enforced Plan-232 reconciliation
matrix for every hook-shaped, custom-publisher, verification, announcement,
and supply-chain case. Each row names the concrete user job, native owner,
disposition, failure semantics, and typed re-open bar. The validator requires
exact duplicate-free source-case coverage and separately guards the prior npm
family-mapping error: exact npm publication is installed while implicit
platform-wrapper generation is a different unsupported builder job.

- Local validation is `CommandCheck`.
- Local generation/transformation is `CommandArtifact` or its typed collection
  form.
- Exact remote verification is the existing read-only `observe` operation over
  the same installed provider subjects used by publication.
- Provider extension is explicit custom-application composition through
  `@mannyc1/ts-release/provider-sdk`, never serialized command/plugin config.
- Secret-bearing signing/notarization/transparency effects remain unsupported
  until a dedicated typed capability proves its authority and recovery model.
- Approval, staged provider workflows, coordination, and announcements remain
  downstream host orchestration.

## Preparation safety

Plan 228's preparation boundary remains the only command path: argv arrays,
declared inputs, exact declared outputs or a typed collection contract, a
private materialized source tree, mutation checks after each operation, denied
network, closed environment, and no credential grant. Strict config rejects
ambient environment overlays, signing/notarization commands, generic remote
publish commands, announcement webhooks, and dynamic adapter packages.

The existing root preparation suite covers pre-build policy checks, generated
artifacts, transformations, artifact-as-input validation, runtime-discovered
collections with stable selectors, undeclared source/input mutation refusal,
closed environment, denied network, and redaction. No offline signing support
is claimed, so every signing row records the exact typed signer re-open bar.

## Provider SDK boundary

`ProviderAdapterContract` is a closed acknowledgement of typed prepared data,
canonical subject identity, exact equality/absence, typed mutation
precondition/commitment, audience/purpose-scoped credentials, coordinator
recovery, and protocol/public-boundary certification. `makeProviderAdapter`
strictly validates this contract and its profile registration.

`customProviderSubjects` verifies unique subject identity, exact recovery
profile equality, and that every observation/mutation credential request uses
the registered provider. The unchanged coordinator performs its normal
request-identity, authority-order, anonymous-mutation, prerequisite, and
durable-history checks. `makeReleaseApi(layer, { providerAdapters })` is the
explicit application composition point. Stock CLI/Action code passes no
adapters and config cannot name one.

Contract tests compose a third-party exact observer through the coordinator
without modifying it and reject a missing contract, profile mismatch, foreign
provider authority, duplicate/dynamic stock config, remote command publisher,
ambient signing secret, and root plugin owners.

## Verification, supply chain, and announcements

Exact npm, GitHub Release, PyPI, and catalog verification reuses installed
provider observation subjects; no second HTTP-check language or `verify`
operation exists. Non-secret local SBOM generation may use `CommandArtifact`.
Offline signing requires exact bytes, key audience/lifetime, host/tool, output
identity, cleanup, and cancellation before it can reopen. Remote signing,
notarization, timestamping, transparency, and keyless attestation additionally
require provider commitment/exposure/recovery semantics.

`docs/native-extensions.md` includes concrete preparation translations, custom
application composition, non-goals, and a GitHub Actions announcement example
that consumes the redacted report artifact after a successful release. It
explicitly states that the downstream call is not rollback-safe or exactly
once. Checkout scans retain `persist-credentials: false`; scans also prove no
root `.claude-plugin`, `.codex-plugin`, or generic plugin owner exists. Agent
generator dogfood remains solely Plan 233-owned.

## Local verification

- `bun run check`
- `bun test test/extensions/provider-adapter-sdk.test.ts`
- `bun test test/core/preparation.test.ts test/core/artifact-collection.test.ts`
- `bun run check:feature-translation`
- `bun run check:import-rules`
- `bun run check:package-exports`

The final all-plans aggregate gates and exact result commit are recorded only
after the remaining program work closes.

The final current-worktree `check:portable` aggregate passed with the admitted
Node 24.15.0 and npm 11.17.0 runtimes: 372 tests / 2,186 expectations / zero
skips or failures, TypeScript and import/tree-shaking boundaries, package
exports plus the external SDK consumer, built library/CLI/canonical Action,
packed Bun/npm consumers, provider-native agent archives, and the app/Action
cutover suites. This is `contract-tested` current-worktree evidence only; it
does not satisfy the separately gated clean delta certification or live
release.

## Remaining gated work

The local Plan 232 implementation is complete. Delta certification and any
live provider adapter release require the successful Plan 234 kernel live
certificate, published `0.2.0` coordinates, and a new explicit authority packet
for that wave. This handoff does not infer or transfer such authority.
