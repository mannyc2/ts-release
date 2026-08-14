# Plan 233 — 0.2.2 release-candidate certificate

Input-Commit: a4e79d758529b412629e75367582d03baaa12bf2
Result-Commit: 528bdf9969985e2cb8238192d30c4a2f680ce8c3
Evidence-Commit: SELF
Status: ACCEPTED — LOCAL RELEASE CANDIDATE
Outcome: TWO CLEAN-X MATRICES PASS / COMPLETE BYTES REPRODUCED / ZERO LIVE MUTATION
Date: 2026-08-14

## Scope and disposition

This certificate accepts result commit X as the immutable `0.2.2` local
release candidate. X repairs the deterministic npm failure observed after the
`0.2.1` GitHub subjects completed: npm interprets a suffixless digest blob path
as a package directory. The admitted input remains the exact canonical
prepared-store blob; the publisher now copies those bytes to a private,
mode-0600 `package.tgz` only for the lifetime of the npm process. Tests prove
cleanup after success, provider failure, and interruption.

The existing `v0.2.0` and `v0.2.1` subjects were not changed. This certificate
itself performed no live provider mutation and grants none. The separately
recorded operator authorization governs the subsequent candidate-bound
workflow dispatch.

## Evidence topology

- X: `528bdf9969985e2cb8238192d30c4a2f680ce8c3`
- X parent: `a4e79d758529b412629e75367582d03baaa12bf2`
- X tree: `11e657586355ecc18afa1f8abf684c19dee2e792`
- Y: this evidence-only commit (`Evidence-Commit: SELF`)
- required relation: `Y^ = X`
- required diff: only
  `docs/release-program/certifications/233-release-candidate.md`
- clean clones:
  `/tmp/ts-release-x8-cert-a.LivvwY/repo` and
  `/tmp/ts-release-x8-cert-b.3UkZTe/repo`

Each clone was created independently with `git clone --no-local`, detached at
X, and installed with Bun's frozen offline mode. Both worktrees reported no
tracked or untracked path after certification.

## Host and tool identities

| Coordinate | Certified value |
| --- | --- |
| Host | Linux 6.8.0-101-generic x86_64 |
| Bun | 1.3.14; SHA-256 `9fd36f87e4b90b07632b987a2e4ec81ca15a62c81bf983190cea6d715be2ad74` |
| Node | 22.22.2; SHA-256 `81925c0995b5c1427b5d538e6a90ca2fdc4daffb786b09af749beaf7369d4e90` |
| npm pack basis | 10.9.7; executable entry SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| npm trusted-publishing source check | 11.5.1; same exact CLI entry digest; passed independently in both clones |
| Effect family | exact `4.0.0-beta.83`, including platform-bun, platform-node, and platform-node-shared |
| Action bundle | SHA-256 `4153371a97c08bd5e3e79f5cf190326deb322dfa2c5281414e682e5886d9432d` |

## Prepared result and reproducibility

Both clones independently produced this exact result, and each clone produced
it twice using distinct prepared stores and private staging roots:

- prepared reference:
  `prepared:local:sha256-7bf2a2d40d900d6954787dfc481b0c561e3c1da407403b710589fd64a5d4b6d9`;
- manifest SHA-256:
  `7bf2a2d40d900d6954787dfc481b0c561e3c1da407403b710589fd64a5d4b6d9`;
- schema: `prepared-release/v2`;
- source: X and tree `11e657586355ecc18afa1f8abf684c19dee2e792`;
- 16 artifacts, one collection, two agent members, and two publication
  intents;
- manifests equal, artifact bytes equal, zero differing manifest paths;
- classification: `complete-bytes-equal`.

The npm artifact is blob
`1664ecc664cfcaf1bc5f63b15b9715424629ba4c160e3a8500836fca39056024`,
746,691 bytes, with logical name `mannyc1-ts-release-0.2.2.tgz`. Exact npm
11.5.1 accepted those bytes from a mode-0600 `.tgz` alias in an offline
publish dry-run and reported:

- package `@mannyc1/ts-release@0.2.2`;
- 462 entries and 3,812,384 unpacked bytes;
- shasum `0d1e3b26841fee7cb191a3eb7f416f8f675290b7`;
- integrity
  `sha512-VOEKfGxbp+J+t8ZgzwTUMVt4dMVJx2U2FawEr4LYIBw0GmYb3hZ5EltgWZvCXyvJEt/BaKMzYrclPThXGJ18MA==`.

This proof reproduces the exact classification boundary that failed for
`0.2.1`; no registry write was attempted.

## Artifact verification

Both clone reports agreed on all measurements:

| Target | Executable | tar.gz | zip |
| --- | ---: | ---: | ---: |
| linux-x64 | 95,963,264 | 36,024,909 | 95,963,414 |
| linux-arm64 | 95,070,352 | 35,716,370 | 95,070,506 |
| darwin-x64 | 70,549,584 | 26,623,687 | 70,549,736 |
| darwin-arm64 | 64,833,122 | 24,086,117 | 64,833,278 |

Total and unique prepared artifact bytes were both 776,051,977. The verifier
decoded matching ELF/Mach-O architectures, inspected every target archive,
installed the npm tarball offline, ran the native Linux executable and Node
CLI, exercised the tracked Action bundle, and installed both provider-native
agent ZIPs into disposable layouts. Strict Claude validation passed.

## Complete clean-X gate result

`bun run check:release-candidate` completed successfully in both clones. Each
matrix included:

- exact source context, preparation, two-pass byte reproduction, readiness,
  artifact inspection, and correction containment;
- 383 core tests passed across 70 files, one npm-version-specific source test
  deliberately separated, zero failures, and 2,273 expectations;
- that separated npm 11.5.1 provenance-source contract passed in both clones;
- declarations, JavaScript, the seven-command Node CLI, generated schemas,
  examples, README snippets, package exports, and packed Bun/npm consumers;
- two byte-deterministic provider-native agent archives and disposable native
  installs;
- CLI, app, and Action matrices, including 19 Action tests and 90 Action
  expectations;
- the npm OIDC loopback success path plus issuer, redirect, exchange, expiry,
  and package-binding rejection paths;
- scoped tarball byte equality, mode 0600, closed environment, and cleanup on
  normal completion and fiber interruption.

## Publication disposition

Prepared publication order is exactly GitHub then npm. Before any live
dispatch, the operator must observe that `origin/main` is still X's parent and
that the `0.2.2` npm version, GitHub tag, release, and candidate-bound workflow
run are absent. A fresh run may use only X with an empty `prepared_ref`. Any
recovery may use only the immutable reference emitted by that run; no rebuild,
force, deletion, correction, mutable major tag, PyPI, catalog, marketplace, or
trust mutation is admitted.
