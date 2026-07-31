# Changelog

## Unreleased

- Internal readability refactor with identical public behavior: one authority
  predicate for remote-publish operations, shared canonical-JSON hashing, an
  `ApplyContext` for the apply orchestrator, and removal of dead driver
  service seams and `rewrite`-era names (trace spans, service keys, and the
  app `cutover` modules, now `commands`).
- Pointed `check:core` at the certified dependency-audit gate (`check:audit`)
  instead of the environment-dependent raw `bun audit`.

## 0.2.0 - 2026-07-27

### Breaking: sealed plan/apply core

- Replaced the former lifecycle API with value-only `plan` and
  canonical-bytes-only `apply`; `reviewExecution` is a pure review helper.
- Replaced the six-command CLI with exactly `init`, `doctor`, `plan`, and
  `apply`.
- Replaced Action commands with exactly `plan`, `doctor`, and `apply`, and
  added explicit plan, review, receipt, run, status, and evidence outputs.
- Moved all product code into its permanent model, config, recipe, plan,
  driver, apply, view, and API owners; removed the legacy engine and
  compatibility spine.
- Replaced `release-plan/v5` with canonical `release-plan/v6`.
- Replaced durable `release-evidence/v3` with `run-ledger/v1`; evidence is now
  a derived projection.
- Added immutable execution scope, run-bound execution receipts, observed
  publish review, run-bound publish receipts, monotonic staged apply,
  reconciliation, and explicit operator resolutions.
- Made configuration file loading app-owned and one-read. Core configuration
  is a strict JSON-compatible value with no path or encoding parser.
- Required absolute existing realpath-normalized workspaces.
- Made Homebrew, Scoop, package, and provider profiles product-owned and
  immutable.
- Added deterministic changelog generation, reviewed validation-time note
  transformation, and closed announcement operations for thirteen HTTP-like
  channels plus SMTP.
- Added typed package, supply-chain, provider, distributed-execution, and
  announcement profiles with immutable contract fixtures.
- Certified full in-scope outcome parity for TypeScript/Bun distribution
  against the pinned GoReleaser v2.17.0 ledger: 107/107 customization rows
  and 33/33 Pro rows, with the eleven manifest exclusions.
- Certified all five technical properties, 45/45 fault cells, and 11/11
  structural controls with zero credential leaks and duplicate mutations.
- Closed at 5,871 Product semantic lines and 6,040 Oracle semantic lines.
- Removed mutable runtime swapping, runtime profile registration, old
  lifecycle aliases, fallback durable readers, and config translation DTOs.

Migration is documented in `README.md`. This is an intentional hard cut; old
verbs and document formats are not accepted.
