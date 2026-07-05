# Dogfood Golden Fixtures

Captured for `@mannyc1/ts-release` version `0.1.0`.

These fixtures are intentionally not asserted by `bun test` because they depend
on staged dogfood artifacts and the local Bun build output. `ops.txt` is the
portable cross-machine gate; `plan.txt`, `formula.rb`, and `manifest.json`
embed staged-binary `sizeBytes` / `sha256` values that depend on the pinned Bun
version and this machine's build bytes.

Refresh with:

```sh
bun run cli build --config apps/release-ts/release.config.json
bun run cli plan --config apps/release-ts/release.config.json --format json > /tmp/dogfood-plan.json
bun run scripts/plan-operations-snapshot.ts /tmp/dogfood-plan.json > test/fixtures/golden/dogfood/ops.txt
bun run cli plan --config apps/release-ts/release.config.json --format text > test/fixtures/golden/dogfood/plan.txt
bun run scripts/plan-operation-contents.ts /tmp/dogfood-plan.json homebrew:homebrew-render-formula > test/fixtures/golden/dogfood/formula.rb
bun run scripts/plan-operation-contents.ts /tmp/dogfood-plan.json scoop:scoop-render-manifest > test/fixtures/golden/dogfood/manifest.json
```
