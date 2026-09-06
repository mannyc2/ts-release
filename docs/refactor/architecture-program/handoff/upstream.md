# Reconciled effect-build prerequisite

The admitted public producer contract is still PR24's eleven packages and
42 modules, with public API SHA256
`6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3`.
It was checked again against PR37's immutable merge
`ef29a087baac8bdbcd90a54bb62a2dceb739dd91`; the API bytes are identical.
The newer combined contract SHA256 is
`88a3d3821f2be60d99b53b871b8652c8abb3195df7d003324be5bd2d8fb098ca`.
The full remote files are retained losslessly, with SHA256 and Git blob
identities verified in [the observation](upstream/observation.json).

Use **effect-build 0.6.3 and effect-build-apple 0.6.3**, with the other selected
upstream packages on that same exact train. Do not resolve `latest`. The two
actual published tarballs were downloaded, verified against npm's SHA512/SHA1
metadata, retained, and installed in a new copied dependency graph. Strict
TypeScript 6.0.3 declarations passed with aligned Effect 4.0.0-rc.108 and the
repository's explicit Effect declaration patch. The unchanged research
fixtures then passed 34 Bun adoption checks, 34 Node adoption checks and 16
Apple lifecycle checks. This is new packed-consumer proof at the published
coordinate, separate from the preserved PR24 source-pack experiment.

| Published native package | Bytes | SHA256 |
| --- | ---: | --- |
| effect-build 0.6.3 | 47,091 | `508f3246ba41ef094fdca9fca796e9d80f002c3f25135f4a2de08cdd53c092f8` |
| effect-build-apple 0.6.3 | 68,405 | `80054e66b121d3a6486efa046832051d9a76045a85859429e8e9814ff0ec4a8f` |

[Consumer evidence and tarball coordinates](upstream/published-consumer.json)
record the exact inputs. These checks establish package availability and the
exercised library boundary. They do not independently certify all eleven
packages' provenance or complete the upstream release's final hosted receipt.
Apple Notary/Staple/Assess remain explicit protocol doubles behind the actual
public operations; this Linux task performed no credentialed Apple mutation.

## Why the old terminal blockers change

PR25 merged inert readiness infrastructure, and PR30 bound release OIDC to
immutable repository identity. Later source explicitly changed the upstream
release to npm-only: ship its eleven API/library packages, defer signed and
notarized Apple artifacts, and exclude AWS operational-journal evidence from
that release's readiness. The September 5 Plan045 amendment targets 0.6.3 and
retains that scope. This is recorded in the immutable
[upstream plan](https://github.com/mannyc2/effect-build/blob/ef29a087baac8bdbcd90a54bb62a2dceb739dd91/plans/045-establish-v060-release-point.md),
not inferred from a missing credential or a convenient local test.

The related task [Finish remaining effect-build work](codex://threads/01a072ed-82f4-7b82-8e31-199b046ae9a0)
reports recovering the user's earlier instruction to ship the eleven npm
packages, defer signed Apple artifacts and stop AWS work. That task report is
corroborating history; the immutable source above is the reviewed current
upstream contract. Its active publication progress is not imported as authority
for this task to publish anything.

Therefore OB02's missing terminal **public source/API** boundary is resolved;
the old requirement to wait for credentialed Apple/S3 readiness before any
ts-release implementation is superseded by the actual upstream scope. OB03's
S3 deployment remains optional/future host qualification. OB06's Apple native
distribution evidence remains required when ts-release earns its selected
P09/P10 acceptance; it is neither passed nor removed from those 69 outcomes.
The historical Plan004 terminal note remains useful provenance at its older
coordinate, rather than a veto that revives an explicitly deferred upstream
product. [Qualification matrix](qualification.md).

PR36 and PR37 also provide concrete independent-evidence lessons: a fake
Sigstore verifier exposed a field the pinned real verifier did not, and Bun's
actual argument parser rejected the supposed fresh-consumer invocation.
Those corrections reinforce the use here of real emitted packages and real
client execution. Their tests do not substitute for ts-release's provider
acceptance. [PR36](https://github.com/mannyc2/effect-build/pull/36),
[PR37](https://github.com/mannyc2/effect-build/pull/37).
