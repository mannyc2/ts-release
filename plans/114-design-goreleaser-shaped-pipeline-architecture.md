# Plan 114: Design the GoReleaser-shaped pipeline architecture and the 0.1 public API

> **Executor instructions**: This is a DESIGN plan. It edits documentation and
> plan files only — never source code. Follow it step by step, run every
> verification, and honor the STOP conditions. When done, update this plan's
> status row in `plans/README.md`.
>
> **Read "Decided contract inputs" (below, after Current state) before the
> Steps**: the 2026-07-03 concretization pass against the 121 report made
> the architectural choices D1-D17, and the same-day open-ideas review
> added D18 (target file structure) and D19 (Effect-native API stance);
> where any step's older draft wording conflicts with them, the decisions
> win. Your job is to encode, not re-decide.
>
> **Drift check (run first)**:
>
> ```sh
> git diff --stat f1c90c0..HEAD -- SPEC.md ARCHITECTURE.md src/index.ts src/domain src/planner src/targets src/artifacts src/workflows apps/release-ts/src/runtime plans/115-introduce-pipeline-kernel.md plans/116-port-pipes-and-prove-extension-cost.md plans/117-public-api-and-thin-cli.md
> ```
>
> Version-bump-only drift from plan 113 (three `package.json` version fields,
> README download example, install-smoke defaults, release notes) is expected
> and fine. If `src/` structure changed beyond that, compare the "Current
> state" section against the live code; on a meaningful mismatch, STOP.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: LOW (documentation only)
- **Depends on**: none (may run in parallel with plan 113; plans 115-117
  implement this design and must wait for both)
- **Category**: direction / architecture
- **Planned at**: commit `f1c90c0`, 2026-07-03

## Deliverable

The finalized architecture contract lives in
`plans/114-pipeline-contract.md`. It is the binding handoff for plans 119
and 115-117 and supersedes older draft wording in this plan where they
conflict.

## Why this matters

The maintainer's direction for 0.1: a TypeScript API with a CLI wrapping it,
shaped like GoReleaser — a pipeline of small, uniform steps over a shared
artifact catalog — so that new distribution features (archives, checksums,
signing, SBOM, announce, nightly, monorepo) land as *one new pipe plus one new
config section* instead of edits across planner/targets/workflows. The primary
metric is low LOC achieved through architecture, not golf. Today the engine is
~8.4k LOC with three different extension seams (artifact "recipes" in the app
runtime, target adapters in the library, workflow functions on top), and a
969-line central normalizer that must learn about every feature. This plan
produces the binding contract that plans 115-117 implement. Without it, the
refactor risks reproducing the current shape with new names.

## Current state

Architecture today (all verified at `f1c90c0`):

- Flow: JSON config → `ReleaseIntent` → `src/planner/normalize-release.ts`
  (969 lines, centralized normalization of every feature) → `ReleaseModel` →
  per-target adapters plan `Operation` data → `ReleasePlan` →
  `src/planner/executor.ts` executes approved operations →
  `src/planner/evidence-recorder.ts` (697 lines) writes evidence.
- Target adapters (`src/targets/{npm,github,homebrew,scoop,pypi}.ts`) share a
  30-line interface (`src/targets/adapter.ts`):

  ```ts
  // src/targets/adapter.ts:17-24
  export interface TargetAdapter<Target extends TargetConfig> {
    readonly targetTag: Target["_tag"]
    readonly capabilities: (target: Target) => TargetCapabilities
    readonly planOperations: (
      target: Target,
      model: ReleaseModel
    ) => Effect.Effect<ReadonlyArray<Operation>, PlanConstructionError>
  }
  ```

  plus a `TargetRegistry` Effect service (`src/targets/registry.ts`) that
  dispatches on `_tag`.
- Operations are typed, risk-graded data (`src/domain/operation.ts`):
  `OperationRisk = "read-only" | "writes-local" | "externally-visible" |
  "irreversible"`, with `CommandSpec`, `HttpRequestSpec`,
  `RenderFileOperation`, `PublishCommandOperation`, `VerifyRemoteOperation`,
  etc. **This operations-as-data + approval-gating model is the product's core
  safety differentiator and must survive the redesign.**
- Builds are NOT in the library: Bun-compile and PyPI-wheel staging live in
  the CLI app as "artifact recipes"
  (`apps/release-ts/src/runtime/bun-artifact-recipes.ts`,
  `apps/release-ts/src/runtime/pypi-wheel-artifact-recipes.ts`, ~400 lines
  each including the wheel/zip writer), wired through
  `src/artifacts/adapter.ts` (100 lines).
- Artifact metadata is spread across `ArtifactIntent`,
  `ArtifactInventoryItem`, `InstallableArtifactVariant`, and recipe classes in
  `src/domain/artifact.ts`; there is no filterable catalog abstraction —
  consumers (homebrew, scoop) are wired to specific artifact ids in config.
- Public surface after the hard cutover (plans 108-112): root export =
  `defineRelease` + `ReleaseConfig` types + JSON-schema helpers +
  `ReleasePlanSummary` (`src/index.ts`, 32 lines). CLI = 7 commands (`init`,
  `doctor`, `build`, `plan`, `render`, `release`, `verify`). There is **no
  programmatic way to run a release from TypeScript** — the engine
  (`src/workflows/release.ts`, 718 lines) is internal and Effect-typed.
- LOC baseline (source, excluding tests/vendor/dist): src/domain 1085,
  src/config 136, src/planner 2656, src/targets 2073, src/artifacts 100,
  src/host 733, src/workflows 1593, apps/release-ts/src 966,
  apps/ts-release-action/src 766, scripts 1821, apps/release-ts/scripts 1637.
  Total ≈ 13.7k.

GoReleaser's shape (the model to adapt, not copy blindly):

- A single `Context` + a typed, filterable **artifact list** flow through an
  ordered pipeline of **pipes**. Each pipe: a name, a skip decision with a
  human-readable reason, and a run step. Pipes produce artifacts; downstream
  pipes consume filtered artifacts (`ByType`, by platform, ...).
- Config sections map 1:1 to pipes (`builds`, `archives`, `checksum`,
  `changelog`, `release`, `brews`, `scoops`, `nfpms`, `dockers`, `announce`,
  ...). Each pipe owns its **own defaults** — there is no central normalizer.
- Commands: `init`, `check`, `healthcheck`, `build`, `release`, with
  `--snapshot` and `--skip=<phases>`.
- Feature split (verified against goreleaser.com/pro on 2026-07-03): Pro-only
  includes **npm registry publishing**, split/merge builds, monorepo support,
  nightly builds, config includes, prebuilt binary import, macOS
  signing/notarization/DMG/PKG/App bundles, MSI, artifact `if` filtering,
  `.Artifacts` template access, custom template variables, global after
  hooks, changelog preview, cross/pre-publish hooks. Free/OSS includes:
  builds, universal binaries, archives, checksums, signs, SBOMs, nfpms,
  snapshot, changelog, GitHub/GitLab/Gitea releases, brews, scoops, winget,
  chocolatey, AUR, nix, dockers, blobs, custom exec publishers, announce.
  Note ts-release already ships npm AND PyPI publishing — features GoReleaser
  gates behind Pro or lacks. The design should surface this as positioning.

Repo conventions that bind this design (from `AGENTS.md` / `ARCHITECTURE.md`):
Bun for everything; Effect packages aligned on beta versions;
`Schema.Class`/`TaggedClass`/`TaggedErrorClass` for durable data and errors;
`Effect.fn` for reusable operations, `Effect.gen` for workflow bodies; layers
at CLI/runtime/test boundaries; publish operations stay data until approved;
`.repos/effect` untouchable.

## Decided contract inputs (121 concretization pass, 2026-07-03)

The plan-121 spec-extraction report landed at
`plans/research/121-goreleaser-spec.md`, pinned to GoReleaser `v2.16.0`
commit `d76fb400136f96af3aaa7202776257885c9a6097`. Together with the Effect
v4 probe it completes the concretization gate: the decisions below are
**made**, not proposed. Where they conflict with older draft text in Steps
1-5, this section wins. `§N` cites the report's sections. The executor's
remaining latitude is the short list at the end — everything else is
encoding work. Throughout, remember the framing: GoReleaser is the best
case study, not the target. Adopt where their shape is ecosystem load-
bearing (naming, semantics users' tooling depends on); diverge where our
primitives (typed TS config, plan-first execution, serializable state)
make their mechanism unnecessary — and record which is which.

- **D1 — Default artifact naming is a compatibility contract; adopt
  GoReleaser's defaults byte-for-byte.** When archives/checksums are
  enabled, defaults are placeholder translations of their exact strings
  (§7, §8): archive `{name}_{version}_{os}_{arch}` + format extension;
  checksum file `{name}_{version}_checksums.txt`; checksum line format
  `<hex>` + TWO spaces + `<basename>` + `\n` (sha256sum/`shasum -c`
  compatible — the two spaces are load-bearing). In artifact names,
  `{os}`/`{arch}` render **distribution tokens** (`linux`/`darwin`/
  `windows`, `amd64`/`arm64`) mapped from the canonical config vocabulary
  (`x64` → `amd64`; mapping defined once, jointly with plan 119).
  Rationale: release-asset naming is an ecosystem interface — the
  installer-inference rules (ubi/eget/cargo-binstall/mise, the 120B row)
  and a decade of human habit are trained on GoReleaser's spelling; any
  installer that can consume a GoReleaser release can then consume ours.
  Their per-variant suffixes (`v{arm}`, amd64 `v1` elision — §7) are not
  reproduced: no builder of ours exposes those axes in 0.1.
- **D2 — Archives and checksums are explicit sections; absence = skip.**
  Upstream inserts an implicit default archive and always checksums unless
  disabled (§2). We diverge: the kernel rule "no config section → skip
  notice" holds with **zero exceptions**. Rationale: their implicit
  defaults are why the `format: binary` pseudo-format (§7) and
  `checksum.disable` (§1.4) escape hatches exist — our null state IS the
  escape hatch; bare compiled binaries are the bun/deno distribution norm;
  and plan 116's port discipline (identical dogfood plan output) forbids
  new implicit behavior. `init` templates scaffold `checksum: {}` so new
  projects still get checksums by default in practice. Consequences:
  `format: "binary"` is not adopted as an archive format value, and when
  `archives` IS present its defaults are upstream's — `formats:
  ["tar.gz"]` (§1.3), `formatOverrides: [{ os, formats }]` shipped in 0.1
  (windows→zip as the documented example; plural `formats` only — their
  singular `format` is deprecated everywhere, §1.3), default included
  files = the six license/readme/changelog globs (§1.3, quiet when
  unmatched), grouping = one archive per platform containing that
  platform's binaries plus the default files (§7), and
  `wrapInDirectory?: boolean | string` — a typed union replacing their
  templated tri-state string with identical semantics (`true` = archive
  name; string = literal directory; §7).
- **D3 — Checksum section**: `{ algorithm?: "sha256" | "sha512" }`,
  default `sha256` (§1.4); name template per D1. Inputs = every
  release-uploadable artifact except checksum/signature kinds (§8).
  Their `split` mode and `extra_files` are post-0.1 matrix rows; the
  14-algorithm enum is not adopted (extendable literal union; YAGNI).
- **D4 — Snapshot version format**: `{version}-SNAPSHOT-{shortCommit}`,
  upstream's default verbatim (§3). **Correction**: earlier draft text in
  Step 2 recalled the upstream default as "{nextPatch}-SNAPSHOT-…" — the
  report refutes that; `.Version` is the *current* resolved version and
  next-patch is opt-in via their `incpatch` function. Ours applies the
  suffix over whatever the active `VersionSource` resolved (manifest or
  git-tag). Adopted semantics (§3): snapshot still builds, archives, and
  checksums locally; it never publishes (our executor refuses
  externally-visible + irreversible regardless of approval flags — as
  already specified); and the git-tag source degrades gracefully under
  snapshot when no repo/tag exists (their fake `v0.0.0` precedent)
  instead of failing.
- **D5 — git-tag `VersionSource` semantics** (encodes §4): discovery
  order is (1) explicit override — config option or env
  `TS_RELEASE_CURRENT_TAG` (their `GORELEASER_CURRENT_TAG` analog; the
  `TS_RELEASE_*` prefix is the repo's established convention), (2) tag
  pointing at HEAD sorted `-version:refname`, (3) nearest ancestor tag
  (`git describe --tags --abbrev=0`). Version = tag with one leading `v`
  stripped; the tag itself stays on the identity. The version must parse
  as semver — failure is a typed error naming the tag (their message
  pattern); the prerelease component is retained and feeds D6's
  `prerelease: "auto"`. No tag = typed error whose message names the way
  out (theirs: "either add a tag or use --snapshot" — adopt the pattern
  with our flag names). Dirty worktree = error listing offending files
  (their `git status --porcelain` check; align with the existing plan-018
  dirty guard rather than adding a second). `tagPrefix` is the reserved
  per-project option for the monorepo design-ahead (their Pro
  `tag_prefix`, §4). Previous-tag discovery (`TS_RELEASE_PREVIOUS_TAG`,
  describe from `tags/<current>^`) is recorded for the changelog
  fast-follow, not needed in 0.1.
- **D6 — GitHub release section**: adopt `prerelease?: boolean | "auto"`
  — `"auto"` marks prerelease when the version carries a semver
  prerelease component (§1.7). Release name defaults to the tag (their
  `{{.Tag}}`). `draft` stays. Their `disable`/`skip_upload` templated
  bools are NOT adopted — section absence and the approval gates cover
  both (divergence recorded, see D-class below). `make_latest`,
  `target_commitish`, `replace_existing_draft` etc. are post-0.1
  config-layer rows; the report could not fully pin their client-side
  behavior either (§appendix) — when adding them, verify against the
  GitHub API, not against GoReleaser.
- **D7 — Homebrew stays a FORMULA in 0.1; section name stays
  `homebrew`.** Upstream deprecated `brews` (formula) in favor of
  `homebrew_casks` (§1.8, §6). We deliberately do not follow: casks do
  not exist on Homebrew-on-Linux, and Linux brew users are in scope for
  cross-platform CLI distribution; formulas remain fully supported for
  third-party taps. Divergence recorded with a revisit trigger: if
  Homebrew supports casks on Linux or deprecates tap formulas, a
  `style: "cask"` renderer lands inside the same neutral section name,
  additively. What we DO adopt from their brew/cask pipes (§6): candidate
  selection by platform from the catalog (not config-wired artifact ids —
  already 116's direction); the multi-platform formula shape (`on_macos`/
  `on_linux` with `Hardware::CPU.intel?`/`.arm?` stanzas — our renderer
  already emits `on_macos`); "more than one artifact per os/arch is a
  config error" validation; sha256 values from the catalog; default
  install = one `bin.install` per binary with `install` as the override;
  commit-message default `Brew formula update for {name} version {tag}`
  (§1.8, placeholder-translated).
- **D8 — Scoop**: the behavior-preserving 116 port keeps today's
  single-URL manifest; the first post-port improvement (recorded in the
  matrix, not smuggled into the port) is their multi-arch shape —
  `architecture: { "64bit" | "arm64" | "32bit": { url, hash, bin } }`
  with their arch mapping (§6). Divergence kept: bare-exe URLs remain
  supported (upstream requires Windows archives; Scoop itself does not).
  Commit-message default `Scoop update for {name} version {tag}` (§1.9).
- **D9 — The `builds[]` discriminator is named `builder`** (their exact
  field, enum `go|rust|zig|bun|deno|node|uv|poetry`, Pro adds `prebuilt`
  — §1.2). The Step 2 draft and plan 119's examples said `tool:` —
  renamed, for two reasons: null hypothesis (it is upstream's field), and
  upstream separately uses `tool` to mean "the executable to invoke" —
  reusing their word with different semantics is a migration trap. Our
  0.1 enum: `"bun" | "command" | "prebuilt"` (plan 119). Their
  `tool`/`command` executable overrides become builder-option rows
  post-0.1.
- **D10 — The templated-scalar field class collapses (divergence class,
  recorded once).** Upstream has a recurring pattern: fields typed
  "string, actually a templated boolean" (`build.skip`,
  `checksum.disable`, `release.disable`, `skip_upload`,
  `no_unique_dist_dir`, …) because YAML has no functions. Our equivalent
  is TypeScript: conditional configuration is computed *before* decode,
  so every such field becomes a plain boolean or disappears. Record this
  ONCE as a divergence class in the contract's divergence table; do not
  write per-field records for its members. It is also the honest answer
  to "where did the template DSL go" alongside the Step 1 worked example.
- **D11 — Skips are reason-bearing data; no `--skip` flag.** Adopt their
  reason-string discipline and multi-reason aggregation
  (`pipe.ErrSkip` + `SkipMemento`, §10): `PipeNotice` carries pipe id +
  reason; a pipe may contribute several; plan output and evidence render
  them. Their two skip mechanisms (static `Skip(ctx)` vs runtime error)
  collapse to one: the kernel emits the notice for absent sections, and
  `plan()` returns notices for runtime skips. The CLI `--skip=<keys>`
  surface (20+ validated keys, §10) is NOT adopted in 0.1: plan-only
  default + risk gates + computed config cover its real uses. Divergence
  recorded.
- **D12 — Serializability rule gets teeth (anti-precedent recorded).**
  Upstream hides a *function* in artifact metadata (`ExtraRefresh`,
  omitted from JSON serialization) so checksums can be regenerated when
  later pipes mutate artifacts (§5, §8). Forbidden here by construction:
  `ReleaseState` is fully serializable (no function-valued fields — the
  Effect probe's method-free rule), and **artifacts are immutable once
  contributed** — a pipe that transforms an artifact contributes a NEW
  artifact with provenance. Checksum correctness comes from phase order
  (checksum runs after all artifact-producing local pipes), not from a
  refresh callback. State this in the kernel contract; it is what makes
  plan-as-data, resume, and split/merge trustworthy.
- **D13 — Typed extras, concretized** (§5 field inventory × the Effect
  probe's tagged-union decision). Initial per-kind extra classes:
  executable `{ binary, extension, builderId, dynamicallyLinked? }`;
  archive `{ format, wrappedIn?, binaries, files }`; checksum-file
  `{ algorithm, coversArtifactIds }` (their `ChecksumOf`; never their
  `Refresh` — D12); catalog-file `{ catalog, repository }` — referencing
  the owning config section, NOT embedding a config copy the way their
  private `BrewConfig`/`ScoopConfig` extras do (config duplicated into
  state is drift waiting to happen); package/wheel extras keep the shapes
  the 115/116 ports carry over (upstream's PyWheel extras were never
  pinned — §appendix — so ours are ours). Their `ByID`
  always-matches-some-types filter quirk (§5) is not adopted: catalog
  filters are plain predicates over typed fields, no type-conditional
  magic.
- **D14 — Placeholder vocabulary pinned for 0.1** (extension = contract
  revision): `{name}`, `{normalizedName}`, `{version}`, `{tag}`,
  `{commit}`, `{shortCommit}`, and per-artifact `{os}`, `{arch}`,
  `{libc}`, `{targetTriple}`, `{binary}`. Rendering of `{os}`/`{arch}` in
  artifact names per D1. This list covers every default adopted in D1-D8;
  anything richer is TypeScript (existing template stance).
- **D15 — Host-vs-publish (120B consideration) resolved: no phase
  split.** The risk grades already encode dist/cargo-dist's Host/Publish
  boundary (`externally-visible` ≈ host: undoable while draft;
  `irreversible` ≈ publish/announce), and the two approval flags already
  give the operator the two-stage lever per run. A structural phase split
  would duplicate that. Instead: plan rendering MUST group operations by
  risk grade with an explicit divider ("everything above this line can
  still be undone") — presentation, not architecture. Encode in Step 2's
  phase-order text and hand the rendering requirement to plan 117.
- **D16 — `project.name` resolution**: explicit config wins; else the
  package-manifest name; else a hard error whose message says exactly
  what to add (their defaulter chain and error-text pattern, §2). Their
  wider guess chain (Cargo, Go module, git remote) is not adopted — the
  TS manifest is the one natural source here, and remote-derived guessing
  is surprise. Divergence recorded.
- **D17 — No config schema-version integer.** Their `version: 2` gate
  with its exact unsupported-version error (§1.1) is solving a YAML
  problem; our `$schema` URL + typed decode with precise errors is the
  migration lever, and a future breaking config revision ships a new
  schema URL with the major version. Adopt only the UX principle: decode
  errors name what was expected. Divergence recorded.
- **D18 — Target file structure (added by the 2026-07-03 open-ideas
  review; same authority as D1-D17).** The 0.1 module tree is decided —
  one directory per architectural ROLE, one invariant per directory,
  flat within. This is the post-117 target; plans 115-117 own the moves
  per their existing steps, and any current `src/` file not named below
  is deleted by 117's end or explicitly reported as residual.

  ```txt
  src/
    index.ts            # the only package entry: defineRelease + config types
                        #   + JSON schema + plan/build/release/verify + summaries
    api/                # the ONLY Promise/Effect boundary (D19)
      api.ts            #   four verbs: runtime assembly + runPromise, nothing else
      errors.ts         #   ReleaseApiError (collapses tagged engine errors)
    config/
      schema.ts         # COMPOSES per-pipe section schemas into ReleaseConfig
    pipeline/           # the kernel: serializable data + pure functions; zero I/O
      state.ts          #   ReleaseState + PipeNotice
      artifact.ts       #   Artifact + per-kind typed extras (D13)
      catalog.ts        #   filter combinators
      operation.ts      #   Operation + risk grades (moves from domain/)
      pipe.ts           #   Pipe interface + PipeContribution
      pipeline.ts       #   THE ordered pipe array — the one file that knows order
      runner.ts         #   the fold
      template.ts       #   D14 placeholders + the D1 name-token mapping
      identity/
        source.ts       #   VersionSource seam + modifier type (snapshot)
        manifest.ts     #   0.1 source
        git-tag.ts      #   0.1 source (D5)
    builders/           # every file exports exactly one Builder (119)
      builder.ts        #   Builder interface + static registry
      targets.ts        #   canonical PlatformTarget vocabulary + normalization
      bun.ts / command.ts / prebuilt.ts
    pipes/              # flat; every file exports exactly one Pipe
                        #   PLUS its config section schema and defaults
      build.ts          #   generic build pipe consuming builders/
      npm-pack.ts / pypi-wheel.ts
      archive.ts / checksum.ts                  # NEW (116)
      catalog-homebrew.ts / catalog-scoop.ts    # render templates live inside
      publish-github.ts / publish-npm.ts / publish-pypi.ts
      publish-homebrew.ts / publish-scoop.ts
    engine/             # the only executor of operations
      executor.ts / evidence.ts                 # move from planner/
      stager.ts         #   ArtifactStager escape hatch + wheel/zip writer
      github-api.ts     #   Effect GitHub REST layer (moves from targets/)
    host/               # injected platform services (unchanged; absorbs
                        #   internal/workspace-path.ts)
    workflows/
      init.ts           # init + doctor stay workflow-level (117)
    types/
      effect-internal.ts  # unchanged mechanical re-export
  ```

  Import-direction rules (the enforceable architecture — encode as grep
  checks in 115-117's verifies): `apps/*` import `src/index.ts` only
  (plus their own runtime layers); `api/` → engine/pipeline/config/host
  (layer assembly); `engine/` → pipeline + host; `pipes/` and
  `builders/` → pipeline types ONLY — never engine, never host (pipes
  plan, they never execute); `pipeline/` → effect + itself; `config/` →
  the pipes' exported section schemas (composition). Feature locality
  follows: adding a feature touches its pipe file + one line in
  `pipeline.ts` + one composition line in `config/schema.ts` — which is
  what 116's ≤5-lines-outside extension-cost target measures.
  `src/domain/`, `src/planner/`, `src/targets/`, `src/artifacts/`, and
  `src/internal/` do not exist in the target tree.
- **D19 — Effect-native public API: instinct honored internally,
  exposure still deferred (open-ideas review, 2026-07-03).** The
  question "isn't Effect-native the simplest API, with Promise as a
  facade?" is answered in two halves. Internally, YES — and the contract
  now makes it binding: the engine exposes four Effect-typed entry
  points that natively RETURN THE PUBLIC SUMMARY TYPES (plan-as-data
  means plain serializable data is the natural output) with tagged
  errors; `api/` adds ONLY runtime assembly, `runPromise`, and error
  collapse — zero result-mapping of its own. The Promise layer is a
  projection, not a parallel implementation, and it is load-bearing
  product code either way (the CLI and Action are its first two
  consumers). Externally, NO for 0.1, reaffirmed with the full
  rationale: `effect` is a hard dependency pinned to `4.0.0-beta.83`;
  Effect types in the public surface couple our semver to a beta's type
  churn, and force version-matching (and Effect literacy) on the 120B
  target audience — TS/Bun CLI authors, mostly not Effect users; a
  consumer with a second Effect version in `node_modules` gets the
  worst type errors in the ecosystem as their first impression. Because
  of the projection rule, the future exposure is additive and
  zero-redesign: a `@mannyc1/ts-release/effect` subpath exporting the
  same entry points. Trigger: Effect 4 stable AND a concrete external
  Effect consumer; record honestly that subpath consumers must satisfy
  the package's own `effect` range (subpath exports cannot carry their
  own peer deps).

**Step 3 matrix additions** (beyond the existing must-cover list): npm
*binary* distribution — GoReleaser Pro's `npms` publishes platform
binaries as npm packages (docs-derived only, §1.10; no OSS source):
distinct from our existing real-package npm publishing; post-0.1, one
pipe (esbuild-style platform packages + `optionalDependencies`), marked
docs-derived. Publish continue-on-error / fail-fast (their publisher
`ContinueOnError`, §10): executor policy row, post-0.1. Checksum `split`
+ `extra_files` (§1.4): post-0.1 config-layer. The changelog fast-follow
row records §1.6 as its schema baseline (default `use: git`; entry format
templates; include-overrides-exclude filters; ordered groups with a
catch-all; sort ∈ {'', asc, desc}; abbrev) plus §4's previous-tag
semantics.

**What remains open to the 114 executor** (the full list): the
per-section field tables — a mechanical null-hypothesis pass against the
report's §1 tables honoring D1-D19, with deprecated upstream fields
excluded per the 121 brief rule; the worked TypeScript
per-artifact-conditionals example (120A caveat); the monorepo `projects[]`
wrapper paragraph; the parity-matrix prose; the SPEC/ARCHITECTURE
direction sections; and the LOC budget numbers (unchanged from Step 5).
Nothing else is open — the strategic calls are made.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Inspect current seams | `rg -n "TargetAdapter|ArtifactRecipe|normalizeRelease|Effect.fn" src apps/release-ts/src \| head -50` | review manually |
| Markdown hygiene | `git diff --check -- plans SPEC.md ARCHITECTURE.md` | exit 0 |
| Plan index review | `sed -n '1,80p' plans/README.md` | 114 ordered before 115-117 |

## Scope

**In scope**:

- Write the architecture contract as a new section or appendix of this plan
  file (or sibling `plans/114-pipeline-contract.md`).
- Update `SPEC.md` and `ARCHITECTURE.md` to describe the pipeline
  architecture as the intended direction (a short "Direction: 0.1" section;
  do not rewrite the documents wholesale — the current text stays accurate
  until 115-117 land).
- Patch plans 115-117 where their instructions conflict with decisions made
  here.
- Update `plans/README.md` ordering/dependency notes.

**Out of scope**:

- Any source-code edit. Any `package.json` edit. Implementing anything.
- Renaming CLI commands in code. Touching `.repos/effect` or `vendor/`.

## Git workflow

- Branch: `codex/114-pipeline-architecture-design`.
- Commit style: imperative sentence case, e.g.
  `Design pipeline architecture and 0.1 API contract`.
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 0: Research prework (primary sources, read-only)

Two research checkouts inform every decision below. Facts already verified
on 2026-07-03 are listed so you do not re-derive them; your job is the
deeper mining.

1. **GoReleaser semantics — RESOLVED, read the 121 report**: the
   spec-extraction report (`plans/research/121-goreleaser-spec.md`,
   pinned to `v2.16.0` @ `d76fb400136f96af3aaa7202776257885c9a6097`) is
   the authority for config schema, defaults, snapshot/git/semver
   semantics, artifact extras, brew/scoop selection, archive/checksum
   behavior, builder targets, and the skip taxonomy — with `path:line`
   citations throughout, an adopt/diverge worksheet, and a not-found
   appendix for what it could NOT pin. Encode from the report and the
   "Decided contract inputs" section above; do not re-derive from
   recollection. A local clone is now optional, for spot-checks only
   (mirroring the `.repos/effect` convention — never commit, never
   modify, gitignored):

   ```sh
   git clone --depth 1 https://github.com/goreleaser/goreleaser .repos/goreleaser
   ```

   Verified already: full-release pipeline order is defaults/git/semver/
   snapshot early → before-hooks → build → universalbinary → upx →
   sign-binaries → changelog → archive → sourcearchive → nfpm/… → sbom →
   **checksums (after all packaging)** → sign → catalogs (aur, nix, winget,
   brew, cask, scoop, chocolatey — rendered BEFORE publish) → docker →
   **publish** → metadata → **announce last**. This validates this plan's
   phase order; keep checksum in `process` phase ordered after archive.
   Artifact system: 50+ types (they distinguish `Binary` vs
   `UploadableBinary`; `PyWheel` exists), filters `ByType/ByID/ByGoos/...`
   with `And/Or/Not` combinators, `Extra` as `map[string]any` with typed
   accessors (`MustExtra[T]`, `ExtraOr`). Adopt the combinator set
   (including `Not`/`Or` and filter-by-build-id); do NOT adopt the untyped
   Extra map — see the Effect task below.

2. **Effect v4 APIs — RESOLVED, read the probe report**: the local API
   probe (`plans/research/effect-v4-api-probe.md`, 2026-07-03, verified
   against the installed beta.83 package) settles the Effect-side
   questions; encode its decisions rather than re-deriving them. In
   particular: typed `extra` is a **tagged union of per-kind extra
   classes** in a single `extra` field (options b/c rejected with
   reasons); `decodeSync` returns plain objects, so state classes must be
   method-free data (behavior in functions) for resume/split-merge to
   work; `optionalKey` stays the convention; the Promise boundary is
   `ManagedRuntime.make` + `runPromise` with an explicit disposal story;
   Schema classes are not frozen — the contract must state the
   no-mutation discipline for state/catalog explicitly.

**Identity resolution is a strategy seam, not a hardcoded read
(maintainer directive, 2026-07-03).** GoReleaser derives the version from
repo state through policy — current tag, tag sorting (Pro: smart SemVer
sorting), tag prefixes for monorepo, snapshot/nightly version templates —
while ts-release today hardcodes manifest reading (the vestigial
two-member `ReleaseIdentitySource` union in `src/domain/release.ts:48-72`
is the seed; the pre-cutover strategy layer from plans 069-071 was deleted
by plan 111 — do not resurrect its code, but read those plan files for
lessons). Design the identity stage as the kernel's second strategy seam
(alongside builders):

```ts
interface VersionSource<Options> {            // pure-ish: read-only host access only
  readonly id: string                         // "manifest" | "git-tag" | later: "conventional-commits",
                                              //   "changesets" (intent files), "release-please-manifest",
                                              //   "github-pr-labels" (auto-style), "explicit"
  readonly resolve: (options: Options, workspace)
    => Effect<ResolvedIdentity, IdentityError>  // reads files/git via injected services; never writes
}
// Modifiers transform a resolved identity — snapshot and (later) nightly
// are modifiers, not sources:
type IdentityModifier = (identity: ResolvedIdentity) => ResolvedIdentity
```

Config selects the source (`versionFrom`, default `"manifest"` — the TS
ecosystem norm and what npm/PyPI publishing must match; record THAT as the
default-choice rationale, not as an excuse to hardcode). Requirements: 0.1
ships `manifest` AND `git-tag` sources (git-tag is the GoReleaser null
hypothesis and cheap — research `internal/pipe/git/` and
`internal/pipe/semver/` for tag parsing/sorting semantics); snapshot (this
plan) is a modifier over any source; sources are per-project-pluggable
(the monorepo design-ahead requirement — tag prefixes become a git-tag
source option); adding a later source — conventional-commits,
changesets-style intent files, release-please manifest maps, or auto-style
PR labels (all validated as live demand by
`plans/research/120B-competitive-landscape.md`) — must be one adapter, no
kernel change. Doctor should report which source resolved the version and
from what evidence.

**Verify**: the contract cites at least three facts each from the 121
report (by section) and the Effect probe; if `.repos/goreleaser` was
cloned for spot-checks, `git status --short` shows NO tracked-file
changes (`.repos/` is ignored).

### Step 1: Write the kernel contract (context, state, catalog, pipe)

Produce concrete TypeScript signatures (documentation, not implementation).
Use this draft as the baseline; deviate only with recorded rationale.

The kernel is three data types and one interface:

```ts
// Immutable, serializable release state — threaded through the pipeline as a
// fold. Serializability is load-bearing: it is what makes plan-as-data,
// evidence, resume, and (later) GoReleaser-Pro-style split/merge builds
// possible.
class ReleaseState extends Schema.Class<ReleaseState>("ReleaseState")({
  identity: ReleaseIdentity,          // name, version, commit, tag, notes
  artifacts: ArtifactCatalog,         // grows as pipes contribute
  operations: Schema.Array(Operation), // grows as pipes contribute
  notices: Schema.Array(PipeNotice)    // skip reasons, warnings — evidence-visible
}) {}

// One artifact type family, replacing ArtifactIntent / ArtifactInventoryItem /
// recipe-specific classes. `kind` is the filter axis (GoReleaser's artifact.Type).
class Artifact extends Schema.Class<Artifact>("Artifact")({
  id: ArtifactId,
  kind: Schema.Literals(["executable", "archive", "package", "wheel",
    "checksum-file", "catalog-file", "sbom", "signature", "file"]),
  path: Schema.String,                // {version}-templated until expansion
  producedBy: Schema.String,          // pipe id — provenance for evidence
  platform: Schema.optionalKey(InstallableArtifactVariant),
  checksum: Schema.optionalKey(Checksum),
  extra: ...                          // pipe-specific typed metadata
}) {}

// Catalog = artifacts + pure filter combinators (byKind, byOs, byConsumer,
// byProducer, and). ~50 lines. This is the lingua franca between pipes.

// The single extension seam. EVERY feature is a pipe.
interface Pipe<Section> {
  readonly id: string                              // "build:bun", "publish:npm", "archive"
  readonly phase: PipePhase                        // see Step 2
  readonly section: (config: ReleaseConfig) => Section | undefined
                                                   // its config slice; undefined => skip
  readonly defaults?: (section: Section, identity: ReleaseIdentity) => Section
                                                   // per-pipe defaulting — replaces normalize-release.ts
  readonly plan: (section: Section, state: ReleaseState)
    => Effect.Effect<PipeContribution, PlanError>  // artifacts + operations to append
}
```

Binding decisions the contract must state explicitly:

1. **Pipes plan; the executor executes.** Pipes never touch the filesystem,
   network, or processes. They emit `Operation` data (including build
   commands, archive/checksum instructions, file renders). The existing
   risk-graded executor remains the only thing that executes, with the
   existing gates: `build` runs operations up to `writes-local`; `release
   --execute` adds `externally-visible`; `--approve-publish` adds
   `irreversible`. This keeps GoReleaser's uniformity while preserving the
   plan-first safety model — and it means "snapshot mode" and "skip flags"
   are executor policy, not per-pipe code. Where an operation is not
   expressible as a command or HTTP request (e.g. wheel zip assembly), the
   contract defines a `StageArtifactOperation` executed through an injected
   `ArtifactStager` service — the only sanctioned escape hatch, and the new
   home for the logic currently in `apps/release-ts/src/runtime/*-recipes.ts`
   (which moves into the library).
2. **The pipeline is a static ordered list** (like GoReleaser's
   `pipeline.Pipeline`): a plain array in one file. No dynamic
   registration, no plugin discovery in 0.1. Adding a feature = write the
   pipe module + add one line to the array + add one config section.
3. **Defaulting is distributed.** `normalize-release.ts` dissolves; each
   pipe's `defaults` owns its section. What remains central is only identity
   resolution (version/commit/tag from manifest+git; per-project-pluggable —
   see the monorepo design-ahead note in Step 2) and template expansion.
   **Template stance (maintainer decision, 2026-07-03)**: a fixed
   named-placeholder vocabulary only — pinned by D14: `{name}`,
   `{normalizedName}`, `{version}`, `{tag}`, `{commit}`, `{shortCommit}`,
   plus per-artifact `{os}`, `{arch}`, `{libc}`, `{targetTriple}`,
   `{binary}` (name-token rendering per D1). No
   template mini-language, now or later: the expressiveness escape hatch is
   TypeScript itself — config is authored via `defineRelease`, so users
   compute strings with real functions instead of learning a DSL. Document
   the consequence honestly: file-based JSON configs are limited to the
   placeholder vocabulary; anything richer requires the TS authoring path
   (inline config through the public API in 0.1).
   **120A caveat (BET #2 verdict: validated WITH caveat)**: advanced
   GoReleaser users rely on template power for per-artifact conditionals
   and naming; dropping the DSL under-delivers unless TS matches that
   expressiveness. The contract must therefore include a worked example of
   per-artifact conditional naming/selection written in TypeScript via
   `defineRelease` (e.g. computing artifact names per os/arch, including
   an artifact only for some targets) with ergonomics at least equal to
   the Go-template equivalent — shown side by side.
4. **Skips are data.** A pipe with no config section contributes a
   `PipeNotice` ("archives: skipped — not configured"), visible in plan
   output and evidence, mirroring GoReleaser's skip reporting.
5. **Decide the two-stage binding rule explicitly (plan-first's known
   weak spot — do not leave it implicit).** Some operation inputs only
   exist at execution time: artifact checksums, docker digests, signing
   outputs, API-returned asset ids. Today the codebase answers this with
   *phase-ordered concreteness* — plans are fully concrete data, and
   later-phase planning happens after earlier phases executed (e.g.
   `RenderFileOperation.contents` is resolved text, and the Homebrew pipe
   requires real sha256 values at plan time —
   `src/targets/homebrew.ts:142`); predictable values (GitHub download
   URLs) come from config. The contract must state the 0.1 rule
   (recommended: keep phase-ordered concreteness — simpler, honest, and
   sufficient for every 0.1 pipe including checksum/archive) AND the
   documented trigger for revisiting it: the first pipe needing a value
   that is neither predictable nor available from a prior phase in the
   same invocation (docker digest → manifest, signing output → catalog)
   gets a deliberate deferred-value design (placeholder resolved by the
   executor, resolution recorded in evidence) — not a per-pipe hack. Note
   the rehearsal consequence honestly in the contract: a plan rendered
   before `build` shows later-phase operations with declared-but-not-yet-
   concrete inputs; that is still a faithful "what will happen" statement
   because execution consumes the same plan data.

**Verify**: the contract text contains all four decisions, the three
data-type signatures, and the `Pipe` interface with a worked example (the npm
pipe expressed in the new contract, derived from the current
`src/targets/npm.ts:126-162` which already has the right emit-operations
shape).

### Step 2: Fix the pipeline phase order and map every config section to a pipe

Define the phase enum and the 0.1 pipeline:

```txt
defaults   → (per-pipe, in pipeline order)
identity   → resolve version/commit/tag (from package.json + git)
build      → build:bun, build:npm-pack, build:pypi-wheel   [writes-local ops]
process    → archive, checksum                              [writes-local ops]  ← NEW in 0.1
catalog    → catalog:homebrew, catalog:scoop (render formula/manifest files)
publish    → publish:github, publish:npm, publish:pypi,
             publish:homebrew, publish:scoop                [externally-visible/irreversible ops]
verify     → verify:* (read-only remote checks, from existing VerifyRemoteOperation data)
```

**Host-vs-publish consideration (from 120B — decide and record):**
dist/cargo-dist splits "Host" (upload artifacts to the release host —
semi-reversible while a draft) from "Publish" (announce to package
managers — irreversible). Evaluate whether our `publish` phase should
split the same way: it maps naturally onto the existing risk grades
(`externally-visible` vs `irreversible`) and would make plan review
clearer ("everything above this line can still be undone"). If rejected,
record why; if adopted, the phase list and 116's pipe assignments update
accordingly.

Then write the config mapping table: for each section of the 0.1
`defineRelease` config, the owning pipe, and whether it exists today or is
new.

**Config decision rule (maintainer directive, 2026-07-03)**: GoReleaser's
config schema is the null hypothesis. For each section, start from
GoReleaser's shape and naming; diverge ONLY where you can record a concrete
rationale that our shape is an improvement (type-safety win from
TypeScript, a safety-model requirement, or a real ergonomic defect in
theirs) — never from taste or incumbency of our current shape. Record each
divergence and its rationale in a "divergences from GoReleaser" subsection;
an empty subsection is a valid outcome. The point: do not invest
architecture in a home-grown shape if theirs is better — adopt, then
improve.

**Monorepo design-ahead (maintainer decision, 2026-07-03)**: no
implementation in 0.1, but the config and identity design MUST be
extensible to multi-project releases without breaking the single-project
shape: keep single-project as the default authoring form, make identity
resolution per-project-pluggable in the kernel, and check every top-level
schema choice against "could a `projects[]` wrapper contain this
unchanged?". Record the intended future wrapper shape in one paragraph.

**Snapshot mode is in 0.1 scope (maintainer decision, 2026-07-03)**: define
its semantics here — a snapshot run derives a fake, clearly-marked version
(decided per D4: `{version}-SNAPSHOT-{shortCommit}`, upstream's default
verbatim — note the earlier "{nextPatch}-…" recollection was wrong, see
D4), plans and builds normally, and the executor refuses
externally-visible and irreversible operations regardless of approval
flags. Snapshot is identity-stage policy + executor policy, not a pipe.

Draft shape to start from — the design must finalize it against the
decision rule above:

```ts
export default defineRelease({
  project: { name, repository, notes },         // as today
  builds: [{ builder: "bun", entry, targets }], // array; discriminator named per D9
  archives: [...],                              // NEW → archive pipe; absent = skip (D2)
  checksum: { algorithm: "sha256" },            // NEW → checksum pipe; absent = skip (D2)
  publish: { github, npm, pypi, homebrew, scoop },  // as today
  evidence: "..."                               // as today
})
```

**Verify**: every current config capability appears in the mapping table with
its pipe; `archives` and `checksum` are marked NEW (implemented in plan 116);
no section maps to more than one pipe.

### Step 3: Write the GoReleaser feature-parity matrix

**Framing rule (maintainer directive, 2026-07-03)**: GoReleaser's free/Pro
split is their PRICING boundary, not an architectural category. Do not use
"Pro" as a synonym for "out of scope" or "later". The matrix is a stress
test of this architecture: every row — free or Pro — must state its
**architectural cost here**, and Pro rows where that cost collapses to
trivial are the design's proof of superiority, to be called out as such.

A table with columns: GoReleaser feature | GoReleaser tier (free/Pro —
recorded as market context only) | ts-release today | where it lands (pipe
id + config section) | architectural cost here (trivial-by-construction /
one pipe / one builder / config-layer / kernel-stressing) | milestone.

Must cover at minimum: builds, universal binaries, archives, checksums,
snapshot, changelog, GitHub releases, brews, scoops, winget, chocolatey,
AUR, nix, nfpms, dockers, blobs, signs, SBOMs, custom publishers, announce,
milestones — and Pro: npm publishing, monorepo, split/merge builds, nightly,
includes, prebuilt binaries, MSI/DMG/PKG/App bundles, artifact `if`
filtering, custom template variables, hooks, and the
`--prepare`/`publish`/`continue` staged-release workflow — plus the
"Step 3 matrix additions" from the Decided contract inputs section (npm
binary distribution, publish continue-on-error, checksum split/extra
files, the changelog schema baseline).

Rows that must be explicitly marked **trivial-by-construction**, with one
sentence naming the enabling property:

- staged prepare/publish/continue — IS ts-release's default model
  (plan-as-data + approved execution);
- split/merge builds — `ReleaseState` is serializable Schema data;
- `.Artifacts` template access and artifact `if` filtering — the catalog is
  data with filter combinators;
- prebuilt binaries — a run-nothing builder (plan 119, 0.1);
- config includes/reuse across repos — TypeScript imports and exported
  presets; GoReleaser Pro-gates `includes` (added per 120A: cross-repo
  config reuse is a distinct, evidenced demand, not a subset of
  "complexity");
- npm and PyPI publishing — already shipped.

**Positioning ranking (evidence update from
`plans/research/120A-goreleaser-sentiment.md`, filed 2026-07-03 — this
supersedes the earlier assumption that npm/PyPI-free is THE headline; the
contradiction is recorded here deliberately):**

1. **Lead wedge: the rehearsal/plan-first story.** 120A's clearest
   exploitable gap: GoReleaser has no trustworthy end-to-end dress
   rehearsal — its maintainer recommends forks/throwaway repos to test the
   full publish flow. Plan-as-data + risk-graded approval + snapshot is
   the direct fix. The matrix and all positioning copy lead with this.
2. **No Pro boundary, no closed-source binary in the supply chain.** 120A
   found Pro-boundary friction is broad (monorepo, split/merge, nightly,
   includes, staged commands) and the separate closed-source Pro binary is
   itself a supply-chain objection for compliance-minded teams. Pair with
   our machine-readable evidence artifacts.
3. **Typed, DRY config.** Config sprawl + YAML/Go-template debugging is
   120A's most frequent complaint (7 distinct sources); reuse-across-repos
   is Pro-gated upstream and free-by-construction here.
4. **npm/PyPI-free: supporting differentiator, not the lead.** 120A BET #1
   verdict was mixed/leaning-validated — comparison-page value and a trust
   signal, but not evidenced as a top conversion driver. Keep it in the
   matrix and comparison docs; do not build the headline on it.

Two further 120A-driven matrix instructions: rank a **changelog pipe**
(previewable, reviewable notes-as-data — 120A top-5 pain) as the FIRST
fast-follow after 0.1, ahead of any new publish channel; and add a
**diagnostics row** — structured errors tied to pipe/operation ids with
"why this operation was attempted" context, versus GoReleaser's
error-encyclopedia approach (our operations already carry descriptions and
provenance; the row states how that surfaces to users).

120B-driven additions (report at
`plans/research/120B-competitive-landscape.md`):

- **Adopted 0.1 positioning tagline**: *"GoReleaser-grade distribution for
  TypeScript/Bun CLI authors, with typed config and a reviewable publish
  plan."* The matrix's positioning column and all downstream docs use it.
- **The semantic-release objection must be answered in positioning
  copy**: for the target audience, "why not the normal JS tool?" is the
  first question (semantic-release: 23.9k stars, 132k+ dependent repos).
  The recorded answer: semantic-release automates npm versioning from
  commits; it is not a typed artifact-catalog distributor for compiled
  binaries, wheels, Homebrew, and Scoop — and ts-release can consume a
  conventional-commits version source later without competing on npm
  automation.
- **Add an install-side compatibility row**: artifact naming, checksums,
  and normalized target triples must be consumable by ubi / eget /
  cargo-binstall / mise asset-inference rules — the catalog's naming
  defaults are a compatibility contract, not cosmetics.
- **Add a generated-CI row**: dist generates a `release.yml` implementing
  its phases; ts-release's `init` already generates workflows — the row
  records converging them post-0.1 so generated CI calls the same
  plan/execute core the CLI uses.
- **dist/cargo-dist is ACTIVE** (query-seed correction from 120B) — treat
  it as the closest design competitor throughout, not an orphaned niche.

For every other row, one sentence showing where it lands (e.g. *signs: a
`process`-phase pipe filtering `byKind("archive"|"executable")`, emitting
`writes-local` cosign CommandSpecs*). Rows that genuinely stress the kernel
(monorepo, includes) get an honest note on what they'd require rather than
a hand-wave — those notes are design debts to resolve, not reasons to
defer thinking.

**Verify**: matrix present; every row has all six columns filled; at least
20 rows; the five trivial-by-construction rows are present with their
enabling properties; no row's milestone column reads "Pro" as a
justification.

### Step 4: Design the 0.1 public TypeScript API (the CLI wraps this)

Binding decisions, with the recommended answers:

1. **Two-layer API, projection-shaped (D19).** The public 0.1 surface is
   Promise-based; Effect stays internal (Effect 4 is beta — its types in
   the public API would make every Effect bump a breaking change for
   users, and would demand Effect literacy from the 120B audience). The
   binding shape: the engine's four Effect-typed entry points natively
   return the public summary types with tagged errors; the `api/` layer
   adds only runtime assembly + `runPromise` + error collapse — no result
   mapping of its own. The Effect-native public API is explicitly
   deferred as a future `/effect` subpath export of those same entry
   points (trigger: Effect 4 stable + a concrete external Effect
   consumer), recorded as a post-0.1 matrix row.
2. **Root exports** (target shape for plan 117):

   ```ts
   export { defineRelease }                       // exists
   export type { ReleaseConfig, ... }             // exists
   export { releaseConfigJsonSchema, renderReleaseConfigJsonSchema }  // exists
   // NEW — the programmatic engine, mirroring the CLI verbs:
   export declare function plan(options?: RunOptions): Promise<ReleasePlanSummary>
   export declare function build(options?: RunOptions): Promise<BuildSummary>
   export declare function release(options?: ReleaseRunOptions): Promise<ReleaseSummary>
   export declare function verify(options?: RunOptions): Promise<VerifySummary>

   interface RunOptions {
     config?: string | ReleaseConfig   // path or inline defineRelease value
     workspace?: string
   }
   interface ReleaseRunOptions extends RunOptions {
     execute?: boolean                 // default false — plan only
     approvePublish?: boolean          // default false — gates irreversible ops
   }
   ```

   Approval flags are ordinary API parameters with safe defaults —
   calling `release()` bare is as safe as `ts-release release` bare.
3. **Summary types are the stable contract** (extend the existing
   `ReleasePlanSummary` in `src/index.ts:23-28`); internal Schema classes
   never leak. Define `BuildSummary`, `ReleaseSummary` (per-operation id,
   description, risk, status: planned/executed/skipped/failed, evidence
   path), `VerifySummary`.
4. **The CLI becomes a flag-parser + formatter over exactly these four
   functions plus `init` and `doctor`** (which stay workflow-level). `render`
   dissolves: catalog rendering becomes `catalog`-phase operations executed
   under `build`/`release` (resolve the plan-112 deviation instead of
   documenting it). The GitHub Action calls the same four functions.
5. **Inline config is first-class**: `release({ config: defineRelease({...}) })`
   must work without a file — this is what "TypeScript API with a CLI
   wrapping it" means. File loading (JSON in 0.1; `ts-release.config.ts`
   loading stays deferred per plans/README.md) is a thin layer above.

**Verify**: contract shows the root export list, the four function
signatures, the summary type shapes, and the CLI→API command mapping table
including the `render` dissolution decision.

### Step 5: Set the LOC budget and the measurement command

Record the baseline table from "Current state" and set targets the
implementation plans are accountable to (architecture-driven, not golf):

- `src/planner` + `src/targets` + `src/artifacts` + `src/workflows`
  (6.4k today) → replaced by `src/pipeline` (kernel ≤ 400) + `src/pipes/*`
  (≤ 250 per pipe hard max, ~150 the expected norm, × ~12) +
  `src/builders/*` (≤ 500 total) + `src/engine` (executor+evidence+stager
  +github-api, ≤ 900) + `src/api` (≤ 250) ≈ **4.3k ceiling combined,
  including the new archive/checksum pipes** (the D18 tree is the module
  map; builders and api fit inside the same envelope because most pipes
  land well under the 250 max).
- `apps/release-ts/src/runtime/*-recipes.ts` (~800) absorbed into build
  pipes; the app keeps only argv/formatting/runtime assembly (≤ 700 total).
- Measurement command to embed in every implementation plan:
  `find src apps/release-ts/src apps/ts-release-action/src -name '*.ts' | xargs wc -l | tail -1`

**Verify**: budget table present with a per-module ceiling and the exact
measurement command.

### Step 6: Patch plans 115-117 and the index

Read plans 115-117; where their instructions conflict with decisions made in
Steps 1-5, patch the conflicting text (do not rewrite them). Update
`plans/README.md`: 114 ordered after 113, before 115-117; dependency notes
updated.

**Verify**: `git diff --check -- plans SPEC.md ARCHITECTURE.md` → exit 0;
`sed -n '1,80p' plans/README.md` shows 113 → 114 → 115 → 116 → 117 → 118.

## Test plan

Design-only; verification is textual per the Verify blocks above. No code,
no tests.

## Done criteria

- [x] Kernel contract exists: `ReleaseState`, `Artifact`/catalog, `Pipe`, the
      four binding decisions, and the npm worked example.
- [x] Pipeline phase order and complete config-section↔pipe mapping exist.
- [x] GoReleaser parity matrix exists (≥ 20 rows, free/Pro tagged, landing
      spot per row).
- [x] 0.1 public API contract exists: four Promise functions, summary types,
      CLI mapping, `render` dissolution, inline-config decision.
- [x] LOC budget table with measurement command exists.
- [x] `SPEC.md`/`ARCHITECTURE.md` gained a short direction section; no other
      rewrites.
- [x] Plans 115-117 contain no instruction conflicting with this contract.
- [x] `git diff --check -- plans SPEC.md ARCHITECTURE.md` exits 0.
- [x] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Preserving operations-as-data + approval gating appears impossible under a
  uniform pipe interface (this invalidates binding decision 1 — the design
  must not silently drop the safety model).
- The maintainer's GoReleaser-shaping intent appears to conflict with
  `SPEC.md`'s non-goals (e.g. a design choice would require becoming a
  general build system).
- You find plans 115-117 missing or already executed.
- Any step seems to require editing source code.

## Maintenance notes

- This contract supersedes plan 112's CLI contract where they conflict
  (notably: `render` dissolves instead of persisting as a deviation).
- Post-0.1 feature work should start from the parity matrix: pick a row,
  write the pipe. If a feature cannot land as a pipe, that is kernel
  feedback, not a reason to special-case.
- When Effect 4 stabilizes, revisit the deferred Effect-native public API as
  a new plan; the Promise layer stays regardless.
