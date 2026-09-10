# Durable release decisions

Preparation owns immutable artifact bytes in a Bundle; a Plan binds exact provider
operations to that Bundle. Publication and recovery reuse these identities.

The Journal records dispatch before sending. A fresh runner reads the same durable
journal, including unresolved dispatches. Destination absence alone cannot establish
that a previous request did not commit. Only exact provider evidence, supported
conditional replay, or explicit recorded risk acceptance can permit another send.
Request/receipt correspondence and provider boundaries remain mandatory. Apple
preparation retains its preparation scope and native recovery evidence.

Earlier observation-only npm/GitHub recovery was selected in plan 229 (August 12).
The later fresh-runner promise deliberately required remembered unresolved attempts.
This maintenance pass preserves that decision rather than adopting observe-first
recovery. Historical detail remains in Git history at 334de3e, including
`docs/release-program/remediation/229-history-decision.md`,
`docs/refactor/research/resumability.md`, and the completed wave reviews.

Completed rewrite ancestry, migration ledgers, source budgets, generated API
projections and research tools are retired. Behavioral tests, installed-package
checks, native fixtures and release build tooling remain maintained product checks.
