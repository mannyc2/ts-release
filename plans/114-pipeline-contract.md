# Plan 114 Pipeline Architecture Contract

This is the binding 0.1 architecture contract produced by Plan 114. It
encodes decisions D1-D19 from
`plans/114-design-goreleaser-shaped-pipeline-architecture.md`, the
GoReleaser spec report
(`plans/research/121-goreleaser-spec.md`), and the Effect v4 API probe
(`plans/research/effect-v4-api-probe.md`). Plans 119 and 115-117 implement
against this contract.

The companion builder contract is `plans/119-builder-contract.md`; it owns
the canonical platform-target grammar, builder interface, name-token mapping,
and runtime capability matrix referenced below.

GoReleaser is the comparison system, not the product goal. Adopt its shape
where release-ecosystem tooling depends on it; diverge where typed
TypeScript config, plan-first execution, and serializable state make a safer
or smaller mechanism possible.

## Binding Principles

- Pipes plan; the executor executes. Pipes and builders never touch the
  filesystem, network, process table, clock, or environment directly.
- Publish operations stay data until approved. The executor is the only
  component that may perform operations, using the existing risk gates:
  `build` may execute through `writes-local`, `release --execute` may also
  execute `externally-visible`, and `--approve-publish` is required for
  `irreversible`.
- A missing config section means a skipped pipe plus a reason-bearing
  `PipeNotice`; there are no implicit archive or checksum pipes. `init`
  may scaffold `checksum: {}` as a convenience, but the kernel treats absence
  as skip.
- `ReleaseState` is serializable Schema data. No function-valued state, no
  method-dependent resume behavior, and no in-place artifact mutation.
  Transforming an artifact contributes a new artifact with provenance.
- Internally, the engine is Effect-native and returns the public summary
  types directly with tagged errors. Public 0.1 exports are Promise/plain-data
  projections only; an Effect subpath is deferred until Effect 4 is stable
  and a real external Effect consumer exists.
- Feature locality is the architectural budget: a new distribution feature
  touches one pipe file, one line in `pipeline.ts`, and one config schema
  composition line. If a feature cannot fit that shape, that is kernel
  feedback.

## Kernel Contract

The kernel is serializable state, typed artifacts, a pure catalog, and one
pipe interface. The signatures below are documentation, not source code, but
implementation plans must preserve their shape.

```ts
class ReleaseIdentity extends Schema.Class<ReleaseIdentity>("ReleaseIdentity")({
  name: Schema.String,
  normalizedName: Schema.String,
  version: Schema.String,
  tag: Schema.String,
  commit: Schema.String,
  shortCommit: Schema.String,
  notes: Schema.optionalKey(Schema.String),
  versionSource: Schema.String,
  snapshot: Schema.Boolean
}) {}

class PipeNotice extends Schema.Class<PipeNotice>("PipeNotice")({
  pipeId: Schema.String,
  severity: Schema.Literals(["info", "warning"]),
  reason: Schema.String
}) {}

class ReleaseState extends Schema.Class<ReleaseState>("ReleaseState")({
  identity: ReleaseIdentity,
  strict: Schema.Boolean,
  artifacts: ArtifactCatalog,
  operations: Schema.Array(Operation),
  notices: Schema.Array(PipeNotice)
}) {}
```

The Effect probe pins three details used here: `Schema.decodeSync` returns
plain objects, so state classes remain method-free; `Schema.optionalKey`
continues to model omitted keys; and Schema classes are not frozen, so the
no-mutation rule is explicit contract discipline, not runtime magic
(`plans/research/effect-v4-api-probe.md`, decisions 2, 3, and 9).

`strict` carries today's top-level strict-mode flag into state so pipes can
plan against it (for example npm's reject-when-no-dry-run rule). Without it
the plan-116 port could not reproduce current operation data, because
`plan(section, state)` is a pipe's only input channel.

Types referenced but not redefined in this contract are pinned as follows.
`ArtifactId` and `OperationId` are branded string ids (plan 115,
`pipeline/artifact.ts` / `pipeline/operation.ts`). `Checksum` and
`InstallableArtifactVariant` are reused from `src/domain/artifact.ts` and
re-homed in `pipeline/artifact.ts` (plan 115). `ArtifactCatalog` is the data
wrapper around a readonly `Artifact` array, defined with the filters in
`pipeline/catalog.ts`. `ResolvedIdentity` is the `VersionSource` output;
`ReleaseIdentity` is that shape completed with `normalizedName` and snapshot
bookkeeping (plan 115 pins the exact split). `StageArtifactIntent` is a
tagged union of per-stager intents (bun compile intent per plan 119 B5,
wheel assembly per plan 116). `WorkspaceServices` is the read-only host
access injected into identity sources. `PlanError` and `IdentityError` are
`TaggedErrorClass` families (plan 115). `ReleaseConfig` is the
`config/schema.ts` composition.

### Artifact Schema

GoReleaser stores artifact extras in an untyped `map[string]any` and even
uses an `ExtraRefresh` function omitted from JSON for checksum refreshes
(`plans/research/121-goreleaser-spec.md` sections 5 and 8). That is the
anti-precedent. ts-release uses a tagged union of per-kind classes in one
`extra` field, as settled by the Effect probe.

```ts
class ExecutableExtra extends Schema.TaggedClass<ExecutableExtra>()("executable", {
  binary: Schema.String,
  extension: Schema.String,
  builderId: Schema.String,
  dynamicallyLinked: Schema.optionalKey(Schema.Boolean)
}) {}

class ArchiveExtra extends Schema.TaggedClass<ArchiveExtra>()("archive", {
  format: Schema.String,
  wrappedIn: Schema.optionalKey(Schema.String),
  binaries: Schema.Array(Schema.String),
  files: Schema.Array(Schema.String)
}) {}

class ChecksumFileExtra extends Schema.TaggedClass<ChecksumFileExtra>()("checksum-file", {
  algorithm: Schema.Literals(["sha256", "sha512"]),
  coversArtifactIds: Schema.Array(Schema.String)
}) {}

class CatalogFileExtra extends Schema.TaggedClass<CatalogFileExtra>()("catalog-file", {
  catalog: Schema.Literals(["homebrew", "scoop"]),
  repository: Schema.String
}) {}

class PackageExtra extends Schema.TaggedClass<PackageExtra>()("package", {
  packageManager: Schema.Literals(["npm"]),
  packageName: Schema.String
}) {}

class WheelExtra extends Schema.TaggedClass<WheelExtra>()("wheel", {
  packageName: Schema.String,
  wheelTag: Schema.String,
  binaries: Schema.Array(Schema.String)
}) {}

const ArtifactExtra = Schema.Union([
  ExecutableExtra,
  ArchiveExtra,
  ChecksumFileExtra,
  CatalogFileExtra,
  PackageExtra,
  WheelExtra
])

class Artifact extends Schema.Class<Artifact>("Artifact")({
  id: ArtifactId,
  kind: Schema.Literals([
    "executable",
    "archive",
    "package",
    "wheel",
    "checksum-file",
    "catalog-file",
    "sbom",
    "signature",
    "file"
  ]),
  path: Schema.String,
  producedBy: Schema.String,
  platform: Schema.optionalKey(InstallableArtifactVariant),
  checksum: Schema.optionalKey(Checksum),
  extra: Schema.optionalKey(ArtifactExtra)
}) {}
```

The initial extras deliberately reference the owning config section or
package surface rather than embedding copied config objects. GoReleaser's
private `BrewConfig`/`ScoopConfig` extras duplicate config into artifact
state; this contract rejects that because duplicated config drifts.

Two invariants bind `kind` and `extra`. An artifact whose `kind` has an
extra class (`executable`, `archive`, `checksum-file`, `catalog-file`,
`package`, `wheel`) must carry an `extra` whose tag equals its `kind` — a
mismatch is a plan error. The kinds without an extra class in 0.1 (`sbom`,
`signature`, `file`) omit the key; adding their extras later is additive.
Rendered artifact names must also be unique across the catalog — a collision
is a plan error (plan 119 B2; upstream's one-archive-per-os/arch error,
`plans/research/121-goreleaser-spec.md` section 6, is the precedent).

### Catalog Filters

`ArtifactCatalog` is a small data wrapper plus pure filters. It replaces
`ArtifactIntent`, `ArtifactInventoryItem`, recipe-specific inventory, and
target-specific artifact IDs as the lingua franca between pipes.

```ts
type ArtifactFilter = (artifact: Artifact) => boolean

const byKind = (...kinds: ReadonlyArray<Artifact["kind"]>): ArtifactFilter
const byOs = (...os: ReadonlyArray<"linux" | "darwin" | "windows">): ArtifactFilter
const byArch = (...arch: ReadonlyArray<"x64" | "arm64">): ArtifactFilter
const byLibc = (...libc: ReadonlyArray<"glibc" | "musl">): ArtifactFilter
const byProducer = (...pipeIds: ReadonlyArray<string>): ArtifactFilter
const byId = (...ids: ReadonlyArray<string>): ArtifactFilter
const and = (...filters: ReadonlyArray<ArtifactFilter>): ArtifactFilter
const or = (...filters: ReadonlyArray<ArtifactFilter>): ArtifactFilter
const not = (filter: ArtifactFilter): ArtifactFilter
```

GoReleaser's artifact system validates the need for this shape: its report
found a typed artifact list, filters such as `ByType`/`ByID`/platform
filters, and combinators, but also a `ByID` quirk where some artifact types
always match (`plans/research/121-goreleaser-spec.md` sections 5 and 6).
ts-release adopts the filter idea and rejects type-conditional magic.

There is deliberately no consumer axis on `Artifact` and no `byConsumer`
filter: the current config-declared `consumers`/`artifactId` wiring
dissolves with the port. A consuming pipe selects its inputs with its own
filters — Homebrew for example uses
`and(byKind("executable", "archive"), byOs("darwin", "linux"))` — and a
section's optional `ids` narrowing composes in through `byId`.

### Operations And StageArtifactOperation

`Operation` moves from `src/domain/operation.ts` to `src/pipeline/operation.ts`.
The existing risk literals are kept unchanged:

```ts
type OperationRisk = "read-only" | "writes-local" | "externally-visible" | "irreversible"
```

The operation union gains one sanctioned escape hatch:

```ts
class StageArtifactOperation extends Schema.TaggedClass<StageArtifactOperation>()(
  "StageArtifactOperation",
  {
    id: OperationId,
    description: Schema.String,
    risk: Schema.Literal("writes-local"),
    intent: StageArtifactIntent,
    producesArtifactIds: Schema.Array(ArtifactId)
  }
) {}
```

`StageArtifactOperation` is for local artifact work not expressible as a
portable command or HTTP operation, such as in-process `Bun.build({ compile })`
or wheel zip assembly. It is executed only by `engine/stager.ts` through an
injected `ArtifactStager` layer.

The remaining union members port unchanged from `src/domain/operation.ts`
(command validation and note operations, render-file, the publish command
and GitHub-release operations, and the `Verify*` family), keeping their ids
and risks intact. Once appended to `ReleaseState`, every operation carries
`producedBy` provenance naming the contributing pipe — plan 116 adds the
field during the port — and summaries and evidence surface it as `pipeId`.

### Pipe Interface

```ts
type PipelineStage = "identity" | "defaults" | PipePhase

type PipePhase = "build" | "process" | "catalog" | "publish" | "verify"

interface PipeContribution {
  readonly artifacts: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<Operation>
  readonly notices: ReadonlyArray<PipeNotice>
}

interface Pipe<Section> {
  readonly id: string
  readonly phase: PipePhase
  readonly section: (config: ReleaseConfig) => Section | undefined
  readonly defaults?: (section: Section, identity: ReleaseIdentity) => Section
  readonly plan: (
    section: Section,
    state: ReleaseState
  ) => Effect.Effect<PipeContribution, PlanError>
}
```

Binding rules:

1. Pipes plan; they never execute. Builders follow the same rule.
2. `pipeline.ts` owns a static ordered pipe array. There is no dynamic
   plugin discovery in 0.1.
3. Defaults are distributed. Each pipe owns its defaults; the old central
   normalizer dissolves.
4. Skips are data. Missing sections and runtime skip decisions add
   `PipeNotice` records visible in plan output and evidence.
5. The two-stage binding rule is phase-ordered concreteness. A phase may plan
   with values produced by earlier phases in the same invocation. Predictable
   values such as GitHub asset URLs may be rendered from config and identity.
   If a future pipe needs a value that is neither predictable nor available
   from a prior phase, the kernel gets an explicit deferred-value design with
   executor-recorded resolution evidence; individual pipes do not invent
   placeholders.
6. `identity` and `defaults` are kernel stages, not pipe-assignable phases:
   identity is resolved by the `VersionSource` seam, and the runner then
   applies each pipe's `defaults` — which receive the resolved identity — in
   pipeline order before any pipe plans. No 0.1 pipe file occupies the
   `verify` phase either: verify checks are `Verify*` operation data
   contributed by publish pipes, and the `verify` surface selects and
   executes exactly that read-only family. The phase stays in `PipePhase`
   for future dedicated verify pipes.

### Identity Source Seam

Version resolution is a strategy seam:

```ts
interface VersionSource<Options> {
  readonly id: string
  readonly resolve: (
    options: Options,
    workspace: WorkspaceServices
  ) => Effect.Effect<ResolvedIdentity, IdentityError>
}

type IdentityModifier = (identity: ResolvedIdentity) => ResolvedIdentity
```

0.1 ships `manifest` and `git-tag` sources. `versionFrom` defaults to
`"manifest"` because npm/PyPI package versions are native TS ecosystem facts.
The `git-tag` source follows GoReleaser's order: explicit override or
`TS_RELEASE_CURRENT_TAG`, then tags pointing at HEAD sorted
`-version:refname`, then nearest ancestor tag; one leading `v` is stripped,
semver parse errors name the tag, no tag names `--snapshot` as the way out,
and dirty worktree errors list files (`plans/research/121-goreleaser-spec.md`
section 4). Under snapshot the git-tag source degrades instead of failing:
with no repository or no tag it resolves a fake `0.0.0` base for the
snapshot suffix (upstream's `v0.0.0` precedent, sections 3 and 4).
`snapshot` is a modifier over any source, not a source.

Snapshot version format is `{version}-SNAPSHOT-{shortCommit}`. This is the
current resolved version plus suffix; the earlier "{nextPatch}-SNAPSHOT"
recollection was wrong and next-patch is only available upstream through an
explicit `incpatch` template function (`plans/research/121-goreleaser-spec.md`
section 3).

### Placeholder Vocabulary

The 0.1 placeholder vocabulary is fixed:

```txt
{name} {normalizedName} {version} {tag} {commit} {shortCommit}
{os} {arch} {libc} {targetTriple} {binary}
```

Wherever `{os}`/`{arch}` render into an artifact name — default-generated
or user-authored — they render distribution tokens, not config tokens:
`x64 -> amd64`, `arm64 -> arm64`, OS names unchanged. `{libc}` renders its
literal value (`musl`/`glibc`). The token mapping is defined once, owned by
the plan-119 builder contract (B2) and implemented in `pipeline/template.ts`.
Default-generated names are computed by pipe and builder code (functions,
not stored template strings), follow D1's byte-compatible GoReleaser shapes
for bare binaries, archives, and checksum files, and append `_musl` for musl
variants. Explicit user paths and names always win.

No template mini-language exists in 0.1. TypeScript config is the
expressiveness path; JSON config is limited to named placeholders.

#### Conditional Example

The Go-template style:

```gotemplate
{{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}{{ if eq .Os "linux" }}_{{ .Libc }}{{ end }}
```

The ts-release TypeScript authoring style:

```ts
import { defineRelease } from "@mannyc1/ts-release"

interface Target {
  readonly os: "linux" | "darwin" | "windows"
  readonly arch: "x64" | "arm64"
  readonly libc?: "musl"
}

const allTargets: ReadonlyArray<Target> = [
  { os: "linux", arch: "x64", libc: "musl" },
  { os: "linux", arch: "arm64", libc: "musl" },
  { os: "darwin", arch: "arm64" },
  { os: "windows", arch: "x64" }
]

const distArch = { x64: "amd64", arm64: "arm64" } as const

export default defineRelease({
  project: { name: "acme-cli" },
  builds: allTargets
    .filter((target) => target.os !== "windows") // include an artifact only for some targets
    .map((target) => ({
      builder: "bun",
      entry: "src/cli.ts",
      targets: [`${target.os}-${target.arch}${target.libc === "musl" ? "-musl" : ""}`],
      binary: "acme",
      output: [
        ".release/artifacts/acme_{version}",
        target.os,
        distArch[target.arch],
        target.os === "linux" ? target.libc ?? "glibc" : undefined
      ].filter(Boolean).join("_")
    }))
})
```

This is more verbose than a template expression for a one-off string, but it
scales to real functions, constants, imports, and shared presets without a
second DSL. `output` here overrides D1 default naming (`targets` spells the
config vocabulary, the computed name spells distribution tokens); omitting
it yields the default-generated names.

### Npm Pipe Worked Example

The current `src/targets/npm.ts:126-162` already emits operation data. In
the pipe contract it becomes local planning over the `publish.npm` section:

```ts
const publishNpmPipe: Pipe<NpmPublishSection> = {
  id: "publish:npm",
  phase: "publish",
  section: (config) => config.publish?.npm,
  defaults: (section) => ({
    registry: "https://registry.npmjs.org",
    packagePath: ".",
    ...section
  }),
  plan: Effect.fn("pipes.publishNpm.plan")(function*(section, state) {
    return {
      artifacts: [],
      notices: [],
      operations: [
        readOnlyCommand("publish:npm:version", "Check npm CLI availability.", [
          "npm",
          "--version"
        ]),
        npmAuthOperation(section),
        ...(section.trustedPublishing?.verifyPackageExists === true
          ? [npmPackageExistsOperation(section)]
          : []),
        npmDryRunOperation(section),
        publishCommand({
          id: "publish:npm:publish",
          description: `Publish ${section.packageName}@${state.identity.version} to npm.`,
          risk: "irreversible",
          command: npmCommand(section, npmPublishArgs(section), true)
        }),
        verifyCommand({
          id: "publish:npm:verify",
          description: `Verify ${section.packageName}@${state.identity.version} exists on npm.`,
          risk: "read-only",
          command: npmCommand(
            section,
            ["view", `${section.packageName}@${state.identity.version}`, "version"],
            false
          )
        })
      ]
    }
  })
}
```

The important point is that no npm operation executes in the pipe. Auth,
dry-run, publish, and verify remain reviewable operation data.

## File Tree And Import Rules

The target source tree after plan 117 is:

```txt
src/
  index.ts
  api/
    api.ts
    errors.ts
  config/
    schema.ts
  pipeline/
    state.ts
    artifact.ts
    catalog.ts
    operation.ts
    pipe.ts
    pipeline.ts
    runner.ts
    template.ts
    identity/
      source.ts
      manifest.ts
      git-tag.ts
  builders/
    builder.ts
    targets.ts
    bun.ts
    command.ts
    prebuilt.ts
  pipes/
    build.ts
    npm-pack.ts
    pypi-wheel.ts
    archive.ts
    checksum.ts
    catalog-homebrew.ts
    catalog-scoop.ts
    publish-github.ts
    publish-npm.ts
    publish-pypi.ts
    publish-homebrew.ts
    publish-scoop.ts
  engine/
    executor.ts
    evidence.ts
    stager.ts
    github-api.ts
  host/
  workflows/
    init.ts        # init + doctor entry points stay workflow-level (117)
  types/
    effect-internal.ts
```

Directory invariants:

| Directory | Invariant |
|---|---|
| `pipeline/` | Serializable data and pure functions; zero I/O. |
| `pipes/` | One pipe per file; each owns its config section schema and defaults. |
| `builders/` | One builder per file; builders plan artifacts and operations only. |
| `engine/` | The only executor of operations. |
| `api/` | The only Promise/Effect boundary; runtime assembly, `runPromise`, error collapse. |
| `host/` | Injected platform services and live/test implementations. |

Import rules:

- `apps/*` import the package root plus their own runtime layers.
- `api/` may import `engine/`, `pipeline/`, `config/`, and `host/`.
- `engine/` may import `pipeline/` and `host/`.
- `pipes/` and `builders/` may import pipeline types only; never `engine/`
  or `host/`.
- `pipeline/` imports `effect` and itself, with one sanctioned exception:
  `pipeline/pipe.ts` may use a type-only import of `ReleaseConfig` from
  `config/` for the `section` selector. Type-only imports are erased at
  runtime, so the runtime import graph stays acyclic; the grep check allows
  `import type` there and nothing else.
- `workflows/` may import `api/`, `config/`, and `host/` — init and doctor
  sit above the engine, not inside it.
- `config/schema.ts` composes the section schemas exported by pipe files.

`src/domain/`, `src/planner/`, `src/targets/`, `src/artifacts/`, and
`src/internal/` do not exist in the target tree. Plan 115-117 verification
must include grep-enforceable checks for the import rules.

## Phase Order

The 0.1 pipeline order is static:

```txt
identity -> defaults -> build -> process -> catalog -> publish -> verify
```

Identity resolves first because per-pipe `defaults` take the resolved
identity as an argument; the earlier draft order (defaults before identity)
contradicted the contract's own `defaults` signature.

Stage assignments:

| Stage | Members | Notes |
|---|---|---|
| `identity` | `manifest` and `git-tag` sources, snapshot modifier | Kernel stage (the `VersionSource` seam, not pipes). Resolves name/version/tag/commit. |
| `defaults` | per-pipe defaults in pipeline order | Kernel stage, after identity and before any pipe plans. Distributed defaulting replaces `normalize-release.ts`. |
| `build` | `build` generic pipe with `bun`, `command`, `prebuilt` builders; `npm-pack`; `pypi-wheel` | Local artifact-producing work. |
| `process` | `archive`, `checksum` | Checksums run after all local artifact-producing pipes. |
| `catalog` | `catalog:homebrew`, `catalog:scoop` | Formula/manifest render operations happen before publish. |
| `publish` | `publish:github`, `publish:npm`, `publish:pypi`, `publish:homebrew`, `publish:scoop` | Operation risk, not phase, distinguishes reversible hosting from irreversible publishing. |
| `verify` | `Verify*` operations contributed by publish pipes | No dedicated pipe files in 0.1; the `verify` surface selects and executes exactly the read-only `Verify*` operation family. |

The 120B host-vs-publish question is resolved as presentation, not a new
phase. Risk grades already give the operator the useful split:
`externally-visible` is approximately host/undoable while draft, and
`irreversible` is publish/announce. Plan rendering must group operations by
risk with a clear divider: "everything above this line can still be undone."
Plan 117 owns the formatter change.

Snapshot is identity-stage policy plus executor policy. A snapshot run
applies `{version}-SNAPSHOT-{shortCommit}` over the active source's resolved
version, builds and processes local artifacts, and refuses
`externally-visible` plus `irreversible` operations regardless of approval
flags.

## Config Section To Pipe Mapping

0.1 config uses GoReleaser names as the null hypothesis and diverges only
where the divergence table records a concrete reason.

```ts
export default defineRelease({
  project: { name, repository, notes },
  versionFrom: "manifest",
  builds: [{ builder: "bun", entry, targets }],
  npmPackage: { path: "." },
  pypiWheel: [{ wheelTag, binaries }],
  archives: [{ formats, formatOverrides, files, wrapInDirectory }],
  checksum: { algorithm: "sha256" },
  publish: { github, npm, pypi, homebrew, scoop },
  evidence: ".release/evidence"
})
```

| Config section | Owning pipe or stage | Status | Current capability carried forward |
|---|---|---|---|
| `$schema` | `config/schema.ts` | Exists | Schema URL only; no config version integer. |
| `project.name` | identity/defaults | Exists | Explicit config wins; else package manifest; else hard error. |
| `project.repository` | publish/catalog defaults | Exists | Used for release URLs and catalog repositories. |
| `project.notes` | identity (consumed by `publish:github`) | Exists | Carried on `ReleaseIdentity.notes`; GitHub release notes/title inputs. |
| `project.commit` | identity | Exists | Commit override remains identity data where provided. |
| `project.tagTemplate` | identity | Exists | Tag rendering remains identity data; default can derive from version. |
| `versionFrom` | identity source | New in 0.1 | `"manifest"` default; `"git-tag"` lands in plan 116. |
| `snapshot` | identity modifier and executor policy | New in 0.1 | Run option only (`--snapshot` / `RunOptions.snapshot`, plan 117); not a config key, and the version format is fixed in 0.1. |
| `builds[]` | `build` pipe + builder registry | Replaces `build.bun` | Canonical targets, `builder` discriminator, binary outputs. |
| `builds[].builder: "bun"` | `builders/bun.ts` | Exists after migration | Current Bun executable compile, moved into library staging. |
| `builds[].builder: "command"` | `builders/command.ts` | New in 0.1 | Language-agnostic command escape hatch. |
| `builds[].builder: "prebuilt"` | `builders/prebuilt.ts` | New in 0.1 | Run-nothing import with existence checks. |
| `npmPackage` | `npm-pack` pipe | Exists after migration | Current package artifact for npm publishing. |
| `pypiWheel[]` | `pypi-wheel` pipe | Exists after migration | Current wheel assembly, moved into library staging. |
| `archives[]` | `archive` pipe | New in plan 116 | Explicit section; absent means skip. |
| `checksum` | `checksum` pipe | New in plan 116 | Explicit section; absent means skip. |
| `publish.github` | `publish:github` | Exists | GitHub release create/update, upload; contributes its `Verify*` checks. |
| `publish.npm` | `publish:npm` | Exists | Real package publish, trusted publishing support; contributes its `Verify*` checks. |
| `publish.pypi` | `publish:pypi` | Exists | Wheel upload; contributes its `Verify*` checks. |
| `publish.homebrew` | `catalog:homebrew` + `publish:homebrew` | Exists | Formula rendering and tap publish; verify checks from the publish pipe. |
| `publish.scoop` | `catalog:scoop` + `publish:scoop` | Exists | Manifest rendering and bucket publish; verify checks from the publish pipe. |
| `strict` | kernel state + plan-time pipe policy | Exists | Top-level flag carried into `ReleaseState.strict`; pipes keep today's strict validations (e.g. npm's dry-run requirement). |
| `evidence` | `engine/evidence.ts` | Exists | Evidence directory (`string \| { directory }`, placeholder-capable). |

Exactly one pipe owns each section's schema and defaults. Homebrew and
Scoop have paired catalog/publish pipes because rendering repository files
and publishing them are separate phases; there the catalog pipe is the
owner (it plans first) and the publish pipe consumes the already-defaulted
section. Verify checks are not pipes at all: publish pipes contribute
`Verify*` operations, so no `verify:*` pipe files exist.

### Per-Section Field Tables

| Section | 0.1 fields | Defaults and semantics |
|---|---|---|
| `project` | `name?`, `repository?`, `notes?`, `commit?`, `tagTemplate?` | `name` explicit wins, then package manifest, else error. `tagTemplate` defaults to `v{version}`. |
| `versionFrom` | `"manifest" \| "git-tag"` | Default `"manifest"`. `git-tag` follows D5. |
| `builds[]` | `id?`, `builder`, `binary?`, `entry?`, `output?`, `targets`, builder options | `builder` is the discriminator. Canonical target grammar comes from plan 119. `output` is the per-target path template — required by `command`/`prebuilt` (119 B4), optional for `bun` (D1 default naming when absent). |
| `command` builder | `run`, `output`, `binary?`, `targets` | `run` is string or argv array; string form whitespace-splits without quote rules. |
| `prebuilt` builder | `output`, `binary?`, `targets` | Emits existence checks and catalog artifacts; no build operation. |
| `npmPackage` | `path?` | Package staging for `publish:npm`; today's `build.npmPackage` carried forward (plan 115 pins remaining fields during the port). |
| `pypiWheel[]` | `id?`, `wheelTag`, `packageName`, `binaries[]` | Wheel assembly carried forward from today's `build.pypiWheel`, staged via `StageArtifactOperation` (plan 115). |
| `archives[]` | `id?`, `ids?`, `nameTemplate?`, `formats?`, `formatOverrides?`, `files?`, `wrapInDirectory?` | Absent section skips. 0.1 format enum: `tar.gz \| zip` (extendable literal union). Defaults: `formats: ["tar.gz"]`, name `{name}_{version}_{os}_{arch}` + extension, one archive per platform (that platform's binaries plus included files), default globs `license*`/`LICENSE*`/`readme*`/`README*`/`changelog*`/`CHANGELOG*` quiet when unmatched; windows override example uses `formats: ["zip"]`. `wrapInDirectory`: `true` wraps in the archive name, a string is the literal directory, absent/`false` no wrap. |
| `checksum` | `algorithm?`, `nameTemplate?` | Absent section skips. Default `sha256`; file `{name}_{version}_checksums.txt`; line format `<hex>  <basename>\n` — the TWO spaces are load-bearing (`sha256sum -c`/`shasum -c`), entries sort by basename. Inputs are exclusion-form: every catalog artifact except `checksum-file`/`signature` kinds (catalog files render in a later phase, so they are structurally excluded; new kinds are included automatically). |
| `publish.github` | `repository`, `draft?`, `prerelease?`, `nameTemplate?`, `tokenEnv?` | Name defaults to tag; `prerelease: "auto"` follows semver prerelease. |
| `publish.npm` | `registry?`, `packageName`, `packagePath?`, `trustedPublishing?`, `access?`, `provenance?`, `tokenEnv?` | Existing semantics; real package publish is already shipped. |
| `publish.pypi` | `repositoryUrl?`, `packageName`, `tokenEnv?`, `trustedPublishing?` | Existing wheel upload/verify semantics. |
| `publish.homebrew` | `repository`, `name?`, `commitAuthor?`, `commitMessage?`, `install?`, `ids?`, `style?` | Formula in 0.1. `style: "cask"` reserved additive. Defaults (D7): name from project name; commit message `Brew formula update for {name} version {tag}`; install one `bin.install` per binary with `install` as override. More than one candidate artifact per os/arch is a config error; sha256 values come from catalog checksums. |
| `publish.scoop` | `repository`, `name?`, `homepage?`, `description?`, `license?`, `commitAuthor?`, `commitMessage?`, `ids?` | Current single-URL manifest remains; multi-arch manifest is first post-port improvement. Commit message default (D8): `Scoop update for {name} version {tag}`. |
| `strict` | `boolean?` | Plan-time strict policy, carried in `ReleaseState.strict`; existing semantics unchanged. |
| `evidence` | `string \| { directory }` | Evidence directory, placeholder-capable (e.g. `.release/evidence/{version}`); carried forward unchanged. |

### Monorepo Design-Ahead

Single-project config remains the default authoring form. Future monorepo
support wraps the same project shape without changing it:

```ts
defineRelease({
  projects: [{
    dir: "packages/cli",
    tagPrefix: "cli/",
    project: { name: "acme-cli" },
    versionFrom: { source: "git-tag", tagPrefix: "cli/" },
    builds: [...],
    publish: {...}
  }]
})
```

Identity is per-project pluggable; `tagPrefix` is a git-tag source option,
not global kernel behavior. Top-level sections in the single-project form
must be valid inside `projects[]` unchanged.

## Divergences From GoReleaser

| Divergence | GoReleaser behavior | ts-release contract | Rationale |
|---|---|---|---|
| Config schema version | Root `version: 2`, unsupported-version errors (`plans/research/121-goreleaser-spec.md` section 1.1). | No integer; `$schema` URL plus Schema decode errors. | YAML migration gate is not needed for typed TS/schema URLs. |
| Project name guessing | Guesses Cargo, release repo, Go module, git remote. | Explicit config, then package manifest, else hard error. | Remote-derived guessing surprises TS package authors. |
| Implicit archives/checksums | Inserts default archive and checksums unless disabled (section 2). | Sections are explicit; absence skips with notice. | Bare binaries are common for Bun/Deno; null state is the escape hatch. |
| Archive `format: binary` | Pseudo-format to avoid archives. | Not adopted. | No implicit archive means no pseudo-format is needed. |
| Checksum algorithms | 14 algorithms in upstream enum (section 8). | `sha256 \| sha512` in 0.1. | Extendable later; two algorithms cover current need. |
| Snapshot default | `{version}-SNAPSHOT-{shortCommit}` over current version (section 3), template configurable. | Same format, fixed (no version-template config in 0.1); next-patch correction called out. | Compatibility; avoids the false next-patch assumption; a template knob without demand is D10-class surface. |
| Env override name | `GORELEASER_CURRENT_TAG`. | `TS_RELEASE_CURRENT_TAG`. | Existing repo prefix convention. |
| Build discriminator | `builder`. | `builder`. | Adopted; previous `tool` draft is rejected because upstream `tool` means executable. |
| Templated booleans | Many string fields parse as templated bools. | Plain booleans or omitted sections. | TypeScript computes conditionals before decode. |
| Template DSL | Go templates with functions and `.Artifacts`. | Fixed placeholders; TypeScript functions for richer logic. | Avoid a second language while preserving expressiveness. |
| Skip flags | `--skip=<phase>` with many validated keys (section 10). | No `--skip` in 0.1; skips are config/data and approval policy. | Plan-first + risk gates cover the safety use cases. |
| Artifact extras | Untyped map plus non-serializable `ExtraRefresh` function. | Tagged extras; no function-valued state. | Resume/split-merge require serializable state. |
| Homebrew naming | `brews` deprecated in favor of casks. | Neutral `homebrew`, formula in 0.1, future `style: "cask"`. | Homebrew-on-Linux formula users are in scope; casks are macOS-only today. |
| Scoop archives | Upstream requires Windows archives. | Bare `.exe` URLs remain supported. | Scoop itself supports bare executable URLs. |
| Host/publish split | dist/cargo-dist has structural Host/Publish phases. | Single publish phase; plan renderer groups by risk. | Existing risk grades and approval flags already encode the boundary. |
| Output layout | GoReleaser uses `dist/<build.id>_<target>/...`. | Keep `.release/artifacts`. | Existing dogfood/install scripts rely on it; uniqueness is a plan error. |

## GoReleaser Parity Matrix

The tier column is market context only. It never justifies deferral.

| GoReleaser feature | Tier | ts-release today | Landing spot | Architectural cost here | Milestone |
|---|---|---|---|---|---|
| Builds | Free | Bun executable recipes in app runtime | `build` pipe + builders | One generic pipe plus builders | 0.1 |
| Bun builder | Free | In-process `Bun.build` recipe | `builders/bun.ts` | One builder | 0.1 |
| Command builder | Custom exec adjacent | No | `builders/command.ts` | One builder | 0.1 |
| Prebuilt binaries | Pro | No | `builders/prebuilt.ts` | Trivial-by-construction: run-nothing builder + existence checks | 0.1 |
| Universal binaries | Free | No | `process` pipe over executable catalog | One pipe; may stress binary merge stager | Post-0.1 |
| Archives | Free | No | `archive` + `archives[]` | One pipe | 0.1 |
| Checksums | Free | No | `checksum` + `checksum` | One pipe | 0.1 |
| Snapshot | Free | No | identity modifier + executor policy | Config-layer plus executor policy | 0.1 |
| Changelog | Free | No | `changelog` pipe + notes-as-data | One pipe; schema baseline from section 1.6 (default `use: git`, entry-format templates, include-over-exclude filters, ordered groups with catch-all, sort, abbrev) plus section 4 previous-tag discovery | First post-0.1, ahead of any new publish channel |
| GitHub releases | Free | Yes | `publish:github` | Port existing target to one pipe | 0.1 |
| Homebrew formulas | Free/deprecated upstream name | Yes | `catalog:homebrew`, `publish:homebrew` | Port existing target; catalog selection improves | 0.1 |
| Scoop | Free | Yes | `catalog:scoop`, `publish:scoop` | Port existing target; multi-arch improvement later | 0.1 |
| Winget | Free | No | `catalog:winget`, `publish:winget` | One or two pipes | Post-0.1 |
| Chocolatey | Free | No | `catalog:chocolatey`, `publish:chocolatey` | One or two pipes | Post-0.1 |
| AUR | Free | No | `catalog:aur`, `publish:aur` | One or two pipes | Post-0.1 |
| Nix | Free | No | `catalog:nix`, `publish:nix` | One or two pipes | Post-0.1 |
| nFPM packages | Free | No | package pipe producing Linux package artifacts | One pipe plus stager support | Post-0.1 |
| Dockers | Free | No | `publish:docker` after build/catalog inputs | Kernel-stressing only if digest feedback is needed | Post-0.1 |
| Blob uploads | Free | No | `publish:blob` | One pipe | Post-0.1 |
| Signs | Free | No | `sign` process pipe filtering archives/executables | One pipe plus command operations | Post-0.1 |
| SBOMs | Free | No | `sbom` process pipe | One pipe plus command operations | Post-0.1 |
| Custom publishers | Free | No | `publish:custom` command pipe | One pipe; command builder patterns reused | Post-0.1 |
| Announce | Free | No | `announce:*` after publish | One pipe per channel | Post-0.1 |
| Milestones | Free | No | `publish:github-milestone` | One pipe using GitHub layer | Post-0.1 |
| npm real package publishing | Absent upstream (Pro `npms` is binary distribution, not package publish) | Yes | `publish:npm` | Trivial-by-construction: already shipped | 0.1 |
| PyPI publishing | Not first-class in GoReleaser OSS comparison | Yes | `publish:pypi` | Trivial-by-construction: already shipped | 0.1 |
| npm binary distribution | Pro docs-derived `npms` | No | `npm-binary` pipe producing platform packages | One pipe; esbuild-style optional dependencies | Post-0.1 |
| Monorepo | Pro | No | `projects[]` wrapper + per-project identity | Kernel-stressing around orchestration and evidence grouping | Post-0.1 |
| Split/merge builds | Pro | No | serialized `ReleaseState` import/export | Trivial-by-construction: Schema state is serializable | Post-0.1 |
| Nightly | Pro | No | identity modifier | Config-layer plus scheduler policy | Post-0.1 |
| Config includes | Pro | TypeScript can import modules | TS imports/exported presets | Trivial-by-construction: reuse is native TS | 0.1 docs |
| Artifact `if` filtering | Pro | No | catalog filter predicates | Trivial-by-construction: catalog is data with filters | Post-0.1 |
| `.Artifacts` template access | Pro | No template DSL | TypeScript over catalog data | Trivial-by-construction: catalog is ordinary data | 0.1 TS authoring |
| Custom template variables | Pro | No DSL | TypeScript constants/functions | Trivial-by-construction: values are code before decode | 0.1 TS authoring |
| Hooks | Pro for some hook classes | No general hook runner | explicit command/build/publish pipes | Config-layer; avoid generic task runner | Post-0.1 |
| MSI/DMG/PKG/App bundles | Pro | No | package/sign/notarize pipes | One pipe per package family plus platform stagers | Post-0.1 |
| Prepare/publish/continue workflow | Pro staged workflow | Plan/execute already | plan data + approved executor | Trivial-by-construction: this is the default model | 0.1 |
| Publish continue-on-error/fail-fast | Free publisher behavior | No | executor policy | Config-layer/executor policy row | Post-0.1 |
| Checksum split/extra files | Free | No | `checksum` options | Config-layer on checksum pipe | Post-0.1 |
| Install-side compatibility | Ecosystem expectation | Partial explicit names | default artifact naming/checksum contract | Config defaults; no kernel cost | 0.1 |
| Generated CI | dist/cargo-dist comparable | `init` creates workflows | `init` templates call same API core | One workflow-template pass | Post-0.1 |
| Diagnostics | Error encyclopedia upstream | Structured operation descriptions/evidence | pipe/operation ids in errors and summaries | Presentation layer over existing data | 0.1 and ongoing |
| Future Effect API | Not applicable | No | `/effect` subpath | Zero-redesign because engine already returns summaries | After Effect 4 stable |

Adopted 0.1 tagline (120B, used verbatim by downstream docs):
*"GoReleaser-grade distribution for TypeScript/Bun CLI authors, with typed
config and a reviewable publish plan."*

Positioning order for downstream docs:

1. Lead with rehearsal/plan-first: reviewable plans, snapshot rehearsal, and
   explicit approval.
2. Then no Pro boundary and no closed-source release binary in the supply
   chain, backed by evidence artifacts.
3. Then typed DRY config with TypeScript imports/presets instead of YAML and
   Go templates.
4. Keep npm/PyPI availability as a supporting differentiator, not the
   headline.

Answer the semantic-release objection directly: semantic-release automates
npm versioning from commits; ts-release distributes compiled artifacts,
wheels, Homebrew/Scoop metadata, and reviewable publish plans. A future
conventional-commits `VersionSource` can consume semantic-release-style
signals without turning this package into npm automation.

## Public API Contract

Public 0.1 is Promise-based and plain-data. The engine beneath it is
Effect-native and returns these same summary types directly. The `api/` layer
assembles a runtime, calls `runtime.runPromise`, and collapses tagged engine
errors into `ReleaseApiError`; it performs no result mapping.

The Effect probe pins the Promise boundary: `ManagedRuntime.make(layer)` plus
`runtime.runPromise(effect)`, and an explicit disposal story via
`runtime.dispose()` (`plans/research/effect-v4-api-probe.md`, decision 5).

Root exports:

```ts
export { defineRelease }
export type { ReleaseConfig }
export { releaseConfigJsonSchema, renderReleaseConfigJsonSchema }

export declare function plan(options?: RunOptions): Promise<ReleasePlanSummary>
export declare function build(options?: RunOptions): Promise<BuildSummary>
export declare function release(options?: ReleaseRunOptions): Promise<ReleaseSummary>
export declare function verify(options?: RunOptions): Promise<VerifySummary>

interface RunOptions {
  readonly config?: string | ReleaseConfig
  readonly workspace?: string
  readonly snapshot?: boolean
}

interface ReleaseRunOptions extends RunOptions {
  readonly execute?: boolean
  readonly approvePublish?: boolean
}
```

Calling `release()` bare is plan-only. `execute` defaults false and
`approvePublish` defaults false.

Summary type shapes:

```ts
interface OperationSummary {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly risk: OperationRisk
  readonly status: "planned" | "executed" | "skipped" | "failed" | "refused"
  readonly evidencePath?: string
}

interface ReleasePlanSummary {
  readonly identity: ReleaseIdentitySummary
  readonly artifacts: ReadonlyArray<ArtifactSummary>
  readonly operations: ReadonlyArray<OperationSummary>
  readonly notices: ReadonlyArray<PipeNoticeSummary>
}

interface BuildSummary extends ReleasePlanSummary {
  readonly stagedArtifacts: ReadonlyArray<ArtifactSummary>
}

interface ReleaseSummary extends ReleasePlanSummary {
  readonly executed: ReadonlyArray<OperationSummary>
  readonly refused: ReadonlyArray<OperationSummary>
}

interface VerifySummary {
  readonly identity: ReleaseIdentitySummary
  readonly checks: ReadonlyArray<OperationSummary>
}
```

CLI and Action mapping:

| Surface command | API call | Notes |
|---|---|---|
| `ts-release plan` | `plan()` | Adds `--snapshot`. |
| `ts-release build` | `build()` | Executes local `writes-local` staging only. |
| `ts-release release` | `release()` | Plan-only by default; `--execute` and `--approve-publish` map to API booleans. |
| `ts-release verify` | `verify()` | Read-only checks. |
| `ts-release init` | workflow-level init | Stays outside the four-function release API. |
| `ts-release doctor` | workflow-level diagnostics | Stays outside the four-function release API. |
| `ts-release render` | removed | Catalog rendering becomes `catalog`-phase operations under build/release. |
| GitHub Action `plan/build/release/verify` | same four functions | Node runtime adapter over the same API. |

Inline config is first-class:

```ts
await release({
  config: defineRelease({
    project: { name: "acme-cli" },
    builds: [{ builder: "bun", entry: "src/cli.ts", targets: ["linux-x64"] }],
    checksum: {}
  })
})
```

`ts-release.config.ts` file loading remains deferred; the inline API is the
TypeScript authoring path for 0.1.

## LOC Budget

Baseline at plan time:

| Area | Baseline LOC | 0.1 ceiling |
|---|---:|---:|
| `src/planner` | 2656 | Replaced |
| `src/targets` | 2073 | Replaced |
| `src/artifacts` | 100 | Replaced |
| `src/domain` | 1085 | Replaced (state/artifact/operation move into `pipeline/`) |
| `src/workflows` | 1593 | Init/doctor only after 117 |
| `src/config` | 136 | Carried forward; composition only |
| `src/host` | 733 | Carried forward; absorbs `internal/workspace-path.ts` |
| `src/pipeline` | 0 | <= 800 |
| `src/pipes/*` | 0 | <= 250 per pipe, about 150 expected |
| `src/builders/*` | 0 | <= 500 total |
| `src/engine` | 0 | <= 900 |
| `src/api` | 0 | <= 250 |
| `apps/release-ts/src/runtime/*-recipes.ts` | about 800 | absorbed into pipes/stager |
| `apps/release-ts/src` | 966 | <= 700 |
| `apps/ts-release-action/src` | 766 | CLI+Action combined <= about 1200 after 117 |

The pipeline ceiling is 800, not the earlier 400 draft figure: D18 moves
the ~300-line operation module and the identity sources into the kernel,
and `src/domain` dissolves into `pipeline/` and the pipes rather than
surviving as its own area. The combined ceiling below already absorbs that.

Implementation plans must record this exact measurement command:

```sh
find src apps/release-ts/src apps/ts-release-action/src -name '*.ts' | xargs wc -l | tail -1
```

At contract commit time it reports 10,203: the command covers the library
and the two app source trees only — `scripts/`, `apps/release-ts/scripts/`,
and `test/` sit outside it, which is where the older ~13.7k whole-repo
figure came from.

The combined target for the old planner/targets/artifacts/workflows/domain
mass (~7.5k) is about 4.3k LOC across `pipeline`, `pipes`, `builders`,
`engine`, and `api` (800 + ~1.8k + 500 + 900 + 250), including the new
archive and checksum features. The target is architecture pressure, not
code golf.
