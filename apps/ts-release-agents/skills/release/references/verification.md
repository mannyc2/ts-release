# Verification

Inside the ts-release repository run:

```sh
bun run check
bun test
bun run check:portable
bun run check:agents
```

For a prepared boundary, inspect the bundle and verify that publication uses
the exact directory returned by `prepare`. Do not claim a provider write unless
the destination observation proves it.
