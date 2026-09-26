# W0 checkpoint disposition

> Historical W0 review of checkpoint `ec25cbe`, completed on 2026-09-26. Its decisions are inputs to the later implementation, not a claim that every retained change shipped or passed current qualification. See [current implementation status](implementation-status.md) for the bounded milestone, actual verification and remaining work. These are task research documents, excluded from published packages.

Reviewed on 2026-09-26. **W0 review complete; checkpoint acceptance is conditional
and per change.** W1 may proceed from main. This document does not certify the
checkpoint as an implementation of the 36 requirements, and does not qualify any
toolchain or native runtime.

## Inputs and method

- Main baseline: `fa50ce368c50e9a28a2e57f667d454374e7b209c` (0.4.2). The new
  `.standards-implementation` worktree was at this commit when reviewed.
- Checkpoint: `ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f`, reviewed with
  `git diff fa50ce3 ec25cbe`, all 28 changed paths. This is the immutable input,
  not the later dirty documentation in `.effect-pattern-refactor`.
- Decision criteria: [requirements](requirements.md), [gap audit](ts-release-gap-audit.md),
  and [W0–W5 plan](refactor-plan.md). Existing application, Bundle/content,
  HTTP, preparation, CLI and installed-consumer proof was read alongside the diff.
- Exact installed Effect: `4.0.0-rc.115` in `.effect-pattern-refactor/node_modules`.
  Its complete `AGENTS.md` was read; SHA-256
  `e155acab559b29e0a54acd0f5d8d4b7a428268ba6eb1aba4d62b4876d6b1a78e`.
  `src/internal/effect.ts` SHA-256
  `2388d2067765e35470fbd51ef402fd7370ff6a41933855e71d89680dac8895ab`.
  In that source, `acquireUseRelease` masks acquisition and release, restores
  interruption for use, and scopes callback construction. `tryPromise` cannot
  cancel or join a Promise merely because its returned fiber is interrupted.
- Relevant peer skills were applied as review criteria: Reactor's local
  `effect-development` architecture guides, `simplify`, and `testing` with its
  selection and boundary-design references. These are the already-disclosed
  local guidance snapshot in [the Reactor audit](reactor-standards.md), not a
  claim that every file is committed upstream. Testing skill SHA-256
  `85a9b789639eb7915bc138b0071abb959031ca0b457c0ac9463a84b3bd119f28`;
  selection reference SHA-256
  `6c3c929162e70544df97db474022370123acf489a476a50412e6ac7c21d6b476`.

This was a bounded source/proof review. No runtime source, dependency, test or
fixture was changed; no test suite or new probe was run. The historical 356-test
result establishes neither standards compliance nor test necessity. There is
no reconstructed claim that the earlier tests failed before their fixes.

## Decisions that unblock implementation

1. **Preserve the existing Promise runner's factory-throw compatibility.** Keep
   the native Effect runner additive, with synchronous factory bugs as defects.
   Isolate legacy normalization at the Promise/module adapter instead of
   changing shared error helpers to enforce the legacy behavior everywhere.
2. **Keep HTTP credential interruption preservation.** Credential values stay
   redacted for typed failures, defects and mixed causes. This narrow exception
   does not justify swallowing ordinary application/parser defects.
3. **Keep ContentStore's ownership repair, rework its implementation/proof.**
   A native operation must settle before its handle is released or the caller
   is told cleanup has finished. Do not copy the whole instrumentation matrix.
4. **W1 starts on clean main.** None of these three changes is a prerequisite
   for writing/enforcing the engineering contract. Integrate reviewed runtime
   slices in their owning W3/W4 changes after W1/W2, with proof selected first.

## Public application compatibility

These distinctions follow the actual baseline and checkpoint source. A Promise
adapter rejects in every failing row; the underlying Cause and safe diagnostic
classification differ. Expected factory failures should be returned as Effects.

| Factory/module outcome | 0.4.2 `runApplication` | Checkpoint `runApplication` | Chosen implementation |
| --- | --- | --- | --- |
| Module import rejects | Typed `application-load`, fixed safe message | Same | Preserve |
| Missing/noncallable export | Typed `application-export` | Same | Preserve |
| Callable returns a non-Effect | Typed `application-effect` | Same | Preserve in both entrypoints |
| Factory synchronously throws this core instance's `ReleaseError` | `attempt` retains that typed failure | Defect containing the thrown value | Preserve old Promise behavior; new Effect runner preserves defect |
| Factory synchronously throws another value, including TypeError | Typed `invalid-data`, fixed safe message | Original thrown value as defect | Preserve old Promise behavior; new Effect runner preserves defect |
| Factory returns `Effect.fail(error)` | Returned typed failure | Returned typed failure | Preserve; new generic entrypoint also retains inferred E |
| Factory returns a defect or interruption | Defect/interruption; scope finalizes | Same | Preserve |
| Observe/unauthorized invocation | Setup/admission still occur; no dispatch authorization gained | Same interpreter logic | Preserve |

The old `instanceof ReleaseError` behavior is scoped to that compatibility
adapter. A foreign core instance's structurally similar error was not thereby
guaranteed preservation; do not silently promise new cross-instance semantics.
Retain factory receiver binding: the old loader invoked `loaded.createApplication`,
and the extracted loader binds the same module object.

`CreateApplication<E = ReleaseError, R = never>` is a compatible additive type
extension for existing annotation users. `runApplicationEffect` consumes Scope
and leaves `Exclude<R, Scope>` to the caller; its error is
`E | ReleaseError | AdoptionError`. Keep `Application.onRejected` as a fully
constructed capability for this increment. Broadening that callback's E/R is a
separate public design choice, not required to add the new factory entrypoint.

Keep the extracted interpreter's Bundle admission, captured host/options,
original Plan/journal, dispatch budget, at-most-once rejection hook and observe
restriction. There is no evidence in this diff of changed durable formats,
authorization rules, provider versions or request identities. Rename the
`Effect.fn` operation deliberately when integrating: the helper is called
`executeApplication` while the checkpoint trace name is `ts-release.runApplication`.
The owner should choose a public workflow span intentionally, not count names.

## Every changed path

“Keep” means retain the behavior/evidence in its owning increment, not cherry-pick
the checkpoint wholesale. “Rework” names an adjustment before integration.
“Defer” retains task evidence without making it part of the product contract.

| Checkpoint path | Disposition and reason |
| --- | --- |
| `packages/ts-release/src/platform/Application.ts` | **Rework / W4.** Keep one shared interpreter and additive composable runner; preserve old Promise factory-throw behavior at its loader boundary. Preserve captured authority and module receiver. Review the narrow dynamic-module assertion under W2/W3. |
| `packages/ts-release/src/Node.ts` | **Keep / W4.** Export the additive runner with its final implementation and packed declaration proof; no new package subpath is needed. |
| `packages/ts-release/src/Bun.ts` | **Keep / W4.** Forward the same public implementation/types; qualify actual Bun package resolution. |
| `packages/ts-release/src/platform/ContentStore.ts` | **Rework / W4.** Keep per-operation settlement, brackets and temporary-path ownership. Preserve eager input-byte copy, immutable linking, collision read-back and fsync. Narrow the errno assertion and expected-input conversion with W3; avoid claiming a hung native call has bounded cancellation. |
| `packages/ts-release/src/platform/HttpTransport.ts` | **Keep / W3 or W4.** The seven-line cause policy repairs swallowed cancellation while redacting secrets. Any interrupt-bearing Cause becomes clean interruption; original interruptor identity and noninterrupt reasons are deliberately discarded. |
| `scripts/check-packed-kernel.ts` | **Keep / W4.** Add the new symbol to existing installed declaration consumers for Node/Bun. This is relevant distribution proof, not a separate export harness. |
| `test/reimplementation/kernel/application.test.ts` | **Rework / W4.** Keep narrow compile-time E/R protection and the specific callback-construction/laziness seam. Consolidate repeated runtime cleanup proof as detailed below; cover the decided Promise compatibility in the existing owner seam before changing it. |
| `test/reimplementation/kernel/content-store-lifecycle.mjs` | **Rework / W4.** Retain only necessary native race evidence. Remove the snapshot duplicate and stabilization sleeps; do not preserve all eight cells or the fs module mock merely because the checkpoint passed. |
| `test/reimplementation/kernel/content-store.test.ts` | **Rework with retained native proof.** Its whole purpose is launching that fixture under Node/Bun. Keep runtime coverage/watchdog only if the reduced proof still requires isolated processes; remove orphan matrix assertions and runner when not needed. |
| `test/reimplementation/packed-kernel/portable.mjs` | **Keep / W4, trim overlap.** A packed public call proves emitted runtime export wiring that source/type checking cannot. Reuse the admitted journal and verify no additional send. Avoid repeating all source lifecycle assertions in this consumer. |
| `test/reimplementation/transports/http-credentials.test.ts` | **Rework / W3 or W4.** Distinct cause redaction and pre-dispatch cancellation matter; the full read/run × six-cause table does not have twelve independent proof gaps. Reuse existing owner fixtures/coverage where possible. |
| `docs/preparation.md` | **Rework with W4.** Keep additive runner usage and E/R/Scope explanation. Replace the claim that both entrypoints change factory-throw behavior with the explicit compatibility split above. |
| `CHANGELOG.md` | **Rework with implementation.** Report only landed behavior; correct Promise compatibility and remove broad “standards adopted” wording until required gates actually pass. |
| `README.md` | **Rework / W1.** Link the final contributor/architecture guidance; do not claim all peer standards are adopted by this checkout. |
| `ARCHITECTURE.md` | **Rework / W1.** Link the maintained engineering contract once written; keep the existing release authority architecture. |
| `docs/effect-standards.md` | **Rework / W1.** Supersede its selective adoption claim with the tracked CONTRIBUTING/AGENTS contract. Preserve useful ownership/redaction explanations without two competing normative guides. Its broad success/failure/defect/interrupt testing prescription needs R24/R25 necessity qualification. |
| `CHECKPOINT.md` | **Defer.** Preserve in the old checkpoint as historical state. It says research is underway and is not the current implementation branch's contributor guide. |
| `docs/engineering-audit/requirements.md` | **Keep as task evidence; use final revision.** The checkpoint version alone references unfinished reports. Use the completed source/requirement chain in this directory. |
| `docs/adoption-audit/README.md` | **Keep as task evidence.** Census/status and incident links motivate work; not a claim all incidents remain unfixed. |
| `docs/adoption-audit/census.json` | **Keep as task evidence.** Preserve snapshot scope/provenance; do not turn it into a product gate. |
| `docs/adoption-audit/effect-agent-browserbase.md` | **Keep as task evidence.** Multiple adoption findings retain their historical/current distinctions. |
| `docs/adoption-audit/effect-build.md` | **Keep as task evidence.** Distinguish ts-release incidents from adjacent publisher lessons. |
| `docs/adoption-audit/nyc-transit-kit.md` | **Keep as task evidence.** Consumer evidence does not authorize product-specific policies. |
| `docs/adoption-audit/reactor-effect-client.md` | **Keep as task evidence.** Do not conflate newer executor policy with retained candidate identity. |
| `docs/adoption-audit/self-release-corroboration.md` | **Keep as task evidence.** Corroboration is not an extra confirmed adopter. |
| `docs/adoption-audit/effect-patterns-browserbase.md` | **Defer as superseded research.** Retain provenance, direct readers to the full engineering standards ledger. |
| `docs/adoption-audit/effect-patterns-reactor.md` | **Defer as superseded research.** Preserve the local/main distinction and point to the full ledger. |
| `docs/adoption-audit/effect-standards-refactor.md` | **Defer as superseded assessment.** Historical checks belong to historical input; the revised audit supersedes its completeness implication. |

The checkpoint does not include a tracked root AGENTS file or CONTRIBUTING file.
An ignored local AGENTS file cannot deliver the W1 contract. W1 must intentionally
change the ignore policy, write the real contributor contract and qualify tools.

## Added application proof, case by case

| Added proof | Decision / independent value |
| --- | --- |
| Exact `Effect.Error` and `Effect.Services` assertions | **Keep.** Silent generic widening erases a public extension contract and runtime tests cannot catch it. Make these compiler assertions, without runtime `expect([true, true])`. Prefer the existing packed declaration consumer for public type claims where practical. |
| Lazy construction + provided factory Layer + observe result | **Keep the narrow seam, trim.** The new public entrypoint must defer callback invocation and actually consume caller requirements. Exact four-element Layer/application cleanup order retests Effect internals; retain only ownership/laziness and observable no-dispatch obligations not already provided by packed/public proof. |
| Returned typed failure cleanup case | **Consolidate.** Existing Promise factory failure/scope proof runs the shared interpreter and Scope. The new E assertion is valuable; a second runtime scope matrix is not automatically necessary. Keep one typed-value identity assertion only if the changed adapter can transform it. |
| Returned defect cleanup case | **Consolidate/defer duplicate.** This uses an already-created `Effect.die`, so it does not expose the synchronous callback-construction bug. Existing shared scope behavior plus the construction-throw case is stronger evidence for this change. |
| Synchronous factory construction throw + caller finalizer | **Keep one focused regression when integrating the new API.** This is the specific boundary that can throw before an Effect is returned; laziness, original defect identity and cleanup distinguish the intended behavior. It does not prove old Promise compatibility; the two entrypoints now deliberately differ. |
| Interrupted factory + Deferred + Fiber finalizers | **Consolidate.** Its barrier is sound, but the existing Promise factory interruption, CLI signal cleanup and shared scoped interpreter already cover interruption ownership. Retain only if refactoring leaves a genuinely separate native-Effect lifecycle path. Do not preserve just to complete an exit matrix. |
| Packed runtime invocation after prior journal satisfaction | **Keep, trim to distribution concern.** Installed export execution plus unchanged dispatch count covers a separate failure from generic type inference. Existing packed application proof owns detailed report/cleanup behavior. |

Existing owner tests also protect captured host/options, unauthorized alias
mutation, Bundle/Plan binding, bounded authentication continuation, observe mode,
unknown outcomes and restart without resend. Preserve that independent release
authority proof. No new outcome matrix is authorized merely because interpreter
code moved to a helper.

## Added native content proof, case by case

The baseline wraps whole asynchronous filesystem workflows in `tryPromise`.
Interruption can detach the fiber while the Promise continues owning handles or
mutating the temporary directory. That ownership mismatch supports the fix.
Existing installed release workflows cannot reliably hold a file-open or write
completion at exactly the cancellation window, so a small independent native
race proof can be justified. It must demonstrate failure on the baseline before
the new implementation is integrated; that demonstration has not happened in W0.

| Fixture cell/assertion | Decision / proof gap |
| --- | --- |
| `acquire` held after native open | **Retain as candidate minimal regression.** Cancellation before acquisition returns is distinct: the handle exists but the fiber has not received it. Prove it does not become orphaned, then stop. |
| `write` held after issuance | **Retain as candidate minimal regression.** Proves the caller cannot finish interruption while issued mutable I/O still owns the resource. This is the central detached-work failure. |
| `close` held | **Defer unless reduced acquisition/write proof misses release joining.** Finalizer joining is relevant, but another cell needs a demonstrated distinct escape from retained checks. |
| `read` held | **Consolidate.** With one shared scoped reader and settlement primitive, the same native join invariant applies. Add only if a separate read implementation introduces an unproven owner. |
| `verify` held | **Remove duplicate if the shared reader remains.** It repeats the read bracket/scan with no distinct mutation. |
| `copy` held | **Review separately before retaining.** Two resources (source + temporary output) can make this independent; the checkpoint pauses the input read, and handle counters alone do not establish a new external contract. Keep only if nested-resource cleanup can escape the reduced proof. |
| Synthetic `failure` during write | **Consolidate with existing owner failures.** Bundle tests already exercise collision refusal, cleanup and preserved content. A write-failure cell needs a separate demonstrated cleanup gap. |
| Synthetic `close-failure` | **Rework if retained.** The wrapper closes the real handle and then throws; it proves safe error projection, not cleanup after an actual native close failure. Do not claim all resources are released when native close rejects. |
| Eager input snapshot, returned-buffer isolation, rerun same Effect | **Remove from new harness.** Eager snapshot/content reuse already have stable Bundle owner coverage; a new matrix does not justify duplicating it. Preserve the actual copy-before-execution implementation. |
| `opened === closed`, exact private counters | **Rework.** Counters may diagnose a forced native race but must not become the sole success oracle or enforce incidental implementation shape. Observable completion/resource/filesystem state and retained bytes are the contract. |
| 20 ms “not finished yet” and post-settlement sleeps | **Remove.** A wall-clock sample is not deterministic ordering evidence. Choose explicit scheduler/barrier evidence for the retained forced race; TestClock alone cannot drive a native Promise. Keep a real process watchdog only as a hang bound. |
| Bun `mock.module("node:fs/promises")` / Node builtin mutation | **Do not adopt as general architecture.** Isolated external-native instrumentation can be justified only by the precise retained race. Prefer the existing real boundary and smallest faithful fixture; do not export a testing service merely to avoid this review. |

The implementation's one-time close closure is legitimate ownership state: the
writer must close before immutable installation and the finalizer must not close
it twice. Do not simplify it into a bracket that installs while the writer stays
open. Marking release attempted before native close preserves one attempt; a
failed close cannot be advertised as successful cleanup, and an automatic retry
is not justified by this review. Keep safe failure observability, including a
cleanup failure combined with failed/interrupted body. Native operations that
never settle may delay interruption indefinitely; no timeout guarantee follows.

## Added credential proof, case by case

The existing `http.test.ts` live-header case already makes a credential Effect
throw, expects the fixed safe message and verifies no `DispatchStarted`. Existing
transport-preparation tests protect pre-dispatch rejection; native TLS tests
protect socket interruption after networking starts. Neither proves how a
credential resolver's mixed Cause is projected before network dispatch.

| Added cause/case | Decision / independent value |
| --- | --- |
| Typed `Effect.fail` | **Keep one safe-projection observation where absent.** Secret-bearing expected errors need the same privacy boundary as defects. It need not run under both read and run for the shared helper. |
| Synchronous resolver throw | **Consolidate with existing credential-defect proof unless construction is separately changed.** Keep the `Effect.suspend` callback boundary; do not introduce a new broad wrapper. |
| `Effect.die` | **Remove duplicate matrix row when existing throwing-Effect proof remains.** Both exercise defect redaction at the same helper. |
| `Effect.interrupt` | **Keep one current-failure regression at preparation.** Baseline catchCause changes this to ordinary credentials failure; result must remain interruption and create no journal event. |
| Mixed interrupt + defect; mixed interrupt + typed failure | **Keep mixed privacy coverage, consolidate.** A single interrupt-bearing Cause containing both secret-bearing categories can test the policy branch. Do not leak either category merely to preserve Cause identity. |
| Every cause repeated through `makeHttpRead` and `runRelease` | **Reduce.** Both call the same authorization owner. Keep distinct caller wiring only where a caller can independently swallow cancellation, not a duplicate Cartesian matrix. |
| Pending resolver with acquired resource, caller abort, finalizer and empty journal | **Keep the concrete pre-dispatch cancellation seam if not covered by the retained interruption case.** Its ready barrier is appropriate; replace the definitely-assigned callback assertion with a safe latch/Deferred when editing. Test cancellation must interrupt the fiber without preventing finalizers. |

An `.invalid` URL and an empty journal do not by themselves prove zero DNS/network
attempts. Select proof at the actual owner: a credentials refusal must occur before
native send preparation/dispatch, and no durable send permission may be recorded.
Do not add a network server merely to expand this matrix.

## Next implementation choices

- W1: tracked instructions and contributor contract, one qualified diagnostic
  authority, explicit host/test/native policies, no adoption claim while gates
  are incomplete. Start from main rather than importing runtime fixes first.
- W2: keep the two narrow computed-load owners. The application module path is
  trusted host input; the Action must use the application's installed core.
- W3/W4: integrate HTTP cancellation first if useful; integrate the additive
  application runner with the Promise compatibility split; integrate content
  ownership after the smallest necessary current-failure proof is demonstrated.
- For each retained/regression proof, record the real before/after commands and
  outputs during implementation. Existing checkpoint tests remain historical
  review inputs until chosen and run on the final source. No new package release,
  provider/model selection, public upload or durable contract change follows
  from this disposition.
