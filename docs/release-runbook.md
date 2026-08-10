# Release runbook

The default path is automatic: prepare one exact bundle, observe configured
destinations, publish safe subjects, and retain the bundle for recovery.

Before a local release:

```sh
bun install --frozen-lockfile
bun run check:portable
bun run build
bun run check:cli-bundle
bun run check:action-bundle
```

Run the CLI path:

```sh
ts-release inspect --config apps/release-ts/release.config.json
ts-release release --config apps/release-ts/release.config.json
```

For a host boundary, use `prepare`, transfer the complete directory without
rebuilding, inspect it on the destination runner, and then call `publish`.
The repository workflow and the templates in `templates/github-actions/` show
the durable artifact handoff. A host environment may gate publication; its
identity and consent remain in the host deployment record.

If publication stops, rerun `publish` with the same prepared directory. Stop
on conflict or inconclusive observation and resolve the provider state through
its typed correction path when one is supported. Do not delete or recreate a
remote coordinate as a generic recovery action.

Agent distribution is checked with `bun run check:agents`; generated output is
captured as declared preparation artifacts, not stored as source.
