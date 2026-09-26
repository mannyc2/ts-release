# Self-release candidate write settlement

Public baseline: `8b80d967fb6ae68aa40daf398e5bce4f86b803d4`. The unchanged
preparation reproduction ran after the independent catalog slice was committed as
`d7837c5ddbf4196e3e79f5cd9984263ebc00e734`, in
`/mnt/models/dev/ts-release/.standards-continuation`. The coordinator confirmed
that the compiled preparation entry still represented the unchanged baseline.
This is task evidence, not a published package input.

## Contract and bounded repair

[`prepareRelease`](../../apps/self-release/src/prepare.ts) owns three remaining
native candidate mutations: exclusive candidate-directory creation, exclusive
`bundle.json` write, and exclusive `plan.json` write. Its zero-argument
`Model.io` promises previously allowed interruption to complete while an issued
native operation's result remained pending. The already-qualified file reader
and content owner have separate lifetime contracts.

The repair masks each of those three issued promises separately. Interruption
is restored between operations; it does not protect the entire preparation
workflow. Directory mode `0700`, file mode `0600`, `recursive:false`, `wx`, exact
Bundle bytes, Plan serialization, ordering, identity calculation and approval
remain unchanged. Interrupted or failed candidates remain inspectable; no file
is removed, replaced, retried or treated as a complete candidate. A native call
that never settles can delay interruption. This adds no fsync/crash-durability
guarantee and does not make the multi-file candidate atomic.

The shared `Model.io`/`Model.attempt` policies, signing, generated starter and
public APIs are unchanged in this slice. Expected native failures retain the
existing fixed `release-application-<subject>` diagnostic. No native cause,
filesystem path or secret is added to that failure contract.

## Why this one regression is retained

The existing preparation test checks original retained bytes, Bundle/Plan
identity, dependency order and refusal to reuse the candidate directory. Other
existing application tests cover cohort and provenance approval. None interrupts
an issued candidate write.

[`write-lifecycle.test.ts`](../../test/reimplementation/self-release/write-lifecycle.test.ts)
runs one isolated Node child, using the coordinator-built production application
and the existing checked-in npm `native-package.tgz`. No archive packing,
publication, credentials, OIDC or network are needed. The
[`child`](../../test/reimplementation/self-release/write-lifecycle.mjs) invokes
the original `fs.writeFile` with the original arguments, then holds delivery of
the completed `bundle.json` write. It does not replace the filesystem or pretend
that a syscall remains blocked.

At that causal barrier, the test requests interruption and drains rc.115
dispatcher work. It requires the preparation fiber to remain pending until the
write delivery is released. It then requires interruption only, no Plan write,
and unchanged retained Bundle bytes. The `finally` releases and joins the actual
write's delivery promise and cancellation fiber even when the baseline assertion
fails. The parent removes its directory only after child exit; its test-finalizer
also kills and joins the child on runner failure. The process watchdog bounds a
stuck fixture and is not timing evidence.

This proves the controlled Bundle-write delivery window. It does not claim an
interruption matrix for mkdir/Plan writes; their identical per-issued-operation
ownership is checked in the source diff. Existing preparation tests remain the
independent byte/identity/approval evidence.

## Genuine before-fix evidence

Source and compiled preparation were unchanged when both runs below failed.
The test was formatted before either run; both test files are frozen for the
first after-fix execution.

```sh
TS_RELEASE_HTTP_PEER_NODE=/tmp/node-v22.22.2-linux-x64/bin/node /tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/self-release/write-lifecycle.test.ts
```

Exit **1**, log `/tmp/ts-release-candidate-write-red.log`. The child reached the
actual write barrier and failed at `Interruption completed before native Bundle
write settlement`. Bun's rendered expectation message omitted the child's stdout
diagnostic, so the same unchanged Node fixture was also invoked directly with a
fresh `mktemp` directory, removed by the shell after process exit:

```sh
/tmp/node-v22.22.2-linux-x64/bin/node test/reimplementation/self-release/write-lifecycle.mjs "$candidate_fixture"
```

Exit **1**, log `/tmp/ts-release-candidate-write-red-native.log`. It failed at the
same assertion and emitted the joined teardown evidence before exiting:

```json
{
  "runtime": "v22.22.2",
  "bundleWrites": 1,
  "planWrites": 0,
  "pendingBeforeRelease": false,
  "nativeWriteJoined": true
}
```

| Input or evidence                   | SHA256 at red                                                      |
| ----------------------------------- | ------------------------------------------------------------------ |
| `apps/self-release/src/prepare.ts`  | `9921caf6af8199abce60982d584172fb14cde03b18465bc7c82220df5d9e7e01` |
| `apps/self-release/dist/prepare.js` | `3b4fdaceead2fab10614b197ab480bae884890afea22306ae18baa3a992468e8` |
| `write-lifecycle.test.ts`           | `fb22a0aed4fd4cdb0bd4910f766a8879ecd14e8fb238bda6bf88d97eed4c44d8` |
| `write-lifecycle.mjs`               | `3e0dc8fe99e5edcf14353e97715a4a5c948b28637bf2d556f504bee3210de2ad` |
| Existing `native-package.tgz`       | `fe871fc21fc056d9f745cb0a8318abf9c90ecc985cd77a6acce267de198a8365` |
| Installed `effect/AGENTS.md`        | `e155acab559b29e0a54acd0f5d8d4b7a428268ba6eb1aba4d62b4876d6b1a78e` |
| Bun red log                         | `e7daa30cdee2214c165d9305a38f522a97e1f50a5596be77e4609b7f81828e0a` |
| Direct Node red log                 | `8cb731c6dab24b54c7ae7fb5be73770f00d7d2fca0d4e217783e270141aa5d6d` |

## After-fix qualification

After both genuine failures, the three per-call masks and their lifetime comment
were applied. Frozen source SHA256:
`2d62a461b62d0ab695b81dd8fd1fa73157c00625f0f4e50fd03ac5993b5f6c12`.
The test files remain byte-identical to the red witnesses. Targeted Prettier and
strict Oxlint commands exited **0**; lint log:
`/tmp/ts-release-candidate-write-lint.log`.

The coordinator then ran the full `bun run check` successfully, including the
private application build; log `/tmp/ts-release-primitives-writes-check.log`.
Its focused provider/Warehouse/candidate batch passed **11 tests across 4 files,
312 assertions**, including the new candidate lifecycle test. Raw log:
`/tmp/ts-release-primitives-writes-behavior.log`. The unchanged test now observes
pending interruption before release, then interruption only with no Plan write
and retained Bundle bytes. No source or test changed between that green execution
and the hashes below.

| Final input or evidence             | SHA256                                                             |
| ----------------------------------- | ------------------------------------------------------------------ |
| `apps/self-release/src/prepare.ts`  | `2d62a461b62d0ab695b81dd8fd1fa73157c00625f0f4e50fd03ac5993b5f6c12` |
| `apps/self-release/dist/prepare.js` | `c6391626e031835c311874ef922bd40462674c923c168d3c2ef66d02e60b49cb` |
| `write-lifecycle.test.ts`           | `fb22a0aed4fd4cdb0bd4910f766a8879ecd14e8fb238bda6bf88d97eed4c44d8` |
| `write-lifecycle.mjs`               | `3e0dc8fe99e5edcf14353e97715a4a5c948b28637bf2d556f504bee3210de2ad` |
| Combined focused behavior log       | `e33ee0f262a126e982a8025e12317c622a2bbbbbb4c4bcbc7890e004887e366c` |
| Combined static/build log           | `21d2ac043dfb60cd002e56fcc1eae156b43c2cb7d6980bfb4a3a0179a8236c22` |

The coordinator's command also named a nonexistent `prepare.test.ts`; Bun ignored
that selector. It contributes no evidence. The coordinator subsequently ran the
actual existing `application.test.ts`: **11 passed, 70 assertions**, log
`/tmp/ts-release-candidate-write-application.log`. Delivery regeneration also
passed, log `/tmp/ts-release-candidate-write-delivery.log`; its only generated
change was `templates/npm-github/release/prepare.js`, containing exactly the
three masks and lifetime comment. The coordinator also added the starter's
cancellation contract and changelog entry.

No packed-consumer or native signing qualification is claimed for this slice.
No builds, packing, full behavior suite, network, signing, publication,
generated-file edits or commits were performed by this slice's owner; the
combined build/delivery/application checks above were coordinator-run.
