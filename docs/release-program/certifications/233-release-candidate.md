# Plan 233 — Corrected release-candidate certificate

Input-Commit: 3a5b7cef4437c5f59bc547481535ebbc83cf437f
Result-Commit: 8ae505ae9548a21c951fb8e16a5f918d8e5bc102
Evidence-Commit: SELF
Status: ACCEPTED — LOCAL RELEASE CANDIDATE
Outcome: CLEAN-X MATRIX PASS / COMPLETE BYTES REPRODUCED / ZERO LIVE MUTATION
Date: 2026-08-13

## Scope and non-authority statement

This certificate accepts result commit X as the corrected local release
candidate. It is not Plan 234 live-release authority. It authorizes no npm or
GitHub read or write, no tag, release, asset, branch, package, Action ref,
catalog, PyPI file, or marketplace mutation, and no credential acquisition.
The invalidated Plan 221 certificate remains invalid and live certificate 222
remains superseded.

The clean matrix ran without `NPM_TOKEN`, `GITHUB_TOKEN`, or `GH_TOKEN`.
`check:self-release-readiness` therefore performed zero network checks and
truthfully reported both npm and GitHub as `UNVERIFIED`. Normal-registry
installation, public `v0.2.0` absence/equivalence, provider visibility, OIDC,
and post-write convergence remain `UNVERIFIED` by this certificate.

## Evidence topology

- X: `8ae505ae9548a21c951fb8e16a5f918d8e5bc102`
- X tree: `9552081511e669a2600699fd8ca8b7c4b08e0151`
- Y: this evidence-only commit (`Evidence-Commit: SELF`)
- required relation: `Y^ = X`
- required diff: only
  `docs/release-program/certifications/233-release-candidate.md`
- clean clones:
  `/tmp/ts-release-plan233-m.nIfklW` and
  `/tmp/ts-release-plan233-n.yDJnvO`

Each clone was created independently with `git clone --no-local`, detached at
X, and materialized 195 packages using Bun 1.3.14's repository-configured
hoisted linker plus exact offline/frozen/script-disabled/no-save installation.
Both were source-clean before the matrix and remained completely clean after
it; `git status --porcelain` emitted no path.

## Host and tool identities

| Coordinate | Certified value |
| --- | --- |
| Host | Linux 6.8.0-101-generic x86_64 GNU/Linux |
| Bun | 1.3.14; SHA-256 `9fd36f87e4b90b07632b987a2e4ec81ca15a62c81bf983190cea6d715be2ad74` |
| Node | 24.15.0; SHA-256 `d1de76d8edf2fededf6f8b30d244e2c0529ac607923a018283b77e9c74bd932c` |
| npm CLI source | 11.17.0; SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| Effect family | exact `4.0.0-beta.83`, including platform-bun, platform-node, and platform-node-shared |
| Action bundle | SHA-256 `578f30b8da101187b0fc54dce881a6ae862f5e25ac67dd5b0fa3684565ff2bec` |

The Action gate built into a disposable directory, byte-compared that output
to the tracked bundle, executed the tracked bundle through Bun, and left both
clone worktrees unchanged.

## Prepared result and reproducibility

Both clones independently produced this exact result, and each clone produced
it twice using a distinct prepared store and private staging root:

- prepared reference:
  `prepared:local:sha256-d62350c0df19d6614cb75683abe7db496b607c9a5dff9ea320c749eb683474f5`;
- manifest SHA-256:
  `d62350c0df19d6614cb75683abe7db496b607c9a5dff9ea320c749eb683474f5`;
- schema: `prepared-release/v2`;
- source: X and tree `9552081511e669a2600699fd8ca8b7c4b08e0151`;
- 16 artifacts, one collection, two agent members, and two publication
  intents;
- manifests equal, artifact bytes equal, zero differing manifest paths;
- classification: `complete-bytes-equal`.

The durable execution basis binds Bun 1.3.14 and exact target-runtime bytes for
Linux x64, Linux arm64, macOS x64, and macOS arm64. Cross-target cache files
were copied singly into disposable read-only private caches; Linux x64 was
bound to the executing Bun SHA-256. The npm pack basis binds npm 11.17.0, its
executable digest, exact offline flags, and complete redacted protocol output.

## Artifact verification

Both clone reports agreed on all measurements:

| Target | Executable | tar.gz | zip |
| --- | ---: | ---: | ---: |
| linux-x64 | 95,844,480 | 35,999,259 | 95,844,630 |
| linux-arm64 | 94,939,280 | 35,690,977 | 94,939,434 |
| darwin-x64 | 70,434,896 | 26,599,294 | 70,435,048 |
| darwin-arm64 | 64,717,538 | 24,060,349 | 64,717,694 |

Total artifact bytes were 774,869,931; unique blob bytes were 774,869,931.
The verifier decoded matching ELF/Mach-O architectures, inspected every target
archive, installed the npm tarball offline, ran the Linux native executable,
ran the Node 24 CLI bundle, ran the composite/Bun Action parser, and validated
both provider-native agent ZIPs.

The exact packed public package contained 418 files, 625,996 compressed bytes,
and 3,160,362 unpacked bytes. Its offline Bun and npm consumers passed with 23
Markdown files, five relative links, exact Effect alignment, the Promise API,
the Node CLI, and durable one- and two-artifact array reloads.

## Complete clean-X gate result

The following aggregate ran successfully in both clones:

`bun run check:release-candidate`

It covered:

- exact source context, preparation, independent reproduction, readiness,
  artifact inspection, and correction containment;
- versions, five executable capabilities, four retained targets, two recovery
  profiles, 260 historical paths, 44 field families, all 87 accepted fields,
  86 executable witnesses, 14 invariants, and import/tree-shaking gates;
- 348 tests across 61 files, zero failures, and 1,948 expectations;
- built declarations and JavaScript, seven-command Node CLI, generated schema,
  five examples plus five templates, README snippets, package exports, and
  packed consumers;
- two byte-deterministic provider-native agent archives and disposable native
  installs;
- the CLI and composite/Bun Action entrypoints, three Action commands, two
  outputs, workflow producer authentication, same-run and cross-run recovery,
  credential confinement, provider protocol goldens, and bounded convergence;
- unsupported PyPI, Homebrew, Scoop, catalog, Windows, partition, and merge
  families remaining strict refusals rather than accepted no-ops.

The canonical npm/GitHub protocol transcripts used by the suite are sanitized
tracked JSONL fixtures. Their global credential denylist and persistence
sanitizer gates passed. These are contract evidence, not claims about current
public provider state.

## Bootstrap and publication disposition

Prepared publication order is exactly GitHub then npm, so a future authorized
Plan 234 execution must establish the immutable Action tag/release coordinate
before npm exposes documentation that references it. The workflow and Action
protocol tests proved this ordering and recovery contract without contacting a
public provider.

No publication operation was executed. Plan 234 remains the only live-write
phase and requires a new exact operator packet and explicit authority bound to
this accepted X (or a later separately certified candidate). Plan 235 remains
dormant until a real cross-host partial-preparation requirement exists.
