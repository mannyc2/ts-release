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
      packageName: "release",
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
      dryRunSupport: "simulated",
      mutability: "mutable-release",
      recovery: "delete-and-recreate"
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

export const releaseIdentity = (overrides: Record<string, unknown> = {}) => ({
  name: "release",
  version: "0.1.0",
  commit: "abc123",
  tag: "v0.1.0",
  ...overrides
})

export const releaseConfig = ({
  identity = releaseIdentity(),
  artifacts,
  targets,
  strict = true,
  evidenceDirectory = ".release/evidence"
}: {
  readonly identity?: Record<string, unknown>
  readonly artifacts: ReadonlyArray<Record<string, unknown>>
  readonly targets: ReadonlyArray<Record<string, unknown>>
  readonly strict?: boolean
  readonly evidenceDirectory?: string
}) =>
  JSON.stringify({
    identity,
    artifacts,
    targets,
    strict,
    evidenceDirectory
  })

export const homebrewConfig = (overrides: Record<string, unknown> = {}) =>
  releaseConfig({
    artifacts: [
      {
        id: "archive",
        path: "artifacts/release-0.1.0.tgz",
        format: "tarball",
        consumers: ["homebrew"]
      }
    ],
    targets: [
      {
        _tag: "HomebrewTapTarget",
        id: "homebrew",
        repository: "owner/homebrew-tap",
        formulaName: "release",
        formulaPath: ".release/generated/release.rb",
        artifactId: "archive",
        homepage: "https://github.com/owner/release",
        url: "https://github.com/owner/release/releases/download/v0.1.0/release-0.1.0.tgz",
        installPath: "bin/release",
        dryRunSupport: "simulated",
        mutability: "mutable-index",
        recovery: "manual",
        ...overrides
      }
    ]
  })

export const pypiConfig = (overrides: Record<string, unknown> = {}) =>
  releaseConfig({
    artifacts: [
      {
        id: "wheel",
        path: "dist/release-0.1.0-py3-none-any.whl",
        format: "file",
        consumers: ["pypi"]
      }
    ],
    targets: [
      {
        _tag: "PyPiRegistryTarget",
        id: "pypi",
        repositoryUrl: "https://test.pypi.org/legacy/",
        usernameEnv: "TWINE_USERNAME",
        passwordEnv: "TWINE_PASSWORD",
        dryRunSupport: "native",
        mutability: "immutable",
        recovery: "publish-new-version",
        ...overrides
      }
    ]
  })

export const scoopConfig = (overrides: Record<string, unknown> = {}) =>
  releaseConfig({
    artifacts: [
      {
        id: "archive",
        path: "artifacts/release-0.1.0.zip",
        format: "zip",
        consumers: ["scoop"]
      }
    ],
    targets: [
      {
        _tag: "ScoopBucketTarget",
        id: "scoop",
        repository: "owner/scoop-bucket",
        manifestName: "release",
        manifestPath: ".release/generated/release.json",
        artifactId: "archive",
        homepage: "https://github.com/owner/release",
        description: "Example Scoop release",
        license: "MIT",
        url: "https://github.com/owner/release/releases/download/v0.1.0/release-0.1.0.zip",
        bin: "release.exe",
        dryRunSupport: "simulated",
        mutability: "mutable-index",
        recovery: "manual",
        ...overrides
      }
    ]
  })
