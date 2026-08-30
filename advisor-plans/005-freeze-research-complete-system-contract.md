# Plan 005: Generate the system contract and select the package graph and lowest-state machine

> **Executor instructions:** This is the mandatory architecture-selection gate.
> It may create research inputs, executable prototypes, schemas, generators,
> and checked freeze artifacts; it may not refactor production code. Select no
> architecture by taste, historical familiarity, or resemblance to
> effect-build. A candidate survives only through predeclared behavior,
> ownership, topology, consumer, compression, and marginal-change gates.
>
> **Starting-coordinate rule:** work from a clean branch rooted at PR21
> `887a9fe2b35590f3088ffeee84f32722796e03ab`. PR22 and the preserved full-v1
> overlay are read-only prototype evidence and forbidden ancestors. Do not
> merge, cherry-pick, or copy either wholesale.

## Status

- **Priority:** P0
- **Effort:** XL
- **Risk:** HIGH
- **Depends on:** Plan 003's verified bundle, reference manifest, and hash-linked
  disposition; merged effect-build PR24 contract at
  `dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc`
- **Final-freeze gate:** reconcile the terminal Plan 004 coordinate and prove it
  does not change an admitted effect-build/Apple/package boundary
- **Execution:** IN PROGRESS — Plan 003 is complete; candidate-neutral schema,
  baseline, and trial work may proceed. No candidate or production topology is
  selected. Final freeze remains blocked on Plan 004's terminal coordinate.
- **Category:** product architecture, package design, migration, tests, tooling
- **Target branch:** `codex/architecture-program`, created from
  `887a9fe2b35590f3088ffeee84f32722796e03ab`

## Why this matters

PR21 completed product and safety research, but explicitly did not freeze npm
package names, production APIs, dependency versions, or physical topology.
PR22 and the later overlay then implemented provisional shapes before that
selection. The overlay is valuable evidence, but it contains approximately
22,560 `src/` lines plus 356 Action lines, 10,932 lines under
`src/publication/`, split orchestration ownership, and only 19/69 closed
acceptance rows.

Historical Plans 173-184 did perform a full architecture/economics program for
a narrower product. They selected one root package with `apps/*`, not
top-level `packages/*`, and certified 5,871 product lines. Those exact APIs,
durable schemas, and scope counts are superseded. Their invariant-level lessons
remain evidence: one canon, one transition/effect owner, exact reviewed data
executed, durable uncertainty, thin hosts, a checked DAG, no compatibility
peers, independent oracles, and measured total/marginal complexity.

This plan restores that missing middle for the 69-outcome PR21 product and
produces an effect-build-equivalent machine-readable freeze before source work
resumes.

## Success criteria and authorized cuts

Preserve:

1. all 69 selected launch-scorecard outcomes and their evidence levels;
2. `ArtifactBundle -> ReleasePlan -> ReleaseJournal -> ReleaseReport` with
   reports and indexes derived;
3. fresh-runner continuation, honest outcome-unknown handling, request
   correspondence, CAS dispatch authority, and late-fact preservation;
4. provider-native wire truth and ordinary import/Layer composition without a
   provider allowlist;
5. effect-build ownership of production/transformation and ts-release ownership
   of immutable adoption, release history, and continuation;
6. real library, CLI, Action, Node, Bun, external-provider, and effect-build
   consumer boundaries.

Cut unless Plan 003 proves escaped durable/public compatibility:

- the Promise facade and historical `PreparedReleaseV2` spelling;
- universal Publisher, provider registry/allowlist, Workflow/Activity kernel,
  peer durable representations, fallback readers/writers, and test-only legacy
  reducers;
- provisional root-package or module ownership merely because it exists in the
  overlay; and
- configuration or extensibility with no selected product outcome.

The measured durable core includes all handwritten or generated production
TypeScript in public packages, hosts, and the Action source. Tests, fixtures,
oracles, planning documents, and generated delivery bundles are reported
separately. Moving decisions into schemas, generators, tables, scripts, or
permanent oracles is relocation, not deletion.

The initial forcing target is at least 50% net product-source reduction from
the preserved full-v1 prototype baseline, while also reducing concepts,
representations, invalid states, workflow variants, public commitments, and
dependency edges. If required behavior makes that impossible, STOP with exact
physical arithmetic; do not silently widen the target.

## Non-negotiable target laws

1. One canonical durable chain; every other representation is a projection.
2. One pure transition owner returns one explicit command or terminal report.
3. One interpreter owns credentials, observation, append, authorization, and
   dispatch ordering; CAS is the sole constructor of dispatch authority.
4. Facts are not decisions or effects; provider commitment is never inferred
   from an Effect exit or host retry.
5. Exactly one host-selected `JournalStore` and one logical journal per release;
   a consumer Layer cannot shadow host-owned journal, clock, transport, or
   approval services.
6. Provider verticals own Intent/wire codecs, preparation, observation,
   dispatch, recovery law, tests, and docs. Core imports no concrete provider.
7. A second configured instance and a packed external provider require zero
   kernel edits. Provider siblings never import one another.
8. Host-neutral code imports no Node/Bun implementation. CLI, Action, YAML, and
   providers never reconstruct lifecycle policy.
9. effect-build finalized file/tree/tool values cross once, losslessly, without
   callback-authored shadow schemas, mutable paths, `number` size narrowing,
   symlink traversal, or a third shared artifact package lacking a second real
   consumer.
10. effect-build-apple owns concrete Apple operations/codecs; ts-release owns
    the sole release journal. Commit-before-submission-ID remains inconclusive.
11. Incompatible durable formats receive `hard-cut` or an explicit one-shot
    migration. There is no dual live reader/writer by default.
12. Public runtime exports, declaration exports, emitted modules, package
    manifests, bins, and host entrypoints are generated and checked together.
13. The package/import graph is acyclic, one-way, and justified by independent
    invariant, dependency, lifecycle, or consumer value—not file count.
14. Every claim, source unit, public symbol, durable codec, and selected row has
    one owner, disposition, successor wave, and executable gate.

## Canonical artifact model

Create `docs/refactor/architecture-program/` plus an independently installed,
private `tools/architecture-program` package. PR21's production/test graph is a
read-only baseline on Effect `4.0.0-beta.83`; do not upgrade it merely to run
research tooling. The private tool package is aligned internally on
`effect@4.0.0-rc.108`, `@effect/vitest@4.0.0-rc.108`, and `vitest@4.1.10`. No
executable install graph may contain mixed Effect families. The currently
ignored root `node_modules` resolves rc.108 despite PR21's beta.83 manifest and
lock; it is stale local state and must not be used as PR21 evidence or by this
tool. The first slice must leave root `bun.lock` byte-identical at SHA-256
`5640ae3df79d9a378864c7345f7d78ca74056bf44e420756629d28ac15943cf9`.

Put versioned schemas, strict decoding, canonicalization, generators, and
architecture-program tests inside that private package. Use `Schema.Struct` for
plain DTOs, `Schema.Class` only where durable behavior/equality is required,
`Schema.TaggedClass` for variants and rc.108's exact `Schema.TaggedError` API
for errors (the pinned release does not export `Schema.TaggedErrorClass`), plus branded
IDs with real validation constraints. Reject duplicate IDs, unknown/excess
keys, dangling references, non-NFC text, non-canonical paths, duplicate JSON
keys, and non-canonical JSON bytes. Reuse the semantics of PR21's
`scripts/lib/canonical-json.ts` and `scripts/lib/strict-json.ts` without
importing the beta.83 production graph into the rc.108 tool graph.

Hand-authored evidence/measurement inputs:

```text
docs/refactor/architecture-program/inputs/
  research-traceability.json
  baseline.json
  ownership-decisions.json
  trial-spec.json
  maintainer-decision.json       # only when generated results require one
```

Tool-produced trial evidence, never hand-authored:

```text
docs/refactor/architecture-program/results/
  machine/<candidate-id>.json
  topology/<candidate-id>.json
  trial-results.json
```

Generated freeze outputs, created only after a unique or explicitly approved
selection:

```text
docs/refactor/architecture-program/freeze/
  SYSTEM.json
  SURFACE.json
  MIGRATION.json
  WAVES.json
  GATES.json
```

The private tool package's freeze generator is the only writer of the freeze
outputs. `SYSTEM.json` is the sole downstream architecture authority and stores
the hashes of every input/projection. Generate `SURFACE.json`, `MIGRATION.json`,
`WAVES.json`, `GATES.json`, and Markdown explanations first, hash their
canonical bytes, and generate `SYSTEM.json` last. Projections contain only a
stable `contractId`, never the hash of `SYSTEM.json`; this prevents circular
identity. Hand editing generated results or freeze outputs is invalid.
Identity-bearing artifacts contain no timestamp.

### `SYSTEM.json`

Freeze:

- exact evidence/source coordinates and counting-policy hash;
- selected machine and package-topology candidate IDs;
- canonical concepts, states, events, commands, forbidden states, and durable
  formats/versions;
- construction, transition, persistence, effect, and projection owners;
- journal deployments and the effect-build/Apple boundary;
- target package/file tree and ownership/import DAG;
- singleton assertions for transition owner, interpreter, dispatch-authority
  constructor, journal append path, and report projection;
- public-surface, migration, wave, and gate hashes;
- total and marginal budgets; and
- required/forbidden ancestry.

### `SURFACE.json`

For every package record exact npm name, visibility, role, workspace path,
version train, engines, bins, dependencies/peers, exports/conditions, source
entrypoint, runtime exports, declaration exports/fingerprint, emitted modules,
host/runtime support, provider/operation ownership, packed-consumer cases, and
publication order. Record workspace globs, allowed/forbidden import edges, and
the acyclic dependency DAG.

### `MIGRATION.json`

Inventory every relevant PR21, PR22, and preserved-overlay production path,
symbol, export, durable codec, and compatibility owner exactly once. Each row
contains:

- stable ID and evidence coordinates;
- baseline paths/symbols/exports;
- action: `retain | move | merge | replace | delete | historical-only`;
- exact target package/module/owner;
- law and trace IDs;
- physical candidate product lines;
- unavoidable replacement product lines;
- relocated schema/table/generator/tooling/oracle lines;
- credible net product deletion;
- concepts, representations, branches, workflows, exports, and dependency
  edges removed;
- public/durable migration status, successor wave, and deletion gate.

Enforce per line-owning path row:

```text
credible net product deletion =
  physical candidate product lines
  - unavoidable replacement product lines
  - relocated schema lines
  - relocated table lines
  - relocated generator lines
  - relocated tooling lines
  - relocated oracle lines
```

Allow a negative result so additions remain visible. `retain`, `move`, and
`historical-only` rows receive zero deletion credit. Symbol/export/codec rows
link to exactly one line-owning path row and carry no independent line
arithmetic. Relocated code remains charged in its destination lane. No
`unresolved`, unclassified path/export/codec, missing replacement, or vague
cleanup wave may survive the freeze.

### `WAVES.json` and `GATES.json`

Every Plan 006-009 wave, including the ordered 008B convergence wave, records
exact inputs, outputs, package/source targets,
predecessors, deletions, row/proposition/migration coverage, budgets, commands,
claims, stop conditions, and result artifact. Cover all 69 rows and every
required proposition/migration unit exactly once.

Every gate records command/argv, host, immutable input hashes, expected exit,
machine-readable result schema, claims/cases proved, and
`mutatesExternalState: false`. Live gates remain Plan 009 authority packets,
never silently appear here.

### Candidate-neutral first slice

Before baselines or prototypes, implement exactly this independent contract
slice:

```text
tools/architecture-program/package.json
tools/architecture-program/bun.lock
tools/architecture-program/tsconfig.json
tools/architecture-program/src/schema/primitives.ts
tools/architecture-program/src/schema/trial-spec.ts
tools/architecture-program/src/canonical-document.ts
tools/architecture-program/src/check-inputs.ts
tools/architecture-program/test/canonical-document.test.ts
tools/architecture-program/test/trial-spec.test.ts
docs/refactor/architecture-program/inputs/trial-spec.json
```

Add root wrappers `check:architecture-schema` and
`check:architecture-inputs`, plus a CI step that independently installs the
tool package from its frozen lockfile. Do not add freeze outputs, select a
candidate, or expose a production surface in this slice.

Install and check the child graph with:

```text
bun install --cwd tools/architecture-program
bun install --cwd tools/architecture-program --frozen-lockfile
bun run --cwd tools/architecture-program check
bun run --cwd tools/architecture-program test
```

Keep `tools/*` outside the root workspace globs; commit the child's lockfile and
`node_modules` exclusion, never a root dependency or root-lock migration.

The first schema defines constrained brands `ProgramId`, `LawId`, `CaseId`,
`GateId`, `ProbeId`, `MachineCandidateId`, `TopologyCandidateId`, `RoleId`,
`MetricId`, `OwnerId`, `ArtifactId`, `Sha256Hex`, `GitRevision`,
`ExistingRepositoryPath`, and `PlannedRepositoryPath`. Existing and planned
paths are distinct types. Source anchors are a tagged union of whole-file and
line-range anchors; only existing anchors receive existence/hash checks.

`ArchitectureTrialSpecV1` contains exactly:

```text
schemaVersion = "ts-release/architecture-trial-spec/v1"
programId
authorities[]
laws[14]
machineCases[16]
machineCandidates[]
topologyFixture
topologyCandidates[]
marginalProbes[9]
gateRequirements[]
machineSelectionPolicy
topologySelectionPolicy
```

The initial candidate IDs are exactly `M1-extracted-fold`,
`M2-total-transition`, `T1-root`, `T2-kernel-provider-bundle`, and
`T3-provider-verticals`. The trial spec has no `selectedCandidateId`, target
packages, final public surface, target DAG, or npm-name mapping. Unknown-key
rejection makes premature selection invalid. Freeze generation later accepts
only a tool-generated unique selection or an explicit hash-bound maintainer
decision.

Hostile first-slice tests must reject unknown or duplicate keys/IDs; dangling
law/case/gate/probe references; path traversal, backslashes, non-NFC text,
duplicate JSON keys, whitespace/key-order drift; missing required candidates,
cases, or probes; unequal fixture/case/probe sets; any selected/target-surface
field; weakened Action/artifact/provider/host literals; network, credentials,
or external mutation in a gate; weighted scoring; and an absent stop outcome.

## Step 0: Admit immutable evidence without adopting its topology

Create a clean worktree at PR21
`887a9fe2b35590f3088ffeee84f32722796e03ab`. Verify Plan 003's bundle and
manifest by restoring PR21, PR22, and overlay refs into a temporary repository.
Verify merged effect-build PR24 at
`dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc` and record its generated contract,
11-public-package/42-module projection, and exact hashes.

The architecture branch must pass:

```text
merge-base --is-ancestor 887a9fe HEAD: true
merge-base --is-ancestor c2ac4ee HEAD: false
merge-base --is-ancestor <overlay-evidence-sha> HEAD: false
```

Record any later Plan 004 readiness coordinate as pending evidence. Steps 1-5
may proceed against merged PR24; Step 6 cannot freeze until the terminal Plan
004 delta is reconciled or proven irrelevant to the boundary.

## Step 1: Build complete research traceability

Populate `research-traceability.json` with every accepted/rejected/superseded/
deferred PR21 proposition, all 69 selected rows, ten resolved-later candidates,
and every retained invariant-level lesson from Plans 173-184. Each row records
source anchor, exact proposition, class, disposition, owner, witnesses, evidence
IDs, current status, successor, and whether it is product authority or only an
architecture hypothesis.

Explicitly disposition superseded Promise APIs, historical schema literals,
old parity denominators, root-package topology, and 5,871/7,800 line budgets;
do not revive them silently. Add hostile tests for duplicate IDs, missing rows,
nonexistent sources, contradictory owners, and required-without-successor.

## Step 2: Reproduce a multi-coordinate compression baseline

Populate `baseline.json` for:

1. PR21 research/base production coordinate;
2. PR22 native-npm prototype;
3. the preserved full-v1 prototype;
4. historical Plan 184;
5. effect-build's accepted generated contract; and later
6. every architecture candidate.

Count production, generated production inputs, Action source, tests/oracles,
fixtures, tooling, plans, and bundles separately. Record product lines by file,
subsystem, and package; branch points; concepts; canonical representations;
representable invalid states; workflow variants; adapters/fallbacks/error
translations; public runtime/declaration exports; package/dependency edges;
durable formats; mutation/append/dispatch sites; orchestration owners; evidence
counts; and the 25 largest modules.

Trace these maintenance changes and record gross additions separately from
deletions: second provider instance, packed external provider, genuinely new
commitment mechanism, operation in an existing provider, JournalStore backend,
file/tree producer adapter, deliberate public export, and difficult recovery
transition. Report median, p90, maximum, and worst-tail concepts/modules/
packages/central branches touched.

The preserved full-v1 overlay, not a “landed v1,” is the source-compression
reference. Historical 5,871 and 7,800 numbers remain scoped comparators only.

## Step 3: Resolve durable and cross-repository ownership

Before coding candidates, decide in input records:

- one logical journal law and exact default deployment per CLI, Action, and
  release-readiness host; Git-ref and S3 may be alternative implementations,
  never peer histories;
- CAS head versus immutable/WORM event-segment roles;
- whether effect-build certification records are derived evidence or contain
  release facts that ts-release must journal;
- one Apple history and commit-before-ID correlation law;
- lossless `HashedFile`/`HashedTree` and adoption mapping, including canonical
  decimal sizes, structured digests, paths, modes, symlinks, shared content,
  duplicate-name rejection, and mutable-path rejection; and
- hard-cut versus one-shot migration for every PR22/overlay durable format,
  based on Plan 003 escape evidence.

Any unresolved ownership or format decision blocks trials that depend on it.

## Step 4: Select the deterministic machine with shared hard traces

Implement at least two genuinely different machine candidates under
`prototypes/research-complete-machine/`:

- `M1-extracted-fold`: minimal extraction of the current
  fold/decision/application grammar; and
- `M2-total-transition`: one total transition table plus one typed effect
  interpreter.

A third candidate is allowed only if it removes a distinct state dimension.
Workflow/Activity may host a candidate but cannot manufacture provider
commitment knowledge.

Every candidate executes the same 16 fixtures:

1. initial success;
2. rejection proven before commit;
3. response loss then satisfied observation;
4. response loss then absence/inconclusive stop;
5. core Git CAS protected replay;
6. explicit risk acceptance;
7. concurrent runners with one CAS winner;
8. request/endpoint mismatch before observation;
9. supersession during dispatch followed by late receipt and observation;
10. ambiguous append reconciled by read-back;
11. malformed complete provider graph rejected before any provider effect;
12. external provider plus two instances with zero kernel edits;
13. Apple commit-before-submission-ID loss;
14. finalized file/tree adoption with modes, symlinks, shared content, duplicate
    rejection, and mutable-path rejection;
15. consumer attempt to shadow host-owned dependencies; and
16. journal write/read bound symmetry at the exact limit and one byte over.

The first trial spec binds case 16 to a 64-byte **trial-only** fixture limit and
records `hasProductAuthority: false`. Every candidate receipt must bind that
same integer. This proves read/write symmetry without inventing the eventual
production limit; a production bound remains a later freeze decision.

Record semantic/structural/operational/source metrics, mutation owners,
construction-versus-validation invariants, counterexamples, and marginal probes
for every candidate. The selected machine/interpreter slice must be no more
than 60% of the corresponding preserved-overlay slice. Every law and trace is a
hard gate.

Every machine result is tool-produced and binds the shared spec hash, candidate
tree, compiler/Bun/Effect versions, all 16 semantic trace IDs, before/after
tree hashes, patch hash, and per-lane source arithmetic. Candidate-specific
tests may add evidence but may not replace, rename, or weaken a shared trace.

If no candidate qualifies, STOP. If multiple candidates qualify without one
Pareto-dominating on state space, source, change amplification, and readability,
request a maintainer decision with measurements; do not invent a weighted score.

## Step 5: Select the physical package/public topology

Using the qualifying machine and one identical provider/host slice, implement
three topology trials:

- **T1-root:** one public root library with provider namespaces and host
  subpaths;
- **T2-kernel-provider-bundle:** neutral kernel package plus one aggregate first-party-provider
  package, with hosts as subpaths/apps; and
- **T3-provider-verticals:** neutral kernel plus package-per-provider verticals,
  effect-build-style.

An optional T4 may vary host placement only after a provider partition wins.
The Action remains an application/delivery artifact in every trial. Do not add
a third shared artifact package without a second real consumer.

Freeze and test each actual workspace/package tree. Measure package/version
coordinates, version-skew/partial-publication states, dependency edges, public
modules/runtime/declaration exports, emitted/packed bytes, install coordinates,
clean Node/Bun/library/CLI/Action/external-provider execution, sibling imports,
cycles, forbidden edges, tree shaking, build order, and self-release behavior.

Every topology uses the same qualifying machine hash, compiler/Bun/Effect
versions, semantic operation IDs, 16 cases, and a shared fixture containing a
kernel, two first-party provider verticals, two instances of one provider, a
packed external provider, Node host, Bun host, CLI, Action, and an effect-build
file/tree adopter. Two first-party providers are mandatory so the sibling-edge
law is tested rather than assumed.

Run these nine predeclared marginal probes against each topology: second
provider instance; packed external provider; new first-party provider vertical;
genuinely new commitment mechanism; operation in an existing provider;
JournalStore backend; file/tree producer adapter; deliberate public export; and
difficult recovery transition. Required invariants:

- second provider instance and external provider: zero kernel edits;
- new provider: zero machine/host branches and no sibling edits;
- JournalStore backend: zero provider/machine changes;
- producer adapter: zero provider/kernel-workflow changes;
- public addition: explicit generated surface change; and
- recovery change: explicit durable-format/migration review.

`packages/*` wins only if a workspace trial passes every consumer/publication
gate and materially reduces forbidden dependencies, invalid version states, or
change amplification. A root package wins only if it meets the same laws with a
smaller state space. Package count is not a quality metric by itself.

Predeclare gross product-addition targets of median <=40 and p90 <=100 lines per
new outcome/mechanism, with maximum <=200 product lines. Use nearest-rank
quantiles. Each probe records before/after tree hashes, patch hash, per-lane
gross additions/deletions, files/modules/packages/concepts/central branches
touched, public/durable/DAG deltas, and zero-touch assertions. Do not dilute the
distribution with reused scorecard rows that add zero mechanism code.

The candidate-neutral spec currently declares one non-zero observation for
each of nine probes. Under nearest-rank quantiles, p90 is therefore rank 9 and
is the effective maximum, so this population's operative maximum is <=100 and
the <=200 maximum guard is redundant. The schema records that consequence
explicitly. Expanding the sample population or changing the percentile
requires a hash-changing trial-spec amendment; tools may not silently weaken or
reinterpret the declared arithmetic.

Topology hard gates include clean packed library execution under Node and Bun;
packed CLI and Action; packed external provider with two instances; lossless
effect-build file/tree adoption; exact runtime/declaration surfaces and
normalized declaration hashes; exact emitted/packed inventory; static,
type-only, literal dynamic, and manifest edge equality; no cycles,
provider-sibling edges, provider-to-kernel reversals, or host imports from
neutral code; hostile version-skew and partial-publication trials; dry-run
publication/build order and self-release rehearsal; tree-shaking and packed
byte measurements; and all nine marginal probes. Every gate declares no
network, no credentials, and `mutatesExternalState: false`.

Selection first rejects every hard-gate failure, then uses strict Pareto
dominance with declared objective directions. Weighted scores are forbidden.
The tool emits `NoQualifyingCandidate` or `MaintainerDecisionRequired` rather
than manufacturing a winner.

## Step 6: Generate and freeze the accepted contract

Reconcile the terminal Plan 004 coordinate. Generate `SURFACE.json`,
`MIGRATION.json`, `WAVES.json`, `GATES.json`, and their Markdown explanations;
hash those canonical bytes; then generate `SYSTEM.json` last.

The private tool package's `src/check-program.ts` (exposed by the root
`check:architecture-program` wrapper) must fail unless:

- every input/output decodes with the canonical Schema and all hashes agree;
- source ancestry is correct and forbidden prototype ancestry is absent;
- exactly one machine/topology tuple is selected through the declared rule;
- every baseline path/export/durable codec has one migration disposition;
- actual static, type-only, dynamic, and manifest dependencies match one
  acyclic allowed DAG and no forbidden edge exists;
- every canonical fact/decision/effect/projection has one owner;
- there is one transition owner, interpreter, dispatch-authority constructor,
  CAS append path, and report projection;
- all 16 traces and every packed topology/consumer gate pass;
- runtime exports, declaration exports, dist modules, manifests, bins, package
  versions, and Effect versions exactly match `SURFACE.json`;
- migration arithmetic balances, relocation is charged, and no compatibility
  peer or unresolved deletion remains;
- the selected machine slice is <=60% of the preserved prototype equivalent;
- the full target forecast is <=50% of preserved prototype product source;
- marginal targets pass or an explicit maintainer decision stops the program;
  and
- all required propositions, 69 rows, public units, durable formats, and
  migration rows map to exact successor waves.

The dependency check is an exact graph equality check, not a permissive
allowlist. Parse `ImportDeclaration`, exports, `ImportTypeNode`, literal
`import()`, and production manifest dependencies, peer dependencies, and
optional dependencies. Reject unresolved or nonliteral cross-owner imports.
The current PR21 static import checker is baseline evidence only.

The public freeze supersedes the prototype's runtime-name-only checker. It must
bind ordered export conditions, runtime exports, declaration exports, namespace
members, normalized `.d.ts` SHA-256, emitted files, packed inventory, bins,
engines, and package edges for every public coordinate. The preserved overlay's
59 runtime exports versus 108 declaration exports is a required hostile
baseline: all 49 declaration-only commitments must be dispositioned, not hidden
by a runtime-only check.

Only after this gate passes may Plan 006 change production code.

## Commands and test plan

The candidate-neutral first slice adds:

```text
check:architecture-schema
check:architecture-inputs
```

Later trial and freeze slices add Bun scripts only when their generated
artifacts exist:

```text
generate:architecture-freeze
run:architecture-trials
check:architecture-trials
check:architecture-surface
check:architecture-migration
check:architecture-program
```

Tests include hostile Schema/canonical-JSON/hash-link fixtures; omitted and
duplicate source/export/codec rows; cycles and forbidden static/type/dynamic/
manifest imports; declaration/runtime surface drift; migration arithmetic and
relocation fraud; all 16 machine traces; every topology packed consumer; and
non-deterministic generator output. Run with Bun.

Implementation order is schema -> strict canonical decoder/checker -> hostile
tests -> committed candidate-neutral `trial-spec.json` -> traceability,
baseline, and ownership inputs -> machine receipts -> topology receipts ->
selection -> generated freeze. No production architecture is frozen before the
trial results exist.

## Done criteria

- [ ] Plan 003 evidence restores independently and no prototype is an ancestor.
- [ ] PR21, all 69 rows, later decisions, and retained historical invariants are
      traceable without reviving superseded scope.
- [ ] Multi-coordinate semantic/structural/operational/source baselines reproduce.
- [ ] Durable formats, journal deployments, effect-build boundary, and Apple
      history have one checked owner/disposition.
- [ ] At least two machine candidates pass or fail the same 16 traces honestly.
- [ ] T1, T2, and T3 run as real packed package/host topologies.
- [ ] Exactly one machine/topology tuple is selected or a measured maintainer
      decision is recorded.
- [ ] `SYSTEM.json`, `SURFACE.json`, `MIGRATION.json`, `WAVES.json`, and
      `GATES.json` regenerate byte-for-byte and contain no unresolved row.
- [ ] Package/API/import/migration/deletion/publication topology is exact.
- [ ] Total, marginal, relocation, and physical deletion budgets are checked.
- [ ] `bun run check:architecture-program`, existing read-only core gates, and
      `git diff --check` pass.
- [ ] No production, remote, credential, provider, tag, release, or publication
      mutation occurred.

## STOP conditions

- Plan 003 evidence cannot restore, any attested disposition is unresolved, or a
  prototype becomes an ancestor.
- A research proposition/scorecard row cannot be mapped without inventing law.
- Git-ref/S3, Apple history, effect-build adoption, or durable migration has two
  owners or remains ambiguous.
- A candidate passes by weakening a trace, hiding code in generators/oracles,
  treating an Effect exit as commitment, or creating a compatibility peer.
- No machine or topology candidate passes every hard gate.
- Multiple non-dominated candidates need a maintainer decision.
- The terminal Plan 004 contract changes an admitted boundary and has not been
  retrialed.
- The 50% source or marginal-cost target would be widened without explicit
  review grounded in physical arithmetic and preserved behavior.

## Maintenance notes

Research changes update traceability inputs first and regenerate the freeze.
Plans 006-010 consume exact hashes and may not reinterpret the machine, package
graph, public surface, ownership, migration, budgets, or wave order. New product
capabilities remain outside this compression program.
