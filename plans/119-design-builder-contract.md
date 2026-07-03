# Plan 119: Design the language-agnostic builder contract and the engine runtime capability matrix

> **Executor instructions**: This is a DESIGN plan. It edits documentation
> and plan files only — never source code. Follow it step by step, run every
> verification, and honor the STOP conditions. When done, update this plan's
> status row in `plans/README.md`.
>
> **Required reading before Step 1**: the finalized kernel contract in
> `plans/114-pipeline-contract.md` (Pipe
> interface, phase order, operations-as-data decision, config mapping). If
> plan 114 is not DONE, execute it first or STOP — this plan is a companion
> contract that plugs into 114's `build` phase.
>
> **Read "Decided contract inputs" (below, after Current state) before the
> Steps**: the 2026-07-03 concretization pass made decisions B1-B7 (target
> grammar, name-token mapping, per-builder operation forms,
> command/prebuilt shapes, the in-process `Bun.build` direction, the
> runtime matrix baseline, staged-artifact layout). Where any step's older
> draft wording conflicts, the B-decisions win. Encode, don't re-decide.
>
> **Drift check (run first)**:
>
> ```sh
> git diff --stat f1c90c0..HEAD -- src/domain/artifact.ts src/domain/operation.ts SPEC.md ARCHITECTURE.md plans/115-introduce-pipeline-kernel.md
> ```
>
> Plan 114 touched SPEC/ARCHITECTURE/plan files; that is expected. If
> `src/domain/artifact.ts` changed structurally, re-verify the "Current
> state" excerpts before proceeding; meaningful mismatch → STOP.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: LOW (documentation only)
- **Depends on**: 114 (kernel contract); feeds 115 (build pipes implement
  against this contract)
- **Category**: direction / architecture
- **Planned at**: commit `f1c90c0`, 2026-07-03
- **Output**: binding contract in `plans/119-builder-contract.md`

## Why this matters

The maintainer asked whether the build system should be abstracted, and over
what axis. Two abstractions are tangled and must be separated in writing,
because they have different answers:

1. **The runtime the engine runs ON** (Bun, Node, Deno, web — via
   `effect/platform`). The GitHub Action already runs the engine on Node
   while the CLI runs it on Bun. This axis is already mostly solved and
   should stay solved: pipes emit operations-as-data, so *planning* is pure
   and runs anywhere; *execution* needs host services (ChildProcess,
   FileSystem), which every platform except web provides.
2. **The toolchain a build INVOKES** (bun compile today; deno, node
   bundlers, Go, Cargo, Zig tomorrow). This is GoReleaser's "builders" axis
   — GoReleaser v2 ships builders for Go, Bun, Node, Rust, Zig, Deno, and
   Python/UV/Poetry behind one interface, plus a Pro "prebuilt" importer
   (verified against goreleaser.com 2026-07-03). Because ts-release builds
   are subprocess invocations expressed as `CommandSpec` data, a toolchain
   does NOT need to match the engine's runtime: the engine running on Node
   can plan and execute a `bun build --compile` command. Language-agnostic
   builds are therefore natural here — but only if the builder contract is
   designed before plan 115 hardcodes a bun-only shape.

This plan produces that contract: a canonical platform-target vocabulary, a
small `Builder` adapter interface, a generic exec/prebuilt escape hatch that
makes ANY language buildable on day one, and the runtime capability matrix
for the public API. Deliverable is documentation plus patches to plans
115-117 so the 0.1 implementation is built against the contract instead of
retrofitted later.

## Current state

(Verified at `f1c90c0`.)

- The canonical platform type already exists —
  `InstallableArtifactVariant` in `src/domain/artifact.ts:51-61`: `os`
  (`"linux" | "darwin" | "windows"`), `arch` (`"x64" | "arm64"`), optional
  `libc` (`"glibc" | "musl"`), `executableExtension`, `binaryName`,
  `installPath`, `targetTriple`.
- But the direction is inverted: config declares **bun-specific** triples
  (`BunExecutableCompileTarget`, `src/domain/artifact.ts:26-44`, e.g.
  `"bun-linux-x64-baseline"`) and the canonical variant is *derived* via a
  90-line switch (`bunExecutableCompileTargetVariant`,
  `src/domain/artifact.ts:145-233`). Every new toolchain added this way
  would introduce its own config-level triple vocabulary.
- The 114 contract's draft config already points the right way:
  `builds: [{ builder: "bun", entry, targets }]` — an array of build
  sections with a `builder` discriminator (named per 114 decision D9) and
  canonical-looking targets.
- Builds execute through operations: `CommandSpec`
  (`src/domain/operation.ts:13-19`: executable, args, requiredEnv,
  redactedEnv) run by the injected executor; plus the 114 contract's
  `StageArtifactOperation`/`ArtifactStager` escape hatch for work not
  expressible as a subprocess (wheel zip assembly).
- Engine runtime assembly: `apps/release-ts/src/runtime/` provides Bun
  layers (`@effect/platform-bun`); `apps/ts-release-action/src/runtime/`
  provides Node layers (`@effect/platform-node`). `src/` is
  platform-neutral and must stay so (`ARCHITECTURE.md` boundary rules).
- Doctor diagnostics (`doctor` command / workflow) already model
  tool-availability checks as data — builders must feed this.

Conventions: Bun for repo work; Effect beta alignment; Schema classes for
durable data; design docs live under `plans/`; `.repos/effect` read-only.

## Decided contract inputs (concretization pass, 2026-07-03)

Same pattern and authority as plan 114's D1-D19: the decisions below are
made — the executor encodes them into the contract prose and worked
examples; where a Step's older draft wording conflicts, B-decisions win.
Provenance: the maintainer's open-ideas review (in-process `Bun.build`
direction) plus facts verified against the installed toolchain — bun
`1.3.14`, pinned by `packageManager`; type citations are
`node_modules/bun-types/bun.d.ts:2594-2607` (the `Bun.Build.CompileTarget`
grammar) and `:3019-3076` (`CompileBuildOptions`) — and the current
source.

- **B1 — Canonical `PlatformTarget` grammar and initial list.** Grammar:
  `<os>-<arch>` with an optional `-musl` libc segment valid ONLY on
  linux — mirroring the per-OS constraints Bun's own type grammar
  encodes (no darwin/windows libc arm exists in bun-types). `os` ∈
  {linux, darwin, windows}; `arch` ∈ {x64, arm64}; glibc is the unmarked
  linux default. Initial list (8): `linux-x64`, `linux-x64-musl`,
  `linux-arm64`, `linux-arm64-musl`, `darwin-x64`, `darwin-arm64`,
  `windows-x64`, `windows-arm64`. The existing
  `InstallableArtifactVariant` scalars (os/arch/libc) already match —
  reuse them. Note `windows-arm64` IS grammatically valid in bun-types
  1.3.14 (`bun-windows-${Architecture}`) and already present in today's
  config enum, while GoReleaser's embedded list lacks it — our bun
  builder exceeds upstream's bun support on day one.
- **B2 — Name-token mapping (this contract owns 114 D1's table).**
  Canonical→asset-name tokens: `x64 → amd64`, `arm64 → arm64`, os names
  identity. Default-generated names append `_musl` when libc is musl
  (glibc unmarked, per ecosystem convention — this also prevents
  glibc/musl name collisions). Scope rule: the mapping governs ALL
  default-generated artifact names (bare binaries, archives, checksum
  files); explicit config paths/names always win — the dogfood config's
  current `x64`-spelled explicit asset names are therefore preserved
  through 0.1 (renaming our own published assets breaks install scripts
  and is a separate operator decision). Built-in default names are
  computed by pipe/builder code (defaults are functions, not template
  strings); the `{libc}` placeholder renders `musl`/`glibc` literally
  for user-authored templates. New kernel-adjacent rule: rendered
  artifact names must be unique across the catalog — a collision is a
  plan error (upstream analog: brew's one-archive-per-os/arch error,
  121 report §6).
- **B3 — Builder interface confirmed; operation forms pinned per
  builder.** The Step 2 draft interface stands. Emission: `bun` → one
  `StageArtifactOperation` per target carrying structured compile
  intent (B5); `command` → one `writes-local` `CommandSpec` per target;
  `prebuilt` → zero build operations — catalog artifacts plus one
  `read-only` existence-verification operation per target (so the plan
  shows the import and evidence records it).
- **B4 — `command`/`prebuilt` config shapes.**

  ```ts
  { builder: "command",  targets: [...], run: string | string[], output: string, binary?: string }
  { builder: "prebuilt", targets: [...], output: string, binary?: string }
  ```

  `run` string form is whitespace-split with NO quoting rules
  (documented; use the array form when an argument contains spaces);
  placeholders expand per argv entry AFTER splitting, never through a
  shell. `output` is the per-target path template whose existence the
  executor verifies (existing staged-path verification). `binary`
  defaults to `{name}`.
- **B5 — The bun builder is in-process-first: `Bun.build({ compile })`,
  not a shelled CLI (maintainer direction, 2026-07-03).** Grounding:
  the current recipe ALREADY compiles in-process
  (`apps/release-ts/src/runtime/bun-artifact-recipes.ts:39` calls
  `Bun.build`), and bun-types 1.3.14 supports `compile:
  { target, outfile, ... }` including cross-compilation — so plan 115's
  port is a move, not a rewrite. Binding consequences:
  1. The build operation is a `StageArtifactOperation` with structured
     compile intent (entry, canonical target, translated
     `CompileTarget`, outfile, options) — reviewable plan data, richer
     than a CLI flag string — executed by the injected `ArtifactStager`.
  2. **The translation table's output type is `Bun.Build.CompileTarget`**
     — bun-types' template-literal grammar. This supersedes any
     embedded-list mechanism: membership or grammar drift becomes a
     compile error on every bun upgrade. The evidence it matters:
     GoReleaser's embedded list orders `musl` BEFORE the SIMD variant
     (`bun-linux-x64-musl-modern`) while bun-types 1.3.14 orders SIMD
     first (`bun-linux-x64-modern-musl`), and the list lacks
     `bun-windows-arm64` which the grammar includes — drifted in both
     membership and structure. A typechecked table cannot do that.
  3. Translation is mechanical: `linux-x64 → bun-linux-x64`, …,
     `windows-arm64 → bun-windows-arm64`; the `bun.cpu?: "baseline" |
     "modern"` option appends the SIMD segment in its type-correct
     position. Default: unset → unsuffixed target, i.e. the toolchain's
     own default microarchitecture (GoReleaser hardcodes `-modern`
     defaults — divergence recorded: we do not embed a CPU policy that
     ages with hardware).
  4. 0.1 builder options: `{ cpu?, minify? }` (minify exists today).
     Recorded post-0.1 option rows, all already typed in
     `CompileBuildOptions`: `windows` executable metadata
     (icon/title/publisher/version — Windows branding adjacent to what
     upstream gates behind MSI tooling), `execArgv`, `executablePath`,
     and the `autoload*` flags.
  5. Doctor on the Bun runtime: the toolchain IS the engine runtime —
     report `Bun.version`; no PATH probing.
- **B6 — Runtime capability matrix baseline (cells decided; the
  executor formats the table and verifies the Deno claim).** Bun (CLI):
  all four functions; `build:bun` in-process per B5. Node (Action):
  `plan`/`release`/`verify` full; artifact STAGING remains unsupported
  in 0.1, preserving today's exact behavior
  (`UnsupportedNodeArtifactRecipeRegistryLayer` fails staging with a
  typed error — `apps/ts-release-action/src/runtime/node.ts:15-17`); a
  spawn-based Node bun stager is recorded as the first post-0.1 runtime
  row — deliberate, because CI compilation is fully served by the CLI
  step in generated workflows and the Action's 0.1 job is gated
  plan/release/verify. Deno: expected-compatible via platform-node
  compat — verify against `.repos/effect` or write "unverified"
  (unchanged instruction). Web: `plan` with inline config only; no
  build/release/verify (no ChildProcess/FileSystem); future
  docs-playground note, not 0.1.
- **B7 — Staged-artifact layout stays `.release/artifacts`** (divergence
  from upstream's `dist/<build.id>_<target>/` recorded): collision
  safety comes from B2's unique-name plan error plus the executor's
  staged-path verification, not from directory-per-target uniqueness —
  and `dist/` is already this repo's package build output.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Inspect current triple handling | `rg -n "BunExecutableCompileTarget\|targetTriple\|InstallableArtifactVariant" src/domain src/config \| head -30` | review manually |
| Markdown hygiene | `git diff --check -- plans SPEC.md ARCHITECTURE.md` | exit 0 |
| Index review | `sed -n '1,90p' plans/README.md` | 119 ordered between 114 and 115 |

## Scope

**In scope**:

- Write the builder contract and runtime capability matrix as sections of
  this plan file (or sibling `plans/119-builder-contract.md`). This plan's
  completed output is the sibling contract.
- Patch plans 115-117 where they conflict with the contract (115 Step 4-5
  especially).
- A short pointer in `ARCHITECTURE.md`'s direction section (one paragraph).
- Update `plans/README.md`.

**Out of scope**: any source-code edit; implementing any builder; adding
deno/go/cargo builders to the 0.1 milestone (0.1 ships `bun` + `command`;
the rest are matrix rows); changing the Action's runtime; `.repos/effect`.

## Git workflow

- Branch: `codex/119-builder-contract`.
- Commit style: imperative sentence case, e.g. `Design builder contract and
  runtime capability matrix`.
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 0: Research prework (primary sources, read-only)

The 121 spec report (`plans/research/121-goreleaser-spec.md`, pinned to
`v2.16.0` @ `d76fb400136f96af3aaa7202776257885c9a6097`) §9 covers builder
target handling end to end — encode from it; a `.repos/goreleaser` clone
is optional, for spot-checks only (never commit or modify it). Facts
verified 2026-07-03 from `pkg/build/build.go`, so you do not re-derive
them:

```go
type Builder interface {
    WithDefaults(build config.Build) (config.Build, error)
    Build(ctx *context.Context, build config.Build, options Options) error
    Parse(target string) (Target, error)
}
// Optional capability interfaces:
//   DependingBuilder  — Dependencies() []string   → maps to our doctor operations
//   PreparedBuilder   — Prepare(ctx, build) error → one-time toolchain setup
//   ConcurrentBuilder — AllowConcurrentBuilds()   → executor concurrency policy (post-0.1 note)
//   TargetFixer       — FixTarget(string) string  → our canonical→toolchain translation
```

Note the structural difference to preserve: their `Build` EXECUTES; our
builders PLAN (emit operations). Their optional-interface pattern is worth
copying as optional fields on our `Builder` rather than separate
interfaces.

Facts now pinned by the 121 report (§9) — use these instead of mining:

- **Each upstream builder owns its own target grammar** — Go
  `goos_goarch[_variant]`, Bun `bun-<os>-<arch>[-musl][-type]`, Deno
  `arch-vendor-os[-abi]` Rust-style triples. That inconsistency is a
  complexity users feel and is exactly what our single canonical
  `PlatformTarget` vocabulary fixes — cite it as the motivating contrast.
- **Bun**: upstream defaults are `linux-x64-modern`, `linux-arm64`,
  `darwin-x64`, `darwin-arm64`, `windows-x64-modern`; the full embedded
  list (17 entries) includes musl variants (`bun-linux-x64-musl`,
  `-musl-modern`, `-musl-baseline`, `bun-linux-arm64-musl`) — supporting
  our canonical `libc` axis — and `modern`/`baseline` CPU-level variants
  — supporting the `bun.cpu` builder option (their `goamd64 v1/v3`
  analog).
- **The staleness lesson**: GoReleaser validates bun targets against an
  embedded `targets.txt` that already lags Bun's own docs (no
  `bun-windows-arm64` while Bun's target table lists Windows arm64,
  docs-derived) — and drifts structurally too (see B5.2: their list
  orders `musl` before the SIMD variant; bun-types orders SIMD first).
  Consequences for our contract: for bun, the table is TYPED against
  `Bun.Build.CompileTarget` so drift is a compile error (B5); for future
  toolchains without a published type grammar, `supportedTargets` is a
  plain data table in the builder module (one obvious place to update);
  the unsupported-target error prints the table (decision 3 below); and
  the `command` builder is the documented escape hatch for targets a
  builder lags on.
- **Deno**: default and supported lists are the same five triples
  (`x86_64-pc-windows-msvc`, `x86_64-apple-darwin`,
  `aarch64-apple-darwin`, `x86_64-unknown-linux-gnu`,
  `aarch64-unknown-linux-gnu`) — a future `deno` builder covers our
  whole canonical matrix except windows-arm64 and musl.
- **`FixTarget` normalization precedent**: the Go builder appends default
  variant suffixes to incomplete targets (`_amd64` → `_amd64_v1`). Our
  analog: canonical targets normalize on parse (defaults for omitted
  `libc`), inside the builder translation, not in config.
- **Output-path precedent**: upstream writes to
  `dist/<build.id>_<target>/<binary><ext>` with a `no_unique_dist_dir`
  opt-out. Ours is DECIDED (B7): keep the `.release/artifacts` layout;
  divergence recorded there.
- **Per-target env/flags templating**: upstream templates env
  sequentially with earlier entries visible (`SetEnv` accumulation). Not
  adopted: computed TS config covers it — same family as the 114
  contract's D10 divergence class (TypeScript replaces in-config
  templating mechanisms); builder options accept the fixed placeholder
  vocabulary only.

**Verify**: contract cites the 121 report §9 for every adopted or
diverged builder decision (≥ 3 citations); if a clone was used,
`git status --short` shows no tracked changes from research.

### Step 1: Fix the canonical platform-target vocabulary

DECIDED by B1 — document it: config declares **canonical** targets;
builders translate. The grammar and the 8-target initial list are pinned
(libc segment linux-only, mirroring bun-types' own per-OS constraints):

```ts
// Canonical, toolchain-neutral. Extends the existing os/arch/libc scalars.
type PlatformTarget = `${Os}-${Arch}` | `linux-${Arch}-musl`
// "linux-x64" | "linux-x64-musl" | "linux-arm64" | "linux-arm64-musl"
// | "darwin-x64" | "darwin-arm64" | "windows-x64" | "windows-arm64"
```

- `builds[].targets` is `PlatformTarget[]` — the same vocabulary for every
  tool. Per-builder translation maps canonical → toolchain triple
  (`linux-x64` → `bun-linux-x64`; later `GOOS=linux GOARCH=amd64`,
  `x86_64-unknown-linux-gnu`, `--target x86_64-unknown-linux-gnu` for deno).
- Builder-specific tuning that today rides in the triple (bun `-baseline` /
  `-modern` CPU variants) moves to builder-section options
  (`cpu?: "baseline" | "modern"` on the Bun build section), defaulted
  per-builder.
- The existing `InstallableArtifactVariant` remains the artifact-side
  record; `targetTriple` keeps recording the toolchain-specific triple for
  evidence.
- **Name-token mapping (114 contract D1 — define it here, once)**:
  canonical targets are the *config* vocabulary (`x64`); artifact-NAME
  placeholders `{os}`/`{arch}` render the *distribution* vocabulary
  (`linux`/`darwin`/`windows`, `amd64`/`arm64`) so default asset names
  are byte-compatible with GoReleaser's and with the installer-inference
  ecosystem (ubi/eget/cargo-binstall/mise). One mapping table
  (`x64 → amd64`, `arm64 → arm64`, os names identity), owned by this
  contract, used by the 114 placeholder vocabulary.
- **The `builds[]` discriminator is `builder`, not `tool`** (114 contract
  D9, null hypothesis): upstream's exact field name, whose enum Pro
  extends with `prebuilt`; upstream's `tool` means "executable to
  invoke" — a different thing we must not squat on. Update every config
  example in this plan accordingly.
- State the migration consequence explicitly: `BunExecutableCompileTarget`
  as a *config* vocabulary is deleted in plan 115; the 90-line derivation
  switch inverts into the bun builder's translation table.

**Verify**: the contract shows the canonical grammar, the full initial
target list, the bun translation table (all current
`BunExecutableCompileTarget` values covered), and the config-migration note.

### Step 2: Write the Builder interface

The builder is a sub-adapter consumed by ONE generic `build` pipe (the pipe
handles sections/defaults/catalog bookkeeping once; builders only know their
toolchain). Baseline:

```ts
interface Builder<Options> {
  readonly id: string                    // "bun" | "command" | later: "deno" | "go" | "cargo" | "zig"
  readonly defaults: (options: Options, identity: ReleaseIdentity) => Options
  readonly supportedTargets: ReadonlyArray<PlatformTarget>
  readonly doctor: (options: Options) => ReadonlyArray<Operation>
                                         // read-only tool presence/version checks, feeds `doctor`
  readonly plan: (options: Options, identity: ReleaseIdentity, target: PlatformTarget)
    => BuilderPlan                       // pure — no Effect needed
}

interface BuilderPlan {
  readonly operations: ReadonlyArray<Operation>   // per-builder forms pinned by B3:
                                                  //   bun → StageArtifactOperation (B5)
                                                  //   command → writes-local CommandSpec
                                                  //   prebuilt → read-only existence check
  readonly artifacts: ReadonlyArray<Artifact>     // kind "executable" (or declared), platform variant set
}
```

Binding decisions to state:

1. **Builders are pure planners** — same rule as pipes: they emit
   operations; the risk-gated executor executes. A builder never imports
   platform services. (This is what makes builders trivially testable and
   the engine runtime-agnostic.)
2. **Builder registry is a static array** consumed by the generic build
   pipe — same no-plugin-discovery rule as the pipeline itself.
3. **Unsupported target = plan error, not silent skip**: requesting
   `windows-arm64` from a builder that lacks it fails config validation
   with the builder's supported list in the message.
4. **npm-pack and pypi-wheel are NOT builders** — they package existing
   artifacts and stay ordinary pipes (GoReleaser analog: archives/nfpms are
   pipes, not builders). Only binary-producing toolchains are builders.

**Verify**: contract contains the two interfaces, the four decisions, and a
worked example: the current bun compile expressed as `Builder<BunOptions>`,
with one structured `StageArtifactOperation` matching the in-process
`Bun.build({ compile })` intent that
`apps/release-ts/src/runtime/bun-artifact-recipes.ts` invokes today.

### Step 3: Design the `command` builder (the language-agnostic escape hatch)

This is what makes the build API language-agnostic on day one without
adapter proliferation, and it must stay inside SPEC.md's "compose, don't
replace" bias (the config *describes* a build command; ts-release does not
become a task runner):

```ts
builds: [{
  builder: "command",
  targets: ["linux-x64", "darwin-arm64"],
  run: "make build-{os}-{arch}",          // templated per target
  output: "dist/mytool-{os}-{arch}",       // the artifact the command must produce
  binary: "mytool"                         // named per the null hypothesis (their `binary`)
}]
```

Decisions to state: template vocabulary reuses the 114 set plus `{os}`,
`{arch}`, `{libc}`, `{targetTriple}`; the emitted operation is a single
`writes-local` CommandSpec per target; the declared `output` becomes the
catalog artifact (executor already verifies staged paths exist —
`check:self-release-artifacts` pattern); no shell interpolation beyond the
named templates (document the injection stance: the command is
config-authored data, same trust level as the rest of config, but templates
never expand into shell metacharacters — they expand into argv entries).
The GoReleaser-Pro "prebuilt" analog is DECIDED (B3/B4): a separate
`builder: "prebuilt"` — `output` required, no command, zero build
operations, one read-only existence-verification operation per target —
because "run nothing" semantics deserve their own name (and it matches
upstream Pro's own `builder: prebuilt` spelling).

**Verify**: contract contains the config example, template vocabulary,
injection stance, and the prebuilt decision.

### Step 4: Write the engine runtime capability matrix

The cells are DECIDED by B6 — format them as the table: for each
`effect/platform` runtime (Bun, Node, Deno, web/browser) × each public API
function from the 117 contract (`plan`, `build`, `release`, `verify`),
state supported/unsupported, the providing layer, and the impossibility
reason where applicable (Bun: full, `build:bun` in-process per B5; Node:
plan/release/verify full, artifact staging unsupported in 0.1 preserving
today's typed error, spawn-based stager recorded as the first post-0.1
runtime row; web: `plan` with inline config only — no
ChildProcess/FileSystem; future docs playground, NOT a 0.1 deliverable).
State the 0.1 commitment: library `src/`
stays platform-neutral (enforced by existing import checks); official
layers shipped: Bun (CLI) and Node (Action); Deno recorded as untested but
expected-compatible via `@effect/platform-node` compat — verify claim
against `.repos/effect` platform packages (read-only) before writing it,
per B6.

**Verify**: 4×4 matrix present with per-cell layer or impossibility reason;
0.1 commitment paragraph present.

### Step 5: Add roadmap rows and patch plans 115-117 and the index

- Add builder rows to the 114 parity matrix (or this contract if 114's
  matrix is closed): `deno`, `node` (single-file executables), `go`,
  `cargo`, `zig` — each "one Builder adapter, est. ≤ ~150 LOC, no kernel
  change"; `prebuilt` and `command` land in 0.1. Framing rule (maintainer
  directive, 2026-07-03): GoReleaser's Pro tier is market context, never a
  scoping category — `prebuilt` being Pro upstream is precisely why its
  trivial cost here (a run-nothing builder) is a headline, not a footnote.
- Patch plan 115: Step 4 builds `build:bun` as the generic build pipe + the
  first `Builder` (per this contract) rather than a bespoke bun pipe; Step 5
  unchanged for wheel/npm-pack (explicitly NOT builders). Patch the 115
  config note: canonical targets replace `BunExecutableCompileTarget` in
  config, dogfood config updated accordingly.
- Patch plan 116/117 only if they reference bun triples or a `tool:`
  config discriminator in examples (rename to `builder:` per D9).
- `plans/README.md`: 119 ordered after 114, before 115; dependency note.

**Verify**: `git diff --check -- plans SPEC.md ARCHITECTURE.md` → exit 0;
`rg -n "bun-linux-x64" plans/115-introduce-pipeline-kernel.md` → hits only
in quoted current-state excerpts or explicit migration instructions.

## Test plan

Design-only; verification is textual per the Verify blocks. No code.

## Done criteria

- [x] Canonical `PlatformTarget` vocabulary + bun translation table exist.
- [x] `Builder` interface + four binding decisions + bun worked example exist.
- [x] `command` and `prebuilt` builder designs exist with template
      vocabulary and injection stance.
- [x] Runtime capability matrix (4 runtimes × 4 API functions) exists with
      the 0.1 commitment.
- [x] Builder roadmap rows added; plans 115-117 patched consistently.
- [x] `git diff --check -- plans SPEC.md ARCHITECTURE.md` exits 0.
- [x] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Plan 114 is not DONE, or its finalized Pipe contract cannot host a
  builder sub-adapter without modification (kernel feedback — report, don't
  redesign the kernel here).
- The pure-planner rule (decision 1) proves impossible for a real builder
  (e.g. a toolchain that cannot express its work as CommandSpec +
  StageArtifactOperation) — that challenges the operations-as-data model
  and needs the maintainer.
- You cannot verify the Deno-compat claim from `.repos/effect` — write
  "unverified" rather than asserting it.
- Any step seems to require editing source code.

## Maintenance notes

- The builder contract is the second extension seam (inside the build
  pipe). Post-0.1 language support = one Builder adapter + parity-matrix
  row update; anything more is contract feedback.
- The `command` builder is the pressure valve: if users lean on it heavily
  for some language, that is the signal to promote a dedicated builder.
- Web/`plan`-only support is deliberately parked; revisit only with a
  concrete consumer (docs playground, config validator UI).
