# Maintained checks

Use Bun for installation, builds and tests. `bun run check` builds packages,
typechecks production and test code, checks declared imports and loads each
advertised package export. `bun run test` runs behavioral tests.

`bun run check:portable` adds installed kernel, provider/catalog and Action
checks. They pack the actual packages into disposable consumer projects. Some
checks also test npm installation compatibility; Bun remains the script runner.
Use an engine-admitted Node executable on PATH or set TS_RELEASE_ACCEPTANCE_NODE.

Native acceptance scripts cover npm/Sigstore, Python, catalog consumers,
external tools and Apple. Their setup commands and required environment are
specified by each script. They use local fixtures; a passing local check is not
proof of a public upload or hosted execution. Generated records live in ignored
`.release/checks` or the printed temporary work directory.

`build:delivery` builds packages and the checked-in Node Action launcher.
Research ancestry, migration, source-budget and API-projection gates were retired;
see `docs/design-decisions.md` for the retained recovery decision.

For the full local suite, install native fixtures first:

```sh
bun run setup:native-python
bun run setup:native-catalog
bun run check:portable
```

The catalog fixture installer currently targets Linux x64. `bun run test` resolves
Node on PATH (or TS_RELEASE_ACCEPTANCE_NODE) and passes its absolute path to the
tests that run fixtures under both runtimes. Use a supported Node version. `check:installed-workflow`
exercises real Git publication through both installed entrypoints, including a
response lost at process interruption and continuation with an empty local cache.
