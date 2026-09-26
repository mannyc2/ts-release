# Browserbase: Effect architecture and standards review

Browserbase is a strong reference for **typed service composition, scoped ownership, explicit mutation outcomes, bounded work, and tests that keep the real implementation under test**. Adopt these contracts in ts-release. Do not copy its lifecycle machinery indiscriminately: this review reproduced a callback-construction defect in its writer coordination, and several deliberate browser-specific choices would be poor defaults for a release engine.

Reviewed on 2026-09-26 against [`mannyc2/effect-agent-browserbase@7e93054494ee491dbf2a1f66a083d99da846fd3e`](https://github.com/mannyc2/effect-agent-browserbase/tree/7e93054494ee491dbf2a1f66a083d99da846fd3e). The local checkout is `b104a6…`; its seven changed files concern platform response handling and a usage example. Every implementation and test file cited below is unchanged between these revisions. No consumer source, releases, credentials, or paid resources were modified.

The review covers all three package boundaries, representative public services and data models, provider transport, acquisition and cleanup, writer coordination, the common browser owner, agent host supervision, public testing seams, and type/lifecycle/consumer tests. It is an architecture review with targeted implementation checks, not a claim that every browser operation was re-executed.

## Version and source discipline

The public Browserbase packages target Effect **4.0.0-rc.117**, while ts-release's current `main` (`fa50ce3`, version 0.4.2) uses **4.0.0-rc.115**. Browserbase's isolated release application also uses rc.115. The older ts-release working tree (`9b14c6c`) pins rc.108; the separate `.repos/effect` research checkout uses beta.83. Neither is the implementation baseline for this refactor.

The installed rc.117 `effect/AGENTS.md` and `src/Effect.ts` were read, with rc.115 definitions checked for the lifecycle APIs used here. Current upstream guidance supports `Context.Service`, static service Layers, Schema-backed data/errors, `Effect.gen` for workflows, named `Effect.fn` for useful tracing boundaries, and `Effect.fnUntraced` for reusable implementation functions where tracing is unnecessary. This is a semantic standard, not a search-and-replace rule. For example, the rc versions spell the schema-backed error constructor `Schema.TaggedError`; beta.83 spelled it `Schema.TaggedErrorClass`.

Browserbase coordinates its dependency pins and checks strict declarations from installed tarballs. Adopt coordinated pins and actual consumer checks; this review does not recommend an Effect version upgrade. See [contribution and acceptance contracts](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/CONTRIBUTING.md).

## Standards worth adopting

| Standard | Verified implementation | Implication for ts-release |
| --- | --- | --- |
| Separate capabilities by ownership | `effect-browser` owns the generic browser; `effect-browserbase` supplies remote lifetime; `effect-agent-browser` adapts that same session. Browserbase does not duplicate the generic owner. | Providers should supply provider behavior through the kernel's supported boundary. Keep approval, candidate identity, journal transitions, and execution ownership in one place. |
| Build service dependencies once | `BrowserbaseContexts.layer` acquires `BrowserbaseClient` when its Layer is built; methods close over that dependency. `Account.layer` composes the common client with all resource services. | Assemble production implementations at application/runtime boundaries. Repeated operations should not construct their own application runtime or reacquire the full provider graph. |
| Give reusable operations deliberate names | Public context operations use `Effect.fn("BrowserbaseContexts.create")`, `.retrieve`, and `.delete`; small internal validation uses `fnUntraced`. | Trace preparation, provider observation, publication, and persistence where the name helps a caller. Avoid replacing comprehensible internal combinators with boilerplate spans. |
| Use schemas at trust boundaries | Resource helpers reject excess caller properties, decode provider replies through schemas, and return modeled values. | Validate configuration and decoded storage/HTTP data explicitly. Keep provider response tolerance separate from strict candidate and journal formats. |
| Keep errors factual and actionable | Provider errors retain operation, reason, status, retry delay, and a mutation outcome. Browser errors carry a tagged reason and required outcome. | Preserve the evidence needed to distinguish refusal, dispatch uncertainty, and confirmed observation. Do not infer a safe retry from an exception string. |
| Preserve caller `E` and `R` | `Browser.scoped` and writer coordination remain generic over callback errors/services. Type tests assert exact error and environment unions. | Extension hooks and provider callbacks must retain typed failures and service requirements. Avoid replacing them with `unknown`, `never`, or a generic transport error. |
| Own work before starting it | Remote acquisition registers cleanup before POST; the agent host reserves a bounded slot before forking a scoped invocation. | Install cleanup/journal ownership before an operation can create externally visible state. Keep cancellation behavior part of the public contract. |
| Observe cleanup independently | Cleanup attempts every stage, records each result, and distinguishes release requested from release confirmed. | A successful mutation acknowledgement is not proof that a registry or release endpoint exposes the intended state. Keep subsequent readback and recovery evidence. |
| Test through the real owner | Scripted HTTP, native driver, and model inputs feed the production transport/owner/toolkit. Tests inspect actual calls and lifecycle results. | Supply a fake network/process/storage edge beneath the real provider and engine. Test outcomes and side-effect counts rather than mocking away the code that implements them. |

### Services, Layers, and package boundaries

[`Client.ts:35-105`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/Client.ts#L35) defines a narrow `Context.Service` interface, a validating Layer constructor, and a separate Config-driven constructor. Configuration is read when the Layer is built. Credentials use `Redacted`; they are not part of durable references.

[`Contexts.ts:53-160`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/Contexts.ts#L53) is a useful template: a typed capability, one captured dependency, named operations, input validation, provider decoding, and resource-specific errors. [`Account.ts:43-72`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/Account.ts#L43) uses `Layer.provideMerge` to share and expose dependencies deliberately. Account construction performs no provider request and remains separate from browser lifetime and budgets.

The [repository contracts](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/AGENTS.md) also constrain public entry points and dependency direction: a resource-only import cannot load the native browser implementation. For ts-release, comparable constraints are that kernel/data imports do not load a native provider, credentials are acquired only by the implementation that needs them, and providers do not import private kernel internals.

### Schemas and errors

[`Contexts.ts:15-32`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/Contexts.ts#L15) separates a provider wire schema from public `Schema.Class` metadata and creation receipts. [`internal/http/Resource.ts:42-65`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/http/Resource.ts#L42) rejects excess caller properties while allowing unrelated provider reply fields. This avoids making remote schema evolution equivalent to corrupt local configuration.

[`Errors.ts:26-43`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/Errors.ts#L26) models expected transport/resource failures; [`Errors.ts:186-202`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/Errors.ts#L186) gives uncertain allocation its original attempt and optional known session reference. The lost response remains `unknown`; it does not become a rejection merely because the fiber failed.

This maps directly to ts-release: keep candidate/journal/provider evidence schema-backed, retain outcome uncertainty across errors, and decode external replies without letting provider-specific objects become durable engine authority. Existing modeled ts-release data should remain authoritative rather than gaining a parallel metadata format.

### Scope, cleanup, and interruption

[`Browser.scoped`, `Browser.ts:258-298`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browser/src/Browser.ts#L258) is particularly reusable. It evaluates acquisition once, runs the caller in a nested scope, races the session's supervised failure, joins child scope cleanup, and then performs checked browser cleanup. Its generic signature preserves concrete session type, callback errors, and outstanding services.

[`Acquisition.ts:79-143`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/session/Acquisition.ts#L79) uses a small uninterruptible region to establish scope/finalizer ownership before restoring interruptibility around POST at lines 170-176. It retains the returned identity before interpreting connection credentials at lines 178-192. `Effect.cached` shares one cleanup attempt among concurrent callers.

[`Cleanup.ts:27-113`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/session/Cleanup.ts#L27) attempts fence, capture, initialization, disconnect, remote release, and status observation independently. A local disconnect failure does not prevent remote cleanup. A successful release request can still produce `pending`; only passive terminal-state evidence produces `confirmed`.

The generic [`cleanupStep`, `ConnectionCleanup.ts:29-56`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browser/src/internal/browser/ConnectionCleanup.ts#L29) observes `Exit`, uses a bounded interruptible step, and returns compact cleanup evidence. Observer notification is also bounded and cannot change the canonical receipt. This is a reasonable policy for a best-effort observer; an authoritative journal append must not be treated like that observer.

For ts-release, use normal `acquireRelease`, scoped layers, and finalizers where possible. Add custom lifecycle state only for an external mutation or resource whose uncertainty requires it. A broad `uninterruptible` around an entire release would defeat this design: interruptible external work and protected ownership transitions have different purposes.

### Concurrency and context capture

[`Host.ts:177-240`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/agent-browser/src/internal/tools/Host.ts#L177) captures callback services, owns a private scope, and forwards the original callback `Cause` to a typed failure channel while presenting a bounded failure to the model. Pure interruption remains interruption.

[`Host.ts:243-320`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/agent-browser/src/internal/tools/Host.ts#L243) limits outstanding work, distinguishes queue deadline from active operation deadline, brackets semaphore acquisition, registers fibers in the host scope, and joins interruption before releasing accounting. It does not race a naked semaphore take against a timeout. [`BindingRunner.ts:25-40`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browser/src/internal/browser/BindingRunner.ts#L25) uses `FiberSet.runtimePromise` at the explicit native callback boundary instead of starting unowned runtime work throughout the library.

ts-release should similarly bound concurrent observations/uploads, scope child fibers and native processes, and preserve caller context through extension boundaries. It does not need a browser-style invocation lane for every operation; concurrency policy should follow provider and journal semantics.

### Platform I/O and retry policy

[`Transport.ts:216-235`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/http/Transport.ts#L216) uses Effect HTTP with an injected `FetchHttpClient.Fetch`. [`Transport.ts:143-173`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/http/Transport.ts#L143) enforces a byte limit while collecting streamed data. [`Transport.ts:435-468`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/http/Transport.ts#L435) permits a bounded retry only for GETs and selected transient failures, within one shared deadline. It never retries a mutation merely because its response was lost.

[`internal/Deadline.ts:3-25`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/Deadline.ts#L3) uses the injected monotonic clock for elapsed budgets. Provider dates use wall time separately. ts-release should make that distinction wherever timeout accounting currently depends on the wall clock.

The transport's tracing suppression and internal construction of a Fetch-backed client are specific to its credential boundary. Do not turn either into a blanket rule for ts-release: choose safe trace attributes and an explicit injectable platform service appropriate to the provider.

## Confirmed flaw to avoid copying

### P1: writer callbacks can bypass settlement when constructing their Effect throws

[`ContextCoordination.ts:70-113`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/ContextCoordination.ts#L70) evaluates `backend.acquire(ref)`, `options.verify(body.value)`, and `lease.settle(facts)` before the associated `Effect.exit` boundary has been constructed. The main `use(permit)` callback correctly uses `Effect.suspend`, but those other extension callbacks do not.

A verification callback that throws synchronously exits the enclosing generator immediately. It skips settlement, quarantine, and `closeContextWriterPermit`. This is more than a diagnostic discrepancy: an escaped permit remains accepted by [`requireContextWriterPermit`, `ContextWriter.ts:234-252`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/session/ContextWriter.ts#L234) after `withWriter` has failed. Returning an Effect that dies takes the intended cleanup path.

An isolated Bun probe imported the byte-identical coordination implementation from an existing rc.117 workspace. It ran a backend whose settlement increments a counter, captured the permit from `use`, and compared these verification callbacks:

```ts
verify: () => { throw new Error("probe") }
verify: () => Effect.die("probe")
```

Observed output:

```json
{"mode":"construct-throw","exit":"Failure","settlements":0,"escapedPermitStillAccepted":true}
{"mode":"effect-defect","exit":"Failure","settlements":1,"escapedPermitStillAccepted":false}
```

This was an in-memory lifecycle probe with no provider calls. Existing writer tests cover callback typed failure, interruption ordering, concurrent claims, and settlement timeout, but the reviewed suite lacks this constructor-throw case. See [`WriterCases.ts:302-392`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/test/fixtures/WriterCases.ts#L302).

**Standard for ts-release:** suspend caller-supplied Effect factories inside the intended error/resource boundary, for example `Effect.suspend(() => hook(input))`. Preserve the full `Cause`; a construction defect is not an ordinary recoverable provider rejection. Test construction throws separately from returned `Effect.fail`, returned `Effect.die`, and interruption wherever extension callbacks influence cleanup or journal transitions.

## Choices to copy selectively

1. **Do not replace every internal value with a class.** Durable public data and errors benefit from Schema classes. Runtime service handles, native resources, and internal ephemeral state legitimately remain interfaces or records. The reviewed implementation itself uses both.
2. **Do not erase operational causes as a general error strategy.** Browserbase intentionally exposes credential-free errors and bounded model-facing projections. Its cleanup helper intentionally reduces failures to `timeout`, `interrupted`, or `failed`. ts-release needs enough host-side evidence to diagnose provider and persistence failures; any redaction/projection must leave the relevant typed or durable facts intact.
3. **Do not copy module-global lifecycle state by default.** [`ContextWriter.ts:32-42`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/internal/session/ContextWriter.ts#L32) uses process-wide maps and a fixed cap of 2,048 tracked contexts. This enforces its local exclusivity policy, but couples separately built layers and retains quarantined state for the process lifetime. A ts-release engine hosting independent applications should keep state with its runtime/journal authority unless process-wide exclusivity is explicitly required.
4. **Do not reproduce the entire browser acceptance harness.** The useful standard is actual installed-package, declaration, ownership, and failure-path coverage. Browser installation, upstream bootstrap, Vite+, and the paid hosted workflow are not requirements for adopting Effect conventions in ts-release. Continue using Bun as the repository requires.

## Test practices to emulate

[`workflow-types.test.ts:17-47`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/test/workflow-types.test.ts#L17) asserts exact errors and services on a stored, unannotated public workflow. This protects inference at the actual consumer boundary, including the absence of accidental `unknown` widening.

[`cleanup-observers.test.ts:122-198`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/test/cleanup-observers.test.ts#L122) tests success, callback-construction throw, defect, interruption, timeout, concurrent close calls, exact cleanup counts, immutable receipts, and sensitive-value exclusion. It uses `Deferred` and `TestClock` rather than relying on scheduler timing. This stronger matrix already exists elsewhere in Browserbase; writer coordination should follow its own repository's example.

[`Testing.ts:14-45`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/browserbase/src/Testing.ts#L14) models provider replies at the transport boundary. [`scripted-agent.test.ts:119-168`](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/packages/agent-browser/test/scripted-agent.test.ts#L119) proves that a real owner/toolkit/runtime composition dispatches an uncertain click exactly once even when the caller tries again. For ts-release, the analogous test must count actual publication requests while exercising the real journal and reconciliation logic.

The strict [lint policy](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/lint/.oxlintrc.json) enforces typed Effect contexts, no floating promises, no unsafe assertions, exhaustive switches, and restricted runtime execution in library code, with explicit exceptions around native bridges. Adopt enforceable boundary checks in the existing ts-release toolchain rather than introducing a second formatter/linter merely to match this repository.

## Recommended ts-release application order

1. Protect provider/extension callback construction, typed failure propagation, interruption, and resource cleanup. Add meaningful regression and inference checks at those boundaries.
2. Make reusable provider/platform operations consistently use `Effect.fn` or `fnUntraced`; keep workflow bodies in `Effect.gen`. Preserve observable behavior and existing durable formats.
3. Keep Layers and platform implementation selection at application/runtime/test boundaries, with a single owner of candidate and execution state.
4. Enforce Effect boundary rules in repository checks, and document deliberate exceptions for native SDK bridges and final host execution.
5. Continue provider-specific improvements motivated by the adoption audit: uncertain mutation recovery, actual registry visibility, bounded uploads/readback, and installed-consumer coverage. These are behavioral changes that need their own contracts and focused tests, not incidental changes hidden inside a style refactor.

Validation performed for this review: read-only source/test and version comparison, byte-identity check for the probed coordination source, and the isolated constructor-throw probe above. Full Browserbase acceptance, native browser tests, hosted tests, and publication were not run.
