# GitHub, Git catalog, and custom-provider wire models

Status: continuation of [provider-wire-models.md](./provider-wire-models.md). It is part of the same research document and has the same guardrails.

## 4. GitHub tag, release, and asset

Primary references:

- [Git refs API](https://docs.github.com/en/rest/git/refs)
- [Git tags API](https://docs.github.com/en/rest/git/tags)
- [create a release](https://docs.github.com/en/rest/releases/releases#create-a-release)
- [upload a release asset](https://docs.github.com/en/rest/releases/assets#upload-a-release-asset)

### Late-bound asset coordinate

A numeric `releaseId` and `upload_url` do not exist until a release is created or observed. A precomputed asset Intent must not pretend to know them.

Alternatives:

1. **Parent-reference coordinate:** asset Intent references the parent release Intent ID and requested public name; dispatch resolves numeric ID from the parent receipt or fresh observation.
2. **Deferred Intent creation:** create asset Intents only after the release succeeds.
3. **Predicted numeric coordinate:** persist an anticipated release ID.

Alternative 3 is invalid. Alternative 2 weakens stable planning and review. Alternative 1 preserves a complete plan while treating numeric release ID as a response binding.

**Provisional recommendation:** parent-reference coordinate, high confidence.

### Tag establishment versus release creation

GitHub release creation can reference a tag name and may establish a missing lightweight tag through `target_commitish`. An explicit tag-ref mutation and the release resource are still separately observable GitHub facts.

Alternatives:

- explicit tag Intent before release Intent;
- one composite release Intent whose provider-specific dispatch policy may create a tag;
- require the tag to preexist outside ts-release.

**Provisional recommendation:** explicit tag establishment when ts-release owns tag creation, because it gives exact commit binding and response-loss reconciliation. Confidence is moderate; the extra request and race surface are tradeoffs.

### Asset name and receipt

The upload request supplies a requested name. GitHub can normalize some names. A successful 201 response supplies:

- numeric asset ID;
- returned stored name;
- state;
- content type;
- size;
- digest when present;
- API and browser URLs.

The returned stored name is a receipt binding. It is not safe to assume it equals the local filename. A lost response requires a complete paginated listing and an explicit matching rule.

## 5. Git publication for Homebrew formulas and Scoop

Primary sources:

- [Homebrew Formula Cookbook](https://github.com/Homebrew/brew/blob/78dc68a15f167a973207437a4454381641a2f82f/docs/Formula-Cookbook.md)
- [Scoop source](https://github.com/ScoopInstaller/Scoop/tree/b588a06e41d920d2123ec70aee682bae14935939)
- [current ts-release catalog Git adapter](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/src/publication/catalog-git.ts)

A single Git commit and conditional ref update can publish several managed paths atomically within one repository. Those paths are not independent provider commit units.

Recommended separation:

```text
HomebrewFormulaRenderIntent
ScoopManifestRenderIntent
GitRefPublicationIntent
HomebrewConsumerEvidence
ScoopConsumerEvidence
```

Rendering may happen before the release plan is finalized and produces exact artifacts. The Git publication Intent refers to one exact tree or managed-path set and one expected predecessor. One ref update is one physical mutation and one provider acceptance fact.

Catalog rendering and Git publication are distinct outcomes:

- correct local Ruby or JSON bytes do not prove the remote ref moved;
- a successful ref update does not prove the formula/manifest is semantically installable; and
- one `brew install` or Scoop install does not prove another platform variant.

## 6. Arbitrary custom provider without observation

A valid custom provider may supply:

```text
versioned Intent
dispatch capability
provider-native Receipt
typed errors
```

and no exact observation.

Normal success remains `Accepted(receipt)`. If the response is lost:

- provider-enforced replay safety may authorize another request;
- otherwise the operation becomes `Inconclusive`;
- the core must not reject the provider merely because it cannot reconcile automatically.

This is an honest extension model. It exposes weaker resumability for that provider rather than weakening the entire core contract.

## 7. Receipt, observation, and consumer evidence discipline

| Fact | Source | May repeat Intent fields? |
| --- | --- | --- |
| Intent | authored and canonical plan | It is the source of desired provider, endpoint, coordinate, and artifact facts. |
| Provider-native receipt | successful mutation response | Only provider-returned facts plus references to Intent/dispatch. |
| Fresh observation | explicit provider read | Provider-returned facts and comparison result. |
| Consumer evidence | named consumer operation in named environment | Consumer result, environment, and subject; not provider mutation status. |

A receipt can be associated with an Intent without echoing its coordinate fields. The association comes from the journal's dispatch record.

## 8. Recommendations and confidence

| Recommendation | Confidence | Tradeoff |
| --- | --- | --- |
| Replace one mandatory provider lifecycle with a versioned definition plus optional capabilities. | High | A heterogeneous resolver is still needed at the application boundary. |
| Permit providers with no observation capability. | High | Lost-response completion may remain permanently inconclusive. |
| Keep consumer evidence and evidence environments outside provider admission. | High | Release policy must explicitly choose required consumer gates. |
| Use an application-supplied provider-definition resolver on every fresh runner. | High | Definition/version migration becomes an explicit operational responsibility. |
| Model initial npmjs publish as one composite Intent and later tag moves separately. | High for npmjs, medium generally | Compatible registries may implement different mutation laws. |
| Use parent Intent references for GitHub asset planning and bind release ID from a receipt/observation. | High | Dispatch resolution is more complex than storing a final numeric coordinate. |
| Treat one conditional Git ref update as the publication unit for several formula/Scoop paths. | High | Per-path progress exists only before the ref update, not as provider publication state. |

## 9. Genuine remaining choices

- Exact TypeScript shape of provider definitions and optional capability values.
- Whether the application resolver is an explicit value, a Context service, or both.
- Schema migration policy for persisted custom-provider Intents.
- Whether explicit GitHub tag creation is mandatory or a configurable provider policy.
- Exact npm-compatible registry support policy beyond npmjs.
- Which compatible Python repositories receive first-party support beyond Warehouse.
- Which consumer evidence is required for Homebrew and Scoop release completion.

## 10. Unresolved contradictions

1. A fully reviewed plan wants every provider Intent known before dispatch, while some provider coordinates contain response-bound identities such as GitHub `releaseId`. Parent references solve this structurally, but the exact plan Schema is not selected.
2. A provider with no observation endpoint is valid, yet the target resumability promise cannot always converge automatically after response loss. The product must state resumability per provider capability rather than claim universal convergence.
3. A heterogeneous runtime resolver is operationally a lookup table, but it is not an allowlist. Documentation and naming must prevent it from becoming a provider-admission registry.
4. npmjs currently co-requests an initial tag with version publication. Whether the public model exposes one composite Intent or two derived outcome facets remains a model choice, even though the physical wire fact is established.
