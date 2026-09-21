# Release runbook

## Publish this repository's seven npm packages

The manual [Release workflow](../.github/workflows/release.yml) prepares one
version-aligned cohort and a digest manifest from an exact commit on `main`.
It runs the portable suite, installs the actual retained archives in a clean
consumer, and exercises the committed Action on a hosted Node 24 runner.
The final GitHub release notes contain a full commit pin for that Action.

Dispatch `release.yml` from `main` with `candidate_sha` equal to the current tip.
Leave `publish` false to prepare and inspect the `ts-release-distribution` artifact
without external publication. Set `publish` true only when publication of that
exact candidate is approved. Concurrent release attempts are serialized.

The two publication jobs download the retained tarballs and verify their manifest
digest. They do not rebuild them. npm providers publish first and the core last;
every version's registry integrity must match its retained archive. Only after all
seven versions and `latest` tags are verified does the GitHub release become
public. It includes all seven archives, `release.json`, migration notes and the
immutable Action coordinate. npm's individual uploads are not an atomic batch.

### First publication and authentication

Configure npm trusted publishing for **each** package listed in
[the migration guide](migration-0.4.md): GitHub owner `mannyc2`, repository
`ts-release`, workflow filename `release.yml`, no environment name, with direct
`npm publish` allowed. The workflow uses GitHub-hosted runners, Node 24.15.0 and
the pinned native npm 11.11.0 publisher for provenance. All package manifests carry
the matching repository URL.

New package names need initial publication before their npm settings can be
configured. For that bootstrap, supply a temporary publish-capable Actions secret
`NPM_TOKEN` authorized for the new names. The workflow exposes it only to the npm
publication step and writes a temporary npm config containing an environment
variable reference. After first publication, configure each trusted publisher,
remove the bootstrap secret and revoke its token. Never put a token in source or
the distribution artifact. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

### Recovery and local preparation

After npm accepts an upload, verification allows 31 registry observations with
ten-second pauses for the version and `latest` tag to become visible. These are
read-only checks; the upload is not repeated. Conflicting bytes stop immediately.
If visibility is still unconfirmed, retain the archives and inspect the registry
before resuming.

If publication fails, preserve the successful prepare job and rerun failed jobs
in the **same workflow run**. This downloads the same artifact. Existing versions
are skipped only when their integrity matches. A differing version, missing
verification or unexpected tag stops the workflow. No existing package version,
release tag or asset is overwritten. If someone deliberately moved a `latest`
tag, review that change and correct it explicitly before continuing.

If registry publication succeeded but GitHub publication failed, rerun only the
GitHub job. A draft with exact existing assets can be completed. Partial package
availability is reported as a failure until the complete cohort is verified.
Artifacts are retained for 90 days; download and retain them outside Actions if
recovery may take longer. Do not start a new build to recover an unfinished set.

For local inspection, use Bun 1.3.14 and an admitted Node runtime, commit the
reviewed source (including the built Action), then:

```sh
bun install --frozen-lockfile
bun run setup:native-python
bun run setup:native-catalog
bun run check:portable
bun run release:prepare .release/distribution
bun run release:check .release/distribution
bun scripts/check-distribution.ts .release/distribution
```

The distribution directory must be new. `release:prepare` never publishes.
`release:publish` and `release:github` additionally require an explicit
`--execute`; use the hosted workflow for the supported OIDC/provenance path.
Local authentication alone does not provide GitHub Actions provenance.

For an explicitly approved first publication using an interactive local npm login,
download the workflow's validated `ts-release-distribution` artifact, check out
its exact source commit and use the same Node and npm 11.11.0 publisher. Run
`bun scripts/release.ts publish-local <retained-directory> --execute`, followed by
`bun run release:github <retained-directory> --execute`. This bootstrap path
explicitly disables provenance; it does not claim a hosted OIDC attestation.
An npm login/2FA prompt may still require the maintainer. Configure trusted
publishing for the new package names after bootstrap.

## Run an application you author

1. Run `bun install --frozen-lockfile`, `bun run check:portable` and the relevant
   native producer checks. Retain the exact tested source commit and packed files.
2. Prepare and retain the Bundle, content, Plan and application input. Confirm the
   intended destinations and the application's explicit authorization policy.
3. Run `bun run ts-release --observe ./release.mjs ./release-input.json` to inspect current
   evidence. Observation records journal evidence without publication dispatch.
4. Once execution is approved, run `bun run ts-release ./release.mjs ./release-input.json`.
   Retain its JSON report. Follow [recovery](recovery.md) for incomplete progress.

The repository's self-release application is a preparation/validation rehearsal
with dispatch disabled. Public registry publication, actual GitHub releases,
portal submission and hosted Apple service acceptance are separate operational
acceptance. Local fixtures do not establish those outcomes.
