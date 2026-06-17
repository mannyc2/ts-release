# Scripts

Scripts in this directory are maintained release tooling, not a scratchpad.

## Durable Gates

- `clean-dist.ts` removes the build output through Effect Platform path and filesystem services.
- `check-effect-imports.ts` rejects broad root `effect` imports.
- `check-tree-shaking.ts` checks public export graphs against the shared public API policy.
- `check-package-exports.ts` validates package exports, declarations, side effects, and consumer type resolution.
- `check-examples.ts` verifies every example can produce a text release plan.
- `check-readme.ts` validates README fenced snippets and package import subpaths.
- `check-self-release-config.ts` verifies the repository's own release config is publish-ready.
- `build-release-artifacts.ts` prepares ignored `.release/artifacts` inputs for `ts-release`, including the npm tarball and standalone CLI executables.

## Internal Helpers

- `lib/public-api-policy.ts` contains the public API and tree-shaking policy shared by export checks.
- `lib/scratch-workspace.ts` contains guarded scratch directory helpers.

## Temporary Work

Temporary scripts should not be committed here unless they have:

- a package command or documented owner,
- a deletion condition,
- and either focused tests or a clear reason they are intentionally manual.
