# Invalid validation attempt

The first validation process was interrupted after 890 of 14,186 candidate
rows. Its detector searched generic action-input values for tool names. This
incorrectly counted steps such as `actions/upload-artifact` as cargo-dist
invocations when an artifact name contained `cargo-dist`.

No manifest had been frozen and no workflow had been coded. The invalid rows
and their read-only GraphQL query ledger are retained as:

- `invalid-validation-attempt-detector-overmatch.jsonl`
- `invalid-validation-attempt-query-ledger.jsonl`

The corrected detector considers tool names in executable `run` text or
`uses` targets, uses inputs only to resolve the operation of an already
identified tool invocation, rejects cargo-dist installer-only commands, and
deduplicates the same tool/operation/location. Candidate validation then
restarted from the unchanged frozen raw frame.

The first local normalization pass also treated backslash-continued package
installation lines as separate shell commands. It was superseded before
manifest freeze after joining shell continuation lines. Its rows and
summaries are retained as `invalid-validation-normalization-v1*`. The final
normalization reduced the frame from 16,520 coarse detections to 12,213
invocations across 8,829 eligible workflows.

The first post-manifest coding output was validation-only and was superseded
before the blinded recode. It required different step indices to recognize
same-job ordering, so two stateful commands in one shell step (for example,
Changesets version then publish) were incorrectly labeled independent. The
corrected frozen-rubric implementation respects command order within a step
and reserves `INDEPENDENT_VERBS` for separate jobs without a `needs`
relationship. The superseded coding artifacts are retained as
`invalid-first-coding-*`.

To avoid retaining two 63 MB duplicate structural corpora, the superseded
normalization copies were compacted after the manifest and final coding had
been frozen. Their sizes and SHA-256 values are in
`superseded-validation-compaction.json`; all 46 changed v1 rows remain in
`validation-normalization-v1-delta.jsonl`. The authoritative structural
extraction remains `derived/candidate-validation.jsonl`.
