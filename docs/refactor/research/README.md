# Refactor research packet

Status: draft PR research. Production implementation is intentionally paused.

## Fixed shipping scope

The rewrite ships:

- npm;
- PyPI/Warehouse;
- GitHub Releases and assets;
- Homebrew formulas;
- Scoop; and
- arbitrary custom providers.

## Authority hierarchy

Different documents own different kinds of facts. They are not peer authorities.

| Subject | Authoritative research document |
| --- | --- |
| provider boundary alternatives and minimal capabilities | [provider-contracts.md](./provider-contracts.md), [provider-extension-runtime.md](./provider-extension-runtime.md) |
| provider wire facts and receipts | [provider-wire-models.md](./provider-wire-models.md), [provider-wire-github-catalogs.md](./provider-wire-github-catalogs.md) |
| artifact laws and ownership | [artifact-model.md](./artifact-model.md), [artifact-storage.md](./artifact-storage.md) |
| durable dispatch/retry/resume laws | [resumability.md](./resumability.md), [fresh-runner-resumability.md](./fresh-runner-resumability.md) |
| Effect versions and architecture patterns | [effect-patterns.md](./effect-patterns.md), [effect-architecture-patterns.md](./effect-architecture-patterns.md) |
| raw 151-case comparison inventory | [goreleaser-evidence-census.md](./goreleaser-evidence-census.md) |
| current evidence grades for material GoReleaser groups | [goreleaser-material-evidence.md](./goreleaser-material-evidence.md), [goreleaser-material-evidence-2.md](./goreleaser-material-evidence-2.md) |
| current product dispositions derived from the census | [goreleaser-outcomes.md](./goreleaser-outcomes.md) |
| implementation-order comparison | [implementation-strategy.md](./implementation-strategy.md) |
| adversarial state traces | [adversarial-traces.md](./adversarial-traces.md), [adversarial-traces-2.md](./adversarial-traces-2.md) |
| conclusions, recommendations, choices, and contradictions | [decision-packet.md](./decision-packet.md), [decision-packet-details.md](./decision-packet-details.md) |

The `R` column in `goreleaser-evidence-census.md` is retained as historical traceability from the recovered census. It is not the current rewrite-scope or roadmap authority. Current product disposition comes from `goreleaser-outcomes.md`, constrained by the fixed shipping scope above and supported by `goreleaser-material-evidence.md`.

## Guardrails

- no production root API;
- no Effect dependency migration;
- no Workflow/Activity implementation;
- no Promise facade;
- no universal `Publisher`, `verify`, or `ensurePublished`;
- no provider allowlist or certification system;
- no live provider mutation in this research checkpoint.

## Evidence discipline

Every claim should be labeled or inferable as:

- provider/document specified;
- pinned source observed;
- disposable probe observed;
- inferred;
- provisional recommendation;
- fixed project decision; or
- genuine maintainer choice.

A compile or protocol-double result never silently becomes provider acceptance, public byte identity, consumer behavior, or fresh-runner resumability.
