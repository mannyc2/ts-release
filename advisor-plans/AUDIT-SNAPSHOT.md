# ts-release improve-audit — session handoff snapshot

> **RESUMED AND COMPLETED 2026-08-01 (second session), still at `6f6d4a1`.**
> Phase 3 done: load-bearing findings re-verified by fresh reads (Tier-1,
> T-G, DX-01/05, SEC-11/12 all confirmed; two calibrations — ARCH-03's
> "silent inversion" downgraded to convention-fragility, SupplyChainVariant
> is NOT dead), operator selected **everything** via AskUserQuestion and
> chose **DELETE NOW** for the distributed subsystem. Phase 4 done:
> **plans/187-201 written** (15 plans), `plans/README.md` updated with the
> wave narrative, status rows, dependency notes, and the
> rejected/corrected/deferred findings ledger. Execution order: numeric,
> except 197 (docs) runs after 200/201. This snapshot is now historical
> reference — the live tracker is `plans/README.md`.

**Written:** 2026-08-01, against HEAD `6f6d4a1` (clean tree, main green).
**Purpose:** self-contained continuation doc for the `/improve:improve` run in
progress, so a fresh session can resume without the original conversation.
**Consent (operator-stated):** this is a defensive audit of the maintainer's
own release tool; SDK users have opted in; the external registries
(npm/PyPI/Homebrew/Scoop/GitHub) all support this automated-publishing usage.

Directory note: this lives in `advisor-plans/` (not `plans/`) because `plans/`
already runs the ts-release plan-wave system with its own README/numbering
(next number ~187). When the operator selects findings to execute, the chosen
plans can be authored as `plans/187+` in that system's format.

---

## 1. Operator decisions already locked (do not re-ask)

From the conventions/distribution/docs program (see memory
`conventions-distribution-program`):

- **D1** apps naming = `ts-release-*`: `apps/release-ts`→`apps/ts-release-cli`,
  root `ts-release-plugin/`→`apps/ts-release-plugin`, package names follow dirs.
- **D2** CLI + Action adopt `effect/FileSystem`/`effect/Path`; hand-rolled
  `CliIo` dissolves. HARD BOUNDARY: `src/drivers` keeps direct `node:fs` with
  its O_NOFOLLOW/O_EXCL/fsync discipline — never "modernize" that.
- **D3** the seeded structural-issue list is agreed but incomplete ("there's a
  lot more") — hence this audit.
- **D4** distribution: plugin → OpenAI + Anthropic `claude-community`
  directories (runbook `docs/skill-distribution.md` is authoritative);
  Action → dedicated mirror repo `mannyc2/ts-release-action` (404 today) +
  GitHub Marketplace + node20→24 bump; CLI → node-runnable npm bin (today bin
  is `.ts` w/ bun shebang, npx-under-Node broken) + the already-configured
  binaries/Homebrew/Scoop/PyPI.
- **D5** total docs/README refactor: sales surfaces outcome-first,
  SPEC/ARCHITECTURE stay mechanism-first, comparative claims verified-only,
  `check:readme` keeps gating snippets.

From the `/improve` AskUserQuestion round (2026-08-01):

- **Sequencing = RESTRUCTURE FIRST**, then ship 0.2.0 from the clean layout.
  (0.2.0 — the whole rewrite — is built but UNRELEASED; latest npm/GitHub
  release is 0.0.7 from 2026-06-29.) README/positioning rewrite still lands
  before the tag; marketplace submissions at the tail.
- **Density = UNPACK** — adopt a mainstream formatter (Biome/Prettier),
  one big blame-ignored reflow, standard tooling thereafter.
- **Taste bar = EFFECT-IDIOMATIC** — Effect ecosystem norms as the organizing
  principle (namespace modules, Schema-first data, layer-shaped everything).
  NOTE: unresolved fork this creates — Effect source uses PascalCase module
  filenames (`FileSystem.ts`); this repo is all-lowercase. The naming plan
  must pick one deliberately. Idiom gaps (hand-rolled where Effect provides
  the capability, plain interfaces where Schema.Class is convention, ad-hoc
  errors vs TaggedError) are first-class findings, not style notes.
- **Deep-audit focus (all four picked):** apply-machine correctness,
  security & supply chain, test-suite quality, scripts/gates/CI.

---

## 2. Audit status

**ALL SIX auditor reports received and vetted** (ARCH, CORRECT, SEC, TEST, DX,
DEP/DOC). Lead re-read the cited lines for every high-severity claim.

One auditor contradiction was resolved by the lead running the command:
TEST-02 claimed `bun test integration-tools.test.ts` exits 0 (silent pass);
DX-03 claimed exit 1 (loud fail). **DX-03 is correct — exit 1.** So the
scheduled Tool-Integrations workflow will FAIL every Monday, not pass with a
green badge. The finding stands either way; the framing is "loud recurring
failure that trains maintainers to ignore the workflow", not "silent hole".

Every finding below was re-read at the cited lines by the lead (this session)
unless marked "unvetted". No secrets found anywhere (`.env`/`.npmrc`
gitignored+untracked; token-shaped hits are detector regexes). No
prompt-injection content. No tracked file is executable.

---

## 3. Cross-cutting themes (these matter more than any single finding)

**T-A. Routine misconfiguration bricks a run, and the only escape
republishes.** The compound of CORRECT-01 + CORRECT-02 + CORRECT-09: a bad/
expired token or a non-zero publisher exit is recorded as `CommitmentUnknown`
(or strands durable dispatch intent), `reconcile`-as-absent lands it in
`FailedBeforeCommit{retryable:true}`, but the `Retry` command — fully
implemented in `transition.ts` — is wired to NO caller, so the state is
terminal. The documented escape (new logical run) rebuilds every operation as
`Pending` and re-dispatches already-committed publishes. This is the headline
operational defect for a tool whose one job is not to double-publish.

**T-B. ARCHITECTURE.md over-claims the machine's safety invariants.** Ironic
inverse of the D5 sales-doc problem: the mechanism docs UNDER-deliver on stated
guarantees. Line 170-171 claims resume revalidates topology and "recorded
output snapshots" — CORRECT-07 and CORRECT-06 show neither is checked. Line 154
"Credentials remain capability values and never enter durable data" —
SEC-04 shows child stderr/stdout (which routinely carries tokens on failure)
IS written into the durable run-ledger. "Every resume revalidates receipts"
is only a self-consistency check, not authenticity (SEC-02). Fixing the code
or correcting the doc is itself a finding cluster.

**T-C. Dead distributed-execution subsystem.** ARCH-01 = CORRECT-12: four
modules (`partition/merge/transfer/trust.ts`, ~330 LOC) + 404 LOC of tests +
four optional `run-ledger/v1` fields are unreachable from every entrypoint.
One decision governs a large deletion OR a security fix — `trust.ts` is
exactly the Ed25519 signer that would close SEC-02, so "wire it up" and
"delete it" are the two coherent options.

**T-D. Symlink/containment discipline applied non-uniformly.** SEC-01 +
SEC-06 + SEC-07 + ARCH-09: the drivers' recorded O_NOFOLLOW+realpath discipline
(correct in `workspace.ts`) is missing on the local write/observe path, the
glob prefix directory, and the API's `within()` run-path check; and path
containment is implemented five different ways of unequal strength.

**T-E. Two validation dialects; the weaker guards the untrusted boundary.**
ARCH-08 + ARCH-04: the public API uses a hand-rolled `exact()` excess-key
checker (7 sites, key lists restated) while the rest of the codebase uses
Schema `decodeUnknown` with `onExcessProperty:"error"`. The CLI and Action
duplicate input decoding and have DRIFTED — the Action accepts malformed
operator `resolutions` the CLI rejects, and those drive the exact
`AssumedCommitted/Absent` overrides the ledger exists to keep honest.

**T-G. Verification theater — the highest-value discovery.** Several of the
loudest safety proofs assert constants or run nothing; a real regression in the
exact properties this product exists to guarantee would not move a single
number. This is residue of the layer demolished 2026-07-31, still claiming
proof. Confirmed by lead:
- **TEST-01 [C]** the 45-cell fault matrix: `FaultStatus` is the single-literal
  type `"passed"` (`fault-matrix.ts:24`), every cell returns
  `status:"passed", credentialLeaks:0, unclassified:0` ignoring its own `kind`;
  the 11 credential/interrupt "controls" are a `.map` of passing literals. The
  test asserts `every === "passed"` — a tautology. Not in any CI chain (DX-04).
- **DX-04/TEST-01 [C]** the one genuine credential-leak assertion lives in
  `run-fault-matrix.ts` (the `REWRITE_FAKE_CREDENTIAL` sentinel), which is in
  NO check chain and NO workflow — `test:fault-matrix` (package.json:67) is
  orphaned.
- **TEST-04 [C-claim]** the "closed environment" proof (child sees only declared
  names) runs only in the untested `check-action-bundle.ts` gate; the fast-suite
  doubles record spawn *intent* (`host-doubles.ts:36-42`, before spawn) so they
  structurally cannot see OS-injected vars — which is exactly how the darwin
  `__CF_USER_TEXT_ENCODING` bug (fixed in 6f6d4a1) escaped to CI.
- **TEST-06 [C-claim]** the crash-durability test (`run-store.test.ts:166-173`)
  writes a truncated prefix to `.killed.tmp` and SIGKILLs, then asserts the
  *real* ledger at a different path is intact — which holds because nothing
  wrote to it. The atomic-write path is never actually interrupted.
- **TEST-09 [C-claim]** credential redaction has zero real coverage; `evidence.ts`
  (the published `evidence_path` artifact) is imported by no test.
- **DX-03 [C]/TEST-02** the weekly integration workflow runs a test file deleted
  in ed0cdd0; command exits 1 (verified).
Lesson ties to memory `first-principles-not-compression`: the maintainer's bar
is real derivation, and this is the inverse — proofs that verify nothing. A
"make the gates real or delete them" wave is arguably the highest-leverage
outcome of this whole audit, and it must precede trusting any green check during
the restructure.

**T-F. Effect-idiom debt (aligns with the chosen bar).** ARCH-03 (three
`Success|Error` unions discriminated by `"_tag" in value`, which the AGENTS.md-
preferred `Schema.TaggedClass` would silently invert), ARCH-10 (25 plain
`new Error` throws in recipes vs the 11 TaggedError classes already defined),
ARCH-06 (12 `as` casts where the apps enter their own library because branded
IDs are `export type`-only), ARCH-11/ARCH-12 (operation taxonomy edited in 9
lockstep sites; shared mutable `CurrentRows` accumulator with implicit ordering).

---

## 4. Vetted findings — leverage-ordered (impact ÷ effort × confidence)

Status legend: **[C]** = lead re-read the cited code and confirmed;
**[C-mech]** = mechanism confirmed, real-world trigger frequency unverified.

### Tier 1 — correctness of the no-double-publish guarantee (do first)

- **CORRECT-01 [C]** `Retry` is implemented in `transition.ts:180-188` but has
  no non-test caller; `ApplyRecovery` (`apply.ts:30`) admits only
  `Resolve`/`Reconcile`. Every `FailedBeforeCommit`/`AssumedAbsent` is terminal.
  Fix: surface `Retry` in `ApplyRecovery`+`ApplyInput`, gated on the existing
  `AssumedAbsent | FailedBeforeCommit{retryable:true}` predicate. Effort M,
  risk MED (mis-gating admitting CommitUnknown would itself double-publish).
- **CORRECT-02 [C]** Durable dispatch intent (`DispatchCheckpoint`,
  `apply.ts:181`) is persisted BEFORE `workspace.verify`/`credential.getPublish`
  (`apply.ts:195-196`). A missing token strands the op as `CommitUnknown` for
  something that never hit the network. Fix S: hoist verify+getPublish above the
  `moved(DispatchCheckpoint)` line. Risk LOW.
- **CORRECT-09 [C]** `commandPublish` (`remote.ts:35-39`) reports every non-zero
  exit as `CommitmentUnknown` and `Effect.orDie`s spawn failure into a defect
  that bypasses the `dispatched()` classifier. Fix M: map pre-spawn failure to
  `NotDispatched{retryable}`, keep `CommitmentUnknown` only for a process that
  actually ran. Risk MED (mis-classify toward "not published" is the dangerous
  direction).
- **CORRECT-03 [C]** Ledger identity vs on-disk path: `newRun.path` is
  caller-chosen (`apply-boundary.ts:76`) and the duplicate guard is
  `existsSync(path)` (`store.ts:116`), but logical-run identity is a pure fn of
  plan+scope+topology. Two `newRun` calls with different paths → two ledgers,
  both `Pending`, both republish. `RunStore.path(dir, logicalRunId)` exists
  (`store.ts:29,108`) but is never called. Fix S, risk MED (on-disk layout +
  CLI/Action arg meaning change).
- **CORRECT-04 [C-mech]** Unrecognized `SupplyChainPublish.profileId` →
  `checkpointIds` returns `[]` (`ledger.ts:44`, open `ProfileId`) → empty
  progress → `assertProgress` early-returns (`ledger.ts:72`) → falls straight
  to `Pass` (`apply.ts:203`). Silent success for a publish that never dispatched.
  Fix S: throw for unlisted id + refuse empty initial checkpoint list for any
  RemotePublish. (ProviderPublish is safe — NonEmptyArray checkpoints.)
- **CORRECT-05 [C]** `materialize` (`apply.ts:85-87`) snapshots inputs of EVERY
  publish op, unfiltered by scope (unlike `entries` at `:252`), so any scoped/
  resumed-subset apply on a multi-target plan dies snapshotting artifacts that
  out-of-scope ops never produced. Also feeds `publishReviewId` over out-of-
  scope material. Fix S (filter by `selected`), risk MED (shifts publishReviewId
  = durable approval identity).
- **CORRECT-06 [C]** ARCHITECTURE.md claims resume revalidates recorded output
  snapshots; `assertOutputs` (`ledger.ts:78-84`) checks only id uniqueness/
  declared, never digest/size. A build artifact changed between apply and
  resume is published with the ledger still attesting old bytes. Fix M or
  correct the doc. Risk MED (would expose real recipe nondeterminism).
- **CORRECT-07 [C]** ARCHITECTURE.md claims topology revalidated on resume;
  `expectedLedger` (`apply-boundary.ts:24-28`) derives scope+topology FROM the
  ledger being loaded, so `assertExpected` (`store.ts:37-43`) is tautological on
  those arms; `prepareResume` reads via bare `readFileSync` (`:89`), bypassing
  `RunStore.load`. Latent today (hash is constant) but load-bearing for T-C.
  Fix S. Risk LOW.
- **CORRECT-08 [C]** Crashed apply strands `${path}.lease` (`store.ts:52-104`):
  `finally`-only cleanup (no SIGKILL/OOM survival), pid written but never read,
  no age/liveness/break path → ledger permanently `Exclusive run lease refused`,
  exactly in the crash scenarios CommitUnknown recovery exists for. Also the
  unguarded `finally` unlink (`store.ts:102`) can mask the body's error. Fix M:
  mtime-bound stale detection + operator override + guarded unlink. Risk MED.
- **CORRECT-10 [C]** `clientReconciliationKey` (required on
  `CatalogPublishRequest`, `services.ts:37`) is read by ZERO dispatch site in
  `remote.ts` — it is a ledger-only token, no on-wire idempotency. The required
  field reads as a guarantee that doesn't exist. Fix S: send as `Idempotency-Key`
  for HTTP, or rename to reflect reconciliation-only. Risk LOW.

### Tier 2 — security / supply chain

- **SEC-01 [C]** Local `Write`/`Pack`/`Digest` (`local.ts:165-183`) do plain
  `writeFileSync` through a possibly-symlinked output path; `outputFacts`
  observes with `statSync` (follows symlinks), not `lstatSync`. A symlink at a
  planned artifact path (a PR can add one) → arbitrary file write with CI
  privileges. Deviates from ARCHITECTURE.md:91-95. Fix S: O_NOFOLLOW opens +
  lstat refusal. Risk LOW.
- **SEC-04 [C]** Child stderr copied verbatim into the durable ledger:
  `local.ts:155` → `apply.ts:69` → `transition.ts:149` → persisted
  `FailedBeforeCommit.failure` (`store.ts:31`); `remote.ts:38` puts publisher
  stdout into `Committed.observedOutcome`. Package managers echo credentials on
  failure paths. Direct contradiction of ARCHITECTURE.md:154. (HTTP path is
  clean — Effect redacts `authorization`.) Fix S: record exit code + bounded
  scrubbed excerpt run through a redactor seeded with the op's
  `environmentNames`. Risk LOW.
- **SEC-05 [C]** npm `registry` and PyPI `repositoryUrl` bypass the strong
  `normalizeProviderEndpoint` HTTPS/DNS/SSRF policy (`current-publish.ts:46-53`)
  that the provider path enforces — they flow unvalidated (`config.ts:113,119`)
  into `--registry`/`--repository-url` argv and `probeUrl`. An `http://` or
  `169.254.*` registry → cleartext creds / SSRF pivot. Fix S: route all three
  through the existing normalizer. Risk LOW.
- **SEC-08 [C]** Durable-plan secret denylist `secretLike` (`validate.ts:66-76`)
  has 3 patterns (ghp_, github_pat_, PEM); the repo's own
  `skill-plugin.ts:21-24` has 6 (adds gho_, xox, AKIA, **npm_** — the primary
  publish target). `release-plan/v6` is committed + artifact-uploaded + hashed
  into PlanId. Fix S: lift the 6-pattern list into one shared module. Risk LOW.
- **SEC-02 [C-mech]** Single-machine resume trusts a recomputable hash, not a
  signature: the authorizing receipt is read from the same ledger file
  (`apply-boundary.ts:23,89`) and accepted if `receiptId === hash(public body)`
  (`approval.ts:107-118`). Anyone who can write the ledger (it travels between
  release.yml jobs as an artifact) mints a consistent receipt naming any
  reviewer/nonce. `trust.ts`/`merge.ts` already do real Ed25519 verification.
  Fix L (key management + durable receipt shape change). Risk MED.
- **SEC-07 [C]** API `within()` (`input.ts:48-55`) never `realpathSync`s, so a
  symlinked directory component inside the workspace passes; the Action's
  `containedOutput` (`commands.ts:35-38`) does it right. Run-ledger/lease/
  snapshots can land outside the workspace. Fix S. Risk LOW.
- **SEC-06 [C]** Glob wildcard-prefix directory handed to `walkFiles`
  (`local.ts:96`) is never realpath-checked; the non-wildcard branch three lines
  down (`:99`) IS. A symlinked workspace dir is traversed into an archive. Fix
  S. Risk LOW.
- **SEC-03 [C]** Publish commands spawn with `cwd:"."` (`remote.ts:35`) —
  ambient cwd, not the plan workspace root; `CatalogPublishRequest` has no
  `root`. Coincides inside the Action (cwd=GITHUB_WORKSPACE) so latent; a
  library caller passing an explicit workspace publishes from the wrong dir, and
  the verified content handle is discarded. Fix M: add `root` to the request.
  Risk MED (.npmrc discovery walks from cwd).
- **SEC-09 [C-mech]** `operation.repository` interpolated raw into
  Bearer-authenticated GitHub API URLs (`remote.ts:69,100,118,152`) while `tag`
  in the same template gets `encodeURIComponent`; schema types it as bare
  NonEmptyString. Request confusion within the fixed api.github.com origin (not
  exfiltration). Fix S: constrain to `owner/name`, encode segments. Conf MED.
- **SEC-10 [C-mech]** No-`files` `Pack` early-returns `declared`
  (`local.ts:113-116`) skipping the duplicate-entry check at `:124`; `entries`
  flattens to `basename` (`:68`). Two same-named outputs in different dirs →
  archive with colliding entries, one silently lost, digest still "verified".
  Fix S: move the dup check above the early return. Conf MED.
- **SEC-11 [C]** `ci.yml:26,53` `actions/checkout@v4` without
  `persist-credentials:false` on a `pull_request` trigger that then builds and
  executes PR-authored source (`check-action-bundle.ts`). Bounded by
  `permissions: contents:read`. Fix S. Risk LOW.
- **SEC-12 [unvetted]** `integration-tools.yml:61,96` `npm install -g` of
  `@openai/codex` and `@anthropic-ai/claude-code` unversioned on a schedule,
  then executed against the checkout. Fix S: pin exact versions. Conf MED.

### Tier 3 — architecture / idiom / dedup (the "Effect-idiomatic" refactor)

- **ARCH-02 / CORRECT-11 [C]** `reviewExecution({topology})` mints a review id
  (`api.ts:57` honors `input.topology`) that `apply` always rejects
  (`apply-boundary.ts:65` uses the bare `topology()` default;
  `mintExecutionReceipt` recomputes and fails "does not match review"). A
  documented public input that can only produce a confusing failure. Fix S:
  reject non-default topology at the review boundary until apply threads it
  (or thread it through `ApplyInput`). Risk LOW. **Real public-API bug.**
- **ARCH-01 / CORRECT-12 [C]** Dead distributed subsystem — see T-C. Fix S to
  delete (4 modules + 4 ledger fields → run-ledger/v2) or L to wire attestation
  into `validateLedger`+`RunStore` (also fixes SEC-02).
- **ARCH-03 [C]** Three `Success|Error` unions discriminated by `"_tag" in
  value` (`validate.ts:154`, `apply.ts:45`, `apply-boundary.ts:116/144`).
  Correctness rests on `RunLedger`/`ValidatedPlanProjection` never gaining a
  `_tag` — but AGENTS.md prefers `Schema.TaggedClass` for durable data, which
  would silently invert all four checks. Fix M: return `Effect.Effect<A,E>`.
- **ARCH-08 [C]** Hand-rolled `exact()` excess-key checker at 7 public-boundary
  sites vs Schema `decodeUnknown{onExcessProperty:"error"}` used everywhere
  else; the weaker dialect guards the only untrusted surface (types unchecked).
  Also `ApplyInput` models newRun/resume as independently-optional → runtime XOR
  + two `!` assertions. Fix M: one Schema.Struct per public input, run selector
  as a tagged union.
- **ARCH-04 [C]** CLI (`commands.ts`) and Action (`commands.ts`) duplicate
  `scope`/`resolutions`/`accepted`/guards; `resolutions` has DRIFTED — Action
  only array-checks then casts, CLI validates fields. Weaker front door admits
  malformed operator overrides of committed/absent state. Fix M: one shared
  input-decoding module.
- **ARCH-06 [C]** Branded IDs (`PlanId`/`OperationId`/review ids/`Stage`) are
  `export type`-only (`index.ts:31-37`); both apps cast (12 `as`), so empty/
  arbitrary argv reaches plan acceptance and receipt minting as a well-typed
  lie. Fix S: export the schema constructors, `check-package-exports` list
  updated. Risk LOW.
- **ARCH-05 [C]** The `node:fs` "secure-open allowlist" (`check-import-rules.ts`)
  enforces file membership, not discipline: `store.ts:46` and
  `apply-boundary.ts:89` read the ledger with plain `readFileSync` (no
  O_NOFOLLOW/fstat) though listed; the latter also duplicates `store.read`
  while bypassing the `RunStore` service (ties to CORRECT-07). Fix S-M.
- **ARCH-09 [C]** Five path-containment impls of unequal strength (`input.ts`
  `within`, `workspace.ts` `beneath`, `local.ts` `containedRealPath`, Action
  `inside`, `primitives.ts` `isSafeRelativePath`); only one resolves symlinks.
  Fix M: one helper with an explicit realpath flag (subsumes SEC-06/SEC-07).
- **ARCH-10 [C]** `src/recipes/` throws plain `new Error` at 25 sites, all
  flattened to one untyped `PlanningFactsError` string via a single
  `Effect.try` (`current.ts:17-30`); `model/errors.ts` already defines 11
  TaggedError classes. Planning is the most user-facing layer. Fix L (additive).
- **ARCH-11 [C]** Operation taxonomy edited in 9 lockstep sites, only 4
  compiler-checked; `mechanismTags` and `isClosedProfilePublish` are plain
  string arrays (the latter widens its param to `{_tag:string}`, discarding
  exhaustiveness) consulted at the dispatch/no-dispatch decision. Fix L, or at
  minimum narrow `isClosedProfilePublish` to `Operation`.
- **ARCH-12 [C]** Shared mutable `CurrentRows` accumulator threaded through 7
  lowering modules, mutated at 34 sites, with a hand-fixed call order that is
  load-bearing via 3 magic output-id strings + a circular
  `current-publish`↔`current-providers` dependency; reordering silently changes
  plan bytes. Fix L (design pass, not mechanical). Conf MED.
- **ARCH-07 [C]** Dead/test-only exports: `normalizeWorkspaceRoot`,
  `stagedOutcome`/`StagedOutcome`, `profileRegistry`+`lowerProfile`
  (test-only, misreads as a live registry), `mechanismTags`, `observedSubject`,
  `SupplyChainVariant`. ~50 lines. Fix S.

### Considered and rejected (by the auditors, recorded so they aren't re-audited)

- Three reconciliation-key fns at `approval.ts:120-160` are genuine duplication
  but produce domain-separated durable hashes; dedup risks changing them.
- `Context.Service` (`store.ts:25`) is correct for beta.83 (module is
  `Context`, not `ServiceMap`, at this pin — verified against `.repos/effect`).
- The plan→materialize and materialize→publish artifact hops ARE bound
  (expectedPlanId re-derivation; publishReviewId recomputed from fresh
  snapshot digests). The action-bundle gate genuinely rebuilds+byte-compares+
  runs under node. `workspace.ts` carries the O_NOFOLLOW discipline correctly.

---

### Tier 4 — tests (verification quality; see also T-G)

- **TEST-01/DX-04 [C]** fault matrix + orphaned credential proof — see T-G.
  Fix: delete the theater or wire real injection into `applyAcceptedPlan`; the
  real interrupt behaviors are already tested in `apply.test.ts:283-325`.
- **TEST-03 [C]** 2,750 LOC of `scripts/check-*.ts` gate code has zero tests; a
  gate bug already escaped (the 6f6d4a1 darwin fix). Each gate should export its
  predicate separately from its `process.exit` wrapper and get a table test
  feeding known-bad fixtures asserting it FAILS. Pattern: `skill-plugin-contract
  .test.ts` already does negative cases. Do import-rules + tree-shaking first.
- **TEST-05 [C-claim]** the "Action-style containment" test re-implements the
  predicate locally and the copy DIFFERS from production
  (`commands.ts:26-32`), which hardcodes the POSIX separator — a Windows
  workspace-escape the test can't see. Export `inside`, delete the copy, table-
  test `".."`,`"../x"`,`"..\\x"`,`"..foo"`(accept),absolute.
- **TEST-06/TEST-09 [C-claim]** crash-durability + credential-redaction theater —
  see T-G.
- **TEST-07 [C-claim]** nothing tests the release.yml shape (plan artifact handed
  across 3 job boundaries, receipts round-tripped through strings); resume tests
  reuse the same in-process object. Add a 3-invocation `runAction` test across
  3 temp workspaces passing only serialized `.release` + string outputs.
- **TEST-08 [C-claim]** archive entry ordering uses `localeCompare`
  (`local.ts:69`, locale-dependent) in one place and a codepoint comparator
  (`:126`) in another for the same archive → non-reproducible bytes under a
  different `LANG`. Use codepoint in both; add a case with paths that separate
  the orderings.
- **TEST-10 [C-claim]** no Windows CI leg, and several Windows host branches are
  already broken (`WorkspaceRoot` brands on `startsWith("/")` vs `isAbsolute`;
  `O_NOFOLLOW`/`O_DIRECTORY` undefined on Windows → anti-symlink flag silently
  vanishes). Decide Windows-as-host: fail fast with a clear message, or add a
  `windows-latest` leg. (Windows is a supported *target*, not *host*.)
- **TEST-11 [C-claim]** durability classification (`syncDirectory` fsync
  fallback, `store.ts:63-77`) is stubbed by every fake and never executed; real
  on tmpfs/containers. Extract errno classification to a pure fn, table-test it.
- **TEST-12 [C]** `check:app`/`check:action` each run ONE shape-only test
  duplicated from the core suite (measured: 1 expect, and 11 substring matches);
  they read as per-surface stages but add nothing. Point them at the real
  `*-cutover.test.ts` and parse `action.yml` for set-equality of outputs.

### Tier 5 — scripts / gates / CI / DX (see audit-dx; aligns with the D1 renames)

- **DX-01 [C]** missing scan roots pass vacuously (`walk.ts:11-13` returns `[]`);
  two declared roots (`apps/*/test`) don't exist and are scanned as nothing NOW.
  60 hardcoded `apps/release-ts`/`ts-release-action` paths + 4 segment-split
  spellings will be silently disabled by the D1 renames unless this is fixed
  FIRST. Add `requireDirectory` that throws; print files-examined count.
  **Blocks D1 — do before any rename.**
- **DX-02 [C]** ~87 of 469 lines in `check-import-rules.ts` guard dirs that don't
  exist (`src/features/`, `src/rewrite/`, tombstoned carriers) — unreachable
  rules presenting as an enforced DAG. Delete; keep the live `directoryDependencies`
  + host/fs rules.
- **DX-05 [C]** bare `tsc -p tsconfig.json` emits 572 files into publishable
  `dist/` (no `noEmit` in the config — only on the CLI at package.json:61). An
  IDE build or a copied command corrupts `dist/` with a second layout + the test
  suite + policy scripts. Fix S: add `"noEmit": true`; drop the no-op
  `bunfig.toml` include; give build a distinct outDir.
- **DX-06 [C-claim]** 87% of gate wall-clock is `src/` type-checked FOUR times
  (16.7s of 19.3s `check:portable`); all 143 tests run in 735ms. No
  `incremental`/`composite`/project-references; no `actions/cache` in any of 9
  CI jobs (cold 208-pkg install ×2 OS). Cache `~/.bun/install/cache`; run
  sub-second policy scripts first; evaluate `tsc -b`. (Fix DX-05 first — composite
  interacts with the emit setup.)
- **DX-07 [C]** three offline release gates (`self-release-doctor/live/artifacts`)
  run only in the dispatch-only release.yml, so a broken plugin path / dropped
  PyPI op / version desync passes CI and fails at ship time. Move them into the
  `release-readiness` CI job (read-only, ~1s each).
- **DX-08 [C]** `check:package-exports` asserts runtime exports against `src/`
  (the bare specifier resolves via tsconfig `paths` to `src/index.ts`), not the
  `dist/` it just built. A `tsconfig.build.json` regression dropping a dist
  export passes. Import `dist/index.js` by file URL.
- **DX-09 [C]** the five check scripts re-implement AST walking / `location` /
  import collection / `isRecord` / JSON parsing (8 raw `JSON.parse` beside a
  165-LOC `strict-json.ts` used twice); two Bun-global detectors with DIFFERENT
  semantics. `scripts/` is the highest-churn area (throwaway gates:
  check-loc/check-effect-imports/… all since deleted). Extract `scripts/lib/ast.ts`
  + `report.ts`. (This is the ARCH-08/T-E pattern on the scripts side; couples
  with the operator's "rederive the scripts layer" option.)
- **DX-10 [C-claim]** the README API example (the package's front door) is
  transpiled for syntax only, never type-checked, though `check-package-exports`
  already has the `createProgram` machinery. Rename an `apply` field and the
  README keeps "passing." Emit blocks to temp files + real program.
- **DX-11 [C-claim]** no watch mode, no pre-commit hook, no gate summary (8-step
  `&&` chains fail one-at-a-time); `check:app`/`check:action` redundantly re-run
  test files the core suite already covered. Add watch scripts; a concurrent
  gate runner with a pass/fail table.
- **DX-12 [C]** onboarding drift: `.env.example` declares a dead
  `TS_RELEASE_CATALOG_TOKEN` (0 refs) and omits the npm token actually used;
  `scripts/README.md` omits half the gates; ARCHITECTURE.md never mentions the
  gate system; `install-smoke.yml` defaults to `v0.0.8` against a 0.2.0 package.

### Tier 6 — dependencies & doc drift (see audit-deps; feeds D4 ship + D5 docs)

- **DEP-01 [C]** Effect is an exact-pinned `dependency`; upstream declares it a
  `^` peer. Every consumer not on exactly beta.83 resolves a SECOND copy of
  effect + 10 transitives, and the documented bring-your-own-layer surface is
  where two instances meet. Move the 3 Effect pkgs to `peerDependencies`
  (`^4.0.0-beta.83`) + devDeps. **Do before the 0.2.0 publish (D4).**
- **DEP-02 [C-claim]** the published `.d.ts` re-exports `effect/unstable/http` +
  `effect/unstable/process` types through `ReleaseServicesLive` (4 dist files);
  the tree-shaking policy already bans `effect/unstable/cli` but not these two.
  At Effect GA those move and every custom-layer consumer breaks. Add the two
  prefixes to `bannedExternalPrefixes`; alias the host-capability types.
- **DEP-03 [C]** `ignoreDeprecations:"6.0"` silences exactly one thing —
  `baseUrl` (removed in TS 7.0) — across 3 tsconfigs, and also disables the
  guardrail for the unrelated import-assertion deprecation. `paths` hasn't needed
  `baseUrl` since TS 5.0. Delete `baseUrl`, rewrite `paths` as `./src/...`, drop
  the flag.
- **DEP-04 [C]** `semver` (+`@types/semver`) is a declared runtime dep with ZERO
  imports; `recipes/packages/tool.ts:50-64` hand-rolls version compare (and
  silently accepts prereleases as stable). Delete both, or route `preflightTool`
  through `semver.satisfies`.
- **DEP-05 [C]** `bun@1.3.14` is written in 11 tracked places, `4.0.0-beta.83`
  in 3 manifests, nothing enforces agreement — a missed CI line tests a
  different runtime than `engines` declares; a partial Effect bump puts two
  copies in the workspace. Add `check:versions`.
- **DEP-06 [C-claim]** vendored `@effect/bun-test` (1,104 LOC, imported by 38
  test files) tracks an UNMERGED upstream PR with a hand-applied patch and no
  in-repo tree to diff against; `.agent-sources/` is excluded only machine-locally
  (a fresh clone shows 39MB dirty). Check npm for a published version; else record
  a re-check date + move `.agent-sources` into `.gitignore`.
- **DOC-01 [C]** SPEC.md §13 (the normative public-surface list) names 6 root
  exports; `src/index.ts` exports 14 runtime values (the 5 service tags, 2 permit
  classes, `ReleaseServicesLive`). README/CHANGELOG document them; SPEC is the
  one doc not updated. Assert SPEC list == index.ts in `check:package-exports`.
- **DOC-02 [C]** the SHIPPED plugin's `verification.md:15-17` tells agents to run
  `bun test test/rewrite/{archive-files,current-recipes,driver-conformance}` —
  `test/rewrite/` does not exist (they're in `test/core/`), so all three fail.
  This is inside the distributed plugin zip. Fix the 3 paths; have
  `check-skill-plugin` assert every referenced path resolves.
- **DOC-03 [C-claim]** CHANGELOG Unreleased claims a `check:audit` gate that
  doesn't exist (only ref in the repo is the CHANGELOG line); the 0.2.0 section
  certifies GoReleaser 107/107+33/33 parity and "Oracle semantic lines" whose
  apparatus was deleted in e3a3a14. Would ship a false claim on the next tag —
  fix before 0.2.0 (couples with D5).
- **DOC-04 [C]** ARCHITECTURE.md:35 declares "no rewrite … namespace" while
  `test/fixtures/rewrite/` is live (4 suites) and `check-import-rules.ts` has a
  dead `src/rewrite/` DAG rule. Rename fixtures; delete the dead rule (= DX-02).

## 5. What was NOT covered (per auditor self-reports)

- Not yet reported: **test-suite quality (audit-tests)**, **scripts/gates/CI
  (audit-dx)**, **deps + doc-drift (audit-deps)**. Re-poll these three.
- Not audited by anyone: `src/plan/compiler.ts` internals, `src/config/`
  decode, `src/view/evidence.ts`, `src/model/canonical.ts` (deliberate core),
  `recipes/{packages,providers,supply-chain}` profile tables, `glob.ts`/
  `archive.ts` algorithm correctness beyond the traced paths, the closed-profile
  publish mechanisms (package-store/supply-chain/provider/SMTP currently refuse
  to dispatch), `vendor/`.

---

## 6. How to resume

All six reports are collected and vetted; findings are in §4 (Tiers 1-6) and
themes in §3 (T-A..T-G). Next steps:

1. Present the consolidated leverage-ordered table to the operator, with the
   direction items (distribution D4, docs D5) SEPARATELY from the bug/debt list.
2. AskUserQuestion: which findings become numbered plans (default: the Tier-1
   correctness cluster + the T-G "make gates real" wave + the DX-01 rename-safety
   prerequisite, plus anything flagged).
3. Recommended dependency spine (given restructure-first):
   **(a) DX-01 + DX-05 gate-integrity fixes FIRST** (else the D1 renames silently
   disable enforcement and bare `tsc` corrupts dist) →
   **(b) T-G "make gates real or delete them"** (characterization tests for the
   apply machine + real gate tests, so green means something during the reflow) →
   **(c) Tier-1 correctness cluster** (CORRECT-01/02/03/09 retry+dispatch+
   identity; ARCH-02 topology bug) — recommend landing BEFORE the 0.2.0 tag
   regardless of restructure-first →
   **(d) formatter + D1 renames + idiom waves** (T-E/T-F/DX-09) →
   **(e) docs D5 + DOC-01/02/03 drift fixes** →
   **(f) 0.2.0 ship (DEP-01 peer-dep + DEP-04 semver first)** →
   **(g) distribution D4**.
4. Write chosen plans in the `plans/187+` plan-wave format (self-contained,
   verification gates, STOP conditions per the improve template), updating
   `plans/README.md`. Record rejected findings there too.

## 7. Auditor reliability notes (for the vetting pass)

- ARCH, CORRECT, SEC, DX, DEP/DOC: high-precision, every spot-checked claim
  confirmed. TEST: one wrong exit-code claim (TEST-02, corrected by DX-03) but
  the underlying findings are sound. General rule holds: re-read each cited line
  before writing a plan from it — several findings are `[C-claim]` (auditor read
  it, lead has not yet re-verified) and need a read before execution.
- Convergent findings to DEDUP when building plans: ARCH-01≡CORRECT-12 (dead
  subsystem); ARCH-02≡CORRECT-11 (topology bug); DX-02≡DOC-04 (rewrite/features
  dead rules); ARCH-05⊂CORRECT-07 (resume readFileSync bypass); SEC-06/07⊂ARCH-09
  (containment impls); TEST-05 overlaps ARCH-09 (containment) + TEST-10 (Windows).

**Note the tension to raise with the operator:** several Tier-1 correctness
bugs (CORRECT-01/02/03/09) are arguably higher-value than the cosmetic
restructure the program started with, and shipping 0.2.0 (even after
restructure) with the "bricks on bad token / can republish" defect live is a
real risk. Recommend the correctness cluster lands before the 0.2.0 tag
regardless of the restructure-first ordering.
