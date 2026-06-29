# Architecture

`@mannyc1/ts-release` is artifact-first, library-first, and CLI-second.

The package turns release intent into staged artifacts, installable artifact
variants, target-specific distribution plans, evidence, and approved operations.
The CLI and GitHub Action are adapters over those workflows.

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
used by the bundled action. Action code should call public workflow APIs rather
than reaching into CLI modules.

## Current Module Taxonomy

- `domain/` contains durable schema-backed data models, typed errors, and scalar schemas owned by their semantic domain modules, such as release names in `domain/release`, target IDs in `domain/target`, artifact IDs and installable variants in `domain/artifact`, operation IDs in `domain/operation`, and evidence IDs in `domain/evidence`.
- `config/` parses and validates release config into domain values.
- `artifacts/` defines the recipe staging adapter and registry boundary. Recipes are data until a runtime provides a staging layer.
- `planner/` normalizes release intent, builds artifact inventory, carries installable variants, builds plans, renders plans, executes operation data through injected services, records evidence, and reconciles modeled remote state.
- `targets/` models ecosystem-specific target semantics and produces operation data. Target modules may describe commands and HTTP checks, but they do not execute them.
- `host/` defines injectable command and HTTP services plus live or test implementations.
- `workflows/` contains reusable application workflows over config files, init/scaffolding plans, diagnostics, evidence files, and live target/HTTP composition. This is the high-level programmatic surface.
- `apps/release-ts/src/runtime/` contains the Bun runtime shell for the official CLI app.
- `apps/release-ts/src/cli/` parses command-line flags, calls workflows, prints terminal output, and writes user-requested CLI output files.
- `apps/ts-release-action/src/runtime/` contains the Node runtime shell for the bundled GitHub Action.
- `apps/ts-release-action/src/` adapts GitHub Action inputs, outputs, step summaries, and artifact uploads to workflow calls.
- `scripts/` contains repository maintenance checks. Scripts may use app runtime layers, but they are not package library code.

## Dependency Direction

Library modules must not import from `cli/`.

The normal flow is:

```text
domain <- config
domain <- planner <- targets
domain <- artifacts
domain <- host
workflows -> config/artifacts/planner/host/targets
apps/release-ts runtime -> host/workflows/platform layers
apps/release-ts cli -> workflows/runtime boundary
apps/ts-release-action runtime -> host/workflows/platform layers
apps/ts-release-action action -> workflows/runtime boundary
```

`src/index.ts` intentionally stays empty. Public API is the explicit subpath list in `package.json`, checked by `scripts/check-package-exports.ts` and `scripts/check-tree-shaking.ts`. The only workflow aggregate is the opt-in `./workflows` facade.

## Public Workflow Surface

There is no public `./api` facade, and the root package export stays empty. The public workflow modules are named after the work they own:

- `./workflows` for the curated opt-in `Distribution`, `Config`, `Init`, `Diagnostics`, `Evidence`, and `Live` namespaces.
- `./workflows/distribution` for the artifact-first high-level distribution facade.
- `./workflows/config` for config-file release workflows.
- `./workflows/init` for data-first scaffolding previews and approved writes.
- `./workflows/diagnostics` for static config, auth, and CI readiness reports.
- `./workflows/evidence` for reusable evidence persistence.
- `./workflows/live` for runtime-neutral live target and HTTP services.

The `./workflows` facade lives at `src/workflows/index.ts` and should only re-export workflow namespaces. Use `Distribution` for the product path: stage artifacts, plan distribution, render target files, execute approved operations, verify, and reconcile. Use exact workflow leaf imports for maximum tree-shaking or direct option-class access, and lower-level `domain/`, `config/`, `planner/`, `host/`, and `targets/` subpaths when a caller needs more control than the workflow modules provide.

## Boundary Rules

- Publish operations are data until execution is explicitly approved.
- `Effect.run*` belongs at true runtime boundaries.
- Reusable effectful operations use `Effect.fn`; inline orchestration bodies use `Effect.gen`.
- Durable models, options, target variants, and typed errors use `Schema.Class`, `Schema.TaggedClass`, and `Schema.TaggedErrorClass`.
- Layers are provided at CLI, action, runtime, script, application, and test boundaries.
- Config parsing, artifact staging, distribution planning, evidence persistence, reconciliation, and approved execution are library workflows, not CLI behavior.
- Terminal formatting, argv parsing, and `--out` file writing belong in
  `apps/release-ts/src/cli/`.
- GitHub Action input parsing, output names, step summaries, and evidence artifact
  uploads belong in `apps/ts-release-action/src/`.
