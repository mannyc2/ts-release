# Plan 008: Integrate the real effect-build packages and close producer implementation

> **Executor instructions:** Use only the exact terminal package/contract
> coordinate accepted by Plan 004. Read Plan 005's effect-build and journal
> decisions and the final effect-build contract before editing. Keep ts-release
> producer-neutral; applications import concrete effect-build packages through
> ordinary Effect composition. If an exact packed/published coordinate, immutable
> CI record, or lossless cross-package contract is missing, STOP. Do not depend
> on a mutable checkout, create a compatibility adapter, duplicate Apple native
> schemas, add a peer checksum authority, or count a fixture-shaped callback as
> producer implementation.
>
> **Drift check (run first):** require Plans 004-007 DONE. Start from the exact
> terminal Plan 007 candidate; do not run this lane in parallel or merge an
> independently evolved implementation branch. Run
> `git status --short --branch`, `git rev-parse HEAD`,
> `bun run check:architecture-program`, `bun run check:core`, and
> `bun run check:launch-evidence`. Verify the effect-build exact package set,
> version, tarball digests, source commit, hosted gate, 67-operation contract,
> 11-public-package/42-module projection, and private Rolldown disposition from
> Plan 004's terminal manifest. Any mismatch is a STOP.

## Status

- **Priority:** P0
- **Effort:** XL
- **Risk:** HIGH
- **Depends on:** Plan 004 terminal accepted coordinate; Plans 005-007 DONE
- **Category:** integration, architecture, tests, migration, release engineering
- **Starting coordinate:** exact terminal Plan 007 candidate and Plan 008 wave
  hashes from `WAVES.json`
- **Target branch:** `codex/effect-build-integration`

## Why this matters

The remembered `packages/*` implementation is real, but it is in the separate
effect-build monorepo—not on a newer ts-release branch. PR 24 is merged at
`dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc`; its contract reports 67 provider
operations, 46 non-operation findings, 11 public packages/42 public modules,
and a private reservation-only Rolldown package. A still-active release-readiness
task is adding local policy/workflow/Apple journal controls, so Plan 004 remains
blocked until that task emits a terminal manifest.

In the preserved ts-release prototype, `src/platform/finalized-producer.ts`
accepts an
arbitrary Effect plus caller-authored `finalizedFile` and `facts` projections.
Its shadow `FinalizedToolFile` narrows byte length to a JavaScript `number` and
digest to an optional bare string, and it has no lossless tree adoption. The
inspectable upstream contract instead exposes canonical decimal sizes,
algorithm-tagged digests, and `HashedFile` / `HashedTree` with `FileAdoption` /
`TreeAdoption`; Apple `.app` output needs the tree boundary. The current fixture
therefore demonstrates coordinate-free adoption, but not the real package
contract. It is migration evidence, not a file to refactor in place. The Plan
007 candidate contains no effect-build package coordinate unless the exact
Plan 005 surface reserved it. All 26
selected producer/trust implementation rows remain missing. This plan consumes
the real contract without moving build-tool semantics into ts-release.

## Current missing implementation rows

```text
P01-02 P01-03 P01-04
P02-01 P02-02 P02-03
P03-01 P03-02
P04-01
P05-01 P05-02 P05-03 P05-05 P05-06
P06-01
P07-01
P08-01
P09-01 P09-02 P09-03
P10-01 P10-02 P10-03 P10-04
Q02-01 Q02-02
```

P01-01 (prebuilt adoption) and Q01 (SHA256SUMS) are already local and closed.
The 26 rows above span Bun/Deno/SEA executables, archives/source archives,
Python, nFPM packages, Apple app/DMG/pkg/sign/notary/staple/assessment, Windows
signing, and Syft SBOMs.

## Canonical boundary

```text
application imports effect-build producer Effects
  -> concrete package returns canonical finalized file/tree/tool value(s)
  -> caller selects final logical outputs
  -> ts-release independently validates logical identity + canonical size/digest
     + tree manifest/entries where present
  -> ts-release copies/adopts all content into one immutable ArtifactBundle
  -> ReleasePlan records strict producer-native facts as diagnostic provenance
  -> providers receive bundle bytes/public names, never producer temp paths
```

There is no universal builder and no `prebuilt` mode. ts-release's core package
must not depend at runtime on all effect-build producers. The integration proof
is a clean application/fixture that consumes both exact package sets. A small
adapter may exist only if Plan 005 assigned it one canonical fact and it removes
caller-authored projection ambiguity without becoming a third framework.

Apple is the sole selected flow that mutates remotely before final bytes cross
the handoff:

```text
ts-release journal records exact pre-notary request and DispatchStarted
  -> effect-build-apple performs submit
  -> ts-release records the complete native submission reference/status fact
  -> fresh runner invokes info/log with that recorded native reference
  -> effect-build-apple staples and validates
  -> ts-release adopts only distinct verified final bytes
```

effect-build-apple owns concrete operations and strict native codecs. ts-release
owns the one release journal and must preserve the full native value losslessly.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Architecture | `bun run check:architecture-program` | exit 0 |
| Core | `bun run check:core` | exit 0 |
| Integration | `bun run check:effect-build-integration` | exit 0 |
| Packed consumers | `bun run check:packed-consumers` | exit 0 |
| Evidence | `bun run check:launch-evidence` | exit 0; 26 rows have honest implementation witnesses |
| Typecheck | `bun run check` | exit 0 |
| Diff | `git diff --check` | exit 0 |

The new integration command is created in Step 2 and must use Bun. Never replace
it with a workspace symlink or unpublished mutable checkout.

## Scope

**In scope in ts-release:**

- `src/platform/finalized-producer.ts`, `src/release/artifact-bundle.ts`, and
  artifact/producer-fact boundaries required by Plan 005's file/tree decision
- Apple operation adapter required by Plan 005/006
- a clean integration fixture application and packed-consumer scripts/tests
- exact dev/test package coordinates and lockfile changes
- evidence implementation witnesses for the 26 rows
- architecture budget/traceability updates
- examples/docs showing ordinary composition

**Coordinated in effect-build only through its accepted terminal work:**

- exact packed/published packages, canonical artifact/tool representation,
  native producer results/codecs, and immutable CI records
- fixes are separate effect-build plans/PRs; do not patch a vendored copy here

**Out of scope:**

- live npm/PyPI/GitHub/Apple/provider mutation (Plan 009)
- publishing effect-build or ts-release packages without separate authority
- changing effect-build topology or exposing Rolldown
- universal build service, ambient artifact store, mutable path identity,
  compatibility/fallback shape, third shared artifact package

## Git workflow

- Branch: `codex/effect-build-integration`, created from the exact terminal
  Plan 007 candidate
- Record exact effect-build source/package/tarball digests in every integration
  commit and evidence record.
- Commit handoff contract, producer groups, Apple, platform matrix, and evidence
  as separate reviewable units.
- Do not push or open a PR without separate authority.

## Steps

### Step 1: Admit one immutable upstream contract

Copy no source. Validate Plan 004's terminal manifest against:

- exact source commit and package versions;
- `npm pack` tarball SHA-256/integrity for every admitted package;
- exact 11 public packages/42 public modules and private Rolldown exclusion;
- exact Effect `4.0.0-rc.108` family across the installed graph;
- 67 operation and 46 non-operation contract totals;
- canonical artifact/tool representation and finalization protocol;
- packed clean-consumer and hosted exact-SHA gate records.

If only unpublished tarballs exist, they may be used for a non-shipping
integration rehearsal when their bytes and source commit are immutable. The
production dependency/quickstart cannot claim availability until an exact
published prerelease/release exists. Never use `file:../effect-build`, a Git
worktree path, mutable branch URL, or workspace symlink as the claimed boundary.

**Verify:** a strict admission script reports every exact coordinate/digest and
fails when Rolldown, an unknown module, mixed Effect family, or mutable source is
present.

### Step 2: Replace callback-shaped proof with the exact lossless file/tree contract

Refactor `src/platform/finalized-producer.ts` and the artifact kernel according
to Plan 005's boundary. Consume the exact upstream codecs/types rather than a
structural shadow. The admitted values are the accepted equivalents of
`HashedFile | HashedTree` and `FileAdoption | TreeAdoption`. The ts-release-owned
input must be producer-neutral and closed:

- one or more finalized files or canonical trees;
- stable logical identity/public name;
- canonical decimal byte lengths and algorithm-tagged SHA-256 values without
  narrowing; ts-release derives them again while copying;
- for trees, one canonical safe-relative-entry manifest preserving file modes
  and symlink entries without following them outside the tree;
- typed/versioned producer facts encoded through the producer's Schema;
- no mutable byte alias, private temp path as durable identity, ambient service,
  or peer checksum/manifest authority.

Remove caller-authored callbacks that can reinterpret a producer result after
the fact. The application may select which finalized outputs to adopt, but it
cannot manufacture their digest/length/native facts.

Tree policy: a directory is never a private path or opaque blob. Preserve the
accepted upstream tree identity losslessly. Under Plan 005's selected mapping,
adopt the canonical manifest and every referenced content object/logical entry;
retain safe relative paths, executable modes, and symlink targets as typed tree
facts while never following symlinks during adoption. Reject absolute/traversal
paths, devices/sockets, duplicate/case-colliding entries under the selected
portability law, mutable aliases, dangling content references, and unselected
intermediates. Preserve multiple logical entries sharing one content digest
without merging their meanings.

Create a packed fixture application that imports ts-release plus the exact
effect-build core/Bun/archive packages and performs build -> finalize -> adopt ->
plan -> report under ordinary Layers.

**Verify:** positive file/tree/multi-output and hostile mutable-path/digest/
decimal-length/name/tree/traversal/symlink tests pass from a clean packed install.

### Step 3: Integrate executable, archive, Python, package, signing, and SBOM groups

Add small product fixtures, not internal-state mocks:

- portable TypeScript CLI for Bun and Deno six-cell matrices and Node SEA scope;
- deterministic ZIP/tar.gz and exact Git-tree source archive;
- uv frontend with uv_build and poetry-core wheel/sdist projects;
- nFPM deb/rpm/apk/Arch/MSIX fixtures;
- Windows Authenticode mechanics fixture;
- Syft SPDX JSON and CycloneDX JSON fixture.

Each fixture must consume the real package API, return canonical finalized
values, adopt them once, retain typed producer facts in plan/report, and run its
independent tool/format/clean-consumer oracle. Unsupported matrices stay
unsupported; do not infer breadth from a package name.

Bind P01-02..P09-03 and Q02-01/Q02-02 implementation witnesses to executed case
IDs and immutable upstream package/source records. Leave required live facets
open until Plan 009.

**Verify:** the integration gate passes every locally runnable tool/format case;
platform-specific cases have exact immutable hosted records rather than skips
masquerading as passes.

### Step 4: Integrate Apple without a second representation or journal

Consume effect-build-apple's exact public native types/codecs and concrete
submit/info/log/staple/validate Effects. Replace provisional ts-release-owned
`effect-build-*` handoff schemas in `src/publication/apple-notary.ts` with direct,
lossless use of the accepted codec boundary. Do not reduce a rich
`SubmissionReference` to a submission ID plus caller-authored fields.

Ensure:

- exact pre-notary artifact identity is in the ts-release Intent/request;
- `DispatchStarted` is durable before submit;
- native returned submission reference/status is strictly decoded and journaled;
- missing/malformed response after possible commit becomes inconclusive;
- runner 2 polls only with the recorded native reference;
- accepted status corresponds to the same artifact/request;
- final stapled bytes are distinct, validated, and adopted once;
- no effect-build receipt file/S3 object becomes a peer release history.

If the effect-build release-readiness S3 record contains Apple release facts,
route them through the one Plan-005-selected ts-release JournalStore. If it is
certification evidence only, keep it outside runtime state and document that
distinction. Do not maintain both.

**Verify:** Apple local protocol/fake tests, cross-package codec round trips,
fresh-process continuation, commit-before-ID loss, and credential-free native
mechanics pass. Credentialed acceptance remains Plan 009.

### Step 5: Prove platform and package-boundary portability

Run the exact integration matrix on Linux, macOS, and Windows hosts required by
the scorecard and upstream contract. Each hosted record binds:

- ts-release source SHA;
- effect-build source SHA/package version/tarball digests;
- Bun/Node/tool versions;
- exact case IDs and outputs;
- artifact digests and captured-output digest;
- successful clean consumer/tool oracle.

No checkout-relative path may appear in a durable handoff or report. Verify
packed installs, not only monorepo source.

**Verify:** platform matrix has no unexplained skip and every nonlocal row has an
immutable exact-SHA record at its true evidence level.

### Step 6: Update the ledger and enforce architecture budgets

For all 26 rows, set implementation to local/cross-repository only when the real
package execution and immutable coordinate record exist. Map each implementation
to exact case IDs and package digests. Do not close an `A!`, live provider,
credential, public byte, or clean-consumer facet without its actual oracle.

Record Plan 008 wave results and evidence against the frozen IDs without
changing architecture facts. The integration must not add a second producer
framework, registry, artifact representation, checksum owner, or orchestration
path. Measure marginal source per added producer group; most new capability
should live in effect-build packages and integration fixtures, not ts-release
core.

**Verify:** `bun run check:launch-evidence` reports real implementation witnesses
for every assigned P/Q row and an honest closure count; late MCP/OpenAI/Action
rows remain assigned to Plan 008B. Architecture/core/integration/packed/type/
diff gates pass.

## Test plan

- Exact package admission: wrong digest/version/module/Effect family/Rolldown.
- File/tree/multi-output adoption, canonical decimal size and structured digest,
  shared-content/different-meaning, deterministic tree manifest, mode/symlink
  preservation, and traversal/mutation rejection.
- Clean packed composition for each producer family.
- Independent archive/package/Python/SBOM/runner oracles.
- Apple codec losslessness, response loss, runner-2 query, staple/validation,
  distinct final bytes, and single-journal ownership.
- Cross-host exact-SHA matrix with no silent skips.
- Evidence checker rejects a fixture callback, mutable checkout, or unbound
  package version as implementation proof.

## Done criteria

- [ ] One exact effect-build contract/package set is admitted; Rolldown stays private.
- [ ] ts-release core remains producer-neutral and ordinary composition remains the API.
- [ ] Handoff is lossless for files and trees, multi-output, immutable, and the
      tree/size/digest policy matches the exact upstream codecs.
- [ ] No caller-authored digest/facts projection can masquerade as finalization.
- [ ] All selected producer families execute through real packages and packed fixtures.
- [ ] Apple preserves the complete native reference and one ts-release journal.
- [ ] All 26 formerly missing rows have real implementation witnesses.
- [ ] Every Plan 008 `MIGRATION.json` row is resolved with balanced physical
      deletion/relocation accounting and no package/surface drift.
- [ ] No live facet is falsely closed.
- [ ] Platform, architecture, core, integration, packed, evidence, type, and diff gates pass.
- [ ] One clean terminal candidate is ready as Plan 008B's starting coordinate.

## STOP conditions

- Plan 004 lacks a terminal exact package/contract manifest or its active source
  task still has a writer.
- Exact published/immutable packed coordinates or hosted contract evidence are absent.
- The real API cannot express lossless multi-output finalization without an
  upstream effect-build change; file that change there and STOP.
- Apple requires duplicate ts-release/effect-build schemas or histories.
- A tree result cannot be mapped losslessly without changing the Plan 005
  artifact decision; update that decision through review rather than flatten it.
- Integration requires core provider/tool unions, mutable checkouts, mixed Effect
  versions, credentials, live mutations, or compatibility fallbacks.
- Architecture/marginal budgets fail after two measured redesign attempts.

## Maintenance notes

Future effect-build versions must pass the same exact-coordinate contract gate.
Package names do not imply capability; only the executed, packed, independently
verified result and scorecard mapping do. The artifact kernel remains internal
until a second genuine consumer proves a shared package law.
