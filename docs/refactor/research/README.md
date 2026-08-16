# Refactor research packet

Status: draft research for stacked PR #20. No production API, Promise facade,
Effect migration, Workflow/Activity implementation, or live provider mutation
is authorized here.

## Canonical authorities

1. `competitive-scope.md` - 16/3/6 product scope.
2. `provider-contracts.md` - provider-definition and optional-operation laws.
3. `resumability.md` - journal, request correspondence, replay, and risk laws.
4. `journal-backends.md` - accepted store law and open backend comparison.
5. `artifact-model.md` and `artifact-storage.md` - immutable content and
   effect-build boundary.
6. `goreleaser-evidence-census.md` and `goreleaser-outcomes.md` - evidence
   census and derived roadmap.
7. `decision-packet.md` - review projection only; it must not create peer
   authorities.

## Accepted high-confidence conclusions

- Consumer testing is application/CI policy, not a provider capability or
  mutation-journal event.
- Replay protection is recorded before dispatch; `RiskAccepted` records a real
  human decision.
- Observed absence cannot fence an in-flight request.
- Core-owned transports can prove recorded/sent request correspondence.
- Transport correspondence does not prove a remote idempotency or
  exact-duplicate law.
- Provider-controlled operation identity is not required; core can derive it
  from plan and canonical Intent facts.
- Whole-lockfile and manually maintained behavior identity are implementation
  provenance, not established replay authorities.
- `JournalStore.appendIfRevision` is a lawful shared interface; mandatory
  backend selection remains open.
- effect-build-apple owns notarization through final bytes, while its durable
  fresh-process recovery design remains unresolved.
- vNext acceptance remains 16 outcome families; A01-A03 are architecture proof
  only and X01-X06 are deferred.

## Probe discipline

The two-runner probe exercises one selected shape. It does not establish that
its field list is exact or minimal.

The focused identity comparison shows only that:

- core-derived operation identity is stable across provider implementations;
- provider-authored identity can diverge for the same canonical Intent; and
- strict implementation blocking and bytes-sufficient correspondence are
  distinct policies.

It does not prove provider idempotency, live response-loss recovery, production
storage, or a final TypeScript API.

## Evidence labels

- provider-specified;
- current-code-observed;
- released-code-observed;
- source-observed;
- experimentally observed;
- inferred;
- proposal;
- unresolved.
