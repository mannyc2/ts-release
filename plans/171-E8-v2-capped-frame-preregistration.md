# E8-v2 preregistration — capped GitHub release-tool invocation frame

Status: frozen before E8-v2 acquisition. Do not change this protocol after
any decision-bearing search result is collected.

## Question and scope

E8-v2 asks:

> What release-tool invocation shapes, gates, flags, and recovery safeguards
> appear in GitHub REST code search's accessible capped search frame?

It does **not** estimate GitHub-wide adoption, prevalence, market share, or
what all users do. GitHub code search is relevance-ranked, index-limited, and
hard-capped at the first 1,000 accessible matches per query.

The product comparison target is `@mannyc1/ts-release` v0.1.0. E8-v2 may
inform future API naming and positioning; it cannot reopen Plan 170's failed
size gate.

## Hypotheses and heuristic decisions

- H1: selected workflows predominantly use one semantic release action; when
  several in-scope phases occur, they are usually plan-then-act.
- H0: selected workflows are dominated by independently selectable release
  verbs such as build-only and publish-only paths.
- If `INDEPENDENT_VERBS` exceeds 35%, report tension with deleting named
  verbs.
- If strict `CONFIRMED_MANUAL` is below 10%, report thin visible approval
  evidence in this capped frame.

Evaluate those two heuristics only when the achieved selected sample has
`n >= 200` and represents at least five fixed census tools. Otherwise report
descriptive counts and mark both decisions `INCONCLUSIVE`. Never round across
a threshold.

## Safety

Research is public and read-only. Do not clone repositories, download bulk
archives, dispatch workflows, publish, release, push, comment, star, or make
any GitHub mutation. Do not edit product source. Retain workflow text only as
needed for coding; publish the required extracts, provenance, and disputed
evidence rather than full third-party files.

## Actual snapshot

The snapshot date is the actual E8-v2 acquisition date. Record acquisition
start/end in UTC and use repository star counts returned at metadata
retrieval. Do not reconstruct or claim a 2026-07-25 historical snapshot.

For each retained workflow record:

`repo`, `path`, `defaultBranchCommitSha`, `blobSha`, `immutableUrl`,
`starsAtRetrieval`, `starBand`, `queryIds`, `searchRanks`, `toolSet`,
`metadataRetrievedAt`, and `collectedAt`.

## Fixed census and search queries

The in-scope tools are:

1. GoReleaser
2. semantic-release
3. Changesets
4. release-please
5. release-it
6. JReleaser
7. dist/cargo-dist
8. np
9. release-plz
10. ts-release

For each main-frame base query below, issue two GitHub REST `search/code`
queries: one with `extension:yml` and one with `extension:yaml`.

- `goreleaser path:.github/workflows`
- `semantic-release path:.github/workflows`
- `changeset path:.github/workflows`
- `release-please path:.github/workflows`
- `release-it path:.github/workflows`
- `jreleaser path:.github/workflows`
- `cargo-dist path:.github/workflows`
- `"cargo dist" path:.github/workflows`
- `release-plz path:.github/workflows`
- `"npx np" path:.github/workflows`
- `"bunx np" path:.github/workflows`
- `"pnpm exec np" path:.github/workflows`

For each resulting query, request pages 1 through 10 with `per_page=100`, or
stop after the first short/empty page when the query has fewer than 1,000
accessible results. Do not add adaptive qualifiers, size partitions, star
filters, owner filters, or replacement discovery queries.

Search these exact ts-release tokens separately with both workflow
extensions and the same page rule:

- `"@mannyc1/ts-release" path:.github/workflows`
- `"mannyc2/ts-release-action" path:.github/workflows`

Eligible ts-release results enter the pooled candidate frame like every
other census tool. Also report every eligible accessible-frame ts-release
match, including rows not selected into the at-most-600 manifest. Zero means
zero found in this accessible frame, never global absence.

## Raw search ledger

Freeze each REST page before validation. Preserve:

- query ID and exact `q`;
- endpoint, `page=1..10`, `per_page=100`, request timestamp, and response
  timestamp/header when exposed;
- HTTP status, `total_count`, `incomplete_results`, result count, rate-limit
  metadata, and any truncation/error;
- each result's within-query rank, repository, path, blob SHA, API URL, HTML
  URL, and repository API URL.

Repeated results remain in the raw ledger. Pool and deduplicate only in the
derived candidate table.

## Eligibility and validation

A candidate must:

1. be in a public, non-fork repository;
2. be a `.yml` or `.yaml` file under `.github/workflows/`;
3. exist at the default-branch commit recorded during validation;
4. visibly invoke an in-scope tool through `run:`, `uses:`, a called public
   workflow/action, or a resolvable package script;
5. not be a vendored mirror, generated fixture, disabled backup, or
   non-workflow file.

Resolve `bun/npm/pnpm/yarn run` indirection from `package.json` at the same
immutable commit. Resolve public called workflows/actions when required to
identify the semantic operation. If semantics remain hidden, retain the row
as `OTHER_UNRESOLVED`; do not guess.

Deduplicate by `repo + path + defaultBranchCommitSha`. Retain at most one
eligible workflow per repository: choose the workflow with the most distinct
in-scope release-tool invocations, then shortest path, then lexicographically
smallest path.

Record every exclusion, inaccessible source, parse failure, unresolved
wrapper, metadata race, and API limitation.

## Star bands and deterministic selection

Assign bands from current `starsAtRetrieval`:

- B1: 0–49
- B2: 50–499
- B3: 500–4,999
- B4: 5,000+

The frozen selection seed is:

`E8-v2|capped-github-code-search|selection-v1`

For each validated repository winner, compute:

`SHA-256(UTF-8(seed + "\n" + owner/repo + ":" + path))`

Use GitHub's canonical owner/repository spelling and exact case-sensitive
path. Within each band, sort by lowercase hex digest ascending; break a
digest collision by case-insensitive `owner/repo:path`, then its original
bytes. Take the first 150 when more than 150 are eligible; otherwise take
all. Do not transfer quota between bands.

Freeze the selected manifest before coding. Analyze every achieved selected
row even when a band is short or total `n < 600`.

## Workflow-shape taxonomy

Assign exactly one headline class:

- `SINGLE_VERB`: one semantic release action, including matrix repetition of
  that same action.
- `PLAN_THEN_ACT`: ordered in-scope phases where an earlier phase creates
  version, plan, manifest, artifact, or state consumed by a later
  publish/release phase.
- `INDEPENDENT_VERBS`: at least two distinct in-scope verbs are independently
  selectable, without a required durable handoff making them one chain.
- `OTHER`: use `OTHER_UNRESOLVED`, `OTHER_MIXED`, `OTHER_NO_VERB`, or
  `OTHER_AMBIGUOUS`.

Precedence: a complete state-producing chain is `PLAN_THEN_ACT`; a chain
coexisting with independent verbs that does not describe the whole workflow
is `OTHER_MIXED`; an artifact upload alone is not a plan.

Extract triggers, job names, relevant `if` expressions, `needs`, relevant
permissions, environments, every in-scope argv/`uses` reference, resolved
indirection, flags/inputs, ordering, state handoffs, and rerun guards.

## Manual-gate taxonomy

Record all applicable evidence:

- `CONFIRMED_MANUAL`: publish is workflow-dispatch-only; an explicit approval
  blocks publish; public settings verify required environment reviewers; or
  a documented external manual approval is required.
- `POTENTIAL_ENVIRONMENT_GATE`: publish names an environment whose reviewer
  protection is not publicly observable.
- `AUTOMATIC_GATED`: only tag, branch, path, actor, or expression filters.
- `NO_OBSERVED_GATE`: no visible manual or potential environment gate.
- `UNRESOLVED_GATE`: public evidence cannot resolve the answer.

Do not infer protection from an environment name. Report strict
`CONFIRMED_MANUAL` and confirmed-plus-potential sensitivity shares.

## Recovery and duplicate-publish fields

Code independently, as multi-label fields:

- concurrency group/cancel policy;
- retry action/loop;
- release/tag existence check;
- registry/version existence check;
- idempotency key or immutable-release flag;
- skip-if-published guard;
- persisted artifact/evidence for rerun;
- manual-rerun-only behavior;
- no visible guard;
- unresolved.

## Flags and ts-release comparison

Preserve raw argv and action inputs. Normalize only when official tool
documentation proves equivalence. Produce per-tool raw and normalized
histograms.

Compare with this frozen ts-release v0.1.0 surface:

- verbs: `init`, `doctor`, `build`, `plan`, `release`, `verify`;
- shared: `--config`, `--root`, `--snapshot`;
- plan: `--out`, `--format=json|text|summary|markdown`;
- build: `--out`, `--format=json|text`;
- doctor: `--target`, `--format=json|text|markdown`;
- release: `--execute`, `--approve-publish`, `--continue`;
- verify: `--published`;
- action commands: `plan`, `doctor`, `build`, `release`, `verify`;
- action inputs: `command`, `config`, `format`, `write-step-summary`,
  `plan-path`, `fail-on-warnings`, `target`, `snapshot`, `execute`,
  `continue`, `published`, `approve-publish`, `upload-evidence`,
  `evidence-artifact-name`.

Report ts-release names with no observed analogue and common upstream names
with no ts-release counterpart, limited to this capped frame.

## Rubric stability

After manifest freeze, sort selected rows by `repo:path` and take every tenth
row beginning with row 10 (`floor(n/10)` rows). Code that subset, complete
all other coding, then recode it without consulting first labels. Report raw
agreement, disagreements, share, Cohen's kappa when computable, every changed
row, and final resolution. Do not revise the rubric to improve agreement.

## STOP and partial-acquisition rules

STOP before acquisition only when authorization or API access fails before
any usable search page is obtained. If at least one usable page is frozen,
preserve and analyze all achieved data even when later queries/pages fail,
bands are short, or total `n < 600`. Record the missing coverage and do not
replace it with another source or query.

Normal documented rate-limit waiting is not a STOP condition.

## Required artifacts and report

Persist:

- raw page/query ledger and pooled candidate table;
- exclusion/validation ledger;
- selected manifest;
- invocation extracts and workflow coding;
- recode table and agreement measures;
- shape tables overall, per tool, and per band;
- flag/input histograms;
- manual-gate and recovery tables;
- accessible-frame ts-release matches;
- exact limitations and deviations.

Lead the report with achieved rows per band/tool, frame completeness by
query, heuristic eligibility, `INDEPENDENT_VERBS`, strict manual gates,
other shape shares, rubric disagreement, and ts-release match count.

End with:

> E8-v2 describes GitHub's accessible capped, relevance-ranked search frame;
> it is not a representative estimate of all GitHub workflows or all users.
