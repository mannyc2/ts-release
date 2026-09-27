# Final local qualification

This record closes the implementation and finite owner review on
`codex/standards-continuation`, descended from the selected published 0.4.2 main
`fa50ce368c50e9a28a2e57f667d454374e7b209c`. Earlier implementation records remain
chronological; their old “remaining work” paragraphs are historical, not the
current backlog. Use [requirements status](requirements-status.md) and
[capability disposition](final-capability-disposition.md) for final decisions.

## Local source commits

- `6789c03bc51cbba1d1b62fb88870279afbae5363`: joined native cleanup,
  completed Git repository disposal, authentication timeout causes and fixture
  lifecycle ownership.
- `8fdfd49e55bc5e9df08521c284e993d2936dff71`: resolvable npm/GitHub request
  preflight, generated starter, diagnostic and maintained availability docs.

Qualification was on their combined frozen bytes before these local commits,
not an independent profile of each intermediate commit. Final documentation
reconciliation changes only audit Markdown. The original workspace's 86,485-byte
index listing still exactly matches `/tmp/ts-release-effect-refactor-index-before.txt`;
the final comparison is retained in `/tmp/ts-release-original-index-final.txt`.

## Exact scope and inputs

The final changed-input profile started at local HEAD
`8d5bbaffe7e88298f9e2d91d4cdde9d75e5200d7` plus the coordinated cleanup,
request-preflight, native-fixture and maintained-documentation changes. One
integrator held nonblocking `/tmp/the-show-full-verification.lock` through each
batch and all child processes. Production/tool/test/template inputs were frozen;
research Markdown reconciliation continued independently.

The 382-file input manifest `/tmp/ts-release-final-qualified-inputs.json` has
SHA-256 `ecef841d08fe0266f601eefa89b22bdc01c336664e5db38660b35f0e95fcb700`.
It includes maintained package/application/tool/test/template/CI inputs and root
configuration, including tracked generated delivery and package README assets;
it excludes research documents and ignored build outputs. The selected head plus
these content identities describes the dirty qualification inputs. Later local
commits record these same source bytes; they are not an independently rebuilt
published candidate.

Qualified host: Linux x64, Bun **1.3.14**, native Node **22.22.2**, aligned
Effect/platform **4.0.0-rc.115**, TypeScript **7.0.2** patched by
`@effect/tsgo` **0.45.0**. Native listeners, subprocess pipes and isolated installer
caches ran with approved local capability escalation. Native Node was explicitly
selected; Bun's Node-compatible `process.version` was not counted as another
Node runtime. These checks perform no live registry publication or signing.

## Static stops, corrections and final behavior

Three combined static invocations stopped before behavior qualification:

1. `final-capability-check.log`, exit 1: the inner GitJournal append return
   widened its tag, and rc.115 rejected a typed SQLite cleanup error through
   `onError`. An explicit existing `AppendResult` return annotation and
   `onExitIf(Exit.isFailure, ...)` preserve the intended contracts.
2. `final-capability-check-corrected.log`, exit 1: GitHub's imported inferred
   `never` refusal did not narrow the possibly absent parent. The same branch now
   explicitly returns that refusal.
3. `final-capability-check-qualified.log`, **exit 1 despite its filename**:
   packages compiled and lint passed, then root test types rejected heterogeneous
   ignored-success Effects and unnarrowed application error-code access. Existing
   union/Schema types now express those assertions without casts or suppressions.

The fourth `bun run check` exited **0**. Formatting, every compiler project,
strict lint, import rules and public entry loading passed: **95 source files,
676 import edges, 15 public entries, two owned computed loads**. Log
`/tmp/ts-release-final-capability-check-final.log`, SHA-256
`61f183a94f95cb0fbc0c4ec1480b393a99f39a087b08c9d5d417e27f5d728b12`.

The subsequent `bun run test` generated delivery once and exited **0**:
**356 tests, zero failures, 3,808 assertions across 62 files**, 256.64 seconds.
Log `/tmp/ts-release-final-capability-test.log`, SHA-256
`e8cb9bf3e654fda2502de2bd41ade6be808dad96df8dd4efa01e62527d1c5416`.
This includes the actual final HTTP/SQLite cleanup, authentication timeout cause,
Git repository retention, detached process teardown, Node/Bun pipe barriers,
natural late npm refusal, completed/resumed histories and >18 MiB request proof.

The owner records retain genuine pre-edit failures, later baseline controls,
fixture corrections and environmental stops separately. This successful current
suite does not erase the earlier continuation profile's single corrected OpenAI
assertion or turn earlier stopped aggregates into uninterrupted passes.

## Installed archives and workflow

The following stages ran sequentially under one shared-lock batch; every stage
and the outer batch exited **0**. Bun/npm consumers installed physical archives,
with explicit native Node22.22.2 and Bun1.3.14 runtime selection.

| Stage                                                    | Result                                                                                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check:packed-kernel`                            | Eight public entries, strict installed declarations including preflight and factory E/R inference, absent optional peers, Bun/npm consumers. Work `/tmp/ts-release-packed-kernel-A1009T`. |
| `bun scripts/check-packed-npm.ts --catalog --transports` | All seven archives and native HTTP/Git transport cells, **74 commands**, all exit0. Work `/tmp/ts-release-packed-npm-AHxzi2`.                                                             |
| `bun run check:packed-action`                            | Bun/npm installation, exact physical core resolution, fresh-runner equivalence, one send. Work `/tmp/ts-release-packed-action-LJ5gZz`.                                                    |
| `bun scripts/check-installed-workflow.ts --skip-build`   | Ordinary and interrupted CLI/Action runs, observation, continuation and completed recognition. Work `/tmp/ts-release-installed-workflow-EwDGFv`.                                          |

Logs: `/tmp/ts-release-final-packed-{kernel,providers,action}.log` and
`/tmp/ts-release-final-installed-workflow.log`. `--skip-build` reuses the delivery
just generated by the Action stage inside that batch; it is not a skipped
workflow scenario. Earlier builds are not counted as fresh immutable release
qualification.

The current provider receipt `.release/checks/current-packed-catalog.json` has
SHA-256 `92ba0dca63564c68866225ae12f335f00e148b60811e2da081b23ac0e477c158`.
Its actual archive identities are:

| Package owner | Archive SHA-256                                                    |
| ------------- | ------------------------------------------------------------------ |
| ts-release    | `df65881b16f3e9780344cb75f40fdff12e798cca7fe2ecd0399ee2e79607d04f` |
| npm           | `a2c3511d9a4a76d6c1e5020104f749dd816b30f9989a9e2c9efb3253c5565f4c` |
| pypi          | `cc37c123873751740d37bb1fafa4c6d02ffcdb3e2d7142480bf79286dcb9ef69` |
| github        | `d349b9668c733c049ec41fda3a2b349d62ef54a20f454f40d7484a847b051959` |
| catalog       | `00b50a6f2d5167662ab73ea167173864fc55b760f9d284ca2dae0f0a20bbc572` |
| mcp           | `4ac5a13423fc3dc695d204646607b51cb53177016dd98dc8dc5af6b27a0cae77` |
| openai        | `7db0236ca9ebe14b21dc737721451f5c62fa79193960cc467f3bd6e6f89f8643` |

The Action launcher SHA-256 is
`214dff1ab921bb50b9265d90d0e48e9b2ad987f088d48bd9d2373ca59d365682`.
All 382 recorded input files still matched after these builds and packaging
stages. Research-document edits do not modify those package/application inputs.
The fresh generated starter also passed with the current core/npm/GitHub archives:
Node22.22.2 preparation and Bun1.3.14 input generation produced matching
Bundle/Plan identities and `authorize:false`. It performs no journal access,
observation or publication. Report
`/tmp/ts-release-current-starter-JVRbUa/qualification.json`, SHA-256
`2494a97cb79e8ba102e9d8601a7108453ffb901876c65db1c5a825702ee47499`.

The actual checkout-executor installer then installed all seven archives into
`/tmp/ts-release-historical-executor-final-8d5bbaf`. Every archive hash matches
the table above; its `executor.json` SHA-256 is
`10a74e7d1e9e4a876139f52e8fd9021aff78c9e076a760ef90f33f4ee7818024`.
The receipt truthfully records the dirty qualification head and exact generated
application/helper bytes separately from the retained candidate's source.

The existing historical probe passed again against that physical installation:
202 installed files match archive bytes, the original 19-file candidate remains
unchanged, and its original 26-operation superseded Plan at journal revision2
returns with **zero append, prepare, send, provider-read or trust-verification
calls**. Its 50 content reads verify byte ownership, not cryptographic trust.
The old-executor named-export guard still refuses before input/application access.
Report `/tmp/ts-release-historical-qualification-OoBoIR/qualification.json`,
SHA-256 `5cc99faa421e9e1e6338e35c8eca82906ee5a9de9b0d26fb35b4fdfdef43088f`.
This reuses the already documented read-only fixture adapter and old installed
dependency set; it does not claim a fresh old-version install or native Git remote.

The three-stage starter/install/historical batch and each stage exited **0**
under the same shared lock. Logs are `/tmp/ts-release-final-starter.log`,
`/tmp/ts-release-final-executor-install.log` and
`/tmp/ts-release-final-historical-executor.log`. The existing temporary helpers
are `/tmp/ts-release-qualify-current-starter.mjs` and
`/tmp/ts-release-qualify-historical-executor.mjs`; no additional test matrix or
production test seam was introduced.

## Limits and publication boundary

The retained original 0.4.1 historical candidate has no dispatches. Its genuine
superseded Plan and complete two-event journal establish compatible admission
and zero publication, not interrupted historical-dispatch recovery. The latter
cannot be claimed without its missing complete successor candidate. Current
installed interrupted-workflow proof is a separate claim.

No Node24/26, macOS, Windows, live OIDC/Sigstore signing, paid-provider acceptance
or privileged hosted workflow is certified by this local Linux profile. Actual
native verification and deliberately rejecting native signing settlement have
their own precise earlier records. Injected HTTP/SQLite completion failures run
after real native close; they do not reproduce authentic native close failure.
A genuinely stuck noncancellable native call can still delay interruption.

R34 deliberately covers npm/GitHub local resolvable requests. Journal reads can
use their own Git credentials; future real parent facts are deferred and other
providers/transports refuse unsupported preflight. Existing exact-byte adoption
and candidate handoff remain the mechanism; product ABI/SBOM/CI qualification
policy stays consumer-owned. Optional CI evidence reuse and Sigstore default-root
simplification are bounded future improvements, not new kernel authorities.

These source changes remain local. Only the separately approved checkpoint
`ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f` was pushed to its approved branch.
No descendant push, release publication, version bump or merge is implied by
implementation or successful qualification. Original workspace staging and
`.repos/effect` remain separate and preserved.
