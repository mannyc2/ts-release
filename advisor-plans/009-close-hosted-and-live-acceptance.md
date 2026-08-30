# Plan 009: Qualify shipped hosts and close every selected live acceptance row

> **Executor instructions:** This plan contains remote and potentially
> irreversible provider work. A plan is not mutation authority. Before each
> numbered mutation group, obtain same-session authority naming the exact
> repository/account/environment/destination, candidate SHA, coordinates, and
> allowed actions. Run all read-only preflight first. Never print credentials,
> reuse production coordinates for a scratch test, infer success from a local
> double, retry an outcome-unknown mutation without the Plan 006 machine's lawful
> decision, or continue after a STOP condition.
>
> **Drift check (run first):** require Plan 008B DONE and admit only its exact
> `local-candidate.json`. Run `git status --short --branch`, `git rev-parse HEAD`,
> `bun run check:architecture-program`, `bun run check:core`,
> `bun run check:launch-evidence`, and `bun run check:launch-closure`. The
> checkout and all non-closure gates must pass; closure must report the exact
> open set recorded by Plan 008B.
> Any implementation-missing row, unexpected closed row, unreviewed
> candidate change, or active writer is a STOP.

## Status

- **Priority:** P0
- **Effort:** XL
- **Risk:** HIGH
- **Depends on:** Plan 008B exact local candidate; explicit authority packets
  per remote mutation group
- **Category:** release engineering, security, tests, operations
- **Starting coordinate:** exact source/freeze/package/Action/evidence digests in
  Plan 008B's `local-candidate.json`
- **Target branch:** `codex/research-complete-acceptance`

## Why this matters

The preserved prototype ledger closed only 19 of 69 selected outcomes.
Local protocol doubles, packed consumers, and executable case IDs prove design
and implementation, but most provider promises terminate at external services,
public bytes, clean installs, hosted runners, or fresh-process continuation.
Research explicitly forbids relabeling lower evidence as those oracles.

This plan deploys only the journal backends selected in Plan 005, runs the exact
provider/tool/host acceptance portfolio, records credential-free immutable
evidence, and reaches a genuine 69/69 closure. It treats every live mutation as
separately authorized and every response-loss point as a release-machine trace,
not an ad hoc rerun.

## Current state

- `docs/refactor/evidence/launch-evidence.json` is the one-to-one 69-row ledger.
- `scripts/check-launch-evidence.ts` validates structural and, after Plan 007,
  executed-case correspondence.
- `check:launch-closure` invokes `scripts/check-launch-evidence.ts
  --require-closed` and remains intentionally red until every selected
  implementation and exact facet closes.
- `docs/refactor/research/implementation-strategy.md:57-71` defines the ladder:
  compile, process-separated probe, protocol double, scratch provider,
  fresh-public observation, intended bytes, clean consumer, fresh-runner
  response-loss, non-manual self-release.
- `docs/refactor/unblock-status.md:101-140` names the external classes: npmjs,
  Warehouse/PyPI, GitHub, conditional Git/catalogs, official MCP Registry,
  Apple, first-party Action/self-release, and OpenAI handoff limits.
- Plan 005 decides which one JournalStore deployment each host uses. Plan 009
  may qualify those stores; it may not create another canonical backend/history.

## Evidence record law

Every live record under `docs/refactor/evidence/records/` must be strict,
credential-free, and bind:

```text
schema version
scorecard row and exact facet(s)
executed case/command ID
candidate Git commit
SYSTEM/SURFACE/MIGRATION/WAVES/GATES and local-candidate digests
package/source/tool versions and immutable digests
host/runner class
public or sanitized authoritative result locator
captured-output digest
start/end time and terminal result
known limitations
```

Secrets, tokens, OIDC JWTs, authorization headers, private keys, Apple credential
material, and unredacted provider payloads never enter Git, logs, artifacts, or
the journal. A run URL is evidence only when immutable enough for the row's
authority and bound to the exact candidate.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Architecture | `bun run check:architecture-program` | exit 0 |
| Core | `bun run check:core` | exit 0 |
| Evidence structure | `bun run check:launch-evidence` | exit 0 |
| Closure | `bun run check:launch-closure` | exit 0 only at 69/69 |
| Action package | `bun run check:packed-action` | exit 0 |
| Effect-build integration | `bun run check:effect-build-integration` | exit 0 |
| Diff | `git diff --check` | exit 0 |

Provider-specific commands, coordinates, and account identities must be written
into a reviewed authority packet before execution; do not invent them here.

## Scope

**In scope after exact authority:**

- selected JournalStore infrastructure and conformance
- disposable/scratch provider coordinates and repositories
- protected hosted workflows at the exact candidate SHA
- public read-back, byte download, and clean-consumer checks
- immutable credential-free evidence records and ledger updates
- non-manual ts-release self-release required by K03

**Out of scope unless separately named in an authority packet:**

- existing production package/version mutation
- deleting or moving tags/releases/packages, force pushing, destructive cleanup
- changing organization/repository security settings, secrets, branch
  protections, npm trust, cloud IAM, or Apple identities
- human OpenAI portal submission/review
- changing product scope, architecture, provider law, or Effect version

## Git workflow

- Branch: `codex/research-complete-acceptance`
- Freeze `candidate_sha` before any live run. Source changes invalidate all later
  evidence until gates and authority are refreshed.
- Evidence-only commits may be added after a run, but they create a new Git SHA;
  records must keep the tested source SHA distinct from the evidence commit.
- Do not push, create PRs, merge, dispatch, tag, or publish without exact authority.

## Steps

### Step 1: Build and approve the acceptance/authority matrix

Generate `docs/refactor/evidence/acceptance-matrix.json` from `WAVES.json`, the
scorecard, current ledger, and Plan 008B local candidate. For each open facet
record:

- exact row/facet and external oracle;
- fixture/product and unique coordinate;
- read-only versus mutating commands;
- account/repository/environment and runner OS;
- credential type/name only, never value;
- journal backend and release/plan identity;
- expected provider state before/after;
- response-loss injection point and lawful continuation expectation;
- cleanup/retention policy;
- authority packet ID and state: unrequested, approved, expired, executed.

Group mutations no more broadly than:

1. journal infrastructure/deployment;
2. npm trusted publication/tag operations;
3. Warehouse/PyPI and compatible index operations;
4. GitHub tag/release/assets;
5. hosted conditional Git/catalog repositories;
6. official MCP Registry;
7. Apple signing/notarization;
8. Windows signing identity, if required;
9. first-party Action and ts-release self-release;
10. repository/npm/cloud governance changes, each separately.

Read-only public observations may run without mutation authority. Any packet
with an ambiguous destination, reused version, missing expiry, excessive scope,
or absent rollback/retention statement is invalid.

**Verify:** a checker maps every open facet to exactly one finite acceptance
case and reports zero unauthorized executable mutation.

### Step 2: Qualify each selected journal deployment

For the Bun CLI, run SQLite conformance on Linux, macOS, and Windows local
filesystems: atomic append, read-after-success, two-process winner, crash before
commit, ambiguous result reconciliation, corruption, explicit state path, and
unsupported network-filesystem refusal/documentation.

For the first-party Action and effect-build release host, deploy only the
Plan-005-selected backend(s). If Git-ref is selected, prove permissions,
distinct-writer CAS, same-target/no-op handling, response-loss readback, bounded
size symmetry, retention, and two fresh hosted runners. If S3 is selected for a
deployment, prove conditional create/CAS, immutable/versioned event segments,
WORM/Object-Lock policy where required, OIDC least privilege, acknowledgement
and exact reread, response-loss branches, retention, and no fallback.

One release selects one store. Never mirror live facts to Git and S3 as peer
authorities. A failed/ambiguous journal append cannot authorize provider send.

**Verify:** JournalStore law suite and hosted two-runner records pass for every
shipped deployment; no unselected backend appears in first-party docs/config.

### Step 3: Run npm and Python-index acceptance

Under exact packets, use unique versions/packages/projects and the planned
three-public-plus-one-private and four-file fixtures.

For npm prove:

- native exact tarball publication and initial tag;
- GitHub OIDC trusted publishing/provenance and no legacy token path;
- later dist-tag movement;
- plural workspaces and private omission;
- public packument metadata/integrity;
- exact downloaded bytes and three clean installs/import/bin runs;
- response loss followed by observation and no blind resend.

For Warehouse/PyPI and compatible indexes prove:

- uv_build and poetry-core wheel/sdist production;
- per-file trusted publication and four-file partial progress;
- Simple API metadata, intended bytes, and clean pip install/import;
- selected pypiserver/devpi compatibility boundaries;
- conflict/duplicate and response-loss continuation without universal replay.

Never reuse a released version to manufacture a duplicate-success test.

**Verify:** all D01/D02/K02 required facets have exact external records and
public/clean-consumer byte correspondence.

### Step 4: Run GitHub, conditional Git/catalog, and MCP acceptance

In disposable repositories/coordinates prove:

- annotated tag/ref, draft release, zero/three assets, publish transition,
  exact public asset bytes, partial progress, and response-loss paths;
- conditional Git one/two-path atomic commits with expected-old CAS, lost
  response readback, and hosted two-runner contention;
- Homebrew formula and Scoop manifest consumer validation/install for exact
  public bytes;
- official MCP Registry manifest/auth/publication/read/discovery and honest
  continuation.

Use the Plan 007 executed case IDs. Provider responses and public reads are
native facts; do not map all 2xx/conflicts to one generic result.

**Verify:** D03-D05, D07, AI02, and relevant K02 facets have exact records at
their named oracle levels.

### Step 5: Run producer/tool platform and Apple acceptance

Use the exact Plan 008 package coordinates and fixture portfolio. Complete all
remaining Linux/macOS/Windows build, format, signing, SBOM, runnable-target, and
clean-consumer oracles for P/Q rows. Bind every result to exact input/output
digests and tool versions.

For Apple, under a dedicated protected packet and qualified journal:

1. build exact arm64/x64 App/DMG/pkg inputs;
2. sign with the selected Developer ID identities;
3. durably record pre-submit dispatch;
4. submit exact bytes;
5. record the full native submission reference/status;
6. inject runner loss before and after local response recording;
7. continue on runner 2 using the recorded reference only;
8. staple, validate, run Gatekeeper/codesign/pkgutil oracles;
9. adopt exact distinct final bytes and prove clean-host behavior.

If Apple may have accepted but no authoritative correlation ID exists, record
inconclusive and stop. Never resubmit based on observed absence.

**Verify:** all P/Q row facets close with true platform/tool/provider records;
Apple response-loss traces preserve one journal and one remote submission.

### Step 6: Run the packed Action and non-manual self-release

Freeze and review the exact Action bundle/metadata at `candidate_sha`. In a
scratch repository prove Node 24 execution, application import, selected remote
journal, exact bundle/plan identities, fresh-runner continuation, and injected
interruption at every dispatch boundary.

Only after scratch success and a separate self-release authority packet, run the
first-party Action to release ts-release through the same machine. It must use
the exact finalized public package/assets/catalog bytes, preserve fresh-runner
history, perform clean install/import/bin checks, and reach a truthful terminal
report without a parallel manual publication workflow.

Self-release authority must name the exact version, tag, repositories,
registries, candidate SHA, workflow, environment, and permitted mutations. It
does not imply final release/governance changes beyond that packet.

**Verify:** K03 and remaining K02 facets have scratch and self-release records;
public bytes equal the bundle and the Action/YAML owns no second lifecycle.

### Step 7: Close and independently audit the 69-row ledger

Update each row only from its exact executed case and immutable record. Run the
ledger checker and produce a machine summary by family/facet/evidence level.
Then assign an independent reviewer to sample every closed row and fully review:

- all `A!` rows;
- every response-loss/continuation row;
- all credential/trust/signing rows;
- K02/K03 and Apple P10;
- every record whose locator is not publicly readable.

The reviewer checks source SHA, command, case ID, output digest, public bytes,
credential redaction, and evidence-level correctness. Any unsupported claim
reopens the row.

**Verify:** `bun run check:launch-evidence` and
`bun run check:launch-closure` both exit 0 and report exactly 69/69 closed;
architecture/core/packed/integration/diff gates remain green.

## Test plan

- Full JournalStore conformance on each shipped deployment and host.
- Two-runner races, append ambiguity, response-loss, and every dispatch-boundary
  interruption.
- Scratch provider matrices for npm, Python, GitHub, Git/catalogs, MCP, Apple.
- Exact byte/public metadata/clean consumer checks.
- Full effect-build OS/tool matrix with immutable package coordinates.
- Packed Action scratch run and non-manual self-release.
- Hostile evidence records: stale SHA, wrong facet, missing case, secret-shaped
  output, mutable URL, wrong digest, lower-level oracle.
- Independent closure audit with reopened-row behavior.

## Done criteria

- [ ] Every open facet has one reviewed authority/acceptance case.
- [ ] Every shipped journal deployment passes its exact law and hosted race tests.
- [ ] All external provider/tool/platform/consumer oracles ran at exact candidate coordinates.
- [ ] No response-loss case blindly repeated a mutation.
- [ ] Apple uses one submission and one ts-release release journal.
- [ ] Packed Action fresh-runner and non-manual self-release evidence is exact.
- [ ] Every live record is credential-free, immutable, and semantically bound.
- [ ] Independent review found no unsupported closure.
- [ ] Both evidence gates report 69/69 and all architecture/core/package gates pass.

## STOP conditions

- Exact authority is absent, expired, broader than needed, or names a different candidate/destination.
- Preflight finds existing/reused coordinates or unexpected remote state.
- Credentials, security settings, journal infrastructure, or runner class differ
  from the reviewed packet.
- A journal append/storage outcome is ambiguous and exact reread cannot reconcile it.
- A provider outcome is unknown and the machine does not lawfully authorize replay.
- Evidence would contain a secret or rely on a mutable/nonexact locator.
- A required live oracle is unavailable; keep the row open rather than substitute a double.
- Any source change occurs after `candidate_sha` is frozen without restarting
  affected gates and authority review.

## Maintenance notes

Keep disposable coordinate and evidence retention policies explicit. A 69/69
certificate is valid only for its exact source/package/tool/host coordinates;
later releases rerun the affected cases rather than inheriting provider truth
indefinitely.
