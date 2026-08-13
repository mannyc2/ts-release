# Plan 231 — Typed Homebrew and Scoop catalog delivery

Input-Commit: 410c31675b92d4084f87a9059c090740f92b1dc2
Result-Commit: SELF
Evidence-Commit: SELF
Status: LOCAL IMPLEMENTATION COMPLETE / DELTA CERTIFICATION AND LIVE RELEASE GATED
Outcome: CONTRACT-TESTED EXACT GIT-DATA PAIR / FORWARD CORRECTION / ZERO LIVE MUTATION
Date: 2026-08-13

## Non-authority statement

This handoff authorizes no GitHub repository, branch, release, asset, formula,
or manifest mutation. Plan 231's live delta requires the successful Plan 234
kernel certificate and a separately authorized packet naming exact repositories,
branches, paths, prepared digest, and credential references. No provider
credential was acquired and no public repository was read or changed here.

## Installed vertical slice

- `catalogs.homebrew` and `catalogs.scoop` are separate closed render forms.
  Homebrew emits a formula; Scoop emits a manifest and accepts ZIP downloads
  only. There is no arbitrary whole-file template, shell Git command, checkout,
  push, pull request, deletion, or force-update escape hatch.
- Render inputs reference declared archive artifacts by ID and architecture.
  Preparation substitutes the exact captured SHA-256 and a credential-free
  GitHub release download coordinate derived from the configured source
  repository, release tag, and artifact basename.
- `publish.catalogGit` binds a typed renderer to one repository, branch,
  consumer target path, canonical managed-state path, and token reference.
  Every download artifact must also belong to the installed GitHub Release
  publication. The catalog subject is ordered after all earlier provider
  subjects, so an unconverged release or asset dependency blocks delivery.
- The prepared manifest stores exact target/state artifact IDs and digests,
  renderer/download inputs, source repository/tag, destination paths, and
  publication authority. The prepared store refuses a missing or mismatched
  pair.

## Exact Git Data protocol

Observation reads the repository identity, exact branch ref, exact commit and
root tree, a complete non-truncated recursive tree, and both managed blobs. It
verifies every blob's Git object hash. Hidden repositories, absent branches,
malformed objects, truncated trees, half-present pairs, unsupported modes, and
noncanonical state are inconclusive or conflicting and never authorize a write.

Mutation creates the target and state blobs, creates a tree with the observed
root as explicit `base_tree`, rereads the proposed complete tree, and verifies
that every unrelated path, object type, object ID, and mode is preserved. It
then creates one commit whose sole parent is the observed branch commit and
updates the exact branch ref with `force: false`. A moved-branch 409/422 is a
provider rejection; a lost response becomes outcome-unknown and only exact
reobservation can establish convergence.

Normal publication may advance one canonical active managed pair only by real
SemVer ordering. The old state must bind the adjacent target digest and match
the same catalog, renderer family, and source repository; lexical version
comparison and unowned target replacement are rejected.

## Forward correction

The public `correct` grammar installs one `forward-catalog-state` adapter.
Authored input supplies a SemVer-newer version/tag and the exact architecture,
filename, GitHub release URL, and SHA-256 for every replacement download.
Binding derives all destination and baseline coordinates from the loaded
prepared bundle, requires the same architecture set, and hashes the exact
prepared publication.

Execution rerenders the actual Homebrew formula or Scoop manifest, creates a
canonical `corrected` state containing the correction ID, reason, replacement
version, replacement source tag, and new target digest, and conditionally
updates both files through the same observed Git generation. The consumer
target bytes therefore change; a sidecar-only withdrawal is impossible.

## Source decisions

Primary documentation reviewed on 2026-08-13:

- GitHub REST Git trees: creating a tree from `base_tree` and explicit entries;
- GitHub REST Git refs: non-force ref update and fast-forward refusal;
- Homebrew Formula Cookbook: formula structure and archive URL/SHA-256 fields;
- Scoop App Manifests: manifest version, architecture, URL, hash, and binary
  fields.

Evidence is `external-docs-derived` for documented provider/file formats and
`source-derived` / `contract-tested` for this implementation. Read-convergence
timing remains `ASSUMED/UNVERIFIED`; no live provider fact is claimed.

## Local verification

The contract suite covers deterministic Homebrew/Scoop preparation, strict
SemVer prerelease ordering, exact target/state binding, fresh paired creation,
no-op rerun, preservation of unrelated regular/executable/symlink modes,
explicit base-tree and exact-parent requests, concurrent ref movement, lost
ref response recovery, truncated/malformed observation, active-pair upgrade,
forged state refusal, and authored forward correction that changes both
consumer bytes and managed state. The durable bundle also traverses the public
`publish` and `correct` API through the complete custom host layer against the
same isolated Git-data double; this proves that the default provider module is
reachable without bypassing the public API or its host authority boundary.

Verified locally during implementation:

- `bun run check`
- `bun test test/core/catalog-rendering.test.ts`
- `bun test test/protocol/catalog/catalog-git-protocol.test.ts`
- `bun run check:config-schema`
- `bun run check:capabilities`
- `bun run check:recovery-docs`
- `bun run check:feature-translation`
- `bun run check:examples`

The final aggregate gates and exact result commit belong to the all-plans
closure. Protocol doubles are not live GitHub evidence.

After Plans 230 and 232 were integrated, the complete current-worktree
`check:portable` aggregate also passed with the admitted Node 24.15.0 and npm
11.17.0 runtimes: 372 tests / 2,186 expectations / zero skips or failures,
four generated recovery profiles, nine executable capability entries, 14
runnable examples/templates, built library/CLI/Action artifacts, external
package consumers, and app/Action/agent suites. This is `contract-tested`
current-worktree evidence only; it is not a clean delta certificate or live
catalog-repository evidence.

## Remaining gated work

The local Plan 231 implementation is complete. Live catalog publication or
correction remains gated until Plan 234 succeeds and a new operator packet
names every exact target repository, branch, path pair, candidate commit,
prepared digest, credential reference, expected old commit/tree, and allowed
new target/state digests. Absence of that packet is not publication authority.
