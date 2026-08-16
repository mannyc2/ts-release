# Effect patterns and alignment research

Status: research checkpoint. This document describes evidence and design constraints. It does not migrate ts-release, select the rewritten root API, or implement Effect Workflow or Activity.

## Evidence pins

| Subject | Package or source | Pin |
| --- | --- | --- |
| Current ts-release family | `effect@4.0.0-beta.83` and matching platform packages | [`cd7ab658994104bd6fe8f841f1440bea32c387f5`](https://github.com/Effect-TS/effect/tree/cd7ab658994104bd6fe8f841f1440bea32c387f5) |
| effect-build development family | `effect@4.0.0-rc.108` and matching platform packages | [`bef7bf38ae4b73d5511043f707aed083de5da7cc`](https://github.com/Effect-TS/effect/tree/bef7bf38ae4b73d5511043f707aed083de5da7cc) |
| Later candidate family | `effect@4.0.0-rc.109` and matching platform packages | [`ee06c9c1eed73ebcf282541ceb1615ff1ba1730d`](https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d) |
| effect-build integration source | exact repository state exercised by the alignment harness | [`15c811bb9904142a33d119766b62082f3c689f13`](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13) |
| Corrected alignment harness | dependency rewriting, vendored test package preservation, platform override, and phase reporting | [`d57e7e91b58683d030201d278eb96cd5acd05a21`](https://github.com/mannyc2/ts-release/commit/d57e7e91b58683d030201d278eb96cd5acd05a21) |

The effect-build peer range at the exercised pin is `>=4.0.0-beta.104 <4.1.0-0`. The current ts-release beta.83 family is therefore outside the declared combined dependency range before any source migration is considered.

## Corrected combined-candidate result

The previous rc.108 platform-version mismatch and rc.109 `@effect/bun-test` 404 were harness defects. They are not compatibility evidence. The corrected harness preserves the vendored test package, applies effect-build's required platform override, and reports attempted, completed, and failed phases separately.

Both candidates now reach the same boundary:

| Phase | rc.108 | rc.109 |
| --- | --- | --- |
| effect-build install | pass | pass |
| effect-build build | pass | pass |
| effect-build check | pass | pass |
| effect-build type tests | pass | pass |
| effect-build unit tests | pass | pass |
| effect-build clean packed-consumer tests | pass | pass |
| ts-release aligned install | pass | pass |
| ts-release aligned TypeScript check | fail | fail |

Exact phase reports from [research run 31948959001](https://github.com/mannyc2/ts-release/actions/runs/31948959001):

```text
EFFECT_ALIGNMENT_RESULT={"classification":"informational-candidate","effectVersion":"4.0.0-rc.108","shippedEffect":"4.0.0-beta.83","effectBuildPeer":">=4.0.0-beta.104 <4.1.0-0","shippedManifestsInstallCompatible":false,"fullGatePassed":false,"attemptedPhases":["effect-build install","effect-build build","effect-build check","effect-build type tests","effect-build unit tests","effect-build clean consumer","ts-release aligned install","ts-release aligned typecheck"],"completedPhases":["effect-build install","effect-build build","effect-build check","effect-build type tests","effect-build unit tests","effect-build clean consumer","ts-release aligned install"],"failedPhase":"ts-release aligned typecheck","error":"ts-release aligned typecheck: bun run check exited 2"}

EFFECT_ALIGNMENT_RESULT={"classification":"informational-candidate","effectVersion":"4.0.0-rc.109","shippedEffect":"4.0.0-beta.83","effectBuildPeer":">=4.0.0-beta.104 <4.1.0-0","shippedManifestsInstallCompatible":false,"fullGatePassed":false,"attemptedPhases":["effect-build install","effect-build build","effect-build check","effect-build type tests","effect-build unit tests","effect-build clean consumer","ts-release aligned install","ts-release aligned typecheck"],"completedPhases":["effect-build install","effect-build build","effect-build check","effect-build type tests","effect-build unit tests","effect-build clean consumer","ts-release aligned install"],"failedPhase":"ts-release aligned typecheck","error":"ts-release aligned typecheck: bun run check exited 2"}
```

The result proves that both aligned dependency sets can be installed and that effect-build's own package and consumer gates pass. It also proves that changing only manifests is insufficient for ts-release. It does not rank rc.108 against rc.109 and does not prove release-engine semantics.

## beta.83 to rc.108 or rc.109 migration surface

The two rc candidates expose essentially the same ts-release failure families. The migration is cross-cutting rather than a single renamed import.

### Primarily syntactic or type-surface changes

1. **Tagged Schema error declarations and construction.** beta.83 call sites use `Schema.TaggedErrorClass` and constructor forms that no longer match the rc surface. The migration must update declarations, `.make` usage, constructor arguments, and inferred instance fields together. A search-and-replace of the class name is not sufficient.
2. **Constructor and dual-call conventions.** A large class of `Expected 0 arguments, but got 1` errors comes from changed callable or constructor shapes. Each occurrence needs to be classified before editing because some are data constructors, some are Effect combinators, and some are Schema-generated classes.
3. **Effect service and context typing.** Existing helpers that relied on beta.83 inference produce `unknown` requirements or error channels under the rc family. Explicit service requirements, handler return types, or narrowed helper signatures may be required.
4. **Handler and matching APIs.** Catch, match, and tagged-handler call sites have changed enough that old callback shapes produce incompatible Effects or implicit `any`. This includes coordinator and reporting code where error unions are part of the product contract.
5. **Schema constraints and encoding services.** Generic helpers written against beta.83's Schema bounds need to account for rc `Constraint`, decoding services, and encoding services. This is not limited to Workflow code.
6. **Unstable CLI and test integrations.** The current application and vendored test adapter use unstable internal surfaces whose metadata and module typing changed. These should be isolated during migration rather than allowed to determine the public release API.

### Semantic changes that require design review

1. **Activity interruption retry policy.** beta.83 and the rc family use materially different default interruption schedules. This affects when the same Activity body can execute again after interruption.
2. **Partial Activity exit encoding.** rc.108 and rc.109 expose `exitSchemaPartial`; beta.83 does not. Choosing to persist partial exits would be a new design commitment, not a mechanical migration.
3. **Error-channel normalization and inference.** Fixing new `unknown` channels by widening or dying would change observable failure behavior. The migration must preserve provider-local typed failures instead.
4. **Schema service requirements.** Moving decoding or encoding requirements into or out of the Layer graph changes where durable values can lawfully be loaded.
5. **Workflow and Activity identity.** Names, attempts, and execution IDs participate in engine identity. A migration that merely makes Activity calls compile can still create duplicate or aliased execution records.

### Approximate production surface

The corrected typecheck shows migration work across the main production strata, not only research fixtures:

- `src/api/` public entry points and errors;
- `src/model/` Schema classes, canonical values, and domain errors;
- `src/publication/` provider adapters, coordinators, recovery, and reports;
- `src/release/` preparation, graph, staging, and capability code;
- `src/correction/` intent and correction flows;
- `src/platform/` services and credentials;
- `apps/release-ts/` CLI wiring; and
- tests and the vendored Bun test adapter.

The practical estimate is a repository-wide Effect migration involving dozens of source call sites and a broad test update. It should be planned as a behavior-preserving migration project, not folded into the architecture rewrite. No such migration is performed in this PR.

## Activity identity and the coordinate hazard

In the rc.108 in-memory engine, an Activity result is keyed as:

```text
workflow execution id / activity name / attempt
```

See [`WorkflowEngine.ts`](https://github.com/Effect-TS/effect/blob/bef7bf38ae4b73d5511043f707aed083de5da7cc/packages/effect/src/unstable/workflow/WorkflowEngine.ts) and [`Activity.ts`](https://github.com/Effect-TS/effect/blob/bef7bf38ae4b73d5511043f707aed083de5da7cc/packages/effect/src/unstable/workflow/Activity.ts).

That identity is an engine identity, not a release-provider coordinate. Reusing one Activity name for two different npm package versions, PyPI filenames, GitHub assets, or catalog refs inside one workflow execution can alias work when the attempt ordinal also matches. Conversely, renaming or reordering an Activity can prevent replay from finding an earlier result.

The release design therefore needs a stable logical operation ID independent of Effect's code-level Activity name:

```text
LogicalOperationId = hash(
  provider implementation identity,
  provider endpoint or namespace,
  provider-local coordinate,
  canonical intent digest
)

AttemptId = LogicalOperationId + attempt ordinal
```

The Activity name may include or reference that logical ID, but it must not be the only durable coordinate. Provider receipts and observations are indexed by the logical operation, while attempt records are indexed by `AttemptId`.

## Default interruption retry versus `Activity.retry`

The rc Activity constructor wraps its body in a default retry-on-interruption policy. At the inspected pin, that policy uses the minimum of exponential delay and a 10-second spacing, limited while the cause contains interruptions and the schedule attempt is at most 10. See the pinned [`Activity.ts`](https://github.com/Effect-TS/effect/blob/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d/packages/effect/src/unstable/workflow/Activity.ts#L145-L178).

`Activity.retry`, by contrast, wraps ordinary `Effect.retry` while explicitly incrementing `CurrentAttempt` for each application-level attempt. These are distinct mechanisms:

- constructor-level interruption retry can re-run the Activity body because execution was interrupted;
- `Activity.retry` is an explicit retry policy selected by application code and exposes an incremented attempt context;
- neither mechanism proves that a remote provider did not commit before the prior execution disappeared; and
- neither mechanism creates a provider idempotency law merely because an attempt number exists.

A provider mutation must therefore be guarded by the release journal and provider-local reconciliation before any repeated dispatch. Blindly mapping `CurrentAttempt` to a provider idempotency key is insufficient when the provider does not honor that key or when the remote coordinate is composite.

## What an explicit journal supplies

Workflow or Activity persistence can store encoded engine inputs, results, clocks, and replay positions when a persistent engine is configured. It does not infer what happened in an independent registry between remote commit and local result persistence.

The release journal supplies product facts that the engine does not:

- the canonical `Intent` for a provider-local coordinate;
- the stable `LogicalOperationId` across process and engine attempts;
- each `AttemptId`, dispatch boundary, and terminal classification;
- a provider-native `Receipt` returned by an accepted mutation;
- a `FreshObservation` used to satisfy or contradict the intent;
- a proof that a prior attempt did not commit, when a provider can supply one;
- pending and irreducibly inconclusive states; and
- the exact finalized bundle and artifact handles reused for continuation.

Workflow or Activity may later execute journal transitions. It must not replace the journal or become the source of provider truth.

## Proper effect-build improvements

The combined research identifies a few improvements that belong in effect-build because they express compiler-domain laws rather than release-provider policy:

1. A reusable compatibility harness that aligns the full Effect family, preserves local or vendored packages, applies declared overrides, and reports attempted, completed, and failed phases.
2. A stable compiler operation identity derived from compiler provider, normalized target, canonical options, tool identity, and input digest.
3. Explicit target normalization and target-law metadata shared by compiler integrations that implement the same executable-compilation operation.
4. An owned output value that carries logical output identity, byte digest, size, and a scoped reader or materializer without exposing scratch paths.
5. Clear lifetime declarations: effect-build output may be scoped to a build workspace, while a ts-release finalized bundle must survive process loss and later continuation.

The following do not belong in effect-build:

- npm, PyPI, GitHub, catalog, or object-store coordinates;
- release receipts and reconciliation classifications;
- the durable release journal;
- arbitrary publication-provider admission; or
- a universal release `Publisher` service.

## Alignment recommendation

No Effect target is selected by this checkpoint.

The corrected evidence makes rc.108 and rc.109 both credible dependency-set candidates: effect-build and its packed consumers pass, and ts-release installs with either family. The evidence does not distinguish their migration cost or runtime suitability because both stop at the same broad ts-release source migration.

Before selecting a target, maintainers should review a small migration-design change that:

1. inventories every production error family under both candidates;
2. demonstrates behavior-preserving replacements for Schema errors, service inference, handlers, and CLI/test boundaries;
3. compares semantic source deltas relevant to retry, identity, and persistence; and
4. runs the complete ts-release gate without implementing the architecture rewrite.

Choosing rc.108 merely because effect-build develops against it is unsupported. Choosing rc.109 merely because it is later is also unsupported. If maintainers require a candidate to investigate first, rc.109 is a reasonable freshness-first investigation target, but that is a sequencing preference, not an architecture recommendation.

## Narrow conclusions retained from the probes

- The beta.83, rc.108, and rc.109 baseline packages prove only that a small public surface compiles.
- The clean Node consumer proves dynamic import of a consumer module that supplied its own Layer and exported an already-closed Effect. It does not prove a ts-release provider contract, durable preparation, typed CLI reporting, multi-provider orchestration, or resumability.
- The standalone executable experiment remains informational and currently reports `loadedUnknownProvider: false`.
- No Workflow or Activity implementation is included in this checkpoint.
