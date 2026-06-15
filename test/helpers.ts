import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"

export const runEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R>
): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(layer)))

export const minimalConfig = JSON.stringify({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  artifacts: [
    {
      id: "package",
      path: ".",
      format: "directory",
      consumers: ["npm", "github"]
    }
  ],
  targets: [
    {
      _tag: "NpmRegistryTarget",
      id: "npm",
      registry: "https://registry.npmjs.org",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN",
      dryRunSupport: "native",
      mutability: "immutable",
      recovery: "publish-new-version"
    },
    {
      _tag: "GitHubReleaseTarget",
      id: "github",
      repository: "owner/repo",
      tokenEnv: "GH_TOKEN",
      draft: true,
      dryRunSupport: "native",
      mutability: "mutable-release",
      recovery: "delete-and-recreate"
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
})
