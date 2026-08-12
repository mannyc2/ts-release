# Plan 223 — Candidate invalidation and mutation quarantine

Input-Commit: 1bc7828f46ca0c542370903a42acd1c745017f73
Program-Index-Commit: 38322ed14286d97e57e2d37d824132e01f22b4f1
Result-Commit: 348921a497b4f9b3f134689af8b275545638fcb7
Evidence-Commit: SELF
Status: DONE
Outcome: CANDIDATE-INVALIDATED / PUBLIC-MUTATION-QUARANTINED / ZERO-LIVE-MUTATION
Date: 2026-08-12

## Decision

Candidate `1bc7828` is not releasable. The Plan 221 conclusion is invalidated,
Plan 222 is superseded, and neither document is release authority. No npm,
GitHub, catalog, tag, release, branch, OIDC, or other public mutation occurred.
No credential was requested, configured, or used.

The repository release workflow has no manual dispatch and both jobs are
guarded by literal false conditions. The pending changelog and release runbook
contain a blockade notice rather than executable release instructions. The
formatting debt that made the candidate diff gate red was repaired without
changing the affected evidence documents' meaning.

## Toolchain and baseline paradox

- Bun: `1.3.14`
- Node: `v22.22.0`
- npm: `10.9.4`
- OS: Linux `6.8.0-101-generic`, x86_64
- Candidate: `1bc7828f46ca0c542370903a42acd1c745017f73`
- Baseline main: `c61669e7cedf105fdec81112ed6382e839e3233d`

The clean candidate baseline, preserved in the source-derived audit, was
false-green:

| Command | Candidate result |
|---|---|
| `bun run check` | exit 0 |
| `bun test` | 98 pass, 0 fail, 338 expectations, 32 files |
| `bun run check:capabilities` | pass; 11 entries checked |
| `git diff --check origin/main...HEAD` | fail; nine added files had blank lines at EOF |

These green product and metadata gates did not exercise the shipped
credential, Action-result, provider-wire, process-commitment, capability, or
staging boundaries below.

## Deterministic reproduction matrix

All reproductions are local and use sentinel values or protocol-shaped fakes.
Their executable owner is
`test/remediation/223-candidate-blockers.test.ts`.

| Candidate blocker | Closest exercised boundary | Result |
|---|---|---|
| npm and GitHub release credentials are unreachable | Real bundled Node CLI, real Bun CLI, and public API | Both CLIs terminate with `ReleaseInputError`; the API names the missing separate read/publish grant |
| npm correction credentials are unreachable | Real bundled Node CLI, real Bun CLI, and public API | All reach the missing npm credential boundary |
| blocked and non-converged publication look successful | Real `runAction` and a fresh Node-target audit bundle | `PublicationBlocked` and uncertain `PublicationObserved` both emit `complete` |
| read and mutation authority are bundled | Action input projection | Each sentinel npm/GitHub token becomes both `read` and `publish` |
| npm authority is not audience-bound | Action through the real API, foreign-registry prepared bundle, fake process/HTTP | The Action-selected sentinel authorizes both the foreign GET and its npm config, then the Action reports `complete` |
| GitHub asset upload URL is malformed | GitHub adapter with documented URI-template shape | The literal template receives a second `?name=` query |
| digest fallback uses inconsistent grammar | GitHub adapter and identical downloaded bytes | Raw local SHA-256 conflicts with expected `sha256:<hex>` |
| tag equality is not proved | GitHub release observation | Only the release-by-tag endpoint is read; no ref lookup or annotated-tag peel occurs |
| npm auth/provenance fields are accepted then dropped | Decode, resolve, and release-graph compilation | `tokenEnv`, each trusted-publishing field, `access`, and `provenance` produce the same graph |
| prerelease dist-tag intent is absent | Graph plus live npm argv capture | No prepared dist-tag and no `--tag` argument exist |
| an authenticated/private 404 authorizes mutation | Real API coordinator with sentinel authenticated observation | Foreign registry 404 reaches the npm process |
| process commitment is collapsed | Real npm bridge with before-start and unknown fake driver failures | Both become `Rejected(before-dispatch)` |
| failure leaks temporary authority material | Real npm bridge with forced failure | The sentinel-bearing npm config remains until fixture cleanup |
| lifecycle scripts inherit authority | Real npm argv capture | `--ignore-scripts` is absent while the auth config is present |
| npm correction has a read/write race | Two real correction subjects over one shared observation | Both actors observe absence and issue different unconditional messages without revision/ETag preconditions |
| catalog withdrawal does not change consumer bytes | Real catalog correction subject and repository double | Only the managed sidecar changes; target formula bytes remain identical |
| ignored input bytes are outside verified Git facts | Public preparation API with a real local npm pack | Two ignored payloads yield different prepared tarballs under identical verified source facts |
| catalog support is unreachable or internally blocked | Root config inspection, public correction API, and default Node layer | Config produces no catalog publication; correction resolves blocked because no live transport exists |
| runtime-discovered outputs and cross-host partial merge are inexpressible | Public schemas and producer-union audit | Outputs must be statically nonempty; prepared publications omit catalog; no public partition/merge input exists |

The two real CLI-process tests run in the dedicated command
`bun test test/remediation/223-candidate-blockers.test.ts`. The workspace's
managed sandbox adds another process layer under `bun run`, where a bundled
Node process receives `EPERM` when it tries to spawn Git. Composite package
gates therefore skip only those two process cases; the same public application
boundaries and all other reproductions still run there. This is a test-host
constraint, not a product pass.

## Capability truth after containment

The generated registry and its exact evidence join now mark these claims
unsupported until their successor vertical slices are certified:

- `publish.npm`
- `publish.github`
- `catalog.render`
- `publish.catalog-git`
- `correct.npm-deprecation`
- `correct.catalog-state`

Build, archive, and checksum preparation remain supported. GitHub release
correction and arbitrary-index PyPI file yank remain explicitly unsupported as
before. An internal constructor plus a unit test is not support evidence.

## Result-tree verification

| Command | Result | Evidence class |
|---|---|---|
| `bun test test/remediation/223-candidate-blockers.test.ts` | 18 pass, 0 fail, 81 expectations | contract-tested |
| `bun test` | 116 pass, 0 fail, 422 expectations, 33 files | contract-tested |
| `bun run check:portable` | exit 0; core reports 114 pass, 2 documented process-host skips, 0 fail; agents, CLI app, Action app, bundles, schema, examples, README, and exports pass | contract-tested |
| `bun run check:capabilities` | pass; 11 executable entries checked | contract-tested |
| `git diff --check` | pass | source-derived |
| `git diff --check origin/main...HEAD` | pass | source-derived |

Current authored product docs contain no old `self:one-shot`, approval-receipt,
or executable `ship` instruction. Remaining matches are explicitly historical
evidence, negative vocabulary tests, or ordinary English uses of “ship.”

## Semantic changes

- Candidate certificates can no longer be read as current authority.
- False support rows are downgraded at their generated source.
- The release workflow cannot be manually dispatched into either job.
- Current release documentation refuses credentials and external mutation.
- Every audit blocker has an executable local characterization or a strict
  public-schema reachability assertion.

No provider behavior is fixed here. The characterizations describe the
rejected candidate and must be inverted or deleted by their owning remediation
plan rather than preserved as target behavior.

## Successor handoff

The adopted dependency order is `224 → 226 → 225 → 227 → 228k → 229`.

- Plan 224 owns complete prepared references, durable local/Action stores,
  lazy audience-bound authority grants, host-owned sinks, public observation,
  one coordinator, total reports, and the one-step CLI/Action lifecycle.
- Plan 226 plugs the final correlated report algebra into that coordinator and
  repairs GitHub wires, digest grammar, transport/process commitment, bounded
  post-mutation rereads, and false-success projections.
- Plan 225 restores npm only through a certified trusted-publishing/token
  vertical slice with total dist-tag/access/provenance semantics.
- Plan 227 makes accepted configuration and support claims executable by
  construction.
- Plan 228k binds preparation and storage to the exact verified input bytes and
  keeps partition/merge reserved tags fail-closed.
- Plan 229 certifies provider recovery/correction profiles and decides from
  evidence whether any mutation journal is necessary.

Plans 233k and 234k remain downstream. Plan 233k may restore release
instructions only after clean-clone certification. Plan 234k is the sole
kernel public-mutation phase and still requires a new exact operator authority
packet; this handoff grants none.
