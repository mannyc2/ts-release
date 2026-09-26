# Repaired executor for an unchanged retained candidate

The former installer always installed the engine/provider archives inside the
publication candidate. Checking out a repaired workflow therefore still selected
the old engine. An actual baseline installation selected core **0.4.1** while
the reviewed checkout was **0.4.2**. Logs are
`/tmp/ts-release-historical-executor-before.log` and
`/tmp/ts-release-historical-executor-mismatch.log`; the latter intentionally
exited 1 on that mismatch. This is a reproduced selection problem, not a claim
that a future `--executor` option existed on the baseline.

## Existing owners and selection

The repository installer now accepts optional `--executor=checkout`. It first
uses unchanged candidate admission, then packs the seven already-built current
package owners and installs those physical archives. Default selection remains
the retained archives. Neither path changes the candidate's Bundle, Plan,
content, source identity or provenance. Publication preparation remains strict;
the observed historical formats already admit, so no new compatibility decoder
or weaker preparation policy is warranted.

`executor.json` separates candidate identity/source from executor selection,
actual archive/application hashes, checkout commit/tree and a dirty flag. It is
an audit receipt, not permission to publish or a complete dependency attestation.
The workflow explicitly selects checkout code and retains the receipt, archives,
application/helpers and lockfile. Artifact names include `github.run_attempt`,
so an immutable artifact from an earlier failed attempt does not prevent retry.
No live workflow has run for this change.

The new verifier statically imports the actual runtime observation Schema.
Older runners treat an unknown object mode as execution; the import makes this
verifier refuse those executors before reading input or loading an application.
It additionally passes `authorize: false`. Default retained installation can
therefore install an old core but cannot silently run the new verifier on it.
Arbitrary callers of old APIs do not gain this verifier-specific protection.

## Installed historical proof

The complete retained signed candidate is
`/tmp/ts-release-adoption-20260921/.release/hosted-35651390251-signed`:

| Identity         | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Bundle SHA256    | `2185a825efd159af8ff2dc0d957a21b3d4146147cb97c680d2f622b4f62ec951` |
| Plan file SHA256 | `9216b5ac391ea4c3a53635617e96021040899d6646daa9f721952674bfd91f57` |
| Plan ID          | `eb465a35ac4f3fd8a1b62f092cfe9464963c8f660bbf7a114b2573ea08a74e6d` |
| Journal ID       | `npm-github:mannyc2/ts-release:v0.4.1`                             |

The actual changed installer produced
`/tmp/ts-release-historical-executor-checkout-a704387` under the shared lock.
Its seven packages are physical 0.4.2 installations. The receipt SHA256 is
`bbb9a56e93379985d7e40d16eb18ea299f244a2fc68fe2d96e2356df5c1fb0cd`;
it truthfully records a dirty checkout based on `a704387`, with selected archive
and application hashes. Later local commits do not retroactively change that
recorded source identity. See [combined qualification](continuation-qualification.md)
for the matching installed archive/runtime profile.

The narrow installed probe ran with Bun 1.3.14 and Node 22.22.2. It compared
**202 installed files** with all seven receipt-hashed archives, admitted the
original Bundle/Plan through installed public APIs, verified all **16 owned
content members**, and compared the entire **19-file candidate manifest** before
and after. Candidate bytes are unchanged. Seven provenance bundles were
content-verified; cryptographic trust verification was deliberately unavailable.

The exact complete two-event journal prefix is retained in local Git:

- `5c2dfe06f2943a627a9c37a68635800b3eb96b7f`: original Absent observation.
- `64c9b0b1f20503a5cbf8ebabc1ea04afc7a041fc`: PlanSuperseded.

The probe replayed these untouched event bytes through a deliberate read-only
store and the real public application runner/provider definitions. Authorization
was true inside this incapable fixture so actual supersession, rather than a
false approval flag, had to stop execution. All **26 operations were Superseded**;
there were **zero appends, transport preparations/sends, provider reads or
provenance verifications**. This exercises journal admission and refusal, not
the real Git journal transport.

A fresh directory containing the actual current verifier reused the earlier
physical 0.4.1 dependencies via an explicitly recorded `node_modules` symlink.
It exited 1 for the missing `BoundedObservationOptions` export before accessing
nonexistent input/application paths. This proves the current verifier's ESM
refusal, not a fresh installation of the old version.

## Raw result and limits

The first probe captured empty stdout from an exit-0 Node child, so its outer
JSON parse failed and **no successful result was claimed**. Exact command replay
completed all assertions and emitted the result. The temporary wrapper then
used an exclusive file written only after all child assertions pass; stdout and
stderr remained raw diagnostics. No assertion or production code changed, and
the empty-capture cause is not diagnosed as a product or liveness defect.

Successful report:
`/tmp/ts-release-historical-qualification-kvEDro/qualification.json`, SHA256
`f63510b723c5a1d467c60f30fdbf70924263b0e28aaf8c775aae1b546d18c00c`.
It retains the initial failed report, exact replay, script hashes, commands,
archive/content/event manifests and old-import refusal output. The corrected
script SHA256 is
`a9ab8955255249e1d41dcb097eea39605ebb33b1fe833a715c314eb2427219e6`.

This original Plan has **no dispatches**. The dispatched successor's complete
candidate was not found in the bounded local search. These results therefore
do not prove interrupted historical-dispatch recovery, successful signing,
live provider behavior or hosted workflow execution. Repacking or re-signing
the candidate would invalidate the intended proof and was not done. Existing
current-candidate interrupted CLI/Action tests remain separate evidence.
