# Changelog

## Unreleased

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
- Removed mutable runtime swapping, runtime profile registration, old
  lifecycle aliases, fallback durable readers, and config translation DTOs.

Migration is documented in `README.md`. This is an intentional hard cut; old
verbs and document formats are not accepted.
