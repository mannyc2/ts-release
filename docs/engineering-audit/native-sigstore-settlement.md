# Native Sigstore verification settlement

Baseline: `5227a01f5dbcc722ff5c9971f72106cf2e8fcdee`, checkout
`/mnt/models/dev/ts-release/.native-settlement`. R12/R24–R29 bounded verification
repair; no signing/publication or dependency/configuration changes. Root built
unchanged baseline successfully before the reproduction; its log is
`/tmp/ts-release-native-settlement-baseline-build.log`.

## Ownership and proof decision

Production `makeSigstoreVerifier` owns a single noncancellable SDK Promise. Exact
pinned sources: Effect 4.0.0-rc.115, sigstore 5.0.0, @sigstore/tuf 5.0.0, tuf-js
6.0.0. `VerifyOptions` has no AbortSignal. `Sigstore.verify` awaits real TUF work
then performs native trust verification. TUF creates/removes temporary
directories, closes download streams, and writes admitted cache metadata/targets.
The existing interruptible zero-argument Effect.tryPromise does not join that
Promise on interruption.

The existing native Sigstore consumer verifies authentic provenance plus corrupt
signature, certificate, Merkle proof and source controls, but never interrupts.
One additional actual-SDK lifecycle proof is justified because premature Effect
completion permits that SDK to keep using application-owned cache/filesystem
state after the caller begins teardown. It runs only in the existing explicit
native Sigstore profile, not the network-free ordinary Bun behavior suite.

`native-sigstore-lifecycle.mjs` runs in an isolated supported Node process. It
calls the real `fs/promises.mkdtemp`, then holds delivery of the first TUF-created
directory's completion. The syscall is not held or replaced. The local
pass-through observer on pinned `sigstore/dist/sigstore.js` invokes the original
`verify` exactly once with unchanged arguments and returns its original Promise;
it retains that Promise solely to join teardown even when baseline Effect
interruption has already completed. No successful verifier, TUF response, trust
result, filesystem, or production test port is substituted.

The fixture interrupts only after the causal native completion barrier and drains
rc.115 dispatcher work rather than sleeping. It requires the Effect still to be
pending, then releases the barrier and requires interruption, authentic SDK
success, and absence of every real TUF temporary directory. Finally always
releases and joins SDK/fiber work before restoring instrumentation. The enclosing
native consumer uses a 60s SIGKILL process watchdog solely as a failed-fixture
bound. Each lifecycle run owns a fresh TUF cache. Existing positive and corrupt
controls remain unchanged.

## Genuine before-fix evidence

Command, from the baseline checkout (external access was granted for public TUF
reads and isolated temporary cache writes):

```sh
timeout --signal=KILL 60s /home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node test/reimplementation/npm/native-sigstore-lifecycle.mjs test/reimplementation/npm/fixtures/sigstore-5.0.0-attestations.json /tmp/ts-release-native-sigstore-Q15YoW/source.json /tmp/ts-release-native-sigstore-Q15YoW/root.json /tmp/ts-release-sigstore-settlement-red-DbVIfb/tuf > /tmp/ts-release-sigstore-settlement-red.log 2>&1
```

Exit **1**, raw log `/tmp/ts-release-sigstore-settlement-red.log`. The decisive
assertion was `Interruption completed before native Sigstore settlement`.
Finally emitted authentic `nativeVerified:true`, `verifyCalls:1`, and
`removedTufDirectories:5`; therefore network/native trust failure did not stand
in for the intended red. The original SDK completed successfully after the
premature interrupted exit, and all five real temporary directories were removed
before process exit. No Auth.ts production edit preceded this run.

The retained source/root inputs are from the existing authentic native Sigstore
fixture setup, using the checked-in sigstore@5.0.0 provenance and bundled TUF
root. No publishing credentials, external attestation, or fake trust were used.

| Input | SHA256 at red |
| --- | --- |
| `packages/npm/src/Auth.ts` | `f645496f8d642801457286af66cc28299bc842b47572081af5bbf35b81b17e68` |
| `packages/npm/dist/Auth.js` | `60e88b5cbd655d2228782b59b9b16a75c115aff2a5cba3f1b4f29c633ace45f3` |
| `native-sigstore-lifecycle.mjs` (before formatting) | `b57b3a2c019ba5a3a30f458f2b980813a48fe7889333b5c8b486d41960573a39` |
| `fixtures/sigstore-5.0.0-attestations.json` | `ab9228005186f50e545239d7c34d08459a82fe166af867f9bbeeb9cc1a8a426e` |
| `/tmp/ts-release-native-sigstore-Q15YoW/source.json` | `d1b6ef1b1365c5c54b105b7a96c36cfaf4e9b890bb3871d91d22cf159a81983b` |
| `/tmp/ts-release-native-sigstore-Q15YoW/root.json` | `73747011d0857ada15479a16c4cae0f3ed03aac698b523b97e1de314ac9d9ca8` |
| `node_modules/effect/AGENTS.md` | `e155acab559b29e0a54acd0f5d8d4b7a428268ba6eb1aba4d62b4876d6b1a78e` |
| `node_modules/sigstore/dist/sigstore.js` | `6d987d4b8104630593d85fa63fd948fa978e55fcfe6cba4fa120947149cdcb38` |
| `node_modules/tuf-js/dist/utils/tmpfile.js` | `d34560fed7be090f0fc61bb9ef9be64aa2e23019f96d1cb9b20ebb627ac9c28c` |

## Repair and current limits

Only the existing verification `Effect.tryPromise` is made uninterruptible.
Effect rc.115 restores the caller's interruptibility at that operation's
boundary and delivers pending interruption before subsequent Fulcio extension
admission. Structural/source admission, supported-Node refusal, fixed
`npm-sigstore-verify` projection, retry zero, timeout, trust/cache configuration,
and `Sigstore.attest` remain unchanged. No runtime service or public API is added.

Joining does not roll back valid cache writes or make the SDK cancellable. A
stuck native call can delay interruption; the per-fetch timeout is not an overall
verification deadline. This proof qualifies the exact Node/SDK fixture and
controlled native-completion window, not all native I/O failure combinations or
Bun native trust support. Full native-profile and workspace qualification remain
coordinator-owned; the focused green evidence below does not claim those gates.

Targeted formatting completed with pinned Bun1.3.14 and Prettier. Targeted strict
lint command (exit 0):

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun node_modules/oxlint/bin/oxlint -c .oxlintrc.json --deny-warnings --report-unused-disable-directives-severity error packages/npm/src/Auth.ts test/reimplementation/npm/native-sigstore-consumer.mjs test/reimplementation/npm/native-sigstore-lifecycle.mjs
```

Its initial run rejected the JavaScript fixture's inferred retained-Promise type
at `await issuedVerification`; a JSDoc `Promise<unknown> | undefined` annotation
now records the actual pinned SDK return contract. No rule was suppressed and no
runtime proof behavior was changed. Other fixture differences since red are
formatting only. The red log SHA256 is
`c0ece37d8552b724dfd372741beee6931a2d28bca10c9583679ddff9b346cd99`.

## Focused after-fix evidence

Root's targeted patched compiler check plus npm/self-release builds passed with
exit 0, recorded at `/tmp/ts-release-native-settlement-target-build.log`. After
that compilation, the same lifecycle proof ran with the same authentic inputs
and a fresh isolated cache:

```sh
timeout --signal=KILL 60s /home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node test/reimplementation/npm/native-sigstore-lifecycle.mjs test/reimplementation/npm/fixtures/sigstore-5.0.0-attestations.json /tmp/ts-release-native-sigstore-Q15YoW/source.json /tmp/ts-release-native-sigstore-Q15YoW/root.json /tmp/ts-release-sigstore-settlement-green-mB0tHJ/tuf > /tmp/ts-release-sigstore-settlement-green.log 2>&1
```

Exit **0**. Before releasing native completion, the interrupted Effect remained
pending. After release it exited with interruption only, after all actual TUF
directories were removed; joining the original SDK Promise confirmed authentic
verification success. Output:

```json
{"runtime":"v22.22.2","nativeVerified":true,"verifyCalls":1,"removedTufDirectories":5}
```

Between red and green, the lifecycle test changed only in formatting and the
JSDoc retained-Promise annotation. Its behavior/assertions and authentic inputs
did not change. The production repair is confined to
`packages/npm/src/Auth.ts:269–284`. Existing positive and corrupt controls in
`native-sigstore-consumer.mjs` are unchanged; `:57–69` adds the isolated child.
Those existing controls were not rerun independently in this focused turn.

| Final input/output | SHA256 |
| --- | --- |
| `packages/npm/src/Auth.ts` | `c0c686884f645567d44a39501c7c0e88944cd83f32977019504a119b76458d58` |
| `packages/npm/dist/Auth.js` | `a3164b34759256d4b14fda689702bc03c89ed889cacae6b822e9b98fb618bf75` |
| `native-sigstore-consumer.mjs` | `34be360167bbd4f33a232051fffb42c199a38cff1e9c0c11ceebc5c6e6d6bcd7` |
| `native-sigstore-lifecycle.mjs` | `fe7233545ff3ebcf239c864b19eea99d95d0d6d116f8f80a3ac8c2a5f7ba8502` |
| `/tmp/ts-release-sigstore-settlement-green.log` | `c9335bac75876560f5249fe8906e7ef65ca1fe1c05db34e886b0d1af333dbb9b` |

No full gates, packing, signing, publication or commits were performed by this
owner. The coordinator will qualify the integrated checkout and update status.

## Integrator qualification

The existing `bun run check:native-npm-sigstore` passed with
`TS_RELEASE_NATIVE_NODE=/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node`.
It verified the authentic fixture, rejected the existing signature, certificate,
Merkle-proof and source controls, and successfully ran the new isolated lifecycle
child before writing its existing receipt. This closes the parent/child path and
exit-propagation integration gap left by the focused helper run. Log:
`/tmp/ts-release-native-settlement-sigstore-profile.log`; retained native work:
`/tmp/ts-release-native-sigstore-rlj02T`; receipt:
`.release/checks/native-sigstore.json`. Exit 0; no signing or publication.

This narrow command ran against the already-qualified targeted npm compilation
while the shared full-gate lock path was being resolved; it performs no build or
packing. The coordinator then supplied `/tmp/the-show-full-verification.lock`.
Full static checks, delivery generation and the existing packed npm profile
passed serially under that nonblocking lock. The resulting `Auth.js` hash is
still `a3164b34759256d4b14fda689702bc03c89ed889cacae6b822e9b98fb618bf75`,
identical to both successful native runs. Native inputs did not change, so that
network proof was reused rather than repeated.

Packed core/npm consumers passed actual Bun and npm installation, strict public
declarations, absence of optional peers, and existing provider behavior under
Node22.22.2 and Bun1.3.14. The new npm archive SHA256 is
`b1f8c88d8d992c2061fc4629b852ca8072b12dfb1ec674d622d8a895d0dc5c33`;
core remains `04a2cc6093692c3281a4962f03dd39d771c527c1e4bb964077f88a8c6c588bf1`.
Receipt `.release/checks/current-packed-npm.json` names
`/tmp/ts-release-packed-npm-VVrV70`. The packed behavior uses its explicit
provider fixture; native cryptographic trust is established by the separate
actual-SDK witness above, not by that fixture. These checks do not qualify live
npm/OIDC, signing, Bun native Sigstore, or other hosts.
