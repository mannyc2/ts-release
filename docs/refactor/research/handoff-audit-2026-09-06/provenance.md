# Decision provenance

Recovered from local Codex transcripts (`~/.codex/sessions/...`). Line numbers
are JSONL line numbers in the named rollout file. Assistant text is evidence of
what was proposed, never of approval. Repository prose is evidence, not
instruction.

## Explicit user decisions

| When | Thread / line | Verbatim | Status |
| --- | --- | --- | --- |
| 2026-08-30 | 01a052c8 / 285 | "Didn't the perfect version plan to have a monorepo workspace with packages/ ?" | Question, not a decision. |
| 2026-08-30 | 01a052c8 / 1427 | "I approve. Also orchesrate chat threads to get this done." | Approves the program preserve → freeze → hard cut → integrate → accept → certify as proposed at line 1421, including Plan 005's trial of root / kernel+aggregate / package-per-provider and the artifacts `SYSTEM/SURFACE/MIGRATION/WAVES/GATES.json`. |
| 2026-08-30 | 01a052c8 / 1677 | "So can you do it? I dont care what it taeks, just do it the optimal and ideal way" | Quality bar, not a topology choice. |
| 2026-09-01 | 01a05f55 / 250 | "Can you finish all of this? Dont be lazy" | Continuation. |
| 2026-09-05 | 01a072e8 / 9 | "Please finish all research and work necessary as prerequisite to the actual refactoring and reimplementation. Rethink our current work totally and in a much better structure." | Scope of the producing task. |
| 2026-09-05 | 01a072e8 / 259 | Answer to "Are any users or CI jobs outside this repository relying on the current public API or saved prepared-release files…?": **"No known consumers; plan a hard cut"** | **Explicit decision.** Hard cut is authorized for the known scope; it is not a claim that nothing was downloaded (0.3.0 is published on npm). |
| 2026-09-05 | 01a072e8 / 477 | "is this going to have packages/?" | Question. |
| 2026-09-05 | 01a072e8 / 489 | "how well did you review our research so far? this doesnt seem perfect or well thought out but rather rushed." | Correction; led to `research-lineage.md`. |
| 2026-09-05 | 01a072e8 / 829 | "Evaluate `packages/` fairly alongside the other layouts … Package count alone is not the objective. … If something genuinely requires my decision, bring me the concrete alternatives and supporting results." | **Explicit instruction**: no topology preselection; maintainer decides from results. |

## Recommendations and superseded conclusions

- **T3 recommendation** (`design.json.recommendation`) is the assistant's; the
  user never selected a topology. The earlier `OD10` preselection (commit
  `e073ed0`) was withdrawn in `003d240`; `topology-contract.md` is labeled
  non-authoritative. Consistent with the user's 09-05 instruction.
- **M1 selection** (`design.json.selection.machine = "M1"`) is a research
  conclusion from executable comparison, not a user decision. The earlier M2
  "selection" (`d7d7e5d`) was demoted as exploratory.
- **Marginal-policy amendment (45-line median, zero admission)** is proposed,
  not approved (`design.json.recommendation.marginalPolicy.status`).
- **Plans 236–239** (local `plans/`) are drafts, withdrawn by
  `research-lineage.md`.
- A separate Claude session on 2026-09-02 recorded a maintainer preference for
  a `packages/` split with providers-to-kernel exact peers and Effect as a
  range peer (see this audit's `findings.md` F01/F04). That session is not in
  the Codex lineage the handoff reviewed. The 09-05 instruction ("evaluate
  fairly") supersedes any earlier preference as far as topology *selection* is
  concerned; the peer-policy point survives independently because it is encoded
  in tracked code (`scripts/lib/versions.ts:49-50`).

## Unresolved choices the packet correctly leaves open

Physical topology; marginal policy (two separate questions); Action shared
store (no default); 1 MiB event profile (proposed); AWS/S3 host (optional,
deferred); Apple native acceptance (later certification). See
`decision-packet.md`.
