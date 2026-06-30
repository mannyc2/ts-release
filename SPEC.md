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
  -> target-specific operations
  -> generated package-manager files
  -> validation and rendering evidence
  -> approved execution
  -> post-publish verification
```

The package owns the model and the orchestration. Ecosystem tools remain the source of truth for ecosystem-specific behavior.

For example, npm, PyPI, GitHub Releases, Homebrew taps, Scoop buckets, OCI registries, app stores, or other targets may each need different manifests, commands, credentials, artifacts, and validators. The release package should describe those differences directly instead of hiding them behind one fake universal abstraction.

## Current Shape

The root package is the stable user surface. It exposes one TypeScript import
for config authoring and schema helpers, plus the `ts-release` executable. The
domain model, config loader, planners, target adapters, host services, and
workflow modules are repository-internal until they are deliberately promoted.
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

## Design Goals

### Plan-first

The primary output of the package is a distribution plan, not a side effect.

A plan should be serializable, reviewable, and suitable for CI artifacts. It should explain:

- release identity: name, version, commit, tag, notes, and source metadata
- artifact inventory: files, checksums, sizes, formats, intended consumers, and installable variants
- target operations: what each target will do and what inputs it needs
- validation steps: which checks must run before publishing
- execution gates: which operations are irreversible or require explicit approval
- evidence paths: where validation and publish results will be recorded

### Explicit target semantics

Different distribution targets have different shapes. The package should model those shapes instead of flattening them.

Examples:

- A release host publish creates or updates a release record and uploads assets.
- A registry publish creates immutable package versions.
- A catalog update changes a repository or index that points at artifacts.
- A deployment promotes already-built assets into an environment.

Each target should declare its required inputs, auth requirements, dry-run support, validation strategy, mutability rules, and recovery behavior. When auth cannot be proven locally, the target should also model the expected execution context, provider-specific setup, and setup prerequisites.

### Evidence-driven validation

Validation should produce structured evidence, not just console output.

Evidence should be machine-readable enough for CI and human-readable enough for debugging. It should include command invocations, tool versions where practical, exit statuses, important paths, skipped checks, warnings, failures, and timestamps.

Evidence should also preserve enough context to debug failed or interrupted releases.

Strict mode should fail on missing required validators. Non-strict mode may record skips, but skips must be visible in the evidence.

### Gated irreversible actions

Operations that publish immutable versions, create public releases, overwrite indexes, or otherwise affect users must be marked as irreversible or externally visible.

The default behavior should be dry-run or print-only. Execution should require an explicit execute flag, and irreversible operations should require a second confirmation flag or equivalent programmatic approval.

Failed publish evidence must not be treated as proof that nothing was published.

The package should make it hard to accidentally publish and easy to see exactly what would be published.

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
- rendering target files or generated metadata
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
- hide target-specific auth requirements
- guarantee semantic versioning policy for the project using it
- own changelog generation as a core requirement
- require a monorepo
- require a specific CI provider
- treat dry-run output as equivalent to successful publication

These may be integrated through adapters, but they should not define the core.

## Core Concepts

### Release Intent

User-authored input describing what should be released.

It should be concise but complete enough to identify the project, describe build outputs, choose publish surfaces, and choose evidence location.

Identity may be static config data or may be derived from a package manifest. Release intent should declare project facts, optional build recipes, manual artifacts when needed, publish surfaces, and evidence location. Target capability policy such as dry-run support, mutability, and recovery belongs in normalized internals and release plans, not in user-authored config. Whether a project decides to bump a version from tags, commits, or human review belongs outside the generic distribution model unless it becomes a separate app-local or target-specific adapter.

### Artifact Recipe

An optional, explicit staging contract for artifacts that `ts-release` can create before planning target distribution.

Recipes are data until the caller runs a staging workflow. The first recipe family is Bun executable compilation, which produces executable artifacts with derived operating-system and architecture variants. Additional recipe families should land only when they provide durable distribution value without turning the core into a general build system.

### Installable Artifact Variant

Platform metadata attached to an artifact intent or inventory item.

Variants should capture facts that package-manager targets need to choose or render the right artifact: operating system, architecture, optional Linux libc family, executable extension, binary name, install path, and source target triple. Target adapters should consume this data instead of guessing from filenames.

### Release Model

A normalized internal representation with defaults resolved, paths normalized, targets expanded, and invalid combinations rejected.

The model should be deterministic and independent of terminal formatting or CLI flags.

### Release Plan

A serializable plan derived from the release model.

The plan is the contract between planning, validation, execution, and CI review. It should be stable enough to diff in tests and inspect in logs.

### Target Adapter

A module that knows how to plan, validate, and execute operations for one distribution target.

Adapters should expose capabilities clearly: dry-run support, required credentials, validation commands, generated files, publish commands, and expected evidence.

### Operation

A concrete action that may be rendered, validated, executed, or skipped.

Operations should carry enough metadata to explain their risk level, inputs, outputs, and execution requirements.

### Evidence

Structured records produced by validation, rendering, execution, and verification.

Evidence should survive outside the process as JSON or another stable format. It should be useful for CI summaries, release audits, and debugging failed publishes.

## Expected Public Surface

The package should make these user workflows straightforward:

- initialize a starter config and optional CI workflow from templates
- validate config JSON and schema shape
- stage declared artifact recipes
- create a plan from config
- inspect the plan without executing anything
- render target-specific files
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

It should describe release facts and target policy, not arbitrary scripts. Escape hatches can exist, but they should be visible in the plan and evidence.

Good config answers:

- What is the release?
- Which artifacts and variants are part of it?
- Which targets or install surfaces receive them?
- What credentials or environment are required?
- What must be validated first?
- Which generated files or indexes will change?
- Which operations are allowed to execute in this environment?

Artifact path templates may interpolate only named release data such as `{version}`, `{name}`, and `{normalizedName}`. They must be expanded before path safety and artifact inventory checks. Artifact variants must be explicit data or derived by a known recipe adapter before target rendering.

## Testing Strategy

The core should be heavily testable without real external services.

Important test categories:

- config parsing and normalization
- invalid config diagnostics
- deterministic plan generation
- adapter capability modeling
- dry-run behavior
- irreversible-operation gating
- evidence recording
- command construction without execution
- execution through fake host implementations
- target adapter contract tests

Real integration tests can exist for official validators and sandbox registries, but the core should not depend on live services to prove its behavior.

## Success Criteria

The rewrite is successful when:

- a user can define an artifact-first distribution intent in a small config
- the package can stage declared artifacts before target planning
- the package produces a reviewable distribution plan with no side effects
- target differences are explicit in the plan
- installable artifact variants are available before package-manager rendering
- validation emits structured evidence
- publish operations are blocked by default
- irreversible operations require deliberate approval
- core behavior is covered with deterministic tests
- a CLI can be rebuilt as a thin adapter over the library
- a GitHub Action can run the same workflows without embedding CLI behavior
- starter templates can be checked by the same workflow path as examples
- adding a new target does not require rewriting the core planner

## Biases

Prefer:

- explicit data over implicit conventions
- small target adapters over a large universal abstraction
- official ecosystem validators over homegrown approximations
- deterministic planning over clever runtime discovery
- evidence artifacts over terminal-only output
- hard failures for unsafe ambiguity
- dry-run as the default mode

Avoid:

- hook-runner architecture as the core design
- hidden publish side effects during validation
- target adapters that silently shell out without modeling risk
- global process state in the planning layer
- special cases that only work for one repository shape
- abstractions that erase important ecosystem differences

## Implementation Direction

Continue from the data model.

Keep the smallest set of types needed to represent release identity, artifact recipes, artifact variants, targets, operations, validation results, execution gates, and evidence. Add target adapters end to end only when they prove the abstractions carry real differences without becoming generic mush.

The implementation should stay narrow but honest:

1. Load config.
2. Stage declared artifact recipes when requested.
3. Normalize into a release model with artifact inventory and variants.
4. Generate a serializable distribution plan.
5. Render generated files only through explicit render operations.
6. Validate with structured evidence.
7. Print executable operations.
8. Execute only when explicitly approved.
9. Verify remote state and record evidence.

Everything else should be added only after it has a clear place in that flow.
