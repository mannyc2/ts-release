# Effect patterns

Status: recovered research checkpoint. This document compares versioned source
and disposable compilation probes. It does not select a root ts-release API,
an aligned Effect version, or a Workflow implementation.

## Three explicit baselines

| Baseline | Package/version | Commit pin | Why it matters |
| --- | --- | --- | --- |
| ts-release shipped family | `effect@4.0.0-beta.83` and matching platform packages | `cd7ab658994104bd6fe8f841f1440bea32c387f5` (tag `effect@4.0.0-beta.83`) | This is the API and behavior current ts-release actually compiles against. |
| effect-build development family | `effect@4.0.0-rc.108` and matching platform packages | `bef7bf38ae4b73d5511043f707aed083de5da7cc` | effect-build uses this exact version in development, while its published peer range is broader. |
| current, date-and-commit pinned | package metadata still reports `4.0.0-rc.109` on 2026-08-16 | `ee06c9c1eed73ebcf282541ceb1615ff1ba1730d` | This prevents "current" from floating and tests whether a later peer-compatible candidate changes the decision. |

Additional pin:

- effect-build integration branch:
  `15c811bb9904142a33d119766b62082f3c689f13`.
- effect-build's `effect` peer range at that commit:
  `>=4.0.0-beta.104 <4.1.0-0`.
- effect-build's own compatibility script at that commit performs its full
  build/check/type/unit/fresh-consumer suite at beta.104 and rc.108. It does not
  establish rc.109 compatibility unless rc.109 is actually exercised.

The source pins are part of the claim. Package version strings alone are not
sufficient for unstable APIs.

## What the compile-only baseline probes establish

The three `probes/effect-baselines/*` packages compile the same small public
surface against beta.83, rc.108, and rc.109/current-package metadata:

- `Context.Service`;
- `Layer.effect` and ordinary Layer provision;
- `Effect.fn` / `Effect.fnUntraced`;
- one Schema class and tagged error;
- `Activity.make`;
- `exitSchema`; and
- the presence or absence of `exitSchemaPartial`.

They are compile-only probes. They do not execute retries, establish attempt
identity, prove event persistence, prove a cluster engine, or show that an
external mutation is deduplicated. Those claims require pinned source evidence
or a purpose-built runtime fault injection.

## Delta classification

Classification vocabulary:

- **Unchanged:** the relied-on law and public shape are materially the same for
  the question under review.
- **API-only change:** the intended law remains, but source syntax or public
  types used by callers changed.
- **Semantic change:** retry, encoding, identity, persistence, failure, or other
  behavior relevant to release correctness changed.

| Pattern under consideration | beta.83 -> rc.108 | rc.108 -> current pin | Evidence and consequence |
| --- | --- | --- | --- |
| `Context.Service`, `Layer.effect`, ordinary `Effect.provide` | Unchanged for the compile-only fixture | Unchanged for the fixture | All three baseline packages compile. This supports normal library/application Layer composition, not a publication abstraction. |
| Tagged Schema error constructor used by the fixture | API-only change | Unchanged in the fixture | beta.83 uses `Schema.TaggedErrorClass`; rc.108/current use `Schema.TaggedError` in the tested shape. Call sites must migrate, but the typed-boundary intent is unchanged. |
| Activity success/error Schema constraints | API-only change | Unchanged | beta.83's Activity generic uses `Schema.Top`; rc.108/current use `Schema.Constraint`. This can affect generic helper types. |
| Activity full exit Schema | Unchanged in intent | Unchanged | `exitSchema` exists in all three. This alone proves neither persistence nor replay. |
| Activity partial exit Schema | API-only and semantic surface addition | Unchanged | beta.83 lacks `exitSchemaPartial`; rc.108/current expose `Schema.Exit<..., Schema.Unknown>`. Any durable partial-exit design is unavailable on the shipped baseline without adaptation or upgrade. |
| Default interruption retry schedule | Semantic change | Unchanged at the inspected current pin | beta.83 composes exponential `4.0`, spaced 10 seconds, and 10 recurrences through `Schedule.either`; rc.108/current use `Schedule.min([exponential(400, 1.5), spaced(10s)])` and `meta.attempt <= 10`. External-write safety must not be inferred from a generic Activity label. |
| Activity retry attempt context | Unchanged in core idea | Unchanged | `CurrentAttempt` is incremented by `Activity.retry`. Whether a provider sees or enforces an idempotency key is still application/provider work. |
| Activity idempotency helper input | Unchanged in core idea | Unchanged | The helper hashes workflow execution ID, optional attempt, and supplied name. It does not cause an independent registry to honor that key. |
| Workflow execution identity | Source evidence required; not established by baseline compilation | Source evidence shows same broad payload/tag/idempotency model across rc.108/current | Reordering or renaming Activities remains an application compatibility concern. The probe does not test it. |
| Base WorkflowEngine in-memory implementation | Source evidence: present, nonpersistent test/local engine | Broad role unchanged at current pin | A passing in-memory replay test is not durable process-loss evidence. |
| Cluster WorkflowEngine implementation | Semantic/infrastructure change across the wider beta-to-rc period | Unstable implementation may move independently | Cluster can persist engine messages only through its storage/runtime. It still cannot infer an npm/PyPI/GitHub commit whose response was lost. |
| Schema decoding/encoding service requirements | API-only changes are possible across unstable versions | The relied-on boundary law remains | Durable payloads and errors must include their decoding/encoding requirements in the application Layer graph. Exact generic signatures must be compiled at the selected pin. |
| Scoped filesystem and process services | Public names/types evolved during the beta series; law broadly unchanged | Broad law unchanged | Scope can own temporary files and child processes. It does not make provider mutation transactional. |
| Effect AI provider error surface | Not used by shipped ts-release | Current adapters normalize public failures to shared `AiError` | This is evidence both for caller simplification and for lost provider-specific fidelity. Do not describe it as preserving each adapter's public error union. |
| effect-build `Provider.define` shape | Not install-compatible with beta.83 because the peer lower bound is beta.104 | rc.108 and later versions are admitted by the declared peer range, subject to real checks | A shared definition mechanism and operation shape are demonstrated. Caller-level substitution of every compiler implementation is not automatically established. |

## Effect AI: the actual normalization tradeoff

Current OpenAI and Anthropic adapters expose the shared `LanguageModel` service
and normalize public failures into `AiError`. OpenAI's internal mapping, for
example, converts transport, status, decoding, and schema failures into shared
network/invalid-output/rate-limit-style reasons while retaining selected HTTP
and provider metadata.

This yields a real benefit: generic callers can handle one error vocabulary.
It also has a cost: provider-native error classes and details that do not fit the
shared model may be reduced to metadata or lost. The lesson for ts-release is
not "always preserve provider error types" and not "always normalize." It is:

1. normalize only when callers perform the same conceptual operation;
2. specify which distinctions remain decision-relevant after normalization;
3. retain provider receipts and reconciliation fields needed for recovery; and
4. avoid a universal publication error family that erases coordinate-specific
   conflict and unknown-outcome laws.

npm publication and GitHub asset upload still do not become implementations of
one substitutable service merely because both use HTTP and both can fail.

## Concrete services, `make`, and Layers

A concrete provider/client service can be useful with one implementation. It is
ordinary dependency injection, not a claim that several providers share a
publication law.

A lawful provider package may expose some or all of:

```ts
make(options): Effect<Service, ConfigOrClientError, LowerRequirements>
layer(options): Layer<Service, ConfigOrClientError, LowerRequirements>
layerConfig(config): Layer<Service, ConfigError | ClientError, LowerRequirements>
```

The exact names are conventions, not requirements. The important boundary is:

- library functions return Effects and keep client/backend requirements visible;
- the provider package owns provider-specific configuration, client, receipt,
  and errors;
- application/CLI/Action code composes platform, credentials, provider clients,
  telemetry, and artifact access Layers; and
- tests provide fake protocol clients or service values.

No Promise facade is researched or proposed.

## Clean Node consumer probe: narrow conclusion

The fixture under `probes/custom-provider/` packs a small core fixture, an
outside provider fixture, and a Node CLI fixture. A clean temporary consumer
installs those packages with npm because npm package consumption is the product
boundary deliberately under test. Its config imports the outside package,
constructs a provider Effect, provides the outside package's Layer, and exports
an already-closed `Effect<unknown, unknown, never>`. The CLI dynamically imports
that consumer module and executes the closed Effect.

The demonstrated conclusion is exactly:

> A Node CLI can dynamically import a consumer module which has already
> supplied its own Layer and closed its Effect requirements, even though the
> CLI's core fixture did not know the outside package at build time.

The probe does not yet establish:

- a ts-release publication-provider contract;
- durable preparation or a finalized ts-release bundle;
- typed ts-release CLI reporting;
- dependency ordering;
- more than one provider in one release program;
- partial-success preservation;
- reconciliation; or
- resumability.

Those capabilities must not be inferred from the clean-consumer receipt.

## Prebuilt standalone executable probe

The separately named `probe:standalone:informational` compiles the fixture CLI
into one Bun executable and records an actual boolean:

```text
loadedUnknownProvider
```

The script now prints that outcome and can be made enforcing only by setting
`REQUIRE_STANDALONE_UNKNOWN_PROVIDER=1`. By default it is informational. A green
workflow step means the experiment executed and emitted its result; it does not
mean a sealed executable successfully loaded consumer-installed code.

Dynamic discovery by a prebuilt executable requires a loader, package
resolution, filesystem access, trust policy, and error/reporting contract. It is
separate from the open library architecture.

## effect-build evidence and non-evidence

At the pinned branch, `Provider.define` centralizes a command-provider name,
target table, option validation, argv rendering, tool discovery, stage Schema,
artifacts, errors, `compileExecutable`, `compileExecutableMatrix`, and Layer
construction. This demonstrates a useful shared provider-definition mechanism
and a common operation shape for compiler integrations that satisfy the same
executable-compilation law.

It does not automatically prove one substitutable compiler service at the
caller level. A substitution proof would need one caller program that can be
provided with at least two independently packaged compiler services without
rewriting the conceptual operation, while preserving target and result laws.
Bun, Deno, and a composed Node SEA pipeline may satisfy that narrower law;
`npm pack`, a prebuilt artifact importer, and a release publisher do not.

The effect-build branch's rc.108 development pin is not itself a reason to
select rc.108 for ts-release. Its peer range admits beta.104 through versions
below 4.1 prereleases. The validation workflow therefore runs explicit combined
candidate experiments rather than treating the development lock as an
architecture decision.

## Combined dependency-set experiment

The research workflow checks three distinct facts:

1. **Current incompatibility:** ts-release's exact beta.83 family is below
   effect-build's beta.104 peer lower bound. There is no single aligned Effect
   version in the shipped manifests.
2. **effect-build's own pinned/full compatibility suite:** the pinned
   effect-build compatibility script is executed at the endpoints it supports.
3. **Later candidate experiment:** a disposable copy aligns the ts-release
   Effect family and effect-build development references to each candidate,
   installs with Bun, runs ts-release's TypeScript check, builds/checks
   effect-build, and compiles a clean consumer import. The result is recorded
   per candidate.

Candidate failures are evidence, not CI infrastructure failures. Until one
candidate set is green under the complete agreed gate and its source deltas are
accepted, the version choice remains open.

No aligned Effect version is selected. In particular, this document does not
recommend rc.108 solely because effect-build used it during development.

## Workflow and Activity boundary

Workflow/Activity source can persist and replay encoded engine results when a
persistent engine is actually configured. It cannot make an independent
registry mutation exactly once. The critical interval remains:

```text
provider commits
-> worker loses provider response or dies
-> engine has no terminal Activity exit
```

Automatic Activity retry can then repeat application code. A provider-native
idempotency key, conditional coordinate, or reconciliation read must classify
that interval. The three baseline compile jobs do not test this behavior. See
`resumability.md` for the write-ahead law and mechanism comparison.

No Workflow/Activity implementation is included.

## Remaining decisions

Before implementation, maintainers still need to choose:

- the aligned Effect source/package pin after combined candidate validation;
- whether Workflow/Activity is in the first delivery at all;
- which operations are lawful shared services versus concrete provider clients;
- whether the stock CLI remains dynamically loadable TypeScript/Node code or a
  separately specified standalone loader is required; and
- whether any effect-build integration occurs through its public package,
  copied artifact values, or a still-smaller build-output protocol.

The evidence supports ordinary Layer composition and warns against false shared
publication abstractions. It does not select the root release API.
