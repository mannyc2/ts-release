# Plan 226 — Truthful provider wires, outcomes, and commitment

Input-Commit: 97bb04b20caff948dc0686fe8e149a408c15eae0
Result-Commit: SELF
Evidence-Commit: SELF
Status: COMPLETE — DETERMINISTIC PROVIDER TRUTH CLOSED
Outcome: CORRELATED-REPORTS / EXACT-GITHUB-WIRES / UNKNOWN-REMAINS-UNKNOWN / ZERO-LIVE-MUTATION
Date: 2026-08-12

Commit convention: `SELF` means this completed implementation and its
deterministic handoff are intentionally co-committed in candidate result X. It
does not name Plan 233 certificate Y or supply live-provider evidence.

## Decision

Observation, decision, mutation attempt, and final subject outcome remain
separate tagged values. A possibly started mutation is never inferred applied
from an exit code or HTTP status. It is reobserved, and only final exact
equivalence yields `ConvergedAfterMutation`. GitHub 401 and 403 are therefore
handled exactly like every other received non-201 first-write response:
`OutcomeUnknown`, followed by conservative reread. No conclusive provider
rejection is claimed without an independently pinned commitment contract.

GitHub observation authenticates exact repository scope, reads the exact tag
ref, recursively peels annotated tags, ignores `target_commitish` as equality
evidence, fully paginates assets, and compares exact name, content type, size,
and SHA-256. Missing API digests require exact byte download. Uploads admit only
the same-repository numeric-release `uploads.github.com` asset URI.

Plan 226's deterministic closure is complete. No test or command in this
handoff contacted GitHub or npm or mutated a public provider.

## Pinned provider contract

`test/protocol/github/contract.ts` is `github-protocol-contract/v1`, GitHub REST
API `2022-11-28`, reviewed on 2026-08-12. It pins official repository, exact
ref, annotated tag, release, asset pagination/download, and upload contracts:

- <https://docs.github.com/en/rest/about-the-rest-api/api-versions>;
- <https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28>;
- <https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28>;
- <https://docs.github.com/en/rest/git/tags?apiVersion=2022-11-28>;
- <https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28>;
- <https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28>.

The endpoint contracts do not promise this repository's post-write visibility
timing. Retry numbers remain explicitly assumed policy, not provider fact.

## Truth and recovery invariants

| Boundary | Closed invariant |
|---|---|
| digest | SHA-256, SHA-512, and SHA-1 are algorithm-tagged; raw, GitHub, SRI, and shasum codecs never collapse |
| observation | equivalent, different, authoritative absence, pending visibility, and inconclusive remain distinct |
| decision | no-op, mutation, provider-authorized create, conflict, and blocked remain distinct |
| attempt | rejected-before-dispatch, started, rejected-by-provider, applied, and outcome-unknown preserve commitment |
| subject | smart constructors validate same-subject correlation, nonempty traces, exact authority, and final equivalence |
| aggregate | complete only when every subject is equivalent/converged; uncertain dominates blocked; dependents become not reached |
| recovery | decision and mutation execute at most once; only post-mutation inconclusive/pending reads retry; exhaustion retains full trace |
| public surfaces | library returns total reports; CLI and Action persist report/reference before failing non-complete operations |

## Filed GitHub-case closure

| Required case | Deterministic disposition |
|---|---|
| exact lightweight tag | exact prepared commit is required; branch-like `target_commitish` is ignored |
| successful annotated chain | recursively peels two tag objects to the exact commit and proves no mutation |
| wrong annotated chain | conflicts before release reads/writes; persisted `wrong-annotated-tag.jsonl` |
| malformed ref/tag object, cycle/depth/unreadable state | inconclusive, zero mutation |
| missing/foreign asset API URI | inconclusive, zero mutation |
| full pagination and later-page failure | all pages required; later failure cannot prove a truncated set |
| duplicate/extra asset names | conflict, zero mutation |
| wrong media type or size | conflict, zero mutation |
| present canonical digest | compared exactly |
| missing digest | exact bytes downloaded and independently hashed; mismatch conflicts; unavailable download is inconclusive |
| anonymous hidden 404 | inconclusive because a private/draft fact may be hidden |
| authenticated exact-repository absence | distinct provider-authorized create proof |
| draft/private disposition | draft mismatch is conflict; anonymous hidden state never authorizes; only bundled authenticated repository authority can establish absence |
| exact create and two uploads | exact URLs, encoded names, content types, lengths, bytes; persisted `create-and-upload.jsonl` |
| partial rerun | only missing asset uploads; persisted `partial-rerun.jsonl` |
| duplicate actor race | winner applies; loser remains unknown and converges by exact reread; no blind replay |
| response loss after commit | one mutation, outcome unknown, exact reread convergence |
| 401/403/404/409/422/429/5xx first-write statuses | all outcome unknown; no status is treated as conclusive rejection |
| post-write hidden-404 lag | provider-specific stateful scenario records anonymous inconclusive plus authenticated `VisibilityPending`, then convergence without another mutation |
| lag exhaustion | five bounded observation cycles, one mutation total, uncertain report with full ordered ten-observation trace |
| upload URI/path/query hardening | only exact uploads host, repository, numeric release id, asset path, unique encoded name query; foreign/malformed forms rejected before transport |
| opt-in live-read replay | disabled-default anonymous GET harness, manual redirects, no credential input, body fingerprints only; never run here |

## Filed process-case closure

| Required process/transport case | Disposition |
|---|---|
| child fails before handle | `RejectedBeforeStart` / `RejectedBeforeDispatch` |
| child exits zero | started, therefore outcome unknown until reread |
| child exits nonzero | started, therefore outcome unknown until reread |
| stdout/stderr collection failure | explicit `StreamFailure`, unknown commitment |
| interruption after start | explicit `ProcessSignal`, unknown commitment |
| provider commits then result is lost | one mutation and exact reread convergence for npm and GitHub |
| HTTP transport failure after dispatch | outcome unknown; mutation never replayed |
| provider non-201 response | outcome unknown, including GitHub 401/403 |
| token/config cleanup | scoped finalization on success, typed failure, defect, and interruption |
| credential leakage | bounded safe reasons, host output redaction, transcript sanitizer, and global six-golden denylist |
| CLI/Action blocked or uncertain | durable report and prepared reference are written before nonzero failure |

## Persisted evidence and commands

Provider truth is exercised by:

- `test/protocol/github/{contract,double,fixture}.ts`;
- `test/protocol/github/github-protocol.test.ts`;
- `test/protocol/github/github-recovery.test.ts`;
- `test/protocol/github/golden/*.jsonl`;
- `test/protocol/npm/{contract,scenario}.ts` and the sibling Plan 225 tests;
- `test/protocol/events.ts` and `test/protocol/protocol-goldens.test.ts`;
- `scripts/replay-provider-reads.ts` and its disabled-default source audit;
- provider-neutral report, coordinator, recovery, and prepared-store suites.

The full focused provider/host run passed **52 tests, 0 failures, 534
expectations across 7 files** under Bun 1.3.14 on a loopback-capable host. A
restricted-sandbox repeat passed all 45 non-loopback cases and rejected the 7
OIDC cases at the localhost bind boundary before protocol execution. The run
includes the complete GitHub case ledger, GitHub
lag/convergence/exhaustion, npm process/status/policy cases, the real local
OIDC child-process vertical, all six persisted goldens, and host credential
cleanup. These are local deterministic results; Plan 233 must repeat the
integrated matrix from clean X.

## External rows kept separate

- The replay harness was not enabled and made no external request.
- No GitHub repository/tag/release/asset state was read or changed.
- Numeric GitHub and npm recovery timings remain `ASSUMED/UNVERIFIED` pending
  expressly authorized Plan 234 live evidence.
- Final result/evidence commit IDs and clean-X repetition belong to Plan 233.

There are no remaining deterministic Plan 226 implementation or test gaps.
This handoff grants no live-write authority.
