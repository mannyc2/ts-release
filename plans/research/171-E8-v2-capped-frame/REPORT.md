# E8-v2 — observed release-tool invocation mining

Status: `COMPLETE_CAPPED_FRAME`

Acquisition: 2026-07-26 UTC
Preregistration: commit `0f64e85`, SHA-256
`5ce226afc05c947817a360de047e2b81619e6390d0cc5f5a598caa3182f2efa7`

## Lead results

| Measure | Result |
|---|---:|
| Selected sample | 517/600 |
| B1 / B2 / B3 / B4 | 150 / 150 / 150 / 67 |
| Represented fixed tools | 8 |
| `INDEPENDENT_VERBS` | 1/517 (0.193%) |
| 35% heuristic | Does not exceed |
| Strict confirmed-manual gate | 71/517 (13.733%) |
| 10% heuristic | Not below |
| Confirmed + potential environment | 103/517 (19.923%) |
| `SINGLE_VERB` | 430/517 (83.172%) |
| `PLAN_THEN_ACT` | 69/517 (13.346%) |
| `OTHER` | 17/517 (3.288%) |
| Blinded recode disagreement | 0/51; kappa 1.0 |
| Accessible-frame ts-release matches | 0 |

Both heuristics are evaluable because `n=517` and eight tools are
represented.

## What E8-v2 supports

1. **Independent public verbs are exceptional in this frame.** Only one
   selected workflow exposed genuinely independent operations. The result
   does not support retaining several top-level verbs merely because CI users
   commonly invoke them independently.
2. **A staged path is still real.** Plan-then-act appears in 69 workflows and
   is concentrated in cargo-dist (57/63). This supports a durable staged
   execution model, but it does not require every internal phase to be an
   independently selectable public command.
3. **Manual initiation is visible, not dominant.** The strict 13.733% result
   clears the preregistered 10% bar. However, 65 workflows are
   `workflow_dispatch`-only and six gate the publish job on a dispatch
   condition. Only one workflow mentions an explicit approval action/job,
   and it is already dispatch-only. This is evidence for a human gate, not
   evidence for accepted-plan hashes or reviewer-bound approval.
4. **Recovery remains an observable gap.** No selected workflow exposes an
   explicit idempotency/immutable-release mechanism; 20/517 visibly skip an
   already-published result, 13 check release/tag existence, six show retry
   behavior, and 228/517 show no coded recovery guard. This demonstrates
   sparse visible supply, not demand by itself.
5. **Machine output and scoped execution are established idioms.**
   cargo-dist uses `--output-format` in 62/63 selected workflows,
   `--artifacts` in 56, and `--steps` in 51. GoReleaser uses `--clean` in
   77/103; release-it uses `--ci` in 22/44. These support structured output,
   noninteractive operation, and selection flags.

## Tool and band checks

The selected tool counts are cargo-dist 63, Changesets 90, GoReleaser 103,
JReleaser 53, release-it 44, release-please 43, release-plz 42, and
semantic-release 80. One mixed workflow is counted for both tools.

Single-verb shares remain 80.6%–85.3% in every star band. Confirmed-manual
shares in this capped frame rise from 8.7% in B1 to 14.0% in B2, 16.7% in
B3, and 17.9% in B4. B4 has only 67 eligible repository winners, so its
estimate is less precise.

## Acquisition and validation

- 28 fixed queries; 157 usable pages; zero failed pages.
- 13 queries reached the 1,000-result cap; 15 ended short.
- 14,432 raw search rows; 14,186 distinct `repo:path` candidates.
- 8,829 eligible workflows; 8,521 repository winners before band sampling.
- 32 YAML parse failures and 13 default-branch metadata races were recorded.
- Four exact ts-release queries returned zero accessible rows. This is not a
  global absence claim.

Twenty-three pages needed one successful rate-limit retry. The final page
record preserves `attempt=1`, but the rejected response body was not
separately persisted.

The invocation detector was corrected before manifest freeze after a generic
action input caused a cargo-dist overmatch. A later validation correction
joined shell continuation lines and scoped flag extraction to actual
release-tool command segments. Superseded rows and deltas are retained in
`evidence/`; neither correction changed the raw frame, quotas, seed,
taxonomy, or thresholds.

## Limits

This is a relevance-ranked, index-limited first-1,000 frame per fixed query,
not a representative sample of GitHub or an adoption estimate. Search totals
changed during pagination. Stars are values at each repository's retrieval
time. Public workflow files cannot reveal private environment-reviewer
settings. Root package scripts were resolved; hidden/private and non-root
wrappers may remain unresolved.

The unit is one selected workflow file. Independent operations split across
different workflow files, local CLI use, or non-GitHub automation are outside
the instrument, so the low `INDEPENDENT_VERBS` share supports a compact
within-workflow invocation surface rather than proving that users never need
separate operations.

Cargo-dist supplies 57 of the 69 `PLAN_THEN_ACT` rows, largely through its
generated workflow structure. That is strong evidence that projects adopt
and retain a staged template, but weaker evidence that users independently
prefer or designed that shape.

The blinded recode was a second deterministic classification pass over the
frozen extraction by the same experiment owner. Its kappa measures
implementation repeatability, not independent-coder or human-rubric
validity.

## Artifact map

- `raw/frame-freeze.json` and `raw/query-ledger.jsonl`
- `raw/search-results.jsonl` and `raw/query-pages/`
- `derived/candidate-validation.jsonl`
- `derived/manifest.csv`, `derived/manifest.jsonl`, and
  `derived/manifest-freeze.json`
- `derived/invocations.jsonl` and `derived/workflow-coding-final.jsonl`
- `derived/manual-gate-evidence.jsonl` and `derived/recovery-coding.jsonl`
- `derived/recode-second.jsonl` and `derived/recode-comparison.jsonl`
- `measurements/analysis.json` and the CSV tables in `measurements/`
- `evidence/invalid-validation-attempt.md` for correction provenance

E8-v2 describes GitHub's accessible capped, relevance-ranked search frame;
it is not a representative estimate of all GitHub workflows or all users.
It informs future API naming and positioning but does not reopen Plan 170's
failed gate.
