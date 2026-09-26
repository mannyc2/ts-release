# Native Sigstore signing settlement

Baseline: `17d491dfc0cbcbdb0653c233cc2981091c0dc321`, checkout
`/mnt/models/dev/ts-release/.standards-continuation`. This bounded slice owns only
the issued `Sigstore.attest` promise in
[`makeSigstoreAttester`](../../packages/npm/src/Auth.ts), one isolated regression,
and this task evidence. The previously qualified
[verification repair](native-sigstore-settlement.md) is unchanged.

## Contract and pinned SDK evidence

Effect 4.0.0-rc.115's zero-argument `tryPromise` does not join its promise on
interruption. Sigstore5's `SignOptions` exposes no cancellation signal. Its
`attest` implementation awaits the Fulcio signer and the configured witnesses
before returning the serialized bundle. Existing options select the production
Fulcio/Rekor URLs, one Rekor witness, `retry:0`, and `fetchOnConflict:false`.

Cancellation cannot undo a certificate or transparency-log mutation, including
one whose response is lost. An already-issued SDK call can continue those steps
after interruption with the baseline implementation too. The bounded repair
joins that same promise before restoring interruption. It does not introduce
another call, retry, approval, journal, public API or signing policy. On success,
pending interruption stops the continuation before encoding, verification or
candidate retention. If the SDK rejects during interruption, rc.115 preserves
the typed SDK failure instead; the repair does not suppress it or force an
interruption-only cause. A successful remote result can remain unretained; the
remote outcome is still potentially unknown. A stuck SDK call can delay
interruption, and its request timeout is not an overall attestation deadline.

The fixed `npm-sigstore-sign` / `Sigstore attestation outcome is unknown`
projection remains necessary. Pinned
`@sigstore/sign/dist/signer/fulcio/index.js` embeds the supplied token in its
`IDENTITY_TOKEN_PARSE_ERROR` message. No SDK exception or cause is exposed through
the typed failure. Approval and exact source/payload admission remain in their
existing owners. Ordinary verification and retained-candidate identities are
unchanged.

## Why this regression is necessary and bounded

Existing npm tests refuse unrelated source and empty identity before native
signing. The native verifier proof covers TUF/cache lifetime, not the signing
wrapper or its token-bearing SDK rejection. One
[`Bun test`](../../test/reimplementation/npm/signing-lifecycle.test.ts) therefore
runs an isolated supported Node
[`fixture`](../../test/reimplementation/npm/signing-lifecycle.mjs) with two
observations: ordinary privacy projection and interrupted rejection delivery.

The fixture uses the payload and matching source of the existing checked-in
Sigstore5 attestation. This only supplies valid local statement admission; it
does not assert native signature trust. The explicit OIDC capability supplies
harmless synthetic text that passes bearer admission but cannot supply a JWT
subject. The original pinned SDK generates its ephemeral key, then rejects that
token before certificate acquisition or challenge/artifact signing. No live
OIDC lookup, signing request, verification, TUF access or publication occurs.

HTTP/HTTPS request, global fetch and socket-connect tripwires are installed before
loading the SDK. Any attempted network operation throws and is counted. The
ordinary control checks the actual SDK's `IDENTITY_TOKEN_PARSE_ERROR`, confirms
its message contains the synthetic token, and requires the public Effect to fail
with the exact fixed typed diagnostic and no token in its rendered/serialized
cause. An unrelated failure cannot stand in for the expected SDK rejection.

The second call invokes the same original SDK and holds only delivery of its
real rejection. At that causal barrier, the fixture interrupts and drains rc.115
dispatcher work. It requires the Effect to remain pending until delivery is
released, then to retain the fixed typed native failure without a defect or
token leak. Both paths require zero network attempts. The `finally` releases and
joins the held SDK promise and cancellation
fiber before restoring instrumentation, including after baseline assertion
failure. The outer test kills and joins its isolated child after runner failure;
its watchdog bounds fixture failure and is not interruption timing evidence.

No successful SDK result, certificate, trust service or production test port is
substituted. This proof qualifies actual SDK rejection delivery on Node22.22.2.
It does not qualify successful live Fulcio/Rekor signing, OIDC claims, a remote
mutation window, Bun signing, or the absence of all possible SDK hangs.

## Genuine before-fix evidence

The source and compiled npm entry were unchanged when the formatted/linted
fixture ran:

```sh
timeout --signal=KILL 15s /tmp/node-v22.22.2-linux-x64/bin/node test/reimplementation/npm/signing-lifecycle.mjs
```

Exit **1**, log `/tmp/ts-release-signing-lifecycle-red.log`. The precise failure
was `Interruption completed before native attestation settlement`. Ordinary
privacy already passed, both original SDK calls produced the expected native
rejection, and failed-test teardown joined the held delivery:

```json
{
  "runtime": "v22.22.2",
  "attestCalls": 2,
  "nativeRejections": 2,
  "networkAttempts": 0,
  "privacyPassed": true,
  "pendingBeforeRelease": false,
  "nativeJoined": true
}
```

| Input or evidence                     | SHA256 at red                                                      |
| ------------------------------------- | ------------------------------------------------------------------ |
| `packages/npm/src/Auth.ts`            | `c0c686884f645567d44a39501c7c0e88944cd83f32977019504a119b76458d58` |
| `packages/npm/dist/Auth.js`           | `a3164b34759256d4b14fda689702bc03c89ed889cacae6b822e9b98fb618bf75` |
| `signing-lifecycle.test.ts`           | `d4faa39ac8621bd8bc9a0cc6586e4fae06746119019c68c7a8beb6fefc19eb6d` |
| `signing-lifecycle.mjs`               | `4d83dc53d3446462d00cb9c99f8af37e2ae2ee8fd36217151f1e677ca7ccc02b` |
| Existing Sigstore5 attestation JSON   | `ab9228005186f50e545239d7c34d08459a82fe166af867f9bbeeb9cc1a8a426e` |
| Installed `sigstore/dist/sigstore.js` | `6d987d4b8104630593d85fa63fd948fa978e55fcfe6cba4fa120947149cdcb38` |
| Installed Fulcio signer               | `34e2d45f44be0c1aa6d7c7bb66fea94b36b80c0ddf7ac90c51f175a777d21a17` |
| Installed JWT subject parser          | `b52ae97a8d080e4640c424bef506199a8cd883b2b6815af9ce47cd575d313569` |
| Red log                               | `ef168d91f5dde66fa58ecaf8657d3e221e8fa1f10f510bd6e062141d967d4c4a` |

## First after-fix run exposed an incorrect test expectation

After that genuine failure, only the attestation `tryPromise` gained
`Effect.uninterruptible` and a lifetime/uncertainty comment. Frozen source SHA256:
`e37fed85ca11f72ee2bb68c22cde6fe3dc4bb1310e9211e282109067c5410ed4`.
The coordinator rebuilt npm successfully, then ran the original byte-identical
fixture. That first after-fix run **failed**, log
`/tmp/ts-release-signing-lifecycle-green-native.log`: the pending-settlement check
now passed, but the test incorrectly required `Cause.hasInterruptsOnly` after the
held SDK rejection was released. This was not a successful green run.

One narrow rerun added safe Cause flags before that assertion. It observed
`hasFails:true`, `hasInterrupts:false`, `hasDies:false`; log
`/tmp/ts-release-signing-lifecycle-cause-observation.log`, exit **1** at the same
overstrong assertion. Pinned `effect/src/internal/core.ts:538` explains this:
`Failure.evaluate` skips failure continuations while interrupted and ultimately
yields the original failure. Reading only `setInterruptibleTrue` had missed
that failure path. The production implementation was not changed to suppress
the native failure.

The corrected fixture requires the pending barrier and preserved safe typed
`npm-sigstore-sign` rejection, without defects or token exposure. It records,
but does not require, the absence of an interrupt reason. Its final SHA256 is
`dad646bcab2fe19e85997eca66fd7f34a7de5ee94a7bec69fd2b3f3a5b65e32e`;
the outer Bun test remains byte-identical to its initial version.

## Corrected baseline control and passing qualification

The corrected assertion was written **after implementation**. To establish that
it still detects the real defect, an ephemeral byte-identical copy ran in
`.native-settlement` at `fc7d1412a75509f48f39f0e551affe7432ee2432`. That checkout
has the original unmasked Auth source and compiled hashes shown in the red table,
and the exact same Effect runtime and Sigstore implementation bytes. No baseline
source, dist or dependency was changed. The temporary fixture path was required
to be absent, created exclusively, and removed in `finally` after child exit.

That corrected baseline control failed with exit **1** at the original pending
settlement assertion; log
`/tmp/ts-release-signing-lifecycle-corrected-baseline.log`. It again reported two
real native rejections, zero network attempts, successful ordinary privacy and
joined failed-test teardown. This is a post-implementation baseline control, not
replacement evidence for the genuine initial red.

The identical corrected fixture then passed against the rebuilt repair, exit
**0**, log `/tmp/ts-release-signing-lifecycle-corrected-green-native.log`:

```json
{
  "runtime": "v22.22.2",
  "attestCalls": 2,
  "nativeRejections": 2,
  "networkAttempts": 0,
  "privacyPassed": true,
  "pendingBeforeRelease": true,
  "nativeJoined": true,
  "rejectionPreserved": true,
  "settledHasInterrupts": false
}
```

The Bun wrapper also passed (**1 test**) using
`TS_RELEASE_HTTP_PEER_NODE=/tmp/node-v22.22.2-linux-x64/bin/node`; log
`/tmp/ts-release-signing-lifecycle-green-wrapper.log`. Targeted formatting and
strict lint exited **0**; lint log
`/tmp/ts-release-signing-lifecycle-lint.log`.

| Final input or evidence               | SHA256                                                             |
| ------------------------------------- | ------------------------------------------------------------------ |
| `packages/npm/src/Auth.ts`            | `e37fed85ca11f72ee2bb68c22cde6fe3dc4bb1310e9211e282109067c5410ed4` |
| `packages/npm/dist/Auth.js`           | `98c0750bcf12888a942d91c726b0acd0b3a97d8fb8177b544d274e1bc45d2dd9` |
| Corrected `signing-lifecycle.mjs`     | `dad646bcab2fe19e85997eca66fd7f34a7de5ee94a7bec69fd2b3f3a5b65e32e` |
| Unchanged `signing-lifecycle.test.ts` | `d4faa39ac8621bd8bc9a0cc6586e4fae06746119019c68c7a8beb6fefc19eb6d` |
| First after-fix assertion-failure log | `54b42a69b2a078f79a4aefab597cf8ccc9d98a32d43f963e22c66f0bdc34b7d5` |
| Safe Cause observation log            | `c4e9648f228c689d3324970695d276afc9176cf7bed024f1bc7e58c4515b28ab` |
| Corrected baseline control log        | `e5e7918293c88e144258d5c556a03fa1b083b21b0c7e331156217f7fc9ec0a06` |
| Corrected native green log            | `09ffcb90d07e712dad4fc0acc57bb4fe33e26cac3702b73b644d1691df25053a` |
| Bun wrapper green log                 | `e866c2c5f47f7dd8dac15e14e69f45246f1a19e19b018c9ddaa3afcb20c998f0` |

The coordinator owns combined static/build, delivery and packed consumers. No
full gate, package-consumer, successful network or live signing qualification is
claimed by this slice. Its owner performed no builds, packing, publication or
commits.

An integrator invocation of the Bun wrapper without `TS_RELEASE_HTTP_PEER_NODE`
failed the existing runtime gate before SDK invocation: the environment's `node`
command actually launched Bun 1.4.2 (Node compatibility string v26.3.0), yielding
`npm-sigstore-runtime`. Log `/tmp/ts-release-signing-lifecycle-final-wrapper.log`.
It does not establish a Node 26 failure or invalidate the identical wrapper's
recorded pinned-Node green. No production change followed; the pinned result
above is reused instead of repeating a successful check.
