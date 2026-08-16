# Maintainer decision packet

Status: research projection. Canonical authorities are listed in `README.md`.

## Conclusions derived from laws or provider evidence

1. The shipping distribution scope is the 6 families in `competitive-scope.md`.
2. Consumer install/import/execute checks are application/CI policy, not provider capabilities.
3. `ConsumerScenario`, durable acceptance records, and `ConsumerEvidenceRecorded` are removed from the core model.
4. Replay protection is declared when the exact request is prepared and recorded before dispatch.
5. Resume-time `ReplaySafetyCapability` is removed.
6. Deterministic `ReplayAuthorized` is removed; the next `DispatchStarted` records its durable replay basis.
7. `RiskAccepted` remains because it records a new human authorization fact.
8. Observed absence cannot fence an earlier in-flight request.
9. Request status is reconciliation evidence, not replay protection.
10. Provider behavior identity and request fingerprint mismatch stop automatic replay.
11. Journal compare-and-swap is the cooperative dispatch gate for concurrent fresh runners.
12. Arbitrary providers remain ordinary packages plus Layers and a versioned durable definition.
13. The artifact kernel contains immutable content and logical artifact identity, not provider or acceptance facts.
14. No universal `Publisher`, `Builder`, or consumer-test interface is justified.
15. Public OpenAI Plugin Directory publication is a reviewed portal flow, not an assumed API provider.

## Provisional recommendations

| Topic | Recommendation | Confidence |
| --- | --- | --- |
| Replay algebra | `None`, `IdempotencyKey`, `CompareAndSwap`, `ExactDuplicateAccepted` | High |
| Replay decision | pure core projection over plan, journal, prepared request, and time | High |
| Custom opaque dispatch | automatic replay off unless using a core-supported prepared-dispatch law | High |
| Provider code identity | persist behavior ID and bind application/source/lockfile identity | High |
| Consumer tests | ordinary Effects/CI after publication; no mutation-journal persistence | High |
| Effect target | plan against exact published rc.109; no dependency change yet | Moderate |
| Implementation order | minimum kernel followed by wire-complete npm and Warehouse slices | High |
| effect-build expansion | concrete archive, uv, Poetry, nFPM, and Apple integrations; no universal Builder | High |
| Notarization | exercise before freezing finalization boundary | High |
| AI-native distribution | package + repo marketplace + validated human submission handoff | High |
| Initial competitive count | 19 outcome families: 6 distribution, 10 production/trust, 3 AI-native | Moderate |
| Deferred destination packages | 6: GitLab, Gitea, Cloudsmith, GemFury, Artifactory, Nexus | High |

## Critiques that survived

- resume-time provider code could change replay verdicts;
- a replay verdict without evidence is insufficient;
- static protection and live reconciliation are different questions;
- `DispatchStarted` should be the canonical protection record;
- consumer scenarios lacked a substitutability law and product consumer;
- aggregate green alignment jobs do not select an Effect version;
- destination packages and artifact-production capabilities require different scope accounting.

## Critiques refuted or narrowed

### "All replay safety can be decided without provider facts"

Refuted in the broad form. Core can interpret a small protection algebra, but a provider must establish at dispatch time that its exact request satisfies one scheme. The provider law still matters; it is frozen into recorded evidence rather than executed later.

### "Immutable coordinates make replay safe"

Refuted. npm immutable-version duplicates can conflict and one physical publish can also affect a mutable tag. Immutability helps reconciliation, not automatic replay.

### "Request status is replay protection"

Refuted. A request-status token can establish committed, terminal non-commit, or pending; it does not itself suppress duplicate effects.

### "A generic consumer-test capability is needed to expose clean-install checks"

Refuted. Ordinary Effect composition and CI already express the user action. No mutation or resume state depends on a provider-level interface.

## Genuine maintainer choices

- exact TypeScript shape of ProviderDefinition and prepared dispatch;
- whether core-owned HTTP/Git transports are required for built-in automatic replay;
- exact replay scheme IDs and versioning;
- durable treatment of idempotency keys considered sensitive;
- provider behavior/application identity and migration policy;
- normalized request projection rules for commands and signed requests;
- journal backend, compare-and-swap primitive, lease/takeover, and retention;
- exact npm composite Intent/result shape;
- notarization ownership and pre-finalization durability;
- which of the 13 recommended non-fixed initial outcome families must be released in vNext versus architecture-proved before release;
- exact OpenAI submission-handoff artifact and validator;
- artifact-handoff package boundary with effect-build;
- Workflow/Activity adoption timing.

## Product counts

Canonical counts are maintained in `competitive-scope.md`:

```text
fixed distribution outcomes:               6
recommended artifact production/trust:    10
recommended AI-native outcomes:            3
recommended initial total:                19
deferred destination-only packages:        6
```
