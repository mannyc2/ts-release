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
bun run --cwd apps/release-ts cli stage-artifacts --root ../.. --config apps/release-ts/release.config.json
bun run --cwd apps/release-ts cli plan --root ../.. --config apps/release-ts/release.config.json --format text
```

Self-release config lives in `release.config.json`. When invoking the app-local
CLI for the root package, pass `--root ../..` and keep the config path
root-relative. App release scripts live in `scripts/` only for app-owned
self-release policy checks. Artifact staging goes through the CLI workflow. The
Bun executable artifact recipe adapter is composed here at the runtime boundary;
root workflows keep artifact recipes as data until staging is explicitly run.

The repository dogfoods the same distribution workflow recommended to users:
GitHub Actions stages artifacts, records a non-publishing plan job on main, and
executes only from a manual `workflow_dispatch` run protected by the `release`
environment with `contents: write` and `id-token: write`.

The self-release config currently publishes the npm package, uploads the
Linux/macOS/Windows CLI executables to GitHub Releases, renders a Homebrew
formula for macOS arm64/x64 assets, renders a Scoop manifest for the Windows x64
asset, and publishes platform-specific PyPI wheels named `ts-release`. Each
wheel bundles the matching staged CLI binary and exposes a `ts-release` console
script.

The protected execute job checks out `mannyc2/homebrew-ts-release` and
`mannyc2/scoop-ts-release` under `.release/catalogs/`; configure the
`TS_RELEASE_CATALOG_TOKEN` repository or environment secret with push access to
both catalog repositories before running it. The execute job renders and
validates the package-manager catalogs against the downloaded artifacts before
running the approved publication step. Configure a PyPI Trusted Publisher for
project `ts-release` using owner `mannyc2`, repository `ts-release`, workflow
`release.yml`, and environment `release`; for the first upload, create it as a
pending publisher.

Before a live release, run:

```sh
bun run release:artifacts
bun run release:catalogs
bun run check:self-release-artifacts
bun run check:self-release-live
```

The artifact check verifies the staged CLI binaries, PyPI wheel sizes and Twine
metadata, generated Homebrew formula, and generated Scoop manifest. The live
check verifies the target version is still unused on npm, GitHub Releases, and
PyPI, and that the public Homebrew tap and Scoop bucket repositories are
reachable.

After a successful live release, manually dispatch the `Install Smoke` workflow
with the published version and tag. It imports the npm package, downloads the
GitHub Release Linux binary, installs the PyPI wrapper on Linux/macOS/Windows,
trusts and installs from the Homebrew tap on macOS, installs from the Scoop
bucket on Windows, and checks each CLI install reports the requested version.
