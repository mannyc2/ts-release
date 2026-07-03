# Plan 119 Builder Contract

This is the binding builder and runtime-capability contract produced by
Plan 119. It plugs into the Plan 114 pipeline contract's `build` phase and is
the authority for Plans 115-117 wherever older draft wording conflicts.

Sources: `plans/114-pipeline-contract.md`,
`plans/research/121-goreleaser-spec.md` section 9, the installed
`bun-types` 1.3.14 `Bun.Build.CompileTarget` grammar, and the current
`src/domain/artifact.ts` target model. No source implementation is part of
this contract.

## Summary

- Config declares one canonical target vocabulary for every builder.
- Builders are pure planners behind one generic `build` pipe.
- `bun`, `command`, and `prebuilt` are the 0.1 builders.
- Bun compilation stays in-process with `Bun.build({ compile })` through a
  structured `StageArtifactOperation`; it is not rewritten as a shelled CLI.
- `.release/artifacts` remains the staged-artifact layout.
- Runtime portability is explicit: Bun is full, Node keeps today's staging
  limitation, Deno is expected but unverified, and web is plan-only.

## Canonical Platform Targets

Config-level build targets use a toolchain-neutral grammar:

```ts
type Os = "linux" | "darwin" | "windows"
type Arch = "x64" | "arm64"
type PlatformTarget = `${Os}-${Arch}` | `linux-${Arch}-musl`
```

The optional `-musl` segment is valid only for Linux. Linux without the
segment means glibc. The initial 0.1 target set is:

| Target | Variant fields | Notes |
|---|---|---|
| `linux-x64` | `{ os: "linux", arch: "x64", libc: "glibc" }` | glibc is unmarked in names. |
| `linux-x64-musl` | `{ os: "linux", arch: "x64", libc: "musl" }` | Names append `_musl` by default. |
| `linux-arm64` | `{ os: "linux", arch: "arm64", libc: "glibc" }` | glibc is unmarked in names. |
| `linux-arm64-musl` | `{ os: "linux", arch: "arm64", libc: "musl" }` | Names append `_musl` by default. |
| `darwin-x64` | `{ os: "darwin", arch: "x64" }` | No libc axis. |
| `darwin-arm64` | `{ os: "darwin", arch: "arm64" }` | No libc axis. |
| `windows-x64` | `{ os: "windows", arch: "x64" }` | Executables default to `.exe`. |
| `windows-arm64` | `{ os: "windows", arch: "arm64" }` | Valid in bun-types 1.3.14. |

`InstallableArtifactVariant` is the artifact-side record and keeps the same
`os` / `arch` / optional `libc` scalars. `targetTriple` records the
toolchain-specific target that a builder translated to, for evidence and
debugging only.

`BunExecutableCompileTarget` is deleted as a config vocabulary in Plan 115.
The old switch that derived canonical variants from Bun triples inverts into
the Bun builder's canonical-to-Bun translation table.

### Name Tokens

Target spelling and artifact-name spelling are intentionally different:

| Canonical config token | Distribution name token |
|---|---|
| `linux` | `linux` |
| `darwin` | `darwin` |
| `windows` | `windows` |
| `x64` | `amd64` |
| `arm64` | `arm64` |
| `glibc` | `glibc` only when `{libc}` is explicitly rendered |
| `musl` | `musl` |

Default-generated artifact names use distribution tokens. Bare binaries,
archives, and checksum files append `_musl` for musl variants and leave glibc
unmarked. Explicit user-authored paths and names always win, so existing
dogfood assets that spell `x64` remain stable through 0.1.

Built-in defaults are functions, not stored template strings. The fixed
placeholder vocabulary from Plan 114 remains:

```txt
{name} {normalizedName} {version} {tag} {commit} {shortCommit}
{os} {arch} {libc} {targetTriple} {binary}
```

When user-authored templates render `{os}` or `{arch}` into artifact names,
they use the same distribution tokens as defaults. `{libc}` renders the
literal value `musl` or `glibc`. Rendered artifact names must be unique
across the catalog; a collision is a plan error.

## Builder Interface

The generic build pipe owns section selection, defaults ordering, catalog
bookkeeping, and the static builder registry. A builder only knows how to
translate one build section for one toolchain.

```ts
interface Builder<Options> {
  readonly id: string
  readonly defaults: (options: Options, identity: ReleaseIdentity) => Options
  readonly supportedTargets: ReadonlyArray<PlatformTarget>
  readonly doctor: (options: Options) => ReadonlyArray<Operation>
  readonly plan: (
    options: Options,
    identity: ReleaseIdentity,
    target: PlatformTarget
  ) => BuilderPlan
}

interface BuilderPlan {
  readonly operations: ReadonlyArray<Operation>
  readonly artifacts: ReadonlyArray<Artifact>
}
```

Binding rules:

- Builders plan; they never execute and never import `engine/` or `host/`.
- The builder registry is a static array consumed by `pipes/build.ts`.
- Unsupported target requests fail as plan errors and print the builder's
  supported target list.
- `npm-pack` and `pypi-wheel` are not builders. They package existing
  artifacts and remain ordinary build-phase pipes.

Operation forms are fixed per builder:

| Builder | 0.1 operation form | Catalog output |
|---|---|---|
| `bun` | One `StageArtifactOperation` per target, carrying structured Bun compile intent. | `kind: "executable"` artifacts with platform variants. |
| `command` | One `writes-local` `CommandSpec` per target. | `kind: "executable"` artifacts pointing at `output`. |
| `prebuilt` | Zero build operations plus one `read-only` existence check per target. | `kind: "executable"` artifacts pointing at `output`. |

The generic pipe validates that every planned artifact path/name is unique
after defaults and placeholders render.

## Bun Builder

The Bun builder is the first dedicated builder. It moves the existing
in-process runtime recipe into library staging without changing the execution
primitive: `Bun.build({ compile })`.

0.1 config fields:

```ts
{
  builder: "bun",
  id?: string,
  entry: string,
  targets?: ReadonlyArray<PlatformTarget>,
  binary?: string,
  output?: string,
  cpu?: "baseline" | "modern",
  minify?: boolean
}
```

`binary` defaults to `{name}`. `output` is optional; when omitted, the builder
computes the default staged path under `.release/artifacts` using the name
token rules above. `cpu` and `minify` are builder options, not part of the
canonical target grammar.

The staged operation intent is structured data:

```ts
class BunCompileIntent extends Schema.TaggedClass<BunCompileIntent>()("bun-compile", {
  entry: Schema.String,
  target: PlatformTarget,
  compileTarget: Schema.String, // implementation type: Bun.Build.CompileTarget
  outfile: Schema.String,
  minify: Schema.optionalKey(Schema.Boolean)
}) {}
```

In implementation, `compileTarget` must be typed as
`Bun.Build.CompileTarget`. That means Bun grammar or membership drift becomes
a TypeScript error when Bun is upgraded. This deliberately replaces
GoReleaser-style embedded target lists, which the 121 report found can drift
from Bun's own grammar and membership.

Translation table:

| Platform target | Default Bun target | `cpu: "baseline"` | `cpu: "modern"` |
|---|---|---|---|
| `linux-x64` | `bun-linux-x64` | `bun-linux-x64-baseline` | `bun-linux-x64-modern` |
| `linux-x64-musl` | `bun-linux-x64-musl` | `bun-linux-x64-baseline-musl` | `bun-linux-x64-modern-musl` |
| `linux-arm64` | `bun-linux-arm64` | `bun-linux-arm64-baseline` | `bun-linux-arm64-modern` |
| `linux-arm64-musl` | `bun-linux-arm64-musl` | `bun-linux-arm64-baseline-musl` | `bun-linux-arm64-modern-musl` |
| `darwin-x64` | `bun-darwin-x64` | `bun-darwin-x64-baseline` | `bun-darwin-x64-modern` |
| `darwin-arm64` | `bun-darwin-arm64` | `bun-darwin-arm64-baseline` | `bun-darwin-arm64-modern` |
| `windows-x64` | `bun-windows-x64` | `bun-windows-x64-baseline` | `bun-windows-x64-modern` |
| `windows-arm64` | `bun-windows-arm64` | plan error | plan error |

The `windows-arm64` CPU errors exist because bun-types 1.3.14 accepts
`bun-windows-${Architecture}` and `bun-windows-x64-${SIMD}`, but not a SIMD
suffix for Windows arm64.

The table covers every current `BunExecutableCompileTarget` and adds the
type-valid combinations that the old enum could not express. Plan output
records both the canonical target and translated Bun target.

Doctor behavior on Bun: the toolchain is the runtime. Report `Bun.version`
and do not probe PATH for a separate `bun` executable.

Post-0.1 Bun option rows, already present in `CompileBuildOptions` and
therefore additive later: Windows executable metadata, `execArgv`,
`executablePath`, and the `autoload*` flags.

## Command Builder

The command builder is the language-agnostic escape hatch that lands in 0.1.
It describes an external build command without turning ts-release into a task
runner.

```ts
{
  builder: "command",
  id?: string,
  targets: ["linux-x64", "darwin-arm64"],
  run: ["make", "build-{os}-{arch}"],
  output: "dist/mytool-{os}-{arch}",
  binary?: "mytool"
}
```

The string shorthand is allowed:

```ts
{ builder: "command", targets: ["linux-x64"], run: "make build-{os}-{arch}", output: "dist/mytool-{os}-{arch}" }
```

String `run` values split on whitespace with no quoting rules. Use the array
form when an argument contains spaces. Placeholders expand per argv entry
after splitting and never pass through a shell. The emitted operation is a
single `writes-local` `CommandSpec` per target, and the executor verifies that
`output` exists after execution. `binary` defaults to `{name}`.

The command is config-authored data, at the same trust level as the rest of
the release config. The safety boundary is argv-only expansion plus the normal
plan and evidence review.

## Prebuilt Builder

The prebuilt builder imports artifacts that some other build system already
created. It also lands in 0.1.

```ts
{
  builder: "prebuilt",
  id?: string,
  targets: ["linux-x64", "darwin-arm64"],
  output: "dist/mytool-{os}-{arch}",
  binary?: "mytool"
}
```

It emits catalog artifacts and read-only existence checks only. There is no
build operation and no command. This mirrors GoReleaser's `builder:
prebuilt` spelling, while taking advantage of this repo's plan-first model:
the import is visible in the plan and evidence without doing work.

## Staged Artifact Layout

The staged artifact root remains `.release/artifacts`. This intentionally
diverges from GoReleaser's `dist/<build.id>_<target>/...` layout because
`dist/` is already package-build output in this repo and existing install
scripts depend on `.release/artifacts`.

Collision safety comes from rendered artifact-name uniqueness plus executor
path verification, not from one directory per target.

## Runtime Capability Matrix

Public API functions are the Plan 117 functions: `plan`, `build`, `release`,
and `verify`.

| Runtime | `plan` | `build` | `release` | `verify` |
|---|---|---|---|---|
| Bun CLI layer (`@effect/platform-bun`) | Supported. Loads config from file or inline value and plans all pipes. | Supported. Executes `writes-local` staging plus in-process `Bun.build({ compile })`. | Supported with normal risk gates: plan-only by default, execute for externally visible operations, approve for irreversible operations. | Supported. Executes read-only `Verify*` operations. |
| Node Action layer (`@effect/platform-node`) | Supported. Action can plan the same release graph. | Unsupported for artifact staging in 0.1. Preserve today's typed unsupported-staging error. | Supported for plan/release/verify flows; executing `StageArtifactOperation` under Node returns the same typed unsupported-staging error. | Supported. Executes read-only `Verify*` operations. |
| Deno | Expected but unverified. The local Effect checkout has no dedicated Deno platform package; Deno support depends on Node-compatible platform APIs. | Unverified and not official in 0.1. | Unverified and not official in 0.1. | Unverified and not official in 0.1. |
| Web/browser (`@effect/platform-browser`) | Plan-only with inline config and no file/env/process access. Useful later for a docs playground. | Unsupported: no `FileSystem` or `ChildProcess`. | Unsupported: no filesystem, process, or publish host services. | Unsupported: no filesystem, process, or remote verification host services. |

0.1 ships official Bun and Node runtime layers only. The library source stays
platform-neutral; platform service provisioning remains at CLI, Action,
runtime, script, application, and test boundaries.

Node's first post-0.1 runtime row is a spawn-based Bun stager. It is not in
0.1 because generated CI can run the Bun CLI step for compilation, while the
Action stays focused on plan/release/verify.

## Builder Roadmap

GoReleaser's free/Pro labels are market context, not scoping categories. The
cost column is the deciding signal for this architecture.

| Builder | 0.1 status | Future landing cost |
|---|---|---|
| `bun` | Lands in 0.1. | Already the first dedicated builder. |
| `command` | Lands in 0.1. | Escape hatch for any language or lagging dedicated builder. |
| `prebuilt` | Lands in 0.1. | Run-nothing import; trivial by construction. |
| `deno` | Future dedicated builder. | One builder adapter, expected <= 150 LOC, no kernel change. |
| `node` single-file executables | Future dedicated builder. | One builder adapter, expected <= 150 LOC, no kernel change. |
| `go` | Future dedicated builder. | One builder adapter translating canonical targets to GOOS/GOARCH/variant env, no kernel change. |
| `cargo` | Future dedicated builder. | One builder adapter translating canonical targets to Rust triples, no kernel change. |
| `zig` | Future dedicated builder. | One builder adapter translating canonical targets to Zig target triples, no kernel change. |

If users lean heavily on `command` for one ecosystem, that is the promotion
signal for a dedicated builder.
