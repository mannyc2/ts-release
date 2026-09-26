# Reactor Effect patterns review

Reviewed `mannyc2/reactor-effect-client` at
[`f821a9084cf51e9aac591388db0788cb90501bf0`](https://github.com/mannyc2/reactor-effect-client/tree/f821a9084cf51e9aac591388db0788cb90501bf0).
This is a review of the SDK, its host implementations and verification design,
not only its ts-release application. The strongest standards to adopt are
explicit capability dependencies, resource ownership, preservation of uncertain
remote outcomes, bounded and injectable I/O, and tests that observe those
contracts through real public boundaries.

Reactor is a useful architectural reference, not a complete style template.
Its reusable functions rarely use `Effect.fn`; its mutable transport machinery,
large error algebra and custom test harnesses should not be copied into a release
engine merely for consistency.

## Scope and evidence

The reviewed main commit declares Effect/platform/Vitest `^4.0.0-rc.117` in its
workspace catalog. The local checked-out branch and installed Effect package
were older; the installed Effect guide inspected was `4.0.0-rc.115`.
All Reactor implementation and test citations below point to the reviewed Git
object, read with `git show`, rather than the local working tree. The intended
ts-release comparison baseline is `fa50ce3`, version 0.4.2, on exact rc.115 pins.
No dependency upgrade follows from this review.

Read the local `AGENTS.md`, the target commit's `CONTRIBUTING.md`, verification
documentation, public client/host APIs, coordinator HTTP/schema code, session
acquisition/lifecycle/cleanup, submission ownership, representative orchestration
code, error models, architecture checker, and corresponding tests. Existing
tests were inspected; the main-commit suite was not executed against the older
local checkout. No Reactor files, credentials or remote state were changed.

## Standards supported by implementation and tests

### REC-E1 — Inject actual capabilities and compose them at application boundaries

`PeerFactory` is a narrow `Context.Service`: a host creates fresh transports and
can supply a readiness check. `Client.make` requests `HttpClient`, `PeerFactory`
and `Crypto`; `Client.layer` exposes that constructor as a layer without selecting
the concrete host. Browser and Native implementations supply the same capability.
Native library loading and validation happen while building the layer; acquisition
checks current host usability before allocating a paid remote session.

Evidence: [PeerFactory.ts:6–26](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/PeerFactory.ts#L6-L26),
[session/index.ts:107–124](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session/index.ts#L107-L124),
[browser/index.ts:10–19](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/browser/src/index.ts#L10-L19),
[native/index.ts:32–64](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/native/src/index.ts#L32-L64),
[acquire.ts:142–149](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session/_internal/acquire.ts#L142-L149).

**Adopt:** keep provider and persistence dependencies explicit; select native
implementations in CLI/runtime/test composition. Preflight capabilities before
irreversible dispatch. A service must own a real replaceable capability; do not
turn every pure helper or data transformation into a service.

### REC-E2 — One owner, with scoped acquisition and evidence-preserving cleanup

Acquisition forks a child scope and registers the session with `acquireRelease`.
Failure closes that child immediately even if the caller catches it inside a
long-lived outer scope. `RemoteSession` records ownership as soon as it obtains
the remote ID, before validating the rest of the response. A malformed descriptor
therefore still leaves enough evidence to terminate the allocated resource.
Interrupted allocation moves to `unknown` rather than pretending it did not run.

Cleanup runs publication release, local shutdown and owned remote termination in
order. A failed phase does not omit later evidence. `CloseReport` records local
errors separately from remote confirmation, and acquisition failures retain that
report. The tests cover valid IDs in malformed creation replies, unconfirmed
remote cleanup after local disposal, and repeated close returning the same report
without a second DELETE.

Evidence: [acquire.ts:165–216](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session/_internal/acquire.ts#L165-L216),
[remote.ts:45–99](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session/_internal/remote.ts#L45-L99),
[cleanup.ts:91–139](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session/_internal/cleanup.ts#L91-L139),
[Client.test.ts:130–165](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/Client.test.ts#L130-L165),
[Client.test.ts:380–428](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/Client.test.ts#L380-L428).

**Adopt:** scopes must own staging files, subprocesses, response streams and
temporary resources. Preserve independent dispatch, observation and cleanup
facts. A cleanup failure must not overwrite the original publication outcome or
erase evidence necessary for recovery. Use existing ts-release journal semantics
as the authority rather than adding a competing lifecycle store.

### REC-E3 — Separate cancellable preparation from committed execution

`Submission.make` is inert until submitted. A semaphore serializes the decision
to commit. Preparation runs interruptibly in a provisional scope. The small
uninterruptible section registers commitment and transfers ownership to a fiber
in the supplied scope; a waiting caller's interruption does not replay or take
ownership away from committed execution. Every exit closes or transfers the
provisional scope. The state distinguishes prepared, committed and completed.

Evidence: [Submission.ts:7–89](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/Submission.ts#L7-L89).

**Adopt:** document and test the precise dispatch ownership boundary. Keep the
uninterruptible region small, restore interruption during I/O, and never infer
permission to resend from a cancelled waiter. ts-release already has durable
execution/recovery machinery; Reactor's principle is useful without importing
its in-memory `Submission` abstraction.

### REC-E4 — Model operational failures and uncertain outcomes separately

Schema-backed error classes carry tagged reasons and evidence. `CommandContext`
requires request identity and generation for dispatched outcomes, while
`not-submitted` has a different shape. HTTP requests mark the conservative
submission boundary immediately before calling the injected client; transport
failure beyond that boundary is `unknown`. A typed retryability classification
does not itself prove that a mutation can be repeated.

At synchronous parser boundaries, only recognized `ReactorError` values become
typed failures. Unexpected exceptions propagate as defects. Tests explicitly
prove that a thrown `TypeError` has a die cause and no typed failure.

Evidence: [errors.ts:245–281](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/errors.ts#L245-L281),
[client.ts:220–253](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/coordinator/_internal/client.ts#L220-L253),
[client.ts:298–305](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/coordinator/_internal/client.ts#L298-L305),
[errors.ts:866–915](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/errors.ts#L866-L915),
[errors.test.ts:427–457](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/errors.test.ts#L427-L457).

**Adopt:** typed errors should describe failures callers can handle, retaining
stage and dispatch evidence. Do not wrap whole workflows in a catch-all that
turns programmer errors or interruption into recoverable provider failures.
Keep tag-based routing and existing error compatibility; introduce nested
reasons only where they improve an actual recovery decision.

### REC-E5 — Schemas own provider contracts; bounded transport owns hostile input

Provider replies have Schemas with bounds and cross-field checks, such as a
maximum track count and uniqueness of track names. Nullable/omitted fields are
normalized deliberately; unknown future session states remain available. The
minimal allocation-ID schema is decoded before the full descriptor to preserve
ownership. These are distinct boundary decisions, not blanket strictness.

HTTP response collection bounds both bytes and chunk count, including empty
chunks, and copies retained chunks because injected transports may reuse buffers.
Requests scope the complete response read and enforce an Effect timeout. The
Fetch adapter owns cancellation and reader-lock release. The stream finalizer
has a tested deadline even when host cancellation never settles.

Evidence: [contract.ts:15–81](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/contract.ts#L15-L81),
[response.ts:13–54](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/coordinator/_internal/response.ts#L13-L54),
[client.ts:337–351](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/coordinator/_internal/client.ts#L337-L351),
[media-stream.ts:5–37](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/media-stream.ts#L5-L37),
[MediaStream.test.ts:8–30](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/MediaStream.test.ts#L8-L30).

**Adopt:** validate at actual external/durable boundaries, decode only the
contract necessary for each decision, and bound complete I/O. Prefer the existing
Effect platform implementation; add custom stream ownership only for a reproduced
gap in the pinned version. Continue ts-release's preference for `Schema.Class`,
`Schema.TaggedClass` and its version-appropriate tagged error class constructor
for durable models; Reactor's many wire `Schema.Struct`s do not justify replacing
those models with plain interfaces.

### REC-E6 — Observability follows operation ownership and excludes payloads

Caller-cancellable acquisitions have caller-boundary spans; committed work has
spans inside its owned execution. Session ticks, frames and heartbeats are not
individually traced. A successful cleanup Effect does not imply successful remote
termination: explicit span attributes carry that verdict. Library-written error
messages and safe diagnostic JSON omit provider bodies, backend text and arbitrary
details; secrets remain `Redacted` values until the request boundary.

Evidence: [CONTRIBUTING.md:78](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/CONTRIBUTING.md#L78),
[errors.ts:1–16](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/errors.ts#L1-L16),
[client.ts:128–140](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/coordinator/_internal/client.ts#L128-L140),
[Spans.test.ts:53–90](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/Spans.test.ts#L53-L90),
[errors.test.ts:76–108](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/errors.test.ts#L76-L108).

**Adopt:** use named `Effect.fn` for meaningful operation boundaries and safe
identity/outcome attributes. A publish span must identify acknowledged, unknown,
pending observation or confirmed outcomes; its success flag alone is insufficient.
Test diagnostic serialization and exported telemetry against seeded secrets.

### REC-E7 — Test clocks, cancellation and installed contracts

The shared harness supplies concrete layers at the test boundary and accepts the
test runner's AbortSignal, so a timed-out test can interrupt its fiber and run
finalizers. Tests inject `TestClock` and advance it deliberately. One termination
test proves both HTTP requests time out and receive aborted signals even when
executed inside an uninterruptible finalizer.

The compiler-backed architecture checker rejects upward policy dependencies,
host-only imports outside native code, undeclared dependencies and runtime cycles;
type-only edges still obey layering without being counted as initialization
cycles. Export maps are explicit contracts. Pack qualification validates and
installs archives in isolated consumers, compiling examples against distributed
declarations rather than workspace resolution.

Evidence: [harness.ts:29–71](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/harness.ts#L29-L71),
[Sessions.test.ts:976–1026](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/Sessions.test.ts#L976-L1026),
[architecture.mjs:28–111](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/scripts/architecture.mjs#L28-L111),
[architecture.mjs:129–181](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/scripts/architecture.mjs#L129-L181),
[verification documentation](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/scripts/README.md).

**Adopt:** deterministic time and cancellation tests for real deadline/recovery
behavior; architecture checks for real dependency boundaries; packed-consumer
checks for public compatibility. Retain ts-release's existing packed and external
checks rather than build a parallel verification framework. Real network/server
and subprocess timing still needs an appropriate real-runtime check.

## Divergences and patterns to avoid copying

| Finding | Evidence and implication |
| --- | --- |
| Reusable Effect functions do not consistently follow Effect's own function guidance. | The reviewed client/browser/native source contains no `Effect.fn` call and one `Effect.fnUntraced`, in `packages/native/src/_internal/isolated/host.ts:181`. For example, [session/index.ts:109–119](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session/index.ts#L109-L119) and [response.ts:14–20](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/coordinator/_internal/response.ts#L14-L20) wrap `Effect.gen` in functions. The installed rc.115 guide recommends `fn`/`fnUntraced` for reusable operations. Keep ts-release's existing preference; trace useful boundaries and use untraced operations where appropriate. |
| The typed-failure/defect separation has an explicit supervision exception. | [session.ts:456–476](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session.ts#L456-L476) catches an entire `Cause` from a background task and converts any unrecognized cause into a typed `Protocol` failure with the original cause in `detail`. This preserves session failure reporting but collapses defect/interruption classification for callers. Do not adopt this as a general error adapter; specify any supervisor exception and preserve its original cause. This is a static implementation finding, not a reproduced production incident. |
| Callback-driven unsafe/mutable primitives are specialized machinery. | [lifecycle.ts:20–47](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session/_internal/lifecycle.ts#L20-L47) uses synchronous queue construction, unsafe Deferred creation and mutable collections; [lifecycle.ts:112–126](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/src/session/_internal/lifecycle.ts#L112-L126) forks scopes synchronously. These serve a transport generation boundary. The 1,421-line `session.ts` is not a module-size or state-management target for ts-release. Prefer structured effects and its existing durable owner unless a synchronous callback contract requires otherwise. |
| Error richness can become duplication. | The 924-line `errors.ts` has Schema classes, reason factories, diagnostic JSON projections and corresponding decoders. Privacy and dispatch evidence justify the design here, but four wrappers and the entire reason hierarchy are Reactor-specific. Preserve ts-release's smaller domain vocabulary and add evidence to the layer that owns it. |
| Some documentation overstates version pinning. | The main [manifest](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/package.json) declares aligned caret ranges at rc.117; the lockfile is the concrete installation authority. The [verification guide](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/scripts/README.md) still names the native consumer's rc.115 override in prose. Exact ts-release pins and fresh installed-consumer checks should remain authoritative; do not copy stale dependency literals from narrative documentation. |
| Custom test clocks and compiler patching are implementation choices, not the standard itself. | [harness.ts:65–94](https://github.com/mannyc2/reactor-effect-client/blob/f821a9084cf51e9aac591388db0788cb90501bf0/packages/client/test/harness.ts#L65-L94) manually owns a clock scope and drives promises, while `CONTRIBUTING.md:78` explains that skipping lifecycle scripts can leave an unpatched compiler that still passes ordinary typechecking. Adopt deterministic deadlines and enforceable rules; introduce new tooling only with a working gate and a need not already met by ts-release's Bun checks. |

## Translation into the ts-release refactor

1. Preserve capability injection and explicit CLI/runtime/test composition.
2. Use `Effect.fn`/`fnUntraced` for reusable operations and `Effect.gen` for
   workflow bodies; keep pure transformations ordinary functions.
3. Keep durable data and errors Schema-backed, respecting the pinned API and
   existing serialized/public contracts.
4. Make resources scoped and preserve interruption; permit narrowly documented
   masking only at atomic dispatch/ownership transitions.
5. Preserve typed failures, defects, dispatch uncertainty and cleanup evidence as
   separate facts; route recovery from evidence rather than broad exception text.
6. Use injected Effect clocks/platform services and bounded I/O. Verify timeout,
   body consumption and cleanup behavior at the real boundary.
7. Validate with focused semantic tests and the existing installed-package and
   architecture gates. An Effect-style refactor should not change release bytes,
   approval requirements, public errors or dispatch counts without an explicit
   separately justified behavior change.

The most valuable inheritance is the ownership and evidence discipline. The
review does not justify adopting Reactor's host/runtime complexity, replacing
ts-release's durable execution engine, or publishing anything.
