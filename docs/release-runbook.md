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
   The native Node 24 Action launcher performs this host bootstrap before
   `release` or `prepare`: it downloads only the versioned Bun runtime files in
   a closed, credential-free child and verifies their pinned SHA-256 values
   before the offline preparation boundary starts. The runner's private
   Actions-artifact transport enters only the subsequent Bun release child,
   which delegates artifact upload/download to the checked-in native Node 24
   bridge. The bridge request contains paths and public coordinates but never
   serializes `GITHUB_TOKEN`; cross-run authority is reconstructed only at the
   Node artifact sink.
   `publish` recovery skips bootstrap because it consumes an already-complete
   durable bundle.
   A fresh GitHub runner must first prime Bun's package cache with the exact
   frozen, script-disabled, no-save, hoisted install and then remove the source
   workspace's root `node_modules` before invoking `release` or `prepare`.
   The private preparation install may reuse cache bytes but must never share a
   dependency inode with the source workspace. Recovery and publish-only jobs
   do not install workspace dependencies.
3. Run the complete release-candidate gate and every public-entrypoint smoke
   matrix. A skipped execution host is removed from the support claim. Rebuild
   and byte-compare the Bun release bundle, native launcher, and native
   artifact bridge.
4. Prepare the self-release independently twice. Verify exact-commit
   materialization, every manifest/blob, agent bundle, npm tarball, archive,
   checksum, and target file format. Record whether complete bytes reproduce;
   do not describe non-reproduction as success.
5. Install the packed npm tarball in clean Bun and npm/Node consumers, using an
   exact runtime admitted by the root package engine. Validate every packaged
   relative link, the Promise API against built declarations and JavaScript,
   and the bundled CLI as a real process. Separately execute the Action's exact
   native Node launcher after installing its pinned Bun runtime, and prove
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
`mannyc2/ts-release/apps/ts-release-action@v0.3.0`. Consumers must not see that
README before the lightweight tag exists at exact result commit X. The
self-release therefore creates only that tag before npm publication. It does
not use the tag as privileged workflow code: each credentialed job performs a
native exact detached checkout of current `main` and invokes the candidate's
local Action.

The self-release gates now certify two disjoint prepared bundles: one carries
only GitHub tag/Release/assets and one carries only the npm tarball. Candidate
certification remains open until both exact references pass on clean X and the
operator sequence proves the lightweight Action coordinate is usable before
npm publication, without rebuilding or changing X. A public GitHub Release is
deliberately later than npm.

## Live-release boundary

Candidate certification performs public reads only where explicitly scoped
and performs zero public writes. Do not dispatch this workflow as part of Plan
233. A later Plan 234 live-release packet must name the exact X/Y commits,
prepared digest and artifacts, destination coordinates, credential sources by
reference, sole mutation command, mutation order, response-loss recovery
command, and STOP outcomes. A generic request to release, a green protocol
double, or the presence of credentials is not that authority.

The 2026-09-01 governance observation found `github-tag` environment ID
`20986778371`, `npm` environment ID `20985327992`, and `github-release`
environment ID `20985328229`. All three selected reviewer `mannyc2`, allowed
self-review, disabled admin bypass, admitted only the custom `main` deployment
branch, and contained no environment secrets or variables. Treat this as a
dated observation, not durable authority: re-read the applicable environment
immediately before every dispatch. It does not establish the npm
trusted-publisher package subject. Repository Release immutability was
separately observed enabled that day, while the GitHub OIDC customization used
its default subject policy; re-read both before their respective live boundary.
Neither GitHub observation establishes the npm-side trusted-publisher record.

Once the exact live authorities exist, first verify that `main` still resolves
to X. Dispatch `.github/workflows/release.yml` at `ref: main` with mode
`prepare-exact-sha`, `candidate_sha: X`, and an empty `prepared_ref`. The
read-only job prepares X twice under disjoint GitHub-only and npm-only configs
and emits their exact `prepared:gha:` references. A repository, ref, SHA, or
mode mismatch leaves checkout, installation, and the Action unreached. Y must
remain only on its evidence branch while this run executes.

Under separately approved `github-tag` authority, dispatch `create-tag` with X
and both prepared-reference inputs empty. It may create only the lightweight
`v0.3.0` ref at X, then must reread it exactly; it creates no Release. Next,
under separately approved `npm` authority and an independently verified exact
trusted-publisher subject, dispatch `publish-npm` with X and the exact npm
prepared reference. That job publishes only the adopted tarball and must
converge its public byte, latest-tag, provenance, and signature verifier before
GitHub Release authority is reached. A fresh mutation must prove provenance
from that same workflow run attempt. On response loss, a later exact
`AlreadyEquivalent` retry uses the Action report to select recovery mode and
authenticates the earlier canonical publishing run attempt named by the public
provenance. It does not require the no-op retry to own the earlier provenance.
The certificate must carry the exact Fulcio SAN and GitHub issuer plus the
ID-qualified environment subject
`repo:mannyc2@126291407/ts-release@1271545637:environment:npm`; a ref-bound or
otherwise different repository subject is a STOP outcome. Uncertain or blocked
reports remain STOP outcomes.

Only then, under separately approved `github-release` authority, dispatch
`publish-github` with X, the exact GitHub prepared reference in `prepared_ref`,
and the already-published npm reference in `npm_prepared_ref`. The job first
reverifies the public npm bytes and published-run provenance. GitHub creation
always POSTs a private draft, and upload recovery appends only provider-proven
missing intended assets while that Release remains private. When a desired
public Release was newly created or received uploads, the Action report is
expected to be `uncertain`; this is not success and no public Release exists.
After that run stops, authorize a fresh rerun or dispatch with exactly the same
X and both references. That invocation must fully reread the exact draft and
paginated asset aggregate, download and hash any missing-digest asset, and may
then issue only `PATCH {"draft":false}`. If another missing-asset staging phase
was necessary, repeat the same-reference fresh invocation; never blindly
resubmit creation or promotion. Extra, duplicate, missing, different, or
inconclusive provider state is a STOP outcome.

Every retry reuses the same lane-specific reference; never swap lanes,
substitute a local path, rebuild the candidate, or reinterpret a private draft
as a completed release.

For the reviewed two-job template, dispatch with the exact `candidate_sha`.
If publication fails after preparation, rerun the failed `publish` job in the
same workflow run so it consumes the original prepare output and artifact; do
not start a new prepare job. In both topologies, conflict or inconclusive
observation is a STOP outcome. The lightweight GitHub Action tag must converge
before npm; the public GitHub Release must not precede exact npm publication
and verification.

Only after the authorized live run and its redacted report have converged may
the operator fast-forward `main` from X to its direct child Y. That evidence
branch update is separate from publication and is not performed by the release
workflow.
