# Architecture

`@mannyc1/ts-release` is artifact-first and TypeScript-native, with one public
root TypeScript API and one official `ts-release` executable.

The package turns release intent into staged artifacts, installable artifact
variants, pipe-owned distribution operations, evidence, and approved operations.
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

- `pipeline/` contains serializable release state, artifact catalog data, the one-operation grammar, pure catalog filters, template helpers, and identity helpers.
- `pipes/` owns config sections and pure planning for build, imported artifacts, catalog files, and publish surfaces. Pipe modules emit grammar operations and artifacts, but never execute them.
- `builders/` contains language/toolchain build adapters. The current adapters are Bun, command, and prebuilt; they consume pipeline types and produce build-stage operations.
- `config/` parses JSON release config, composes pipe-owned section schemas, and reports named removed-field migration errors.
- `engine/` reads config, runs pipelines, renders plans, resolves deferred file content, executes approved operations through injected services, and records evidence.
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
engine -> config/pipeline/host/internal
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

The 0.1 tree is role-based: `pipeline/` for serializable state and pure
helpers, `pipes/` for one pipe per config section or surface, `builders/` for
build tool adapters, and `engine/` for planning, rendering, evidence, and the
only operation executor.

Import direction is structural: pipes and builders may import pipeline types
only, never engine or host; engine imports pipeline plus host; apps assemble
runtime layers and run engine entry points. The stable public Promise API is a
thin root wrapper around engine summaries with a lazily shared runtime.

The build phase uses canonical `<os>-<arch>[-musl]` targets and pure builder
adapters. The 0.1 builder set is Bun, command, and prebuilt; Bun stages
artifacts in-process through structured `StageArtifactOperation` data, while
command and prebuilt make the build axis language-agnostic without changing
the kernel.

## Boundary Rules

- Publish operations are data until execution is explicitly approved.
- `Effect.run*` belongs at true runtime boundaries.
- Reusable effectful operations use `Effect.fn`; inline orchestration bodies use `Effect.gen`.
- Durable models, options, target variants, and typed errors use `Schema.Class`, `Schema.TaggedClass`, and `Schema.TaggedErrorClass`.
- Layers are provided at CLI, action, runtime, script, application, and test boundaries.
- Config parsing, artifact staging, distribution planning, evidence persistence, API-backed publishing, and approved execution are library workflows, not CLI behavior.
- Terminal formatting, argv parsing, and `--out` file writing belong in
  `apps/release-ts/src/cli/`.
- Init/scaffolding belongs in `apps/release-ts/src/cli/` and reads package
  templates from `templates/`; the template files are the gallery and the source
  of truth.
- GitHub Action input parsing, output names, step summaries, and evidence artifact
  uploads belong in `apps/ts-release-action/src/`.
