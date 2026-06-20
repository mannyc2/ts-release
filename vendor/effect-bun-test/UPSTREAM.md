# Vendored `@effect/bun-test`

- Source PR: https://github.com/Effect-TS/effect-smol/pull/2204
- Source commit: `99b37e29ea331ecc93e1a99c1ebd86f237653334`
- Source package path: `packages/bun-test`
- Removal condition: replace this vendored package with published `@effect/bun-test` once a version compatible with this repo's Effect beta is available.

This directory is a temporary test-only dependency. Local changes should stay limited to compatibility required for this repository to consume it as a Bun `file:` dependency.

Local compatibility patch:

- `package.json` uses version `0.0.0-pr.2204.99b37e2`, removes upstream pnpm workspace scripts/dev dependencies, and peers on `effect@4.0.0-beta.83`.
- Internal source import specifiers use `.js` instead of upstream `.ts` so this repo's NodeNext TypeScript check can consume the source-exported package without enabling `allowImportingTsExtensions`.
