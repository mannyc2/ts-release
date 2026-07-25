# Release Package Spec

## Purpose

The `release` package is a small TypeScript library for turning installable artifacts into explicit, inspectable, and repeatable package-manager distribution plans.

It should not be a fake universal package manager or a generic task runner. Its job is to model what is being distributed, which artifact variants exist, which package managers or install channels consume them, and which externally visible actions require deliberate approval.

The package should make distribution work boring: the same inputs should produce the same plan, the same staged artifacts should produce auditable inventory, and the same publish operation should be understandable before anything is executed.

## Core Idea

A distribution is a data flow:

```text
release intent
  -> normalized release model
  -> artifact recipes and inventory
  -> installable artifact variants
  -> pipe-owned publish and catalog operations
  -> generated package-manager files
  -> validation and rendering evidence
  -> approved execution
  -> post-publish verification
```

The package owns the model and the orchestration. Ecosystem tools remain the source of truth for ecosystem-specific behavior.

For example, npm, PyPI, GitHub Releases, Homebrew taps, Scoop buckets, OCI registries, app stores, or other targets may each need different manifests, commands, credentials, artifacts, and validators. The release package should describe those differences directly instead of hiding them behind one fake universal abstraction.

## Current Shape

The root package is the stable user surface. It exposes one TypeScript import
for config authoring, schema helpers, and Promise/plain-data release summaries,
plus the `ts-release` executable. The pipeline model, config loader, pipe
planners, engine, host services, and workflow modules are repository-internal
until they are deliberately promoted.
The official Bun CLI lives in `apps/release-ts`, and the GitHub Action lives in
`apps/ts-release-action`; both are runtime adapters over the same private
release engine.

Current first-party workflows cover:

- config validation and plan rendering
- explicit artifact recipe staging
- data-first init/scaffolding previews with approved writes
- static doctor/auth/CI diagnostics
- render, validation, execution, verification, and workflow evidence
- API-native GitHub release publishing and verification

Reusable configs live in `templates/`, runnable fixtures live in `examples/`, and publish operations remain data until an execute approval and any irreversible approval are supplied.

## Direction: 0.1

The 0.1 direction is a GoReleaser-shaped pipeline adapted to this package's
plan-first safety model. The engine decodes release intent once, resolves
repository identity, calls each present feature's pure resolver once, and
binds the resulting typed sections into a static ordered planner schedule:
`decode -> identity -> resolve -> build -> process -> catalog -> publish -> verify`.
Each feature owns its wire Schema, pure resolver, and typed planner. The
pipeline core knows only scheduled planners and owns the deterministic,
validated contribution fold; it never reads raw config.
The build phase declares canonical platform targets and dispatches to pure
builder adapters, with Bun, command, and prebuilt builders in 0.1.

The public 0.1 TypeScript API is Promise/plain-data: `plan`, `build`,
`release`, and `verify`, with the CLI and GitHub Action as thin wrappers.
Internally the engine remains Effect-native and returns the same public
summary types directly. Snapshot releases use the current resolved version
plus `-SNAPSHOT-{shortCommit}` and still build locally, while publish-class
operations are refused regardless of approval flags.

## Design Goals

### Plan-first

The primary output of the package is a distribution plan, not a side effect.

A plan should be serializable, reviewable, and suitable for CI artifacts. It should explain:

- release identity: name, version, commit, tag, notes, and source metadata
- canonical artifacts: kind, path, producer, checksum, and installable platform metadata
- complete operations: build, processing, catalog, publish, and verification work in original order
- validation steps: which checks must run before publishing
- execution gates: which operations are irreversible or require explicit approval
- evidence paths: where validation and publish results will be recorded

### Explicit Surface Semantics

Different distribution surfaces have different shapes. The package should model those shapes instead of flattening them.

Examples:

- A release host publish creates or updates a release record and uploads assets.
- A registry publish creates immutable package versions.
- A catalog update changes a repository or index that points at artifacts.
- A deployment promotes already-built assets into an environment.

Each surface pipe should emit operation data that declares required inputs, auth requirements, validation strategy, risk, and setup prerequisites. When auth cannot be proven locally, the operation should model the expected execution context and provider-specific setup.

### Evidence-driven workflows

Build, validation, publishing, and verification workflows should produce
structured evidence, not just console output.

Evidence should be machine-readable enough for CI and human-readable enough for debugging. It should include command invocations, tool versions where practical, exit statuses, important paths, skipped checks, warnings, failures, and timestamps.

Evidence should also preserve enough context to debug failed or interrupted releases.

Skipped or simulated checks must be explicit operation data and visible in the resulting evidence.

### Gated irreversible actions

Operations that publish immutable versions, create public releases, overwrite indexes, or otherwise affect users must be marked as irreversible or externally visible.

The default behavior should be dry-run or print-only. Execution should require an explicit execute flag, and irreversible operations should require a second confirmation flag or equivalent programmatic approval.

Failed publish evidence must not be treated as proof that nothing was published.

The package should make it hard to accidentally publish and easy to see exactly what would be published.

Approval is preflighted before any render, validation, command, network,
staging, mutation, evidence accumulator, or evidence finalizer is started.
Publish-class operations already refused by snapshot policy are excluded from
the preflight and later produce explicit refused evidence; snapshot-local
writes still require execute approval. A failed preflight therefore performs no
work and writes no evidence file.

### Effect-owned execution lifecycle

Planning, operation selection, approval analysis, artifact selection, and
content rendering remain deterministic plain code. Publish operations remain
Schema-backed plan data until approved execution begins. Effect owns the
effectful side of that boundary: typed failure channels, retry
`Schedule` interpretation, interruption, workflow finalization, service
acquisition, and runtime composition.

Each started build, release-execution, or verification workflow owns one local
`Ref<EvidenceBundle>`. The build workflow executes its build pass independently;
release execution preserves the sequential four-pass safety order. Both record
only the final outcome of each operation, never every retry attempt.
One on-exit finalizer invokes the evidence writer exactly once from that local
state on success, typed failure, defect, or interruption.

If evidence persistence fails after a successful workflow, the write failure is
returned. If the workflow and evidence persistence both fail, the full Effect
Cause preserves both in explicit write-first order as
`Cause.combine(writeCause, workflowCause)`; the write failure is primary when
collapsed without discarding the workflow failure. Evidence remains the sole,
sole `release-evidence/v3` wire contract.

Capability services capture native filesystem, path, HTTP, and process
dependencies once in their live layers, and their methods have closed
environments. Concrete product layers are composed only at the Bun CLI runtime,
the Node Action runtime, and the lazily shared `ManagedRuntime` Promise API
boundary; tests supply replacement layers at their own boundary. Engine
workflows do not construct a catch-all host bag or provide live layers
internally.

### Shared engine, small public surfaces

The core release logic should stay reusable and host-independent. The public
package can still expose both a TypeScript API and a CLI: the TypeScript API is
for typed config authoring, schema helpers, and stable summary data, while the
`ts-release` executable is the command surface for staging, planning,
publishing, verification, and diagnostics.

The internal engine should support:

- loading and normalizing config
- staging declared artifact recipes through provided adapters
- constructing a release plan
- scaffolding starter configs and CI workflows as proposed files
- rendering config schemas and validation results
- rendering catalog files or generated metadata
- validating plans and artifacts
- reporting static auth and CI readiness with confidence levels
- preparing executable operations
- running approved operations through an injected host interface
- recording evidence
- reconciling narrowly modeled remote state without replaying immutable publishes

Those engine workflows are not automatically public package subpaths. The CLI
and GitHub Action should mainly parse host inputs, call the engine, format
host-specific output, and persist evidence. A broader TypeScript execution API
should be designed deliberately before promotion.

### Host abstraction without pretending the world is pure

The package should isolate filesystem, environment, process execution, network calls, and time behind a narrow host interface where that improves testability and portability.

The host boundary should not become a full application framework. It exists so core planning logic can be deterministic and so execution can be tested without touching real registries or release hosts.

### Composable, not magical

The package should compose with existing tools rather than replace them.

Builders, packagers, changelog generators, signing tools, registry CLIs, provenance tools, and ecosystem validators should be treated as inputs or adapters. The release package should coordinate them, capture their evidence, and enforce release policy around them.

## Non-goals

The package should not try to:

- build every artifact itself or replace full build pipelines
- replace ecosystem-native publishing tools
- invent a universal package format or one manifest schema for every ecosystem
- hide surface-specific auth requirements
- guarantee semantic versioning policy for the project using it
- own changelog generation as a core requirement
- require a monorepo
- require a specific CI provider
- treat dry-run output as equivalent to successful publication

These may be integrated through focused pipes or adapters, but they should not define the core.

## Core Concepts

### Release Intent

User-authored input describing what should be released.

It should be concise but complete enough to identify the project, describe build artifacts, choose publish surfaces, and choose evidence location.

Identity may be static config data or may be derived from a package manifest. Release intent should declare project facts, optional build recipes, manual artifacts when needed, publish surfaces, and evidence location. Surface-specific policy belongs in feature-owned resolvers and reviewable operation data, not in user-authored policy matrices. Whether a project decides to bump a version from tags, commits, or human review belongs outside the generic distribution model unless it becomes a separate app-local workflow.

### Artifact Recipe

An optional, explicit staging contract for artifacts that `ts-release` can create before planning distribution.

Recipes are data until the caller runs a staging workflow. The first recipe family is Bun executable compilation, which produces executable artifacts with derived operating-system and architecture variants. Additional recipe families should land only when they provide durable distribution value without turning the core into a general build system.

### Installable Artifact Variant

Platform metadata attached to a canonical artifact.

Variants should capture facts that package-manager surfaces need to choose or render the right artifact: operating system, architecture, optional Linux libc family, executable extension, binary name, install path, and source target triple. Pipes should consume this data instead of guessing from filenames.

### Release Model

A transient resolved-release representation with identity-dependent defaults
resolved once, paths normalized, feature sections totalized, and absence
represented explicitly before any planner is scheduled.

The model should be deterministic and independent of terminal formatting or CLI flags.

### Release Plan

A Schema-backed flat `release-plan/v5` value derived once from the release
model and transient planner accumulator. It contains identity, one canonical
Artifact array, the complete ordered Operation array, source metadata,
and the evidence directory.

The plan is the contract between planning, validation, execution, and CI review. It should be stable enough to diff in tests and inspect in logs.
No durable fold carrier, duplicate inventory, hidden-operation projection, or
older plan reader is part of this contract. Evidence is independently versioned
and remains `release-evidence/v3`.

### Feature Planner

A module that owns one config section or publish surface, resolves its wire
shape into a narrow total input, and emits artifacts and operation
data from that typed input.

Planners should expose behavior through operation data: required credentials, validation commands, generated files, publish commands, risk grades, setup notes, and expected evidence.

### Operation

A concrete action that may be rendered, validated, executed, or skipped.

Operations should carry enough metadata to explain their risk level, inputs, outputs, and execution requirements.

### Evidence

Structured records produced by staging, rendering, validation, execution, and verification.

Evidence should survive outside the process as JSON or another stable format. It should be useful for CI summaries, release audits, and debugging failed publishes.
For every workflow that starts, evidence persistence is finalized exactly once
from workflow-local state on every exit, including typed failure, defect, and
interruption. The sole durable evidence contract is
`release-evidence/v3`.

## Expected Public Surface

The package should make these user workflows straightforward:

- initialize a starter config and optional CI workflow from templates
- validate config JSON and schema shape
- stage declared artifact recipes
- create a plan from config
- inspect the plan without executing anything
- render catalog files
- validate artifacts and target readiness
- report static auth and CI readiness
- produce evidence artifacts
- print publish operations
- execute approved operations
- verify published state after execution

The public npm surface should stay small: the package root TypeScript API for
typed config helpers and stable summary data, and the `ts-release` executable
for planning, publishing, verification, and diagnostics. Internal module names
should not become user-facing compatibility promises.

## Configuration Principles

Configuration should be declarative and boring.

It should describe release facts, artifacts, and publish surfaces, not arbitrary scripts. Escape hatches can exist, but they should be visible in the plan and evidence.

Good config answers:

- What is the release?
- Which artifacts and variants are part of it?
- Which publish or install surfaces receive them?
- What credentials or environment are required?
- What must be validated first?
- Which generated files or indexes will change?
- Which operations are allowed to execute in this environment?

Artifact path templates may interpolate only named release data such as `{version}`, `{name}`, `{normalizedName}`, `{targetTriple}`, and `{ext}` where the section supports platform rendering. They must be expanded before path safety and canonical artifact checks. Artifact platform metadata must be explicit data or derived by a known build adapter before catalog rendering.

## Testing Strategy

The core should be heavily testable without real external services.

Important test categories:

- config parsing and normalization
- invalid config diagnostics
- deterministic plan generation
- operation-data modeling
- dry-run behavior
- irreversible-operation gating
- evidence recording
- command construction without execution
- execution through fake host implementations
- pipe contract tests

Real integration tests can exist for official validators and sandbox registries, but the core should not depend on live services to prove its behavior.

## Success Criteria

The rewrite is successful when:

- a user can define an artifact-first distribution intent in a small config
- the package can stage declared artifacts before publish planning
- the package produces a reviewable distribution plan with no side effects
- the plan contains every planned operation and exactly one canonical artifact vocabulary
- surface differences are explicit in the plan
- installable artifact variants are available before package-manager rendering
- validation emits structured evidence
- publish operations are blocked by default
- irreversible operations require deliberate approval
- core behavior is covered with deterministic tests
- a CLI can be rebuilt as a thin adapter over the library
- a GitHub Action can run the same workflows without embedding CLI behavior
- starter templates can be checked by the same workflow path as examples
- adding a new surface does not require rewriting the core engine

## Biases

Prefer:

- explicit data over implicit conventions
- small surface pipes over a large universal abstraction
- official ecosystem validators over homegrown approximations
- deterministic planning over clever runtime discovery
- evidence artifacts over terminal-only output
- hard failures for unsafe ambiguity
- dry-run as the default mode

Avoid:

- hook-runner architecture as the core design
- hidden publish side effects during validation
- pipes or adapters that silently shell out without modeling risk
- global process state in the planning layer
- special cases that only work for one repository shape
- abstractions that erase important ecosystem differences

## Implementation Direction

Continue from the data model.

Keep the smallest set of types needed to represent release identity, artifact recipes, artifact variants, publish surfaces, operations, validation results, execution gates, and evidence. Add new pipes end to end only when they prove the abstractions carry real differences without becoming generic mush.

The implementation should stay narrow but honest:

1. Load config.
2. Stage declared artifact recipes when requested.
3. Resolve into a release model with canonical artifacts and platform metadata.
4. Fold transient planner contributions into the sole flat `release-plan/v5`.
5. Render generated files only through explicit render operations.
6. Validate with structured evidence.
7. Print executable operations.
8. Execute only when explicitly approved.
9. Verify remote state and record evidence.

Everything else should be added only after it has a clear place in that flow.
