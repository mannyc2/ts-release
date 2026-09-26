# Effect standards adopted from the consumer review

Browserbase and Reactor are useful references for ownership, dependency
composition, typed outcomes, and behavioral tests. Neither is a style template
to copy wholesale. The source reviews are
[Browserbase](adoption-audit/effect-patterns-browserbase.md) and
[Reactor](adoption-audit/effect-patterns-reactor.md), pinned to their September 25
main commits. The implementation baseline here is ts-release 0.4.2 at
`fa50ce368c50e9a28a2e57f667d454374e7b209c`, with Effect rc.115.

## Standards and their concrete application

| Standard                                                         | Consumer evidence                                                                                                        | Application in ts-release                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depend on explicit capabilities and compose layers at boundaries | Browserbase resource services share a client; Reactor supplies `PeerFactory` per host.                                   | Keep the existing `Host` service and provider interfaces. The Effect-native application runner preserves caller service requirements and uses the caller's runtime; the Promise runner remains an outer adapter. No duplicate service hierarchy is needed. |
| Scope each owned resource and join cleanup                       | Their maintained owner paths register cleanup before use and join it on exit; the source reviews identify exceptions.    | File content operations acquire and release each handle/temp path through Effect brackets. Already-issued native file operations settle before finalizers close their handles; cancellation is checked between those operations.                           |
| Preserve cancellation as control flow                            | Both libraries distinguish lifecycle cancellation from remote mutation outcome; their boundary tests exercise cleanup.   | HTTP credential acquisition retains interruption instead of reclassifying it as `http-credentials`. Credential failure/defect payloads still cross a redaction boundary.                                                                                   |
| Defer extension factories inside the intended boundary           | Browserbase's `use` callback does this; a writer verification callback does not, exposing a reproduced lifecycle defect. | The composable application factory is suspended inside its scope. Test thrown construction defects separately from returned typed failures, defects, and interruption.                                                                                     |
| Preserve inferred error and service types                        | Browserbase has public workflow type assertions; Reactor exposes concrete capability requirements.                       | `CreateApplication` and the Effect runner retain factory `E`/`R`; compile-time tests and packed declarations check the public seam.                                                                                                                        |
| Model durable facts with schemas                                 | Both separate validated external data from runtime handles and model uncertain outcomes.                                 | Retain existing Schema-backed Bundle, Plan, journal, errors and receipts. Do not replace every interface, closure or native handle with a Schema class.                                                                                                    |
| Use useful operation names, not mechanical tracing               | Browserbase uses named public functions; Reactor primarily uses ordinary functions and explicit spans.                   | Keep ts-release's `Effect.fn` convention and name file-content/application operations. Pure transforms remain ordinary functions.                                                                                                                          |
| Test the actual owner, isolate only external edges               | Both have lifecycle tests, injected services, compiler rules and packed-consumer checks.                                 | Exercise the real content store, application interpreter and HTTP credential boundary. Reuse the existing architecture/export/packed gates rather than invent a parallel harness.                                                                          |

## Ownership and native I/O

An `Effect.tryPromise` around an entire mutable async workflow does not make the
workflow cancellable. The fiber can finish interruption while the Promise keeps
writing files or running cleanup outside the fiber's scope. Convert such a
workflow into Effect steps with an explicit resource bracket.

Some native filesystem operations cannot be cancelled safely. Once issued, they
must settle before a handle is closed or a temporary path removed. Mask that
individual operation and its resource transition; restore interruption between
steps. This does not justify masking a whole copy, publication, or release.
Disk/native calls that never settle can still delay interruption; changing
that requires a different host I/O contract, not detaching work and reporting
cleanup as complete.

`fileContentOwner.putOwned` deliberately copies caller bytes when the operation
is constructed. Preserve that existing snapshot guarantee even though the disk
workflow itself is lazy. Returned content identities and immutable installation
semantics remain unchanged. Recovery still verifies existing content rather
than trusting the existence of a digest-named path.

## Failures, defects, interruption, and privacy

Use typed failures for documented operational outcomes. Unexpected application
defects should retain their Cause so an Effect caller can distinguish them from
ordinary refusals. A synchronous exception while creating a callback Effect is
still a defect; it must pass through the same finalization boundary.

Credential acquisition is an explicit exception for diagnostics: even a typed
caller error may contain a token. Both its failures and defects are replaced
with a fixed safe error. If the Cause includes interruption, retain interruption
and remove potentially secret failure/defect payloads. This preserves the
cancellation decision, not the original complete Cause or interruptor identity.
CLI presentation remains separate from the Effect caller's error channel.

A finalizer's result is not publication evidence. Never erase an accepted or
unknown dispatch because later cleanup fails. Conversely, a successful cleanup
Effect is not proof of public registry visibility. Keep the durable journal as
the release authority and derived reports as observations of that authority.

## Effect composition and compatibility

`runApplicationEffect(createApplication, input, mode)` owns one application
scope and returns an Effect. It does not create a runtime, install process
signal handlers, or override caller logging. Supply application dependencies
with layers outside that operation. Its factory can retain concrete typed
errors and services; the runner consumes the lifecycle `Scope` requirement.
Its error channel is the factory's `E | ReleaseError | AdoptionError`; Bundle
admission can fail with `AdoptionError` before dispatch.

The existing `runApplication(path, input, signal, mode)` loads trusted application
code and uses the same interpreter. It remains the Promise/AbortSignal boundary
for CLI and non-Effect hosts. Observe mode still calls trusted application setup,
then observes providers without granting publication authority.

There is one intentional diagnostic change at both entrypoints: a synchronous
throw from `createApplication` now remains a defect inside the application
scope. Previously the Promise adapter preserved thrown `ReleaseError` values
as typed failures and normalized other construction exceptions to `invalid-data`.
Return `Effect.fail(error)` for an expected factory failure. Malformed module
exports and non-Effect return values still receive
their existing typed validation errors. Process diagnostics continue to redact
arbitrary defect details.

The composable runner is a source-checkout addition; it is not present in the
already-published 0.4.2 package. Build/pack this checkout to evaluate it. No
package version, dependency pin, release identity format, authorization rule or
publication was changed as part of this refactor.

## Patterns deliberately not adopted

- Browserbase's writer callback-construction flaw is a regression example,
  not a model. Consumer code was reviewed but not modified here.
- Reactor's absence of `Effect.fn` in most reusable functions does not override
  ts-release's existing convention.
- Module-global browser permits, mutable media-session state, custom in-memory
  submission protocols and model-facing error projections are domain-specific.
  The release kernel already owns durable execution and uncertainty.
- Fetch-based platform HTTP is not substituted for ts-release's one-request
  native transport: no-replay and exact-wire behavior are existing release
  requirements that a stylistic refactor must preserve.
- The consumers' rc.117 APIs and test-runner choices are not dependency upgrade
  requirements. The implementation remains on aligned rc.115 packages and Bun.

## Review and verification expectations

Review ownership first: what can outlive the caller, when ownership transfers,
and what durable evidence remains after failure? Then inspect types and module
boundaries. A new service, schema, error variant, helper layer, or test must own
a concrete responsibility rather than exist solely for stylistic consistency.

For a resource or extension seam, exercise success and the relevant typed
failure, construction throw, defect, and interruption paths. Use deterministic
latches/Deferred values for ordering; use `TestClock` for Effect-clock deadlines.
Native socket/process/filesystem behavior still needs real runtime tests. Assert
cleanup, exact bytes, dispatch counts and retained uncertainty, not only a
successful exit.

Run `bun run check` and the relevant `bun run test` cases. Public declaration
changes also require the packed-kernel gate; CLI/Action boundary changes require
their existing behavioral checks. These are checks of candidate code, not
authorization to publish it.
