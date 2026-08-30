# Plan 006: Implement the selected deterministic release machine as a hard cut

> **Executor instructions:** Read and verify Plan 005's exact freeze artifacts
> before editing. Implement `SYSTEM.json`, `SURFACE.json`, `MIGRATION.json`,
> `WAVES.json`, and `GATES.json`; do not reinterpret them. The preserved overlay
> and PR22 are evidence sources, not ancestors or bulk-copy sources. Stop rather
> than introducing a compatibility spine, fallback representation, second
> journal, provider registry, or extra orchestration owner.

## Status

- **Priority:** P0
- **Effort:** XL
- **Risk:** HIGH
- **Depends on:** Plan 005 DONE with byte-reproducible freeze artifacts and no
  unresolved migration row
- **Category:** architecture, hard cut, security, tests, developer experience
- **Starting coordinate:** exact Plan 005 freeze commit, descended from PR21
  `887a9fe2b35590f3088ffeee84f32722796e03ab`
- **Forbidden ancestry:** PR22
  `c2ac4ee4e7f02d74a7a1ff435bdfeaca6890b720` and Plan 003's overlay evidence
  commit
- **Target branch:** `codex/implement-frozen-release-machine`

## Why this matters

The prior implementation accumulated a pure fold, a separate continuation
decision, and a 1,086-line effectful application loop. That split allowed
correspondence, supersession, host-ownership, and append-boundary defects. It is
a useful counterexample, not the starting architecture.

This plan creates the selected physical package tree and implements one
canonical durable model, one total transition owner, one interpreter, and one
representative end-to-end provider/host slice. Every old or prototype unit is
handled through an explicit migration row, and deletions occur in the same
wave as their replacement.

## Required preflight

From a clean worktree:

1. regenerate all Plan 005 freeze artifacts byte-for-byte;
2. verify their hashes against `SYSTEM.json`;
3. verify required and forbidden ancestry;
4. run `bun run check:architecture-program`;
5. restore Plan 003's PR22/overlay evidence into a separate read-only worktree;
6. verify the exact `WAVES.json` entries assigned to Plan 006; and
7. confirm no Plan 006 migration row is `unresolved` or targets a package/export
   absent from `SURFACE.json`.

The commands and paths come from `GATES.json` and `SURFACE.json`, not from the
prototype's script or directory names.

## Implementation laws

- `ArtifactBundle`, `ReleasePlan`, `ReleaseJournal`, and `ReleaseReport` use the
  exact frozen canonical schemas. Projections never become peer authorities.
- The machine is pure and total for every admitted state/input pair. Time and
  ephemeral observations are explicit inputs.
- The interpreter performs only the command requested by the machine, converts
  results into immutable facts, appends through one CAS path, reloads, and asks
  again.
- A dispatch-capability value exists only after `DispatchStarted` wins CAS.
- Preparation/correspondence precedes observation; append ambiguity is resolved
  by read-back before any possible send.
- Supersession prevents new effects and preserves linked late truth from an
  already-started dispatch.
- Hosts construct journal, clock, artifact store, transports, and approval.
  Consumer Layers cannot provide or shadow them.
- Definitions resolve codecs and operation declarations only; they contain no
  live clients, credentials, hidden closures, Layers, or mutable registry.
- Core contains no provider/effect-build switch, allowlist, or import.
- Runtime exports, declarations, package manifests, bins, and emitted modules
  are exactly the generated `SURFACE.json` projection.

## Scope

In scope:

- exact Plan 006 target packages/modules from `SURFACE.json`;
- exact Plan 006 `retain | move | merge | replace | delete` rows from
  `MIGRATION.json`;
- the canonical models, machine, interpreter, journal law, report projection,
  definitions/composition boundary, and host ownership boundary;
- one representative provider/transport/host vertical selected by `WAVES.json`;
- all 16 architecture traces, property/race/crash tests, packed consumer tests,
  generated surface/import checks, and compression accounting.

Out of scope:

- remaining provider breadth (Plan 007);
- real effect-build producer breadth (Plan 008);
- new scorecard outcomes or architecture changes;
- live providers, hosted mutation, credentials, publication, tags, or releases;
- compatibility readers/aliases not explicitly selected by the freeze.

## Step 1: Materialize the selected package and ownership skeleton

Generate or create the exact workspace globs, packages, app/host locations,
manifests, exports, build order, TypeScript references, and import rules from
`SURFACE.json`. Do not add a package or public subpath for convenience.

Before domain implementation, make these gates executable and red for missing
source, while already green for graph structure:

- package DAG acyclic and actual static/type/dynamic/manifest imports allowed;
- forbidden edges rejected;
- runtime and declaration surface compared with built packed artifacts;
- Effect/version train aligned;
- public/private package set and publish order exact; and
- clean Bun, Node, library, CLI, Action, and external-provider consumer harnesses
  discover the selected packages without workspace symlinks.

Any package-boundary change requires returning to Plan 005; do not repair the
freeze from this branch.

## Step 2: Promote the 16 architecture traces into production contracts

Generate the production contract suite from Plan 005's stable trace IDs. Every
trace must initially point to a frozen product law and expected observation,
not a prototype function name. Include transition-table coverage for every
legal state/command/event combination and explicit rejection for illegal
combinations.

Where lawful prototype behavior exists, compare it through an oracle harness.
Where the prototype is known wrong—host shadowing, correspondence ordering,
supersession, append ambiguity, graph preflight, or journal bounds—the frozen
law is authoritative and the old result is retained as a negative witness.

No test may require prototype ancestry or import prototype modules.

## Step 3: Implement canonical durable values and construction boundaries

Implement the exact schemas and branded IDs in their `SYSTEM.json` owners.
Decode/normalize once at ingress; make invalid combinations unconstructable or
reject them there. Implement explicit storage/transport projections rather than
peer domain models.

For each completed migration row, record gross new lines, deleted lines,
relocated lines, concepts/representations/branches removed, and the gate result.
Moves score zero deletion. Delete replaced old constructors/readers/writers in
the same commit after their consumers cut over.

No durable literal/version may exist outside the generated inventory.

## Step 4: Implement the one total transition owner

Implement the exact frozen transition algebra. It owns:

- complete plan/definition/dependency preflight;
- journal folding and legal event admission;
- readiness, preparation, correspondence, observe/replay/risk/stop decisions;
- CAS append intent and expected revision;
- dispatch authorization state;
- supersession and linked late-outcome law; and
- terminal report projection trigger.

The transition function reads no clock, filesystem, journal, credential,
transport, provider client, global registry, or mutable process value. It
returns one command or terminal report. Initial execution and continuation are
states of the same machine.

Run all 16 traces and deterministic/prefix/report properties after every
transition wave.

## Step 5: Implement the one effect interpreter and CAS path

The interpreter loop is exactly:

```text
load canonical durable inputs
-> ask the machine for one command
-> execute that command through its exact capability
-> convert the result into one immutable fact
-> append through the sole CAS path when requested
-> reload and repeat
```

Preparation, observation, authorization, append, dispatch, and append read-back
are explicit commands/phases. There is one audited dispatch call site. A
dispatch-capability constructor is unreachable until the exact
`DispatchStarted` append wins CAS.

Inject crash/ambiguity at every boundary. Prove no blind retry, no effect after
a CAS loss, exact read-back comparison after ambiguous append, and coherent
late facts after supersession.

## Step 6: Make host and consumer capabilities construction-safe

Implement the frozen host/application API so the host supplies journal, clock,
artifact storage, core transports, and execution approval as explicit disjoint
inputs. Imported applications/providers supply only the capabilities permitted
by `SYSTEM.json`.

Hostile type/runtime/packed tests attempt to provide a duplicate journal,
transport, clock, and approval service. They must be unrepresentable, rejected,
or ignored by construction. Layer merge precedence is not a security boundary.

Execute the actual Bun CLI and bundled Action default wiring; compilation or a
fake Layer is insufficient.

## Step 7: Prove one representative vertical and ordinary composition

Implement the exact representative provider/transport slice selected in
`WAVES.json`. Its provider-local owner contains Intent/wire/result codecs,
operation expansion, preparation/correspondence, native observation,
dispatch/result mapping, recovery law, and host capabilities. The machine sees
only the frozen operation grammar.

Prove:

- full graph/driver preflight before every provider effect;
- provider-native commitment/recovery semantics remain local;
- two configured instances require zero kernel edits;
- a packed external provider unknown to core/CLI composes by ordinary import;
- no sibling-provider or effect-build import exists; and
- clean packed library/CLI/Action consumers execute the actual default wiring.

## Step 8: Execute the hard-cut/deletion and budget gate

Complete every Plan 006 row in `MIGRATION.json`. Delete all superseded core
orchestration, durable peers, public aliases, readers/writers, test-only old
reducers, registry paths, and generated mirrors in the same program. There is
no residual-cleanup wave.

Regenerate the architecture artifacts and run their check-only mode. The freeze
must remain byte-identical except for result/evidence fields explicitly owned
by `WAVES.json`; target architecture facts cannot drift.

Measure semantic, structural, operational, and source results against the
preserved prototype baseline. Require the selected machine-slice budget,
per-wave migration arithmetic, gross marginal targets, exact public surface,
and zero unresolved Plan 006 rows.

## Verification

Run every Plan 006 gate vector from `GATES.json`, including:

- Schema/canonical encoding and all 16 machine traces;
- transition/property/race/crash/hostile ownership tests;
- actual import DAG and mutation-owner scans;
- typecheck, build, package/export/declaration checks;
- clean packed Bun/Node/library/CLI/Action/external-provider consumers;
- exact Effect/version train and private/public package projection;
- migration/deletion arithmetic and architecture budgets;
- existing lawful product oracles; and
- `git diff --check`.

No successful local gate closes a live scorecard row.

## Done criteria

- [ ] The implementation descends from Plan 005/PR21 and from neither prototype.
- [ ] The exact selected package/file/import/public-surface skeleton exists.
- [ ] One canonical durable representation and explicit projections remain.
- [ ] One pure transition owner decides every legal next command.
- [ ] One interpreter, dispatch-authority constructor, and CAS append path exist.
- [ ] Request correspondence, append ambiguity, supersession, and host ownership
      satisfy every frozen trace.
- [ ] One real provider vertical plus a packed external provider proves ordinary
      composition and zero-kernel-edit second instances.
- [ ] Every assigned migration row is resolved and every superseded peer is
      physically deleted; relocation arithmetic balances.
- [ ] Runtime/declaration exports, packages, bins, emitted modules, DAG, and
      Effect versions exactly match `SURFACE.json`.
- [ ] All assigned architecture/core/packed/budget gates pass with no evidence
      inflation or remote mutation.

## STOP conditions

- Any freeze artifact drifts, fails regeneration, or has an unresolved row.
- PR22 or overlay evidence becomes an ancestor or is proposed for bulk copy.
- Required behavior needs a second state machine, durable peer, dispatch path,
  host-owned override, provider registry, or generic commitment assertion.
- An actual import violates the DAG or a package/public surface must change.
- Prototype tests are preserved by weakening a selected law.
- The machine-slice, migration arithmetic, or marginal budget remains red after
  two measured simplification attempts.
- Work requires effect-build breadth, a new outcome, compatibility promise,
  live credential, remote mutation, tag, release, or publication.

## Maintenance notes

Future architecture changes begin by updating Plan 005 inputs and regenerating
the freeze. Plans 007-010, including 008B, extend only the exact `WAVES.json`
program; they may
not create new packages, owners, exports, durable formats, or lifecycle paths.
