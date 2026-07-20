# Architecture

`@mannyc1/ts-release` is a deterministic release planner and an explicitly
approved operation runner. Release intent becomes one canonical plan; the plan
can be reviewed, rendered, staged, verified, or executed. The library, CLI, and
GitHub Action all use the same engine.

## The 14 concepts

| # | Concept | Representation and owner |
|---:|---|---|
| 1 | Release intent | Strict wire Schema in `src/config/`; it also derives the JSON Schema. |
| 2 | Release identity | One `ReleaseIdentity`, resolved from manifest or git tag in `src/resolve/resolved-release.ts`. |
| 3 | Resolved release | Totalized feature sections in `ResolvedRelease`; planners do not re-resolve config. |
| 4 | Feature planner | One `(section, accumulator) -> contribution` shape in `src/features/`. |
| 5 | Artifact | One Schema class in `src/grammar/artifact.ts`, including platform and typed extra data. |
| 6 | Operation / Action | One operation class and seven live action tags in `src/grammar/operation.ts`. |
| 7 | Release plan | The sole durable `release-plan/v3` Schema in `src/grammar/plan.ts`. |
| 8 | Accumulator | One private transient fold in `src/grammar/accumulator.ts`; never encoded or exported. |
| 9 | Approval | One risk derivation in `src/grammar/approval.ts` plus whole-pass preflight in the executor. |
| 10 | Evidence | Records and the sole durable `release-evidence/v2` bundle in `src/run/evidence.ts`. |
| 11 | Deferred content | Typed text and checksum holes resolved from canonical artifacts by `src/run/content.ts`. |
| 12 | Builder | One contract with Bun, command, and prebuilt adapters in `src/features/`. |
| 13 | Services | Command, HTTP, staging, and GitHub capabilities injected at runtime boundaries. |
| 14 | Errors | One tagged-error policy; distinct tags remain where retry and exact failure contracts differ. |

Every product TypeScript module opens with the invariant it owns. A module may
split implementation detail, but it must not introduce a second representation
of one of these concepts.

## Data flow

```text
JSON/object config
  -> strict ReleaseIntent decode
  -> ReleaseIdentity + ResolvedRelease
  -> fixed ordered feature schedule
  -> private accumulator
  -> canonical ReleasePlan v3
  -> render / build / verify / approved release
  -> EvidenceBundle v2
```

Config is decoded once. Identity and defaults are resolved once. Feature
planners are pure with respect to release state: they contribute artifacts,
operations, and notices but execute nothing. The accumulator is the uniqueness
boundary for artifact ids, operation ids, paths, and names. Finalization creates
the durable plan without an intermediate document DTO.

The planner schedule is explicit in `src/engine/engine.ts`. Its order is contract:
builds and imports, processing and catalogs, then publication surfaces. Adding a
surface requires a Schema composition entry, one feature module, and one
schedule entry. It does not require dynamic registration or a new kernel.

## Module ownership

- `src/config/` owns location, JSON parsing, migration hints, strict decode, and
  JSON-Schema derivation.
- `src/grammar/` owns durable grammar, pure platform/template/semver helpers,
  approval derivation, and the private planning fold.
- `src/features/` maps resolved build targets and catalog presets to artifacts
  and planned actions.
- `src/features/` owns one resolver/planner per build or artifact
  transformation and generic machinery for catalog-shaped publication.
  Selection and rendered product content stay with the feature that specifies
  them; Homebrew and Scoop are content builders over the generic catalog pair.
- `src/resolve/resolved-release.ts` owns identity plus feature totalization.
- `src/pack/stager.ts` and `src/pack/archive-bytes.ts` turn stage intents into deterministic
  bytes inside the workspace boundary.
- `src/github/github.ts` is the Schema-decoded GitHub Releases API client. Its
  `Effect.whileLoop` pagination is deliberate.
- `src/run/executor.ts` owns pass selection, approval preflight, action
  interpretation, retry, and sequential evidence recording.
- `src/run/evidence.ts` owns durable evidence and redaction; `src/run/content.ts`
  resolves deferred content from artifacts.
- `src/engine/engine.ts` composes planning and the evidence-finalized workflows.
- `src/render/render.ts` and `src/render/summary.ts` project the same canonical plan;
  they do not reconstruct plan facts.
- `src/host/` defines command and HTTP services plus live adapters. Concrete
  filesystem/path/HTTP/process layers are not provided inside library workflows.
- `src/doctor/doctor.ts` derives diagnostics from decoded config and the plan
  without executing publish operations.
- `src/api/` is the Promise/plain-data boundary backed by one lazily shared
  managed runtime. `src/index.ts` is the only public TypeScript entrypoint.
- `src/host/workspace-path.ts`, `src/api/error-message.ts`, `src/assets/`, and
  `src/types/` contain single-owner boundary helpers, reviewed static
  facts/templates, and declaration-only compatibility.
- `apps/release-ts/src/` owns Effect CLI parsing, terminal and `--out` behavior,
  template-based init, and the Bun runtime layer.
- `apps/ts-release-action/src/` owns Action input decode, outputs, summaries,
  evidence upload, and the Node runtime layer.

`scripts/` contains repository gates, not product behavior. `templates/` holds
the shipped init bases. `.repos/` and `vendor/` are outside the product tree.

## Durable and public boundaries

`ReleasePlan` v3 contains identity, artifacts, operations, notices, source, and
evidence directory. Every planned operation remains visible. There is no older
plan reader, hidden-stage projection, artifact inventory DTO, or output alias.
Evidence v2 is independent and contains each operation's final status/outcome.

The package root exposes config authoring plus `plan`, `build`, `verify`, and
`release`. It does not export internal directory subpaths. Bare `release()` is
plan-only. The `ts-release` executable and bundled Action are public adapters,
not alternate engines.

## Execution boundary

Operations remain Schema data until the selected workflow preflights all
required approvals. `writes-local` and externally visible operations require
execute approval; irreversible operations additionally require publish
approval. Snapshot policy refuses publish-class mutations but still records
their normal refused evidence.

Execution is sequential in four safety passes: render, validation, publish,
verify. Each operation's pass is a total function of its phase and risk:
build/process maps to build, catalog to render, publish splits on read-only into
validation or publish, and verify maps to verification. No operation can fall
outside this pass partition. `RetryPolicy` is visible operation data interpreted
with an Effect `Schedule`. Only `ActionAttemptFailed` is retryable; service
failures, typed terminal errors, defects, interruption, and
`ActionAttemptFailed`'s final mapping remain distinct.

One workflow-local `Ref` accumulates final evidence records. Approval preflight
happens before the Ref and before side effects. Once execution begins, one
on-exit finalizer writes evidence exactly once on success, typed failure,
defect, or interruption. If workflow and evidence writes both fail, the write
failure remains primary and the workflow cause remains attached.

## Dependency and safety rules

- Publish actions are data until execution is explicitly approved.
- `Effect.run*` appears only at CLI, Action, Promise API, script, or test runtime
  boundaries; reusable workflows use typed Effect environments.
- `src/` never imports application code. Pipes/builders depend on pipeline
  grammar, while engine composition may depend on config, features, and hosts.
- Concrete layers are provided by the Bun CLI runtime, Node Action runtime,
  lazy Promise runtime, maintenance scripts, or tests.
- Paths are non-empty safe relative paths and are rechecked at the workspace
  I/O boundary; no planned read or write may escape its root.
- Operation ids, order, risks, messages, rendered catalogs, plan/evidence bytes,
  and public error text are compatibility contracts.
- Config fields are product surface. Removing one requires a separately
  announced schema change and migration hint.
- The npm existence retry and GitHub `Effect.whileLoop` pagination are retained
  features, not fallback debt.
