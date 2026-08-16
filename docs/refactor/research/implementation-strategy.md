# Implementation strategy comparison

Status: research-only sequencing analysis. The complete shipping scope remains fixed. This document does not authorize production implementation.

## Question

Which implementation order yields the earliest trustworthy external evidence while minimizing the risk of rebuilding another internally certified but wire-blind architecture?

## Fixed shipping scope

```text
npm
PyPI/Warehouse
GitHub Releases and assets
Homebrew formulas
Scoop
arbitrary custom providers
```

The alternatives differ only in order and evidence strategy.

## Evaluation criteria

1. earliest provider-wire evidence;
2. earliest response-loss evidence;
3. pressure against false common abstractions;
4. artifact and journal correctness;
5. custom-provider continuity;
6. Effect migration risk;
7. rework cost;
8. ability to preserve fixed scope;
9. external consumer evidence; and
10. resistance to internal checks substituting for product outcomes.

## Alternative I1: model-first kernel

Sequence:

```text
finalize complete bundle API
finalize plan
finalize journal
choose storage
possibly add Workflow/Activity
then port providers
```

### Strengths

- coherent internal vocabulary before provider duplication;
- storage and type invariants can be tested early;
- provider ports have a target.

### Counterexamples and risks

- provider facts can be guessed from current ts-release abstractions rather than wire protocols;
- a universal provider contract can harden before npm and Warehouse expose different commit units;
- physical dispatch grouping can be designed around an imaginary common request;
- local green tests can overstate release correctness;
- Workflow identity can leak into canonical release identity.

### Conclusion

Useful only for a very small kernel. High risk if extended beyond artifact ownership, canonical Intent, and event-fold laws before real provider slices.

## Alternative I2: provider-first ad hoc verticals

Sequence:

```text
implement npm directly
implement Warehouse directly
implement GitHub directly
generalize later
```

### Strengths

- earliest real wire evidence;
- provider-native receipts and failure modes remain visible;
- avoids premature common interfaces.

### Counterexamples and risks

- each provider may invent its own artifact ownership and journal semantics;
- response-loss handling can diverge;
- custom provider model arrives too late;
- source and bundle fidelity can be inconsistent.

### Conclusion

Better than a large model-first rewrite, but too little shared structure for safe resumability.

## Alternative I3: hybrid wire-complete slices

Sequence:

1. choose an aligned modern Effect target for migration planning;
2. build only the minimum artifact bundle, canonical plan, and in-memory event fold needed for one provider;
3. exercise npm normal success and response loss;
4. exercise Warehouse per-file partial progress;
5. generalize only laws shared or explicitly separated by those cases;
6. add GitHub tag/release/asset late binding;
7. add one shared conditional Git publication capability plus Homebrew formula and Scoop renderers/consumers;
8. prove a two-process arbitrary custom-provider continuation path;
9. add durable backend and concurrency/fresh-runner gates;
10. perform non-manual self-release.

### Strengths

- earliest provider evidence without discarding structural ownership;
- npm and Warehouse immediately challenge false grouping and receipt abstractions;
- GitHub challenges response-bound coordinates;
- Homebrew/Scoop challenge shared Git publication versus distinct consumer semantics;
- custom provider continuation is proven before closing the root API;
- external evidence grows with the internal model.

### Tradeoffs

- early provider slices may be refactored after shared laws become clear;
- a minimal journal/store may initially be disposable;
- migration and architecture work must remain separated enough to diagnose failures.

### Conclusion

Strongest current strategy, high confidence.

## Alternative I4: adopt a durable execution engine first

Sequence:

```text
Effect Workflow/Activity or Temporal
then encode release work as durable activities
then port providers
```

### Strengths

- timers, retries, process resumption, and UI may arrive early.

### Counterexamples

- engine retry cannot prove an npm/Warehouse/GitHub request did not commit;
- Activity names/attempts can become accidental release identity;
- provider receipt and observation laws still need an explicit journal;
- external exactly-once claims remain false without provider support.

### Conclusion

Rejected as first architecture step. An engine can be added after provider/journal laws are proven.

## Recommended wire-complete sequence

## Slice 0 - Effect migration design, not migration

Deliver:

- exact rc.109 migration inventory;
- behavior-preserving replacements for typed errors, service requirements, and Schema boundaries;
- no production dependency changes yet.

Evidence:

```text
source review
small compile probes
corrected dependency harness
```

## Slice 1 - minimal artifact/plan/history kernel

Only enough to support one real provider:

```text
content objects + logical artifact IDs
canonical release plan with provider Intents
ordered event fold
one local trusted-store implementation
```

Do not add:

```text
central artifact kinds
generic metadata bags
universal ProviderContract
Workflow/Activity
provider certification
```

Evidence:

```text
compile
in-process adversarial state fold
two-process bundle reload
```

## Slice 2 - npmjs

Exercise:

- successful native package publish;
- successful initial tag;
- response loss after request dispatch;
- version equivalent/tag different observation;
- compatible-registry identity separation;
- clean install/import/bin.

Questions forced:

- composite Intent versus separate outcome facets;
- request-known facts versus provider receipt;
- replay authority for immutable version and mutable tag.

## Slice 3 - Warehouse

Exercise:

- multiple distributions;
- one accepted file;
- one lost response;
- one proven pre-dispatch failure;
- exact duplicate and filename conflict;
- Simple API observation;
- clean install/import.

Questions forced:

- per-file progress;
- weak success receipt;
- absence versus pending indexing;
- yanked state separation.

## Slice 4 - generalization checkpoint

Only after npm and Warehouse:

- compare common capability laws;
- freeze minimum provider definition identity;
- freeze dispatch event and replay-authority vocabulary;
- reject abstractions not satisfied by both or explicitly optional.

This checkpoint may retain duplication when laws are not shared.

## Slice 5 - GitHub

Exercise:

- explicit tag establishment policy;
- release creation;
- late-bound release ID for assets;
- asset-name normalization;
- returned digest receipt;
- lost response and starter asset;
- public download when required.

Questions forced:

- parent references in canonical plans;
- one-to-many assets;
- response-bound coordinates.

## Slice 6 - shared Git, Homebrew formulas, Scoop

Exercise:

- exact renderer output;
- one commit containing one or many managed paths;
- conditional ref update;
- lost ref-update response;
- `brew install` and executable smoke;
- clean Scoop install and smoke.

Questions forced:

- one Git publication Intent versus path-level renderer facts;
- shared conditional Git capability;
- distinct provider and consumer policies.

## Slice 7 - arbitrary custom provider fresh-runner continuation

Two independent clean runners:

```text
runner A:
  load application + custom provider
  write bundle/plan
  append DispatchStarted
  exit

runner B:
  load same application + custom provider
  decode persisted Intent
  fold journal
  observe or classify Inconclusive
  continue safely
```

No built-in allowlist or sealed union may change.

## Slice 8 - durable backend and concurrency

Exercise:

- remote CAS/transactional journal;
- lease takeover;
- stale in-flight request;
- retention expiry;
- definition schema change;
- concurrent resume attempts.

## Slice 9 - non-manual self-release

The rewritten ts-release releases itself through the complete fixed scope selected for its own release, with:

- finalized bundle reuse;
- provider receipts;
- public metadata and byte evidence;
- clean consumer execution;
- one intentionally interrupted coordinate;
- no manual provider mutation.

## Evidence matrix per slice

| Slice | Structural | Protocol double | Scratch provider | Consumer | Fresh runner |
| --- | --- | --- | --- | --- | --- |
| kernel | required | n/a | n/a | local reader | required |
| npm | required | required | required | required | response-loss continuation |
| Warehouse | required | required | required | required | partial continuation |
| GitHub | required | required | required | public download/smoke as policy | required |
| Homebrew/Scoop | renderer + Git | required | scratch Git | required | required |
| custom provider | definition resolution | optional | provider-defined | provider-defined | decisive |
| self-release | all | selected faults | public | decisive | decisive |

## Why this order resists wire blindness

1. The first provider arrives before a large common provider API.
2. The second provider has a different commit unit and weak receipt, forcing optional capabilities.
3. GitHub introduces response-bound identities before the plan API is frozen.
4. Homebrew and Scoop test shared lower-level Git laws without erasing renderer/consumer differences.
5. The custom provider resume path is tested before a sealed CLI distribution is chosen.
6. Self-release terminates claims at an actual released product.

## What remains intentionally duplicated early

- npm and Warehouse provider result types;
- provider-specific observation classifications;
- request/response parsing;
- consumer scenarios;
- some test harness code.

Duplication is acceptable until a common law removes state space without erasing provider facts.

## Recommendations

| Recommendation | Confidence | Tradeoff |
| --- | --- | --- |
| Use hybrid wire-complete slices. | High | Accept planned refactoring after early evidence. |
| Freeze only artifact ownership, canonical Intent identity, and event-history laws before npm. | High | Root API remains provisional longer. |
| Add Workflow/Activity only after the explicit journal works. | High | Durable timers/UI arrive later. |
| Require scratch-provider and clean-consumer evidence before calling a provider restored. | High | Needs maintained test destinations. |
| Put custom-provider fresh-runner proof before final CLI packaging. | High | Delays sealed executable decisions. |

## Genuine maintainer choices

- Which scratch npm and Warehouse destinations are acceptable.
- Whether the Effect migration is a separate PR series or the first greenfield branch step.
- Exact durable backend introduced in Slice 8.
- Whether GitHub public binary execution is required or download/digest is enough.
- Which self-release destinations are exercised on every release versus scheduled rehearsals.

## Unresolved contradictions

1. A minimal kernel is needed before provider work, but too much kernel work recreates wire blindness. The stopping rule must be enforced in review.
2. Real response-loss injection is difficult against hosted providers without a controlled proxy. Protocol doubles are necessary but not sufficient.
3. The fixed shipping scope is complete, while vertical slices are sequential. Documentation must not mistake implementation order for reduced ambition.
