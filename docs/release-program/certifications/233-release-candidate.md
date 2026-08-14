# Plan 233 — 0.2.1 corrected release-candidate certificate

Input-Commit: fd230356e1935bb60e74d2cef3016e6754cc491e
Result-Commit: a4e79d758529b412629e75367582d03baaa12bf2
Evidence-Commit: SELF
Status: ACCEPTED — LOCAL RELEASE CANDIDATE
Outcome: CLEAN-X MATRIX PASS / COMPLETE BYTES REPRODUCED / REMOTE PREFLIGHT PASS
Date: 2026-08-14

## Scope and immutable predecessor

This certificate accepts result commit X7 as the corrected `0.2.1` release
candidate. It supersedes the incomplete immutable `v0.2.0` GitHub release at
X6 without deleting, rewriting, force-moving, or otherwise correcting any
`0.2.0` subject. At preflight time, npm `@mannyc1/ts-release@0.2.0` remained
absent.

The certificate itself performed no public mutation. It records the local
candidate matrix, the fresh-runner topology, and read-only absence checks that
must hold immediately before the separately authorized release dispatch.

## Evidence topology

- X7: `a4e79d758529b412629e75367582d03baaa12bf2`;
- X7 tree: `00194b89e1b9539d4b65509496beaf397847bb79`;
- Y7: this evidence-only commit (`Evidence-Commit: SELF`);
- required relation: `Y7^ = X7`;
- required diff: only
  `docs/release-program/certifications/233-release-candidate.md`;
- clean clones:
  `/tmp/ts-release-x7-cert-a.v6OK7Y/repo` and
  `/tmp/ts-release-x7-cert-b.tjYOX9/repo`;
- fresh automatic-runner clone:
  `/tmp/ts-release-x7-runner.lPwlTX/repo`.

Each certification clone was detached at exact X7 and installed the frozen
lockfile with Bun's hoisted, offline, script-disabled materialization. Both
clone worktrees remained source-clean after all gates.

## Fixes certified at X7

1. The Effect HTTP adapter now constructs the body before applying explicit
   request headers. A regression test proves `application/zip`, exact content
   length, and caller metadata survive to the real `HttpClient` boundary.
2. Cross-run recovery now authenticates the workflow file from GitHub's
   canonical `path` field and the exact short ref from `head_branch`. The test
   fixture matches the live run-attempt response shape, and foreign paths,
   branches, repositories, runs, attempts, and commits all fail before artifact
   download.
3. Every current package, bundle, manifest expectation, public template, and
   immutable Action example is bound to `0.2.1` / `v0.2.1`. Historical
   `0.2.0` evidence remains historical.

## Host and tool identities

| Coordinate | Certified value |
| --- | --- |
| Host | Linux 6.8.0-101-generic x86_64 GNU/Linux |
| Bun | 1.3.14; SHA-256 `9fd36f87e4b90b07632b987a2e4ec81ca15a62c81bf983190cea6d715be2ad74` |
| Workflow Node | 22.22.2; SHA-256 `81925c0995b5c1427b5d538e6a90ca2fdc4daffb786b09af749beaf7369d4e90` |
| Publisher npm CLI | 11.5.1; SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| Effect family | exact `4.0.0-beta.83` across Effect and all installed platform packages |
| Action bundle | SHA-256 `742de1ed68b717186a60a4efd0bd5f4c12d502a22ee8fe4c2ee87778a0a2ccdc` |

The portable consumer matrix used Node 22.22.2 with its bundled npm. The
publisher-specific provenance source contract was also executed separately
and passed against exact npm 11.5.1, matching `release.yml` without conflating
the consumer installer and trusted-publisher boundaries.

## Prepared result and reproducibility

Both clean clones independently produced this exact result twice using
distinct prepared stores and private staging roots:

- prepared reference:
  `prepared:local:sha256-17d7c5edcab094b25513b8e204fbdd6366fa9cb7b6b8d907f2795f026357d70c`;
- manifest SHA-256:
  `17d7c5edcab094b25513b8e204fbdd6366fa9cb7b6b8d907f2795f026357d70c`;
- source: exact X7 and tree
  `00194b89e1b9539d4b65509496beaf397847bb79`;
- 16 artifacts, one collection, two agent members, and two publications;
- manifests equal, artifact bytes equal, and zero differing manifest paths;
- classification: `complete-bytes-equal`.

The exact workflow npm 11.5.1 boundary intentionally changes the execution
basis and produced local manifest digest
`37c0763381d3d97c00dd8360c4bf5f9d8c5e0157b3f3203e9edfad91e581136d`
in the fresh-runner topology. That difference is expected, explicit, and
bound to the npm executable identity.

## Artifact and package verification

Both clone reports agreed on all measurements:

| Target | Executable | tar.gz | zip |
| --- | ---: | ---: | ---: |
| linux-x64 | 95,963,264 | 36,024,703 | 95,963,414 |
| linux-arm64 | 95,070,352 | 35,716,183 | 95,070,506 |
| darwin-x64 | 70,549,584 | 26,623,518 | 70,549,736 |
| darwin-arm64 | 64,833,122 | 24,085,911 | 64,833,278 |

Total and unique artifact bytes were both `776,049,769`. The verifier decoded
the expected ELF and Mach-O targets, inspected every archive, ran the Linux
native executable, ran the Node CLI, executed the Action parser, and validated
both provider-native agent ZIPs.

The exact packed public package contained 462 files, 745,120 compressed bytes,
and 3,805,917 unpacked bytes. Bun and npm offline consumers passed with 23
Markdown files, five relative links, exact Effect alignment, the public API,
the Node CLI, and one- and two-artifact durable reloads.

## Complete clean-X gate result

Across both clones the candidate passed context, preparation, independent
complete-byte reproduction, readiness, artifact inspection, correction
containment, typechecking, import and tree-shaking rules, generated schema and
documentation, package exports, packed consumers, agents, CLI, and Action
bundles. The portable suite reported 382 passes, one intentionally skipped
npm-source check, zero failures, and 2,258 expectations. The skipped
publisher-source check then passed separately against exact npm 11.5.1 with
five more expectations, covering all 383 tests. The Action-specific matrix
reported 19 passes and 90 expectations.

## Fresh automatic one-job topology

The runner clone repeated the workflow's exact fresh path:

1. frozen, script-disabled, no-save hoisted install primed the Bun cache;
2. root `node_modules` was removed and remained absent;
3. the native Node 22.22.2 Action launcher verified the three pinned Bun
   1.3.14 cross-target runtimes;
4. the bundled Action prepared the complete npm-11.5.1 result from exact X7;
5. the official Actions artifact client validated the artifact name and root;
6. the proof stopped only when the deliberately invalid Actions credential was
   parsed, before hosted commit or any provider observation/mutation.

No hosted prepared reference was emitted. The Action retained only its local
redacted report reference, proving the automatic topology reaches the native
artifact boundary without source `node_modules` or hidden dependency state.

## Read-only remote preflight

Immediately before Y7 was committed:

- `origin/main` was exact X6
  `fd230356e1935bb60e74d2cef3016e6754cc491e`;
- `refs/tags/v0.2.1` was absent;
- the GitHub release lookup for `v0.2.1` returned authoritative `404`;
- npm lookup for `@mannyc1/ts-release@0.2.1` returned authoritative `E404`;
- the 100 most recent `release.yml` runs contained no X7 run.

These observations admit one non-force fast-forward of `main` from X6 to X7
and one fresh `release.yml` dispatch with `candidate_sha=X7` and an empty
`prepared_ref`. Recovery, if needed, must use only the immutable
`prepared:gha:` reference emitted by that run.
