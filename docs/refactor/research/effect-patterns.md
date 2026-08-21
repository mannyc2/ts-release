# Effect version and architecture research

Status: research and design checkpoint. This document preserves historical
candidate evidence and records the current aligned-beta implementation
decision. It does not select Workflow/Activity or a Promise root API.

## 1. Evidence pins

| Baseline | Version | Commit |
| --- | --- | --- |
| shipped ts-release family | `4.0.0-beta.83` | [`cd7ab658994104bd6fe8f841f1440bea32c387f5`](https://github.com/Effect-TS/effect/tree/cd7ab658994104bd6fe8f841f1440bea32c387f5) |
| effect-build development family | `4.0.0-rc.108` | [`bef7bf38ae4b73d5511043f707aed083de5da7cc`](https://github.com/Effect-TS/effect/tree/bef7bf38ae4b73d5511043f707aed083de5da7cc) |
| published later candidate | `4.0.0-rc.109` | [`ee06c9c1eed73ebcf282541ceb1615ff1ba1730d`](https://github.com/Effect-TS/effect/tree/ee06c9c1eed73ebcf282541ceb1615ff1ba1730d) |
| date-pinned current source, 2026-08-16 | package still reports `4.0.0-rc.109` | [`397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6`](https://github.com/Effect-TS/effect/tree/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6) |
| selected current beta, 2026-08-21 | `4.0.0-beta.107` | [`3c495ae7c96d43bfc3b8020250562a194c2c895e`](https://github.com/Effect-TS/effect/tree/3c495ae7c96d43bfc3b8020250562a194c2c895e) |
| effect-build granular branch | peer range `>=4.0.0-beta.104 <4.1.0-0` | [`15c811bb9904142a33d119766b62082f3c689f13`](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13) |

The shipped beta.83 family is outside effect-build's declared peer range.

## 2. Corrected alignment result

The corrected harness demonstrates:

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

The previous rc.108 platform mismatch and rc.109 `@effect/bun-test` 404 were harness defects.

This result separates:

- dependency-set installation compatibility: established for both candidates;
- effect-build package behavior under its own gates: established for both candidates;
- ts-release source compatibility: not established; both require migration;
- release semantics: not established by the harness.

Primary evidence:

- [corrected harness commit](https://github.com/mannyc2/ts-release/commit/d57e7e91b58683d030201d278eb96cd5acd05a21)
- [research run 31954375253](https://github.com/mannyc2/ts-release/actions/runs/31954375253)

## 3. Failure-class comparison

A green or red aggregate job is not enough. The candidate comparison separates these failure families.

| Failure family | beta.83 -> rc candidates | Candidate distinction |
| --- | --- | --- |
| dependency declarations | beta.83 outside effect-build peer range | rc.108 and rc.109 both satisfy range |
| test adapter/package availability | harness must preserve vendored `@effect/bun-test` | corrected for both |
| duplicate/misaligned Effect installs | family must be overridden consistently | corrected for both |
| ts-release source migration | broad compile failures | both fail at same phase |
| semantic Workflow/Activity changes | beta.83 differs | rc.108, rc.109, and current inspected Activity source match |
| unstable API future risk | present | current commit remains rc.109 but unstable modules can change |

## 4. Migration surface

### Primarily syntactic or type-system migration

- `Schema.TaggedErrorClass` and generated constructor shapes;
- `.make` versus direct constructors;
- changed callable/dual-call conventions;
- `Context.Service` and inferred requirements;
- `Effect` error channels inferred as `unknown`;
- catch, match, and tagged-handler call shapes;
- Schema generic bounds and Constraint types;
- encoding and decoding service requirements;
- unstable CLI and test adapter imports.

Affected production strata include:

```text
src/api
src/model
src/platform
src/publication
src/release
src/correction
apps/release-ts
apps/ts-release-action
tests and test adapters
```

This is a repository-wide behavior-preserving migration, not a manifest edit.

### Semantic changes requiring review

- default Activity interruption retry schedule;
- partial Activity exit encoding;
- Activity identity and attempt behavior;
- error normalization choices;
- Schema service requirements at durable boundaries;
- unstable workflow engine persistence semantics.

## 5. Version delta table

| Pattern | beta.83 | rc.108 | rc.109 | current `397bf1e` | Classification |
| --- | --- | --- | --- | --- | --- |
| `Effect.fn` / `Effect.gen` workflows | present | present | present | present | largely unchanged |
| Layer provision at app boundary | present | present | present | present | largely unchanged |
| scoped filesystem/process resources | present | present | present | present | API/type migration possible |
| Schema constraint surface | older bounds | `Schema.Constraint` family | same inspected surface | same inspected surface | API/type change |
| Activity `exitSchemaPartial` | absent | present | present | present | semantic capability change |
| default interruption retry | different schedule construction and timing | min(exponential 400ms, spaced 10s), bounded by attempt <= 10 | same source hash as rc.108 | same source hash | semantic change beta -> rc |
| `Activity.retry` attempt context | present | present | present | present | semantics need source review |
| in-memory Activity cache key | execution/name/attempt | execution/name/attempt | same | same inspected source | identity hazard unchanged among rc candidates |
| Workflow persistent engine | unstable/in-memory + cluster source | unstable | unstable | unstable | infrastructure and compatibility risk |
| Effect AI provider metadata/error normalization | older generation | rc generation | rc generation | current expanded docs/source | common-service pattern, not provider proof |
| Effect SQL backend extensions | present | present | present | current source explicit | common core + backend extension pattern |

## 6. Target decision

Production work aligns every Effect-family runtime and test package exactly on
`4.0.0-beta.107`, the npm `beta` dist-tag value observed on 2026-08-21. The
repository's binding instructions require aligned beta versions; the current
`rc.111` dist tag therefore does not override this choice. `latest` remains the
v3 line and is never used as an implicit v4 selector.

The implementation migration must update the entire install graph and lockfile
in one slice and pass compile, unit, package-export, and clean packed-consumer
gates. Historical rc.108/rc.109 probes remain useful migration evidence but are
not production-version authority.

Primary package evidence:

- https://www.npmjs.com/package/effect?activeTab=versions
- https://www.npmjs.com/package/@effect/platform-bun?activeTab=versions
- https://www.npmjs.com/package/@effect/platform-node?activeTab=versions

### Alternatives

#### Target beta.83

**Strength:** avoids a separate migration before rewrite work.

**Counterexample:** effect-build's peer range excludes beta.83, and the rewrite would be built on a version already requiring replacement for its selected build dependency.

**Conclusion:** rejected.

#### Target rc.108

**Strength:** exact effect-build development pin; full effect-build gates pass.

**Counterexample:** rc.109 passes the same gates, and no evidence shows rc.108 has lower ts-release migration cost or safer semantics.

#### Target rc.109 published commit `ee06c9c...`

**Strength:** later published candidate; full effect-build gates pass; current upstream package version remains rc.109.

**Tradeoff:** current source has advanced beyond the published commit while retaining the same version, demonstrating unstable-source drift.

#### Target current date-pinned commit `397bf1e...`

**Strength:** freshest source evidence; inspected Activity source has the same hash as rc.108/rc.109; closest to upstream direction.

**Tradeoff:** depending directly on a Git commit rather than a published package complicates consumers and reproducibility.

The former provisional rc.109 recommendation is superseded by the aligned-beta
decision above. Workflow/Activity remains outside the first implementation;
version selection does not make it the release kernel.

## Continued research

The remaining sections continue in [effect-architecture-patterns.md](./effect-architecture-patterns.md).
