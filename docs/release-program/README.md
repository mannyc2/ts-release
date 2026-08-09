# Release-engine refactor evidence

This directory is the tracked coordination record for plans 207–222. An
absent handoff means TODO; only a committed terminal outcome satisfies a
dependency. Each plan owns only its listed handoff, while ignored local plan
files and status rows are executor instructions rather than evidence. The
files are documentation-only, excluded from package/runtime inputs, and no
product module imports them.

## Evidence contract

Every handoff records `Input-Commit`, `Result-Commit`, `Evidence-Commit: SELF`,
status/outcome, date and tool versions, commands and results, evidence classes,
semantic and physical changes, limitations, and named tests. The implementing
commit X precedes the evidence-only commit Y; `Y^` is X and `SELF` is resolved
from Git after Y is created. Decision-only plans may use their input as X.

## Owned handoffs

| Plan | Handoff |
|---|---|
| 207 | `check-feature-translation.ts`, `decisions/207-parity-source-cases.md`, `decisions/207-current-config-families.txt`, `decisions/207-current-config-paths.txt`, `decisions/207-feature-translation-ledger.md` |
| 208 | `decisions/208-discovery-recovery.md` |
| 209 | `decisions/209-nfpm.md` |
| 210 | `decisions/210-distribution-identities.md` |
| 211 | `decisions/211-windows-host.md` |
| 212 | `steps/212-verified-context-graph.md` |
| 213 | `steps/213-prepared-release.md` |
| 214 | `steps/214-publication-adapters.md` |
| 215 | `steps/215-catalog-git.md` |
| 216 | `decisions/216-provider-correction.md` |
| 217 | `steps/217-public-lifecycle.md` |
| 218 | `steps/218-agent-distribution.md` |
| 219 | `steps/219-action-workflows.md` |
| 220 | `steps/220-product-truth.md` |
| 221 | `certifications/221-release-candidate.md` |
| 222 | `certifications/222-live-release.md` |

Downstream work must read the committed handoff for every hard dependency and
must not use the ignored `plans/` corpus as dependency proof.

## Evidence classes

Use only `source-derived`, `external-docs-derived`, `contract-tested`,
`live-read-verified`, and `live-write-dogfooded`. Missing credentials are
`UNVERIFIED`; a protocol double is never live.
