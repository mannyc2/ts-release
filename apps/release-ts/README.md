# release-ts App

This private first-party app owns the official CLI, Bun runtime shell, and
self-release dogfood for `@mannyc1/ts-release`.

The reusable release library remains in the repository root `src/` tree and is
consumed through package subpaths.

The app runtime composes Bun platform services, the platform command runner, and
the library live target/HTTP workflow layer at the CLI boundary. CLI modules
parse argv, format terminal output, and write requested output files; release
logic should stay in root workflow, planner, target, host, config, and domain
modules.

Useful app-local commands:

```sh
bun run --cwd apps/release-ts check
bun run --cwd apps/release-ts cli plan --config release.config.json --format text
```

Self-release config lives in `release.config.json`. App release scripts live in
`scripts/` and keep release workspace paths root-relative. Root package scripts
delegate to these app scripts for release eligibility, self-release config
checks, the static self-release CI diagnostic, and release artifact preparation.

The repository dogfoods the same safe workflow model recommended to users:
GitHub Actions checks eligibility first, runs the full release gate only when a
release is needed, records a non-publishing plan job, and executes only from a
protected `release` environment with `contents: write` and `id-token: write`.
