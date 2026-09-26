# Core, host and self-release test retention review

Read-only W5 review, principally R24–R29, with R07/R12/R13/R16 ownership and
runtime constraints. Pre-consolidation baseline:
`f2266bd7065cb1378a1fbf95cc0172c7f1b389e4`, now checked out for the consolidation
at `/mnt/models/dev/ts-release/.test-retention`. No tests, source, scripts,
builds or package outputs were changed or run for this review. Paths/lines below
identify that baseline, before any removals; the recommendations are decisions
to implement and qualify, not claims that those edits already passed.

I read the bodies/assertions of all 30 `.test.*` files in `kernel`, `transports`,
`self-release`, plus `hosts/action.test.ts`; the relevant CLI/native consumers,
kernel fault adapter/evaluator/cache wrappers, and packed/installed owners were
also inspected. This is not the whole suite: provider/artifact/warehouse suites,
every supporting server/worker implementation, and full retained-distribution
setup were not re-audited here. Shared helpers remain subject to their own owner
reviews. File-level rows below group materially distinct scenarios, not merely
similar names. “Keep” means the listed protection has no demonstrated stronger
replacement in this review, not a claim of historical test-first provenance.

## Concrete removals and consolidation

1. **Delete the source Action happy-path case only:**
   `test/reimplementation/hosts/action.test.ts:66`. Its shared fixture, hostile
   ambient inputs, satisfied report, output fields, fresh cache and single-send
   assertions are already exercised by `scripts/check-packed-action.ts:63–139`
   using actual Bun/npm installs, absent optional peers and non-symlink package
   resolution. Keep `hosts/action-application.mjs`, the packed check, source
   path/redaction case at `:94`, and both signal cases at `:132`. The source-only
   literal revision `2` is incidental to the retained output/history contract.

2. **Delete three source wrappers that execute identical installed consumers:**
   `transports/git-runtime.test.ts:62`, `transports/http.test.ts:421`, and
   `transports/http.test.ts:437`. `scripts/check-packed-npm.ts:238–247` copies
   their exact `git-native-consumer.mjs`, `http-wire-consumer.mjs` and
   `http-tls-consumer.mjs`; `:294–311` runs each on Node and Bun inside both
   installer outputs. The TLS certificate's IP-only SAN setup is also identical
   (`:76–101`). Keep all consumer files and the packed `--transports` stage.
   The existing portable profile selects `check:packed-catalog`, whose command
   includes `--transports`; a behavior-only run must not be described as having
   performed the removed native-consumer proof. Do not remove pending-TLS
   interruption (`http.test.ts:482`) or Git process-group cancellation
   (`git-runtime.test.ts:78`): the packed stage does not execute those fixtures.

3. **Consolidate the native crash cross-product, retaining both fault windows:**
   `kernel/process.test.ts:13–16` runs M1/M2/M3 × uncached/cached store ×
   after-append/after-send. M2 is an independent transition evaluator; M3 is only
   `memoizedMachine(historyMachine)` (`kernel/fixtures.ts:29–33` and
   `witnesses/memoized-machine.ts:5–17`). Keep M1 and M2 with both store variants
   and both crash windows. Remove only the M3 copies from this expensive native
   process file, retaining M3 in `observable`, `boundaries`, `errors`,
   `supersession`, and the explicit evaluator-equivalence assertions. Each worker
   creates a fresh cache, and the process test asserts no cache-hit or distinct
   M3 native behavior. This is a bounded redundancy decision, not permission to
   remove independent evaluator or cached-store coverage wholesale.

4. **Remove one redundant positive private assertion if editing its owner:**
   `kernel/dependencies.test.ts:169` calls `verifyNativeEvidence` immediately
   before the public rerun at `:170`, which re-admits that history and proves no
   added send. Keep the snapshot/child-scope assertion because it proves native
   returned-parent propagation. Keep this file's other direct verifier calls:
   they create corrupted chronology and certify the concurrent-parent fixture;
   they belong to the core owner and are not cross-package violations.

5. **Consolidate delivery build ownership, not delivery proof:**
   `hosts/action.test.ts:19` and `self-release/self-release.test.ts:50` each run
   `build:delivery` in a `beforeAll`. That command deletes/rebuilds all package
   outputs and regenerates Action/starter files (`scripts/build.ts:8–20`,
   `scripts/build-delivery.ts:5–57`). The hooks duplicate work and mutate shared
   inputs during a test run. A single serialized existing runner/precondition
   should own delivery generation. Do not simply delete both hooks today:
   `scripts/check.ts` calls `build.ts`, which does not generate the Action, and
   direct test invocations need a documented fresh-delivery prerequisite. No new
   verification framework is needed; retain the actual Action/packed checks.

The parent's current raw run, `/tmp/ts-release-core-error-policy-runtime.log`,
reports roughly 0.724s for the redundant Action case, 2.126s for the Git wrapper,
0.387s for raw HTTP, 0.527s for TLS, and 0.45–0.47s per native crash cell. These are
one run's case timings, not benchmark estimates; they do not measure hook time.
The most expensive reviewed cases are native browser authentication (~32s) and
native npm/GitHub peer runs (~9–14s each). Their expense alone does not establish
duplication: their decisive assertions differ from the packed Git workflow.

## Application, CLI and Action owners

All test paths in this section are under `test/reimplementation/`.

| File/scenarios | Costly failure protected and strongest proof | Decision |
| --- | --- | --- |
| `kernel/application.test.ts:63,73` | Legacy Promise factory errors change compatibility fields; Effect factory throws execute eagerly or evade caller cleanup. The two entrypoints intentionally have different contracts, asserted through exact defect/refusal and lifecycle observations. | Keep both; neither generic Scope behavior nor an installed happy run substitutes. |
| `kernel/application.test.ts:96,117,129,137` | Incomplete/foreign finalized report, missing scope cleanup on success/failure/interruption, or private native import text leaks. Source case additionally checks frozen report and repeated application scopes; packed `portable.mjs:118–146` proves delivery/API composition. | Keep source contract cases and packed smoke; no whole-test replacement. |
| `kernel/application.test.ts:144,171` | Retained caller aliases replace host methods or gain authorization during admission. Exact captured receiver/permission and send counts are asserted. | Keep; installed ordinary paths do not create this mutation window. |
| `kernel/application.test.ts:244,257,270,282,290` | Authentication continues before durable noncommit, loops or exceeds dispatch budget, runs under observe/unauthorized mode, retries an unknown write, or erases a declined challenge. | Keep all distinct outcomes; native browser acceptance covers real wiring but not this whole refusal matrix. |
| `kernel/cli.test.ts:20–91` and `cli-fixture.mjs` | Broken CLI argument/JSON protocol, wrong 0/1/2 status, missing recovery hint, accidental secret stack/message output, stdout contaminated by application logging. Both Node/Bun process runs inspect actual channels. | Keep. The installed workflow checks a real publication path, not malformed inputs or channel separation. |
| `kernel/cli.test.ts:93–124`; `cli-pipes.py:15–60` via `:127` | SIGINT/SIGTERM return before scope cleanup; backpressured output blocks cancellation; closed stdout or FIFO input hangs. Python keeps real pipes unread, avoiding Bun buffering as an oracle. | Keep Node/Bun and both signals. Native polling/watchdogs are OS coordination, not the removed logical-clock sleep cases. The 100ms stabilization in the pipe fixture remains an explicitly unproven timing assumption, not a reason to delete its real backpressure proof. |
| `hosts/action.test.ts:66,94,132` | Happy-path install/resume is duplicated; path/symlink escape, typed/defect diagnostic projection, signal statuses and empty outputs are Action-specific. | Delete only `:66`; keep remaining cases and shared application fixture, as detailed above. Hosted node24 execution remains separate. |
| `scripts/check-packed-action.ts`; `scripts/check-installed-workflow.ts:80–293` | Incorrect installed resolution/optional peers versus broken real Git publication/observation, interruption after actual commit, continuation and completed recognition through CLI/Action. Installed workflow asserts ref contents and exactly two native pushes; packed Action asserts Bun/npm resolution plus one write across fresh caches. | Keep both: same entrypoint, different costly seams and fixtures. |

## Kernel owners

All paths below are under `test/reimplementation/kernel/`. These mostly use an
intentional in-memory provider/store edge for kernel law decisions. They do not
claim native registry protocol compatibility. Core-private imports here belong
to the core owner; exposing extra public APIs or relocating the tree is not
necessary to remove cross-owner coupling.

| File/material scenarios | Costly failure / strongest remaining proof | Decision |
| --- | --- | --- |
| `admission.test.ts:69,91,172,206,238,268,383` | Caller aliases mutate plans, stored dispatch facts, receipt identity across append retry, snapshots during async admission, or request Buffer/header data; callbacks lose admitted immutable classes. Each mutates a different owner/time window and observes preserved facts. | Keep. Basic packed byte copying does not replace these races. |
| `admission.test.ts:110,123,147,300,337,364` | Unknown scope/capability/version bypasses pre-I/O admission; observation overwrites routing; unsafe transport messages become durable; invalid clocks/limits/truthiness gain authority. Exact zero-I/O counters and durable evidence fields are stronger than generic rejection. | Keep all groups, including both secret Error and Unknown response paths. |
| `observable.test.ts:41,68,91,144` (C01–C04) | Dispatch precedes durable start; prepare rejection consumes permission; terminal noncommit cannot retry; absence incorrectly authorizes replay after loss. Current journal/send and later-visible observation assertions cover those laws. | Keep across default/independent/cached evaluators. |
| `observable.test.ts:176,239,280,314` (C05–C08) | Structural replay/risk becomes a general retry, expiry/prior-attempt binding is ignored, contending runs both send, or changed request identity reuses permission. Exact command/basis/fingerprint/send history is asserted. | Keep. Native Git and HTTP tests add adapter proof, not substitute kernel authorization decisions. |
| `observable.test.ts:362,394,422,440,459,478,511` (C09–C15 and equivalence) | Supersession loses late facts; AlreadyRecorded grants permission; invalid DAG/codec reaches effects; instances collide; write-only loss retries; provider Layer shadows host; alternate evaluator accepts impossible history. | Keep distinct scenarios. C13 has no observation capability, unlike C03/C04. Pure `createPlan` DAG assertions in C11 could move outside the evaluator loop on a future edit, but their millisecond cost does not justify a new test split now. |
| `boundaries.test.ts:35` | Identity framing, lexical order or canonical data changes silently. Independent native SHA-256 bytes and explicit malformed syntax/object inputs protect persisted identity compatibility. | Keep direct core-owner proof. |
| `boundaries.test.ts:62,92,164` | Forged Git transport labels gain replay; secrets enter durable facts or rotated secret changes authority; codec/correspondence/false observation admits foreign evidence. | Keep; these are kernel admission rather than native-header/credential acquisition proofs. |
| `boundaries.test.ts:214,274,312,370` | Preparation/publication use separate CAS orders; moved/unknown journal roots or multiple publication plans bypass admission; oversized receipt loses uncertainty; multiple preparations fail to share every revision. | Keep. The one-preparation case also rejects moved/unknown scope and is not fully covered by the two-preparation positive case. Real SQLite bound refusal is distinct from the exact-size adapter test. |
| `dependencies.test.ts:134,149,174,200,221,240,251,270,289,329` | Invalid graph reaches effects; returned parent is reconstructed/lost; future/changed receipt validates earlier child; stale prepared child races parent update; invalid sync callback contract/defect is normalized; captured validator receiver or foreign tagged error breaks. | Keep scenarios. Delete only redundant `:169` positive private verification, preserving following public rerun. The core error-policy Fail/Die cases have current before-fix proof; do not describe all older tests that way. |
| `errors.test.ts:29,57,86,172,222` | Classifier bug is recorded as ordinary malformed receipt; malformed data loses durable fallback; exact versioned native error is lost on SQLite reopen; fabricated noncommit/error grants retry; malformed dispatch identity is admitted. | Keep. Callback Die and malformed typed refusal intentionally require different journal outcomes. |
| `c08.test.ts:22` | A canonical, self-consistent plan for another configured destination/principal/scope reaches even observation on an empty journal. | Keep. `observable` C08 concerns replay drift after an existing dispatch, a different admission window. |
| `transport-preparation.test.ts:13,31,70,110,139,163` | Credential/prepared-send failure creates a start; request/receiver aliases mutate; CAS loss/AlreadyRecorded reuses prepared authority; concurrent preparations both send; Git fallback bypasses HTTP prepare; falsey noncallable capability selects fallback. | Keep. Provider `prepare` rejection in observable C02a is a different owner from transport preparation. |
| `git.test.ts:25–117,119` | Lost acknowledgement permits unconditional replay or overwrites a competitor; receiver replacement takes over native execution. Real reflog, equal command and force-with-lease assertions remain strongest for core transport composition. | Keep competitor/noncompetitor and receiver cases. Installed Git recovery does not inject the same competitor and inspect exact reflog history. |
| `process.test.ts:13–99`, `process-runner.ts` | True OS loss after durable start or actual HTTP write depends on lost workspace/process memory. Real SQLite reopen, process exits and observed remote bytes protect crash recovery; `kernel.ts:19–67` injects at real host ports, not a production checkpoint API. | Keep M1/M2 × cached/uncached × both windows; consolidate M3 repeats as above. Do not remove cache variants on nonexistent proof: the cache comment names `store-laws.ts`/`cache.test.ts`, but no such maintained files were found. |
| `sqlite.test.ts:11,56` | Adapter asymmetrically admits >1MiB history or initializes/migrates a foreign database. Actual DB tampering and preserved legacy row are decisive. | Keep. Packed Bun append/reopen/closed-scope smoke proves installation only, not malformed persistence. |
| `supersession.test.ts:7,50` | An undispatched predecessor disappears, or any prior dispatch is hidden by a new candidate. Exact retained history/unknown-scope/no-extra-send assertions protect both sides. | Keep. Self-release adds application coordinate/candidate wiring; C09 covers late evidence in the old plan. |
| `bundle.test.ts:42,78,105,138,188,219` | Producer removal loses owned bytes; eager copy/collision/symlink/capacity protections fail; wire compatibility allows ambiguous identities; unsafe tree graph or Unicode/link ordering changes upstream identity; FIFO blocks. | Keep all groups. Packed content smoke is narrower. These real filesystem/tree failures are not replaced by `adoption` package compatibility checks without a separate owner review. |
| `content-store.test.ts:7` / `content-store-lifecycle.mjs` | Interruption detaches a real acquired handle or issued write, returns before cleanup, or installs canceled content. The two completion barriers exercise different resource windows. | Keep both; current actual before-fix proof and native settlement assertions justify them. Do not generalize to application Model.read or Sigstore lifetimes. |
| `report.test.ts:18` | Finalized report trusts a lying supplied evaluator, omits provider facts, loses schema roundtrip/frozen history, or binds another Bundle. | Keep owner-private projection test. Application/packed reports do not inject the false evaluator or multi-provider observation projection. |

## Native transport owners

All paths below are under `test/reimplementation/transports/`.

| File/material scenarios | Costly failure / strongest remaining proof | Decision |
| --- | --- | --- |
| `credentials.test.ts:11,44,110,146,188,244,273` | Mixed interruption leaks credentials; returned getter exposes a private typed error; JWT issuer/audience/workflow/time or JOSE/key controls admit forged identity; routes acquire before exact binding; invalid host/origin reads bearer. | Keep all groups. Native RSA tests use real keys/signing, but do not prove live GitHub OIDC exchange or every native UTF-8/JWK exception. Current getter regression has before-fix proof. |
| `http.test.ts:154,180,199` | Native write is acknowledged before journal start or replayed after loss/redirect/body bound/truncation/timeout; post-commit cancellation leaves socket alive. | Keep actual wire modes and restart assertions. Mode-specific refusal is not duplicated merely because all end Inconclusive. |
| `http.test.ts:250,273,316,354,385` | Ambiguous owner or invalid headers/endpoint acquire secrets; credentials overwrite framing/durable headers or use plaintext; aliases replace exact prepared bytes/methods; reads redirect or exchange sends insecure secrets. | Keep. Typed-Fail/no-Die assertions on existing malformed-input rows are necessary for the core error policy. |
| `http.test.ts:421,437,482` | Full raw headers/wire byte bounds and actual TLS secrecy/hostname validation versus pending pre-secureConnect socket ownership. | Delete wrappers `:421,437`; retain exact consumers in packed transports. Keep `:482` and its peer: pending handshake has not reached the normal client's socket ownership yet. |
| `git-process.test.ts:21,49,106` | Wrong native SHA format/hash, leaked scoped repo, ambient config/hooks/TLS/redirect authority, unbounded output or malformed bearer material. | Keep private native-adapter owner tests. Public packed happy path does not corrupt ambient Git configuration or exceed native output bounds. |
| `git-objects.test.ts:20,216` | Rebuilt owned graph loses executable mode/unmanaged or empty trees, includes unreachable/duplicate objects, accepts foreign base or wrong graph, corrupts preserved bytes, or admits unsafe/case-colliding paths and identity. | Keep SHA1/SHA256 graph cases and negatives. Real native Git inspection is the oracle, not a fabricated object server. |
| `git-host.test.ts:19,138` | Deleted builder repo becomes required; multiple scopes/principals cross authority; preflight publishes early, takes changed request or overwrites competing ref; corrupt object set consumes a journal start or credentials. | Keep both format variants and preflight/race group. Packed native consumer lacks these multi-scope and corruption windows. |
| `git-journal.test.ts:38,77,166,205` | Independent caches lose global order, format/size/foreign history is admitted, equal actual pushes both grant fresh CAS, or lost append acknowledgement creates another write permit. | Keep. Native journal CAS/lost-response proof concerns durable permission storage, while installed workflow interrupts the separate publication Git push. |
| `git-runtime.test.ts:10,62,78` | Credential acquisition Fail/throw/Die/interrupt leaks secret; public import/runtime native behavior; descendants survive deadline/interruption or inherit ambient secrets. | Keep `:10,78`; delete `:62` wrapper in favor of identical installed consumer. Process-group proof is Linux-specific (`/proc`) and must not be reported as general Windows/macOS coverage. |
| `native-provider.test.ts:18` / `warehouse-native-host-worker.mjs` | Actual pypiserver/devpi server acceptance diverges across Node/Bun transport + Git journal and process loss; hidden visibility causes re-upload. | Keep both servers and cross-runtime continuation. Provider-only SQLite/pip and packed lightweight consumers do not combine this production native transport/journal seam. Underlying warehouse worker/server implementation was not fully re-audited here. |

## Self-release owners

All paths below are under `test/reimplementation/self-release/`.

| File/material scenarios | Costly failure / strongest remaining proof | Decision |
| --- | --- | --- |
| `application.test.ts:90,142,234` | Cohort order/GitHub dependencies omit required work or producer bytes; re-preparation chooses fresh history after uncertainty; retired candidate is lost when successor opens real Git journal. | Keep. Exact provider-before-core ordering, immutable coordinate history and public `runApplicationEffect` successor projection are distinct from generic kernel supersession. |
| `application.test.ts:282,378,420,458,475` | Public npm reads acquire credentials; application eagerly loads token/config or accepts changed Bundle/Plan/content; changed auth policy/foreign journal leaks token; Local mode bypasses prepared transport/hook. | Keep all groups. Native browser acceptance is the strongest positive wiring proof but does not exercise each early refusal. |
| `application.test.ts:513,527,549` | Private/mixed-version/duplicate cohort becomes publishable; trusted provenance preparation proceeds without approval or under unsupported Bun before trust I/O. | Keep. No signing or actual trust verification is claimed by these refusals. |
| `credentials.test.js:11,143` | Preflight mutates journal/dispatch instead of diagnosing 201/401 exchange, emits token-bearing response fields or arbitrary error codes. | Keep exact zero-write and redaction assertions. This is a deliberately partial credential-edge fixture, not cryptographic/registry acceptance. Ownership debt: it imports npm's private `Native.js` scope helpers; reuse a supported public npm request fixture when available rather than add testing exports or move private APIs to product surface. No deletion justified here. |
| `native-peer.test.ts:77,99,153` | Test routing accidentally reaches unlisted network or accepts untrusted cert; real npm/GitHub provider bytes/DAG fail through HTTPS; process loss after npm or asset commit replays while visibility is hidden. | Keep harness isolation, positive exact-byte case and both loss subjects for now. Retained distribution `check-distribution.ts:194–490` is stronger for the final seven-package candidate, but is a separate clean-candidate profile; this source fixture also varies owner/scope/version. Do not remove these portable proofs merely because the release gate covers similar outcomes. Full fixture consolidation needs its separate owner comparison. |
| `native-authentication.test.ts:42` | Actual CLI/local npm/browser challenge proceeds before durable rejection, changes retried body, persists OTP/URLs/tokens, or repeats completed auth/publication. Real Git journal inspection during polling/publish, HTTPS bytes and fresh CLI invocations are decisive. | Keep despite ~32s run cost. Installed Git CLI/Action and provider-port auth tests do not exercise this compound boundary. Do not replace actual polling transport with a fake success for speed. |
| `self-release.test.ts:87` | Actual seven-package archives/plugin tree/catalog render/provider authoring fail to form one retained nonmutating rehearsal; deleted producers remain required; Node/Bun reports differ; wrong catalog output/source tree/plan identity or authorize input is accepted. | Keep one integration case and its helper `wheel.ts`; the outcome is 28 unattempted operations and empty journal, not live release success. Retained distribution qualifies executed npm/GitHub candidate bytes, not this wider multi-provider nonmutating rehearsal. Consolidate its delivery build hook, not its scenario. |

## Limits and bounded follow-up

The four installed-consumer duplicate removals and M3 process consolidation are
reviewable next edits with named surviving proof. First keep the required packed
transport/Action stages in the existing profile; no new gate or replacement test
is necessary. Source-only runs then intentionally have a smaller scope.

Keep the pure evaluator matrix for now. Fast repeated admission assertions do
not justify rewriting the whole suite. Conversely, do not claim complete cache
law coverage from stale comments naming absent tests, or native provider
compatibility from the kernel's deliberate doubles.

This review found no reason to delete real native timing/cancellation checks as
“duplicate sleeps.” It also does not close the separate Model.read/Sigstore
settlement gap, HTTP cleanup-failure classification, every native parser Fail/Die
case, Windows/macOS behavior, hosted Action execution, or actual hosted provider
acceptance. Existing packed/installed receipts qualify their recorded artifacts
and runtime selection; they do not replace those remaining requirements.

## Credential fixture follow-up (static review on f2266bd)

**Explicit R26/R27 ownership exception, retained in this consolidation slice:**
`self-release/credentials.test.js:7` still imports npm's private `Native.js`.
The following pending repair is not complete, and this review does not claim
that all cross-owner test imports are fixed.

The later `.test-retention` checkout was read only to assess the proposed
cross-owner cleanup in `self-release/credentials.test.js`. The real public
`Npm.definitions(...).prepare` can preserve this test's diagnostic, zero-write
purpose, but it is not a direct replacement for its current 20-line request
double:

- `packages/npm/src/Protocol.ts:69–74` requires owned provenance membership and
  a verifier. `:94–108` reads and structurally validates the exact envelope and
  expected statement before it invokes `VerifyProvenance`. The current `[1]`
  provenance at `credentials.test.js:41` therefore fails before either 201/401
  exchange, even with an explicitly successful verifier port.
- No existing exported trusted request/provenance fixture was found. The
  existing structural envelope helper is local to `npm/auth.test.ts:52–80`.
  Copying that schema into self-release or hand-authoring a private scope would
  exchange one ownership problem for another.
- The smallest honest public path is to share that existing structural helper
  under the npm fixture owner, author the expected payload with public
  `Npm.createProvenance` and its explicit `Attest` port
  (`packages/npm/src/Auth.ts:208–244`), register both artifact bytes in the public
  Bundle access, then use actual `Npm.definitions` with a deliberate
  `VerifyProvenance` fixture. Forbid registry reads as well as the already
  forbidden journal/transport writes. Retain the explicit statement that this
  is structural/credential-port coverage, not cryptographic trust acceptance.
- This adds artifact/attestation setup; it is not less machinery locally. It is
  a bounded reuse repair only if the existing npm helper is shared rather than
  duplicated. The distinct 201/401, one-read, zero-write and secret-free event
  assertions should remain. No production APIs or additional cases are needed.

This assessment is static; no replacement was implemented or exercised. A
dist-tag or token-only request would avoid provenance setup but would weaken the
actual trusted `npm.publish` admission being exercised and is not recommended.

The proposed build-hook consolidation has no additional owner prerequisite:
`scripts/test.ts` can run `build:delivery` once, from the resolved repository
root, before spawning its Bun test child; the delivery script does not call the
test runner. Propagate a failed build exit and retain the selected Node
environment for the test child. Document `build:delivery` as a prerequisite for
direct focused `bun test` calls, since static `scripts/check.ts` builds packages
without generating the Action. This is a runner-precondition change, not a new
verification system.
