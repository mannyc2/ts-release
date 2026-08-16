# Refactor research packet

Status: draft research for the stacked continuation of PR #19. This directory does not define a production API and does not authorize an Effect migration, Workflow/Activity implementation, Promise facade, or live provider mutation.

## Authority hierarchy

1. `competitive-scope.md` owns the 16/3/6 capability ledger.
2. `provider-contracts.md` owns the provider-definition and optional-service laws.
3. `resumability.md` owns events, replay protection, request equivalence, structured stops, and CAS-before-send.
4. `journal-backends.md` owns R1 storage-mechanism evidence and the `JournalStore` result.
5. `idempotency-material.md` owns R2 secret-material evidence and the derived-key-only result.
6. `artifact-model.md` and `artifact-storage.md` own immutable content, adoption, and the effect-build boundary.
7. `provider-wire-models.md` and `provider-wire-github-catalogs.md` own provider-specific operation/receipt facts.
8. `goreleaser-evidence-census.md` owns the complete feature census; `goreleaser-outcomes.md` projects it through the canonical scope ledger.
9. `decision-packet.md` is a review projection and must not create peer authorities.

## Accepted high-confidence conclusions

- vNext acceptance is 16 outcome families: six distribution plus ten artifact-production/trust families.
- The three AI-native outcomes are architecture-proved only; the six destination packages remain deferred.
- `ConsumerScenario`, durable acceptance records, `ConsumerEvidenceRecorded`, `ReplaySafetyCapability`, and `ReplayAuthorized` are removed.
- `RiskAccepted` remains because it records a new human decision.
- ProviderDefinition has exactly five conceptual fields: definition ID, Intent Schema, schema version, behavior ID, and operation-ID projection.
- prepare/observe/correct are optional provider-local services.
- automatic replay exists only through core-owned HTTP/Git prepared transports and append-only replay scheme IDs.
- provider authors cannot supply a custom normalized request projection in v1.
- behavior or lockfile drift blocks automatic replay even when request fingerprints match; no migration machinery exists in v1.
- npm initial publish is one operation with a composite receipt; `memberOperationIds` is removed.
- Apple notarization/stapling/verification belongs to `effect-build-apple`; ts-release adopts only finalized bytes.
- the bundle kernel remains an internal extraction-ready ts-release library.
- one `JournalStore.appendIfRevision` law is justified by local-generation and S3-conditional backends.
- no fixed provider requires secret durable replay material; v1 is derived-key-only.
- Workflow/Activity remains deferred until six fixed distribution families are wire-complete.

## Executable research

- `probes/two-runner/`: separate-process prepare/replay/identity/CAS traces.
- `probes/journal-backends/`: two-process filesystem, SQLite, conditional-object, and artifact-plus-external-state races.
- `.github/workflows/refactor-research-probes.yml`: compiles/runs both probe sets.

A passing probe proves only its explicit mechanism and environment. The conditional-object probe is a protocol double; official provider documentation remains the authority for live service semantics.

## Research labels

Claims should remain attributable as provider-specified, source-observed, experimentally observed, inferred, accepted decision, proposal, or unresolved.
