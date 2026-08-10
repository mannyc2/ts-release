# ts-release Action app

This private first-party app owns GitHub Action input parsing, contained file
I/O, outputs, and the bundled Node entrypoint. It imports only the public
`@mannyc1/ts-release` root.

The Action is a thin Node boundary over the public API. It exposes exactly four
commands: `prepare`, `publish`, `inspect`, and `correct`. Credentials come from
the host environment (`NPM_TOKEN`, `GITHUB_TOKEN`, or `GH_TOKEN`), never from a
second Action-only input contract.

`prepare` creates the exact durable bundle and emits `prepared_path`.
`publish` consumes only that bundle. `inspect` reads authored configuration or
an existing bundle, and `correct` consumes a canonical correction intent bound
to a bundle. Every command emits a contained JSON `report_path` and `status`.

```sh
bun run --cwd apps/ts-release-action check
bun run --cwd apps/ts-release-action build
bun run check:action-bundle
```

The bundle check rebuilds the Node entrypoint and verifies the four commands and
three outputs. Hosts can protect the publication job when a host gate is
desired; the Action does not record host policy facts.
