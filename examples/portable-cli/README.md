# Portable CLI example

This fixture plans one CLI for GitHub Release assets, npm, Homebrew, Scoop,
and PyPI wrapper wheels.

```sh
bun ../../apps/release-ts/src/cli/main.ts plan \
  --config release.config.json \
  --out release-plan.json
```

Files under `artifacts/` are tiny checked fixtures. The reviewed plan owns any
real build and materialization operations.
