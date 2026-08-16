# Refactor research packet

Status: draft research for PR #19. This directory does not define a production API and does not authorize an Effect migration, Workflow/Activity implementation, Promise facade, or live provider mutation.

## Authority hierarchy

Use one document for each kind of decision:

1. [competitive-scope.md](./competitive-scope.md) is the canonical capability and release-scope ledger.
2. [provider-contracts.md](./provider-contracts.md) is the canonical provider-extension and provider-capability analysis.
3. [resumability.md](./resumability.md) is the canonical journal, replay, and retry-law analysis.
4. [artifact-model.md](./artifact-model.md) and [artifact-storage.md](./artifact-storage.md) are the canonical artifact and byte-ownership analysis.
5. [goreleaser-evidence-census.md](./goreleaser-evidence-census.md) is the complete feature-source census; [goreleaser-outcomes.md](./goreleaser-outcomes.md) is its derived outcome roadmap.
6. [decision-packet.md](./decision-packet.md) is a review projection. It must not introduce a second scope list, provider contract, journal model, or artifact model.

Provider wire facts remain in:

- [provider-wire-models.md](./provider-wire-models.md)
- [provider-wire-github-catalogs.md](./provider-wire-github-catalogs.md)

Effect and execution research remains in:

- [effect-patterns.md](./effect-patterns.md)
- [effect-architecture-patterns.md](./effect-architecture-patterns.md)
- [fresh-runner-resumability.md](./fresh-runner-resumability.md)
- [implementation-strategy.md](./implementation-strategy.md)

## Current high-confidence conclusions

- Provider mutation acceptance, fresh provider observation, public delivery observation, and clean consumer behavior are different outcomes.
- Clean install or execution checks are application or CI policy. They are not a provider capability and are not part of the canonical mutation/recovery journal.
- Replay protection is fixed when a concrete request is prepared. The journal records the protection before dispatch. Core later derives replay permission from durable facts; provider code does not reinterpret an old dispatch.
- Unsupported replay laws stop automatic replay. They do not admit executable policy into the resume path.
- Arbitrary providers remain ordinary imported TypeScript plus Layers. A fresh runner must load the same application/provider definition identity that produced the persisted Intent.
- The fixed shipping distribution scope is unchanged. Implementation order and artifact-production ownership are tracked separately in the canonical competitive-scope ledger.

## Research labels

Material claims should be labeled or attributable as:

- provider-specified;
- current-code-observed;
- released-code-observed;
- source-observed;
- experimentally observed;
- inferred;
- proposal;
- unresolved.

A passing compile probe proves only the compiled surface. It does not prove protocol semantics, durable continuation, or a live endpoint outcome.
