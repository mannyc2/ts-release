# Release-candidate runbook

This source tree is not release authority. The repository release workflow is
manually dispatchable, but its existence is not permission to run it. It has
no automatic trigger. Its unconditional `admit` job fails the workflow unless
the repository ids, manual event, `refs/heads/main`, workflow ref/SHA, run
coordinates, exact required `candidate_sha`, selected mode, and mode-specific
prepared-reference topology all agree. It emits exactly one `selected_job`;
the five authority jobs, two downstream no-authority npm retention jobs, and
the read-only npm-before-GitHub preflight depend on that output or its selected
producer, while the GitHub writer also depends on the successful preflight. An
invalid dispatch therefore cannot appear green merely because every mutation
job skipped. Do not provide
production write credentials, dispatch publication, create a tag or GitHub
release, or publish npm bytes during Plan 233 candidate certification.

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
   `release` or `prepare`: its closed, credential-free Bun child downloads the
   exact versioned `@oven` platform archives directly from
   `registry.npmjs.org`, forbids redirects, applies one 120-second deadline to
   each request and complete response body, bounds the response to its pinned
   size, verifies the published SHA-512 integrity, requires exactly three
   unlinked regular tar members, and verifies the extracted runtime's pinned
   size and SHA-256. It atomically installs a previously absent cache file
   without overwriting conflicts. Only then does the offline preparation
   boundary start. The runner's private
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
   and byte-compare the Bun release bundle, native launcher, native artifact
   bridge, private native report-retainer bundle, and private native
   report-handoff bundle. Execute the handoff bootstrap gate that proves OIDC
   request authority is absent before the dependency bundle loads.
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
separately observed enabled that day. A prior GitHub OIDC observation used the
default subject policy; it is not acceptable certification evidence. Before
the no-upload dispatch, re-read the repository OIDC policy and require the
immutable ID-qualified subject
`repo:mannyc2@126291407/ts-release@1271545637:environment:npm`. Re-read Release
immutability again before GitHub publication. Neither GitHub observation
establishes the npm-side trusted-publisher record.

Every live dispatch must show a successful mandatory `admit` job and exactly
one selected authority job. Treat an absent `selected_job`, a failed admission,
or any surprising additional runnable authority as STOP. Preparation retains
its two credential-free redacted Action reports through the pinned
`actions/upload-artifact` boundary. Tag and GitHub jobs invoke the
repository-owned native Node 24 report retainer in the producer job, including
when the producer fails. It accepts one private, regular, unlinked, bounded,
strict-JSON, redacted report with exact run/attempt/candidate/prepared bindings;
rejects GitHub, npm, and OIDC publication credentials; uploads once; and
performs one exact name/id/digest/file-set/byte reread.

The npm certification and publication producers cannot directly run that
final retainer: GitHub injects Actions OIDC request coordinates into every
JavaScript Action process in an `id-token: write` job. Their local handoff
Action therefore clears every Node/native loader, trust, proxy, Bun-preload,
and dynamic-library injection variable, then starts with a dependency-free Node
bootstrap. Before loading `@actions/core`, `@actions/artifact`, Effect, or any
generated bundle, it rejects any nonempty normalized injection alias, validates
the exact request URL/token aliases, scans and binds the private
report bytes, deletes the OIDC variables, wipes and drops secret-derived
buffers, then loads the handoff worker. The worker validates the same byte
count and SHA-256, uploads exactly one explicitly non-final handoff artifact,
and performs one exact reread without blind resubmission.

The corresponding final retention job runs after producer success or failure
and has no environment, no `id-token` permission, and no publication
credential. It requires all four fixed-size handoff outputs, verifies the exact
candidate checkout, downloads the precise name/id/digest, revalidates the
handoff receipt and report schema/bindings, and alone creates the final retained
report plus `ts-release/retained-report/v2` receipt. The receipt records the
exact upstream producer result; `failure` is durable diagnostic evidence and is
never eligible release evidence. Report bytes never cross a
job output. A missing, suppressed, partial, malformed, foreign, or changed
output fails retention. Upload response loss at either stage causes one exact
reread and never a blind resubmission. A failed or uncertain producer remains
failed even when retention succeeds.

The preparation artifacts are
`ts-release-github-prepare-report-${run_attempt}` and
`ts-release-npm-prepare-report-${run_attempt}`. The two intermediate artifacts
are `ts-release-npm-oidc-certification-handoff-${run_attempt}` and
`ts-release-npm-publish-handoff-${run_attempt}`. They contain only
`handoff.json` plus `report.json`, are explicitly non-final, and cannot serve as
release evidence. The final credentialed artifacts are
`ts-release-tag-report-${run_attempt}`,
`ts-release-npm-oidc-certification-report-${run_attempt}`,
`ts-release-npm-publish-report-${run_attempt}`,
`ts-release-npm-inspect-report-${run_attempt}`, and
`ts-release-github-publish-report-${run_attempt}`. Each credentialed artifact
contains only `report.json` plus `receipt.json`; the receipt records the
report SHA-256, run, attempt, workflow SHA, candidate, kind, and prepared
reference. For split npm retention, that receipt also binds the intermediate
artifact name, id, and canonical `sha256:<64 lowercase hex>` lookup digest.
Preserve and validate the downloaded final bytes before authorizing the next
mutation.

Once the exact live authorities exist, first verify that `main` still resolves
to X. Dispatch `.github/workflows/release.yml` at `ref: main` with mode
`prepare-exact-sha`, `candidate_sha: X`, and both reference inputs empty:

```sh
gh workflow run release.yml \
  -R mannyc2/ts-release \
  --ref main \
  -f mode=prepare-exact-sha \
  -f candidate_sha="$X" \
  -f prepared_ref= \
  -f npm_prepared_ref=
```

The read-only job prepares X twice under disjoint GitHub-only and npm-only configs
and emits their exact `prepared:gha:` references. A repository, ref, SHA, or
mode mismatch leaves checkout, installation, and the Action unreached. Y must
remain only on its evidence branch while this run executes.

Before creating the tag, lock `main` so the live OIDC `ref_protected` claim is
the exact string `true`, authenticate npm operator access, and verify that the
sole trusted-publisher record for `@mannyc1/ts-release` names GitHub repository
`mannyc2/ts-release`, workflow `release.yml`, and environment `npm`. Under a
separate approval of the `npm` environment for no-upload certification only,
dispatch `certify-npm-oidc` with X, the exact npm prepared reference in
`prepared_ref`, and an empty `npm_prepared_ref`. This mode requires no tag and
cannot call a package-upload or dist-tag mutation endpoint. It adopts the
prepared tarball without repacking, obtains and validates one GitHub OIDC token
only in memory,
and runs pinned Node 22.22.2/npm 11.11.0's exact `npm publish exact.tgz
--dry-run` command. It requires one private npm token-exchange marker, exact
tarball bytes, and byte-identical anonymous registry snapshots proving 0.3.0
and its attestations remain absent and `latest` is unchanged.

The retained `ts-release/npm-oidc-certification/v1` receipt has status
`certified-no-upload`. It binds X, the prepared reference and tarball, exact
workflow/run/actor/environment claims, the protected main ref, the immutable
ID-qualified subject, and the before/after registry snapshots. A direct
`release.yml` job must carry exact `workflow_ref`/`workflow_sha` and exact
`job_workflow_ref`/`job_workflow_sha`; both workflow references must identify
`release.yml@refs/heads/main`, and both workflow SHAs must equal X. The
receipt proves only the OIDC exchange, dry-run package calculation, exact-byte
adoption, and no registry mutation. It does not certify upload, provenance, or
publication.

Under separately approved `github-tag` authority, dispatch `create-tag` with X
and both prepared-reference inputs empty. It may create only the lightweight
`v0.3.0` ref at X, then must reread it exactly; it creates no Release. Next,
under a new, separate `npm` publication approval, dispatch `publish-npm` with X
and the same exact npm prepared reference. That job publishes only the adopted
tarball and must converge its public byte, latest-tag, provenance, and signature
verifier before GitHub Release authority is reached. A fresh mutation must
prove provenance from that same workflow run attempt. On response loss, a later
exact `AlreadyEquivalent` retry uses the Action report to select recovery mode
and authenticates the earlier canonical publishing run attempt named by the
public provenance. It does not require the no-op retry to own the earlier
provenance. The publication certificate must carry the exact Fulcio SAN and
GitHub issuer plus the ID-qualified environment subject above; a ref-bound or
otherwise different repository subject is a STOP outcome. Uncertain or blocked
reports remain STOP outcomes.

```sh
gh workflow run release.yml \
  -R mannyc2/ts-release \
  --ref main \
  -f mode=certify-npm-oidc \
  -f candidate_sha="$X" \
  -f prepared_ref="$NPM_PREPARED" \
  -f npm_prepared_ref=

gh workflow run release.yml \
  -R mannyc2/ts-release \
  --ref main \
  -f mode=create-tag \
  -f candidate_sha="$X" \
  -f prepared_ref= \
  -f npm_prepared_ref=

gh workflow run release.yml \
  -R mannyc2/ts-release \
  --ref main \
  -f mode=publish-npm \
  -f candidate_sha="$X" \
  -f prepared_ref="$NPM_PREPARED" \
  -f npm_prepared_ref=
```

The first command reaches the `npm` environment for a non-mutating OIDC
certification and must complete before tag authority. The second reaches the
`github-tag` environment immediately before the only possible tag mutation.
The third reaches the `npm` environment before the Action can request a fresh
OIDC token or execute the real `npm publish`. Do not reuse the certification
approval as publication authority, and do not approve any of these boundaries
from one generic release authorization.

For either split npm path, both the producer and its final retention job must
succeed before the result is evidence. Cancellation produces no complete
evidence and requires a new dispatch. Do not use a failed-jobs-only rerun when
the producer succeeded but final retention failed: GitHub increments
`GITHUB_RUN_ATTEMPT` while reusing upstream outputs, and exact attempt binding
must reject them. Rerun all jobs or start a fresh same-input dispatch. Preserve
the original failure and both artifacts for diagnosis; never relabel an
intermediate handoff as the final receipt.

Only then, under separately approved `github-release` authority, dispatch
`publish-github` with X, the exact GitHub prepared reference in `prepared_ref`,
and the already-published npm reference in `npm_prepared_ref`. An
environment-free `preflight-github` job with only `actions: read` and
`contents: read` first inspects the npm prepared reference, reverifies the
public npm bytes and published-run provenance, retains/rereads the exact npm
inspection receipt, and hands its artifact name, id, digest, and report digest
to the writer. Only after that job succeeds may the `github-release`
environment writer start; it validates the exact handoff shape before its sole
write-token Action. GitHub creation
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

```sh
gh workflow run release.yml \
  -R mannyc2/ts-release \
  --ref main \
  -f mode=publish-github \
  -f candidate_sha="$X" \
  -f prepared_ref="$GITHUB_PREPARED" \
  -f npm_prepared_ref="$NPM_PREPARED"
```

This command reaches the `github-release` environment before any GitHub
Release mutation. The first private-draft staging invocation is expected to
fail with an `uncertain` Action report; nevertheless its
`ts-release-github-publish-report-${run_attempt}` artifact is mandatory durable
evidence. Authorize continuation only after downloading and validating that
exact artifact, then rerun the failed job or repeat the exact same command and
references. Never reinterpret the failed staging run as publication success.

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
