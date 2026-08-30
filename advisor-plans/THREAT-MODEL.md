# Historical ts-release threat-model draft

Status: **SUPERSEDED / NON-AUTHORITATIVE — DO NOT USE AS A DELETION OR SCOPE
CHECKLIST.**

This draft was written 2026-08-15 against
`codex/release-candidate-0.2.2` for the now-rejected advisor plan 001. Its A1–A5
rows retain useful historical risk observations, but they do not authorize
removing a defense, narrowing product scope, or declaring runner concurrency
out of scope. The canonical authorities are
`docs/refactor/research/launch-scorecard.md` for product outcomes and evidence,
and `docs/refactor/research/resumability.md` for journal, reconciliation,
replay, and risk laws. K02 and K03 in the scorecard explicitly require
fresh-runner continuation.

## Historical trusted assumptions

- **The operator**, their configuration, and their build commands. Build
  commands are trusted local code; a one-call process holding secrets in its
  host environment cannot sandbox itself. Isolation between build and publish
  comes from separate CI jobs and protected environments, not from the engine.
- **The host CI platform** (GitHub-hosted runners, environment protection
  rules, OIDC issuance) as the approval boundary.
- **Installed toolchain binaries** (bun, node, npm) and locked dependencies.
- **The registries themselves** (npm, PyPI, GitHub) as the source of truth for
  published state. We verify what they say; we do not defend against them
  lying.

## Historical risk observations

| # | Risk | Evidence it is real | Required mitigations |
| --- | --- | --- | --- |
| A1 | **Our own bugs at the wire** — our model of a provider diverging from the provider's actual behavior | Every live failure to date: X1–X6, the 0.2.0 wrong-MIME/missing-asset escape, the 0.2.1 npm blob-path rejection | Provider-local preflight and read-back; wire-shaped protocol tests; scorecard-specific scratch acceptance and public observation. Archived plan 002 is not the current gate design. |
| A2 | **Credential leakage** into logs, reports, manifests, durable artifacts, or child-process environments | Class of bug common to all release tooling; secrets flow through this code by design | Late `Config.redacted` reads only inside publish; closed child environments; output redaction at process/HTTP boundaries; no secret values or selectors in durable data |
| A3 | **Partial-failure states** — some subjects mutated, some not; ambiguous responses after dispatch | 0.2.0 and 0.2.1 both left partial immutable state | Ordered steps attempted at most once; honest `uncertain`; rerun preflight with provider-local equivalence/conflict rules; no blind retry after dispatch |
| A4 | **Wrong bytes published** — artifact swapped, corrupted, or stale between build and publish | Cross-job artifact transfer is an ordinary CI seam | Size/SHA-256 validated immediately before dispatch; path containment and symlink checks; manifest written last, atomically |
| A5 | **Destination confusion** — credentials sent to an attacker-influenced or wrong endpoint (hostile origin, userinfo, cross-origin redirect) | Standard token-exfiltration class for any tool that POSTs secrets | Closed provider origin sets; canonical HTTPS checks before any secret read/send; no credential forwarding across redirects; no config-chosen secret selectors |

## Superseded scope assumptions

- **The operator's own build commands.** Reason: trusted above. Consequence:
  no seccomp/network-deny, no tool sha256 identities, no private compile-cache
  provenance, no staged-tree snapshot equality as *security* mechanisms.
  (Deterministic-output checks kept for reproducibility QA cite A1/A4, not a
  build adversary.)
- **Concurrent runner fleets racing the same subject.** This assumption is
  rejected for the refactor: scorecard K02 and K03 require fresh-runner
  continuation, and the journal law must remain correct for contenders that do
  not share process memory. Do not use the historical single-runner rationale
  to delete compare-and-swap, reconciliation, or terminal-history defenses.
- **Provable hermetic/supply-chain builds.** Reason: unprovable from inside
  one process; consumers verify bytes at the consumption edge (wheel
  header/ABI gates, digest checks). If ever wanted, it is a CI-level
  attestation at the artifact-transfer boundary, not an engine proof algebra.
- **Compromised registries, CAs, or GitHub infrastructure.** Trusted above.
- **Untrusted contributors.** Single-maintainer repo; release workflows with
  secrets never run on foreign PRs. Revisit this row before accepting
  external maintainers.
- **The engine lying to itself.** Internal representations proving agreement
  with other internal representations is not a mitigation for any row above.
  A1 is mitigated only by contact with the real provider.

## Rejected deletion proposal

The following was plan 001's historical proposed deletion set: seccomp
network-deny and isolation identities; executable/tool sha256 identities;
certified Bun compile-runtime cache provenance; the
authority/grant/audience/purpose algebra; recovery-profile matrices; terminal
claims; the capability/field-ownership certification registry; and the
prepared content-addressed store as a proof mechanism.

That proposal has no current deletion authority. Plan 001 is rejected, the
canonical model preserves lawful continuation, and each item must be evaluated
against current scorecard outcomes and invariants before any separate cleanup
decision. This file neither requires retaining all of them nor permits deleting
them en bloc.
