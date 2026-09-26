# Catalog error-policy increment

Baseline: `8b80d967fb6ae68aa40daf398e5bce4f86b803d4` in
`/mnt/models/dev/ts-release/.standards-continuation`. This is a bounded W3/R10
repair with R24–R26 proof, not completion of provider-wide error classification.
Root built the unchanged baseline first; its successful build is recorded in
`/tmp/ts-release-standards-continuation-baseline-build.log`.

## Owner inventory and decision

| Existing owner | Callers and responsibility | Decision |
| --- | --- | --- |
| `Shared.renderBytes` | Exactly two callers: `homebrew/Formula.ts:28` and `scoop/Manifest.ts:20`. It suspends synchronous schema admission, owned-download checks, rendering and UTF-8 encoding inside the renderer Effect. | Retain this private package boundary; replace blanket exception normalization with explicit failure/defect classification. No public helper, service or Layer is added. |
| `Shared.decode` | Renderer data and Bundle admission through installed `Schema.decodeUnknownSync`. | Keep unchanged. Preserve the actual Schema adapter's defect wrapper; do not inspect/unwrap arbitrary nested causes. |
| `Shared.downloads` | Both renderers require unique Bundle names, exact owned File membership and one hash per download URL. Its three deliberate raw Error throws previously depended on the blanket catch. | Express all three as the existing fixed `catalog-input` failure before narrowing the catch. Keep File equivalence, URL/hash rules and Bundle admission unchanged. |

There is no filesystem/network operation, credential reader, acquired resource or
runtime selection in this owner. The renderer callback is existing internal
composition, not a new application callback API. Homebrew and Scoop rendering
algorithms were not edited.

Installed Effect remains **4.0.0-rc.115**. The complete installed guide was
already read in this task and its unchanged SHA256 was rechecked:
`e155acab559b29e0a54acd0f5d8d4b7a428268ba6eb1aba4d62b4876d6b1a78e`.
Relevant exact source is `effect/src/internal/effect.ts:1079–1092` (`try` turns
caught exceptions into Fail), `Schema.ts:1212` (`isSchemaError`) and
`Schema.ts:1234` (`getSchemaErrorOrThrow`). The latter wraps synchronous schema
defects in an Error carrying their Cause; it does not make them SchemaError.

## Behavior and compatibility

`packages/catalog/src/Shared.ts:38–69` now distinguishes:

- SchemaError and the three owned-download refusals remain typed Fail with
  exactly `catalog-input: Catalog metadata or exact owned download could not be admitted`.
- An intentionally thrown local ReleaseError remains the same typed error. A
  separately constructed error satisfying `Schema.Struct(ReleaseError.fields)`
  preserves its declared code/message in a local ReleaseError. This deliberately
  changes Catalog's previous blanket `catalog-input` projection for those
  callback errors; it is not described as unchanged historical behavior.
- Other exceptions remain Die. An unexpected metadata getter TypeError reaches
  Catalog inside the existing Schema sync-adapter wrapper; that wrapper remains
  a defect. No arbitrary native or schema diagnostic is copied into a public
  ReleaseError, and no original-error identity is promised across Schema's own
  wrapper.

This does not establish a new privacy boundary, additional input authority or
native-provider trust. Success bytes, schema/URL/path rules, durable identities
and public signatures are unchanged by the source edit.

## Why the proof changed

The existing malformed cases only asserted Promise rejection text, which could
not distinguish typed Fail from Die. One additional renderer-boundary case is
necessary: a real metadata getter throws an unexpected TypeError and must not
be reported as ordinary invalid release metadata. The same case contains two
owner-private callback controls for the deliberately changed local/foreign
ReleaseError contract. Those controls use the existing `Shared.renderBytes`
boundary because Schema wraps getter exceptions before Catalog can classify
them. They are not a renderer-by-error matrix or a public testing export.

Existing invalid-input rows are unchanged. Their assertions now inspect Fail,
require the exact fixed code/message and reject Die, covering schema refusal
and all three deliberate download checks. The existing successful rendering
case remains. No native oracle, packed consumer, or full gate was added.

## Chronology and raw evidence

All narrow commands below ran with Bun **1.3.14** from this checkout. No build,
packing, full gate or commit was run by this owner.

1. **Initial red before production editing.**
   `/tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/catalog/render.test.ts --test-name-pattern 'renderer defects remain defects'`
   exited **1**: 0 pass, 1 fail, 3 filtered, 1 assertion. Raw log:
   `/tmp/ts-release-catalog-error-policy-red.log`. `Cause.findDefect` found no
   defect for the TypeError getter. Local/foreign controls followed that failed
   assertion and were not reached. Shared.ts still had its baseline hash below.
2. **First post-edit check exposed an overstrong expectation.**
   `bun test test/reimplementation/catalog/render.test.ts` exited **1** with
   3 pass, 1 fail, 88 assertions. Raw log:
   `/tmp/ts-release-catalog-error-policy-green.log`. Catalog now returned Die,
   but the initial test wrongly required the getter's original object at the
   outermost level. The actual value was Schema's `Sync adapter can only throw
   schema errors` wrapper. Production was not broadened to unwrap it.
3. **Corrected assertion, same intended distinction.** The getter assertion
   requires Die/no Fail. Declared error controls were placed at the existing
   owner callback. The first corrected run passed 4 tests/93 assertions; raw
   log `/tmp/ts-release-catalog-error-policy-green-final.log`.
4. **Corrected baseline control after implementation.** To establish the final
   assertion's quality without inventing byte-identical test-first evidence,
   the final Shared.ts was saved to `/tmp/ts-release-catalog-Shared-final.ts`.
   Only Shared.ts was temporarily replaced with `git show 8b80d967fb6ae68aa40daf398e5bce4f86b803d4:packages/catalog/src/Shared.ts`.
   The final, unchanged test file was run with the exact command below. It
   exited **1**, 3 pass/1 fail/88 assertions, at `Cause.hasDies(...): false`.
   Raw log `/tmp/ts-release-catalog-error-policy-corrected-baseline.log` includes
   both source/test hashes. A shell EXIT trap protected restoration; final
   Shared.ts bytes were restored before any further check. This control happened
   after the source repair, and is explicitly not the initial red.
5. **Restored final green.** The same final test file and command passed with
   restored final Shared.ts: **exit 0, 4 pass, 0 fail, 93 assertions**. Raw log
   `/tmp/ts-release-catalog-error-policy-restored-green.log` begins with the final
   source/test hashes. The two renderer source files retained their baseline
   hashes throughout.

Exact command for the complete narrow render checks:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/catalog/render.test.ts
```

Targeted Prettier completed successfully. Targeted strict lint also exited **0**;
its empty successful log is `/tmp/ts-release-catalog-error-policy-lint.log`:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun node_modules/oxlint/bin/oxlint -c .oxlintrc.json --deny-warnings --report-unused-disable-directives-severity error packages/catalog/src/Shared.ts test/reimplementation/catalog/render.test.ts
```

| Recorded bytes | SHA256 |
| --- | --- |
| Baseline Shared.ts | `dd0da1c57f00a77f15b09b52a146894206cbd4bc5ad82fd3c7558414d15d03fd` |
| First-red test file | `0c31c9aac65d9193b644c1bc3cc6c067481eec7ace0c150e979c6d24e652234e` |
| Final Shared.ts | `161e25cb695c76c4698c9b00aabd0d7496e43e1be726d27e4c36cb6474819c73` |
| Final test file | `6d7b2d87ef796fe173ca3e4a620dbcb099dfdd79cbd6421b2de4ff9fa2844d2d` |
| Unchanged Formula.ts | `36d6a7cd17a0c6a8fa8dd3f5277206a1168592ca2363894b32a873002d7f10a3` |
| Unchanged Manifest.ts | `88d6658f37b9f92365f7370d54f3ce267ecf03faf8e133f5cde65677f85b0e7b` |
| Initial red log | `6346864b80f4466161e435b55efb85a7921ee5c6c56a215df49c23f0bca67421` |
| First failed post-edit log | `226fa1c731564f8174a8b6e0b64ad943dfaeb0175f84976ad2e96f0748aed566` |
| Corrected baseline log | `92207decd2f365769acc08a56e79b24fd9b2a913cf3eb8f9d2fe81ca34eb61e7` |
| Restored green log | `ea152c86dc8b6b5da50c9deb3df23c3e0178efaa466cd5ed0413d5cad307000e` |

Root owns final integrated compiler/static and affected packed/native
qualification under the shared verification lock. This record alone qualifies
the source renderer channel behavior and targeted lint; it does not qualify an
installed archive, native Homebrew/Scoop installation, or the full standards plan.

## Integrator qualification

Independent read-only review found no actionable issue. With source/test inputs
frozen, the integrator held `flock -n /tmp/the-show-full-verification.lock` across
these sequential checks. All exited 0 in one uninterrupted batch:

- `bun run check`: formatting, patched compiler/build, strict lint, root/portable/
  Node type closures, import policy and 15 package entrypoints.
- `bun test test/reimplementation/catalog/native.test.ts`: 4 existing tests,
  86 assertions. Real Homebrew Ruby and PowerShell/Scoop format oracles and
  negative controls passed; this is not native Windows installation proof.
- `bun scripts/check-packed-npm.ts --catalog`: 61 commands, all exit 0; seven
  actual archives installed with Bun and npm, strict declarations, exact archive
  resolution and absent optional peers, with consumers on Node 22.22.2 and
  Bun 1.3.14. Bun reports Node compatibility version v24.3.0 in some receipt
  rows; this is not a separate Node 24 execution.

Logs are `/tmp/ts-release-catalog-final-{check,native,packed}.log`. The existing
packed receipt is `.release/checks/current-packed-catalog.json`; retained work
is `/tmp/ts-release-packed-npm-SYlyqY`. Catalog archive SHA256 is
`7a500c905bdf102d84ea3258177983d4aeda3000b5e392f509ec32f8f495dc0f`.
Core/npm/GitHub archives remain byte-identical to their prior qualification.
The five renderer/proof/guide inputs are recorded in
`/tmp/ts-release-catalog-final-inputs.json`.

No new transport profile, full ordinary suite, CLI/Action, live provider,
publication or runtime-range qualification was run. The affected source, format
and installed Catalog checks suffice for this owner; broader W3/W7 work remains.
Original root staging was compared from the original checkout and is unchanged.
