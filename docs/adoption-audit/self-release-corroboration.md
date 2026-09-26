# Corroborating evidence from ts-release's own releases

Audited 2026-09-26 against GitHub main
`fa50ce368c50e9a28a2e57f667d454374e7b209c` (merged 2026-09-23).
This supplement is not a fifth independent adopter. It links the external
consumer problems to upstream fixes and records closely related self-release
incidents that strengthen the improvement priorities.

The local audit workspace is at `9b14c6c14aec5c5a41b2cb0f98d6f1c63bca4d3d`,
with substantial pre-existing staged architecture work. It is not the latest
published implementation. Conclusions about 0.4.x below use remote PR evidence,
not assumptions drawn from the older local source tree.

## Upstream incident ledger

| ID | Recorded problem and consequence | Correction / evidence | Lesson |
| --- | --- | --- | --- |
| TS-1 | Hosted artifact readback supplied a bare hash where `@actions/artifact` 6.2.1 expected `sha256:<hex>`; preparation run 33508849191 failed after upload. | [PR #25](https://github.com/mannyc2/ts-release/pull/25) preserves the canonical digest representation and requires explicit successful digest verification. | Test the actual SDK boundary and same-run/cross-run artifact transfer, not a local approximation. |
| TS-2 | npm certification rejected a prepared manifest without optional repository metadata. | [PR #27](https://github.com/mannyc2/ts-release/pull/27) permits absence while rejecting contradictory metadata. | Separate optional descriptive metadata from the release identity that actually authorizes the operation. |
| TS-3 | npm certification expected source-declaration artifact kind `package`, while the prepared npm tarball had canonical kind `archive`. Hosted run 33519109938 refused before mutation. | [PR #28](https://github.com/mannyc2/ts-release/pull/28) aligns the validator with real prepared artifacts. | Validators must consume real producer output in contract tests. |
| TS-4 | The certifier's job-workflow OIDC expectation disagreed with the provider-native claims observed in run 33522395257. | [PR #29](https://github.com/mannyc2/ts-release/pull/29) binds canonical job workflow coordinates and exact candidate SHA. | Exercise real hosted identities, including workflow/job/environment distinctions. |
| TS-5 | The v0.3.0 release needed guarded recovery after two post-mutation defects, including duplicate-draft reconciliation, and lacked a canonical same-run retention receipt. | [PR #31](https://github.com/mannyc2/ts-release/pull/31) records the recovery and its proof limitation; [PR #33](https://github.com/mannyc2/ts-release/pull/33) fixes nested report identity confusing a transport alias with the canonical content digest. | A published release, its transport reference, durable subject identity, and retained proof are separate facts. Recovery must be able to explain incomplete proof without blindly repeating writes. |
| TS-6 | The publishing job omitted the existing npm trusted publisher's `npm` environment, so its OIDC identity could not match. | [PR #36](https://github.com/mannyc2/ts-release/pull/36) selects the existing environment and documents the binding. | Diagnose the selected credential route and workflow/environment configuration before irreversible work. |
| TS-7 | A workflow repair could not select an already signed candidate from an earlier run; the initial failure message was generic. Fresh runtime installation also selected shared-platform rc.117 alongside Effect/platform-node rc.115. | [PR #38](https://github.com/mannyc2/ts-release/pull/38) adds original-run restoration with reviewed Bundle/Plan hashes, credential diagnostics, and an aligned transitive runtime pin. The PR explicitly says the dependency drift was independently reproduced, not proven to cause that hosted failure. | Retained candidate recovery and exact runtime installation are product requirements. Keep causal claims narrower than coincident symptoms. |
| TS-8 | npm returned HTTP 201 with a token, but authorization rejected unparseable `created`/`expires` metadata. | [PR #39](https://github.com/mannyc2/ts-release/pull/39) validates token type/header safety without treating diagnostic timestamps as authority. It also adds validated history for a superseded, never-dispatched Plan. Browserbase hit this independently. | Test real response shapes; distinguish candidate replacement before dispatch from recovery after a write may have started. |
| TS-9 | npm success other than 201 became `outcome-unknown`; operators could not see the relevant HTTP status or typed error. | [PR #40](https://github.com/mannyc2/ts-release/pull/40) accepts 2xx acknowledgements, retains native status failures without response bodies, and exposes safe `ReleaseError` diagnostics. It changes the rehearsal peer from 201 to 200. | Preserve acknowledged writes separately from observed visibility; ensure test doubles do not erase provider behavior. |
| TS-10 | The Actions installation token's exact repository view reported all permission booleans false, failing a `permissions.push === true` namespace predicate after all seven npm packages were acknowledged. | [PR #41](https://github.com/mannyc2/ts-release/pull/41), [run 35737797624](https://github.com/mannyc2/ts-release/actions/runs/35737797624). The correction recognizes the authenticated exact repository view and lets each write acknowledgement establish write success. | Test actual user-token, Actions-token, and anonymous response shapes separately. Do not invent authority guarantees from a field that has different semantics for different callers. |
| TS-11 | Sixteen successful draft-asset uploads returned 201 but were classified malformed because GitHub used `untagged-<hex>` download URLs. | [PR #41](https://github.com/mannyc2/ts-release/pull/41) admits the draft URL form while binding API asset id and stored name. | Test draft-to-published lifecycle transitions, not just final-state fixtures. |
| TS-12 | After final publication changed the asset download URLs, release parent-evidence comparison disagreed and verification remained inconclusive. | [PR #42](https://github.com/mannyc2/ts-release/pull/42) removes the mutable download URL from identity comparison and tests observation after finalization. | Separate stable provider identity from mutable presentation/location fields. |
| TS-13 | A large native npm upload overflowed V8's stack in the JSON string lexer before dispatch; the same release's smaller requests passed. | [PR #43](https://github.com/mannyc2/ts-release/pull/43) scans strings directly and qualifies 14 MiB archive cases under Node and Bun, including Reactor's retained 18,235,775-byte request. The [published 0.4.2 release](https://github.com/mannyc2/ts-release/releases/tag/v0.4.2) carries the correction. | Use realistic native package sizes and verify the actual request ownership path, including recovery of unchanged retained bodies. |

These are historical records. The fixes are not an invitation to reimplement
already corrected behavior. The useful backlog is regression coverage,
adoption/migration support, and reusable host behavior around the surviving
friction.

## Why existing certification missed important cases

Several corrective PRs report extensive passing suites before the next hosted
failure. The available evidence identifies specific coverage gaps rather than
proving a general lack of testing:

- The npm rehearsal peer answered with 201; real successful responses included
  200 and, in Browserbase's later journals, 202.
- GitHub fixtures did not model Actions-token permission booleans or draft
  asset URLs changing after publication.
- Prepared manifest/artifact fixtures diverged from actual producer output.
- Small npm requests did not exercise the large base64 string parser behavior.
- A fully working application did not guarantee the next fresh consumer install
  resolved an aligned Effect runtime.

Treat sanitized real failure shapes, retained request sizes, and lifecycle
transitions as a permanent consumer regression corpus. Each fixture should
name the incident that motivated it, assert dispatch counts, and run through
the distributed public API under its supported runtime. Keep optional live
credential/host checks separate from the deterministic default test suite.
