import { expect } from "@effect/bun-test"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as ConfigProvider from "effect/ConfigProvider"
import type * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import { CommandResult, CommandRunnerError, ReleaseCommandRunnerTestLayer } from "../src/host/host.js"
import { commandKey } from "../src/host/test.js"
import type { CommandSpec } from "../src/domain/operation.js"

export const runEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R>
): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(layer)))

const isTaggedError = (value: unknown): value is { readonly _tag: string } =>
  typeof value === "object" && value !== null && "_tag" in value

export const expectTaggedError = (error: unknown, tag: string): void => {
  expect(isTaggedError(error) ? error._tag : undefined).toBe(tag)
}

export const expectExitFailureTag = <A, E>(exit: Exit.Exit<A, E>, tag: string): void => {
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    expectTaggedError(Cause.squash(exit.cause), tag)
  }
}

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
      consumers: ["npm"]
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

export const noOpConfig = JSON.stringify({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  artifacts: [],
  targets: [],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

export const partialWorkflowConfig = JSON.stringify({
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
      consumers: ["npm"]
    },
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
      dryRunSupport: "simulated",
      mutability: "mutable-index",
      recovery: "manual"
    },
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
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

export const reconcileConfig = JSON.stringify({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  artifacts: [
    {
      id: "github-asset",
      path: "dist/release.tgz",
      format: "tarball",
      consumers: ["github"]
    },
    {
      id: "package",
      path: ".",
      format: "directory",
      consumers: ["npm"]
    }
  ],
  targets: [
    {
      _tag: "GitHubReleaseTarget",
      id: "github",
      repository: "owner/repo",
      tokenEnv: "GH_TOKEN",
      draft: false,
      prerelease: false,
      dryRunSupport: "simulated",
      mutability: "mutable-release",
      recovery: "delete-and-recreate"
    },
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
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

export interface CliCommandResponse {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export const makeObservableCommandRunnerLayer = (options: {
  readonly env: ReadonlyMap<string, string>
  readonly commands: ReadonlyMap<string, CliCommandResponse>
  readonly timestamps?: ReadonlyArray<string> | undefined
}) => {
  const timestamps = [...(options.timestamps ?? [
    "2026-06-17T00:00:00.000Z",
    "2026-06-17T00:00:00.001Z"
  ])]
  let timestampIndex = 0
  const nextTimestamp = (): string => {
    const value = timestamps[timestampIndex] ?? timestamps[timestamps.length - 1] ?? "2026-06-17T00:00:00.000Z"
    timestampIndex += 1
    return value
  }

  const envRecord: Record<string, string> = {}
  for (const [name, value] of options.env) {
    envRecord[name] = value
  }

  return Layer.mergeAll(
    ReleaseCommandRunnerTestLayer({
      runCommand: (command: CommandSpec) =>
        Effect.gen(function*() {
          const missing: Array<string> = []
          for (const name of command.requiredEnv) {
            if (!options.env.has(name)) {
              missing.push(name)
            }
          }
          if (missing.length > 0) {
            return yield* Effect.fail(
              CommandRunnerError.make({
                operation: "runCommand",
                reason: `Missing required environment variables: ${missing.join(", ")}`
              })
            )
          }
          const startedAt = nextTimestamp()
          const endedAt = nextTimestamp()
          const response = options.commands.get(commandKey(command)) ?? {
            exitCode: 0,
            stdout: "",
            stderr: ""
          }
          return CommandResult.make({
            command,
            exitCode: response.exitCode,
            stdout: response.stdout,
            stderr: response.stderr,
            startedAt,
            endedAt,
            durationMillis: 1
          })
        })
    }),
    ConfigProvider.layer(ConfigProvider.fromEnv({ env: envRecord }))
  )
}

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
  artifactRecipes,
  targets,
  strict = true,
  evidenceDirectory = ".release/evidence",
  releaseDecision
}: {
  readonly identity?: Record<string, unknown>
  readonly artifacts: ReadonlyArray<Record<string, unknown>>
  readonly artifactRecipes?: ReadonlyArray<Record<string, unknown>>
  readonly targets: ReadonlyArray<Record<string, unknown>>
  readonly strict?: boolean
  readonly evidenceDirectory?: string
  readonly releaseDecision?: Record<string, unknown>
}) =>
  JSON.stringify({
    identity,
    ...(releaseDecision === undefined ? {} : { releaseDecision }),
    artifacts,
    ...(artifactRecipes === undefined ? {} : { artifactRecipes }),
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
