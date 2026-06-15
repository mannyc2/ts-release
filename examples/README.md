# release examples

Each example is self-contained enough to run from its own directory.

```sh
cd examples/npm-only
bun ../../dist/cli/main.js plan --config release.config.json --format text
```

The examples are intentionally small:

- `npm-only`: npm package directory with native npm dry-run validation.
- `github-release`: GitHub release asset with simulated GitHub dry-run validation.
- `homebrew-tap`: Homebrew tap formula rendering with simulated formula validation.
- `non-strict-skips`: non-strict config that records skipped dry-run evidence.
