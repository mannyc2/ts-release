---
name: release
description: Operate ts-release through its automatic inspect, prepare, publish, release, and correction APIs.
---

# ts-release release skill

Use the installed package and repository evidence as the authority. Read the
workspace package manifest and release configuration before suggesting edits.

## Lifecycle

- `inspect` reports authored configuration or an existing prepared bundle.
- `prepare` observes a clean source tree, runs only declared native
  preparations, and stores exact `prepared-release/v1` bytes plus blobs.
- `publish` accepts only that prepared bundle and observes each destination
  before and after provider mutation.
- `release` is the normal automatic path: it composes preparation and
  publication in one process.
- `correct` consumes a prepared bundle and one canonical provider-specific
  correction intent.

The derived graph is ephemeral. Exact prepared bytes are the cross-process
boundary. Never invent a second authority format, generic rollback, provider
hook, or host review protocol.

## Safety

Read the local schema before writing configuration. Keep paths relative and
contained. Credentials are environment names or Action inputs, never secret
values. Treat conflicts and inconclusive destination observations as blocked;
do not retry an unknown remote mutation blindly. Report typed errors and the
exact prepared bundle path.

## CLI

```sh
ts-release inspect --config release.config.json
ts-release prepare --config release.config.json
ts-release publish .release/ts-release/prepared/<manifest-digest>
ts-release release --config release.config.json
ts-release correct <prepared-bundle> <correction-intent.json>
```

Read `references/configuration.md`, `references/recovery.md`, and
`references/verification.md` when the task needs those details. A release
host may add review or environment protection outside the engine; do not place
that policy into configuration or prepared bytes.
