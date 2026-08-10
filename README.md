# ts-release

`ts-release` is a TypeScript release engine for clean, reproducible artifact
preparation and provider publication. Automatic release is the default; a host
may add its own review policy without sending review state through the engine.

## Install

```sh
bun add -d @mannyc1/ts-release
```

The package exposes Node and Bun host layers. Its published command bundle runs
under Node 20 or newer.

## Lifecycle

The root API has five operations and one constructor:

```ts
import { makeReleaseApi } from "@mannyc1/ts-release"
import { NodeReleaseLayer } from "@mannyc1/ts-release/node"

const api = makeReleaseApi(NodeReleaseLayer)
const result = await api.release({
  config: { project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" } },
  workspace: process.cwd()
})
await api.dispose()
```

The operations are:

- `inspect` observes a workspace configuration or reads a prepared bundle.
- `prepare` observes source, executes declared native preparations, and stores
  an exact `prepared-release/v1` bundle.
- `publish` accepts only that prepared bundle and observes destinations before
  provider mutations.
- `release` composes `prepare` and `publish` automatically.
- `correct` consumes a prepared bundle and one canonical provider-specific
  correction intent.

The derived release graph is ephemeral and recomputable. The prepared bundle's
canonical manifest and content-addressed blobs are the durable cross-process
boundary.

## CLI

```sh
ts-release init
ts-release inspect --config release.config.json
ts-release prepare --config release.config.json
ts-release publish .release/ts-release/prepared/<manifest-digest>
ts-release release --config release.config.json
ts-release correct <prepared-bundle> <correction-intent.json>
```

`release` is the normal one-command path. `prepare` and `publish` are useful
when a host intentionally transfers exact prepared bytes between processes.

## Configuration

The authored configuration schema is committed at
`schema/release-config.schema.json`. Examples and templates live under
`examples/` and `templates/`. The resolver accepts authored values plus
observed source facts and refuses disagreements.

## Development

```sh
bun install
bun run check
bun test
bun run check:portable
```

Architecture notes are in [ARCHITECTURE.md](ARCHITECTURE.md). The release
program's durable implementation record is under `docs/release-program/`.
