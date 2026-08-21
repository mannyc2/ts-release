# Implementation-order comparison

Status: research-only implementation projection. Atomic scope remains
`launch-scorecard.md`; the complete coordinated program is
`cross-repository-delivery.md`.

## Accepted sequence

1. minimum immutable bundle, canonical Intent, core-derived operation identity,
   `DispatchStarted`, `JournalStore` law, and derived release report;
2. wire-complete npm normal success and response-loss behavior;
3. Warehouse per-file success, conflict, partial progress, and response loss;
4. generalize only laws demonstrated by those provider slices;
5. add GitHub tag/release/assets;
6. add conditional Git publication plus Homebrew formulas and Scoop;
7. prove custom-provider fresh-runner continuation;
8. exercise every selected P/Q artifact-production and trust leaf through the
   effect-build handoff;
9. add MCP Registry and the selected OpenAI plugin-delivery leaves;
10. ship the first-party GitHub Action and complete non-manual ts-release
    self-release with fresh-runner injection.

## Corrections before production work

The previous checkpoint prematurely froze several implementation choices. The
next production design should use these corrected constraints:

- operation identity is core-derived, not provider-projected;
- implementation/lockfile provenance is diagnostic, not replay authority;
- core transport proves correspondence, not remote idempotency;
- automatic replay requires a separate trusted provider-law authority;
- the `JournalStore` interface is fixed, but its first-party backend set is
  open;
- concrete Apple notary operations are effect-build-owned; release-level
  durable history remains in ts-release and correlation recovery is unresolved.

## Earliest discriminating work

Before a production provider API is frozen:

1. decide the replay-law authority model using npm, Warehouse, Git, and a custom
   idempotency-key counterexample;
2. run a focused Git-ref journal race and evaluate GitHub Actions permissions;
3. compare SQLite and filesystem-generation local UX on Linux, macOS, and
   Windows;
4. design effect-build-apple's typed notary operations against ts-release's
   single durable operation/journal record; and
5. keep provider wire slices ahead of generalized orchestration machinery.

## Why this does not reduce ambition

All 69 selected vNext leaves remain required unless the sole scorecard changes.
The sequence merely obtains external wire and deployment evidence before
generalized infrastructure becomes hard to change. Ten candidate leaves remain
visible as nine maintainer choices rather than disappearing from the roadmap.

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
