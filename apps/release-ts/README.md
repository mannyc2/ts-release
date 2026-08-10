# ts-release CLI

The CLI exposes exactly six commands:

- `init` creates the smallest authored configuration.
- `inspect` observes authored configuration or reads a prepared bundle.
- `prepare` stages native preparations and stores an exact bundle.
- `publish` observes and publishes one prepared bundle.
- `release` composes preparation and publication automatically.
- `correct` applies one provider-specific correction intent.

```sh
bun run cli inspect --config release.config.json
bun run cli release --config release.config.json
```

The published Node bundle is built from `src/cli/node-main.ts`; development
uses the Bun host entrypoint.
