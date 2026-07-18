# Architecture

`@mannyc1/ts-release` is artifact-first and TypeScript-native, with one public
root TypeScript API and one official `ts-release` executable.

The package turns release intent into staged canonical artifacts, installable
platform metadata, a complete canonical plan, evidence, and approved operations.
The CLI and GitHub Action are adapters over the same private release engine.

## Target Boundary

The intended repository shape separates reusable library code from the
first-party release application:

```text
src/                 reusable TypeScript release library
apps/release-ts/     official CLI app, Bun runtime shell, and self-release dogfood
apps/ts-release-action/
                     official JavaScript action app and Node runtime shell
scripts/             repo-wide maintenance gates only
examples/            reusable release config examples
templates/           shipped starter configs and CI workflow text
```

`src/` contains generic library code only. It may require platform services
such as `FileSystem`, `Path`, `ReleaseCommandRunner`, `ReleaseHttp`, or
`HttpClient`, but it must not provide the concrete Bun runtime for the official
CLI.

`apps/release-ts/` owns argv parsing, terminal output, Bun runtime assembly,
standalone CLI compilation, and self-release policy/config. A module consumed
only by the official CLI or self-release dogfood belongs in `apps/release-ts/`
unless it is made generic and documented as public library API.

`apps/ts-release-action/` owns GitHub Action input parsing, GitHub step-summary
and output adapters, evidence artifact upload, and the Node runtime assembly
used by the bundled action. Action code may import private root source modules,
but it must not reach into CLI modules.

## Current Module Taxonomy

- `pipeline/` contains planner contracts, the private transient accumulator,
  the canonical `release-plan/v3` Schema, canonical Artifact and Operation
  grammars, template helpers, and identity helpers. It never imports config or
  concrete features.
- `pipes/` owns wire section Schemas, pure once-per-release resolvers, and typed planning for build, imported artifacts, catalog files, and publish surfaces. Feature modules emit grammar operations and artifacts, but never execute them.
- `builders/` contains language/toolchain build adapters. The current adapters are Bun, command, and prebuilt; they consume pipeline types and produce build-stage operations.
- `config/` parses JSON release config, composes pipe-owned section schemas, and reports named removed-field migration errors.
- `engine/` decodes config once, resolves identity and feature sections, binds the static planner schedule, renders plans, resolves deferred file content, executes approved operations through injected services, and records evidence.
- `host/` defines injectable command and HTTP services plus live implementations. Test fakes live under `test/`.
- `workflows/` contains internal reusable workflows that remain outside the public package subpaths, currently doctor diagnostics.
- `apps/release-ts/src/runtime/` contains the Bun runtime shell for the official CLI app.
- `apps/release-ts/src/cli/` parses command-line flags, calls the engine/workflows, owns init scaffolding over shipped templates, prints terminal output, and writes user-requested CLI output files.
- `apps/ts-release-action/src/runtime/` contains the Node runtime shell for the bundled GitHub Action.
- `apps/ts-release-action/src/` adapts GitHub Action inputs, outputs, step summaries, and artifact uploads to engine calls.
- `scripts/` contains repository maintenance checks. Scripts may use app runtime layers, but they are not package library code.

## Dependency Direction

Library modules must not import from `cli/`.

The normal flow is:

```text
config -> builders/pipes/pipeline
builders -> pipeline
pipes -> pipeline
pipeline -> pipeline-local modules
engine composition -> config/pipes/pipeline/host/internal
workflows -> config/engine/host
apps/release-ts runtime -> host/platform layers
apps/release-ts cli -> engine/workflows/templates/runtime boundary
apps/ts-release-action runtime -> host/platform layers
apps/ts-release-action action -> engine/workflows/runtime boundary
```

`src/index.ts` is the only public TypeScript API entrypoint. `package.json`
also exposes the `ts-release` executable. Public API policy is checked by
`scripts/check-package-exports.ts` and `scripts/check-tree-shaking.ts`.

## Public Package Surface

There is no public `./api` facade and no public internal taxonomy. The package
does not export `pipeline/`, `pipes/`, `builders/`, `config/`, `engine/`, `host/`,
`artifacts/`, or `workflows/` subpaths.

The root export is for config authoring plus the Promise/plain-data API:
`plan`, `build`, `release`, and `verify`. Bare `release()` is plan-only; callers
must pass execution approvals before operations run. The `ts-release`
executable remains the public command surface for terminal workflows.

## Direction: 0.1

The 0.1 tree is role-based: `pipeline/` for typed planner contracts,
deterministic transient folding, the canonical durable plan, and pure helpers; `pipes/` for one
feature resolver/planner per config section or surface; `builders/` for
build tool adapters, and `engine/` for planning, rendering, evidence, and the
only operation executor.

Import direction is structural: pipes and builders may import pipeline types
only, never engine or host; only the named engine resolution/schedule
composition modules import concrete features; apps assemble
runtime layers and run engine entry points. The stable public Promise API is a
thin root wrapper around engine summaries with a lazily shared runtime.

A Winget-style surface therefore adds one feature module, one config Schema
composition entry, and one ordered scheduling entry. It does not change the
pipeline runner, canonical plan model, or executor; this is a small explicit
central schedule touch, not dynamic registration.

The build phase uses canonical `<os>-<arch>[-musl]` targets and pure builder
adapters. The 0.1 builder set is Bun, command, and prebuilt; Bun stages
artifacts in-process through structured `StageArtifactOperation` data, while
command and prebuilt make the build axis language-agnostic without changing
the kernel.

## Canonical Plan Boundary

Planning folds contributions through one private, non-Schema accumulator. It
contains identity, canonical artifacts, operations, and notices only while the
workflow is running. The accumulator is never encoded, exported, or used as a
split/merge checkpoint.

The completed durable value is the flat Schema-backed `ReleasePlan` with
`schemaVersion: "release-plan/v3"`, `identity`, `artifacts`, `operations`,
`notices`, `source`, and `evidenceDirectory`. Artifact is single-homed: no
inventory projection invents formats, consumers, downloads, variants, or byte
sizes. Every planned operation remains visible; build/release selectors choose
execution work without rewriting the plan.

Synchronous repository scripts and Effect workflows decode through the same
strict v3 Schema. There is no older-plan reader, document DTO, output alias, or
hidden-stage projection. Evidence remains the independent sole
`release-evidence/v2` contract.

## Execution and Runtime Boundary

Planning, pass selection, artifact selection, approval analysis, and content
rendering remain deterministic plain functions. Effect begins at reusable
effectful workflows and owns typed failures, interruption, retry, finalization,
service acquisition, and runtime composition. Planned publish operations remain
Schema data until the execution boundary has accepted the required approvals.

`RetryPolicy` stays visible in operation data and is interpreted as an Effect
`Schedule`. Only the typed failed-attempt channel is retryable; native service
failures, defects, and interruption retain their own channels. Execution keeps
one workflow-local `Ref` of evidence and appends only each operation's final
outcome while preserving the sequential four-pass safety order.

Approval is preflighted before the evidence `Ref` or finalizer is created and
before any render, validation, command, HTTP, staging, or mutation side effect.
Publish-class operations refused by snapshot policy are excluded from that
preflight and later produce their normal refused records; snapshot-local writes
still require execute approval.

Once a workflow starts, one on-exit finalizer reads its local state and invokes
the evidence writer exactly once on success, typed failure, defect, or
interruption. If workflow and evidence writes both fail, their causes are kept
in explicit write-first order with
`Cause.combine(writeCause, workflowCause)`: the write failure remains primary
while the workflow failure remains available for diagnostics. The durable wire
format is still the sole, unchanged `release-evidence/v2` contract.

Live capability layers acquire native filesystem, path, HTTP, and process
services once, then expose methods with closed environments. Product workflow
layers are composed at the Bun CLI runtime, the Node Action runtime, and the
lazily shared `ManagedRuntime` Promise API boundary; tests replace those layers
at their own boundary. Engine workflows neither assemble a catch-all host bag
nor provide concrete layers internally.

## Boundary Rules

- Publish operations are data until execution is explicitly approved.
- `Effect.run*` belongs at true runtime boundaries.
- Reusable effectful operations use `Effect.fn`; inline orchestration bodies use `Effect.gen`.
- Pure planning, selection, approval analysis, and rendering helpers remain
  deterministic plain code.
- Durable models, options, target variants, and typed errors use `Schema.Class`, `Schema.TaggedClass`, and `Schema.TaggedErrorClass`.
- The durable plan is `release-plan/v3`; planning state is private and transient.
- Action plan outputs are `operation_count`, `irreversible_operation_count`,
  and `surface_count`, all derived from the complete plan.
- Product workflow layers are provided only at the Bun CLI, Node Action, lazy
  Promise API runtime, and test boundaries. Repository maintenance scripts
  provide only their narrow script-local platform layers at their entrypoints.
- Config parsing, artifact staging, distribution planning, evidence persistence, API-backed publishing, and approved execution are library workflows, not CLI behavior.
- Terminal formatting, argv parsing, and `--out` file writing belong in
  `apps/release-ts/src/cli/`.
- Init/scaffolding belongs in `apps/release-ts/src/cli/` and reads package
  templates from `templates/`; the template files are the gallery and the source
  of truth.
- GitHub Action input parsing, output names, step summaries, and evidence artifact
  uploads belong in `apps/ts-release-action/src/`.
