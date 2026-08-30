# Plan 008B: Integrate late providers and hosts into one local candidate

> **Executor instructions:** Start from the exact terminal Plan 008 candidate.
> Execute only the late-provider/host waves assigned by Plan 005. This is the
> single convergence lane before live acceptance; do not merge independent
> provider, producer, or Action branches. No package, export, machine, durable
> format, ownership, or budget may diverge from the freeze.

## Status

- **Priority:** P0
- **Effort:** L
- **Risk:** HIGH
- **Depends on:** Plans 007 and 008 DONE on one sequential ancestry; exact Plan
  008B entries in `WAVES.json`
- **Category:** integration, providers, hosts, packaging, evidence
- **Starting coordinate:** terminal Plan 008 candidate
- **Target branch:** `codex/late-provider-host-integration`

## Why this matters

PR21's accepted implementation order places effect-build producer/trust work
before MCP/OpenAI and first-party Action/self-release work. The old portfolio
allowed provider and producer branches to run in parallel but gave Plan 009 no
defined convergence step. This plan restores the required ordering and emits
one exact local candidate for hosted/live acceptance.

## Scope

In scope:

- MCP Registry publication/discovery/continuation;
- OpenAI skills-only plugin packaging, marketplace Git update, and submission
  handoff validation;
- first-party Action and CLI default wiring using the selected host-owned journal;
- packed Action/library/CLI/external-provider/effect-build consumers;
- self-release planning, intended-byte construction, and non-mutating rehearsal;
- exact late-wave migration/deletion rows and full-program budgets;
- one immutable local candidate manifest for Plan 009.

Out of scope:

- human portal submission or claims that a handoff equals publication;
- live provider/journal deployment, credentials, hosted dispatch, settings,
  push, PR, merge, tag, release, or package publication;
- new providers/outcomes/packages/exports/formats or compatibility peers.

## Step 1: Implement the MCP vertical

Implement the exact MCP owner from `SURFACE.json`. Preserve official manifest
schema, package coordinate, auth/transport facts, discovery/read-back, response
loss, and conservative continuation. Bind D06 facets to stable executable cases
without promoting local evidence to live acceptance.

Resolve all assigned MCP migration rows and delete prototype peers in the same
wave. Core and sibling providers remain unchanged.

## Step 2: Implement the OpenAI plugin/marketplace/handoff vertical

Implement the skills-only plugin artifact, conditional-Git marketplace update,
and strict submission handoff validator. Keep plugin bytes, marketplace Git
facts, and human submission as distinct outcomes. A valid handoff document is
never evidence that a portal submission or approval occurred.

Bind AI01-AI03 and D07 cases/facets. Preserve exact intended bytes, CAS,
response-loss behavior, and positive/negative handoff fixtures. Resolve and
delete all assigned migration peers.

## Step 3: Wire actual CLI and Action hosts

Implement the exact host/runtime entries from `SURFACE.json`. The CLI and Action
construct journal, clock, artifact storage, transports, and approval; consumer
Layers cannot shadow them. Use the exact JournalStore deployment selected in
`SYSTEM.json` and no second history.

Build and execute the actual bundled Action under its declared Node host and
the actual CLI under Bun. Prove fresh-runner continuation, hostile host-service
override rejection, input/output/schema correspondence, immutable action
dependency pins, and absence of Bun-only imports from Node-neutral packages.

Compilation and fake-Layer tests are insufficient.

## Step 4: Prove non-mutating self-release composition

Using real selected ts-release and effect-build packages, construct the intended
self-release bundle/plan/journal/report path in a scratch repository without
crossing a provider mutation boundary. Prove exact source/package/tool
coordinates, intended public bytes, deterministic planning, process-separated
continuation, and host wiring.

Publish operations remain data. Do not dispatch, tag, push, release, or publish.

## Step 5: Generate the one local candidate manifest

Resolve every Plan 008B migration/wave row, regenerate the architecture
projections in check-only mode, and run the full non-live gate vector. Emit a
canonical `local-candidate.json` containing:

- exact source/tree and required/forbidden ancestry;
- hashes of `SYSTEM.json`, `SURFACE.json`, `MIGRATION.json`, `WAVES.json`, and
  `GATES.json`;
- exact ts-release/effect-build package versions and tarball digests;
- Action bundle and intended self-release byte digests;
- executed-case/evidence manifest digests;
- semantic/structural/operational/source totals and marginal results;
- every remaining live/hosted/credentialed open row; and
- the exact Plan 009 gate/authority prerequisites.

The candidate has one sequential ancestry: Plan 006 -> Plan 007 -> Plan 008 ->
Plan 008B. There is no convergence merge.

## Verification

Run the exact Plan 008B vector from `GATES.json`, including:

- architecture/schema/surface/import/migration/budget checks;
- MCP and OpenAI protocol/case/evidence suites;
- real packed library/CLI/Action/external-provider/effect-build consumers;
- Node/Bun host isolation and actual default wiring;
- fresh-runner journal/continuation and hostile host override cases;
- non-mutating self-release intended-byte rehearsal;
- full typecheck/build/test and `git diff --check`.

## Done criteria

- [ ] MCP/OpenAI outcomes use one real vertical each and exact stable cases.
- [ ] A handoff is not mislabeled as publication or approval.
- [ ] CLI and Action execute their actual default wiring with one host-owned journal.
- [ ] Self-release intended bytes and continuation are proved without mutation.
- [ ] Every assigned migration row is resolved and no package/API/import/format
      or budget drift exists.
- [ ] The entire local implementation line is sequential and clean.
- [ ] `local-candidate.json` binds exact source, freeze, package, Action, evidence,
      budget, and remaining-authority coordinates for Plan 009.
- [ ] No remote or external mutation occurred.

## STOP conditions

- Plan 007/008 do not form one sequential ancestry or a merge is proposed.
- A late provider/host requires a package/export/state/format change.
- Host ownership depends on Layer precedence or Action execution uses fake wiring.
- OpenAI work needs human submission or claims unexecuted publication.
- Self-release rehearsal crosses a mutation boundary.
- Migration, packed-consumer, architecture, or budget gates remain red after two
  measured corrections.
- Any remote authority is absent.

## Maintenance notes

Plan 009 accepts exactly the `local-candidate.json` coordinate. Any source,
package, Action, freeze, or evidence change creates a new candidate and reruns
this complete local convergence gate.
