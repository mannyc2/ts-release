# Content-store ownership increment

This bounded W4 increment starts at `32fe7cdb4335d0ec269859772ced519367a292b7`,
after the first standards milestone. It addresses the native ownership gap in
[the checkpoint review](w0-checkpoint-review.md#added-native-content-proof-case-by-case),
without claiming completion of the other error-policy or adopter work.

## Contract and owner

`ContentOwner` remains an explicit four-operation port. `fileContentOwner`
captures its directory; application/adoption code chooses it. It needs no new
service, layer, filesystem interface or public testing entrypoint. Each returned
Effect owns its file handles and temporary path until its exit is delivered.
Input bytes for `putOwned` remain copied when the method is called, before the
Effect runs. Candidate identities and publication permission are unchanged.

The native adapter retains numeric `O_NOFOLLOW`, `O_NONBLOCK` and `O_DIRECTORY`
flags, exclusive creation, immutable hard-link installation, collision read-back
and file/directory fsync. The pinned platform FileSystem `open` accepts string
`OpenFlag` variants and cannot express those numeric flags; adding another
generic adapter would not remove the native responsibility.

The baseline whole-workflow Promise wrapper can detach on interruption while
native work continues. Effect rc.115's `tryPromise` does not join that Promise.
The implementation masks each issued non-cancellable I/O, with interruption points
between operations, and brackets handles with `acquireUseRelease`.

The writer bracket covers only open, write, fsync and close. Installation follows
successful close. One outer finalizer removes the temporary path only when the
exclusive acquisition actually created it; that ownership flag is set inside
masked acquisition. This replaces the checkpoint's explicit one-time early-close
state. Failed exclusive open cannot authorize deleting an existing path. Failed
close prevents installation; failed cleanup remains in the combined Cause.
There is no automatic close retry or swallowed cleanup failure.

A native operation that never settles can delay cancellation indefinitely. This
increment provides ownership and settlement, not a native timeout guarantee.
Cancellation after a hard link was already issued can leave valid immutable
content; cleanup owns the temporary path, not rollback of installed content.
Expected admission and native failures retain `AdoptionError`. Unexpected
synchronous crypto/allocation errors in the scan/read workflow now remain Effect
defects instead of being normalized by the old whole-workflow Promise catch.
No supported-input regression was observed in the selected checks.

## Proof selection

Existing Bundle/adoption and installed workflows already protect eager copying,
content identity, collision refusal, special-file refusal and successful native
retention. They cannot force the two cancellation windows reliably. The necessary
new proof holds a real native operation at exactly these boundaries:

1. Exclusive open created a real handle, but its Promise has not delivered it.
2. A real write was issued, but its Promise has not settled for the caller.

A single isolated Node fixture may instrument these native completion boundaries.
It must drain cancellation causally, without a stabilization sleep, release every
barrier on failure and join teardown. The observable contract is pending exit
before settlement, then interruption with closed handles and no remaining
temporary file or newly installed content. The existing Bun owner checks retain
host coverage without copying the checkpoint's eight-by-two fault matrix or
introducing a Bun module mock.

## Observed proof

Before changing production source, the new acquisition and issued-write cases
both failed at `interruption completed before native settlement` on `32fe7cd`:
0 passed, 2 failed. After the repair, the same two cases pass. Their completion
barriers hold delivery of an actual native operation; they do not replace file
handles or claim that the kernel syscall itself remains blocked. The tests drain
the pinned runtime dispatcher causally, require an interrupted exit after release,
observe the native handle becoming closed, and require the content directory to
be empty. Failure teardown joins the final real unlink before removing that
directory. A process watchdog bounds a broken fixture, not interruption timing.

The unchanged proof files have SHA-256 identities:

- `test/reimplementation/kernel/content-store.test.ts`:
  `b76f9e203336145ce2ab0e710c73064e4697172faaddc19da7b04abf8be6baf6`.
- `test/reimplementation/kernel/content-store-lifecycle.mjs`:
  `c598d827fdfe578b433da5198d6a72e1ba6bdca08cbee7c7fb07ee703e183046`.

`packages/ts-release/src/platform/ContentStore.ts` changed from
`be26721935042fa6aa949b43c7ea5f49f964314074e188ffec4ff521655b5787` to
`7b34a3c584674f5e3c4eabc980ebf11e2054aae261d8ec8d0e65e70ee653d588`.
The final built module is
`74767c87d43f1137bad85ccb7dd2544acc16d7f206077f40585f194fbdcf9851`.

Qualification used Linux x64, Bun 1.3.14 and Node 22.22.2, with
`TS_RELEASE_ACCEPTANCE_NODE` and `TS_RELEASE_HTTP_PEER_NODE` selecting that Node.
Builds and packaging were serialized. Existing checks are reused; there is no
new verification framework or public test seam.

| Command/check | Actual outcome |
| --- | --- |
| `bun test ./test/reimplementation/kernel/content-store.test.ts` | Baseline exit 1, 0 pass/2 fail; repaired exit 0, 2 pass/0 fail. |
| `bun run check` | Exit 0: formatting, patched build, strict lint and compiler closures, import rules and public exports. |
| `bun test ./test/reimplementation/kernel/bundle.test.ts ./test/reimplementation/artifacts/adoption.test.ts ./test/reimplementation/artifacts/adoption-races.test.ts` | Exit 0: 25 passed, 158 assertions, including real Node/Bun adoption races. |
| `bun run check:packed-kernel` | Exit 0: eight public entries from actual packed Bun/npm installs and strict installed declarations. Core archive SHA-256 `c5405a4bf3cd8fc7f6caee197d1811b6e314095b12480a75b03f9e1a3dfe5914`. |
| `bun run check:installed-workflow` | Exit 0: CLI and Action ordinary/interrupted local publication, observation, continuation and completed recognition. Destinations are disposable fixture repositories. |

Local raw logs use `/tmp/ts-release-content-lifecycle-` with suffixes `red.log`,
`green.log`, `check.log`, `behavior.log`, `packed-kernel.log` and
`installed-workflow.log`. Packed acceptance also retains its existing receipt at
`.release/checks/packed-kernel.json`. These disposable paths identify this run;
the committed regression tests and commands provide reproducible proof.

An independent rc.115 control confirmed that nested bracket/onExit finalizers
combine body or interruption causes with close and unlink failures. That checks
the selected Effect mechanism; no new fault matrix claims actual native
close-failure recovery. The finalizer has no retry. macOS, Windows, other Node
versions, stuck native operations and live publication were not qualified by
this increment. The unchanged full provider suite was not rerun after these
focused checks passed.
