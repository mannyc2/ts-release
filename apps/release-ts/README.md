# release-ts CLI app

This private first-party app owns JSON file loading, command parsing, output
paths, and the installed `ts-release` executable. It imports only the public
`@mannyc1/ts-release` root.

Supported commands are exactly:

- `init`
- `doctor`
- `plan`
- `apply`

`plan` reads and parses its JSON config once, selects an absolute workspace,
and calls the value-only API. `doctor` and `apply` consume canonical plan
bytes; neither reads configuration or replans.

```sh
bun run --cwd apps/release-ts check
bun run cli plan \
  --config apps/release-ts/release.config.json \
  --out .release/release-plan.json
```

Self-release scripts under `scripts/` are read-only policy checks. They prove
that the complete self-release config plans through the public root, declares
the expected package/provider operations, and produces a review challenge.
They do not check live registries or dispatch publication.

The manual release workflow persists the exact plan artifact, applies through
`validate` with a run-bound execution receipt, persists the run ledger and
materialized outputs, then requires the observed publish challenge before
resuming through `verify`.

```sh
bun run check:self-release-config
bun run check:self-release-doctor
bun run check:self-release-artifacts
bun run check:self-release-live
```

The `release:plan` package script writes only canonical plan bytes. Actual
publication requires the separate protected workflow and both confirmations.
