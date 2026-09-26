# Native lifetime prerequisites

Planning snapshot: **2026-09-26**, baseline
`f2266bd7065cb1378a1fbf95cc0172c7f1b389e4`. The two source owners are unchanged
from the preceding `f82f4a1` review. These are source-confirmed ownership gaps,
not reproduced leaks, repaired behavior or a claim of cache corruption. No
source/test changes, builds or native execution were performed for this review.
See [implementation status](implementation-status.md) for completed milestones.

Pinned sources inspected: Effect **4.0.0-rc.115**, Sigstore **5.0.0**,
`@sigstore/tuf` **5.0.0**, and `tuf-js` **6.0.0**. Installed dependency paths below
identify version-specific evidence, not files shipped with this research record.

## Effect ownership contract

In the installed `effect/src/internal/effect.ts`, `tryPromise` at 1108–1134
registers Promise handlers without a native settlement finalizer. Its callback
machinery at 1157–1185 ignores later completion after interruption. Both reviewed
owners supply zero-argument Promise callbacks, so no AbortController is allocated.
Adding a signal parameter would not establish cancellation unless the operation
supports it, nor would signal delivery alone join its settlement.

`acquireUseRelease` at 4346–4358 masks acquisition/release and restores use. A
noncancellable use operation still needs settlement ownership. The repaired
[ContentStore](../../packages/ts-release/src/platform/ContentStore.ts#L15) is an
existing local example: bracket the actual handle, join each issued native
operation, and permit interruption between operations. Reuse that ownership
principle without adding a generic service or masking an entire workflow.

## Self-release input reads

[Model.read](../../apps/self-release/src/Model.ts#L119) runs open/stat/read/close
inside one async callback passed to interruptible `io`. Its native finally
eventually closes an opened handle, but the Effect can already have delivered
interruption while that callback continues into stat/read/close. A late close
failure is then detached from the delivered Effect exit.

Retain numeric `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`, regular-file admission,
the caller's size bound, exact stat/read byte count, owned returned bytes and the
fixed `release-application-file` failure. These inputs feed actual
[preparation](../../apps/self-release/src/prepare.ts) and
[candidate admission](../../apps/self-release/src/application.ts), not an unused
utility. Node's installed `fs/promises` declarations permit a signal for readFile
and specify that close waits for pending operations; this does not make open/stat
cancellable.

The smallest proposed repair moves this read operation into `Effect.fn`/`gen`,
brackets the native handle, and joins each issued open/stat/read/close operation
before moving on. Keep expected file failures under the current safe projection.
Leave the shared `io` helper alone: other callers create candidate directories
and write Bundle/Plan files, and a read repair must not silently change them.
An indefinitely stuck native call can still delay cancellation. Joining also
does not by itself prove simultaneous body/cleanup failure observability; any
change to that error combination needs explicit evidence.

[Existing application cases](../../test/reimplementation/self-release/application.test.ts)
protect retained original bytes, immutable release authority and changed
Bundle/Plan/content refusal. They do not control interruption during native
acquisition or reading. Before implementation, justify one actual-owner regression
that holds delivery of a real open/read completion in an isolated supported Node
process. Follow the existing
[ContentStore causal fixture](../../test/reimplementation/kernel/content-store-lifecycle.mjs):
interruption must remain pending before release, then complete as interruption
after the actual handle closes. Release barriers and join teardown even after a
failed assertion. Do not replace FileHandle, add a public seam, use a stabilization
sleep, or claim the syscall itself was blocked when only result delivery was held.

## Native Sigstore verification

[makeSigstoreVerifier](../../packages/npm/src/Auth.ts#L255) uses an interruptible,
zero-argument `tryPromise` for the actual `Sigstore.verify` call. Structural/source
admission and the supported-Node check precede it; Fulcio extension checks follow
it. The native failure policy is already explicit:
`npm-sigstore-verify: Sigstore native trust verification failed`. Preserve it
without exposing SDK diagnostics or changing trust configuration.

Pinned `sigstore/dist/config.d.ts:5–8,19–31` exposes retry/timeout and TUF options,
but **no AbortSignal**. `dist/sigstore.js:73–110` first awaits TUF trusted-root
acquisition and then performs synchronous native verification. Passing an
unsupported signal would not cancel that work.

The operation owns more than network reads:

| Installed dependency source                                                    | Native work                                                                                   |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `@sigstore/tuf/dist/client.js:63–83`                                           | Creates cache directories and seeds root.json from the supplied root.                         |
| `tuf-js/dist/utils/tmpfile.js:16–24`, `dist/fetcher.js:20–48`                  | Creates/removes temporary directories, streams download files and awaits stream close.        |
| `tuf-js/dist/updater.js:133–138,361–366`; `@sigstore/tuf/dist/target.js:25–40` | Writes admitted metadata and verified targets to the configured cache, then reads the target. |

Verification does not publish a package, but it can write local caches after an
Effect interruption has detached from the Promise. This review did not reproduce
that sequence or observe a leaked handle. The SDK's `AbortSignal.timeout` in
`tuf-js/dist/fetcher.js:94–100` belongs to each fetch, independently of Effect.
`retry: 0` disables retry attempts; several metadata/root/target fetches may still
occur. The setting is not an overall verification deadline.

The smallest proposed repair masks only the existing native verification Promise
until it settles, then restores interruption before extension admission and other
workflow steps. Keep the real SDK, fixed failure projection and trust/cache
configuration. This neither rolls back valid cache writes nor guarantees prompt
interruption if native I/O never settles.

Before implementation, design one deterministic actual-SDK interruption proof in
an isolated supported Node process, using authentic bundle/source/root inputs.
Hold delivery of a real SDK-owned native completion, interrupt causally, and
require real cleanup before the interrupted Effect exit. Teardown must release
and join the SDK on failure. A fabricated successful verifier or fake trust result
cannot establish this contract.

The retained
[native Sigstore consumer](../../test/reimplementation/npm/native-sigstore-consumer.mjs),
driven by [check-native-npm-sigstore](../../scripts/check-native-npm-sigstore.ts),
independently verifies public provenance through actual TUF, signatures,
certificates and transparency proofs, with negative controls. It never
interrupts. Keep its positive authentic witness. The
[Bun auth case](../../test/reimplementation/npm/auth.test.ts#L409) deliberately
refuses before TUF and cannot qualify native verification lifetime.

The neighboring [Sigstore.attest](../../packages/npm/src/Auth.ts#L386) uses the
same Promise form but can publish to Fulcio/Rekor. Its authorization and uncertain
outcome policy requires a separate bounded decision; a verification repair does
not authorize changing it or performing real signing.
