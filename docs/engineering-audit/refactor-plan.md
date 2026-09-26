# Revised ts-release refactor plan

> Historical engineering research snapshot, captured on 2026-09-26 before the current implementation milestone. Baseline findings, counts and proposed work describe that captured state; they are not current completion claims. See [current implementation status](implementation-status.md) for the bounded milestone, actual verification and remaining work. These are task research documents, excluded from published packages.

Research-stage status: proposal following the deeper engineering audit. This supersedes the
earlier claim that a three-component patch adopted Browserbase/Reactor standards.
No additional runtime implementation was part of that research pass. The later implementation follows only a bounded portion of this plan; [implementation status](implementation-status.md) records its extent.

Read the [requirements](requirements.md), [concrete gaps](ts-release-gap-audit.md)
and [incident mapping](incident-to-plan.md) with this plan. The earlier patch is
retained for review, not accepted wholesale. The target remains 0.4.2 main
`fa50ce3` and its current public/durable contracts; the old architecture-program
branch and retired research framework are not the implementation starting point.

## Target architecture and explicit keep decisions

Keep one release authority: the kernel admits the Bundle/Plan/journal and grants
dispatch from durable facts. Providers own their domain codecs, exact request
construction and evidence interpretation. Transport/storage adapters own native
resources. Applications choose providers, credentials, storage and approval.
CLI and Action own process execution and presentation.

The change is to make those existing responsibilities explicit, well typed and
enforced. It is not a new service framework.

| Existing area | Target decision | Preservation constraint |
| --- | --- | --- |
| Pure identity, canonical JSON, DAG and history decisions | Keep as ordinary pure functions; improve typed boundary inputs. | Stable bytes, digests, duplicate-key/number rules, historical journal laws. A low-level bounded parser is not replaced merely because it has manual parsing. |
| `Host` and provider contracts | Keep the single per-invocation authority; deepen construction where the inventory exposes hidden requirements. | Capture mutable callbacks/receivers and admitted provider tables as today. Do not add a second registry or give providers dispatch permission. |
| Content, journal and transport ports | Keep meaningful public value boundaries; introduce/capture Effect services only where a repeated runtime dependency is actually hidden. | Explicit per-release content/candidate values remain arguments. Preserve generic E/R and platform-neutral core imports. |
| Native HTTP, process, Git and content adapters | Evaluate existing Effect capabilities before retaining custom mechanisms, one adapter at a time. | No implicit retries/redirects, exact wire bodies, process-group cleanup, file installation/fsync and uncertainty semantics. A replacement must prove these properties. |
| Provider `unknown` evidence | Keep at the open plugin admission boundary; decode before internal interpretation and avoid repeated structural discovery. | Dynamic provider codecs are a real boundary. Do not add a universal provider-data model or falsely remove extensibility. |
| Application, CLI and Action runtime | Compose Effects internally; select runtime/layers at the host boundary; preserve public compatibility adapters deliberately. | The Action must resolve the application's installed core because native Git authority identity depends on that instance. Do not bundle a second kernel to satisfy a static-import preference. |
| Tests and qualification | Retain the strongest existing real-public-boundary proof; remove or consolidate incidental tests only after a failure/proof review. | Crash windows, no-replay, CAS races, owned bytes and installed consumers require independent protection. A test is not dispensable merely because it uses a fake, nor valuable merely because it is native. |

## Sequence and dependencies

`W0 → W1 → W2 → W3/W4 → W5 → W7` is the standards path. W3 and W4 may be
implemented as independent vertical changes once their shared contracts are
settled. W6 contains separate product increments; urgent recovery/observation
work need not wait for unrelated stylistic cleanup, but must meet the same
boundary/proof rules. No branch should combine a toolchain migration, all
provider rewrites and new release behavior into one review.

For every code increment, first list its changed observable outcomes, existing
proof and specific proof gaps. If a new automated test is necessary under
R24/R25, write and demonstrate its failure before the corresponding fix. The
later test-consolidation wave does not postpone this obligation.

One integrator owns shared schema/error/export changes and the combined diff.
Parallel contributors use disjoint owners or isolated outputs; build, pack and
native qualification stages that mutate the same checkout's outputs run in
sequence. Independent green results must not qualify a mixture of artifact bytes.

### W0 — Establish the actual baseline and disposition of the earlier patch

**Requirements:** R01–R04, R15, R24–R25. **Owner:** repository maintainer/reviewer.

- Preserve the three earlier implementations separately from the new standards
  work: application composition, content lifecycle and credential cancellation.
- Use the new source inventory and requirement ledger to review each. Keep
  demonstrated behavior fixes; rework architecture/style mismatches with their
  owning wave. Do not infer compliance from 356 passing tests.
- Audit added tests case by case. Retain expensive type-inference protection
  where compiler checks are the appropriate proof; retain native cancellation
  isolation only for a demonstrated race not adequately proven by the installed
  workflow. Reconsider module mocks, 20 ms sleeps, private handle counts and
  duplicate cases. Do not manufacture retrospective red-green provenance.
- Record the exact old/new public behavior of factory throws. Decide whether
  the existing Promise adapter should preserve compatibility while the new
  native Effect API keeps defects. That is a public behavior decision, not a
  formatting fix.

**Exit:** a keep/rework/defer decision for every earlier implementation/test
change, reconstructible source identity, and no unexplained change to the
release laws. This review was pending when the plan was written and is now recorded in [W0 checkpoint disposition](w0-checkpoint-review.md); that disposition does not imply completion of later waves.

### W1 — Make the engineering contract real and qualify its tools

**Requirements:** R02–R04, R17–R19, R22–R24, R30–R31. **Depends on:** W0.

**Files:** add tracked root `CONTRIBUTING.md` and an agent entry guide; update
the root `AGENTS.md` ignore rule intentionally, `package.json`, lockfile,
TypeScript/lint/format configs and the existing check script.

1. State library, native adapter, application, tool and test policies separately.
   Reference version-matched Effect guidance, the architecture audit method,
   test necessity/failure-first rules, simplification and actual final gates.
   Record a per-project compiler/rule matrix, including strict control-flow
   options, Schema constructor/numeric-refinement policy, direct yieldable
   errors and zero-argument Effect values, with justified exceptions.
   Do not import a broad skill bundle or retain a dependency on another repo's
   disposable checkout.
2. Qualify a supported TypeScript/`@effect/tsgo`/Oxlint/tsgolint tuple in an
   isolated development-tool experiment against the existing rc.115 runtime,
   declarations and Bun execution. Browserbase/Reactor's known tuple includes
   TypeScript 7.0.2 and tsgo 0.45.0; it is a candidate, not a tested ts-release pin.
   Upstream now documents 0.46.0 separately. Read the exact selected release's
   compatibility table rather than mixing newest components.
3. Prefer one Effect diagnostic authority (patched compiler as in Reactor),
   with type-aware Oxlint for the remaining strict rules. Verify patch presence
   after frozen installation, including the behavior of `--ignore-scripts`.
   Stock tsc silently omitting diagnostics must not count as a valid check.
4. Capture a classified baseline of real diagnostic findings, then fix them in
   owning modules. No blanket suppression, `skipLibCheck` relaxation, unsafe
   assertion replacement or config exclusion to obtain green. Temporary
   rollout status must say incomplete; full adoption requires a clean gate.
5. Keep Bun for installation/scripts/tests and the current formatter unless a
   measured integration need justifies replacing it. Peer Vite+/Vitest choices
   are not automatically ts-release requirements.

**Proof/exit:** clean frozen install, actual patched version confirmed, intended
warning/error severities fail the gate, library/test/native overrides resolve
as documented, and the selected tool tuple compiles actual packed declarations.
At this research snapshot, the compatibility experiment had not run; see [implementation status](implementation-status.md) for subsequent qualification.

### W2 — Enforce ownership and runtime closures; select proof before edits

**Requirements:** R05, R09, R19–R21, R24–R29. **Depends on:** W1 tool qualification.

**Files:** `scripts/check-import-rules.ts`, package/app tsconfigs and scripts,
existing export/packed checks, and test ownership metadata or paths as needed.

- Register the actual package/host boundaries. Extend the existing AST checker
  for upward dependencies, runtime cycles, case-correct resolution and
  nonliteral loads. Under `verbatimModuleSyntax`, inline type-only specifiers
  emit an empty runtime import and remain runtime edges; declaration-level
  `import type`/`export type` declarations are erased. Inventory dynamic loads and name their exact permitted
  owner rather than retaining a global exemption. No existing runtime cycle
  was established by this audit; its historical graph omitted inline type-only
  runtime imports. This is an enforcement gap, not a demonstrated cycle incident.
- Give entries explicitly claimed portable a host-neutral compiler closure;
  intentionally native provider packages, Node/Bun adapters, CLI and test
  projects receive their declared host types. Do not newly promise browser
  portability for npm/Sigstore, native archive or other native provider code.
  Avoid broad root ambient types proving a false portable contract.
- Keep explicit export maps; compare declaration/public source names and
  validate all package dependencies in existing isolated consumers. Extend
  current checks rather than restoring retired API-projection/research gates.
- Inventory import-time I/O, environment reads and registration across every
  public entry. Prove optional native/testing dependencies remain absent from
  installed consumers whose contract excludes them. Compile affected maintained
  examples/templates against packed declarations, or explicitly scope/retire
  unsupported examples; source aliases cannot supply that proof.
- Map every retained test to its owner and concrete failure. Separate package
  behavior from genuinely cross-package CLI/release acceptance. Use supported
  exports across packages; private fixtures stay private. Remove unnecessary
  checks before adding public testing APIs or another runner.

**Proof/exit:** every active source/entrypoint belongs to a checked project,
ownership rules cover type/runtime edges, all computed loads have narrow
decisions, package consumer closure passes, and changed work has a documented
cheapest sufficient proof. Tool-rule negative controls are added only where
needed to prove the newly enforced rule; not a duplicate architecture harness.

### W3 — Repair data and error boundaries by vertical slice

**Requirements:** R08–R10, R15, R18, R35. **Depends on:** W2; repeat proof selection.

**Start:** `internal/Error.ts`, `Http.ts`, `platform/GithubOidc.ts`, then npm
authorization/evidence and the other providers in inventory order.

- Separate expected decoder/domain refusals from unexpected exceptions in
  `attempt`/`makeDataBoundary`; preserve known failure values without broad
  cross-package `instanceof` assumptions. A callback bug must not become
  `invalid-data` or `false` without an explicit projection policy.
- Keep credential redaction as a reviewed exception, including mixed interrupt
  causes. Retain safe CLI codes/messages while improving internal distinctions.
- Move known remote object shapes to schemas with appropriate provider-field
  tolerance and cross-field invariants. Keep bounded lexical walkers before
  decoding where their byte/canonical guarantees matter. Remove repeated manual
  object discovery and redundant validation of owned typed values.
- Replace unjustified assertions using decoded types, exhaustive handling and
  explicit absence. Narrow external-library assertion exceptions must name the
  contract and independent evidence that supports them.

**Proof/exit per slice:** malformed external input remains a typed refusal;
unexpected TypeError remains a defect; secrets remain redacted; real historical
response variants still admit; existing canonical fixtures and retained
candidate/journal hashes remain identical. Preserve current wire/error versions
unless a separate reviewed migration is necessary. Do not redesign all errors
or create a reason class for every string code in one change.

### W4 — Make service, runtime and lifecycle ownership consistent

**Requirements:** R05–R07, R11–R16, R28, R35. **Depends on:** W2 and agreed W3 errors.

**Files:** `internal/Host.ts`, meaningful content/journal/transport construction,
`platform/Application.ts`, `Process.ts`, `GitProcess.ts`, `HttpTransport.ts`,
`ContentStore.ts`, `internal/CommandLine.ts`, self-release composition and Action.

- Apply every capability inventory verdict: keep explicit domain values,
  capture dependencies once, replace dependency drilling only where it obscures
  authority, and use built-in Effect services where the contract permits.
- Evaluate native adapters against platform services using existing real
  process/TLS/file acceptance. Record any exact behavior the platform lacks.
  Retaining a narrow native adapter is preferable to weakening no-replay or
  adding a broad catch-and-retry wrapper.
- Settle runtime ownership: a public native Effect runner can compose without
  an inner runtime; compatibility Promise adapters remain at named boundaries.
  Evaluate `runMain` against current signal/pipe/exit behavior rather than
  assuming replacement is equivalent. Preserve Action/core instance identity.
- Use Effect clocks and schedules for Effect-owned waits and deadlines; use
  Clock/crypto capability construction without changing captured invocation
  semantics or recorded timestamp meaning.
- Apply operation names and zero-argument Effect values intentionally. Align
  spans to caller-owned versus committed operation lifetimes; do not trace
  content chunks or serialize provider/credential payloads into attributes.

**Proof/exit:** dependencies visible from construction to root, no nested runtime
in business workflows, finalizers join resource work on each relevant exit,
cleanup failures remain observable through safe reports or defects when the body
also fails or is interrupted,
real CLI/Action signals and closed pipes still behave correctly, and no change
in dispatch counts/unknown outcomes. Public API changes need exact type and
installed-declaration proof plus migration notes.

### W5 — Consolidate verification and CI evidence

**Requirements:** R24–R31. **Depends on:** final W3/W4 inputs for the affected slice.

- Complete the test retention/placement decisions started in W2. Remove orphan
  fixtures and runner entries with deleted tests. Do not replace an unnecessary
  unit test with a larger integration matrix to preserve a count.
- Reuse the existing Bun, native Node, packed provider/kernel/Action and installed
  workflow gates. Ensure timed Effect work is interrupted by test cancellation
  and finalizers are not run under an already-aborted test signal.
- Compose explicit fast/static, portable, native and distribution profiles from
  existing scripts. Each names its required stages, runtime/platform coverage,
  prerequisites and proof artifact. Avoid a second acceptance framework.
- Record exact source/patch identity and raw exits; retain useful failure inputs.
  Add a CI final inventory check only for a real missing-stage failure mode.
  Run format/lint/types before native fixture setup. Measure repeated builds and
  setup before introducing caches or changed-path classification.

**Proof/exit:** the final relevant profile runs on final inputs; a failed/missing
required stage cannot report full success; independently installed consumers
exercise the actual artifacts. Local Linux/Node22 results do not substitute for
macOS or the workflow's Node24/Bun1.3.14 claims.

### W6 — Implement adopter improvements as separately reviewable product work

**Requirements:** R32–R36 with R08–R15. **Depends on:** the relevant boundary work,
not all unrelated standards cleanup.

1. **P1 Observation:** configurable monotonic deadline/backoff, useful pending
   reports and resumable observation. Reuse one admitted candidate within a
   session; preserve exact request/journal identity. A timed-out observation
   causes zero additional publication sends.
2. **P1 Repaired executor:** historical candidate policy/format admission under
   a compatible fixed host. Retain original bytes/provenance/source separately
   from executor version, and explicitly reject unsupported old policy. Exercise
   a fresh runner; never solve host compatibility by repacking the candidate.
3. **P1 Actual-request preflight and boundary conformance:** validate the complete
   retained set and all currently resolvable wire requests before its first dispatch. Use the
   known large native request and real pinned SDK shapes, not invented mocks.
   Keep local structure checks separate from optional credential/remote probes.
   GitHub asset requests may require IDs/upload templates from a future parent
   receipt. Report those steps as deferred, and perform their final wire admission
   when the real evidence exists; never synthesize receipts or claim every future
   request was checked. The zero-dispatch promise applies to static faults that
   can be checked in advance, including the observed npm native-body failure.
4. **P2 Adoption/handoff helpers:** extract only mechanisms shared by the native
   consumers that current Bundle/Plan/content APIs do not already provide.
   Reduce duplicate manifests, trust bootstrap and storage/workflow plumbing;
   leave ABI/SBOM/package policy with the application. Test a concrete consumer
   integration using exact previously qualified archives.
5. **P2 Diagnostics and documentation:** expose safe stages/operation state and
   recovery references, derive support coordinates from actual package delivery,
   and document workflow rerun/evidence reuse and retention limits.

The [incident mapping](incident-to-plan.md) identifies existing fixes versus
unimplemented product work and the proof appropriate to each. Do not recreate
fixed OIDC/acknowledgement/parser bugs as new features or add one test per ledger
entry without a proof gap.

### W7 — Qualify and finish the standards migration

**Requirements:** all applicable R01–R36; product items are reported separately.

- Review every requirement against final source and enforcement, including
  explicit justified exceptions. No unresolved assertion/dependency owner or
  silently disabled diagnostic may be hidden by a global pass.
- Reuse qualified artifacts and direct evidence; run affected packed consumers
  and final profiles after the last relevant source/toolchain change. Record
  public/durable compatibility and any platform checks not run.
- Demonstrate the maintained contributor/agent entry path works in a fresh
  checkout. Ensure AGENTS is tracked and instructions refer to files actually
  delivered, not another checkout or ignored research output.
- Update concise user/contributor docs. Keep this investigation as task/PR
  evidence; remove any new mechanism that the final behavior does not need.
- Produce focused reviewable commits/PRs. Commit/push authorization is separate
  from merge/publication; acceptance never grants release authority.

## Decisions and feasibility gates still requiring evidence

| Decision | Proposed direction | Evidence required before dependent implementation |
| --- | --- | --- |
| Compiler/linter tuple | Use a peer-proven supported tuple first, one diagnostic authority, runtime rc.115 unchanged. | Clean install/patch verification and ts-release source/packed declaration qualification. Latest upstream versions alone do not prove compatibility. |
| Host services versus callback ports | Keep invocation authority; use built-ins/captured construction to remove hidden dependencies selectively. | Complete each inventory dependency trace and deletion test; no blanket service conversion. |
| Native adapter replacement | Prefer existing Effect capability when equivalent; retain narrow exceptions where release semantics need it. | Exact no-replay/wire/process-group/fsync/interruption proof with current acceptance. |
| Prior Promise factory-throw change | Treat as a deliberate public contract decision, potentially preserve old adapter behavior. | Existing caller expectations and migration/type/diagnostic proof; the previous implementation is provisional. |
| Candidate policy migration | Select explicit old-format/policy decoders separately from executor identity. | A retained older candidate and original journal admitted unchanged under repaired code; no broad legacy deletion assumption. |
| Test deletions/additions | Decide from costly uncovered failures and existing workflow evidence. | Necessity and independent expected outcomes; no retrospective failure-first claim. |

These are engineering gates with a default direction, not requests for the user
to design the implementation. They remain visible so that a later code change
cannot silently convert an assumption into a completed requirement.
