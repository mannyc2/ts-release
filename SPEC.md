# Release Package Spec

## Purpose

The `release` package is a small TypeScript library for turning release intent into explicit, inspectable, and repeatable publishing operations.

It should not be a build system, a package-manager wrapper, or a generic task runner. Its job is to model what is being released, where it is being published, what must be true before publication, and which irreversible actions require deliberate approval.

The package should make release work boring: the same inputs should produce the same plan, the same validations should produce auditable evidence, and the same publish operation should be understandable before anything is executed.

## Core Idea

A release is a data flow:

```text
release intent
  -> normalized release model
  -> target-specific operations
  -> validation evidence
  -> gated execution
  -> post-publish verification
  -> status and conservative resume
```

The package owns the model and the orchestration. Ecosystem tools remain the source of truth for ecosystem-specific behavior.

For example, npm, PyPI, GitHub Releases, Homebrew taps, OCI registries, app stores, or other targets may each need different commands, credentials, artifacts, and validators. The release package should describe those differences directly instead of hiding them behind one fake universal publish abstraction.

## Design Goals

### Plan-first

The primary output of the package is a release plan, not a side effect.

A plan should be serializable, reviewable, and suitable for CI artifacts. It should explain:

- release identity: name, version, commit, tag, notes, and source metadata
- artifact inventory: files, checksums, sizes, formats, and intended consumers
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

Evidence should also support status reporting and conservative resume after failed or interrupted releases.

Strict mode should fail on missing required validators. Non-strict mode may record skips, but skips must be visible in the evidence.

### Gated irreversible actions

Operations that publish immutable versions, create public releases, overwrite indexes, or otherwise affect users must be marked as irreversible or externally visible.

The default behavior should be dry-run or print-only. Execution should require an explicit execute flag, and irreversible operations should require a second confirmation flag or equivalent programmatic approval.

Failed publish evidence must not be treated as proof that nothing was published.

The package should make it hard to accidentally publish and easy to see exactly what would be published.

### Library-first, CLI-second

The core package should be a reusable library. A CLI can exist as an adapter, but it should not contain the release logic.

The library should expose APIs for:

- loading and normalizing config
- constructing a release plan
- rendering target files or generated metadata
- validating plans and artifacts
- preparing executable operations
- running approved operations through an injected host interface
- recording evidence
- reporting release status from evidence
- conservatively resuming safe unfinished work

The CLI should mainly parse arguments, call the library, and format output.

### Host abstraction without pretending the world is pure

The package should isolate filesystem, environment, process execution, network calls, and time behind a narrow host interface where that improves testability and portability.

The host boundary should not become a full application framework. It exists so core planning logic can be deterministic and so execution can be tested without touching real registries or release hosts.

### Composable, not magical

The package should compose with existing tools rather than replace them.

Builders, packagers, changelog generators, signing tools, registry CLIs, provenance tools, and ecosystem validators should be treated as inputs or adapters. The release package should coordinate them, capture their evidence, and enforce release policy around them.

## Non-goals

The package should not try to:

- build every artifact itself
- replace ecosystem-native publishing tools
- invent a universal package format
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

It should be concise but complete enough to identify the release, locate artifacts, choose targets, and declare policy.

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

The package should make these workflows straightforward:

- create a plan from config
- inspect the plan without executing anything
- render target-specific files
- validate artifacts and target readiness
- produce evidence artifacts
- print publish operations
- execute approved operations
- verify published state after execution

The API should favor explicit functions and typed data over hidden global state.

## Configuration Principles

Configuration should be declarative and boring.

It should describe release facts and target policy, not arbitrary scripts. Escape hatches can exist, but they should be visible in the plan and evidence.

Good config answers:

- What is the release?
- Which artifacts are part of it?
- Which targets receive it?
- What credentials or environment are required?
- What must be validated first?
- Which generated files or indexes will change?
- Which operations are allowed to execute in this environment?

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

- a user can define release intent in a small config
- the package produces a reviewable release plan with no side effects
- target differences are explicit in the plan
- validation emits structured evidence
- publish operations are blocked by default
- irreversible operations require deliberate approval
- core behavior is covered with deterministic tests
- a CLI can be rebuilt as a thin adapter over the library
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

## Rewrite Direction

Start from the data model.

Define the smallest set of types needed to represent release identity, artifacts, targets, operations, validation results, execution gates, and evidence. Then implement one or two target adapters end to end to prove that the abstractions carry real differences without becoming generic mush.

The first working version should be narrow but honest:

1. Load config.
2. Normalize into a release model.
3. Generate a serializable plan.
4. Validate with structured evidence.
5. Print executable operations.
6. Execute only when explicitly approved.

Everything else should be added only after it has a clear place in that flow.
