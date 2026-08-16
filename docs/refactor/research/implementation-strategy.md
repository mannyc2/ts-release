# Implementation-order comparison

Status: research-only. The canonical capability ledger is `competitive-scope.md`; this document does not reduce or redefine it.

## Strategies

### A. Model and storage first

Build the complete artifact, plan, journal, provider-definition, and reporting model before exercising a live provider.

Strength:

- coherent internal vocabulary.

Risk:

- repeats the current failure mode: extensive internal proof before wire evidence;
- abstractions may encode imagined commonality;
- response-loss laws arrive late.

### B. Provider scripts first

Implement each provider directly, then generalize.

Strength:

- fastest wire contact.

Risk:

- ad hoc artifact ownership and persistence;
- incompatible provider results;
- difficult fresh-runner continuation.

### C. Durable engine first

Adopt Workflow/Activity or another durable system, then map providers into it.

Strength:

- timers, retries, persistence, and worker recovery.

Risk:

- engine retry can replay external mutations;
- activity identity can distort provider Intent identity;
- infrastructure choice freezes the model too early.

### D. Hybrid wire-complete slices

1. establish the minimum immutable bundle, canonical Intent, physical dispatch event, and CAS journal;
2. exercise npm normal success and lost response;
3. exercise Warehouse per-file success, duplicate, partial progress, and response loss;
4. generalize only the replay and observation laws demonstrated by those wires;
5. add GitHub tag/release/assets;
6. add conditional Git plus Homebrew formulas and Scoop;
7. prove a two-process arbitrary custom-provider continuation;
8. exercise the architecture-shaping artifact-production families from `competitive-scope.md`;
9. exercise OpenAI plugin package, repo marketplace, and public-submission handoff;
10. run the rewritten product's own non-manual release.

Recommendation: D.

## Why npm and Warehouse first

They expose different laws early:

```text
npm
  one composite registry document
  immutable package version
  mutable dist-tag
  weak response receipt
  useful read reconciliation

Warehouse
  one upload per distribution file
  exact duplicate same content accepted
  filename/content conflict
  per-file partial progress
```

A common model that survives both is more credible than one inferred from internal types.

## Replay implementation order

Before implementing automatic replay:

1. persist prepared request fingerprints and protection;
2. implement pure core replay decision;
3. prove compare-and-swap dispatch gating;
4. test expiry/scope/equivalence;
5. test two runners with different provider versions;
6. default unsupported provider laws to no automatic replay.

Do not implement resume-time executable replay policy.

## Consumer testing order

Consumer install/execute checks remain ordinary CI/application Effects.

Use them as acceptance evidence after the provider path exists:

- npm install/import/CLI;
- pip install/import/entrypoint;
- public GitHub binary execution;
- brew install;
- Scoop install;
- ts-release self-release.

Do not place them in the provider contract or mutation journal.

## Artifact-production order

The architecture-shaping set is not postponed until after provider completion.

A useful sequence:

1. existing executable matrix adoption;
2. archives and source archives;
3. uv/Poetry wheel and sdist integrations;
4. nFPM package integration;
5. app bundle, DMG, and pkg;
6. local signing;
7. notarization/stapling trace before final bundle lifecycle is frozen.

No universal Builder is required.

## AI-native order

1. construct the OpenAI plugin package and validate manifest/assets;
2. publish a local/repository marketplace through ordinary file/Git output;
3. produce a portal-ready public submission packet;
4. stop at validated human handoff unless OpenAI documents an automation API.

Official review and publish remain human-gated portal operations.

## Evidence gates

Each slice distinguishes:

```text
protocol double
scratch/live provider acceptance
fresh public observation
intended byte identity
clean consumer behavior
fresh-runner response-loss continuation
released self-use
```

The decisive final gate is a non-manual ts-release self-release through the rewritten product.
