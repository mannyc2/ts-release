# release examples

Start with the coordinated release example:

```sh
cd examples/multi-target
bun ../../dist/cli/main.js plan --config release.config.json --format text
```

That plan shows one release split across the target classes this package models:
a release host (`github`), package registries (`npm`, `pypi`), and installer
catalogs (`homebrew`, `scoop`). Inspect the artifact inventory, target
capabilities, `argv` lines, approval gates, and generated catalog-file
operations. `plan` is safe: publish operations stay data until a caller passes
explicit execution approval.

Focused examples:

- `multi-target`: one release coordinated across GitHub Releases, npm, and Homebrew.
- `npm-only`: npm package directory with native npm dry-run validation.
- `github-release`: GitHub release asset with simulated GitHub dry-run validation.
- `homebrew-tap`: Homebrew tap formula rendering with simulated formula validation.
- `pypi-registry`: prebuilt Python distribution planned for TestPyPI with Twine.
- `scoop-bucket`: Scoop bucket manifest rendering with simulated validation.
- `non-strict-skips`: non-strict config that records skipped dry-run evidence.

TestPyPI is still a real registry publish target, not a dry-run. The example
only renders the plan; do not run publish operations without intentional
credentials and approval flags.
