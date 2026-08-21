# Refactor research packet

Status: product-centered research for the stacked PR #20 program. This packet
does not authorize a production API, Promise facade, Effect dependency
migration, Workflow/Activity implementation, or live provider mutation.

## Authority map

The research has one authority per fact:

1. [`launch-scorecard.md`](launch-scorecard.md) is the sole atomic product-scope
   authority: outcomes, owners, dependencies, dispositions, fixtures, evidence,
   counts, and maintainer choices.
2. [`goreleaser-evidence-census.md`](goreleaser-evidence-census.md) is the exact
   disposition authority for the preserved 151-case GoReleaser index.
3. [`provider-contracts.md`](provider-contracts.md) and
   [`provider-wire-models.md`](provider-wire-models.md) describe provider-local
   protocol facts; they do not create product scope.
4. [`resumability.md`](resumability.md) is the canonical journal,
   reconciliation, replay, and risk model. [`fresh-runner-resumability.md`](fresh-runner-resumability.md)
   and the adversarial traces are projections and counterexamples.
5. [`journal-backends.md`](journal-backends.md) owns the accepted
   append-if-revision store law and compares deployment mechanisms without
   promoting one to a product requirement.
6. [`artifact-model.md`](artifact-model.md) and
   [`artifact-storage.md`](artifact-storage.md) own immutable-content and
   load-boundary research.
7. [`competitive-scope.md`](competitive-scope.md) and
   [`goreleaser-outcomes.md`](goreleaser-outcomes.md) are readable projections
   of the scorecard/census, never peer ledgers.
8. [`product-api-examples.md`](product-api-examples.md) makes the intended
   Effect-authored product tangible without freezing names.
9. [`cross-repository-delivery.md`](cross-repository-delivery.md) assigns the
   coordinated effect-build/ts-release delivery program.
10. [`decision-packet.md`](decision-packet.md) remains a review projection; any
    stale count or choice yields to the scorecard.

## Product checkpoint

```text
79 evaluated launch candidates
  69 selected vNext leaves
  10 resolved-later leaves / 9 maintainer choices
  0 unresolved candidate leaves

7 deferred maintained destination packages
30 named later-model leaves

151 preserved GoReleaser cases
  151 exact finite dispositions
  0 unresolved targets
```

The selected 69 leaves are 3 core delivery/reporting outcomes, 35 provider and
distribution outcomes, 28 artifact production/trust outcomes, and 3 OpenAI
plugin-delivery outcomes.

This leaf count is acceptance granularity, not abstraction count. Structural
prerequisites are represented once. A product promise is split only where its
provider mutation, partial-success unit, output format, platform, or external
oracle differs materially.

## Accepted high-confidence conclusions

- Consumer install/import/download/execute is an evidence facet, not a
  provider capability or journal event.
- A documented successful provider response remains success. Reconciliation
  belongs to the possible-dispatch/no-response path.
- Observed absence cannot fence an in-flight mutation.
- Replay protection is frozen at dispatch. Core request correspondence and a
  remote protocol's enforcement law are different evidence. Automatic replay
  in v1 is limited to structurally evidenced core compare-and-swap laws; npm
  response loss observes and then stops honestly rather than resending.
- `RiskAccepted` records a scoped human decision; it is not a substitute for
  evidence.
- Provider-controlled operation identity, whole-lockfile identity, and
  manually maintained behavior IDs are not replay authorities.
- Custom providers load through ordinary application imports and Layers. The
  core has no provider allowlist, sealed union, global registry, or one-instance
  assumption.
- Provider-specific services are plain DI. A shared interface is justified
  only when implementations are substitutable under the same laws.
- `JournalStore.appendIfRevision` is a lawful shared interface. The first-party
  Bun CLI default is a local SQLite database at an explicit state path. It is
  not presented as a cross-host CI store; Git-ref and other shared backends
  remain provisional seams.
- Provider Intent Schemas encode to the versioned strict canonical-JSON
  representation owned by core. Core derives bundle, plan, and operation
  identities; `(planId, operationId)` is the durable operation key.
- Production packages align exactly on Effect `4.0.0-beta.107`, the current npm
  beta on 2026-08-21. Historical RC probes remain evidence, not the selected
  package family.
- effect-build owns concrete artifact production and transformation;
  ts-release owns immutable adoption, provider mutation, release history,
  continuation, and reporting.
- effect-build-apple owns concrete notarization operations, while ts-release
  owns the one durable release journal. The pre-recorded-submission-ID gap can
  still end `Inconclusive`.
- AI-native launch scope is concrete: one OpenAI plugin package, one repository
  marketplace update, and one public-submission handoff validator. Human portal
  review is outside provider success.
- GoReleaser mechanisms and headings are evidence, not automatically product
  capabilities. Native npm, Python production, Warehouse publication, asset
  byte evidence, and consumer installation remain distinct outcomes.

## Resolved maintainer choices

The scorecard preserves nine reviewed choices as finite later work:

1. ipk/OpenWrt package production;
2. MSI inclusion, toolchain, and associated MSI signing;
3. detached OpenPGP signatures;
4. keyless Cosign blob signatures;
5. OCI image/index publication;
6. hosted nightly publication;
7. automatic SemVer proposal;
8. automatic release-note derivation;
9. macOS universal executable output.

All nine are deferred from vNext. New primary evidence strengthens the
deferrals: OpenWrt 25.12 moved its default package manager from opkg/ipk to APK;
WiX 7 adds a license/toolchain decision; and the other seven each introduce a
separate trust, registry, retention, derivation, or transformation policy.
Promotion requires concrete product demand and its own acceptance evidence.

## Effect direction

The intended root is an Effect-authored application that produces a durable
plan and supplies ordinary provider services. The durable plan stores versioned
provider Intents, not executable closures. A fresh runner loads the same
application, resolves definitions through ordinary imports, decodes Intents,
folds the journal, and chooses send, observe, stop, or request explicit risk
acceptance.

The research does not choose Workflow/Activity as the kernel. Durable workflow
machinery can persist and replay encoded exits, but it cannot close the gap
where an external provider commits before the local exit is recorded. Provider
idempotency, conditional mutation, exact-duplicate law, or reconciliation must
still justify continuation.

## Probe discipline

The probes are executable counterexamples or shape tests, not production
implementations:

- artifact probes test ownership, identity, finalization, and load-boundary
  alternatives;
- the clean-consumer probe demonstrates an external provider package unknown
  when core/CLI were built;
- two-runner probes exercise frozen dispatch facts and races through separate
  processes;
- journal probes compare append-if-revision mechanisms;
- Effect compile probes compare pinned beta/RC public surfaces.

No probe establishes a universal API merely by compiling. No protocol double
proves a live provider law. Claims in the scorecard name the external oracle
still required.

## Research-only delivery rule

All work in this checkpoint stays under `docs/refactor/research/`. It must not
change production source, package manifests, lockfiles, dependencies, Promise
APIs, Workflow/Activity code, or perform live provider/storage mutation.
