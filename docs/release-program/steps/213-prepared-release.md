# Plan 213 — PreparedRelease boundary

Input-Commit: 56a328c
Result-Commit: e23ae81
Evidence-Commit: SELF
Status: DONE
Outcome: EXACT-PREPARED-RELEASE / STAGED-TRUSTED-PREPARATION
Date: 2026-08-09

## Implementation

Plan 212's verified source context and immutable graph now terminate in one
internal `prepareRelease` operation. The implementation is split across three
commits:

- `31cd84e` — strict `PreparedReleaseV1` values and the atomic content-addressed store;
- `92938db` — staged preparation dispatcher, npm tarball capture, graph path
  invariants, mutation checks, and vertical tests;
- `e23ae81` — exact GitHub draft/prerelease subjects and pure prepared-bundle
  inspection.

Preparation copies contained workspace material into a private temporary root,
excluding `.git`, prior `.release` state, and credential/config files. Commands
receive argv arrays, staged cwd and declared path references. Only declared
regular-file outputs are captured. Inputs are fingerprinted before and after
each command, source identity is re-observed between preparations, and the
staged root is never the durable authority.

The npm path runs `npm pack` against the staged package, retains the exact
tarball, and binds the typed publication intent to that artifact. It does not
publish a source directory. Because Bun's `spawnSync` capture can return empty
stdout for the npm wrapper, the implementation keeps machine-readable JSON
enabled, validates it when present, and authoritatively accepts exactly one
new regular `.tgz` in a clean output directory.

## Manifest consumer table

| Field | Consumer |
|---|---|
| `schemaVersion` | strict manifest decoder and canonical compatibility gate |
| `source.commit`, `source.tree`, `source.clean` | preparation source-drift gate, GitHub target subject, inspection |
| `source.packageManifestPath`, `source.packageManifestDigest` | source/package identity projection and inspection |
| `project.name`, `project.packageName`, `project.version`, `project.tag`, `project.repository` | provider coordinate construction and inspection |
| artifact `id`, `path`, `kind`, `size`, `digest`, `blob`, `mediaType` | atomic store validation, exact provider subjects/assets, inspection |
| npm `packageName`, `version`, `registryUrl`, `artifactId` | Plan 214 npm observer/publisher subject |
| GitHub `repository`, `tag`, `title`, `draft`, `prerelease`, `targetCommit`, `body` | Plan 214 release subject |
| GitHub asset `artifactId`, `name`, `mediaType` | Plan 214 per-asset subjects |
| publication `id` | deterministic publication reporting and duplicate-reference checks |

No graph id, plan bytes, stage/frontier, attempt, approval, credential,
workspace path, timestamp, remote observation, or mutable status is durable.

## Store and inspection contract

Bundles are written as:

```text
.release/ts-release/prepared/<manifest-sha256>/
  prepared-release.json
  blobs/<sha256>
```

Manifest bytes are canonical JSON and are re-encoded byte-for-byte on load.
The containing directory must match their SHA-256. Every referenced blob is
required exactly once, is a regular file, and is re-read, size-checked, and
hashed on every load. Preparation writes sibling temporary directories and
renames only after complete validation; an incomplete directory is never
accepted as a bundle. Reusing an existing digest requires exact manifest and
blob equality; mismatches fail.

`inspectPreparedRelease` is a pure projection of a loaded bundle. It reports
the bundle location, verified source, release coordinates, artifact facts and
typed destination subjects without credentials, process access, HTTP, config,
graph state, or workspace rebuilds.

## Decisions and limits

- Build-only preparation succeeds with an empty publication list.
- Generic command outputs are regular files; directory/package inputs are
  fingerprinted as contained trees but never recursively entered into blobs.
- Checks contribute no durable success receipt; durable evidence must be an
  explicit artifact output.
- nFPM remains absent under Plan 209's `RETIRE-PROFILES` decision.
- The local store's durability claim is same-machine/process-restart only.
  Plan 219 owns complete CI bundle upload before any remote mutation.
- Command preparations remain trusted local code. Undeclared external effects
  and ignored-path writes outside the private staging root are unsupported,
  not represented as publication evidence, and are not called hermetic.
- `prepareRelease` remains internal until Plan 217's public lifecycle cut.

## Verification

- `bun test test/core/prepared-release.test.ts test/core/preparation.test.ts`
  — PASS: 8 tests, 28 expectations.
- `bun test test/core/release-graph.test.ts` — PASS: 7 tests, 19 expectations.
- `bun test test/core` — PASS: 177 tests, 754 expectations.
- `bun run check` — PASS.
- `bun run check:portable` — PASS: 204 tests, 995 expectations; versions,
  docs claims, import rules, tree shaking, build, CLI/Node bundle, schema,
  examples, README, package exports, CLI app and Action bundle all passed.
- `git diff --check` — PASS.
- No credentials were read and no package, registry, repository, tag,
  workflow, Action, or other external state was mutated.

## Physical delta

Against `56a328c`, the Plan 213 product/test delta is 777 added and 6 deleted
lines across 10 files. It adds one manifest schema, one atomic store, one
staged preparation dispatcher, one prepared inspection projection, and
focused boundary/store/graph tests. It does not add a second blob format or
another command runner.

## Handoff

Plan 214 may consume only the completed bundle and destination observation. It
must not rebuild from config, read the graph or workspace outputs, publish an
NPM source directory, or turn transport failures into absence. GitHub's typed
subjects must consume the preserved metadata and exact per-asset bytes; npm's
observer must use the configured registry and the prepared tarball identity.
