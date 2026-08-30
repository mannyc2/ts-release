# Plan 004: Preserve and qualify the active effect-build v0.6 readiness branch

> **BLOCKED — SOURCE TASK STILL ACTIVE. DO NOT EXECUTE YET.** The latest
> effect-build work is an uncommitted overlay owned by Codex task
> `01a05262-ed3f-7653-97fa-80fb81be613c` (“Take over PR 24 release readiness”).
> At the last bounded observation (task revision 76), that task was still
> changing source and validating current GitHub/npm protocol assumptions. It
> had not emitted a terminal path manifest, content hashes, or final gate
> result. Wait for a terminal handoff, then have the coordinating reviewer fill
> and sign the terminal snapshot below before any checkout, fetch, staging,
> edit, or commit.
>
> **Executor instructions:** once unblocked, read this plan and effect-build
> Plans 045–047 completely. Follow the checkpoints in order. A STOP condition
> means stop and report exact evidence; do not copy the superseded `/tmp`
> follow-up, weaken an audit state, synthesize unsupported npm permission data,
> add a fallback journal, expose a credential, or perform a remote mutation.

## Status

- **Priority:** P1
- **Effort:** M after the source task reaches terminal state
- **Risk:** HIGH
- **Depends on:** terminal source-task manifest and preservation; Plan 003 is
  independent. Merged PR24 is sufficient as Plan 005's initial immutable
  architecture input; this plan's terminal delta must be reconciled before the
  Plan 005 freeze. Cross-repository implementation waits for the selected
  `SYSTEM.json`/`SURFACE.json`, not a provisional ts-release landing coordinate.
- **Category:** migration, security, release engineering, tests, developer experience
- **Planned from:** merged effect-build `main`
  `dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc`, 2026-08-30
- **Source worktree:**
  `/Users/cjpher/.codex/worktrees/v060-release-readiness/does-effect`
- **Target branch:** `codex/v060-release-readiness`
- **Current state:** `BLOCKED — source task active; terminal manifest absent`

## Why this matters

This is the `packages/*` work remembered during the ts-release review. It is a
separate effect-build monorepo, not a newer ts-release branch. PR 24's canonical
reconciliation is already merged at `dd39bd6`; the later release-readiness work
now exists only as an uncommitted overlay in the source worktree above. The old
`/tmp/effect-build-pr24` tree and the withdrawn version of this plan predate the
active task and are not implementation sources.

The active overlay has materially advanced the release design: generated
release-certification policy, native Apple construction and receipt validation,
a read-only release-authority auditor, honest npm trust evidence, and a
cross-repository external-operation journal contract. It has also discovered
real external blockers. The next move is therefore not another speculative
implementation pass. It is to freeze the terminal overlay, review and land it
without changing its claims, then execute the separately authorized external
qualification program.

## Outcome

One reviewable effect-build branch that:

1. preserves the terminal source-task work byte-for-byte before staging;
2. keeps the generated 67-operation contract and exact 11-package/42-module
   public projection authoritative;
3. retains the 28-coordinate Apple matrix and one scalar admitted native status
   per tool;
4. keeps Bun as the canonical DMG/PKG lineage and Deno as signed-App coverage;
5. lands a page-complete, read-only authority auditor that pins npm 11.11.0 and
   reports unsupported/unobserved evidence honestly;
6. records the three-way journal ownership split without adding a local
   effect-build journal backend;
7. passes the exact terminal local gate on the final commit; and
8. reports external blockers without deleting secrets, changing settings,
   dispatching protected work, submitting to Apple, or publishing packages.

This plan does **not** authorize fetch/rebase, push, PR creation, merge, GitHub
settings changes, secret deletion, npm-token revocation, credentialed workflow
dispatch, Apple submission, tag, GitHub Release, or npm publication.

## Canonical constraints

- Root effect-build `AGENTS.md`: use Bun; keep Effect beta versions aligned;
  use durable Effect schemas/errors; provide layers at boundaries; treat publish
  operations as data until explicitly authorized.
- The generated contract remains the source of truth for operation/package
  coverage. Hand-edited duplicates or test-only shadow lists are invalid.
- The package topology is 12 package directories: 11 public packages plus the
  private/reservation-only Rolldown package. Rolldown must not silently enter the
  public projection.
- Apple DMG/PKG construction belongs to the Bun product lineage. Deno covers
  the signed-App coordinate; it is not a second DMG/PKG implementation.
- Every Apple tool has exactly one admitted native success status. An array,
  fallback set, prefix match, or future-widening default violates the hard cut.
- `ts-release` owns opaque canonical bytes, durable append/CAS, and recovery
  mechanics for external operations. `effect-build-apple` alone owns the Apple
  schema, submission identity, correlation, and outcome derivation. Generated
  effect-build policy selects requirements; it owns neither persistence nor
  Apple protocol truth.
- There is one primary OIDC-scoped S3 namespace with versioned WORM records and
  exact CAS recovery branches. There is no workspace-local, artifact-only,
  GitHub-ref, or provider-specific secondary backend. Pre-dispatch intent is
  acknowledged before submission; loss of a response never authorizes blind
  resubmission.
- npm 11.11.0 trust-list output does not provide the previously assumed
  permission field. Trust binding and permission evidence remain separate;
  unsupported permission evidence is `unobserved`, never an inferred pass.
- All live authority inspection is read-only and redacted. Repository secrets,
  npm tokens, signing identities, and Apple credentials are never printed.

## Current reviewed state

### Repository and package lineage

- The active worktree is on `codex/v060-release-readiness` and was created from
  exact merged main `dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc`.
- At the last confirmed snapshot, `HEAD` was still that base and all task work
  was uncommitted/unpushed. No remote mutation was authorized.
- PR 24's source reconciliation and the 12-package topology are already in the
  merged base. Do not copy from `/tmp/effect-build-pr24` or replay its 12-file
  delta.
- The contract currently asserts 67 operations and an 11-package/42-module
  public projection; the private Rolldown reservation remains excluded.

### Active implementation reported by the source task

- generated `releaseCertification` policy rather than a parallel hand list;
- Bun-native DMG/PKG construction and Deno signed-App coverage;
- a strict 28-coordinate Apple receipt/aggregate matrix with the reported
  2/10/6/10 partition and scalar per-tool admitted statuses;
- real native Apple construction tests and package-private Notary
  codec/correlation derivation;
- `scripts/release/audit-release-authority.mjs` with hostile/stateful fake
  GitHub/npm boundary tests;
- page-complete GitHub artifact collection without a false `--slurp` model;
- npm client pinning at 11.11.0 and separate trust/permission observation;
- Plan 045 updates, new Plans 046 and 047, and the plan index update; and
- the generic opaque external-operation journal boundary described above,
  without a local effect-build persistence implementation.

### Evidence observed before the terminal task state

- Core/authority focused suite: 15 passing.
- Apple focused suite: 30 passing.
- An earlier full gate reported contract 8/8, type 16/16, unit 160/160,
  Apple 23/23, plus consumer, architecture, lint, and format success.

These are historical lower bounds only. Later reviewer fixes changed code and
tests, and one full-gate session detached without an observable exit code. Do
not use these counts as terminal evidence.

### Known external blockers

- The repository still exposes an `NPM_TOKEN` secret inconsistent with the
  trusted-publisher-only posture. Secret removal and npm token revocation are
  separate destructive authority transitions.
- Live npm auth/trust collection returned E401; npm permission evidence is also
  unsupported by npm 11.11.0 and must remain unobserved.
- No Apple credential set, protected native certification, qualified clean-host
  aggregate, or operational WORM/CAS journal deployment exists.
- Main branch protection is absent and GitHub Release immutability is disabled.
- No commit, push, PR, merge, settings change, protected dispatch, submission,
  tag, GitHub Release, or package publication has been authorized.

## Terminal snapshot gate

The coordinating reviewer must replace this blocked table from the terminal
task handoff. Until every value is exact and independently checked, STOP.

| Field | Required terminal value |
| --- | --- |
| Source task status | terminal `completed`, or quiescent `blocked` with explicit ownership handoff and no live writer |
| Final task revision | **PENDING** |
| Worktree HEAD | expected `dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc`; record exact |
| Branch | expected `codex/v060-release-readiness`; record exact |
| Modified/deleted/untracked counts | **PENDING** |
| Sorted status manifest SHA-256 | **PENDING** |
| Status-with-ignored manifest SHA-256 and reviewed ignored-root disposition | **PENDING** |
| Full-index tracked patch SHA-256 | **PENDING** |
| Untracked path/content archive SHA-256 | **PENDING** |
| Exact changed-path allowlist | **PENDING** |
| Final focused/full gate totals | **PENDING** |
| Terminal blockers | **PENDING** |

The presence of `PENDING` values is an intentional STOP, not permission for the
executor to bless a later arbitrary worktree state. The reviewer must update
this plan from the terminal task evidence first.

## Commands you will need after unblocking

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Contract | `bun run check:contract` | generated contract, 67 operations, 11 public packages/42 modules all agree |
| Type and build | `bun run check && bun run build` | exit 0 |
| Unit/Apple package | `bun run test:unit` | terminal recorded totals, exit 0 |
| Architecture | `bun run test:architecture` | terminal recorded totals, exit 0 |
| Consumer | `bun scripts/test-built-consumer.mjs --built` | all public packages install/import; private Rolldown excluded |
| Full local gate | `bun run verify` | exit 0 with observed terminal result |
| Native Apple | `bun run acceptance:apple` | exact supported native coordinates pass on the qualified macOS host |
| Formatting | `bun run format:check && git diff --check` | exit 0, no output from Git whitespace check |

Use Bun 1.3.14. If dependencies are absent, obtain explicit network/install
authority before `bun install --frozen-lockfile`; do not silently change the
lockfile.

## Scope

### In scope after the terminal gate

- lossless preservation of the exact active overlay;
- review of every terminal changed path against Plans 045–047;
- minimal corrections required by a failing exact local gate, only if they stay
  inside the signed terminal allowlist or are separately approved;
- regenerated contract/policy outputs from their canonical generators;
- local commits on `codex/v060-release-readiness`;
- read-only fake/live authority-auditor execution; and
- an exact-SHA handoff for separately authorized push/PR/hosted checks.

### Out of scope

- copying any source from `/tmp/effect-build-pr24`;
- changing package count, public modules, operation count, or Effect versions;
- implementing the cross-repository journal before Plan 047 and the stable
  ts-release contract are both accepted;
- adding an effect-build-local journal or fallback persistence path;
- printing, rotating, revoking, or deleting credentials/secrets;
- changing trusted-publisher, environment, branch-protection, or Release
  immutability settings;
- protected/credentialed Apple work, npm publication, tag, Release, or merge;
  and
- editing ts-release from the effect-build worktree.

## Git workflow and authority gates

- Work only in the existing source worktree and branch after its owner task is
  terminal and the terminal snapshot is signed.
- Preserve before fetch/rebase/stage/edit. Do not reuse the old `/tmp` tree.
- Local commits are the landing checkpoint; never amend or force-push them.
- A changed live `origin/main` does not authorize a rebase. Preserve first,
  then STOP for an explicit drift plan.
- Push, PR, merge, repository settings, secret/token changes, protected
  dispatches, Apple submission, npm publication, tags, and Releases are all
  separate authority gates.

## Steps

### Step 0: Wait for terminal state and freeze the source overlay

The coordinating reviewer first waits on the source task and updates the
terminal table. The executor then runs, on the host that owns the worktree:

```bash
set -euo pipefail
repo_root=/Users/cjpher/.codex/worktrees/v060-release-readiness/does-effect
cd "$repo_root"
test "$(git branch --show-current)" = codex/v060-release-readiness
test "$(git rev-parse HEAD)" = dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc
git diff --cached --quiet
git diff --check
test "$(git status --short --untracked-files=all | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_STATUS_SHA256_FROM_THE_SIGNED_TABLE
test "$(git status --short --ignored=matching --untracked-files=all \
  | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_STATUS_WITH_IGNORED_SHA256_FROM_THE_SIGNED_TABLE
test "$(git diff --binary --full-index | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_TRACKED_PATCH_SHA256_FROM_THE_SIGNED_TABLE
test "$(git ls-files --others --exclude-standard -z \
  | tar --null -T - -cf - \
  | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_UNTRACKED_ARCHIVE_SHA256_FROM_THE_SIGNED_TABLE
```

Literal `TERMINAL_*` tokens are STOP markers. The reviewer replaces them with
the signed hashes; the executor must never substitute a value observed after
the task handoff.

Create a persistent recovery copy outside the worktree only after filesystem
authority for this exact path is granted:

```bash
set -euo pipefail
repo_root=/Users/cjpher/.codex/worktrees/v060-release-readiness/does-effect
preserve_root=/Users/cjpher/.codex/preservation/effect-build-v060-readiness-20260830
if [[ -e "$preserve_root" ]]; then exit 1; fi
install -d -m 0700 "$preserve_root"
cd "$repo_root"
git status --short --untracked-files=all -z > "$preserve_root/status.z"
git status --short --ignored=matching --untracked-files=all -z > \
  "$preserve_root/status-with-ignored.z"
git diff --binary --full-index > "$preserve_root/tracked-full-index.patch"
git ls-files --others --exclude-standard -z \
  | tar --null -T - -cf "$preserve_root/untracked.tar"
(cd "$preserve_root" && \
  shasum -a 256 status.z status-with-ignored.z tracked-full-index.patch \
    untracked.tar > preservation.sha256)
test "$(shasum -a 256 "$preserve_root/tracked-full-index.patch" | cut -d' ' -f1)" = \
  TERMINAL_TRACKED_PATCH_SHA256_FROM_THE_SIGNED_TABLE
test "$(shasum -a 256 "$preserve_root/untracked.tar" | cut -d' ' -f1)" = \
  TERMINAL_UNTRACKED_ARCHIVE_SHA256_FROM_THE_SIGNED_TABLE
find "$preserve_root" -type f -exec chmod 0400 {} +
find "$preserve_root" -type d -exec chmod 0700 {} +
test "$(git status --short --untracked-files=all | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_STATUS_SHA256_FROM_THE_SIGNED_TABLE
test "$(git status --short --ignored=matching --untracked-files=all \
  | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_STATUS_WITH_IGNORED_SHA256_FROM_THE_SIGNED_TABLE
test "$(git diff --binary --full-index | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_TRACKED_PATCH_SHA256_FROM_THE_SIGNED_TABLE
test "$(git ls-files --others --exclude-standard -z \
  | tar --null -T - -cf - \
  | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_UNTRACKED_ARCHIVE_SHA256_FROM_THE_SIGNED_TABLE
```

Review both NUL-delimited status manifests and compare every non-ignored path
with the signed allowlist. Classify every `!!` path as an expected disposable
dependency/cache root or task-owned output. The terminal snapshot must record
the exact ignored-root disposition. If any task-owned implementation/evidence
file is ignored, STOP until it is moved into the ordinary manifest or given an
explicit separately hashed archive/restore step; the expected dependency cache
must never be copied into the landing commit. Scan filenames and tracked/staged
text for secret patterns without printing matching lines. Any changed path,
unreviewed ignored root, or unresolved filename-only match is a STOP.

### Step 1: Review the terminal implementation, not the superseded draft

Read Plans 045, 046, 047, `plans/README.md`, the generated contract, Apple
implementation/tests, and the release-authority auditor. Confirm:

- generated policy is the only 67-operation/public-package projection;
- the Apple matrix has exactly the documented 28 coordinates and scalar status
  law;
- Bun/Deno responsibilities do not overlap;
- GitHub collection is page-complete and tests multiple pages;
- npm 11.11.0 is installed/pinned before trust collection;
- E401, unsupported fields, and missing permission evidence remain typed
  unobserved/blocking results;
- the fake npm boundary is hostile/stateful enough to reject optimistic local
  assumptions;
- Apple Notary encoding/correlation stays package-private; and
- the journal contract has one owner per fact, uses the one OIDC-scoped S3 WORM
  namespace, acknowledges intent before dispatch, has exact CAS recovery
  branches, and contains no fallback store or blind-resubmit branch.

If prose and code disagree, STOP and return the discrepancy to the source task;
do not choose the more convenient side.

### Step 2: Reproduce the terminal local evidence

Run only after the snapshot is frozen:

```bash
set -euo pipefail
repo_root=/Users/cjpher/.codex/worktrees/v060-release-readiness/does-effect
cd "$repo_root"
test "$(bun --version)" = 1.3.14
bun run check:contract
bun run check
bun run build
bun run test:types
bun run test:unit
bun scripts/test-built-consumer.mjs --built
bun run test:architecture
bun run lint
bun run format:check
bun run verify
bun run acceptance:apple
git diff --check
test "$(git status --short --untracked-files=all | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_STATUS_SHA256_FROM_THE_SIGNED_TABLE
test "$(git status --short --ignored=matching --untracked-files=all \
  | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_STATUS_WITH_IGNORED_SHA256_FROM_THE_SIGNED_TABLE
test "$(git diff --binary --full-index | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_TRACKED_PATCH_SHA256_FROM_THE_SIGNED_TABLE
test "$(git ls-files --others --exclude-standard -z \
  | tar --null -T - -cf - \
  | shasum -a 256 | cut -d' ' -f1)" = \
  TERMINAL_UNTRACKED_ARCHIVE_SHA256_FROM_THE_SIGNED_TABLE
```

Record exact totals and the terminal exit code for every command. The final
`verify` run must complete in an observed session; partial output or a detached
terminal is not evidence. `acceptance:apple` proves only credential-free native
construction/inspection coordinates unless Plan 045 explicitly says otherwise.
It does not prove notarization.

Run the exact fake-boundary auditor tests and read-only live auditor command
recorded by terminal Plan 046. Do not invent flags here while its CLI is still
changing. Expected live status remains blocked unless the external state has
been separately changed: repository `NPM_TOKEN` mismatch, npm E401, and
permission evidence unobserved. A local green suite plus a blocked live audit
is the honest expected combination.

### Step 3: Create the local landing checkpoint

After the exact terminal allowlist, secret review, and gates pass:

```bash
set -euo pipefail
repo_root=/Users/cjpher/.codex/worktrees/v060-release-readiness/does-effect
cd "$repo_root"
git add -- TERMINAL_EXACT_CHANGED_PATHS_FROM_THE_SIGNED_TABLE
git diff --cached --check
if git diff --cached --name-only | rg -n '(^|/)(node_modules|\.env[^/]*|\.npmrc)(/|$)'; then exit 1; fi
if git grep --cached -I -l -E '(BEGIN [A-Z ]*PRIVATE KEY|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-(proj-)?[A-Za-z0-9_-]{20,})'; then exit 1; fi
git commit -m "Qualify v0.6 release readiness"
candidate_sha="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc
bun run verify
bun run acceptance:apple
git diff --check
test -z "$(git status --short)"
printf 'EFFECT_BUILD_READINESS_SHA=%s\n' "$candidate_sha"
```

The literal path token is another STOP marker until the terminal table contains
an exact quoted allowlist. This landing plan creates one checkpoint commit so
the exact-parent assertion remains meaningful. If review requires a commit
split, update the ancestry assertions and regenerate this plan first.

Rerun Plan 046's exact fake-boundary auditor test command after the commit as
well. The recorded candidate is invalid unless that post-commit test and the
commands above all pass without changing the worktree.

Create and verify a Git bundle containing the base and candidate in the
persistent preservation root. This is local recovery evidence, not push
authority:

```bash
set -euo pipefail
repo_root=/Users/cjpher/.codex/worktrees/v060-release-readiness/does-effect
preserve_root=/Users/cjpher/.codex/preservation/effect-build-v060-readiness-20260830
bundle="$preserve_root/effect-build-v060-readiness.bundle"
test ! -e "$bundle"
git -C "$repo_root" bundle create "$bundle" \
  refs/heads/codex/v060-release-readiness
git -C "$repo_root" bundle verify "$bundle"
chmod 0400 "$bundle"
```

### Step 4: Report the exact remaining authority gates

Run the live auditor read-only and store only redacted structured output. The
landing handoff must distinguish:

1. **Local implementation green:** contract, tests, native construction,
   auditor fake boundaries, lint, format.
2. **External evidence blocked/unobserved:** npm authentication/trust/permission,
   repository secret posture, protection/immutability, Apple credentials,
   operational journal, clean-host aggregate.
3. **Mutation not authorized:** settings, secret/token retirement, protected
   dispatch, submission, publication, tags, Releases.

Never summarize all three as “release ready.”

### Step 5: Push and hosted review only under separate authority

If push is not authorized, STOP with the local candidate SHA and preservation
bundle. If authorized, first verify the exact remote URL, confirm the remote
branch is absent or at the expected prior SHA, push without force, and verify
the remote tip equals `candidate_sha`. PR creation is a separate instruction.

Hosted checks must bind the same exact candidate SHA. A successful run on
`main`, PR merge SHA, prior source-task snapshot, or a later status-only commit
is not evidence. Merge remains out of scope.

### Step 6: Execute the external readiness program as separate tasks

After the branch is landed or otherwise accepted, the next program is:

1. Reconcile Plan 047's generic journal contract with Plan 005's frozen
   ts-release journal/host boundary, then implement it only in the selected
   Plan 006-008 ancestry and integrate it with the package-private Apple
   codec/correlation boundary in effect-build. Do not create a second Apple
   representation. Deploy the single OIDC-scoped S3 namespace with versioned
   WORM/CAS records only after its least-privilege policy and response-loss
   tests pass.
2. Obtain authenticated, read-only npm trust evidence with npm 11.11.0. Keep
   unsupported permission evidence unobserved until an authoritative API or
   human-attested source exists.
3. Under separate destructive authority, identify and revoke the exact legacy
   npm token at npm, then remove the repository `NPM_TOKEN` secret. Do not infer
   revocation from secret deletion or delete the only evidence needed to select
   the registry token.
4. Under repository-settings authority, add the reviewed branch/environment
   protections and GitHub Release immutability; rerun the auditor.
5. Provision Apple credentials and run Plan 045's protected clean-host native
   certification through the operational journal. A lost submission response
   must resume/query, never blindly submit again.
6. Only after all evidence is exact-SHA green should a new release plan request
   authority for npm publication, tags, and GitHub Release creation.

Each numbered item is independently authorized and can remain blocked without
invalidating the local landing commit.

## Test plan

- Generated contract: 67 operations, 11 public packages, 42 public modules,
  private Rolldown excluded.
- Apple: exact 28-coordinate partition, scalar statuses, Bun DMG/PKG, Deno App,
  aggregate uniqueness/completeness, credential-free native construction.
- Auditor: multi-page GitHub collection, hostile/stateful npm fake, pinned npm
  11.11.0, E401, unsupported permission, redaction, no mutation.
- Journal design: opaque bytes/CAS in ts-release, Apple schema/correlation in
  effect-build-apple, one OIDC-scoped S3 WORM namespace, pre-dispatch
  acknowledgement, no fallback, response-loss resume/query.
- Package quality: contract, build, type, unit, consumer, architecture, lint,
  format, exact observed full gate.
- Hosted evidence, if authorized: exact candidate SHA only.

## Done criteria

- [ ] The source task is quiescent with an explicit ownership handoff (completed
      or blocked with no live writer), and this plan contains no `PENDING` or
      `TERMINAL_*` marker.
- [ ] The exact overlay is preserved outside the worktree before staging.
- [ ] The local branch descends directly from `dd39bd6`, contains only the
      signed terminal allowlist, and is clean.
- [ ] Generated contract/public projection remains exactly 67 / 11 / 42.
- [ ] Apple remains exactly 28 coordinates with scalar statuses and the accepted
      Bun/Deno split.
- [ ] Auditor tests pass and live blocked/unobserved states are reported
      without optimistic synthesis.
- [ ] `bun run verify`, `acceptance:apple`, and `git diff --check` pass with an
      observed terminal result on the final local SHA.
- [ ] Plans 045–047 and the implementation agree on authority ownership and
      remaining gates.
- [ ] No secret/token/settings change, protected dispatch, Apple submission,
      npm publication, tag, Release, or merge occurred.
- [ ] If push was separately authorized, the verified remote and hosted checks
      bind the exact final local SHA.

## STOP conditions

- The source task has a live writer, lacks an explicit ownership handoff and
  terminal manifest/hash/gate summary, or this plan still contains a
  pending/terminal marker.
- Worktree branch/HEAD/status differs from the signed terminal snapshot.
- The only preservation copy would be inside the worktree or under `/tmp`.
- Any changed path is outside the signed allowlist or contains an unresolved
  credential/secret match.
- The contract drifts from 67 operations or 11 public packages/42 modules;
  Rolldown becomes public without a new product decision.
- Apple coordinates widen, a status becomes plural/fuzzy, or Deno acquires a
  duplicate DMG/PKG lineage.
- GitHub pagination is incomplete, npm is not pinned to 11.11.0, permission is
  inferred from absent data, or E401 is treated as evidence.
- A generic layer owns Apple schema/correlation, effect-build adds a journal
  backend, any fallback store appears, or response loss permits blind submit.
- A test/session result is partial, detached, stale, or bound to another SHA.
- Push/PR/merge/settings/secret/token/dispatch/submission/publication/tag/Release
  authority is absent.

## Maintenance notes

- Keep Plans 045–047 authoritative for their own domains; this plan lands their
  implementation and coordinates later authority, it does not duplicate them.
- Update the terminal snapshot exactly once from the source task final. If the
  worktree changes afterward, regenerate the plan rather than blessing drift.
- The correct headline after local landing is “implementation qualified,
  external release authority blocked,” not “effect-build release ready.”
