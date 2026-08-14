# Plan 234 — 0.2.2 live release certification

Input-Commit: c345c611ac7201f7622a63d79eccf1d85a229a0b
Published-Candidate-Commit: 528bdf9969985e2cb8238192d30c4a2f680ce8c3
Candidate-Evidence-Commit: c345c611ac7201f7622a63d79eccf1d85a229a0b
Evidence-Commit: SELF
Status: ACCEPTED — LIVE RELEASE COMPLETE
Outcome: GITHUB CONVERGED / NPM CONVERGED / IMMUTABLE ACTION VERIFIED / NO RECOVERY REQUIRED
Date: 2026-08-14

## Authorized execution and containment

The operator accepted the exact candidate/evidence topology, authorized the
non-force `origin/main` fast-forward, one candidate-bound automatic workflow
dispatch, the workflow `GITHUB_TOKEN`, npm OIDC, and recovery only from the
fresh run's emitted immutable reference. The authorized public subjects were
the npm package, the versioned GitHub tag/release/assets, and the immutable
Action subpath.

No force, deletion, correction, mutable major tag, PyPI, catalog, Marketplace,
trust-configuration, environment, or existing-subject mutation occurred.
Immutable `v0.2.0` and `v0.2.1` subjects were left unchanged.

## Evidence topology

- X: `528bdf9969985e2cb8238192d30c4a2f680ce8c3`
- X tree: `11e657586355ecc18afa1f8abf684c19dee2e792`
- Y: `c345c611ac7201f7622a63d79eccf1d85a229a0b`
- `Y^ = X`, and X..Y changes only the Plan 233 certificate
- Z: this live evidence-only commit (`Evidence-Commit: SELF`)
- required relation: `Z^ = Y`
- required Z diff: only this file

Before mutation, read-only preflight proved:

- `origin/main = a4e79d758529b412629e75367582d03baaa12bf2`;
- npm `@mannyc1/ts-release@0.2.2` returned authoritative 404;
- GitHub `v0.2.2` tag and release were absent;
- no workflow run existed for X.

The evidence branch was pushed non-force. `origin/main` then fast-forwarded
exactly from that observed parent to X. The final evidence commit may follow X
on `main` without changing the immutable published candidate or tag.

## Single automatic workflow execution

Exactly one fresh candidate-bound dispatch occurred:

- workflow: `.github/workflows/release.yml`;
- candidate input: X;
- `prepared_ref`: empty;
- run: `31792827414`, attempt 1;
- job: `94743348304`, name `release`;
- topology: one job;
- source branch/ref: `main` / `refs/heads/main`;
- conclusion: `success`;
- duration: 3m54s;
- all setup, exact npm 11.5.1 installation, cache prime, Action, report
  upload, and post steps passed.

The Action report is `complete`. Its exact subject outcomes are:

| Subject | Outcome |
| --- | --- |
| prepared bundle | `AlreadyEquivalent` |
| `github:mannyc2/ts-release#v0.2.2` | `ConvergedAfterMutation`, applied once, final `PresentEquivalent` |
| `npm:@mannyc1/ts-release@0.2.2` | `ConvergedAfterMutation`, one `OutcomeUnknown` process exit followed by bounded reads and final `PresentEquivalent` |

No recovery workflow was dispatched.

## Immutable prepared and report evidence

The run emitted:

`prepared:gha:mannyc2/ts-release/runs/31792827414/attempts/1/artifacts/ts-release-prepared-1-65461ba856ff53004261c699210d4c5964cdb7d3f0e1c091ed76dcd3332c96ad#sha256-65461ba856ff53004261c699210d4c5964cdb7d3f0e1c091ed76dcd3332c96ad`

Prepared artifact evidence:

- artifact ID: `9216233768`;
- name suffix and manifest digest:
  `65461ba856ff53004261c699210d4c5964cdb7d3f0e1c091ed76dcd3332c96ad`;
- uncompressed artifact payload: 776,272,878 bytes;
- Actions archive SHA-256:
  `205d96a11414dfe697a3409113ebb6b6493a828f1f876df5da5fafe6e14fd470`;
- producer run/head: run `31792827414`, `main`, X;
- repository-configured expiry: `2026-11-12T10:35:35Z`;
- expired: false at verification.

Redacted report evidence:

- artifact ID: `9216262028`;
- name: `ts-release-report-1`;
- payload: 1,386 bytes;
- Actions archive SHA-256:
  `a38ec43a519cdbe3447b48c7dd2ef5185e61c920bcbcb160c67967db56cf8f96`;
- the same producer run/head and repository-configured expiry.

## GitHub release verification

Read-only Git and GitHub observations after the run proved:

- `refs/tags/v0.2.2 = X`;
- release ID `370506509` targets X;
- release is non-draft and non-prerelease;
- published at `2026-08-14T10:38:53Z`;
- exactly 11 configured assets exist, with no duplicate or extra name.

| Asset | Bytes | Media type | SHA-256 |
| --- | ---: | --- | --- |
| `checksum-sha256` | 1,178 | `application/octet-stream` | `8e9967f867b269fc5763cfa6642d22d41851d1eabb43b2c11aaafbbae4383b76` |
| `ts-release-claude.zip` | 9,958 | `application/zip` | `34f74c5d36df7a66927a04bfd08bdaa95688c08aed1c7864cda10eeec267a08f` |
| `ts-release-codex.zip` | 9,811 | `application/zip` | `ad53fc09f2c465afcfdb2dd2d664d34445dd92d2cc1aa90a16e3926141c8165c` |
| `ts-release_0.2.2_darwin-arm64.tar.gz` | 24,086,117 | `application/octet-stream` | `4c7905e13b6ac8c7d9a5a88aaa0702284671cc5942882ef13179f57a273e079b` |
| `ts-release_0.2.2_darwin-arm64.zip` | 64,833,278 | `application/octet-stream` | `b9739827f7f50c5f5397cc111d6f98e48ceee1daf41ecc7e9e953cc883874ce3` |
| `ts-release_0.2.2_darwin-x64.tar.gz` | 26,623,687 | `application/octet-stream` | `eb9b347a7af50fdcf63018b83b72f39331be9e3e9e84d2798bb095988722000d` |
| `ts-release_0.2.2_darwin-x64.zip` | 70,549,736 | `application/octet-stream` | `cb586fe69ca470a99adc6b6ae4e26b8351f64c0827a8874b6c68a43f6adfc68c` |
| `ts-release_0.2.2_linux-arm64.tar.gz` | 35,716,370 | `application/octet-stream` | `55a4ad8fd3ebfc64bd634f1df1c386dcaf5b2365942ec843bbc7d7b90547df05` |
| `ts-release_0.2.2_linux-arm64.zip` | 95,070,506 | `application/octet-stream` | `cfb5cfb1a61c3f3452a6c717d8913c17f27b19eacdd8a12f34229fb0a191025b` |
| `ts-release_0.2.2_linux-x64.tar.gz` | 36,024,909 | `application/octet-stream` | `719829facaa73f8f7b3f2e1204ca502f8cc181cd3c62489c15923be39377a357` |
| `ts-release_0.2.2_linux-x64.zip` | 95,963,414 | `application/octet-stream` | `6e88b128b252236111f492e07774244dba357f044e8e581857f746a51ad0e810` |

The configured agent archives retain their required `application/zip` media
type. Every observed size and GitHub SHA-256 equals the prepared candidate
measurement.

## npm package and provenance verification

Public registry metadata proves:

- package: `@mannyc1/ts-release@0.2.2`;
- `latest = 0.2.2`;
- publisher runtime: npm 11.5.1 on Node 22.22.2;
- public tarball: 746,562 bytes, 462 files, 3,812,384 unpacked bytes;
- SHA-1: `8466dce6c3022ea6752baf277e1e3238e8c56754`;
- SHA-256: `14b310a35353370c25b8d7b3c98630ff5e2d0dee3e6c501f57a5b04202f10e9a`;
- SHA-512:
  `15756d65cd6544da8a0dd6cbe6f9973e219e99996890be1c473855a411ac560da0c5ac2ada9ca9a2d5c19f53c554744503bb73213d91aeaeaefb0b38a25ee945`;
- integrity:
  `sha512-FXVtZc1lRNqKDdbL5vmXPiGemZlokL4cRzhVpBGsVg2gxawq2pypotXBn1PFVHRFA7tzIT2Rrq6u+ws4ol7pRQ==`.

The registry exposes both its npm publish attestation and SLSA provenance v1.
The signed provenance subject SHA-512 equals the independently downloaded
tarball. Its statement binds:

- repository `https://github.com/mannyc2/ts-release`;
- workflow `.github/workflows/release.yml` at `refs/heads/main`;
- resolved dependency X;
- event `workflow_dispatch`;
- GitHub-hosted Actions runner;
- invocation run `31792827414`, attempt 1.

A fresh public-registry consumer installed 43 packages with exact Node 22.22.2
and npm 11.5.1, reported `ts-release v0.2.2`, imported the public API, and read
package version `0.2.2`.

## Immutable Action verification

The Action coordinate is
`mannyc2/ts-release/apps/ts-release-action@v0.2.2`. The tag resolves to X, and
the tagged subpath contains `action.yml` (Git blob
`b2049fdbcf4652f65acfc276ebedd3eb5684f48b`, 700 bytes). No floating Action
branch or mutable major tag was created.

## Completion

All planned local, clean-clone, live-release, recovery, public-consumer, and
evidence tasks are complete. The live result converged without recovery and
all independently observed public subjects are equivalent to the exact
candidate. This file is the only change in final evidence commit Z.
