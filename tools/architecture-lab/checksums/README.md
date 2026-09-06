# Q01: exact Bundle-derived SHA256SUMS

This is a local research implementation of the retained outcome, not production
publication. `checksums.ts` produces bytes only. It adds no durable checksum
class, store, hash authority or dependency. Its source donor is immutable
`2ef7a9a61fe40608d053569cbcd71e40fca5c181:src/release/checksums.ts` (122 physical
lines). The proposed root `/bundle` surface is emitted to
[`checksum-api.d.ts`](../../../docs/refactor/architecture-program/handoff/checksum-api.d.ts).

`ChecksumInput` selects an exact owned File and its public name. Rendering
strictly decodes the Bundle/file selection, rejects foreign or changed members,
duplicate bundle/public names, case collisions, multiple names for one artifact,
unsafe/non-NFC names and checksum self-reference. Tree manifest digests are
never presented as file digests. Names use Unicode code-point ordering; bytes
are GNU-compatible `hex`, two spaces, filename, LF. Content digests come only
from the selected immutable Bundle members. Verification requires exact output
byte equality and calls the host's `ContentOwner.verify` for every selected File.
Callers include only already finalized files, and cannot select `SHA256SUMS`
itself (including a path whose final component is that name).

The isolated consumer contains the actual published `effect-build@0.6.3` and
Effect rc.108. Its producer Files pass through public `File.publish` and the
real owned adoption boundary. Both Bun 1.3.14 and admitted Node 22.22.2 passed
**19 checks each**, including native GNU coreutils 9.4 `sha256sum --check --strict`
on spaces and supplementary-Unicode filenames. The native tool rejects changed
file bytes. The library rejects changed output, CRLF substitution, mode changes,
foreign File values, Tree substitution and the naming/identity errors above.
Strict TypeScript 6.0.3 checking includes the actual producer declaration graph.
The sandbox initially blocked the admitted Node child-process wait with EPERM;
the same local-only runner passed after automatic approval for unsandboxed
native subprocess execution. No service or publication was contacted.

Reproduce with an installed published producer consumer:

```sh
bun tools/architecture-lab/checksums/run.mjs /path/to/installed-consumer
```

The mechanism is **68 physical / 77 TypeScript-printer lines**. The fixture is
63 physical lines; its driver is 22. They are separate maintenance lanes.
A full replacement forecast is **73 / 80 / 98 physical lines**: the measured
68 plus **5 / 12 / 30** for target error/domain/public export integration,
explicit deployment input bounds and final shared public-name admission. That
allowance is unimplemented estimated work, not measured source savings. Do not
absorb this selected outcome into an unnamed artifact reserve or count its
root wrappers a second time. [The program forecast](../../../docs/refactor/architecture-program/handoff/forecast.json)
owns the complete threshold arithmetic.
