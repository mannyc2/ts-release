# Provider native prerequisite increment

Baseline: `d7837c5ddbf4196e3e79f5cd9984263ebc00e734`, after the separately
qualified Catalog increment. This implements only request-byte ownership and
archive primitives from [provider prerequisites](provider-error-policy-prerequisites.md).
The shared `makeDataBoundary.attempt`, `admit` and `matches` remain unchanged and
broad. This is not completion of strict provider error classification.

## Changed owners and preserved contracts

| Owner                                                           | Change and compatibility                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [HTTP ownRequest](../../packages/ts-release/src/Http.ts#L53)    | Decode facts and read the body property before entering a catch around the native byte clone. Detached-storage failure now has the existing boundary-specific `<prefix>-data` code and `<subject> data could not be admitted` message. A getter exception is outside this native catch. No change to facts, owned bytes or the public return type. |
| [PyPI Wire](../../packages/pypi/src/Wire.ts#L77)                | Reuse that owned-request path instead of independently decoding facts and cloning bytes. Multipart reconstruction, digest/length comparisons and the existing `matches` result remain unchanged.                                                                                                                                                   |
| [Shared Tar](../../packages/ts-release/src/internal/Tar.ts#L27) | Only fatal UTF-8 decoding in C strings and PAX fields catches native failures. It passes `encoding` to the existing refusal callback; exceptions from that callback or the archive algorithm are not recaught. No new callback parameter or error class is added.                                                                                  |
| [npm archive admission](../../packages/npm/src/Native.ts#L16)   | Catch only `gunzipSync`, projecting to `npm-data: npm data could not be admitted`. Map Tar's `encoding` reason to the same existing code/message. Other tar reasons retain their `npm-tar-*` codes.                                                                                                                                                |
| [PyPI Archive](../../packages/pypi/src/Archive.ts#L5)           | Fatal ZIP-name decoding, `inflateRawSync` and `gunzipSync` project to `pypi-data: Python index data could not be admitted`. Tar's `encoding` reason maps to that same refusal. ZIP offsets, flags, sizes, CRC, overlap checks, archive-path admission and the decompression bounds remain unchanged.                                               |

The native failures previously depended on broad provider wrappers to obtain
those generic data codes. Private synchronous archive functions now throw the
domain failure directly. Direct `readTarBytes` users receive the existing
callback for malformed UTF-8, with the new `encoding` reason, instead of an
uncaught native decoder exception. The two production consumers map this reason
to their historical provider refusal rather than introducing `*-tar-encoding`.

No JSON decoder, provenance/Auth owner, metadata-field parser or response
fallback was changed. No service, provider facade, dependency, durable format,
request bytes, retry, dispatch authority or native lifetime policy was added.
The complete installed Effect guide was read; Effect remains **4.0.0-rc.115**.

## Smallest proof and actual chronology

The existing npm authoring case already corrupts a real Bun tar checksum and
truncates a real gzip stream. Its generic throw assertions could not establish
that these native owners produce the expected domain refusal. Only those two
assertions were strengthened, using `node:assert.throws` to require the exact
ReleaseError tag, code and message. Inputs and case count were unchanged; no
new detached-buffer, ZIP or tar-encoding matrix was introduced.

1. Before editing any of the five production files, the strengthened existing
   case ran with Bun **1.3.14**. The checksum control passed. Truncated gzip
   failed with native `Z_BUF_ERROR: unexpected end of file` instead of the
   expected `npm-data`. This is a real failing native-owner control, not a
   claim that the public provider had previously rejected with the wrong code:
   its still-broad wrapper already normalized that error.
2. After the primitive changes, the byte-identical test passed: **1 pass,
   0 fail, 3 filtered**. Subsequent formatting changed no test bytes.
3. The complete existing npm authoring and Warehouse native-oracle files then
   passed: **6 tests, 0 failures, 212 Bun assertions**, plus the two strengthened
   Node assertions. This retained actual Bun archive admission and the four
   Python-built distributions, native Twine multipart comparisons, and metadata
   positive/negative controls.
4. Targeted Prettier and strict Oxlint passed on the five source files and the
   one changed test file. No new suppression was introduced.

Commands, run from `.standards-continuation`:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/npm/authoring.test.ts --test-name-pattern 'npm reads the actual Bun tarball'
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/npm/authoring.test.ts test/reimplementation/warehouse/native-oracle.test.ts
/tmp/ts-release-bun-qualification/node_modules/.bin/bun node_modules/oxlint/bin/oxlint -c .oxlintrc.json --deny-warnings --report-unused-disable-directives-severity error packages/ts-release/src/Http.ts packages/ts-release/src/internal/Tar.ts packages/npm/src/Native.ts packages/pypi/src/Archive.ts packages/pypi/src/Wire.ts test/reimplementation/npm/authoring.test.ts
```

Raw records use the `/tmp/ts-release-provider-native-prerequisites-` prefix:

| File                       | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `red.log`                  | `777e135209291f398834e891c0ea23453a74788c3a5221464a0457b7d10d95b1` |
| `green.log`                | `fd0b232d5d1e3dcf2f252667b5a8051f8202d852cdce6d1493cb7947e887092c` |
| `source.log`               | `88f2d78bff90cb619d152a37c8d098bb444c6cf2c159858551d60d44d2d2ac5c` |
| `lint.log` (empty, exit 0) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`before.sha256` and `after.sha256` record all five production files plus the
test. The unchanged strengthened test hash is
`9f5b385c2cedd2433439310cdf390722729f2e38a2b9870d0fe4f3abe1529d3e`.

## Qualification limits and next owner

This owner ran no build, packing, full gate or commit. During its narrow source
checks, bare core/package imports still resolved to the Catalog baseline's
compiled output. The changed npm native module and PyPI archive source were
exercised, but these runs do not qualify the rebuilt shared HTTP/Tar exports or
the complete public PyPI request path. Root owns the rebuilt composition and
affected installed-consumer qualification; see
[implementation status](implementation-status.md) for those results.

Malformed ZIP UTF-8, raw inflate failure and detached request storage were
reviewed in source, not claimed as independently reproduced cases here. The
actual red/green control covers the existing truncated-gzip input. A later
strict-boundary change must preserve the other expected-refusal paths and prove
unexpected callback/getter defects at an actual provider owner. Provider JSON,
npm Sigstore conversion, metadata/MIME/URL primitives, OpenAI explicit refusals
and direct response-recovery catches remain prerequisites before that switch.

## Rebuilt composition qualification

The integrator then froze this slice together with the separately owned candidate
write repair and ran `bun run check` under the shared verification lock. Exit 0:
formatting, patched build/compiler, strict lint, root/host closures, imports and
entries passed. The rebuilt shared HTTP/Tar owners were used by the selected
source composition: npm authoring, Warehouse protocol/native oracle and the
candidate-write proof passed **11 tests, 0 failures, 312 Bun assertions across
4 files**. Logs: `/tmp/ts-release-primitives-writes-{check,behavior}.log`.
This includes existing request ownership, multipart and malformed evidence
controls. A nonexistent `prepare.test.ts` selector was also passed to Bun and
matched no file; no preparation-suite result is attributed to it. The actual
application suite ran separately in the candidate-write slice.

No installed archive or native engine-range claim is added by this increment.
The subsequent coordinated strict provider change owns the affected final
packed-provider check after all its prerequisites settle; repeating the full
seven-package profile for each compatible private adapter would add little
proof. Durable request and archive formats are unchanged.
