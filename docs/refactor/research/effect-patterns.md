# Effect patterns and alignment research

Status: research checkpoint. This document records the corrected alignment evidence, migration surface, Activity identity and retry laws, and the boundary between Effect execution and ts-release durable history. It does not migrate Effect or implement Workflow/Activity.

## Evidence pins

| Subject | Pin |
| --- | --- |
| Current ts-release Effect family | [`cd7ab658994104bd6fe8f841f1440bea32c387f5`](https://github.com/Effect-TS/effect/tree/cd7ab658994104bd6fe8f841f1440bea32c387f5), `effect@4.0.0-beta.83` |
| rc.108 candidate | [`bef7bf38ae4b73d5511043f707aed083de5da7cc`](https://github.com/Effect-TS/effect/tree/bef7bf38ae4b73d5511043f707aed083de5da7cc) |
| rc.109 candidate | [`ee06c9c1eed73ebcf282541ceb1615ff1ba1730d`](https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d) |
| Exercised effect-build source | [`15c811bb9904142a33d119766b62082f3c689f13`](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13) |
| Mechanical harness correction | [`d57e7e91b58683d030201d278eb96cd5acd05a21`](https://github.com/mannyc2/ts-release/commit/d57e7e91b58683d030201d278eb96cd5acd05a21) |

The exercised effect-build peer range is `>=4.0.0-beta.104 <4.1.0-0`. The shipped beta.83 family is outside that combined range before source migration is considered.

## Corrected candidate result

The former rc.108 platform mismatch and rc.109 `@effect/bun-test` 404 were harness defects. The corrected harness preserves the vendored test package, applies effect-build's platform override, propagates runtime failures, and reports attempted, completed, and failed phases separately.

| Phase | rc.108 | rc.109 |
| --- | --- | --- |
| effect-build install | pass | pass |
| effect-build build | pass | pass |
| effect-build check | pass | pass |
| effect-build type tests | pass | pass |
| effect-build unit tests | pass | pass |
| effect-build clean packed consumers | pass, 14/14 | pass, 14/14 |
| aligned ts-release install | pass | pass |
| aligned ts-release TypeScript check | fail | fail |

Exact outputs are retained in [research run 31950649319](https://github.com/mannyc2/ts-release/actions/runs/31950649319).

The result proves that both aligned dependency sets install and that effect-build's package and consumer gates pass. It proves that a manifest-only alignment is insufficient for ts-release. It does not rank the candidates and does not prove release-engine semantics.

## beta.83 to rc.108/rc.109 migration surface

The two rc candidates expose substantially the same ts-release failure families. The migration is repository-wide.

### Primarily syntactic or type-surface changes

1. **Schema tagged errors and generated construction.** Tagged error declarations, generated constructors, `.make` calls, and instance field inference must move together.
2. **Constructor and dual-call conventions.** Many old call sites now report argument-count or callback-shape errors. Each occurrence must be classified rather than mass-replaced.
3. **Effect service and context inference.** Helpers that relied on beta.83 inference produce `unknown` requirements or errors under the rc family.
4. **Catch, match, and tagged handlers.** Coordinator and provider error unions need behavior-preserving handler updates.
5. **Schema constraints and services.** Generic code must account for rc `Constraint`, decoding services, and encoding services.
6. **CLI, Action, and test integrations.** Unstable CLI and test surfaces changed and should be isolated rather than allowed to define public release architecture.

### Semantic changes that require review

1. **Activity interruption retry policy.** The default interruption schedule changed between beta.83 and the rc family.
2. **Partial Activity exits.** The rc family exposes partial exit schema support that beta.83 lacks. Persisting partial exits would be a design decision, not a mechanical migration.
3. **Unknown error normalization.** Fixing new `unknown` channels by widening or dying would alter provider-local typed failure behavior.
4. **Schema service placement.** Moving encoding or decoding requirements changes where durable values can lawfully be loaded.
5. **Workflow and Activity identity.** Making code compile does not prove that replay identity remains correct.

### Approximate affected production surface

- `src/api/` public entry points and errors;
- `src/model/` schemas, canonical values, and domain errors;
- `src/publication/` provider adapters, coordinators, recovery, and reports;
- `src/release/` preparation, graph, staging, and capability code;
- `src/correction/` correction intent and flows;
- `src/platform/` services and credentials;
- `apps/release-ts/` CLI wiring;
- GitHub Action application code; and
- tests plus the vendored Bun test adapter.

The practical estimate remains dozens of production call sites plus broad tests. The migration should be a behavior-preserving project separate from the architecture implementation.

## Activity execution identity hazard

At the inspected rc pins, the in-memory engine keys Activity execution results from:

```text
workflow execution ID / Activity name / attempt
```

Sources:

- [rc.109 Activity](https://github.com/Effect-TS/effect/blob/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d/packages/effect/src/unstable/workflow/Activity.ts)
- [rc.109 WorkflowEngine](https://github.com/Effect-TS/effect/blob/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d/packages/effect/src/unstable/workflow/WorkflowEngine.ts)

That is engine execution identity. It is not provider operation identity.

Reusing one Activity name for two npm versions, Warehouse filenames, GitHub assets, Homebrew formula publications, Scoop publications, or custom-provider coordinates can alias work when attempt numbers also match. Renaming or reordering Activities can conversely prevent replay from finding an earlier result.

The release operation identity is derived directly from one canonical provider Intent:

```text
OperationId = hashCanonical(
  "ts-release/provider-intent/v1",
  canonicalEncodedIntent
)
```

There is no serialized LogicalOperation object that repeats provider, endpoint, coordinate, artifacts, or desired facts. Activity names may include the derived operation ID, but Activity identity is never the provider source of truth.

## Default interruption retry versus Activity.retry

The Activity constructor wraps its body in a default retry-on-interruption policy. At the inspected rc pins, that policy retries interruption causes under a bounded schedule.

`Activity.retry` is a separate wrapper around ordinary `Effect.retry` that increments `CurrentAttempt` for application-selected retries.

These mechanisms differ:

- constructor-level interruption retry can re-execute an Activity body after interruption;
- `Activity.retry` increments the explicit attempt context for an application retry policy;
- neither proves that an external provider did not commit;
- neither creates an idempotency guarantee for npm, Warehouse, GitHub, Git, or a custom provider; and
- neither is the canonical ts-release attempt history.

A provider mutation may run only after the ts-release journal has atomically appended its write-ahead dispatch event. Re-execution after interruption must first fold the journal and reconcile provider facts.

## What the explicit journal supplies

Effect Workflow/Activity may persist engine inputs, results, clocks, suspension, and replay position when backed by an appropriate engine. It does not infer what happened between remote provider commit and local result persistence.

The ts-release release plan and event journal supply:

- the canonical provider Intent;
- operation identity derived from Intent bytes;
- dependency edges among Intents;
- each write-ahead dispatch event;
- grouping of several Intents under one physical dispatch ID;
- provider-native receipt events;
- fresh observation events;
- proof-of-noncommit events;
- pending, conflict, absent-retryable, and inconclusive evidence;
- explicit risk-bearing retry authorization;
- finalized bundle linkage; and
- consumer evidence.

Current state is a deterministic fold of plan plus ordered events. The journal does not store state, attempts, terminal facts, observations, and evidence as parallel authoritative peers.

Workflow/Activity may execute commands that append and fold this history. It does not replace it.

## Effect patterns supported for the rewrite

### Typed provider failures

Provider-specific failures remain typed in the Effect error channel. Migration fixes must not silently widen them to `unknown` or convert expected failures into defects.

### Layers at boundaries

Providers, credentials, HTTP, process execution, Git, bundle storage, and journal storage should be supplied through Layers at application boundaries. Provider packages can close their own requirements for dynamic loading without a central provider registry.

### Scoped resource ownership

Temporary materializations, subprocess resources, and producer scratch outputs are scoped. Finalized release bundle bytes are durable and outlive the producer scope. Scope is therefore part of the API law, not only cleanup syntax.

### Lazy Effects

Preparation, observation, and dispatch remain lazy Effects. Constructing an Intent or plan does not perform I/O or acquire credentials.

### Schema at persistence boundaries

Canonical plan, journal events, provider receipts, observations, and consumer evidence are decoded at durable boundaries with explicit excess-property and canonical-encoding rules.

## Improvements that belong in effect-build

The shared compiler-domain laws support these generic improvements in effect-build:

1. **Owned output readers.** Return logical output metadata plus a scoped reader/materializer rather than exposing only an absolute scratch path.
2. **Canonical output identity values.** Reuse safe digest, byte-count, target, and logical producer values where the laws are exact.
3. **Compiler operation identity.** Derive identity from compiler provider, normalized target, canonical options, tool identity, and input digest.
4. **Explicit lifetime declarations.** State whether an output is build-scoped or transferred to a durable owner.
5. **Alignment tooling.** Keep a reusable full-family compatibility harness that preserves vendored/local packages and reports phase boundaries honestly.

The following do not belong in effect-build:

- npm, Warehouse, GitHub, Homebrew, Scoop, or custom release coordinates;
- release-provider receipts and observations;
- the ts-release release plan or journal;
- risk-bearing provider retry authority;
- consumer installation evidence; or
- a universal release Publisher service.

## Alignment recommendation

No Effect target is selected by this checkpoint.

Both rc.108 and rc.109 are credible dependency-set candidates. Both pass the same effect-build gates and stop at the same broad ts-release source migration. Current evidence does not establish lower migration cost or better release semantics for either.

Before selecting a target, maintainers should review a behavior-preserving migration design that:

1. inventories production error families under both candidates;
2. demonstrates replacements for Schema errors, services, handlers, and CLI/test boundaries;
3. compares semantic source deltas relevant to interruption, attempt context, encoded exits, and replay identity; and
4. runs the complete ts-release gate without beginning production architecture implementation.

Choosing rc.108 because effect-build develops against it is unsupported. Choosing rc.109 merely because it is later is also unsupported. Investigating rc.109 first is a sequencing preference, not an architecture decision.

## Shipping scope relationship

The fixed shipping rewrite scope is:

- npm;
- PyPI/Warehouse;
- GitHub Releases and assets;
- Homebrew formulas;
- Scoop; and
- arbitrary custom providers.

Effect migration and Workflow/Activity adoption must serve this scope. They must not reopen it or substitute a smaller provider sample as the shipping product definition.

## Probe conclusions retained

- The beta.83, rc.108, and rc.109 baseline packages prove only that a small public surface compiles.
- The corrected alignment harness proves equal dependency and effect-build gate reach for rc.108 and rc.109, ending at ts-release migration.
- The clean Node consumer proves dynamic import of a consumer module that supplied its own Layer and exported an already-closed Effect. It does not prove the full provider contract or durable recovery.
- The standalone executable experiment remains informational and reports `loadedUnknownProvider: false`.
- No Workflow or Activity implementation is included.

## Genuine remaining choices

- rc.108 versus rc.109 after the migration-design review;
- whether Workflow/Activity is included in the first delivery;
- how unstable CLI/test dependencies are isolated or replaced;
- exact Layer boundaries for journal and bundle storage; and
- whether narrow shared output values remain duplicated or move into effect-build or a small independent package.

The shipping provider scope is not a remaining choice.
