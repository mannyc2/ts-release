# Release runbook

The repository releases itself through the same public npm/GitHub application
provided by the [starter](../templates/npm-github/README.md). Bun builds and packs
the seven aligned packages. Preparation retains one Bundle, Plan and content
directory. The CLI or Action loads those exact inputs and uses native providers
with a shared Git journal. There is no independent npm/gh publishing script.

## Hosted publication

Use the manual [Release workflow](../.github/workflows/release.yml) on `main`,
with `candidate_sha` equal to the exact reviewed current commit. Leave `publish`
false for preparation and acceptance only. Set it true only after approval to
sign and publish that candidate. Concurrent workflow runs are serialized.

1. **Prepare** runs portable checks, the Node Sigstore witness, and produces the
   seven exact archives. Installed acceptance uses the production application,
   native HTTPS transport, real Git journals and committed Action launcher. It
   exercises publication and recovery against local TLS peers. The job retains
   `ts-release-unsigned-candidate`.
2. **Attest** restores those archives, obtains hosted identity, signs provenance
   under Node, and creates the final Bundle/Plan without publishing packages or
   releases. It retains `ts-release-signed-candidate` before the next job starts.
3. **Publish** verifies the retained Bundle/Plan digests, installs the exact
   retained packages, and invokes the committed Action launcher with the shared
   application under the same pinned Node used by the Sigstore checks. Native
   npm providers publish the six providers before the core; GitHub finalization
   depends on the complete npm cohort and its exact release assets. A final
   read-only check waits for matching public registry and GitHub observations.

npm acceptance and public registry visibility are distinct. A successful native
acknowledgement is journaled; the verifier allows 31 observations with ten-second
pauses for cache propagation. It never repeats publication. The cohort is not an
atomic batch, and partial progress remains in the shared journal.

Configure npm trusted publishing for **each** of the seven existing package names:
owner `mannyc2`, repository `ts-release`, workflow `release.yml`, environment `npm`.
The Publish job uses the existing protected `npm` environment; its deployment
approval must complete before npm's OIDC exchange can match that binding.
The workflow uses GitHub-hosted Node 24.15.0, `id-token: write`, and the library's
native npm OIDC exchange and Sigstore adapters. It does not invoke `npm publish`.
GitHub's job token has `contents: write` for release operations and the journal
branches under `refs/heads/ts-release-journal/`. No long-lived npm secret is used.

New package names need first-publication access before npm trusted-publisher
settings can be configured. For that case, use the explicit local/token mode
below for a separately approved candidate, then configure trusted publishing
for the next version. Do not substitute authorization modes on an unfinished Plan.

## Recovery

After publication begins, normally rerun only failed **Publish** jobs in the
original workflow run. They restore the same signed candidate and fetch the same
remote journal. If workflow or diagnostic changes are needed, run the current
reviewed workflow on `main` with `publish: true`, `resume_run_id` set to the
original run, and `resume_bundle_sha256` / `resume_plan_sha256` set to the reviewed
SHA256 digests of its `bundle.json` and `plan.json` files. The latter is the file
digest, not the Plan ID. `candidate_sha` selects the current workflow commit;
the retained Bundle keeps the original release source identity. Restoration
skips preparation and attestation and verifies both digests before installation.

The Publish job checks every npm trusted-publisher credential before the first
publication. Its diagnostics identify OIDC verification and npm exchange stages,
HTTP status and response shape without printing tokens or raw response bodies.
This check reads the journal and prepares requests but does not append history
or invoke a publication transport.

Do not rerun attestation or rebuild archives to recover a dispatched
release. A candidate whose Plan differs from existing history is rejected even
if a new runner or workflow run is used: journal identity is stable per
repository and version.

For an explicitly superseded candidate that never dispatched, preserve its Plan
and Bundle, and select their signed artifact using `superseded_run_id`,
`superseded_bundle_sha256` and `superseded_plan_sha256` (the Plan file hash). The successor uses the same journal, whose
history must already record supersession. Any prior dispatch blocks this path.
Keep this input on subsequent resume runs as well. See [recovery](recovery.md).

The first 0.4.1 candidate is retained at
`.github/release-history/v0.4.1/original-plan.json`. Its credential preflight
accepted GitHub OIDC and received HTTP 201 from npm, then rejected timestamp
metadata. It must be explicitly superseded through the public `supersedePlan`
operation before publishing a corrected candidate; the recorded Plan alone
does not authorize replacement. For the corrected release, use run `35651390251`, Bundle SHA256
`2185a825efd159af8ff2dc0d957a21b3d4146147cb97c680d2f622b4f62ec951` and Plan file SHA256
`9216b5ac391ea4c3a53635617e96021040899d6646daa9f721952674bfd91f57`.

A lost response followed by a registry 404 does not permit resending. Observe the
original candidate and follow [recovery](recovery.md) for unresolved outcomes.
Matching evidence allows progress; conflicting bytes stop it. Existing releases,
tags and assets are never overwritten. Retain the complete signed candidate
outside Actions before its 90-day artifact retention expires, and preserve the
remote journal branches independently of job logs or local caches.

If every operation was acknowledged but the final visibility check timed out,
repeat only `verify.mjs` with the original input. It executes provider
observations through the public runner and cannot publish.

## Local preparation and browser authentication

Use pinned Bun and Node, commit the reviewed source and generated Action/starter,
then:

```sh
bun install --frozen-lockfile
bun run setup:native-python
bun run setup:native-catalog
bun run check:portable
bun run release:prepare .release/candidate
bun run release:check .release/candidate
bun scripts/check-distribution.ts .release/candidate
```

Preparation uses a new directory and never publishes. The candidate contains the
canonical `bundle.json`, `plan.json`, `identity.json` and `content/`; the identity
file selects the Bundle and Plan and contains no credentials.

For a new, approved local release, run `npm login`, explicitly select its user
config via `NPM_CONFIG_USERCONFIG`, provide `GH_TOKEN` through your secret manager,
and set `TS_RELEASE_JOURNAL_REMOTE=https://github.com/mannyc2/ts-release.git`.
The login format supported here is a literal npmjs-registry-scoped `_authToken`.
Then:

```sh
bun run release:input .release/candidate .release/local-input.json Local --execute
bun run release:observe .release/local-input.json
bun run release:run .release/local-input.json > .release/local-report.json
```

Observe mode never dispatches publication; exit 2 before first publication is
expected. The Local mode prints fresh npm browser challenge links on stderr and
keeps passwords only in memory. A definite authentication rejection is durably
recorded before a new attempt. A missing response cannot be treated as a rejected
write. Use `Token` plus an explicitly supplied `NPM_TOKEN` for unattended token
publication. These modes do not claim hosted provenance.

To run visibility verification with the exact retained packages:

```sh
bun scripts/install-release-runtime.ts .release/candidate .release/local-runtime
node .release/local-runtime/verify.mjs .release/local-runtime/application.js .release/local-input.json
```

Keep the same candidate and input for continuation. Changing only the local
cache is safe; replacing the Plan or journal is not recovery. The broad
multi-provider `apps/self-release/src/rehearsal.ts` remains a preparation fixture,
separate from the npm/GitHub production application.
