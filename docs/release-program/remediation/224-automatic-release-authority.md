# Plan 224 — Automatic release and authority boundaries

Input-Commit: 38322ed14286d97e57e2d37d824132e01f22b4f1
Result-Commit: 35dad56
Digest-Fixture-Fix: 39b0ed2
Evidence-Commit: SELF
Status: DONE
Outcome: AUTOMATIC-RELEASE-RESTORED / AUTHORITY-BOUND / ZERO-LIVE-MUTATION
Date: 2026-08-12

## Decision

The automatic release lifecycle is reachable through one library coordinator,
the seven-command CLI, and the three-command Action. Optional review remains a
host workflow boundary; no reviewer, approval receipt, frontier, or plaintext
credential entered the release API.

This certification authorizes no provider mutation. npm and GitHub remained
conservative provider subjects at the Plan 224 boundary: exact conflicts could
be proved, while equivalence, absence, and mutation stayed blocked until their
provider plans supplied the missing contracts.

## Durable lifecycle

The public API exposes exactly `inspect`, `prepare`, `observe`, `publish`,
`release`, `correct`, and `dispose`. `release` runs one Effect workflow:

```text
resolve → verify source → prepare → durable commit and reload verification
        → expose complete reference → observe → decide → optional mutation
        → reobserve → total report
```

`publish` begins at the same verified-bundle and publication portion. Remote
operations accept only a `CompletePreparedReleaseRef`; local paths and partial
lookalikes fail before provider construction. Pre-commit failure is carried by
`ReleasePreparationError`. A caught abort after commit carries the exact
reference in `ReleaseAbortedError`. Blocked and uncertain results remain total
library data, while CLI and Action projections fail closed only after writing
safe recovery output.

The canonical reference codec supports:

- `prepared:local:sha256-<64 lowercase hex>`;
- a producer-bound `prepared:gha:<owner>/<repo>/runs/<run>/attempts/<attempt>/artifacts/<name>#sha256-<digest>` reference.

The local store is content addressed. The Action store uploads, downloads, and
verifies the complete bundle before returning or exposing its hosted reference.
It authenticates repository, workflow ref and SHA, run and attempt, candidate
commit, immutable artifact identity, and content digest. A fresh invocation in
the same run can load that exact reference without rebuilding.

## Authority boundary

Prepared publications carry resolved authority intent, not credentials.
`CredentialProvider` returns opaque `AnonymousAccess`, `ScopedSecret`, or
`WorkloadIdentity` grants. Grants expose no secret accessor and cannot enter a
durable Schema value. Every host sink rechecks subject, provider, full audience,
and purpose before side effects.

Secret elimination is confined to host-owned boundaries:

- `HttpAuthorizer` for read-only HTTP;
- authorized mutation HTTP for provider writes;
- `NpmUserConfigResource` for a mode-0600, scoped token file;
- `CertifiedPublisherSpawn` for a closed publisher environment.

Generic preparation commands accept no grant and every nonempty authored
environment request is rejected before spawn. Token user config is removed on
success, typed failure, defect, and interruption. `WorkloadIdentity` cannot
enter token-only positions. Multi-purpose environment tokens are reported as
bundled authority rather than mislabeled as separable least privilege.

Mutation authority is requested only after a typed mutation decision. Exact
equivalence, conflict, and inconclusive observation request no mutation grant.
`ProviderAuthorizedCreate` retains its distinct proof and follows the same lazy
acquisition ordering. Credential unavailability and unsupported strategy remain
structured, secret-free report causes.

## Application projections

The CLI command set is exactly:

```text
init inspect prepare observe publish release correct
```

Real subprocess tests prove a clean build-only release needs no credential, npm
and GitHub reads request only their named capabilities, and a generated
noninteractive preset compiles and executes. A hosted reference is rejected by
the local CLI with host-specific recovery guidance.

The Action input command is exactly `release | prepare | publish`. Automatic CI
uses one `release` call. Reviewed CI hands only the uploaded prepared bundle to
an environment-gated publish job. The integrated acceptance fixture crosses
`runAction`, `makeReleaseApi.release`, the real Action store, and the
provider-neutral coordinator and records this strict order:

```text
upload < verified download < prepared output < publish credential < mutation
```

A fresh attempt publishes by downloading the same reference once, with no
upload, source observation, preparation command, or rebuild.

## Supported library-host boundary

The package now publishes explicit `host` and `store` subpaths. External hosts
can supply structural runtime, store, credential-provider, and HTTP-authorizer
implementations through `makeCustomReleaseLayer` without importing private
service tags. A real external-consumer fixture typechecks and executes using
only legal package exports. Package-export, tree-shaking, README, and import
policy gates cover the new boundary.

## Deterministic verification

All checks below are local and use fake provider responses or sentinel
credentials. No npm, GitHub, Git, catalog, workflow, OIDC, or other public
mutation occurred.

| Command | Result | Evidence class |
|---|---|---|
| Plan 224 focused suite (10 files) | 45 pass, 0 fail, 246 expectations | contract-tested |
| `bun run check` | pass | type-checked |
| `bun run check:import-rules` | pass; 156 files examined | source-derived |
| `bun run check:package-exports` | pass, including real external consumer | packaged-boundary-tested |
| `bun run check:action-bundle` | pass at closure | shipped-bundle-tested |
| `git diff --check` | pass | source-derived |

The focused suite includes real CLI processes, Action durable-store recovery,
public API authority ordering, reference codecs, public-surface enumeration,
sink mismatch refusal, first-create authority, and the integrated Action/API
ordering case.

## Implementation history

The Plan 224 implementation is the contiguous successor slice beginning with
`4eeff1f` (durable complete references), through the authority, coordinator,
CLI, Action, workflow, and acceptance commits, and ending at `35dad56` (public
custom host/store plus integrated Action closure). `39b0ed2` updated one
authority fixture to use canonical algorithm-tagged npm conflict digests after
the Plan 226 digest hard cut; it does not change the Plan 224 authority result.

## Successor handoff

Plan 226 owns truthful provider facts, correlated outcomes, algorithm-tagged
digest wire codecs, GitHub tag/asset behavior, process/HTTP commitment, and
bounded rereads. Plan 225 owns npm trusted publishing, token-mode execution,
dist-tag/access/provenance intent, and exact registry semantics. Plan 224 grants
neither provider the right to mutate before those vertical slices converge.
