# effect-build adoption audit

Audited 2026-09-26. Repository: [mannyc2/effect-build](https://github.com/mannyc2/effect-build). This is an evidence record for improving ts-release, not an implementation or publishing plan.

## Finding in brief

effect-build successfully used a specially qualified ts-release Action to publish five packages as `0.3.0` on **2026-08-15**, after its initial adoption was blocked by install compatibility and missing multi-package/prepacked authoring support. It later removed that integration. The live repository now publishes twelve packages with its own small release script. Subsequent release failures are valuable design evidence, but must not be reported as failures inside ts-release.

The strongest improvements suggested by this history are a standalone consumer-compatible tool distribution, first-class ordered prepacked workspaces, less repository-owned artifact-transfer machinery, and realistic registry-convergence tests. The latest release took thirteen attempts despite eventually publishing all twelve packages successfully.

## Scope and identity

| Evidence | Exact identity |
| --- | --- |
| Local checkout inspected without modifications | Branch `v05`, `fef8e10304b65b12ae71da0b35722c38edc37d80`, 2026-08-23 |
| Cached remote main, also inspected | `e1776b72d4cbb63ceb43fe37e735356ade7f9eeb`, 2026-09-07; this is stale |
| Live GitHub main observed in this audit | [`25e0053ab5a2c7c8477050b1cc483a266ed78670`](https://github.com/mannyc2/effect-build/commit/25e0053ab5a2c7c8477050b1cc483a266ed78670), 2026-09-19 |
| Released ts-release first qualified | `@mannyc1/ts-release@0.2.2`, source `528bdf9969985e2cb8238192d30c4a2f680ce8c3` |
| ts-release Action actually adopted | [`105b6b5cc39757f5284c30b082e7cfd71b9959b2`](https://github.com/mannyc2/ts-release/commit/105b6b5cc39757f5284c30b082e7cfd71b9959b2), branch `codex/prepacked-multipackage-release`; qualification applied to its checked bundle, not the installed library/CLI |
| effect-build release implementation | [`f06f96ca88b6278e5f23a898d758b99fa9322108`](https://github.com/mannyc2/effect-build/commit/f06f96ca88b6278e5f23a898d758b99fa9322108) |
| Successful ts-release publication | [Run 31907395584](https://github.com/mannyc2/effect-build/actions/runs/31907395584), attempt 1, 2026-08-15, exact implementation SHA above |
| Latest custom publication | [Run 35449584662](https://github.com/mannyc2/effect-build/actions/runs/35449584662), `v0.8.0`, attempt 13 succeeded on 2026-09-19 |

The initial incidents below are historical reproductions documented in committed qualification receipts and a merged PR. This audit did not rerun old registry installs. Live GitHub API reads independently confirmed the current main commit, historical successful publication, release asset inventory, PR descriptions, current workflow, and latest release attempts/job logs. No consumer repository, Git ref, registry, workflow, or credential was changed. `gh` could not authenticate locally; the connected GitHub tools supplied the live evidence.

## Direct ts-release adoption issues

### EB-1: A clean supported install failed even when declaring the required Effect peers

**Observed, 2026-08-14; adoption blocker.** Public `@mannyc1/ts-release@0.2.2` required the Effect `4.0.0-beta.83` family. A bare Bun 1.3.14 install/import passed, but explicitly declaring the required peers produced an incorrect-peer warning and split the platform dependency graph. Strict npm 11.11.0 under Node 24.15.0 failed with `ERESOLVE`: the platform-bun range admitted `@effect/platform-node-shared@4.0.0-rc.109`, whose Effect peer conflicted with beta.83. Internal frozen installation and an easy Bun import were therefore insufficient compatibility evidence.

**Response/status:** adoption of the published package remained blocked; the later Action bundle supplied isolation. The historical receipt explicitly did not claim the npm-installed library/CLI was qualified. This is not evidence that today's ts-release has the same dependency failure.

**Improvement:** test packed/public consumer installation with strict peers and fresh resolution, including a consumer that explicitly supplies every advertised peer. Keep Effect endpoints aligned, and prevent standalone release tooling from requiring the application's Effect graph to match.

Sources: [merged PR #2](https://github.com/mannyc2/effect-build/pull/2); [exact qualification record, lines 58–81](https://github.com/mannyc2/effect-build/blob/f4aa76fbda183719aae79b32707b8359e1def483/plans/021-adopt-certified-ts-release-0-2.md#L58).

### EB-2: The release tool's Effect version conflicted with the repository being released

**Observed, 2026-08-15 qualification; related to EB-1 but a distinct consumer compatibility case.** effect-build used the `4.0.0-rc.108` family. Combining it with public ts-release 0.2.2 reproduced `ERESOLVE` against ts-release's exact beta.83 platform-bun peer. Attempting to realign ts-release to rc.108 caused broad API incompatibilities and was reverted.

**Response/status:** the consumer invoked only the bundled Action at an immutable commit, with no custom adapter or ts-release npm dependency in the workspace. This worked without changing effect-build's application dependencies. There was no demonstrated general library compatibility fix in this qualification.

**Improvement:** make dependency isolation an intentional supported deployment choice with a documented compatibility matrix. A bundled CLI/Action should use its own runtime dependencies; an Effect-native library needs separately stated peer compatibility. Do not imply that a successful Action run qualifies the library surface.

Source: [Plan 035 receipt, lines 201–220](https://github.com/mannyc2/effect-build/blob/bbe15a7f1d7771c0a09fa963ade0933f24533671/plans/035-qualify-ts-release-prepacked-multipackage.md#L201).

### EB-3: The released CLI/Action could not express the workspace's package graph

**Observed, 2026-08-14; feature/adoption blocker.** The released schema had singular `npmPackage` and `publish.npm` fields; its installed capability emitted one npm subject. effect-build first needed four packages and then five in dependency order, with GitHub last. The library SDK's ability to install adapters did not make such an adapter available in the stock CLI/Action. Examples aggregating nine npm subjects across separate releases did not prove one multi-package release.

**Response/status:** upstream commit `105b6b5` added an ordered nonempty `publish.prepackedNpm` collection. The existing coordinator and npm publication kernel were retained. Qualification covered every partial prefix, conflicts at each coordinate, response loss, unknown outcomes, GitHub-only continuation, and byte identity; the subsequent five-package live release succeeded.

**Improvement:** expose workspace releases as a normal authored use case with one result, per-package outcomes, explicit dependencies/order, and a shared resume identity. Publish capability claims per entry point and test the actual bundled Action from an external repository without node_modules.

Sources: [Plan 021 lines 72–77](https://github.com/mannyc2/effect-build/blob/f4aa76fbda183719aae79b32707b8359e1def483/plans/021-adopt-certified-ts-release-0-2.md#L72); [Plan 035 implementation and protocol coverage](https://github.com/mannyc2/effect-build/blob/bbe15a7f1d7771c0a09fa963ade0933f24533671/plans/035-qualify-ts-release-prepacked-multipackage.md#L167); [successful publish job](https://github.com/mannyc2/effect-build/actions/runs/31907395584/job/95067248635).

### EB-4: Preparation repacked source instead of adopting the tested candidate bytes

**Observed architectural limitation at baseline `1e9efd7`, 2026-08-14.** `prepare.ts` called `npmTarball` for each graph npm publication. effect-build already packed its candidate once and ran consumers against those exact tarballs. Repacking inside ts-release could not satisfy that integration contract. This was a demonstrated missing capability, not a documented incident of corrupted published bytes.

**Response/status:** the same upstream change as EB-3 introduced explicit path, package coordinate and SHA-256 inputs; preparation inspected and captured the supplied blobs without `npm pack`. Qualification verified ordered identity through config, graph, persistence, coordinator input and GitHub assets. The live release used those bytes successfully.

**Improvement:** keep artifact production and publication separable; support externally built/tested npm tarballs as a durable standard input. Validate identity once at intake, retain it across preparation and resume, and avoid forcing consumers to adopt the tool's build or package step.

Sources: [baseline architecture, lines 27–42](https://github.com/mannyc2/effect-build/blob/bbe15a7f1d7771c0a09fa963ade0933f24533671/plans/035-qualify-ts-release-prepacked-multipackage.md#L27); [implemented prepacked contract, lines 177–200](https://github.com/mannyc2/effect-build/blob/bbe15a7f1d7771c0a09fa963ade0933f24533671/plans/035-qualify-ts-release-prepacked-multipackage.md#L177).

### EB-5: The integration required substantial repository-specific transfer and verification code

**Observed implementation cost; improvement inference, not a ts-release runtime bug.** At the adopted release commit, `release.yml` had 696 newline-counted lines, `write-release-config.mjs` 221, and `verify-release-artifact.mjs` 292. The workflow also included project test jobs, so those counts must not all be attributed to ts-release. Still, the publication boundary explicitly dealt with raw artifact IDs/digests, prepared-store artifacts, preparation reports, source/run/attempt binding, verifier hashes, and the `prepared:gha:` string format. The plan's nominal one-artifact rule needed reconciliation with the Action's three distinct artifacts: raw candidate, prepared store, and preparation report.

The generator repeated package order/version, manifest keys, fourteen consumer fixture identities, registry configuration, and authentication data. The workflow parsed the prepared-reference grammar in shell. This creates an interface-maintenance burden even though the integration was correct.

**Response/status:** the working integration was later removed. There is no evidence that its size alone caused removal, and later simplification targeted broader custom certification machinery too.

**Improvement:** provide a supported candidate manifest codec and handoff helper, machine-readable validation results, artifact download/resolution APIs, and a small two-job template. Keep project-specific consumer validation pluggable without requiring another implementation of the tool's artifact reference protocol. Separate logical candidate identity from storage/report artifacts in documentation.

Sources: [generator contract and config mapping](https://github.com/mannyc2/effect-build/blob/f06f96ca88b6278e5f23a898d758b99fa9322108/scripts/write-release-config.mjs#L142); [publish-side transfer code](https://github.com/mannyc2/effect-build/blob/f06f96ca88b6278e5f23a898d758b99fa9322108/.github/workflows/release.yml#L537); [three-artifact reconciliation](https://github.com/mannyc2/effect-build/blob/b167440d96b081e344ae225fe497a05c052eb8a2/plans/037-recertify-and-release-exact-five-package-bytes.md#L169).

### EB-6: Qualification initially targeted an unreleased exact version

**Observed release availability/documentation friction, not a software failure.** On August 13, effect-build's plan expected `0.2.0`, but registry latest was `0.0.7` and that tag/release returned 404. On August 14 the public line existed as `0.2.2`; neither 0.2.0 nor 0.2.1 had been published. PR #2 corrected the stale requirement to qualify the current patch and its actual bytes. The remaining blockers were EB-1 and EB-3.

**Improvement:** publish a generated release/support manifest with exact package, tag, Action commit, supported surfaces and compatibility evidence. Consumers should qualify an available release identity instead of inferring it from a roadmap version.

Sources: [availability record](https://github.com/mannyc2/effect-build/blob/f4aa76fbda183719aae79b32707b8359e1def483/plans/021-adopt-certified-ts-release-0-2.md#L17); [PR #2](https://github.com/mannyc2/effect-build/pull/2).

## What the successful adoption demonstrates

The adopted configuration named `effect-build`, `effect-build-bun`, `effect-build-deno`, `effect-build-esbuild`, and `effect-build-node-sea` in that order, then selected their prepacked artifact IDs for GitHub. Preparation was separate from the protected publication job. Publication performed no repository checkout, install, build, or repack; it invoked the pinned Action with the prepared reference. This is useful evidence that the core coordinator could serve as a release boundary without owning the consumer's build system. [Configuration](https://github.com/mannyc2/effect-build/blob/f06f96ca88b6278e5f23a898d758b99fa9322108/scripts/write-release-config.mjs#L142), [Action invocation](https://github.com/mannyc2/effect-build/blob/f06f96ca88b6278e5f23a898d758b99fa9322108/.github/workflows/release.yml#L681).

The historical receipt reports five `ConvergedAfterMutation` npm subjects followed by equivalent GitHub state, matching tarball hashes, fourteen public-registry consumer checks, and no repack or retry dispatch. Live API reads in this audit confirmed the run succeeded at `f06f96c` and the [v0.3.0 release](https://github.com/mannyc2/effect-build/releases/tag/v0.3.0) was published at `2026-08-15T20:46:05Z` with exactly five tarball assets. The old report ZIPs were not downloaded/rehashed during this audit; their contents and hashes remain historical receipt evidence. [Publication receipt](https://github.com/mannyc2/effect-build/blob/b167440d96b081e344ae225fe497a05c052eb8a2/plans/037-recertify-and-release-exact-five-package-bytes.md#L184).

## Subsequent release incidents: adjacent lessons, not ts-release defects

Commit [`1da43ac`](https://github.com/mannyc2/effect-build/commit/1da43aca4f96f62cef3552bd02f40cc31ac82496), dated August 23 UTC, removed the old ts-release workflow and its generator/verifier during the 0.4 hard cut. The later repository-owned publisher went through the incidents below. Their relevance is that ts-release can remove the need for consumers to repeatedly implement these concerns.

| ID/date | Observed incident and consequence | Resolution/status and ts-release lesson |
| --- | --- | --- |
| EB-A1, Sept 2 | npm 11.11.0 rejected every registry command: `--fetch-retry-maxtimeout 0` was set without also setting the minimum to zero. Local fake-registry checks missed it. | [PR #33](https://github.com/mannyc2/effect-build/pull/33) repaired both production arguments and fixture allowlists. Exercise the pinned real npm CLI against a loopback registry, not only a mocked process. |
| EB-A2, Sept 2 | Exact-candidate hosted tests assumed a synthetic source SHA; an environment-sanitized child lost the real SHA. Later seven auxiliary cases lacked readiness/tampered artifacts despite the forty main coordinates passing. | [PR #33](https://github.com/mannyc2/effect-build/pull/33), [PR #34](https://github.com/mannyc2/effect-build/pull/34). Run the real produced candidate through the same test harness and make the execution context explicit. |
| EB-A3, Sept 2 | OIDC certification rejected a legitimate new hosted-runner endpoint: the allowlist knew historical `pipelines*` / `_apis/distributedtask` shapes, not the current `run-actions-…actions.githubusercontent.com` and `/<digits>//idtoken/...` shape. | [PR #34](https://github.com/mannyc2/effect-build/pull/34) updated four copies after a scratch observation. Centralize provider endpoint validation and test current hosted credentials without logging tokens. |
| EB-A4, Sept 3 | 0.6.0 stopped after publishing core: no replication settle window; resume compared prepublication baseline tags instead of live tags. The source-bound policy prevented the fixed publisher from adopting the old prefix. | [PR #35](https://github.com/mannyc2/effect-build/pull/35) repaired both bugs and moved eleven packages to 0.6.1, leaving core-only 0.6.0. Model provider visibility separately from conflict; define a controlled tool-upgrade resume path for the same candidate. |
| EB-A5, Sept 5 | 0.6.1 again stopped after core: npm's actual `@sigstore/verify@3.1.0` result had no `identity.oids`; the fake verifier invented that field. | [PR #36](https://github.com/mannyc2/effect-build/pull/36) checked the certificate actually consumed by the real verifier, added real offline attestation regressions, and advanced to 0.6.2. Keep fixtures faithful to pinned dependencies and authenticate the same evidence subsequently inspected. |
| EB-A6, Sept 5 | Final verification failed after all eleven 0.6.2 packages and GitHub Release existed: Bun 1.3.14 treated separate `--config <path>` as an install dependency, producing `ENOTDIR`. | [PR #37](https://github.com/mannyc2/effect-build/pull/37) used `--config=<path>`, exercised the real CLI argument array, and advanced to 0.6.3 under the source-bound policy. Distinguish publication completion from postpublication consumer-check failure so recovery need not create a new package version solely to repair verification. |
| EB-A7, Sept 5 | Reservation/readiness rules assumed public packages still had singleton historical version state; simulated registry tags pointed to absent versions. | [PR #37](https://github.com/mannyc2/effect-build/pull/37) permitted retained public history while still constraining reservation-only packages and pinned placeholder bytes. Test realistic version histories and partial-release baselines. |
| EB-A8, Sept 6 | Moving-main requirements, expiring readiness packets and repeated certification of a large inline publisher created maintenance friction. | [PR #42](https://github.com/mannyc2/effect-build/pull/42) replaced it with publication from tested tags and explicitly preserved exact-candidate resume. This is the maintainer's stated simplification motivation, not proof that ts-release itself required the deleted machinery. |
| EB-A9, Sept 19 | The v0.8.0 tag run failed before packing because tests inherited `GITHUB_REF_NAME=v0.8.0` while their fixture used 0.7.0; branch CI passed. | [PR #51](https://github.com/mannyc2/effect-build/pull/51), [failed run 35449002184](https://github.com/mannyc2/effect-build/actions/runs/35449002184). Isolate fixture environment and test real tag/branch contexts. Production identity checks remained unchanged. |
| EB-A10, Sept 19 | Corrected v0.8.0 required thirteen attempts: attempts 1–12 failed publication, attempt 13 succeeded. Inspected attempts 1, 2 and 12 show successful npm publishing followed by unconfirmed observation; each next inspected attempt recognizes already-published identical bytes. | [First failed publish](https://github.com/mannyc2/effect-build/actions/runs/35449584662/job/105914674373), [second](https://github.com/mannyc2/effect-build/actions/runs/35449584662/job/105914987443), [twelfth](https://github.com/mannyc2/effect-build/actions/runs/35449584662/job/105917080187), [successful thirteenth](https://github.com/mannyc2/effect-build/actions/runs/35449584662/job/105917263720). The run completed through resume; the current source still polls six times with five-second intervals. Improve convergence deadlines, read backoff and visibility diagnostics. |

For EB-A10, the first inspected log published core with provenance at about 14:46:14 UTC, then declared publication unconfirmed at 14:46:42 with no underlying publish exception. Attempt 2 skipped core, published Apple, then failed observation. Attempt 12 skipped eleven packages, published Windows, and failed observation. Attempt 13 skipped all twelve as byte-identical at 15:05:42. All thirteen attempts' job conclusions were read; logs were sampled for attempts 1, 2, 12 and 13. Delayed registry visibility is the explanation supported by the code and sampled logs; the exact cache/replica layer was not established. Avoid claiming the same log was inspected for every intermediate attempt.

## Current implementation patterns worth carrying into ts-release

At live main `25e0053`, the [release workflow](https://github.com/mannyc2/effect-build/blob/25e0053ab5a2c7c8477050b1cc483a266ed78670/.github/workflows/release.yml) has three stages: preserve candidate, exercise installed consumers, then publish/resume under the npm environment. Its useful properties are small enough to be a practical integration target:

- **One preserved candidate:** first execution builds/packs; reruns restore `release-packages`. An ambiguous or missing candidate on later attempts stops instead of repacking. The artifact is retained for ninety days. [Workflow lines 32–59](https://github.com/mannyc2/effect-build/blob/25e0053ab5a2c7c8477050b1cc483a266ed78670/.github/workflows/release.yml#L32).
- **Consumer compatibility against actual tarballs:** separate Node 22/24 and TypeScript 5.9/6 checks run before publication. The project can keep these tests while delegating publication. [Workflow lines 61–92](https://github.com/mannyc2/effect-build/blob/25e0053ab5a2c7c8477050b1cc483a266ed78670/.github/workflows/release.yml#L61).
- **Preflight the whole package set:** conflicting existing coordinates stop before the first missing package is uploaded. Existing package metadata and downloaded tarball bytes must match. [Script lines 82–107](https://github.com/mannyc2/effect-build/blob/25e0053ab5a2c7c8477050b1cc483a266ed78670/scripts/release-packages.mjs#L82).
- **Observe after process failure:** a failed upload process is not assumed to mean no publication. Resume skips exact existing packages. [Script lines 109–136](https://github.com/mannyc2/effect-build/blob/25e0053ab5a2c7c8477050b1cc483a266ed78670/scripts/release-packages.mjs#L109).
- **Explicit source/tag identity and serialization:** candidate source must match the workflow SHA, package versions must match the release tag, and concurrency uses one `npm-release` group across versions. [Candidate decoder](https://github.com/mannyc2/effect-build/blob/25e0053ab5a2c7c8477050b1cc483a266ed78670/scripts/release-packages.mjs#L51), [concurrency](https://github.com/mannyc2/effect-build/blob/25e0053ab5a2c7c8477050b1cc483a266ed78670/.github/workflows/release.yml#L10).

Review opportunities in this custom implementation are not proven incidents: the visibility window is short; post-publication checking validates version bytes rather than a complete dist-tag/provenance policy; retained artifacts expire; and alphabetical package iteration is not a general dependency scheduler. These are places where a small ts-release integration could add value while preserving the consumer's simple workflow. Do not infer that current ts-release lacks those capabilities without a separate version-specific source review.

## Improvement priorities supported by this repository

1. **Regression suite:** turn EB-1/EB-2, ordered external tarballs, and the hosted/tag context lessons into actual external-consumer tests of published entry points. Use real pinned npm/Bun clients and an HTTP fixture for observation lag and response loss.
2. **Convergence without repeated workflow dispatch:** represent waiting for visibility separately from conflict/unknown commitment; use bounded configurable backoff, report the last observation, preserve exact candidate identity, and give a read-only resume/observe command.
3. **Small multi-package integration:** standard manifest plus exact-byte intake, one preparation reference, a two/three-job template, and per-subject results. Reuse consumer build/test artifacts without duplicating source, package ordering, or prepared-reference parsing in shell.
4. **Recovery across tool fixes:** explicitly distinguish candidate bytes/source from publisher implementation and verifier version. Decide what reviewed migration permits a fixed publisher/verifier to finish an already partially published candidate; do not silently relax provenance identity.
5. **Separate optional assurance from basic release use:** the history supports strong exact-byte defaults, but also a clear demand for fewer custom certificates, moving-main gates and duplicated policies. Provide optional, composable assurance hooks with durable reports rather than forcing every adopter to own another release protocol.

## Evidence limits

The GitHub issue search returned two product-design issues (#32 and #39); the release incidents above were recorded primarily in merged PRs, code, plans and Actions jobs. This audit does not infer absence of other incidents from the small issue count. Current release workflow/run status was verified live; old install logs and expired report contents were not independently reproduced. The current v0.8.0 run is successful, but the live GitHub release list did not include a v0.8.0 Release; this audit does not infer an expected GitHub publication from the npm-only current workflow. The successful 0.3.0 adoption does not qualify newer or different ts-release entry points.
