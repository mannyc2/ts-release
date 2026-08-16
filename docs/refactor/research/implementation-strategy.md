# Implementation-order comparison

Status: research-only. Scope remains the 16/3/6 ledger in
`competitive-scope.md`.

## Accepted sequence

1. minimum immutable bundle, canonical Intent, core-derived operation identity,
   `DispatchStarted`, and `JournalStore` law;
2. wire-complete npm normal success and response-loss behavior;
3. Warehouse per-file success, conflict, partial progress, and response loss;
4. generalize only laws demonstrated by those provider slices;
5. add GitHub tag/release/assets;
6. add conditional Git publication plus Homebrew formulas and Scoop;
7. prove custom-provider fresh-runner continuation;
8. exercise P01-P10 artifact production/trust outcomes;
9. prove A01-A03 architecture without making them vNext acceptance gates;
10. complete non-manual ts-release self-release.

## Corrections before production work

The previous checkpoint prematurely froze several implementation choices. The
next production design should use these corrected constraints:

- operation identity is core-derived, not provider-projected;
- implementation/lockfile provenance is diagnostic, not replay authority;
- core transport proves correspondence, not remote idempotency;
- automatic replay requires a separate trusted provider-law authority;
- the `JournalStore` interface is fixed, but its first-party backend set is
  open;
- Apple notarization is effect-build-owned but durable recovery is unresolved.

## Earliest discriminating work

Before a production provider API is frozen:

1. decide the replay-law authority model using npm, Warehouse, Git, and a custom
   idempotency-key counterexample;
2. run a focused Git-ref journal race and evaluate GitHub Actions permissions;
3. compare SQLite and filesystem-generation local UX on Linux, macOS, and
   Windows;
4. design effect-build-apple's durable notarization record; and
5. keep provider wire slices ahead of generalized orchestration machinery.

## Why this does not reduce ambition

All 16 vNext outcomes remain required. The sequence merely obtains external
wire and deployment evidence before generalized infrastructure becomes hard to
change.

## Evidence gates

```text
compile/type probe
process-separated local probe
protocol double
scratch provider acceptance
fresh public observation
intended byte identity
clean consumer behavior
fresh-runner response-loss continuation
non-manual self-release
```

A lower gate must not be reported as a higher one.
