# Release-candidate runbook

This source tree is not release authority. The repository release workflow is
manually dispatchable, but its existence is not permission to run it. It has
no automatic trigger and rejects the job before checkout unless the event is
for `mannyc2/ts-release`, `refs/heads/main`, and an exact required
`candidate_sha` equal to `github.sha`. Do not provide production write
credentials, dispatch publication, create a tag or GitHub release, or publish
npm bytes during Plan 233 candidate certification.

## Non-mutating candidate sequence

1. Commit one result commit X containing the product, public docs, generated
   schema/capability pages, workflows, bundles, and tests. Push X to `main` and
   keep X as the exact `main` tip through the later Plan 234 dispatch.
2. Check out X in two independent clean Linux workspaces. Install the locked
   Bun dependencies without modifying either tree. The self-preparation process
   resolves `BUN_INSTALL_CACHE_DIR`, or the standard cache beneath `HOME`, but
   exposes only the canonical cache directory to its offline Bun child. macOS
   remains a cross-compiled artifact target, not an execution-host certification.
   The certified install uses Bun's hoisted linker so every admitted dependency
   byte remains under the one provenance root `node_modules`.
   Before preparation, provision the exact Bun-version runtime files for every
   advertised cross target in the host cache. The process driver copies one
   verified runtime at a time into a disposable read-only cache; self-preparation
   must not download a target runtime.
   The composite Action performs this host bootstrap before `release` or
   `prepare`: it downloads only the versioned Bun runtime files in a closed,
   credential-free environment and verifies their pinned SHA-256 values before
   the offline preparation boundary starts. `publish` recovery skips bootstrap
   because it consumes an already-complete durable bundle.
3. Run the complete release-candidate gate and every public-entrypoint smoke
   matrix. A skipped execution host is removed from the support claim.
4. Prepare the self-release independently twice. Verify exact-commit
   materialization, every manifest/blob, agent bundle, npm tarball, archive,
   checksum, and target file format. Record whether complete bytes reproduce;
   do not describe non-reproduction as success.
5. Install the packed npm tarball in clean Bun and npm/Node consumers, using an
   exact runtime admitted by the root package engine. Validate every packaged
   relative link, the Promise API against built declarations and JavaScript,
   and the bundled CLI as a real process. Separately execute the Action's exact
   Linux composite command after installing its pinned Bun runtime, and prove
   every advertised workflow installs Bun before the Action; one claim cannot
   stand in for the other.
6. Run automatic and environment-gated workflow fixtures against protocol
   servers. Attach sanitized npm/GitHub event transcripts and redacted Action
   reports. Protocol doubles are contract evidence, never live evidence.
7. From X, create a separate evidence branch and write the evidence-only
   certificate Y with `Y^ = X`. The certificate names X, records
   `Evidence-Commit: SELF`, contains no generated release bundle, and labels
   every omitted live read or write `UNVERIFIED`. Commit and push Y on that
   evidence branch. Do not merge, fast-forward, or otherwise put Y on `main`
   before the Plan 234 dispatch: doing so would make `github.sha` equal Y and
   invalidate X's source and provenance identity.

Any dirty input, stale generated file, failing gate, secret-shaped evidence,
unsupported advertised row, or unexercised claimed host stops certification.

## Bootstrap requirement

The packaged README names the immutable Action coordinate
`mannyc2/ts-release/apps/ts-release-action@v0.2.0`. Consumers must not see that
README before the tag exists at exact result commit X. The live-release packet
therefore needs a proven order that makes the immutable GitHub Action ref
available before npm publication, or another tested bootstrap with the same
property.

The self-release context and prepared-bundle gates assert GitHub-before-npm
ordering. Candidate certification remains open until those assertions pass on
clean X and the workflow/provider fixture proves the GitHub coordinate is
usable before npm publication, without rebuilding or changing X.

## Live-release boundary

Candidate certification performs public reads only where explicitly scoped
and performs zero public writes. Do not dispatch this workflow as part of Plan
233. A later Plan 234 live-release packet must name the exact X/Y commits,
prepared digest and artifacts, destination coordinates, credential sources by
reference, sole mutation command, mutation order, response-loss recovery
command, and STOP outcomes. A generic request to release, a green protocol
double, or the presence of credentials is not that authority.

Once that exact Plan 234 authority exists, first verify that `main` still
resolves to X. Dispatch `.github/workflows/release.yml` at `ref: main` with
`candidate_sha: X` and an empty `prepared_ref`. The one admitted job selects
`release`, passes the self-release configuration, prepares X once, persists
its exact `prepared:gha:` reference, and publishes GitHub before npm. A
repository, ref, or SHA mismatch leaves checkout, installation, and the Action
unreached. Y must remain only on its evidence branch while this run executes.

For an automatic-workflow retry after durable preparation, keep X at the
`main` tip and dispatch the same workflow with `candidate_sha: X` and the exact
emitted `prepared_ref`. The job then selects `publish`, passes no configuration,
loads the prior Actions artifact under `actions: read`, reobserves every
subject, and does not rebuild. Never substitute a local path or prepare a new
candidate to recover an uncertain outcome.

For the reviewed two-job template, dispatch with the exact `candidate_sha`.
If publication fails after preparation, rerun the failed `publish` job in the
same workflow run so it consumes the original prepare output and artifact; do
not start a new prepare job. In both topologies, conflict or inconclusive
observation is a STOP outcome, and npm remains not reached unless the immutable
GitHub Action/tag subject has converged first.

Only after the authorized live run and its redacted report have converged may
the operator fast-forward `main` from X to its direct child Y. That evidence
branch update is separate from publication and is not performed by the release
workflow.
