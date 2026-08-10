# ts-release Action app

This private first-party app owns GitHub Action input parsing, contained file
I/O, outputs, and the bundled Node entrypoint. It imports only the public
`@mannyc1/ts-release` root.

The Action invokes one automatic `release` operation. It reads an authored
configuration, prepares the exact bundle, observes destinations, and publishes
according to the configured credentials.

```sh
bun run --cwd apps/ts-release-action check
bun run --cwd apps/ts-release-action build
bun run check:action-bundle
```

The bundle check rebuilds the Node entrypoint and verifies the manifest's
single command and two outputs. Hosts can protect the workflow environment
when review is desired.
