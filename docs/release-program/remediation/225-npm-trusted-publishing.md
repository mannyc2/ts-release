# Plan 225 — npm trusted publishing and registry-bound authentication

Input-Commit: 97bb04b20caff948dc0686fe8e149a408c15eae0
Result-Commit: SELF
Evidence-Commit: SELF
Status: COMPLETE — DETERMINISTIC PROVIDER PROTOCOL CLOSED
Outcome: DIRECT-PUBLISH-INTENT-DURABLE / OIDC-LOOPBACK-PROVEN / ZERO-LIVE-MUTATION
Date: 2026-08-12

Commit convention: `SELF` means this completed implementation and its
deterministic handoff are intentionally co-committed in candidate result X. It
does not name Plan 233 certificate Y or supply live-provider evidence.

## Decision

The implementation has one durable npm direct-publication intent. Package,
version, exact prepared tarball, registry, dist-tag, access, authentication,
provenance, repository, workflow path/ref, exact verified source commit, the
versioned npm provenance-environment contract, direct allowed action, and
certified publisher sink survive into the provider subject. Token and workload identity
are eliminated only by separate host-owned sinks. Public npm observation is
anonymous-only: the truthfully bundled publish token never enters its read
path, and private/custom authenticated reads are explicitly unsupported until
they receive a distinct typed read credential. Every
started publisher outcome remains unknown until an exact registry reread proves
name, version, SHA-512 SRI, SHA-1 shasum, and dist-tag equivalence.

Plan 225's deterministic closure is complete. No test or command in this
handoff contacted npmjs.com, GitHub, or a public OIDC issuer, and no provider
state was changed. Live mutation and observed provider timing remain Plan 234
work; they are not a condition of this zero-live-mutation protocol result.

## Pinned upstream contract

`test/protocol/npm/contract.ts` is `npm-protocol-contract/v1`, reviewed on
2026-08-12. It pins Node 22.14.0, npm 11.5.1, the exact package-metadata GET
contract, the GitHub OIDC request environment and custom audience, npm's exact
GitHub provenance environment, and the npm OIDC exchange path. Primary sources
are:

- <https://docs.npmjs.com/trusted-publishers/>;
- <https://docs.github.com/en/actions/reference/security/oidc>;
- <https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md>;
- <https://docs.npmjs.com/cli/v11/commands/npm-publish/>;
- <https://docs.npmjs.com/adding-dist-tags-to-packages/>;
- <https://docs.npmjs.com/cli/v11/configuring-npm/npmrc/>;
- <https://docs.npmjs.com/cli/v11/using-npm/scripts/>;
- <https://github.com/npm/cli/blob/v11.5.1/lib/utils/oidc.js>;
- <https://github.com/npm/cli/blob/v11.5.1/workspaces/libnpmpublish/lib/provenance.js>;
- <https://docs.github.com/en/actions/reference/workflows-and-actions/variables>.

These sources establish wire shapes and supported runtime/authentication
requirements. They do not establish this repository's remote trusted-publisher
configuration or npm visibility timing.

## Required-test closure

| Filed requirement | Deterministic evidence | Result |
|---|---|---|
| durable exact npm intent | strict config/resolve, graph, prepared-manifest canonical bytes, exact artifact binding | PASS |
| auth contradictions and unsupported trusted configurations | token/trusted tagged union; custom registry, self-hosted runner, wrong repository/workflow/ref, stage-only/direct mismatch fail closed | PASS |
| full registry/path audience and purpose | grants bind exact subject/provider/full canonical registry/purpose; foreign audience is rejected before transport/process | PASS |
| least-authority observation | npm subjects carry only anonymous observation strategy; an npm token-read request is typed unsupported; publish grants are not registered with the read sink; GitHub bundled-token fallback remains truthfully modeled | PASS |
| exact host identity before OIDC | before either OIDC request value is read, the real environment platform requires `GITHUB_ACTIONS=true`, exact `GITHUB_REPOSITORY`, exact `GITHUB_WORKFLOW_REF` path/ref, `GITHUB_SERVER_URL=https://github.com`, exact `GITHUB_SHA` equal to the verified prepared source commit, and `RUNNER_ENVIRONMENT=github-hosted`; every missing fact and wrong repository/path/ref/server/SHA/runner/action/sink fails before spawn | PASS |
| complete npm provenance facts | event name, repository/owner IDs, source ref, run ID, and run attempt must have canonical GitHub shapes before OIDC; the host privately snapshots them, binds them to the issued workload grant, and projects that exact snapshot rather than rereading mutable ambient state | PASS |
| exact OIDC names without `NPM_TOKEN` | after host admission, the real environment credential platform admits only the two secret GitHub OIDC request values; the closed child additionally receives the validated non-secret npm provenance snapshot, lifecycle control, and `PATH` | PASS |
| real npm provenance mapping | an offline test executes installed npm 11's real `libnpmpublish` provenance builder with only Sigstore's signing/network boundary stubbed and asserts its complete SLSA payload mapping | PASS |
| certified direct sink | workload grants retain their safe prepared attestation; preflight/spawn recheck canonical npm audience, direct action, certified sink, and direct `npm publish --ignore-scripts --json` shape before exposing OIDC values | PASS |
| real certified publisher loopback | real host credential provider, real child-process sink, local GitHub issuer, documented npm exchange path, and local publication receiver | PASS: 7 cases / 109 expectations |
| OIDC audience and package binding | audience is exactly `npm:registry.npmjs.org`; exchange path is exactly the escaped prepared package; wrong binding rejects | PASS |
| issuer/exchange/expiry/redirect failures | issuer 401, issuer 302, exchange 403, exchange 307, expired short-lived publish credential all fail after start as outcome unknown; neither redirect is followed | PASS |
| exact prepared bytes | local publication receiver hashes and length-checks the exact durable blob | PASS |
| no long-lived authority | hostile ambient `NPM_TOKEN`, `NODE_AUTH_TOKEN`, and an ambient authority sentinel never enter the closed child, reports, or scratch files | PASS |
| toolchain preflight | closed `node --version` and `npm --version`; lower Node/npm rejected before publish dispatch | PASS |
| exact CLI argv and `publishConfig` precedence | certified CLI options explicitly carry tarball, `--ignore-scripts`, registry, tag, access, provenance policy, and JSON; the packed manifest deliberately asks for a foreign registry, `latest`, restricted access, and disabled provenance, while the receiver proves the prepared `registry.npmjs.org` / `next` / public / automatic operation | PASS |
| lifecycle isolation | hostile `prepublishOnly`, `prepack`, `prepare`, `postpack`, `publish`, and `postpublish` all target a sentinel; `--ignore-scripts` plus closed env leave it absent | PASS |
| token resource opacity and cleanup | mode-0700 directory, mode-0600 scoped `.npmrc`, path-scoped token, opaque handle; cleanup on success, typed failure, defect, and interruption | PASS |
| metadata status/redirect matrix | 301/302/307/308, 400/401/403/404/408/409/422/429/500/503 all remain inconclusive and cause zero mutation; no redirect follow | PASS |
| malformed metadata | empty, invalid JSON, null, array, missing maps, and wrong map shapes remain inconclusive | PASS |
| immutable coordinate and tag | equivalent is no-op; different bytes conflict; missing/wrong tag conflict with zero republish or `dist-tag` repair; consumed coordinate never becomes reusable | PASS |
| provenance matrix | required adds `--provenance`; disabled adds `--provenance=false`; trusted automatic adds neither override | PASS |
| process lifecycle | before-start refusal is before-dispatch; nonzero exit, stdout/stderr collection loss, signal interruption, response loss, and any observed exit remain unknown until reread | PASS |
| concurrent actors | both can observe absence; winner publishes; loser receives a started failure and converges only by reread; no blind coordinator replay | PASS |
| first publication | only exact GitHub-hosted direct trusted attestation authorizes an unobservable namespace; token mode remains blocked | PASS |
| recovery agreement | npm profile is coordinate-unique, consumed-after-delete, no mutation retry, bounded rereads of only inconclusive/pending observations, full trace on exhaustion | PASS |
| sanitized transcripts | `fresh-publish.jsonl`, `response-loss.jsonl`, and `already-equivalent.jsonl` are exact persisted goldens | PASS |
| global leakage gate | all six npm/GitHub JSONL goldens parse and pass one global credential denylist; synthetic header/query/argv/cwd/stream sentinels are scrubbed | PASS |
| opt-in replay | `bun run replay:provider-reads` is disabled unless `TS_RELEASE_PROVIDER_REPLAY=read-only`; it admits anonymous GET only, follows no redirects, accepts no credential variable, fingerprints bodies, and classifies 404 as hidden-or-absent | PASS by source/disabled-default test; deliberately not network-run |
| public Action/coordinator vertical | real `runAction`, real adapter/coordinator, durable store, and shared provider doubles cover automatic `release.yml` and reviewed `reviewed-release.yml`; their exact configs use the real environment credential boundary and matching repository/workflow/ref; the loopback test proves the real child sink | PASS without public provider writes |

## Persisted evidence and commands

Provider-specific files:

- `test/protocol/npm/contract.ts`;
- `test/protocol/npm/scenario.ts`;
- `test/protocol/npm/npm-provider-protocol.test.ts`;
- `test/protocol/npm/npm-oidc-loopback.test.ts`;
- `test/protocol/npm/npm-provenance-source.test.ts`;
- `test/fixtures/npm-oidc-loopback-publisher.ts`;
- `test/fixtures/npm-provenance-contract.cjs`;
- `test/protocol/npm/golden/{fresh-publish,response-loss,already-equivalent}.jsonl`;
- `test/protocol/protocol-goldens.test.ts`;
- `scripts/replay-provider-reads.ts`.

The full focused provider/host run passed **52 tests, 0 failures, 534
expectations across 7 files** under Bun 1.3.14 on a loopback-capable host. A
restricted-sandbox repeat passed the 45 non-loopback cases and rejected all 7
OIDC cases at the localhost bind boundary before any protocol action. The OIDC subset requires a
test host that permits binding a localhost ephemeral port; this is local IPC,
not external network access. A restricted network namespace can reject that
bind with `EADDRINUSE`; the same loopback-only run passed when localhost bind
was admitted.

The least-authority, host-admission, protocol, and real-CLI integration focus
passed locally. The final source-commit/provenance-environment focus passed
**49 tests, 0 failures, and 393 expectations** across the platform, durable
intent, graph, authority, provider, publisher authority, Action integration,
and installed-npm source contracts. The real loopback subset separately passed **7 tests, 0
failures, and 109 expectations**. TypeScript also passed after the authority
closure. Plan 233 must rerun the final integrated aggregate from clean X. None
of those commands contacted a public provider.

## External rows kept separate

- No npm trusted-publisher relationship was read or changed.
- The replay harness was not opted in and made no external request.
- No package/version/dist-tag/provenance record was created or changed.
- npm read-convergence timing remains `ASSUMED/UNVERIFIED` pending an expressly
  authorized Plan 234 live run.
- Final result/evidence commit IDs and clean-X repetition belong to Plan 233.

The authored workflow ref is a local host-admission constraint. It is not
claimed to be a field exposed by npm's remote trusted-publisher configuration.
There are no remaining deterministic Plan 225 implementation or test gaps.
This handoff grants no live-write authority.
