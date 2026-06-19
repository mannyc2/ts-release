# Release Templates

Templates are copyable starting points for new repositories. They use
placeholder names and may reference artifacts that you still need to build.
The checked-in JSON templates are the same policy shape produced by `release
init`.

After copying a template, preview the release plan first:

```sh
bun run cli plan --config release.config.json --format text
```

Runnable fixtures live in `examples/`; templates are for authoring your own
`release.config.json`.

The CLI can preview or write these configs:

```sh
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo --github-actions --write
```

Available config templates:

- `npm-only`: existing npm package with GitHub Actions trusted publishing.
- `npm-github`: npm plus GitHub Releases.
- `multi-target-homebrew`: npm, GitHub Releases, and a Homebrew tap.
- `multi-target-scoop`: npm, GitHub Releases, and a Scoop bucket.

The npm templates enable provenance, require `packageExists: true`, and set
`verifyPackageExists: true` so planning includes a read-only `npm view` check
before trusted publishing.

GitHub Actions templates are action-first:

- `github-actions/plan-only.yml`
- `github-actions/plan-and-approved-execute.yml`
- `github-actions/trusted-publishing.yml`

They use `mannyc2/ts-release-action@v1`; the action source lives in this repo at
`apps/ts-release-action` until the first action release is cut or mirrored.
The action currently defaults to `runtime: bundled`. Use the CLI fallback
template at `github-actions-cli/trusted-publishing.yml` for portable raw-command
workflows.

The trusted-publishing templates do not use `NPM_TOKEN`; configure npm trusted
publishing and a protected GitHub environment named `release` before approving
the execute job.

After writing a workflow, run static diagnostics before executing a release:

```sh
bun run cli doctor --config release.config.json --format text
bun run cli check-ci --config release.config.json --workflow .github/workflows/release.yml --format markdown
```
