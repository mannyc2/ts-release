# Plan 003: Preserve and disposition the pre-freeze ts-release lineages

> **Executor instructions:** This is a preservation and characterization plan,
> not an implementation or landing plan. Follow the steps in order. Do not
> stash, reset, clean, merge, cherry-pick, repair production code, or perform a
> remote mutation. The current overlay, PR22, and historical implementations
> are evidence for Plan 005; none is the selected architecture.
>
> **Architecture-reset rule:** this plan ends after the immutable overlay
> evidence coordinate, verified bundle, signed lineage disposition, and
> reference manifest exist. There is no `-s ours` merge and no stabilization
> branch. Correctness gaps become required Plan 005 traces and Plan 006
> implementation gates.

## Status

- **Priority:** P0
- **Effort:** M
- **Risk:** HIGH
- **Depends on:** operator review of the exact product-overlay manifest
- **Execution:** DONE on 2026-08-30 — evidence commit
  `2ef7a9a61fe40608d053569cbcd71e40fca5c181`; external bundle
  `c426f0423af07233322f3c1b0bd54ad05f368ce9e93530cea3004eb4cca1ed15`;
  canonical reference manifest
  `87e7271f668c4ba821b7935b0082d9b9b7987f6ee29a9a5639557983aa4941ea`.
  The disposition is hash-linked and explicitly records that no identity
  signing key was available; it does not claim a cryptographic identity
  signature.
- **Category:** preservation, provenance, architecture input
- **Planned at:** commit `1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`,
  2026-08-30
- **Evidence branch:** `codex/v1-overlay-evidence-20260830`

## Why this matters

The current implementation exists as a large dirty overlay on the old `main`
coordinate. PR21's product research is committed at
`887a9fe2b35590f3088ffeee84f32722796e03ab`; PR22's native-npm prototype is
committed at `c2ac4ee4e7f02d74a7a1ff435bdfeaca6890b720`. The overlay contains
valuable behavior, tests, provider-law experiments, and known defects, but
making it the first parent of the next implementation would silently select its
22.5k-line structure before the architecture trial.

This plan makes all three lines recoverable and comparable without granting
implementation authority to any of them.

## Outcome

Produce four immutable inputs for Plan 005:

1. a local evidence commit containing the exact non-advisor product overlay;
2. a verified Git bundle containing PR21, PR22, and that overlay evidence ref;
3. a hash-linked 89-path semantic disposition between PR22 and the overlay; and
4. a hash-linked `v1-reference-manifest.json` classifying the overlay as
   `prototype-evidence`, recording known gaps and any escaped durable data.

The selected implementation must later satisfy:

```text
required ancestor: 887a9fe2b35590f3088ffeee84f32722796e03ab
forbidden ancestors: c2ac4ee4e7f02d74a7a1ff435bdfeaca6890b720
                     <overlay-evidence-sha>
```

Individual source may be reimplemented or moved only through a reviewed
`freeze/MIGRATION.json` row. Neither prototype may be merged or cherry-picked
wholesale.

## Preserved authority and deliberate non-authority

Preserve:

- all 69 selected scorecard outcomes and PR21 research laws;
- the exact PR22 and overlay source/tests as historical implementation evidence;
- every incompatible durable codec and public-surface spelling for disposition;
- all known correctness failures, including host dependency shadowing,
  observation-before-correspondence, supersession/late outcomes, asymmetric
  Git-ref bounds, and post-effect GitHub graph rejection.

Do not infer:

- that the root package is the target topology;
- that any current module, namespace, public export, or `v1` codec survives;
- that passing tests make the overlay a production candidate;
- that absent escaped data authorizes compatibility readers; or
- that preservation authorizes push, PR, merge, tag, release, publication,
  credentials, storage deployment, or provider mutation.

## Scope

In scope:

- the non-advisor product overlay reported by Git status;
- `agent/pr20-product-scope-rebuild` / PR21;
- `agent/native-npm-vertical-slice` / PR22;
- a persistent recovery directory outside the worktree;
- read-only tests and measurements;
- the disposition and reference manifest.

Out of scope:

- production fixes or refactors;
- an overlay/PR22 ancestry merge;
- effect-build source changes or package adoption;
- architecture, package, API, or durable-format selection;
- hosted or remote operations.

`advisor-plans/` is excluded from the product-overlay identity. Archive it
separately after review so continued plan editing cannot change the product
witness.

## Step 0: Reproduce the product-overlay identity

Run from `/mnt/models/dev/ts-release`:

```bash
set -euo pipefail
test "$(git rev-parse HEAD)" = 1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3
test "$(git branch --show-current)" = codex/release-candidate-0.2.2
git diff --cached --quiet

product_status="$(mktemp)"
git status --short --untracked-files=all \
  | awk '$2 !~ /^advisor-plans\//' > "$product_status"
test "$(wc -l < "$product_status")" -eq 568
test "$(sha256sum "$product_status" | cut -d' ' -f1)" = \
  3be5496ec85a791eea3c80cce63954124d2d9aaa2542c6d2f7b61761841b265f
awk '
  $1 == "??" {u++}
  $1 == "D" {d++}
  $1 == "M" {m++}
  END { if (u != 191 || d != 347 || m != 30) exit 1 }
' "$product_status"

test "$(git diff --binary --full-index | sha256sum | cut -d' ' -f1)" = \
  348f3004cd781292833b06084c0d1fc90274e7a35723ae5a44189c22eb97f551
test "$(git ls-files --others --exclude-standard -z \
  | LC_ALL=C sort -z \
  | while IFS= read -r -d '' path; do \
      case "$path" in advisor-plans/*) ;; *) printf '%s\0' "$path" ;; esac \
    done \
  | tar --null --no-recursion --format=gnu --mtime='1970-01-01 UTC' \
      --owner=0 --group=0 --numeric-owner --files-from=- -cf - \
  | sha256sum | cut -d' ' -f1)" = \
  2d19de8273acd59c91090c53b7a5ce8210969dd4bf09acf03e41310ab5f3ac19
test "$(git ls-files --others --exclude-standard \
  | awk '$0 !~ /^advisor-plans\//' | wc -l)" -eq 191
test "$(sha256sum advisor-plans/AUDIT-SNAPSHOT.md | cut -d' ' -f1)" = \
  9b2179cec8f288561d10c10d7f450b8a8f173de7454fa2be0a93118c7d5e5419
git diff --check
```

Review the complete 568-row product manifest. Any unexpected credential,
dependency, ignored-research, or generated-cache root is a STOP. Changes under
`advisor-plans/` require a separate plan-archive digest, not a product-baseline
rewrite.

## Step 1: Create the persistent recovery archive

Obtain filesystem authority for a new, exact directory under `/mnt/models/dev`.
If it is not granted, STOP; `/tmp` and this worktree are not durable enough.

Create:

```text
/mnt/models/dev/ts-release-v1-evidence-20260830/
  tracked-full-index.patch
  product-untracked.tar
  product-untracked.tar.sha256
  advisor-plans.tar
  advisor-plans.tar.sha256
  lineage-reconciliation.md
  v1-reference-manifest.json
  ts-release-lineages.bundle
```

The tracked patch must reproduce the Step-0 digest. Build
`product-untracked.tar` from exactly the 191 non-advisor untracked paths using
the same sorted, epoch-mtime GNU-tar policy; it must reproduce
`2d19de8273acd59c91090c53b7a5ce8210969dd4bf09acf03e41310ab5f3ac19`.
Archive `advisor-plans/` separately with a recorded digest. Mark completed
archives read-only.

Do not include `.repos`, `.agent-sources`, `.effect-build-*`, `node_modules`,
`.env*`, `.npmrc`, credentials, caches, or ignored build output. Scan staged
filenames for credential-shaped content without printing matching lines.

## Step 2: Create the immutable overlay evidence coordinate

After the operator confirms the Step-0 manifest and Step-1 archive:

```bash
set -euo pipefail
test "$(git branch --show-current)" = codex/release-candidate-0.2.2
git switch -c codex/v1-overlay-evidence-20260830
git add -A -- . ':(exclude)advisor-plans'
test "$(git diff --cached --no-renames --name-only | wc -l)" -eq 568
git diff --cached --check
git commit -m "Preserve v1 prototype overlay evidence"
test "$(git rev-parse HEAD^)" = 1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3
test -z "$(git status --short --untracked-files=no)"
```

Record `overlay_evidence_sha` and its tree SHA. Make no later commit on this
branch. `advisor-plans/` remains untracked and is not part of the product
evidence coordinate.

Create and verify a Git bundle containing exactly:

- `agent/pr20-product-scope-rebuild` at
  `887a9fe2b35590f3088ffeee84f32722796e03ab`;
- `agent/native-npm-vertical-slice` at
  `c2ac4ee4e7f02d74a7a1ff435bdfeaca6890b720`; and
- `codex/v1-overlay-evidence-20260830` at `overlay_evidence_sha`.

Do not merge the refs. A bundle proves recoverability without inventing a
canonical ancestry.

## Step 3: Attest the PR22/overlay semantic disposition

Regenerate the exact PR22-touched path comparison against the immutable overlay
evidence tree. Require:

- 89 compared paths;
- 64 byte-identical;
- 16 different;
- nine absent; and
- sorted comparison SHA-256
  `e3baf5b0214ea5c10ac8afb7f9a96567131a74e38afbec439607401c2227c874`.

For every different or absent path, record:

- the PR22 behavior/proposition it represented;
- the overlay witness, if any;
- disposition: `retained-evidence`, `evolved-evidence`, `known-defect`,
  `historical-only`, `candidate-for-reimplementation`, or `unresolved`;
- applicable research law and scorecard IDs;
- tests/evidence coordinates; and
- the required Plan 005 trial or future `freeze/MIGRATION.json` row.

Inventory known local `.release` roots, dedicated journal refs/repositories,
package/release history, and operator knowledge for PR22-produced plan, journal,
or report payloads. Record `none-proven`, exact escaped object coordinates, or
`unresolved`; never infer absence merely from this checkout. Escaped data is an
architecture migration input. It does not authorize either old codec as the
new canon.

Hash and mark `lineage-reconciliation.md` read-only. Any unresolved row remains
an explicit Plan 005 STOP condition.

## Step 4: Emit the reference manifest and measurements

Write canonical JSON `v1-reference-manifest.json` containing:

- schema version and `prototype-evidence` classification;
- PR21, PR22, base, overlay evidence, and tree coordinates;
- product-status, tracked-patch, untracked-archive, plan-archive, bundle, and
  lineage-disposition digests;
- the 568/191 and 89/64/16/9 counts;
- observed source/test/generated line baselines and counting commands;
- public exports, package manifest, runtime/host entrypoints, and durable codec
  inventory;
- known correctness gaps and their required trace IDs;
- escaped durable-data finding; and
- the required/forbidden ancestry rule.

Run the existing local gates read-only against the evidence worktree and record
exact commands, versions, pass/fail totals, and failure output digests. A red
gate is characterized evidence, not permission to patch the prototype.

Hash and mark the manifest read-only. Independently restore the three refs from
the bundle into a temporary repository and verify every recorded commit/tree
coordinate.

## Done criteria

- [x] The exact 568-path product overlay and 191 non-advisor untracked paths are
      independently recoverable.
- [x] PR21, PR22, and overlay evidence coordinates restore from one verified
      bundle without a synthetic merge.
- [x] Every PR22/overlay path difference has a hash-linked semantic
      disposition with an explicit no-identity-key attestation.
- [x] Escaped durable data is recorded as `none-proven`, exact coordinates, or
      unresolved evidence; it is never guessed.
- [x] The reference manifest records all hashes, baselines, public/durable
      surfaces, known gaps, and ancestry constraints.
- [x] No implementation repair, ancestry merge, push, PR, hosted dispatch,
      credential use, provider mutation, tag, release, or publication occurred.
- [x] Plan 005 can consume the artifacts without treating a prototype as
      architecture authority.

## STOP conditions

- The product path/count/hash, tracked patch, or untracked product archive
  differs from Step 0.
- Any path would be lost, any secret-shaped file is unresolved, or durable
  recovery outside the worktree is unavailable.
- PR21 or PR22 does not resolve to its exact coordinate.
- The 89-path comparison or its 64/16/9 classification drifts.
- A semantic difference cannot be dispositioned without inventing product law.
- Someone proposes merging/cherry-picking PR22 or the overlay, repairing the
  prototype, calling its root package canonical, or omitting a red gate.
- Any remote or external mutation lacks separate explicit authority.

## Maintenance notes

This plan may be regenerated when the dirty product corpus changes. Do not
change its expected hashes merely because `advisor-plans/` evolves; planning
documents are deliberately outside the product witness. Plan 005 owns all
architecture, package, API, migration, and complexity decisions.
