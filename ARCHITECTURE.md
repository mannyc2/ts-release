# Architecture

`@mannyc1/ts-release` is library-first and CLI-second.

The package turns release intent into typed data, plans, evidence, and approved operations. The CLI is only an argv, console, and terminal-file adapter over those workflows.

## Module Taxonomy

- `domain/` contains durable schema-backed data models and errors.
- `config/` parses and validates release config into domain values.
- `planner/` normalizes release intent, builds plans, renders plans, executes operation data through injected services, records evidence, reports status, resumes safe work, and reconciles remote state.
- `targets/` models ecosystem-specific target semantics and produces operation data. Target modules may describe commands and HTTP checks, but they do not execute them.
- `host/` defines injectable command and HTTP services plus live or test implementations.
- `workflows/` contains reusable application workflows over config files, evidence files, and live target/HTTP composition. This is the high-level programmatic surface.
- `runtime/` contains runtime-specific layer assembly. `runtime/bun` is the Bun composition used by the published executable and maintenance scripts.
- `cli/` parses command-line flags, calls workflows, prints terminal output, and writes user-requested CLI output files.
- `scripts/` contains repository maintenance checks. Scripts may use runtime layers, but they are not package library code.

## Dependency Direction

Library modules must not import from `cli/`.

The normal flow is:

```text
domain <- config
domain <- planner <- targets
domain <- host
workflows -> config/planner/host/targets
runtime -> host/workflows/platform layers
cli -> workflows/runtime boundary
```

`src/index.ts` intentionally stays empty. Public API is the explicit subpath list in `package.json`, checked by `scripts/check-package-exports.ts` and `scripts/check-tree-shaking.ts`.

## Public Workflow Surface

There is no public `./api` facade. The public workflow modules are named after the work they own:

- `./workflows/config` for config-file release workflows.
- `./workflows/evidence` for reusable evidence persistence.
- `./workflows/live` for runtime-neutral live target and HTTP services.
- `./runtime/bun` for the Bun runtime composition.

Use lower-level `domain/`, `config/`, `planner/`, `host/`, and `targets/` subpaths when a caller needs more control than the workflow modules provide.

## Boundary Rules

- Publish operations are data until execution is explicitly approved.
- `Effect.run*` belongs at true runtime boundaries.
- Layers are provided at CLI, runtime, script, and test boundaries.
- Config parsing, evidence persistence, status, resume, reconciliation, and release execution are library workflows, not CLI behavior.
- Terminal formatting, argv parsing, and `--out` file writing belong in `cli/`.
