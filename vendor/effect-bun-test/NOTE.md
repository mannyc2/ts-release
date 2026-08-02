# Provenance

This is a vendored copy of `@effect/bun-test` from the Effect-TS/effect-smol
repository (an unmerged upstream packaging: the harness ships inside
`effect-smol` but is not published to npm), carried with local patches so the
test suite can run `describe/expect/test` on Bun without Vitest. Imported by
the repo's test files as `@effect/bun-test` via a `file:` devDependency.

- Upstream source: https://github.com/Effect-TS/effect-smol (packages/bun-test
  at the beta.83 line)
- npm probe 2026-08-01: `npm view @effect/bun-test versions` → 404 (not
  published; nothing to migrate to, and nothing squatted)
- Vendored at: commit `9d06926` ("Migrate tests to Effect Bun harness")
- Re-check date: 2026-11-01 — probe npm again; if upstream publishes a
  compatible version, swap the `file:` dependency for the published package
  in its own change.
