# Release runbook

The normal release path is one protected workflow job invoking the Action with
the repository configuration. The engine observes source, prepares an exact
bundle, observes destinations, and publishes.

Before a release:

```sh
bun install --frozen-lockfile
bun run check:release
bun run build
bun run check:cli-bundle
bun run check:action-bundle
```

Review is supplied by the host environment when required. It is not encoded in
the prepared bundle and is not an engine input.

For a local byte boundary, run:

```sh
bun run cli prepare --config release.config.json
bun run cli inspect --prepared .release/ts-release/prepared/<manifest-digest>
bun run cli publish .release/ts-release/prepared/<manifest-digest>
```

If a provider needs correction, create a canonical correction intent bound to
the prepared digest and use `correct` with the same bundle.
