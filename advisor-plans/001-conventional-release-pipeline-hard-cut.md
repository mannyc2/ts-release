# Plan 001 — Replace the prepared-byte and typed-authority kernel with a conventional release pipeline

> **Executor instructions:** Read this plan completely before editing. Follow the
> checkpoints in order and run every verification command. If a stop condition
> occurs, stop and report the evidence; do not improvise a compatibility layer or
> weaken a retained provider behavior. On completion, update this plan and its row
> in `advisor-plans/README.md` unless the reviewer says they own the index.
>
> **Drift check (run first):** Use the single canonical command in “Drift
> procedure” below. If an in-scope path changed, compare the live implementation
> with “Current-state evidence.” A semantic mismatch is a stop condition.

## Plan metadata

| Field | Value |
| --- | --- |
| Status | REJECTED/SUPERSEDED — its no-continuation premise conflicts with the canonical research law, and its pre-0.2 unpublished-version condition is false after v0.2.2 |
| Priority | P1 |
| Effort | L |
| Risk | HIGH |
| Categories | Architecture, tech debt, migration, developer experience |
| Planned at | `48ec3002b6d18ebd24667230b5ecda2c698afe10` on 2026-08-13 |
| Target branch | `codex/001-conventional-release-pipeline` |
| Target commit message | `Make the release pipeline conventional` |

## Why this matters

The current release path carries the same operation through a graph publication,
a prepared publication, a content-addressed store, and a generic authority subject
before the provider executes it. That duplication occupies most of the release
kernel, has made internal protocols public, and still does not place the actual
GitHub/catalog request inside the generic authority decision. A conventional
artifact manifest plus provider-local flows preserves the release behaviors that
users observe while deleting the representations and certification work that exist
only to keep those representations synchronized.

## Outcome

Replace the repository-specific prepared-byte and typed-authority protocols with
one conventional release pipeline:

```text
resolve and inspect configuration
  -> build final files in an ordinary managed output directory
  -> write one versioned artifact/task manifest last
  -> reopen and validate that manifest
  -> publish through provider-local workflows with late credentials
  -> return a compact truthful report
```

The main path must be explainable as **build once -> record artifacts and
checksums -> publish with provider credentials -> verify and report**. No public
prepared reference, content-addressed bundle, opaque grant, provider-neutral
observation/decision proof, recovery-profile matrix, terminal claim, or correction
lifecycle remains.

This is a hard cut, not a staged compatibility migration. It is one vertical plan
because the old kernel is exposed by every boundary. A partial merge would either
break the repository or create peer representations and adapters that preserve
the costs.

## Decision gate — required before implementation

The owner must explicitly accept all four statements. If any answer is no, stop
and write a new plan for the narrower product rather than weakening this plan.

1. **Approve the pre-0.2 compatibility cut.** Delete prepared refs/store/CAS,
   source and tool provenance, `prepare`/`observe`/`correct`, generic grants and
   recovery profiles, provider SDK acknowledgements, the Action hosted-reference
   protocol, authority-specific configuration fields, configurable credential
   environment names, custom npm registries, and catalog managed-state v2 with
   its correction lifecycle. Do not ship aliases or an in-mainline v2 reader.
2. **Move approval authority to the deployment boundary.** Protected CI
   environments, repository permissions, ordinary CI artifact transfer, and local
   hashes replace an engine-level proof that an approved content digest caused a
   particular remote mutation.
3. **Use provider preflight, explicit reruns, and an honest `uncertain` result.**
   Delete the universal cross-run reconciliation and terminal-claim protocols.
   Within one invocation, an ambiguous mutation step is never automatically
   replayed. A later explicit invocation observes again, but—without a durable
   claim—may dispatch again after authoritative absence. Accept that narrower
   guarantee, especially for PyPI, rather than implying free cross-run safety.
4. **Freeze features during compression.** Do not add hooks, custom publishers,
   partial/split state, new providers, or a second manifest format in this change.

The repository currently describes `0.2.0` as a candidate while `0.0.7` is the
published release. Before branching, verify that this remains true using both the
remote Git repository and the full registry history:

```bash
git tag --list
git ls-remote --tags origin 'refs/tags/0.2.0' 'refs/tags/v0.2.0' 'refs/tags/0.0.7' 'refs/tags/v0.0.7'
bun pm view @mannyc1/ts-release versions --json
bun pm view @mannyc1/ts-release dist-tags --json
```

Record the exact output: `0.2.0` must be absent from remote tags and registry
versions, and the claimed `0.0.7` history must be visible. **STOP** if either
lookup is unavailable or ambiguous, if `0.2.0` has been tagged/published, or if a
user has retained a v2 prepared reference that must remain executable. Decide
versioning and a time-bounded external migration tool before changing code. Do
not infer “unpublished” from a failed command, and do not put a v2 reader or alias
into the new mainline by default.

Catalog managed-state v2 was added after `0.0.7`. Before branching, enumerate the
catalog destinations and state paths resolved by the repository's live release
configuration and perform read-only checks against those destinations. Record
that each state file is absent. **STOP** if a v2 state file is deployed, if a
destination cannot be conclusively checked, or if an external consumer is known
to depend on that schema. Resolve that compatibility obligation outside this hard
cut before proceeding; absence must never be inferred from a failed read.

## Success criteria

The plan is complete only when all of the following are true:

- The root API has four lifecycle operations: `inspect`, `build`, `publish`, and
  `release`. `release` invokes the same manifest-reading `publish` path used by a
  split build/publish workflow.
- The CLI has `init`, `inspect`, `build`, `publish`, and `release`; it has no
  `--store`, prepared ref, `prepare`, `observe`, or `correct` path.
- The Action supports `build`, `publish`, and `release`, transfers an ordinary
  output directory through standard workflow artifact actions, and exposes no
  hosted prepared-reference protocol.
- A single `release-manifest.json` is the only durable release-domain input to
  publication. It contains no secret values or environment-variable selectors,
  grants, source snapshots, workflow identities, tool provenance, blob references,
  phase cursor, or publication outcomes. The output-ownership marker described
  below is only a cleanup guard and is never publication input.
- Publish tasks are ordinary data until `publish` or `release` executes them.
  Provider-local Effect workflows own preflight, exact local planning, late
  credential access, dispatch, and optional read-back.
- Build failure cannot dispatch a provider mutation or read a provider secret.
  Equivalent remote state is skipped and conflicts block without dispatch.
  Public preflight remains anonymous where possible; a private destination may
  read its shared bearer token during publish because that token is also required
  for observation. Ambiguous post-dispatch state is reported as uncertain and no
  mutation step is automatically replayed within that invocation.
- Final artifact SHA-256 and size are validated immediately before use. HTTP
  publishers send the bytes they validated; subprocess publishers invoke the
  validated file in the managed output directory and document the trusted local
  process boundary.
- The production TypeScript scope (`src` plus every `apps/*/src`) is at most
  **11,500 physical lines**, down from 17,499 at planning time. The core
  API/release/publication/correction/extensions
  scope is at most **5,500 physical lines**, down from 10,356.
- Tests are counted separately. Production logic is not moved into tests, scripts,
  generated files, or documentation to meet the budget. The test suite does not
  grow above its 16,953-line baseline (`test` plus every `apps/*/test`) without an
  itemized behavior justification.
- Root runtime and type exports are the exact 20-name list in atomic subphase 4. Package
  subpaths are exactly `.`, `./node`, `./bun`, and a simplified `./host`;
  `./store` and `./provider-sdk` do not exist.
- The runtime exposes at most one package-owned workspace-inspection
  `Context.Service`; build and provider workflows depend directly on the standard
  Effect filesystem/path/HTTP/process/Config services they use. One boundary layer
  composes them without turning a record of services into a locator.
- No compatibility facade, renamed grant, renamed prepared bundle, universal
  recovery matrix, or generated certification mirror survives the forbidden-term
  gate.
- All focused provider contracts, public API/CLI/Action contracts, portable
  gates, full tests, type checks, builds, packed-consumer tests, and clean-clone
  bundle checks pass without a live publish.

## What is preserved, and where it moves

| Current benefit | Conventional home |
| --- | --- |
| Build completes before provider credentials are needed | `inspect` and `build` have no provider credential dependency; each publisher reads credentials only inside `publish`, after anonymous preflight where the destination permits it |
| Publish the selected build outputs rather than rebuilding | The managed output directory plus artifact ID/path/size/SHA-256 inventory |
| Detect changed or substituted artifacts | Manifest decoding, path containment, regular-file/symlink checks, and hashing immediately before dispatch |
| Safe reruns after known outcomes | Provider-local exact equivalence and conflict checks; rerunning after a known success/skip reopens the manifest and re-observes. Unknown PyPI attempts retain the explicitly accepted cross-run redispatch risk |
| No automatic blind retry after a lost response | Within one invocation, each mutation step is attempted at most once and ambiguity stops the task as `uncertain`; an explicit later invocation may dispatch after a fresh authoritative-absence result |
| Separate build and protected publish jobs | Standard `upload-artifact`/`download-artifact` around the whole managed output directory, with the publish job's environment as the approval boundary |
| No automatic secret propagation and safe reporting | Fixed logical credential slots, `Config.redacted` inside publish workflows, closed build/npm environments, unredaction only at the HTTP/spawn boundary, output redaction, and finalizers. Strong build/publish isolation comes from separate CI jobs |
| Useful audit evidence | Manifest, checksums, provider task IDs/destinations, and compact task outcomes; optional CI attestations remain external |
| Exact provider conflict rules | Provider modules, not a provider-neutral decision algebra |
| Ordered stop-on-failure behavior | A small sequential task runner; remaining tasks become `blocked` with the prior task ID in the message |

The following guarantees are intentionally not preserved because they cause the
architecture under removal: content-addressed approval tokens, crash-safe CAS,
authenticated Action producer/run/workflow provenance, exact source/tool/input
forensics, process-independent proof of identical bytes, universal ambiguous-write
resolution, prevention of an explicit cross-run redispatch after an unknown PyPI
attempt, and corrections bound to a prepared digest.

## Current-state evidence

### Two peer release models

- `src/release/graph.ts` defines artifacts and four provider publication variants.
- `src/release/prepared.ts` defines the same project, artifacts, and provider
  publication families again, plus source/provenance identity.
- `src/release/prepare.ts` converts the graph into the prepared model field by
  field.
- `src/publication/adapter.ts` converts prepared publications into provider
  subjects a third time.
- `src/release/prepared-store.ts` canonicalizes, hashes, writes blobs, fsyncs,
  renames, reloads, and revalidates the bundle.
- In the normal local `release` path, `src/api/api.ts` commits the bundle and then
  publishes the already-resident `committed.bundle`; the durable reload is not
  needed for that run.
- In the Action path, `apps/ts-release-action/src/prepared-store.ts` uploads and
  immediately downloads/authenticates the bundle even when the command is a
  one-call release.

Load-bearing excerpt (`src/api/api.ts:156-188,257-264`):

```ts
const prepareProgram = Effect.fn("prepareProgram")(function*(input, options) {
  // ...
  const store = yield* PreparedReleaseStore
  return yield* prepareRelease({ context: compiled.context, graph: compiled.graph, store, /* ... */ })
})

const releaseProgram = Effect.fn("releaseProgram")(function*(input, adapters) {
  const committed = yield* preparationFailure(prepareProgram(input, { /* ... */ }))
  return yield* afterCommitFailure(committed.ref, publishCommitted(committed, adapters))
})
```

### Authority types do not contain the exact mutation

- `src/release/graph.ts` reconstructs `PublicationAuthorityIntent` from provider,
  destination, and authentication fields, then providers validate those duplicated
  facts back against their own publication.
- `src/publication/report.ts` represents mutation decisions with a subject and a
  string kind, not the request bytes, URL, tree ID, artifact digest, or conditional
  write.
- `src/publication/github.ts` and `src/publication/catalog-git.ts` retain their real
  mutation plan in provider-local mutable closures between observation and
  mutation. The generic grant does not authorize that plan.
- `src/publication/authority.ts` validates in-process issuance, subject, provider,
  audience, and purpose labels. It cannot downscope the underlying bearer token.
- `src/platform/credentials.ts` explicitly bundles purposes for raw environment
  tokens because the remote credential itself has no verifiable downscope.
- `src/publication/coordinator.ts` consumes a terminal claim before credential and
  local dispatch preflight. A missing credential or before-dispatch rejection can
  therefore consume a coordinate without sending a request.

Load-bearing excerpts:

```ts
// src/release/graph.ts:103-123
export class PublicationAuthorityIntent extends Schema.Class(/* ... */)({
  subject: SubjectId,
  provider: ProviderId,
  audience: CanonicalAudience,
  observationStrategies: Schema.NonEmptyArray(ResolvedAuthStrategy),
  publishStrategy: ResolvedAuthStrategy
}) {}

// src/publication/report.ts:106-128
export class MutationPrecondition extends Schema.Class(/* ... */)({ kind: NonEmptyName }) {}
export class NeedsMutation extends Schema.TaggedClass(/* ... */)({
  subject: SubjectId,
  precondition: MutationPrecondition
}) {}
```

The public decision contains no request. The coordinator then claims first at
`src/publication/coordinator.ts:442-457`, acquires a credential at lines 458-470,
and only afterward calls the provider at lines 471-473.

### The public surface freezes the implementation

- `src/index.ts` exports six lifecycle operations, prepared reference codecs,
  prepared identity values, correction values, report variants, and credential
  errors.
- `src/api/types.ts` requires seven services and makes prepared refs the inputs to
  observe, publish, and correct.
- `src/host.ts` requires a prepared store and authority services at the custom host
  boundary.
- `package.json` exports `./store` and `./provider-sdk`.
- The CLI exposes seven commands and a store option. The Action exposes prepared
  input/output. `.github/workflows/release.yml` and both workflow templates route
  recovery through a hosted prepared ref.
- The packaged agent skill still teaches `prepared-release/v1` while production
  has already moved to v2, demonstrating the synchronization cost.

### The certification layer mirrors the runtime model

- `src/capabilities/registry.ts`, `module.ts`, and `field-ownership.ts` join
  provider modules, prepared tags, recovery profiles, field ownership, evidence,
  and tests.
- `src/release/capabilities.ts` already has a direct
  `contributeRelease(config, context)` composition path. Use that as the migration
  seam, then split it into build-plan compilation and one post-build
  `compilePublishTasks(config, artifactInventory)` function in
  `src/release/compiler.ts`; the registry and the capability-named module can go.
- `scripts/lib/capabilities.ts`, `field-effect-witnesses.ts`, and
  `recovery-docs.ts`, plus their check/generate entrypoints, exist primarily to
  prove agreement among the peer models. They should be deleted, not translated
  into a new ceremony.

Migration seam (`src/release/capabilities.ts:436-453`):

```ts
export const contributeRelease = (config, context) => {
  const build = contributeSourceArtifacts(config, context)
  // package and render contributions derive from the available artifacts
  return [build, packaged, homebrew, scoop, contributeNpmPublication(/* ... */),
    contributePyPiPublication(/* ... */), contributeGitHubPublication(/* ... */),
    contributeCatalogPublications(/* ... */)]
}
```

The current compiler instead loops `preparationCapabilities` and
`publicationCapabilities` from the registry (`src/release/compiler.ts:3-27`).

### Latest Action/workflow drift extends the same certification boundary

Planning history through `48ec300` added
`apps/ts-release-action/scripts/preload-bun-compile-runtimes.ts`, an Action shell
bootstrap, dependency-cache priming/removal steps in all release workflows, and
tests that certify those exact sequences. The runtime script pins cross-target Bun
runtime digests, hydrates a private cache, and verifies the files before the
current offline preparation boundary; the workflows then install only to prime a
cache, delete root `node_modules`, and rely on a second private preparation
install. Those are useful under the current provenance promise, but they extend
the certification surface tied to the model being removed. The conventional
boundary lets the unprivileged build job perform one ordinary frozen install and
acquire normal build-tool resources; the protected publish job needs neither
workspace dependencies nor build tools. This plan therefore deletes the runtime
preloader and replaces the prime/delete/private-install sequence rather than
adapting either into manifest provenance.

### Measured baseline and deletion budget

All measurements below are physical TypeScript lines from the planning commit;
tests are intentionally separate.

| Scope | Baseline |
| --- | ---: |
| `src` | 15,757 |
| All `apps/*/src` TypeScript | 1,742 |
| Total production TypeScript | **17,499** |
| Root tests | 16,897 |
| App tests | 56 |
| Total tests | **16,953** |
| `src/api`, `release`, `publication`, `correction`, `extensions` | **10,356** |
| Eighteen explicit prepared/authority files plus the Action store | 5,521 |
| Schema class declarations/usages in the retiring authority/prepared/correction scope | 106 |
| Tagged report variants | 31 |

The following non-overlapping planning ledger makes the 11,500-line target
credible without treating tests or docs as production deletion:

| Change class | Baseline | Replacement ceiling | Gross reduction |
| --- | ---: | ---: | ---: |
| Fully obsolete authority, recovery/profile, claim, prepared-ref and `src/store.ts` entrypoint, correction, extensions/SDK, Action store, staging/seccomp helper, and capability registry/ownership files | 3,325 | 0 | 3,325 |
| Prepared model/store, report/coordinator/adapter, authority HTTP/publisher and credential composition rewritten as manifest/tasks/results/provider runtime | 3,285 | 2,000 | 1,285 |
| Four provider implementations simplified around provider-local flows | 2,545 | 1,900 | 645 |
| Graph/prepare/context/source-observer/process rewritten as direct graph/build/runtime | 2,953 | 1,650 | 1,303 |

The rows are disjoint and use this exact path membership at the planning commit:

- **Obsolete, 3,325:** `src/model/authority.ts`,
  `src/publication/authority.ts`, `src/publication/recovery.ts`,
  `src/publication/profiles.ts`, `src/publication/claim.ts`,
  `src/release/prepared-ref.ts`, `src/store.ts`,
  `src/correction/intent.ts`, `src/correction/coordinator.ts`,
  `src/extensions/provider-adapter.ts`, `src/provider-sdk.ts`,
  `apps/ts-release-action/src/prepared-store.ts`, `src/release/staging.ts`,
  `src/drivers/seccomp-helper-source.ts`, `src/capabilities/module.ts`,
  `src/capabilities/registry.ts`, and `src/capabilities/field-ownership.ts`.
- **Rewrite kernel, 3,285:** `src/release/prepared.ts`,
  `src/release/prepared-store.ts`, `src/publication/report.ts`,
  `src/publication/coordinator.ts`, `src/publication/adapter.ts`,
  `src/publication/http.ts`, `src/publication/publisher.ts`, and
  `src/platform/credentials.ts`.
- **Providers, 2,545:** `src/publication/npm.ts`,
  `src/publication/github.ts`, `src/publication/pypi.ts`, and
  `src/publication/catalog-git.ts`.
- **Build path, 2,953:** `src/release/graph.ts`, `src/release/prepare.ts`,
  `src/release/context.ts`, `src/platform/source-observer.ts`, and
  `src/drivers/process.ts`.

At checkpoint 0, before any edit, reproduce the four totals and prove that the
members are disjoint with these exact commands. Record their output in the
implementation log; a mismatch is drift and must be reconciled before coding.

```bash
row_obsolete=(src/model/authority.ts src/publication/authority.ts src/publication/recovery.ts src/publication/profiles.ts src/publication/claim.ts src/release/prepared-ref.ts src/store.ts src/correction/intent.ts src/correction/coordinator.ts src/extensions/provider-adapter.ts src/provider-sdk.ts apps/ts-release-action/src/prepared-store.ts src/release/staging.ts src/drivers/seccomp-helper-source.ts src/capabilities/module.ts src/capabilities/registry.ts src/capabilities/field-ownership.ts)
row_rewrite=(src/release/prepared.ts src/release/prepared-store.ts src/publication/report.ts src/publication/coordinator.ts src/publication/adapter.ts src/publication/http.ts src/publication/publisher.ts src/platform/credentials.ts)
row_providers=(src/publication/npm.ts src/publication/github.ts src/publication/pypi.ts src/publication/catalog-git.ts)
row_build=(src/release/graph.ts src/release/prepare.ts src/release/context.ts src/platform/source-observer.ts src/drivers/process.ts)
wc -l "${row_obsolete[@]}" | tail -n 1
wc -l "${row_rewrite[@]}" | tail -n 1
wc -l "${row_providers[@]}" | tail -n 1
wc -l "${row_build[@]}" | tail -n 1
printf '%s\n' "${row_obsolete[@]}" "${row_rewrite[@]}" "${row_providers[@]}" "${row_build[@]}" | sort | uniq -d
```

The expected totals are `3325`, `3285`, `2545`, and `2953`; the duplicate-path
command must print nothing. Tiny index/runtime/config files outside these four
rows are deliberately excluded from the claimed savings rather than hidden in an
aggregate.

These four rows describe 6,558 lines of gross reduction. The required
repository-wide reduction is 5,999 lines, leaving 559 lines of
contingency for the named replacement modules. It is not an allowance for
compatibility adapters. Recompute the ledger at each checkpoint; do not weaken
the ceiling by excluding new production files.

Representative history reinforces the concern but is not used as the size
baseline: commit `ceb5180` changed 90 files with +10,689/-1,665 while completing
several post-kernel capabilities and documents. It is an upper-bound example of
coordination cost, not a pure provider-cost estimate.

## Target architecture

### One manifest and ordinary files

Create `src/release/manifest.ts` with durable `Schema.Class` values equivalent to:

```ts
class ReleaseArtifact extends Schema.Class<ReleaseArtifact>("ReleaseArtifact")({
  id: OutputId,
  path: SafeRelativePath,
  kind: Schema.Literals(["file", "executable", "archive", "package", "digest"]),
  mediaType: Schema.optionalKey(Schema.NonEmptyString),
  size: Schema.Number.check(Schema.makeFilter((value: number) =>
    Number.isSafeInteger(value) && value >= 0
      ? undefined
      : "Artifact size must be a nonnegative safe integer.")),
  sha256: Sha256Digest
}) {}

class ReleaseManifest extends Schema.Class<ReleaseManifest>("ReleaseManifest")({
  schemaVersion: Schema.Literal("ts-release-manifest/v1"),
  project: Schema.Struct({
    name: NonEmptyName,
    version: Version,
    tag: NonEmptyName,
    repository: Schema.optionalKey(Schema.NonEmptyString)
  }),
  artifacts: Schema.Array(ReleaseArtifact),
  tasks: Schema.Array(PublishTask)
}) {}
```

This sketch is a constraint, not a demand to duplicate existing branded values.
Reuse one existing canonical project/artifact identifier where it remains useful.
The manifest:

- lives at `<output>/release-manifest.json`, default output
  `<workspace>/dist/ts-release`;
- uses readable JSON, not canonical bytes or a reference grammar;
- uses paths relative to the manifest directory;
- validates duplicate IDs/paths, missing task artifact IDs, containment, regular
  files, symlinks, size, and SHA-256;
- is published last through a temporary file and atomic same-directory rename. A
  failed build leaves no valid manifest;
- is immutable input during publish. The report is observational output and is
  never accepted as authority or resume state;
- carries an authentication mode only when the provider has more than one mode,
  never credential values or environment-variable names. Fixed provider slots are
  host policy in code, not serialized data; and
- omits source snapshots/object inventories, tool hashes, execution bases,
  workflow identity, store provenance, blob IDs, collection contracts/selectors,
  approval claims, and outcomes. A GitHub task may retain the single target commit
  that is behaviorally required for its tag operation; that is destination input,
  not a provenance graph.

Dynamic command collections are finalized during build, before the manifest is
written. Each member becomes an ordinary artifact with a deterministic ID derived
from the collection ID and safe relative member path; members are path-sorted and
collision-checked. Publication selectors are resolved once against that final
inventory, so every durable task contains only explicit artifact IDs.

The output option must be rejected if it resolves to the workspace root, `.git`,
another protected repository path, outside the workspace, or through a symlink.
A new/empty output receives an exact `.ts-release-output` ownership marker. A
pre-existing nonempty directory without the expected marker/version is refused and
left byte-for-byte untouched. For a marked rebuild, validate ownership, remove the
old manifest first, clean only that marked directory, recreate/retain the marker,
build, then atomically rename the new manifest into place. The marker is not a
release identity, checksum, or publish input.

### One publish-task representation

Create `src/publication/task.ts`. Use `Schema.TaggedClass` only for these closed,
final provider alternatives:

- `NpmPublishTask`: task ID; package artifact ID; package name/version; dist-tag;
  public/restricted access; provenance policy; and
  authentication strategy `token` or `trusted-publishing`. Token mode implicitly
  maps to `NPM_TOKEN` at the trusted host boundary; the manifest has no slot field.
- `GitHubReleaseTask`: task ID; repository; tag; title; draft and
  prerelease flags; target commit; final optional body text; assets as explicit
  `{ artifactId, name, mediaType }` rows. The provider implicitly uses the fixed
  `GITHUB_TOKEN` slot; it is not a task field.
- `PyPiPublishTask`: task ID; project/version; closed repository enum; files as explicit
  `{ artifactId, filename, mediaType, distribution }` rows. The provider
  implicitly uses `PYPI_TOKEN`; size and digest come only from the referenced
  manifest artifact.
- `CatalogGitPublishTask`: task ID; catalog ID; destination
  repository/branch; target and managed-state repository paths; finalized target
  and state artifact IDs; version; source repository/tag; renderer identity; and
  no credential field. The provider implicitly uses `CATALOG_GITHUB_TOKEN`. It
  has no render inputs, correction ID/reason, observed baseline, or proof field.

Rewrite `src/model/catalog.ts` rather than leaving its correction model behind.
The only durable remote state becomes this exact monotonic schema:

```ts
class CatalogManagedState extends Schema.Class<CatalogManagedState>("CatalogManagedState")({
  schemaVersion: Schema.Literal("ts-release/catalog-state/v3"),
  catalogId: NonEmptyName,
  renderer: Schema.Literals(["homebrew", "scoop"]),
  version: Version,
  targetSha256: Sha256Digest,
  sourceRepository: GitHubRepositoryCoordinate,
  sourceTag: NonEmptyName
}) {}
```

Delete `CatalogManagedStatus`, `status`, `correctionId`, `reason`, and
`replacementVersion`. Rename the build-only `PreparedCatalogDownload` and
`PreparedCatalogRenderer` concepts to `CatalogRenderDownload` and
`CatalogRenderPlan`; they are ephemeral render inputs, not manifest members or
another prepared model. Build renders the target first, computes its SHA-256,
encodes the v3 state artifact from that final digest, and only then compiles the
catalog task with the two concrete artifact IDs. Provider preflight accepts only
v3; finding deployed v2 state fires the pre-implementation compatibility stop
rather than activating a fallback reader.

For v1, provider origins are a closed supported set: official npm, public GitHub,
and the existing PyPI/TestPyPI enum. Custom npm registries are a compatibility cut;
do not introduce GitHub Enterprise as an unreviewed arbitrary-origin escape hatch.
A later feature may add a small trusted host policy, but it must not let a
build-produced manifest choose a secret selector or credential destination.
Origins are not task fields: provider code owns one canonical mapping from the
provider/repository enum to its HTTPS preflight, upload, and mutation endpoints,
covered by protocol tests.

Only the final manifest and provider workflows use this task union. The ephemeral
build graph contains build/check/archive/render steps and declared outputs, not
provider publications. After build has finalized static and dynamic artifacts,
`compilePublishTasks(config, artifactInventory)` constructs this union exactly
once. There is no `Graph*Publication`, `PublicationAuthorityIntent`,
`Prepared*Publication`, `ReleaseSubject`, task template, or graph-to-prepared
conversion. `src/release/compiler.ts` owns both direct build-plan compilation and
final task compilation; it does not iterate an executable capability registry.
It validates unique task IDs, unique provider destination coordinates, every
artifact reference, task/project version and tag consistency, and the closed
origin rules. Catalog rendering produces the final target first, then a normal
post-render build step derives the canonical managed-state artifact from the
target digest; both enter the final inventory before task compilation.

### Small final outcomes

Replace the 31-variant report algebra with:

```ts
class PublishTaskOutcome extends Schema.Class<PublishTaskOutcome>("PublishTaskOutcome")({
  taskId: OperationId,
  provider: Schema.Literals(["npm", "github", "pypi", "catalog-git"]),
  status: Schema.Literals(["published", "skipped", "blocked", "uncertain"]),
  message: Schema.String
}) {}

class ReleaseReport extends Schema.Class<ReleaseReport>("ReleaseReport")({
  project: Schema.Struct({ name: NonEmptyName, version: Schema.NonEmptyString }),
  outcomes: Schema.Array(PublishTaskOutcome)
}) {}
```

Outcome messages come from bounded fixed templates plus redacted provider status
facts; cap them at 2,048 printable characters and never copy response headers,
bodies, command environments, or secret-bearing argv. This can be one private
normalization helper rather than another public schema hierarchy.

Expected provider failures map directly to final outcomes. Do not persist or
export a generic phase/commitment/retry error; local read retry classification
stays private to each provider. Manifest/input/build errors may remain small
`Schema.TaggedErrorClass<Self>()("Tag", fields)` values using the beta.83 curry.

Do not expose nested observation, decision, authority, attempt, convergence,
not-reached, or correction trees. `published` and `skipped` are successful and the
ordered runner continues. `blocked` and `uncertain` stop the sequence and synthesize
later `blocked` outcomes referring safely to the preceding task. A report is
complete only when every outcome is `published` or `skipped`; no separate
not-reached or overall-state type is needed.

### Provider-local workflows

Each first-party provider exposes one internal `Effect.fn` workflow. Its
`Effect.gen` body owns:

```text
validate task and artifact references
  -> anonymous observe/preflight where authoritative
  -> if inconclusive and required: Config.redacted credential-backed preflight
  -> equivalent: skipped
  -> conflicting: blocked
  -> missing/change allowed:
       derive one immutable provider-local mutation plan
       -> read the fixed Config.redacted slot if not already read
       -> execute its bounded ordered steps once, each step at most once
       -> optional bounded read-back
       -> published | blocked | uncertain
```

The plan is immutable in intended effects and artifacts, but a later request may
use an ID/URL returned by a validated earlier request. After an unknown transport
result, a bounded exact read-back may prove that the intended step applied and
allow the workflow to continue; it never resends that step. If read-back cannot
prove application after a dispatched request, stop as `uncertain` and do not
execute dependent steps. `blocked` is reserved for a conclusive pre-dispatch
absence, conflict, missing credential, or rejection. There is no generic mutation
retry after dispatch. Reads and known-
before-dispatch failures may use bounded provider-local retry. Share a backoff
helper only when at least two providers genuinely have identical behavior.
Provider-specific equivalence, absence, conditional writes, and conflicts remain
in the provider.

- **npm:** publish the finalized package archive with normal `npm publish`/Bun
  process execution. For a token, create a provider-local temporary npmrc and
  remove it in a finalizer. Retain a closed subprocess environment
  (`extendEnv: false`): allow only `PATH`, scoped userconfig and ignore-scripts
  controls, plus the minimum OIDC/provenance variables for trusted publishing.
  Retain `--ignore-scripts`/`NPM_CONFIG_IGNORE_SCRIPTS=true`; never inherit ambient
  `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or unrelated variables. A token-authenticated
  package 404 remains blocked because absence is not create authority. Trusted
  publishing may create only through successful package-bound OIDC. Delete the
  repository/workflow/ref/allowed-action attestation fields, exact runner
  certification, and certified spawn service.
- **GitHub:** retain release/tag/asset preflight, exact asset-byte/name comparison,
  conditional mutations where supported, and bounded post-write read-back. Try
  anonymous reads first, then use the fixed token for private/draft state when
  anonymous absence is inconclusive. Release creation and each asset upload are
  ordered steps; each is attempted at most once. Keep the intended plan local to
  this workflow, not in a mutable closure consumed through a generic sink.
- **PyPI:** support direct token publication in this kernel. If a deployment wants
  PyPI's external trusted-publishing Action, keep it in the workflow outside
  ts-release. A project 404 is inconclusive/blocked; only a valid visible Simple
  page proving the exact filename absent permits upload. Each distribution upload
  is one ordered step attempted at most once. Delete the terminal claim store. If
  a step is unknown, this invocation stops as uncertain; a later explicit run may
  upload again after authoritative absence. That accepted cross-run risk must be
  documented and tested rather than described as idempotence.
- **Catalog Git:** retain exact-parent/conditional branch update and re-observation
  inside the provider flow. Authenticated preflight is allowed after anonymous
  observation is inconclusive. Blob/tree/commit/ref requests form one bounded
  ordered plan whose steps are not replayed. Retain the ordinary monotonic rule:
  canonical managed state may advance only to a greater SemVer for the same
  catalog, renderer, and source repository, with a conditional non-forced ref
  update. A forward correction is a new configured release run, not a `correct`
  lifecycle operation.

All credentialed HTTP providers accept only canonical HTTPS endpoints without
userinfo, validate the task against the provider's closed origin/repository rules
before reading Config, and never forward Authorization across a redirect or
cross-origin response. Provider tests include hostile endpoint, userinfo, and
cross-origin redirect fixtures. These are ordinary send-secret destination checks,
not grants or a provider-neutral authority representation.

### Effect boundaries

Follow the pinned Effect `4.0.0-beta.83` source, not a newer checkout:

- durable artifacts, manifest, tasks, reports, and errors use `Schema.Class`,
  `Schema.TaggedClass`, and `Schema.TaggedErrorClass` as described above;
- reusable operations use `Effect.fn`; workflows use `Effect.gen`;
- at most one package-owned `WorkspaceInspector extends Context.Service` owns Git
  status and release facts. Effect filesystem, path, HTTP, process, ConfigProvider,
  clock, and temp services remain direct standard dependencies composed by the
  Node, Bun, CLI, Action, and test layers rather than hidden in a service locator;
- Node, Bun, CLI, Action, and tests provide layers only at their boundaries;
- provider workflows use Effect's `HttpClient` directly with provider-local
  request builders and test layers. Delete the custom publication HTTP request,
  authorizer, authorized-mutation transport, and release-runtime adapter rather
  than renaming them;
- provider credentials are `Config.redacted(fixedSlot)` effects executed only
  inside the provider's `publish` workflow, never during inspect/build or layer
  construction. Prefer anonymous preflight; authenticated GitHub/catalog preflight
  may read the same bearer token without granting mutation. Tests provide a
  `ConfigProvider` layer;
- secret values are unredacted only where an HTTP header, temporary config, or
  process environment is built and are covered by output redaction/finalizers;
- do not introduce `ServiceMap.Service` or upgrade Effect packages in this plan.

Simplify `src/drivers/process.ts` to ordinary command execution with a controlled
working directory, a closed allowlisted environment, exit/output capture, and
redaction. Build commands never inherit the fixed provider credential slots; a
configured nonsecret build variable must be passed explicitly. Delete seccomp
source generation, tool identities, network-denial claims, private Bun cache
provenance, and repeated whole-tree snapshots. Keep a clean tracked-workspace
check before build, workspace/output ownership and containment, and final artifact
validation. Build commands remain trusted local code and can affect their host
beyond the managed directory; a one-call process with secrets in its host
environment is therefore not a sandbox. Only the reviewed split workflow keeps
publish secrets absent from the build job. The docs and tests must match this
boundary instead of claiming stronger isolation.

## Scope

### Production files to create or substantially rewrite

- `src/release/manifest.ts`
- `src/publication/task.ts`
- `src/publication/publish.ts`
- `src/publication/report.ts`
- `src/publication/npm.ts`
- `src/publication/github.ts`
- `src/publication/pypi.ts`
- `src/publication/catalog-git.ts`
- `src/release/graph.ts`
- `src/release/prepare.ts` (rename to `src/release/build.ts`)
- `src/release/context.ts`
- `src/release/compiler.ts`
- `src/model/primitives.ts`
- `src/model/catalog.ts`
- `src/drivers/process.ts`
- `src/drivers/environment.ts`
- `src/api/api.ts`
- `src/api/types.ts`
- `src/api/input.ts`
- `src/api/errors.ts`
- `src/platform/node.ts`
- `src/platform/bun.ts`
- `src/release/inspect.ts`
- `src/host.ts`
- `src/index.ts`
- `apps/release-ts/src/cli/command.ts`
- `apps/release-ts/src/cli/commands.ts`
- `apps/release-ts/src/cli/main.ts`
- `apps/release-ts/src/cli/node-main.ts`
- `apps/ts-release-action/src/commands.ts`
- `apps/ts-release-action/src/index.ts`
- `apps/ts-release-action/action.yml`

If current filenames differ at execution time, use the drift procedure below;
do not create duplicate modules merely to match this plan.

### Production files to delete after their consumers move

- `src/model/authority.ts`
- `src/api/runtime.ts`
- `src/platform/release-runtime.ts`
- `src/platform/host-support.ts`
- `src/publication/http.ts`
- `src/publication/index.ts`
- `src/release/config.ts`
- `src/publication/authority.ts`
- `src/publication/coordinator.ts`
- `src/publication/adapter.ts`
- `src/publication/recovery.ts`
- `src/publication/profiles.ts`
- `src/publication/claim.ts`
- `src/publication/publisher.ts`
- `src/release/prepared.ts`
- `src/release/prepared-ref.ts`
- `src/release/prepared-store.ts`
- `src/release/staging.ts`
- `src/platform/source-observer.ts`
- `src/drivers/seccomp-helper-source.ts`
- `src/correction/intent.ts`
- `src/correction/coordinator.ts`
- `src/correction/index.ts`
- `src/extensions/provider-adapter.ts`
- `src/provider-sdk.ts`
- `src/store.ts`
- `src/capabilities/module.ts`
- `src/capabilities/registry.ts`
- `src/capabilities/field-ownership.ts`
- `src/capabilities/bun-targets.ts` (import the vocabulary directly from
  `src/model/bun-targets.ts`)
- `src/release/capabilities.ts` (move the direct compilation logic into
  `src/release/compiler.ts`; do not leave a compatibility re-export)
- `src/platform/credentials.ts`
- `src/platform/services.ts`
- `apps/ts-release-action/src/prepared-store.ts`
- `apps/ts-release-action/scripts/preload-bun-compile-runtimes.ts`

Delete any now-empty index files/directories. Do not keep re-export shims.

### Configuration, scripts, generated artifacts, and gates

- Rewrite provider auth shapes in `src/recipes/config.ts`, resolution in
  `src/resolve/authored.ts` and `src/resolve/resolve.ts`, and
  `schema/release-config.schema.json`.
- Rewrite `package.json`, `apps/release-ts/package.json`, and
  `apps/ts-release-action/package.json` descriptions, exports, dependencies, and
  scripts. Remove `@actions/artifact` and `@actions/github` from the Action package
  once the prepared store is gone; retain `@actions/core`. Regenerate `bun.lock`
  with Bun and keep every Effect package on the aligned beta version.
- Rewrite `apps/release-ts/release.config.json` to the closed provider/auth shapes;
  it must not retain custom registry, attestation, or `tokenEnv` fields.
- Rewrite `scripts/check-examples.ts`, `scripts/check-package-exports.ts`,
  `scripts/check-packed-consumers.ts`, `scripts/check-action-bundle.ts`,
  `scripts/check-import-rules.ts`, `scripts/generate-config-schema.ts`,
  `scripts/measure-release-candidate.ts`, and
  `scripts/lib/release-example-test-layer.ts`,
  `scripts/lib/public-api-policy.ts`, `scripts/lib/import-rules.ts`, and
  `scripts/lib/bun-targets.ts` around the new contract.
- Delete `scripts/check-capabilities.ts`, `scripts/generate-capabilities.ts`,
  `scripts/check-recovery-docs.ts`, `scripts/generate-recovery-docs.ts`,
  `scripts/check-feature-translation.ts`, `scripts/replay-provider-reads.ts`,
  `scripts/lib/capabilities.ts`, `scripts/lib/recovery-docs.ts`, and
  `scripts/lib/field-effect-witnesses.ts`, `scripts/lib/feature-translation.ts`,
  and `scripts/lib/config-fields.ts` when no retained behavior imports them.
- Remove their package scripts and update `scripts/README.md`. Keep direct config,
  import, examples, public-export, packed-consumer, CLI/Action bundle, portable,
  and release-candidate gates.
- Rename `apps/release-ts/scripts/check-self-release-prepare.ts` to
  `check-self-release-build.ts`; rewrite context, reproducibility, readiness, and
  artifact gates plus `apps/release-ts/scripts/self-release-facts.ts` around the
  owned output/manifest; delete
  `check-self-release-correction.ts`.
- Rebuild committed CLI/Action/agent distributions with repository Bun scripts;
  never hand-edit generated bundles.
- Delete `apps/ts-release-action/scripts/preload-bun-compile-runtimes.ts` and
  `test/script-preload-bun-compile-runtimes.test.ts`. Remove its composite-Action
  bootstrap. Cross-target runtime acquisition is an ordinary, credential-free
  build-job concern (or caller preprovisioning), not a certified offline identity
  that the release engine records or enforces.

### Public docs, examples, templates, and agent package

- Rewrite `README.md`, `ARCHITECTURE.md`, `SPEC.md`, `CHANGELOG.md`,
  `apps/release-ts/README.md`, `apps/ts-release-action/README.md`,
  `docs/preparation.md`, `docs/comparison.md`, `docs/release-runbook.md`, and
  `docs/skill-distribution.md`. Delete `docs/recovery.md`,
  `docs/native-extensions.md`, `docs/capabilities.md`, and
  `docs/capability-evidence.json`; their subjects no longer exist. Do not preserve
  a current tombstone with the old protocol.
- Rewrite `.github/workflows/release.yml`, `templates/github-actions/release.yml`,
  and `templates/github-actions/reviewed-release.yml` to pass
  `dist/ts-release` via standard artifact upload/download. The reviewed publish
  job uses a protected environment and runs `ts-release publish
  dist/ts-release/release-manifest.json`. Build/release jobs perform one ordinary
  frozen workspace install; remove cache-only priming, root `node_modules`
  deletion, private preparation installs, and exact inode/cache certification.
  Publish-only jobs install no workspace dependencies.
- Update `templates/README.md`, provider template READMEs, `examples/README.md`,
  provider example READMEs/configs, and schema fixtures.
- Rewrite `apps/ts-release-agents/skills/release/SKILL.md`, its relevant references,
  eval cases, package README, and manifests; rebuild generated agent packages.
- Keep `docs/release-program/**` and `plans/**` as historical evidence. Add or
  retain one clear archive notice rather than rewriting historical decisions.

### Tests

Translate observable contracts; delete tests whose only subject is a retired
representation. In particular:

- replace prepared store/ref, Action store authentication, authority grant,
  coordinator state-shape, recovery-profile equality, provider-SDK acknowledgement,
  and correction-intent tests;
- retain and adapt npm/GitHub/PyPI/catalog protocol fixtures and assertions for
  requests, exact file contents, conflicts, reruns, redaction, read retries, and
  ambiguous outcomes;
- rewrite API, public surface, package exports, CLI, Action, workflow, config,
  self-release, and examples tests against manifest paths and final outcomes;
- add focused manifest tests for duplicate IDs/paths, traversal, symlinks,
  non-regular files, missing files, size/digest mismatch, unknown artifact IDs,
  duplicate task destinations, task/project mismatch, arbitrary secret-slot
  requests, hostile origins, secret absence, deterministic encode/decode, and
  interrupted build with no manifest;
- add managed-output tests proving a nonempty unmarked contained directory is
  untouched, a marked rebuild removes the old manifest before work, and the new
  manifest appears only through final atomic rename;
- replace catalog correction-state tests with v3 managed-state encode/decode,
  greater-version monotonicity, target-digest derivation, rejection of v2, and a
  stop fixture for a discovered deployed v2 state; assert that no status/reason/
  replacement fields survive;
- add an end-to-end test proving `release` writes a manifest, reopens it, and uses
  the same publish function as standalone `publish`;
- add late-credential tests proving inspect/build never read a provider secret,
  public equivalent/conflict paths use anonymous observation, authenticated
  private preflight never dispatches on equivalent/conflict, and a missing secret
  blocks before dispatch;
- add process tests proving output redaction and cleanup of temporary provider
  configuration, closed build/npm environments, ignore-scripts enforcement, and
  exclusion of ambient provider tokens; and
- do not retain old type names in test-helper APIs merely to ease translation.

### Explicitly out of scope

- `.repos/effect/**` and `.agent-sources/effect/**` (read-only research checkouts;
  one checkout was already dirty at planning time)
- `advisor-plans/AUDIT-SNAPSHOT.md`
- `plans/**` and historical `docs/release-program/**`
- dependency upgrades, a new framework, new providers, hooks, custom publishers,
  split/continue phase state, signing, attestations, or a remote state service
- live npm, GitHub, PyPI, Homebrew, or Scoop mutation
- a v2 prepared-reference migration reader unless the decision gate creates a
  separately approved, time-bounded external tool

## Commands and expected results

Run from the repository root with Bun `1.3.14` as pinned in `package.json`.

| Purpose | Command | Expected result |
| --- | --- | --- |
| Install/lock check | `bun install --frozen-lockfile` | Exit 0; lockfile unchanged |
| Typecheck | `bun run check` | Exit 0; no TypeScript errors |
| Full tests | `bun test` | Exit 0; zero failed tests |
| Root/CLI build | `bun run build` | Exit 0; TypeScript output and CLI bundle rebuilt |
| Action build | `bun run --cwd apps/ts-release-action build` | Exit 0; committed Action bundle rebuilt before any Action bundle check |
| Portable surface | `bun run check:portable` | Exit 0 across core, agent, CLI, and Action gates |
| Candidate | `bun run check:release-candidate` | Exit 0 with offline/double-backed checks only; no live publish |
| Diff hygiene | `git diff --check` | No output, exit 0 |

Checkpoint commands below are narrower feedback loops. If a named new test does
not yet exist, create it in the preceding step. If an existing filename has drifted,
apply the drift procedure; do not silently omit the behavior.

## Git workflow

- Start from the reviewed SHA or rebase the plan after its drift check.
- Create `codex/001-conventional-release-pipeline` only after the decision gate.
- Preserve unrelated working-tree changes. Never modify `.repos/effect`,
  `.agent-sources/effect`, `plans`, or `advisor-plans/AUDIT-SNAPSHOT.md`.
- Prefer logical checkpoint commits while developing; the final commit/squash
  message is `Make the release pipeline conventional`, matching the repository's
  imperative style (`e3691f1 Make the Action bundle clean-clone deterministic`).
- Do not push, publish, or open a pull request unless the operator separately asks.

## Implementation sequence

Subphases 1 through 5 below are **one atomic code checkpoint**. Do not commit,
push, run a whole-repository typecheck, or claim a green checkpoint between them.
During that uncommitted interval the new modules may exist beside the untouched
old path or the worktree may temporarily fail to compile, but the two kernels must
never be connected by a compatibility adapter. Subphase 5 moves every consumer,
deletes the old producers and kernel immediately, then runs the first full green
gate. This deliberately trades a large local edit for no mergeable dual-model
state.

### 0. Establish the branch, drift baseline, and retained behavior matrix

1. Confirm the four decision statements in an issue or implementation log.
2. Verify publication/tag state and the worktree. Preserve all unrelated changes.
3. Branch from the reviewed base if it is still current:

   ```bash
   git status --short --branch
   git rev-parse HEAD
   git switch -c codex/001-conventional-release-pipeline
   ```

4. Run the existing provider/API/CLI/Action characterization suites before edits.
   Record exact test file names and counts; these are behavioral evidence, not a
   promise to preserve their model-shaped assertions.
5. Write a short retained behavior table in the implementation PR description:

   | Situation | Required final outcome | Mutation allowed? |
   | --- | --- | --- |
   | Build/config/artifact failure | build error; no manifest on build failure | No |
   | Remote equivalent | `skipped` | No |
   | Remote conflicting | `blocked` | No |
   | Remote missing, credential missing | `blocked` before dispatch | No |
   | Private/draft state needs authenticated read | equivalent -> `skipped`; conflict -> `blocked` | No |
   | npm token + package 404 | `blocked` | No |
   | npm trusted publishing + package 404 + valid OIDC | provider flow may create | Ordered steps once |
   | PyPI project 404 | `blocked` | No |
   | PyPI visible project + exact filename absent | provider flow may upload | Each file once |
   | Missing, mutation plan succeeds, read-back equivalent | `published` | Each plan step once |
   | Known rejection before a step | `blocked` | No retry of mutation steps |
   | Response lost/ambiguous after a step | `uncertain`; stop dependent steps | Never automatic replay in this invocation |
   | Explicit later invocation after uncertainty | provider preflight decides anew; accepted redispatch risk after authoritative absence | Provider-local |
   | Prior ordered task fails | later tasks `blocked` | No |

Verification:

```bash
bun test test/protocol test/api.test.ts test/cli-command.test.ts test/action-command.test.ts
```

The directory filter is the repository's planning-time characterization command.
If it no longer resolves, treat that as drift and update the exact test list
before editing; do not silently skip a provider or broaden it into live tests.

### Atomic subphase 1 — Introduce the single task/manifest/result vocabulary

1. Add `PublishTask`, `ReleaseArtifact`, `ReleaseManifest`,
   `PublishTaskOutcome`, and `ReleaseReport` with the target shapes. Keep expected
   provider failures out of a generic error algebra.
2. Move the four final provider task values into `src/publication/task.ts`; only
   the manifest and provider workflows may import them.
3. Implement the new `compileBuildPlan(config, context)` and
   `compilePublishTasks(config, artifactInventory)` path in
   `src/release/compiler.ts`. During this atomic edit, leave the old compiler and
   graph publications untouched until subphase 5 rather than adapting either
   representation to the other. The final build graph has no provider
   publications. Resolve dynamic collection members to deterministic concrete
   artifact IDs before calling the latter function; do not introduce a durable
   task-template type.
4. Move the Bun target import to `src/model/bun-targets.ts` and delete the
   capability compatibility projection.
5. Simplify auth configuration to provider strategies, not secret selectors:
   - npm: `{ strategy: "token" }` (fixed `NPM_TOKEN`) or
     `{ strategy: "trusted-publishing" }`;
   - GitHub: fixed `GITHUB_TOKEN`; catalog Git: fixed
     `CATALOG_GITHUB_TOKEN`; PyPI: fixed `PYPI_TOKEN`;
   - delete arbitrary `tokenEnv`/credential-name fields, custom npm registries,
     and external PyPI trusted-publisher identity shapes in this cut.
6. Mark authority intent and graph publications for simultaneous deletion in
   subphase 5. Do not add a replacement proof field or make the new compiler emit
   an old publication value.
7. Add `test/core/release-manifest.test.ts`,
   `test/publication/publish-runner.test.ts`, and task/report contract tests before
   deleting the old model files.

Focused feedback only; this is not a green checkpoint and does not authorize a
compatibility bridge:

```bash
bun test test/core/release-manifest.test.ts test/core/resolve.test.ts test/core/release-graph.test.ts test/publication/publish-runner.test.ts
```

If an old-path characterization test cannot compile without wiring the two
models together, defer it to the integrated gate in subphase 5.

### Atomic subphase 2 — Replace preparation with an ordinary managed build

1. Implement the new internal `build` module and managed output rules; defer the
   public operation switch until subphase 4. Reject nonempty unmarked targets,
   validate the ownership marker,
   remove an old manifest before cleaning, execute trusted build/pack/render/state
   steps, finalize selected files there, hash them, and atomically rename the
   manifest into place last.
2. Collapse source context to facts needed to resolve version/project and enforce
   a clean tracked checkout. Remove exact Git object materialization, source blob
   hashing, repeated staging snapshots, execution basis, tool identities, seccomp,
   offline-cache identity, and provenance recording.
3. Simplify the process driver. Keep working-directory containment, a closed
   allowlisted environment, safe capture, redaction, and cleanup. Strip all fixed
   provider credential slots from build processes.
4. Ensure build has no dependency on provider credential resolution and cannot
   import provider mutation clients.
5. Add/translate tests for clean/dirty source, command failure, partial output,
   marker ownership, refusal to clean unmarked directories, manifest-last atomic
   behavior, containment, symlinks, duplicate output, final catalog target/state,
   final hashes, closed environment, and absence of secret reads.

Focused feedback only; public API tests are deferred until subphase 5:

```bash
bun test test/core/release-manifest.test.ts test/core/release-build.test.ts test/core/process-driver.test.ts
```

Do not keep a renamed staging/provenance value; the integrated search runs only
after old files are deleted in subphase 5.

### Atomic subphase 3 — Move publication into provider-local workflows

1. Implement the ordered runner in `src/publication/publish.ts`.
2. Refactor npm, GitHub, PyPI, and catalog Git one at a time. For each provider:
   - preserve protocol fixtures first;
   - replace generic observation/decision/grant/sink calls with one local flow;
   - use anonymous preflight first and authenticated preflight only when required;
   - derive one immutable intended mutation plan after conclusive preflight;
   - execute its bounded request/command steps once each, stopping on ambiguity;
   - retain useful exact equivalence/conflict/read-back behavior; and
   - return one final outcome.
3. Replace the credentials vault/grant composition with the four fixed redacted
   Config slots at provider execution boundaries. Retain canonical HTTPS origin,
   repository, no-userinfo, and no-credential-redirect checks before any secret
   read/send, but delete in-process grant/audience/purpose proofs.
4. For npm, keep temporary secret config and output redaction in
   `Effect.acquireRelease`, `extendEnv: false`, the minimal explicit environment,
   and ignore-scripts controls. Do not put token values in tasks, manifests,
   reports, errors, or process specs that can be logged.
5. Delete generic mutation retry. If a provider's response is ambiguous and
   read-back is inconclusive, return `uncertain`.

Focused provider feedback only; this is still inside the atomic checkpoint:

```bash
bun test test/protocol/npm test/protocol/github test/protocol/pypi test/protocol/catalog
bun test test/publication
```

These are the repository's actual provider directories at the planning commit.
Drift must be reconciled explicitly; never silently omit a provider. A provider is
not complete until its retained behavior cases pass without importing generic
authority/recovery types.

### Atomic subphase 4 — Cut the public API, runtime, CLI, and Action to the manifest path

1. Replace the seven package-owned services with direct Effect platform
   requirements plus at most one `WorkspaceInspector`. Compose one Node/Bun/test
   boundary Layer; do not collect those dependencies as fields of a new
   `ReleaseRuntime` service locator. Remove the root `ReleaseRuntime` export unless
   it becomes the high-level `ReleaseApi` facade itself.
2. Define the exact public contract:

   ```ts
   interface InspectInput {
     readonly config: unknown
     readonly workspace: string
   }
   interface InspectOutput {
     readonly schemaVersion: "ts-release-inspection/v1"
     readonly workspace: string
     readonly outputDirectory: string
     readonly project: {
       readonly name: string
       readonly version: string
       readonly tag: string
       readonly repository?: string
     }
     readonly operations: ReadonlyArray<{
       readonly id: string
       readonly kind: "command-check" | "command-artifact" | "command-collection" |
         "npm-package-build" | "archive" | "checksum" | "catalog-render"
       readonly inputs: ReadonlyArray<string>
       readonly outputs: ReadonlyArray<string>
     }>
     readonly artifacts: ReadonlyArray<{
       readonly id: string
       readonly path: string
       readonly kind: "file" | "executable" | "archive" | "package" | "digest"
       readonly mediaType?: string
     }>
     readonly collections: ReadonlyArray<{
       readonly id: string
       readonly producer: string
       readonly root: string
       readonly resolution: "during-build"
     }>
     readonly destinations: ReadonlyArray<
       | { readonly id: string; readonly provider: "npm"; readonly subject: string;
           readonly authentication: "token" | "trusted-publishing";
           readonly usesDynamicArtifacts: boolean }
       | { readonly id: string; readonly provider: "github" | "pypi" | "catalog-git";
           readonly subject: string; readonly usesDynamicArtifacts: boolean }
     >
     readonly requirements: {
       readonly commands: ReadonlyArray<string>
       readonly publishCredentials: ReadonlyArray<
         "NPM_TOKEN" | "GITHUB_TOKEN" | "PYPI_TOKEN" | "CATALOG_GITHUB_TOKEN"
       >
     }
   }
   interface BuildInput {
     readonly config: unknown
     readonly workspace: string
     readonly outputDirectory?: string
   }
   interface PublishInput { readonly manifest: string }
   class BuildResult extends Schema.Class<BuildResult>("BuildResult")({
     outputDirectory: AbsolutePath,
     manifestPath: AbsolutePath
   }) {}
   class ReleaseResult extends Schema.Class<ReleaseResult>("ReleaseResult")({
     outputDirectory: AbsolutePath,
     manifestPath: AbsolutePath,
     report: ReleaseReport
   }) {}
   ```

   `inspect(InspectInput)` returns exactly that resolved non-mutating JSON shape;
   paths are normalized absolute paths, arrays are deterministically sorted, and
   `publishCredentials` only names the four fixed host slots without reading
   them. Destination rows are human inspection summaries: they contain no
   artifact selectors, provider endpoints, request plans, or executable task
   fields and are never accepted by `build` or `publish`. Dynamic collection
   members are represented only by `resolution: "during-build"`; final artifact
   IDs and `PublishTask` values do not exist until build completes. Remove the
   old `capabilities`, graph-publication, source commit/tree, and prepared-bundle
   inspection shapes. The CLI must encode this exact structure and contract tests
   must assert its complete key/enumeration surface.

   `build(BuildInput)` returns `BuildResult`; `publish(PublishInput)` returns
   `ReleaseReport`; and `release(BuildInput)` returns `ReleaseResult`. Keep
   `dispose()` on an instance returned by `makeReleaseApi`; it is not a lifecycle
   command. Add one `AbsolutePath` brand in `src/model/primitives.ts`, constructed
   only after the platform `Path` service normalizes and proves an absolute path;
   do not misuse `WorkspaceRoot` for output/manifests. Expected blocked/uncertain
   provider results are returned, not thrown.
3. Make the root export list exact, not merely small:
   - runtime/schema values: `inspect`, `build`, `publish`, `release`,
     `makeReleaseApi`, `defineRelease`, `ReleaseArtifact`, `ReleaseManifest`, `PublishTask`,
     `PublishTaskOutcome`, `ReleaseReport`, `BuildResult`, and `ReleaseResult`;
   - type-only exports: `InspectInput`, `InspectOutput`, `BuildInput`,
     `PublishInput`, `ReleaseApi`, `ReleaseApiLayer`, and `AuthoredConfig`.

   That is the complete allowed root surface (20 names). Do not export internal
   provider errors, platform tags, path/digest brands, credential concepts, or an
   `ObservedFacts` construction API. If TypeScript requires a name already present
   as a class value, do not add a duplicate type export.
4. Make `release` call `build`, discard any privileged in-memory publication path,
   then call the exported internal `publish` with the written manifest path. The
   manifest is reopened and artifact hashes are revalidated.
5. Reduce `src/index.ts` to that exact list. Remove
   prepared/correction/credential-cause and host-support exports.
6. Remove `./store` and `./provider-sdk`. Keep exactly one small `./host` seam:
   `WorkspaceInspector`, `WorkspaceInspectorShape`, and
   `makeWorkspaceInspectorLayer(shape)`. `makeReleaseApi` accepts one boundary
   layer supplying that inspector plus the standard Effect platform requirements;
   Node/Bun entrypoints provide their defaults. Do not expose a custom HTTP,
   process, credential, store, claim, or aggregate runtime service.
   Keep the two platform subpaths equally exact:
   - `./node` exports only `NodeReleaseLayer` and
     `makeNodeReleaseLayer(inspector?: WorkspaceInspectorShape): ReleaseApiLayer`;
   - `./bun` exports only `BunReleaseLayer` and
     `makeBunReleaseLayer(inspector?: WorkspaceInspectorShape): ReleaseApiLayer`.

   The default layers construct the platform workspace inspector and standard
   Effect filesystem/path/HTTP/process/Config dependencies. The constructors may
   replace only the inspector; neither signature accepts a prepared store, claim
   store, credential service, HTTP adapter, or aggregate service record. Add exact
   value/type export assertions for root, `./host`, `./node`, and `./bun`.
7. Cut the CLI to these forms (plus existing `init`):
   - `ts-release inspect --config <file> [--workspace <dir>]`
   - `ts-release build --config <file> [--workspace <dir>] [--output <dir>]`
   - `ts-release publish <manifest>`
   - `ts-release release --config <file> [--workspace <dir>] [--output <dir>]`

   Print build/report results as JSON. Invalid input/build errors exit nonzero.
   For publish/release, print the total report, then exit zero only when all tasks
   are `published` or `skipped`; `blocked` or `uncertain` exits nonzero without
   converting the report into an exception.
8. Delete the Action prepared store and define:
   - inputs: `command` (`build|publish|release`), `config` (path required for
     build/release), `manifest` (path required for publish), and
     `output-directory` (optional path for build/release);
   - outputs: `manifest-path`, `output-directory`, and `report` (compact JSON;
     empty for build).

   Reject incompatible input combinations. Build/release outputs are absolute
   normalized paths. Publish derives `output-directory` from the manifest parent.
   Set report/path outputs before failing the Action for blocked/uncertain results;
   no custom hosted ref or report store exists.
9. Rewrite both one-job and reviewed workflows. The reviewed workflow uploads the
   whole managed output directory after build and downloads it in the protected
   publish job. Replace the current `Prime isolated Bun dependency cache` plus
   root-dependency deletion/private reinstall sequence with one ordinary
   `bun install --frozen-lockfile` in each build/release job. A publish-only job
   consumes the downloaded output and bundled Action/CLI without installing
   workspace dependencies.

Focused contract feedback only; build and whole-package gates run after deletion
in subphase 5:

```bash
bun test test/api.test.ts test/core/public-api.test.ts test/core/public-surface.test.ts
```

### Atomic subphase 5 — Delete the retired kernel and close the green checkpoint

1. Delete every file in “Production files to delete” after its last import is gone.
2. Delete model-shape tests and fixtures only after their retained behavior cases
   exist against the new surface.
3. Remove capability/recovery/feature-witness generators and package scripts.
4. Simplify import rules to protect real boundaries: model/schema cannot access
   filesystem/process/HTTP; release build cannot access provider credentials;
   provider workflows cannot access CLI/Action. Remove rules that only enforce the
   old vertical slices.
5. Rewrite `scripts/measure-release-candidate.ts` and the candidate check to use
   one canonical scope: production is every `.ts`/`.tsx` below `src` and every
   `apps/*/src`; tests are every `.ts`/`.tsx` below `test` and every
   `apps/*/test`; kernel is `src/api`, `src/release`, `src/publication`,
   `src/correction`, and `src/extensions`. The command must exit nonzero unless
   production is at most 11,500, kernel at most 5,500, tests at most 16,953, root
   exports are exactly the named 20, and package subpaths are exactly `.`,
   `./node`, `./bun`, and `./host`. It also reports lifecycle commands, provider
   count, manifest schema version, and the exact `./host`/`./node`/`./bun`
   exports. It must not recreate field-ownership or capability evidence
   registries, and it must not treat generated bundles or scripts as a place to
   relocate production logic.
6. Run the forbidden-term gate across live code, config, test, and workflow
   surfaces. Current prose and packaged agent instructions are handled in step 6:

```bash
rg -n -i \
  "Prepared(Release|Bundle|Source|Project|Artifact|Provenance|Execution|Npm|GitHub|PyPi|Catalog)|prepared[-_ ]?(release|ref|bundle|store)|PublicationAuthority|Credential(Request|Provider|Grant)|Mutation(Grant|Attempt)|ObservationGrant|ProviderDecision|AuthorityEvidence|ReleaseSubject|NeedsMutation|PresentEquivalent|Recovery(Profile|CapabilityProfile)|TerminalClaim|PublicationClaimStore|HttpAuthorizer|AuthorizedMutationHttp|CertifiedPublisherSpawn|NpmUserConfigResource|AuthoredCorrection|CanonicalCorrection|Graph(Npm|GitHub|PyPi|Catalog)Publication|CapabilityContribution|CapabilityModule|FieldOwnership|provider-sdk|CatalogManagedStatus|correctionId|replacementVersion|certifiedBunCompile|preload-bun-compile-runtimes|BunCompileRuntime|Prime isolated Bun dependency cache" \
  src apps/release-ts/src apps/release-ts/scripts apps/release-ts/release.config.json apps/release-ts/package.json apps/ts-release-action/src apps/ts-release-action/action.yml apps/ts-release-action/package.json scripts test schema package.json bun.lock .github/workflows

for path in \
  src/model/authority.ts src/api/runtime.ts \
  src/platform/release-runtime.ts src/platform/host-support.ts \
  src/publication/http.ts src/publication/index.ts src/release/config.ts \
  src/publication/authority.ts \
  src/publication/coordinator.ts src/publication/adapter.ts \
  src/publication/recovery.ts src/publication/profiles.ts \
  src/publication/claim.ts src/publication/publisher.ts \
  src/release/prepared.ts \
  src/release/prepared-ref.ts src/release/prepared-store.ts \
  src/release/staging.ts src/platform/source-observer.ts \
  src/drivers/seccomp-helper-source.ts \
  src/platform/credentials.ts src/platform/services.ts \
  src/correction src/extensions src/provider-sdk.ts src/store.ts \
  src/capabilities src/release/capabilities.ts \
  apps/ts-release-action/src/prepared-store.ts \
  apps/ts-release-action/scripts/preload-bun-compile-runtimes.ts \
  test/script-preload-bun-compile-runtimes.test.ts; do
  test ! -e "$path" || { echo "retired path remains: $path"; exit 1; }
done
```

This loop is the machine counterpart of the complete authoritative deletion list;
when that list changes, change the loop in the same edit. Also inspect replacement
types manually for the retired grant shape `{ subject, provider, audience,
purpose, proof }`; symbol renaming does not satisfy this gate.

7. Close the atomic checkpoint only after all integrated gates pass:

```bash
bun install --frozen-lockfile
bun test test/protocol/npm test/protocol/github test/protocol/pypi test/protocol/catalog
bun test test/api.test.ts test/cli-command.test.ts test/action-command.test.ts
bun test
bun run check
bun run check:app
bun run build
bun run --cwd apps/ts-release-action build
bun run check:action
bun run check:package-exports
bun run check:packed-consumers
bun run measure:release-candidate
```

This is the first point at which the branch may be called green. It is still not
mergeable or publishable until the current docs, examples, agent distribution,
generated artifacts, and clean-candidate gates in steps 6 and 7 pass.

### 6. Rewrite the product story and generated consumers

1. Rewrite current docs around the four-operation pipeline, manifest format,
   trusted local build commands, provider-local safety, late credentials, and the
   CI approval boundary. Clearly list the guarantees removed.
2. Rewrite all examples/templates/config schema and run their executable gates.
3. Rewrite the packaged agent skill/evals/manifests to use `build`, manifest-path
   `publish`, rerun preflight, and honest uncertainty. Remove prepared/correction
   references rather than changing only v1 to v2.
4. Rewrite both app READMEs and the live CLI self-release config. Update the root
   and app package manifests and `bun.lock`; verify the removed Action dependencies
   do not survive transitively solely for the deleted store.
5. Update `CHANGELOG.md` with the exact removal/rename table and migration examples.
6. Rebuild generated CLI, Action, and agent distributions with Bun.

Checkpoint gates:

```bash
bun run generate:config-schema
bun run check:config-schema
bun run check:examples
bun run check:readme
bun run check:agents
bun run build
bun run check:cli-bundle
bun run --cwd apps/ts-release-action build
bun run check:action-bundle
```

Then run the final current-surface vocabulary gate. `CHANGELOG.md` may name the
removed API in its migration table and `docs/release-program/**` is immutable
history; no other current surface is exempt:

```bash
rg -n -i -g '!docs/release-program/**' \
  "Prepared(Release|Bundle|Source|Project|Artifact|Provenance|Execution|Npm|GitHub|PyPi|Catalog)|prepared[-_ ]?(release|ref|bundle|store)|PublicationAuthority|Credential(Request|Provider|Grant)|Mutation(Grant|Attempt)|ObservationGrant|ProviderDecision|AuthorityEvidence|ReleaseSubject|NeedsMutation|PresentEquivalent|Recovery(Profile|CapabilityProfile)|TerminalClaim|PublicationClaimStore|HttpAuthorizer|AuthorizedMutationHttp|CertifiedPublisherSpawn|NpmUserConfigResource|AuthoredCorrection|CanonicalCorrection|Graph(Npm|GitHub|PyPi|Catalog)Publication|CapabilityContribution|CapabilityModule|FieldOwnership|provider-sdk|CatalogManagedStatus|correctionId|replacementVersion|certifiedBunCompile|preload-bun-compile-runtimes|BunCompileRuntime|Prime isolated Bun dependency cache" \
  src apps/release-ts apps/ts-release-action apps/ts-release-agents scripts test README.md ARCHITECTURE.md SPEC.md docs templates examples schema package.json bun.lock .github/workflows
```

The command must print nothing. In particular, it scans
`apps/release-ts/README.md`, `apps/release-ts/release.config.json`, both app
`package.json` files, `apps/ts-release-action/README.md`, generated app artifacts,
and `bun.lock`; passing source-only checks is insufficient.

### 7. Enforce compression and run the full clean-candidate gate

1. Measure without exclusions other than generated `dist` and dependencies:

   ```bash
   rg --files src apps -g '*.ts' -g '*.tsx' | rg '^(src/|apps/[^/]+/src/)' | sort -u | xargs wc -l
   rg --files src -g '*.ts' -g '*.tsx' | rg '^src/(api|release|publication|correction|extensions)/' | sort -u | xargs wc -l
   rg --files test apps -g '*.ts' -g '*.tsx' | rg '^(test/|apps/[^/]+/test/)' | sort -u | xargs wc -l
   bun run measure:release-candidate
   ```

   The first totals must be at most 11,500, 5,500, and 16,953 respectively, and
   `measure:release-candidate` must enforce the same scopes and exact public
   surfaces rather than merely printing them.
2. Record the before/after ledger in the PR. Inspect additions manually for
   production logic relocated into gates, Action shell, generated bundles, or
   agent build scripts.
3. Run all repository gates without live mutation:

   ```bash
   bun install --frozen-lockfile
   bun run check
   bun test
   bun run build
   bun run --cwd apps/ts-release-action build
   bun run check:portable
   bun run check:release-candidate
   git diff --check
   git status --short
   ```

4. Run the forbidden-term search again and inspect every remaining match.
5. Review the diff from the merge base for compatibility aliases, fallback
   branches, duplicate task/manifest representations, generic recovery state,
   embedded credentials, and accidental edits to excluded historical/research
   paths.

Commit only after all gates and ceilings pass. Use the imperative message
`Make the release pipeline conventional` unless the repository's commit policy
requires logical intermediate commits.

## Public compatibility removal table

| Remove | Replacement |
| --- | --- |
| `prepare(config, workspace)` returning `PreparedReleaseRef` | `build(...)` returning/writing `ReleaseManifest` |
| `observe(prepared)` | Provider preflight inside `publish`; `inspect(config)` remains non-mutating |
| `publish(prepared)` | `publish({ manifest: ".../release-manifest.json" })` |
| `correct(prepared, intent)` | New forward release configuration/run; provider/operator tooling for unsupported amendments |
| `PreparedReleaseRef` local/GHA codecs | Ordinary path to the managed output manifest |
| `./store` | Standard filesystem plus CI artifact upload/download |
| `./provider-sdk` and protocol acknowledgements | No extension API in this cut; later publishers implement the small task-outcome seam |
| Grant/request/sink services | Provider workflow reads `Config.redacted` at execution and calls its transport/process client |
| `ObservationReport` and 31 report variants | `PublishTaskOutcome` plus `ReleaseReport`; expected provider failures map directly to outcomes |
| Recovery profiles/claims | Provider-local retry/read-back policy, rerun preflight, truthful `uncertain` |
| Action `prepared` / `prepared-ref` | Action `manifest` / ordinary output directory artifact |
| Root `resolveConfig`, `encodeResolvedConfig`, and `ObservedFacts` | `inspect({ config, workspace })` owns resolution from observed workspace facts |
| CLI `--store`, `prepare`, `observe`, `correct` | `--output`, `build`, manifest-path `publish` |
| Exact npm trusted-publisher runner/workflow attestations | Standard OIDC environment validation at npm execution |
| PyPI external trusted-publisher action inside the kernel | The official workflow action outside ts-release, or direct token publication inside it |

## Verification matrix

| Risk | Required evidence |
| --- | --- |
| A build error leaves publishable stale state | Output root cleaned only after validation; manifest written last; interrupted-build test finds no manifest |
| Artifact changes between jobs | Publish validates every referenced artifact before starting provider preflight, so mismatch fails before credential read or dispatch |
| A secret is acquired too early | ConfigProvider probes show zero reads for inspect/build and public anonymous-equivalent/conflict paths; private authenticated preflight reads are isolated and dispatch-free |
| A secret leaks | HTTP/spawn fixtures plus log/error/report snapshots contain no token; temp npmrc finalizer test |
| Equivalent rerun publishes twice | Each provider protocol suite returns skipped and observes zero mutation calls |
| Lost response triggers duplicate blind retry | Ambiguity fixtures at GitHub release/assets, every PyPI file, and catalog Git steps prove each step is attempted at most once, dependent steps stop, and outcome is uncertain |
| Generic simplification loses provider conflict behavior | Existing npm/GitHub/PyPI/catalog conflict fixtures translated before old tests are removed |
| One-call release bypasses manifest validation | Spy/fault test tampers after build and proves `release` uses the manifest reader/publisher path |
| CI split invents another domain protocol | Workflow test asserts only standard artifact upload/download plus manifest argument; no custom reference codec/store |
| Public surface retains old architecture | Export snapshot, package subpath checks, CLI/Action contract checks, forbidden-term gate |
| Complexity is renamed or relocated | Production/kernel line ceilings, test baseline review, manual diff audit, no compatibility namespace |
| Effect service graph fragments again | Import/service audit permits at most one package-owned workspace inspector and forbids a record that merely hides standard Effect services |

## Drift procedure

The shared worktree moved across two divergent candidate branches during the
audit. The plan was re-audited and rebased conceptually on `48ec300`; this is the
one canonical drift scope used by the executor:

```bash
git status --short --branch
git rev-parse HEAD
git diff --stat 48ec3002b6d18ebd24667230b5ecda2c698afe10...HEAD -- src apps scripts test package.json bun.lock README.md ARCHITECTURE.md SPEC.md CHANGELOG.md docs schema templates examples .github/workflows
git log --oneline 48ec3002b6d18ebd24667230b5ecda2c698afe10..HEAD
```

If drift changes public release behavior, package publication state, provider
protocols, source/test line baselines by more than 5%, or any named file boundary,
update this plan and re-run the decision gate before coding. Small unrelated fixes
may be rebased normally. Never overwrite an existing dirty worktree.

## Stop conditions

Stop implementation and report evidence when any of these occurs:

- the decision gate is not explicitly accepted;
- `0.2.0` is tagged/published, a retained v2 prepared reference becomes a real
  compatibility obligation, or deployed catalog managed-state v2 is found or
  cannot be conclusively ruled out;
- a provider protocol test demonstrates a required public behavior that cannot be
  represented by manifest/tasks/provider-local outcomes without restoring a
  second authority or prepared model;
- exact artifact integrity would require credentials, provenance, or remote state
  inside the manifest;
- two attempted fixes fail for the same provider behavior or gate;
- the change requires modifying `.repos/effect`, `.agent-sources/effect`, or
  upgrading the aligned Effect beta packages;
- production remains above 11,500 lines or the kernel above 5,500 after the named
  deletions, unless the owner explicitly accepts an itemized retained guarantee
  and a revised ceiling before merge;
- a live provider mutation would be required to complete verification; or
- unrelated/user-owned changes overlap a required file and cannot be preserved.

Do not respond to a stop condition by adding a fallback implementation, legacy
codec, compatibility flag, or optional old runtime.

## Definition of done

- [ ] Four decision-gate statements accepted and publication state checked.
- [ ] One manifest/task representation; no graph/prepared/subject peers.
- [ ] Four-operation API and five-command CLI shipped together.
- [ ] Action/workflows use ordinary managed output artifacts and protected publish.
- [ ] All four provider flows preserve their observable protocol contracts.
- [ ] Credentials are read only during publish, fixed to provider slots, protected
      by provider-origin checks, redacted, and absent from manifests/reports/errors.
- [ ] Retired source files, exports, commands, config fields, generators, shape
      tests, current docs, templates, and agent instructions are gone.
- [ ] Forbidden-term gate is clean except changelog/archive history.
- [ ] Production <=11,500 pLOC; kernel <=5,500 pLOC; tests <=16,953 pLOC;
      root exports exactly 20 and package subpaths exactly four.
- [ ] Focused, full, portable, candidate, packed-consumer, bundle, and generated
      artifact gates pass with no live publish.
- [ ] `git diff --check` is clean and excluded/user-owned paths are unchanged.

## Maintenance notes

- Reviewers should reject any compatibility alias, second durable task shape,
  generic grant/recovery proof, arbitrary secret selector, or provider endpoint in
  the manifest even if it makes migration or tests easier.
- A new provider should first prove that the small final-task/final-outcome seam is
  sufficient in a separate plan. Do not restore a universal observation or
  authority coordinator to make providers look uniform.
- Hooks, custom publishers, alternate registries/enterprise hosts, partial release
  state, signing, and attestations remain possible follow-ups. Add them only after
  measuring the singular kernel and describing their trust boundary directly.
- If stronger cross-job provenance is later required, add a conventional CI
  attestation/signature at the artifact-transfer boundary. Do not make every
  provider consume a new proof algebra.
- Keep the output marker a cleanup guard only. It must never become an approval
  token, manifest identity, remote reference, or recovery protocol.

## Architectural references

The design borrows conventions, not implementation, from GoReleaser's documented
phase pipeline, ordinary artifact inventory, SCM provider policies, retries, and
CI credential/environment boundary:

- <https://goreleaser.com/getting-started/how-it-works/>
- <https://goreleaser.com/customization/general/artifacts/>
- <https://goreleaser.com/customization/general/retry/>
- <https://goreleaser.com/customization/publish/scm/>
- <https://goreleaser.com/customization/ci/actions/>
- <https://goreleaser.com/customization/publish/scm/github/>
- <https://goreleaser.com/customization/general/env/>

Hooks, custom publishers, and partial releases are intentionally excluded from
this compression plan even though GoReleaser documents them; they are candidates
for later work only after this kernel is singular and measured.
