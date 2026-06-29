# Release Templates

Templates are copyable starting points for new repositories. They use
placeholder names and may reference artifacts that you still need to build or
stage before package-manager targets can consume them.
The checked-in JSON templates are the same policy shape produced by `release
init`.

After copying a template, stage declared artifacts when the template has
`artifactRecipes`, then preview the distribution plan:

```sh
bun run cli plan --config release.config.json --format text
```

Runnable fixtures live in `examples/`; templates are for authoring your own
`release.config.json`.

The CLI can preview or write these configs:

```sh
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo
bun run cli init --template bun-cli-github --package @scope/pkg --repo owner/repo
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo --github-actions --write
bun run cli init --template npm-github --package @scope/pkg --repo owner/repo --github-actions --package-manager npm --write
```

Available config templates:

- `npm-only`: existing npm package with GitHub Actions trusted publishing.
- `npm-github`: npm plus GitHub Releases.
- `bun-cli-github`: binary-first distribution with a Bun executable artifact recipe, npm package publishing, and GitHub Release assets.
- `multi-target-homebrew`: npm, GitHub Releases, and a Homebrew tap.
- `multi-target-scoop`: npm, GitHub Releases, and a Scoop bucket.

Templates with `artifactRecipes` require an explicit staging step before target
planning expects those files to exist. The Bun CLI template derives
installable variant metadata such as operating system, architecture, Linux libc,
and Windows `.exe` extension from each compile target:

```sh
bun run cli stage-artifacts --config release.config.json
```

The npm templates enable provenance, require `packageExists: true`, and set
`verifyPackageExists: true` so planning includes a read-only `npm view` check
before trusted publishing.

GitHub Actions templates are action-first:

- `github-actions/plan-only.yml`
- `github-actions/plan-and-approved-execute.yml`
- `github-actions/trusted-publishing.yml`

They use `mannyc2/ts-release-action@v1`; the action source lives in this repo at
`apps/ts-release-action` until the first action release is cut or mirrored.
The action currently defaults to `runtime: bundled`.

Generated workflows support Bun, npm, pnpm, and yarn setup presets. Static
checked-in workflow templates use npm setup by default; setup, install, and
build commands are workflow scaffolding rather than release config policy.

The trusted-publishing templates do not use `NPM_TOKEN`; configure npm trusted
publishing and a protected GitHub environment named `release` before approving
the execute job.

After writing a workflow, run static diagnostics before executing a release:

```sh
bun run cli doctor --config release.config.json --format text
bun run cli check-ci --config release.config.json --workflow .github/workflows/release.yml --format markdown
```
