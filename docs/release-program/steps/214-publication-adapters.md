# Plan 214 — Exact observe-before-mutate publication adapters

Input-Commit: a707c43
Result-Commit: 0b48f84
Evidence-Commit: SELF
Status: DONE
Outcome: EXACT-NPM-GITHUB / PYPI-CUT
Date: 2026-08-09

## Decision consumed

Plan 208 is `PASS WITH CAPABILITY CUT`. The executable automatic set is npm
package versions plus GitHub release metadata and individual assets. PyPI stays
provisional in older configuration/schema evidence but is absent from the new
publication registry because exact configured-index per-file observation was
not admitted. Generic HTTP, opaque command publication, announcements, SMTP,
and provider/profile shapes remain outside the product.

## New publication owner

`src/publication/observation.ts` defines the closed algebra:

- `Equivalent` — exact subject is present;
- `NeedsMutation` — only an adapter can construct the exact one-write
  precondition;
- `Conflict` — occupied non-equivalent state with field-level differences;
- `Inconclusive` — no safe conclusion, so mutation is forbidden.

Mutation results are `Applied`, `Rejected` with a before-dispatch/provider
phase, or `OutcomeUnknown`. `publishSubject` performs one observation, at
most one adapter-authorized mutation, and an observation after every mutation
result, including rejection and response loss. It never converts HTTP status,
transport failure, or a missing local boolean into `NeedsMutation`.

`src/publication/adapter.ts` sequences a loaded PreparedRelease. GitHub release
metadata is the first subject and each asset is a separate dependent subject;
a blocked release prevents asset mutation. Credentials are passed as distinct
read and publish values and do not enter prepared data.

## npm adapter

`src/publication/npm.ts` observes the configured registry URL and exact
package/version coordinate. It compares npm `dist.integrity` (SHA-512 SRI) or
the legacy `dist.shasum` against the exact prepared tarball bytes. Authoritative
404 absence is the sole create precondition; occupied mismatches are
`Conflict`; auth, rate limits, server failures, malformed metadata, transport
loss, and missing integrity facts are `Inconclusive`.

Mutation receives the exact PreparedRelease tarball bytes through an injected
process seam. A spawn failure is `Rejected(before-dispatch)`, a started child
with a nonzero exit is provider `Rejected`, and a post-dispatch transport loss
is `OutcomeUnknown`; all are reobserved before the coordinator returns.
There is no `npm publish <source-directory>` path in the new owner.

## GitHub adapter

`src/publication/github.ts` compares release tag, target commit, title, exact
body (omitted body means empty), draft, prerelease, and the allowed occupied
asset-name set. It distinguishes genuine tag absence from all other response
classes. Each asset compares name, size, media type, and the provider digest;
when digest is omitted, the adapter downloads and hashes the exact bytes.
Same-name differing assets and metadata differences are conflicts. Release
creation and each asset upload are separate single mutations with exact
reobservation.

## Compatibility and cuts

The old `DriverCatalog`/apply protocol remains present only to keep the
pre-217 public surface green. It is not imported by `src/publication`, and no
new adapter uses `ReadResult`, `NotDispatched`, `found`, generic retry flags,
or the old reconciliation algebra. Plan 217 owns the atomic public lifecycle
cut and deletion of that compatibility surface; it must not add a second
publication implementation.

The Plan 208 discovery/recovery research harness was deleted after permanent
npm/GitHub/coordinator conformance tests were added. No PyPI adapter or
capability claim was added.

## Verification

- `bun test test/publication` — PASS: 12 tests, 55 expectations.
- `bun run check:import-rules` — PASS: 151 files examined.
- `bun run check:docs-claims` — PASS: 9 claims across 3 files.
- `bun run check:tree-shaking` — PASS: 79 files examined.
- `bun run check:portable` — PASS: 207 tests, 870 expectations across 40
  files, plus app/Action checks, build, Node CLI bundle, schema, examples,
  README, package exports, and all static gates.
- `git diff --check` — PASS.
- No credentials, registry, GitHub repository, tag, release, asset, package,
  workflow, or other external state was read or mutated.

## Physical delta

Against the Plan 213 evidence head, this wave adds 737 lines and deletes 292
lines. The addition is one typed publication owner with injected HTTP/process
seams and permanent tests; the deletion is the obsolete 287-line research
harness. The existing pre-217 compatibility driver remains explicitly
scheduled for Plan 217 deletion rather than duplicated in the new owner.

## Handoff

Plan 215 may consume only `PreparedRelease` bytes and typed destination state.
It must keep catalog delivery separate from npm/GitHub publication, use one
typed conditional Git adapter, and never turn a failed Git observation into an
absence or generic overwrite permission.
