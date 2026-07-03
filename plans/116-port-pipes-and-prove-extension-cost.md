# Plan 116: Port publish surfaces to pipes, delete the target-adapter layer, and prove extension cost with checksum + archive pipes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.
>
> **Required reading before Step 1**: the finalized contract in
> `plans/114-pipeline-contract.md` and the kernel landed by
> `plans/115-introduce-pipeline-kernel.md`. If either plan's
> status in `plans/README.md` is not DONE, STOP.
>
> **Drift check (run first)**:
>
> ```sh
> git diff --stat f1c90c0..HEAD -- src/targets src/planner src/pipeline src/pipes src/workflows
> ```
>
> Expect: plan 115 created `src/pipeline` + `src/pipes` and shrank
> `src/planner`; `src/targets` should be near-untouched. Anything else →
> compare "Current state" excerpts; meaningful mismatch → STOP.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: MED
- **Depends on**: 114, 115
- **Category**: tech-debt / architecture
- **Planned at**: commit `f1c90c0`, 2026-07-03

## Why this matters

After plan 115, builds run on the pipeline but the five publish surfaces
(npm, GitHub, Homebrew, Scoop, PyPI) still run through the old
adapter/registry/normalizer path. This plan completes the cutover: every
surface becomes a pipe, the parallel architecture is deleted, and — the real
test of the design — two brand-new GoReleaser-style features (checksum files
and archives) land as pipes to prove that "new feature = one pipe + one
config section." When this plan is done, the LOC-heavy layers
(`normalize-release.ts`, `targets/adapter*.ts`, `targets/registry.ts`) are
gone and the engine has exactly one extension seam.

## Current state

(Verified at `f1c90c0`; plan 115 will have changed `src/planner` — the
targets excerpts below are the ones that matter.)

- `src/targets/` (2073 lines): `adapter.ts` (30 — the `TargetAdapter`
  interface), `registry.ts` (55 — `TargetRegistry` Effect service dispatching
  on `_tag`), `adapter-helpers.ts` (357 — dry-run/validation-note/strict-mode
  helpers), and per-target modules: `npm.ts` 168, `github.ts` 152 +
  `github-release.ts` 74 + `github-api.ts` 471 (Effect-native GitHub REST
  layer — KEEP, it becomes the publish:github pipe's HTTP layer),
  `homebrew.ts` 326, `scoop.ts` 152, `pypi.ts` 211, `live.ts` 77.
- Target modules already have the correct shape — pure functions from config
  slice + model to operation data. Example (`src/targets/npm.ts:126-162`):
  `planNpmOperations` emits version-check, auth, dry-run, publish
  (`risk: "irreversible"`), and verify operations. Porting = re-hosting this
  logic behind the `Pipe` interface with per-pipe `defaults`, not rewriting
  it.
- The remaining `normalize-release.ts` content after 115 is target/publish
  validation and config→domain adapters — absorbed here by per-pipe
  `defaults`.
- Homebrew/Scoop consume specific artifacts via config-declared artifact ids
  (`apps/release-ts/release.config.json`: `"artifactId": "cli-darwin-arm64"`,
  `"artifactIds": [...]`). With the catalog from 115 they should instead
  filter (`byKind("executable")` + `byOs("darwin")`), with the config ids
  kept as an optional narrowing filter. The 114 contract's config mapping
  decides the final shape — follow it.
- Verify semantics live in `VerifyRemoteOperation` data and
  `src/workflows/release.ts`; evidence writing in
  `src/planner/evidence-recorder.ts` (697), execution in
  `src/planner/executor.ts` (448). Both survive but move under `src/engine/`
  per the 114 LOC budget, and operations gain `producedBy` pipe provenance.

Conventions: same binding list as plan 115 (Bun; Effect beta alignment;
Schema classes for durable data/errors; Effect.fn/Effect.gen; layers at
boundaries; publish stays data until approved; `.repos/effect` untouchable).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bun run check` | exit 0 |
| Tests | `bun test` | 0 fail |
| Full gate | `bun run check:portable` | exit 0 |
| Self-release gate | `bun run check:release` | exit 0 |
| Dead-layer sweep | `rg -n "TargetAdapter\|TargetRegistry\|normalize-release" src apps test` | no hits at the end |
| LOC measure | `find src apps/release-ts/src apps/ts-release-action/src -name '*.ts' \| xargs wc -l \| tail -1` | record |

## Scope

**In scope**:

- Create `src/pipes/publish-{npm,github,homebrew,scoop,pypi}.ts`,
  `src/pipes/catalog-{homebrew,scoop}.ts` (formula/manifest rendering as
  `catalog`-phase pipes, per the 114 phase order), and NEW
  `src/pipes/checksum.ts` + `src/pipes/archive.ts`.
- New config sections `checksum` and `archives` as pipe-owned section
  schemas composed by `src/config/schema.ts` per the 114 config mapping
  (plus JSON-schema regeneration); do not add durable new `src/domain/`
  types for them, since `domain/` ceases to exist by the end of the wave.
- Move executor + evidence-recorder under `src/engine/`; add operation
  provenance.
- Delete: `src/targets/adapter.ts`, `adapter-helpers.ts` (fold surviving
  helpers into pipe-local or kernel helpers), `registry.ts`, `live.ts`, the
  per-target modules once ported, and the remainder of
  `normalize-release.ts`.
- Update `src/workflows/release.ts` internals (signatures unchanged), tests,
  and `apps/release-ts/release.config.json` if the catalog-filter config
  shape changed (follow the 114 contract exactly).

**Out of scope**:

- Public exports / `package.json` / CLI verbs / Action inputs — plan 117.
- `scripts/`, `apps/release-ts/scripts/` — plan 118.
- New publish surfaces (winget, nfpm, docker, announce...) — post-0.1.
- Signing/SBOM — post-0.1 matrix rows.
- `.repos/effect`, `vendor/`.

## Git workflow

- Branch: `codex/116-port-pipes`.
- Commit per ported pipe; imperative sentence case (e.g. `Port npm publish
  target to a pipeline pipe`).
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record LOC baseline (post-115)

Run the LOC measure command; record.

### Step 2: Port publish pipes one surface at a time

Order: npm → pypi → github → homebrew → scoop (simplest to most
artifact-coupled). For each: create `src/pipes/publish-<surface>.ts`
implementing `Pipe<Section>`; `defaults` absorbs that target's
`normalize-release.ts` validation/normalization; `plan` re-hosts the
existing `plan<Surface>Operations` logic, consuming artifacts via catalog
filters instead of raw config ids. Register in the pipeline array
(`publish` phase). Keep the old target module delegating to the pipe (or
vice versa) so `bun test` is green after EVERY surface — never port two
surfaces in one broken jump.

**Verify after each surface**: `bun test` → 0 fail; that surface's existing
operation-shape tests still pass (updated imports only, assertions intact —
the emitted operation data must be identical modulo new `producedBy`
fields).

### Step 3: Port catalog rendering and verify

`catalog:homebrew` / `catalog:scoop` pipes emit the existing
`RenderFileOperation` data in the `catalog` phase; verify operations remain
`verify`-phase contributions from each publish pipe (per the 114 phase
order). Move `executor.ts` and `evidence-recorder.ts` to `src/engine/`,
adding `producedBy` provenance to recorded evidence.

**Verify**: `bun run check:release` → exit 0 (this exercises doctor + config
+ plan against the real dogfood config);
`bun run cli plan --config apps/release-ts/release.config.json --format text`
→ identical operation ids/risks as before the port (diff the output captured
before Step 2).

### Step 4: Delete the old layer

Delete `src/targets/*` (except `github-api.ts`, re-homed at
`src/engine/github-api.ts` per 114 D18) and what remains of
`normalize-release.ts`.

**Verify**: `rg -n "TargetAdapter|TargetRegistry|normalize-release" src apps test`
→ no hits; `bun run check:portable` → exit 0.

### Step 5: Add the checksum pipe (NEW feature #1)

`src/pipes/checksum.ts` + `checksum` config section (`{ algorithm?:
"sha256" | "sha512" }`, default sha256): a `process`-phase pipe selecting
every release-uploadable artifact EXCEPT checksum/signature kinds (the
exclusion form, per 114 D3 — new kinds are then included automatically)
and emitting one `writes-local` operation producing the checksum-file
artifact (`kind: "checksum-file"`), plus the artifact's catalog entry so
`publish:github` uploads it automatically via its existing catalog filter.
Pinned by 114 D1 (GoReleaser-compatible defaults, byte-for-byte): default
file name `{name}_{version}_checksums.txt`; line format
`<hex hash><space><space><artifact basename>\n` — the TWO spaces are
load-bearing (`sha256sum -c` / `shasum -c` compatibility); entries sorted
by basename for deterministic output.

**Verify**: new `test/pipe-checksum.test.ts` passes; with `checksum` absent
from config the pipe records a skip notice and plan output is unchanged;
with it present, `bun run cli plan ... --format text` lists the checksum
operation and the GitHub upload includes `checksums.txt`.

### Step 6: Add the archive pipe (NEW feature #2) and measure the extension cost

`src/pipes/archive.ts` + `archives` config section (per the 114 mapping
and D2; minimum: `{ formats?: ("tar.gz" | "zip")[], formatOverrides?:
[{ os, formats }], files?: globs, wrapInDirectory?: boolean | string,
artifacts?: filter }`): a `process`-phase pipe emitting `writes-local`
archive operations grouped one archive per platform (that platform's
binaries + included files), contributing `kind: "archive"` artifacts.
Pinned defaults (114 D1/D2, GoReleaser-compatible): section absent = skip
notice (bare binaries remain the null state — do NOT reproduce upstream's
implicit default archive); `formats` defaults to `["tar.gz"]`; name
template defaults to `{name}_{version}_{os}_{arch}` + format extension
with `{os}`/`{arch}` rendering distribution tokens (`amd64`, not `x64` —
the 119 mapping table); default included files are the six
license/readme/changelog globs (`license*`, `LICENSE*`, `readme*`,
`README*`, `changelog*`, `CHANGELOG*`), quiet when unmatched;
`wrapInDirectory` is a typed `boolean | string` (true = archive name,
string = literal directory). Then record
in your final report the honest extension cost of each new pipe: LOC of the
pipe module, LOC of config schema addition, lines changed outside those two
places (target: pipeline-array registration only).

**Verify**: `test/pipe-archive.test.ts` passes; `bun run check:release` →
exit 0; the "lines changed elsewhere" count is ≤ 5 — if it is not, that is
kernel feedback: report it, don't hide it.

### Step 7: Implement snapshot mode and the git-tag version source (engine side)

Per the 114 contract's identity-seam and snapshot semantics
(maintainer-approved for 0.1):

- **Snapshot** (an identity MODIFIER): add a snapshot flag to the engine's
  run options that (a) transforms the resolved identity into the marked
  fake version — decided format (114 D4, upstream's default verbatim):
  `{version}-SNAPSHOT-{shortCommit}` applied over whatever the active
  source resolved — and (b) makes the
  executor refuse `externally-visible` and `irreversible` operations
  regardless of approval flags, recording the refusals as evidence
  notices. Plan output must visibly mark the release as a snapshot.
- **git-tag version source** (the second `VersionSource` adapter,
  alongside the manifest source that plan 115's identity stage ports the
  existing behavior into): `versionFrom: "git-tag"` resolves the version
  per 114 D5 — discovery order: explicit override (config option or
  `TS_RELEASE_CURRENT_TAG` env) → tag pointing at HEAD (sorted
  `-version:refname`) → nearest ancestor tag (`describe --tags
  --abbrev=0`); strip one leading `v`; the version must parse as semver
  (typed error naming the tag otherwise); no tag = typed error whose
  message names `--snapshot` as the way out; under snapshot, no repo/tag
  degrades gracefully to a `0.0.0` base instead of failing.
  Default remains `"manifest"` — the dogfood config is unchanged.

With the identity now carrying a parsed semver prerelease component, also
wire `publish.github.prerelease: "auto"` (114 D6 — mark the GitHub
release prerelease exactly when the version has a prerelease component;
plain booleans keep working unchanged).

CLI/API flag exposure is plan 117's job — here the engine capability plus
tests.

**Verify**: new `test/snapshot.test.ts` — snapshot identity format applies
over both sources; executor refuses a publish operation under snapshot even
with both approvals (fake hosts); plan output carries the snapshot marker.
New `test/version-source-git-tag.test.ts` — resolves from a fake git host
(HEAD-tag and ancestor-tag cases, `v` stripped, env override wins);
missing/unparseable tag → typed error, not a fallback to manifest;
missing tag WITH snapshot → graceful `0.0.0`-based snapshot version. `bun
test` → 0 fail.

### Step 8: Final gates and LOC

`bun run check:portable && bun run check:release`; re-run LOC measure.
Target per the 114 budget: pipeline+pipes+engine ≤ ~4.3k replacing today's
6.4k planner/targets/artifacts/workflows mass, with checksum+archive+
snapshot included. Record numbers.

## Test plan

- Per-pipe tests (`test/pipe-publish-*.test.ts`): defaults, operation
  shapes, catalog consumption — assertions carried over from the existing
  `test/target-*.test.ts` files, which are renamed with the port, not
  weakened.
- `test/pipe-checksum.test.ts`, `test/pipe-archive.test.ts` — new features:
  skip-when-unconfigured, operation emission, catalog contribution.
- The end-to-end suite (`test/cli-command.test.ts`,
  `test/action-command.test.ts`, evidence tests) passes without assertion
  changes beyond `producedBy` additions.

## Done criteria

- [ ] `bun run check:portable` and `bun run check:release` exit 0; `bun test` 0 fail.
- [ ] `rg -n "TargetAdapter|TargetRegistry|normalize-release" src apps test` → no hits.
- [ ] `ls src/targets` → directory gone.
- [ ] Checksum and archive pipes work end-to-end in plan output; extension
      cost recorded (≤ 5 lines outside pipe+config each).
- [ ] Snapshot mode: `test/snapshot.test.ts` proves the marked version
      format and that publish operations are refused under snapshot even
      with both approval flags.
- [ ] git-tag version source: `test/version-source-git-tag.test.ts` proves
      resolution from a fake git host and typed failure on missing tag;
      `versionFrom` defaults to `"manifest"` (dogfood config unchanged).
- [ ] Plan output for the dogfood config shows identical publish operation
      ids/risks as pre-port (modulo provenance and the two new features).
- [ ] LOC numbers recorded; engine mass at or below the 114 budget.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Plans 114/115 are not DONE.
- A publish surface cannot express its existing operations through the pipe
  interface without weakening operation data (ids, risks, redacted env) —
  the safety model outranks the architecture; report the conflict.
- Homebrew/Scoop catalog-filter semantics would change which artifacts ship
  for the current dogfood config (Step 3's plan diff catches this) — that is
  a release-behavior change requiring maintainer sign-off.
- The checksum or archive pipe needs kernel changes beyond registration.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- From here on, every new distribution feature is a pipe: copy the checksum
  pipe as the template. A feature that resists the pipe shape is kernel
  feedback for a design discussion, not a special case.
- The pre/post plan-output diff (Step 3) is the reviewer's main artifact —
  it proves the port changed architecture, not behavior.
- Plan 113's shipped 0.0.8 is the rollback baseline; nothing in this plan
  publishes.
- First post-port improvements queued by the 114 contract (deliberately
  NOT part of the behavior-preserving port; each is its own small change
  after this plan's diff discipline has done its job): scoop multi-arch
  manifests (`architecture: {"64bit"|"arm64"|"32bit": {url, hash, bin}}`,
  114 D8) and the homebrew multi-platform formula shape
  (`on_macos`/`on_linux` + per-CPU stanzas with one-artifact-per-platform
  validation, 114 D7).
