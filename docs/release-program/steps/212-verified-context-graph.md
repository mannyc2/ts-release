# Plan 212 — Verified context and immutable graph

Input-Commit: 5b0eec0
Result-Commit: b3841e6
Evidence-Commit: SELF
Status: DONE
Outcome: VERIFIED-CONTEXT-GRAPH / TEMPORARY-V6-PROJECTION
Date: 2026-08-09

## Decisions consumed

- Plan 208 is `PASS WITH CAPABILITY CUT`; the initial automatic set is GitHub
  release/assets and npm, while PyPI remains provisional and is not in the
  executable capability registry.
- Plan 209 is `RETIRE-PROFILES`; no nFPM capability or spike/profile registry
  was admitted.
- Plan 210 is `KEEP-MANNYC1` plus `MONOREPO-SUBPATH`.
- Plan 211 is `TARGET-ONLY`; the host layer supports Linux/macOS execution and
  cross-target Bun Windows artifacts, not native Windows execution.

## Implemented kernel

`src/release/context.ts` owns the shared `SourceObserver` contract and pure
source verification. The host layer observes a canonical workspace, Git HEAD
and tree, tracked/untracked cleanliness, package manifest bytes and SHA-256,
repository coordinate when unambiguous, and tags at HEAD. Dirty trees and
expected-commit disagreements are typed refusals; ignored `.release/` output is
not falsely treated as source dirt.

`src/release/config.ts` is the single internal intent boundary during the
public-v6 transition. The strict authored union now exposes only local
`check` and `artifact` preparations. Checks cannot declare outputs; artifact
preparations require a nonempty regular-file output set. GitHub body intent may
be inline text or one declared text artifact, and the generated JSON schema is
updated.

`src/release/graph.ts` and `src/release/compiler.ts` define the pure
`compileReleaseGraph(intent, context)` kernel. Contributions are immutable
values. One linker validates duplicate ids/producers, missing inputs,
input/output aliasing, command-reference vocabulary, regular-file command
outputs, publication references, text release-note bodies, cycles, and
code-point deterministic ordering. The graph has no plan id, stage/frontier,
approval, credential, attempt, timestamp, or durable-authority role.

`src/release/capabilities.ts` composes retained build/import, archive,
checksum, catalog, npm, GitHub, and local-preparation contributions. The
registry points at these contributor owners. `src/release/inspect.ts` provides
the pure user projection of verified source, artifacts, preparations,
publication subjects, command/environment requirements, and backed capability
ids.

The pre-217 `release-plan/v6` boundary remains available, but its temporary
projection was converted from mutable `CurrentRows` to immutable
`LegacyStageRows`. It is isolated in the old plan projection and contains no
new graph semantics; Plan 217 owns its final deletion with the public lifecycle
cut. No `CurrentRows`, `emptyRows`, load-bearing-order marker, or
`lowerCurrentConfig` symbol remains in `src`.

## Verification

- `bun run check` — PASS.
- `bun test` — PASS: 196 tests, 0 failures, 965 expectations.
- `bun run check:docs-claims` — PASS: 9 claims across 3 files.
- `bun run check:config-schema` — PASS.
- `bun run check:import-rules` — PASS: 138 files examined.
- `bun run check:cli-bundle` — PASS under Node v22.22.0.
- `bun run check:action-bundle` — PASS and fresh under Node v22.22.0.
- `bun run check:portable` — PASS, including core, CLI, Action, bundle,
  example, README, package-export, and integration checks.
- `bun test test/core/release-context.test.ts
  test/core/release-graph.test.ts` — PASS: 11 tests, 26 expectations.
- Temporary Git repositories cover clean source, ignored release output,
  tracked dirt, untracked dirt, source disagreement, manifest facts, tree,
  digest, and HEAD tags.
- Graph characterization covers build, check, generator, transform, command
  references, invalid paths, duplicate/missing/cycle failures, body-artifact
  validation, contributor permutation, and pure inspection.
- `git diff --check` — PASS.

## Evidence and limits

Evidence is `contract-tested` and `source-derived`; no publication, push, tag,
workflow dispatch, credential read, or other external mutation occurred.
Native Windows execution and PyPI automatic recovery remain explicitly
unclaimed under Plans 208 and 211. The temporary v6 projection is intentionally
not a new durable graph boundary and is scheduled for deletion by Plan 217.

## Handoff

Plan 213 may consume `compileReleaseGraph` and the verified context, but only
its PreparedRelease projection may cross a process boundary. It must not
serialize or publish this graph, reintroduce mutable output maps, or add a
second source/config resolver or command executor.
