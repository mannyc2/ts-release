# Architecture Audit Map

Drafted after plan 115 on branch `codex/115-pipeline-kernel` at `ed5f63f`.
This file is a neutral orientation note for a future architecture review
thread. It is not an execution plan, not a refactor proposal, and not approval
to change source.

## Purpose

Collect the code areas, source documents, vocabulary, and open questions that
would help a future thread review the current 0.1 architecture from first
principles.

The review can use this file to navigate the codebase without treating any
observation here as a conclusion. When this file names a tension, it means only
that two pieces of information are worth comparing.

## Current Inputs

- Repo: `/mnt/models/dev/ts-release`
- Branch at time of note: `codex/115-pipeline-kernel`
- Baseline commit at time of note: `ed5f63f`
- Relevant completed plans: 113, 114, 119, 115
- Next planned implementation path in `plans/README.md`: 116, then 117, then
  118
- Local Effect research source: `.repos/effect/.deepwiki`
- Effect source checkout: `.repos/effect/packages/effect/src/`

## Neutral Review Posture

Use this posture when turning the map into a prompt:

- Separate observations from recommendations.
- Prefer "current shape" over "problem."
- Prefer "question" over "verdict."
- Use file references and plan references as evidence, not as proof that one
  direction is correct.
- Keep implementation out of scope unless the user explicitly asks for a
  refactor plan later.
- Treat publish, tag, push, workflow dispatch, PR creation, and
  operator-only release actions as out of scope.

## Effect Reference Points

These are neutral categories for reading Effect-shaped code:

- Durable data: schema-backed values that cross boundaries, are serialized, or
  appear in plans/evidence.
- Service: contextual behavior with alternate implementations or runtime
  dependencies, usually exposed through `Context.Service` and provided by a
  `Layer`.
- Layer: construction and wiring for services, especially when construction is
  effectful, resource-owning, or shared across runtime/test boundaries.
- Reusable operation: an Effect-returning business operation, commonly written
  with `Effect.fn`.
- Workflow body: sequential orchestration, commonly written with `Effect.gen`.
- Runtime boundary: the place where an Effect program is run, often CLI,
  Action, API, script, or test setup.

Useful local references:

- `AGENTS.md`
- `/home/cjpher/.codex/skills/effect-ts/references/guide-effect.md`
- `/home/cjpher/.codex/skills/effect-ts/references/guide-layers.md`
- `/home/cjpher/.codex/skills/effect-ts/references/guide-schema.md`
- `plans/research/effect-v4-api-probe.md`
- `.repos/effect/.deepwiki`

## Source Documents To Compare

- `plans/README.md` — active path and dependency notes.
- `plans/114-pipeline-contract.md` — target pipeline architecture, directory
  roles, import rules, operation/data model, and 0.1 public API intent.
- `plans/115-introduce-pipeline-kernel.md` — implementation scope for the
  current kernel/build-pipe work.
- `plans/119-builder-contract.md` — builder contract, supported targets,
  command/prebuilt escape hatches, and runtime capability matrix.
- `SPEC.md` — product-facing contract.
- `ARCHITECTURE.md` — current and target architecture description.

## Code Regions

### Pipeline Kernel

Primary files:

- `src/pipeline/pipe.ts`
- `src/pipeline/runner.ts`
- `src/pipeline/state.ts`
- `src/pipeline/artifact.ts`
- `src/pipeline/catalog.ts`
- `src/pipeline/operation.ts`
- `src/pipeline/template.ts`
- `src/pipeline/pipeline.ts`

Current shape to observe:

- `Pipe` is a plain TypeScript interface whose `plan` method returns an
  `Effect`.
- `ReleaseState`, `ReleaseIdentity`, `PipeNotice`, `ArtifactCatalog`,
  `Artifact`, operation variants, and pipeline errors are schema-backed.
- `runPipeline` applies `section`, optional `defaults`, and `plan`, then
  appends artifacts, operations, and notices to `ReleaseState`.
- `src/pipeline/pipeline.ts` currently imports concrete pipe modules and
  exports the build pipeline list.
- Some pipeline files import types or schemas from `src/domain/*`.

Questions for a future review:

- What information belongs in serializable `ReleaseState`?
- What information belongs in a pipe contribution?
- What is the intended boundary between pipeline data and config data?
- Where is pipe ordering assembled today, and what other assembly points are
  named in the plans?
- Which pipeline helpers are pure transformations, and which are runtime
  boundary concerns?
- Which imports are temporary Plan 115 bridges, and which represent intended
  long-term ownership?

### Builders And Build Pipe

Primary files:

- `src/pipes/build.ts`
- `src/builders/builder.ts`
- `src/builders/bun.ts`
- `src/builders/command.ts`
- `src/builders/prebuilt.ts`
- `src/builders/targets.ts`

Current shape to observe:

- `Builder` is a plain TypeScript interface.
- The build pipe accepts `bun`, `command`, and `prebuilt` build options.
- `buildPipe` currently dispatches builder defaults and planning with explicit
  discriminant switches.
- Bun planning emits `StageArtifactOperation` with structured compile intent.
- Command planning emits command operation data from argv-style config.
- Prebuilt planning emits artifact catalog entries plus a read-only existence
  check represented as operation data.
- `PlatformTarget` lives under `src/builders/targets.ts` and is used by both
  builders and pipeline operation data.

Questions for a future review:

- Is the builder list conceptually open, closed for 0.1, or somewhere between?
- Does the generic `Builder` interface reduce extension work in practice?
- Where does target expansion live today?
- Where does defaulting live today?
- How are existence checks represented in operation/evidence data today?
- What representations are available for command-builder postconditions?

### Config, Domain, And Planner Bridge

Primary files:

- `src/config/schema.ts`
- `src/config/load.ts`
- `src/domain/release.ts`
- `src/domain/artifact.ts`
- `src/domain/operation.ts`
- `src/domain/target.ts`
- `src/planner/normalize-release.ts`
- `src/planner/create-release-plan.ts`
- `src/planner/artifact-inventory.ts`

Current shape to observe:

- `ReleaseConfig` currently aliases `ReleaseIntent`.
- `normalize-release.ts` resolves identity, compacts config, bridges existing
  domain planning, and invokes the build pipeline.
- `ReleaseModel` still feeds target planning.
- Artifact inventory logic still exists outside `src/pipeline/catalog.ts`.
- Plan 114 describes a target tree where `domain/` and `planner/` are no
  longer long-term directories, while the Plan 115 branch still uses them.

Questions for a future review:

- Which current `domain/*` types are product/domain vocabulary?
- Which current `domain/*` types are placement artifacts from the old design?
- Where does config schema composition happen today, and where do the plans
  describe it happening later?
- What identity-resolution shape best matches the planned `VersionSource`
  vocabulary?
- How much of `ReleaseModel` overlaps with `ReleaseState`?

### Publish Targets

Primary files:

- `src/targets/adapter.ts`
- `src/targets/registry.ts`
- `src/targets/live.ts`
- `src/targets/github.ts`
- `src/targets/homebrew.ts`
- `src/targets/npm.ts`
- `src/targets/pypi.ts`
- `src/targets/scoop.ts`
- `src/targets/adapter-helpers.ts`

Current shape to observe:

- Target publishing currently uses `TargetRegistry` as a `Context.Service`.
- Target modules produce operation data rather than executing publish actions
  directly.
- Plan 116 describes porting publish surfaces to pipes and retiring the target
  adapter layer.
- Target capabilities are currently first-class plan data.

Questions for a future review:

- Which parts of target planning are config-section planning?
- Which parts are runtime capability checks?
- Which target helper functions interact with publish pipes, operation data,
  artifact catalog helpers, or engine execution?
- What information is visible in rendered plans today?
- How do planned archive/checksum additions interact with publish planning?

### Workflow, Engine, API Boundary

Primary files:

- `src/workflows/release.ts`
- `src/workflows/options.ts`
- `src/engine/stager.ts`
- `src/planner/executor.ts`
- `src/planner/evidence-recorder.ts`
- `src/host/host.ts`
- `src/host/http.ts`
- `src/host/platform.ts`
- CLI and Action runtime files as needed

Current shape to observe:

- `workflows/release.ts` exports the current Effect-returning workflow
  functions used by CLI and Action code.
- `engine/stager.ts` interprets `StageArtifactOperation`.
- `planner/executor.ts` interprets existing domain `Operation` data.
- Runtime dependencies such as command execution, filesystem, HTTP, platform,
  and GitHub API are modeled through services/layers in several places.
- Plan 117 is expected to expose a smaller public TypeScript API and make CLI
  and Action wrappers thinner.

Questions for a future review:

- Where is the intended Effect-native core boundary?
- Where are Promise-returning APIs assembled today, and where does Plan 117
  describe assembling them?
- Which workflow exports are compatibility surface until Plan 117?
- Which execution responsibilities belong in `engine/`?
- Which host services are stable runtime dependencies?

### Tests And Docs

Primary files:

- `test/pipeline-runner.test.ts`
- `test/pipeline-state.test.ts`
- `test/build-pipe-stage.test.ts`
- `test/pipe-build-bun.test.ts`
- `test/pipe-build-command.test.ts`
- `test/pipe-build-prebuilt.test.ts`
- `test/pipe-build-npm-pack.test.ts`
- `test/pipe-build-pypi-wheel.test.ts`
- `SPEC.md`
- `ARCHITECTURE.md`
- `plans/114-pipeline-contract.md`
- `plans/119-builder-contract.md`

Current shape to observe:

- Plan 115 added focused tests around pipeline state, runner behavior, build
  pipe behavior, and individual builders.
- Docs describe both the current architecture and the intended 0.1 target
  architecture.
- Some docs are contract-like plan artifacts; others are user/product-facing.

Questions for a future review:

- Which tests describe behavior, and which tests describe architecture shape?
- Which doc claims are already true in the current branch?
- Which doc claims describe future work?
- Which architectural invariants are important enough to become automated
  checks?

## Possible Research Slices

These slices are phrased for either manual research or read-only subagents.
Each slice returns observations, file references, and unresolved questions, not
implementation steps.

1. Pipeline kernel slice: read `src/pipeline/*` and compare with the directory
   invariants in Plan 114.
2. Builder/build slice: read `src/pipes/build.ts` and `src/builders/*`, then
   compare with Plan 119.
3. Config/planner/domain slice: read config/domain/planner bridge files and map
   overlaps between `ReleaseIntent`, `ReleaseModel`, and `ReleaseState`.
4. Publish-target slice: read `src/targets/*` and map which target concepts
   might become pipe config, operation data, capability data, or engine logic.
5. Runtime/API slice: read workflow, engine, executor, evidence, and host
   files to map where Effect programs are returned vs run.
6. Docs/tests slice: map which tests and docs describe current behavior vs
   intended future behavior.

## Observation Template

Use this shape for neutral notes:

- Topic:
- Current files:
- Current shape:
- Source document references:
- Open questions:
- Related tests:
- Terms that need definition:

## Prompt-Building Notes

A future prompt can ask for an architecture review that:

- starts from Effect data/service/layer boundaries;
- audits one slice at a time;
- uses `.repos/effect/.deepwiki` as orientation, not as API authority;
- treats Plan 114 and Plan 119 as source documents to compare with the current
  branch;
- stays read-only unless explicitly redirected;
- returns neutral observations first, then asks the user before turning any
  observation into a refactor plan.
