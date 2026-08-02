# Release runbook

The ordered procedure for shipping a ts-release version. Every step marked
**OPERATOR** mutates something outside this repository — a registry, a tag, a
GitHub repo, a workflow run. No automation and no agent performs those; they
are run by a person who has read what they are about to publish.

The plugin half of distribution (marketplace states, ZIP checksums, directory
submission) stays in [skill-distribution.md](./skill-distribution.md); this
runbook links to it rather than restating it.

## 1. Preconditions

Run on a clean checkout of `main`:

```sh
bun install --frozen-lockfile
bun run check:portable
bun run check:release
```

Both must exit 0. Then confirm the version is coherent and unpublished:

```sh
bun run check:skill-plugin          # "status":"ready" and the version you are shipping
npm view @mannyc1/ts-release dist-tags --json
git tag | tail -1
```

`npm view` must NOT already list the version in `package.json`, and no tag for
it may exist. `CHANGELOG.md`'s top section must name that version; it says
`- pending` until step 8.

## 2. OPERATOR — dispatch the release workflow

```sh
gh workflow run release.yml --ref main
gh run watch
```

The workflow is three jobs. `plan` runs `check:release`, compiles the plan,
derives the execution review, and uploads the `release-plan` artifact.
`materialize` and `publish` each wait on the `release` environment.

Before approving **materialize**, download the artifact and read it:

```sh
gh run download <run-id> --name release-plan && jq . release-plan.json | less
```

Check, specifically:

- the `planId` equals the `plan_id` output of the `plan` job;
- the operation list contains what you expect and nothing else;
- every `RemotePublish` row names the registry, repository, and package you
  intend to publish to;
- every `Exec` row's argv is a command you are willing to run on a runner.

Before approving **publish**, read the materialize job's log: it names the
observed artifacts and the publish review id that the publish job will echo. An
artifact you do not recognise is a stop.

## 3. OPERATOR — confirm what landed

```sh
npm view @mannyc1/ts-release dist-tags        # names the new version
gh release view v<version>                    # assets include the plugin ZIP and checksums
```

Record the plugin ZIP's sha256 in the version table of
[skill-distribution.md](./skill-distribution.md), per that document.

## 4. OPERATOR — push the Action mirror

```sh
bun run release:action-mirror
```

It stages `.release/action-mirror/` and prints the `gh`/`git` commands it
deliberately does not run — repo create, init, commit, tag `v<version>` and the
floating `v0`, push. Run them, then confirm the reference the shipped templates
use resolves:

```sh
gh api repos/mannyc2/ts-release-action/git/ref/tags/v0
```

The mirror README is GENERATED. Never edit it in the mirror repository; the
next sync overwrites it.

## 5. OPERATOR — Marketplace listing

On the mirror repository's release page, use "Publish this Action to the GitHub
Marketplace" (requires the `branding:` block in `action.yml`, which is already
there). Record the listing URL in this repository's README when it exists.

## 6. OPERATOR — install smoke

Flip both defaults in `.github/workflows/install-smoke.yml` to the new version
(`version` and the tag input), commit, then:

```sh
gh workflow run install-smoke.yml --ref main
```

Every leg must be green: this is the only check that the published tarball
installs and runs on a machine that did not build it.

## 7. OPERATOR — plugin marketplace smoke

Follow [skill-distribution.md](./skill-distribution.md) States 1-2. Submission
to any public directory is a separate decision and is never automatic.

## After any change to the reusable workflow

`.github/workflows/ts-release-release.yml` is what consumers execute. The
structural tests pin its shape; only a dispatch proves GitHub agrees:

```sh
gh workflow run workflow-smoke.yml --ref main
```

It runs the full three-job chain against a publish-free fixture, so nothing
reaches a registry. Pass means a green run AND, in the uploaded
`workflow-smoke-materialized` artifact, the run-ledger file
(`<logicalRunId>.run-ledger.json`) carrying receipts whose `reviewer` starts
with `self:` — the `workflow-smoke` environment is unprotected, so that is the
honest marker. Do not check the `.evidence.json` sidecar: it deliberately
carries no reviewer field, so it would prove nothing.

## 8. Stamp the changelog

Replace `## <version> - pending` in `CHANGELOG.md` with the date the release
actually published, and commit:

```sh
git commit -am "Stamp <version> as released"
```
