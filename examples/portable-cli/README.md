# Portable CLI Example

This fixture shows one CLI distributed through GitHub Release assets, npm,
Homebrew, Scoop, and PyPI wrapper wheels.

Preview the non-publishing plan:

```sh
bun ../../apps/release-ts/src/cli/main.ts plan --config release.config.json --format text
```

The files under `artifacts/` are tiny placeholders for repository checks. A real
project would create them with `ts-release build`.
