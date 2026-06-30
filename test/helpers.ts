import { expect } from "@effect/bun-test"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as ConfigProvider from "effect/ConfigProvider"
import type * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import { CommandResult, CommandRunnerError, ReleaseCommandRunnerTestLayer } from "../src/host/host.js"
import { commandKey } from "../src/host/test.js"
import type { CommandSpec } from "../src/domain/operation.js"
import { GitHubApi, GitHubApiError } from "../src/targets/github-api.js"

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

export const TestGitHubApiLayer = Layer.succeed(GitHubApi)({
  createRelease: (request) =>
    Effect.fail(
      GitHubApiError.make({
        operation: "createRelease",
        url: request.repository,
        reason: "No test GitHub API response configured."
      })
    ),
  inspectRelease: (request) =>
    Effect.fail(
      GitHubApiError.make({
        operation: "inspectRelease",
        url: request.repository,
        reason: "No test GitHub API response configured."
      })
    )
})

export const minimalConfig = JSON.stringify({
  project: {
    name: "release",
    packageName: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  build: {
    npmPackage: {
      id: "package",
      path: ".",
      consumers: ["npm"]
    }
  },
  publish: {
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN"
    },
    github: {
      repository: "owner/repo",
      tokenEnv: "GH_TOKEN",
      draft: true
    }
  },
  strict: true,
  evidence: ".release/evidence"
})

export const noOpConfig = JSON.stringify({
  project: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  publish: {},
  strict: true,
  evidence: ".release/evidence"
})

export const partialWorkflowConfig = JSON.stringify({
  project: {
    name: "release",
    packageName: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  build: {
    npmPackage: {
      id: "package",
      path: ".",
      consumers: ["npm"]
    },
    artifacts: [
      {
        id: "archive",
        path: "artifacts/release-0.1.0.tgz",
        format: "tarball",
        consumers: ["homebrew"]
      }
    ]
  },
  publish: {
    homebrew: {
      repository: "owner/homebrew-tap",
      formulaName: "release",
      formulaPath: ".release/generated/release.rb",
      artifactId: "archive"
    },
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN"
    }
  },
  strict: true,
  evidence: ".release/evidence"
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

const compactProjectFromIdentity = (identity: Record<string, unknown>): Record<string, unknown> => {
  if (identity._tag === "PackageManifestReleaseIdentitySource") {
    return {
      ...(typeof identity.packagePath === "string" ? { packagePath: identity.packagePath } : {}),
      ...(typeof identity.commit === "string" ? { commit: identity.commit } : {}),
      ...(typeof identity.tagTemplate === "string" ? { tagTemplate: identity.tagTemplate } : {}),
      ...(typeof identity.notes === "string" ? { notes: identity.notes } : {})
    }
  }
  return {
    ...(typeof identity.name === "string" ? { name: identity.name, packageName: identity.name } : {}),
    ...(typeof identity.version === "string" ? { version: identity.version } : {}),
    ...(typeof identity.commit === "string" ? { commit: identity.commit } : {}),
    ...(typeof identity.tag === "string" ? { tag: identity.tag } : {}),
    ...(typeof identity.notes === "string" ? { notes: identity.notes } : {})
  }
}

const copyFields = (
  source: Record<string, unknown>,
  fields: ReadonlyArray<string>
): Record<string, unknown> => {
  const copied: Record<string, unknown> = {}
  for (const field of fields) {
    if (source[field] !== undefined) {
      copied[field] = source[field]
    }
  }
  return copied
}

const compactPublishFromTargets = (targets: ReadonlyArray<Record<string, unknown>>): Record<string, unknown> => {
  const publish: Record<string, unknown> = {}
  for (const target of targets) {
    if (target._tag === "NpmRegistryTarget") {
      publish.npm = copyFields(target, [
        "registry",
        "packageName",
        "packagePath",
        "tokenEnv",
        "trustedPublishing",
        "access",
        "provenance"
      ])
    }
    if (target._tag === "GitHubReleaseTarget") {
      publish.github = copyFields(target, ["repository", "tokenEnv", "draft", "prerelease"])
    }
    if (target._tag === "HomebrewTapTarget") {
      publish.homebrew = copyFields(target, [
        "repository",
        "formulaName",
        "formulaPath",
        "artifactId",
        "artifactIds",
        "homepage",
        "description",
        "url",
        "tapDirectory",
        "installPath",
        "tokenEnv"
      ])
    }
    if (target._tag === "PyPiRegistryTarget") {
      publish.pypi = copyFields(target, [
        "repositoryUrl",
        "pythonExecutable",
        "usernameEnv",
        "passwordEnv",
        "trustedPublishing"
      ])
    }
    if (target._tag === "ScoopBucketTarget") {
      publish.scoop = copyFields(target, [
        "repository",
        "manifestName",
        "manifestPath",
        "artifactId",
        "homepage",
        "description",
        "license",
        "url",
        "bin",
        "bucketDirectory",
        "tokenEnv"
      ])
    }
  }
  return publish
}

const compactBuildFromOldInputs = (
  artifacts: ReadonlyArray<Record<string, unknown>>,
  artifactRecipes: ReadonlyArray<Record<string, unknown>> | undefined
): Record<string, unknown> | undefined => {
  const build: Record<string, unknown> = {}
  if (artifacts.length > 0) {
    build.artifacts = artifacts
  }
  const pypiWheels: Array<Record<string, unknown>> = []
  for (const recipe of artifactRecipes ?? []) {
    if (recipe._tag === "BunExecutableArtifactRecipe") {
      build.bun = {
        ...copyFields(recipe, ["id", "minify"]),
        entry: recipe.entrypoint,
        outputs: recipe.outputs
      }
    }
    if (recipe._tag === "PyPiWheelArtifactRecipe") {
      pypiWheels.push(copyFields(recipe, [
        "id",
        "path",
        "wheelTag",
        "packageName",
        "moduleName",
        "consoleScript",
        "summary",
        "homepage",
        "license",
        "requiresPython",
        "binaries",
        "consumers"
      ]))
    }
  }
  if (pypiWheels.length === 1) {
    build.pypiWheel = pypiWheels[0]
  }
  if (pypiWheels.length > 1) {
    build.pypiWheel = pypiWheels
  }
  return Object.keys(build).length === 0 ? undefined : build
}

export const releaseConfig = ({
  identity = releaseIdentity(),
  artifacts,
  artifactRecipes,
  targets,
  strict = true,
  evidenceDirectory = ".release/evidence"
}: {
  readonly identity?: Record<string, unknown>
  readonly artifacts: ReadonlyArray<Record<string, unknown>>
  readonly artifactRecipes?: ReadonlyArray<Record<string, unknown>>
  readonly targets: ReadonlyArray<Record<string, unknown>>
  readonly strict?: boolean
  readonly evidenceDirectory?: string
}) =>
  JSON.stringify({
    project: compactProjectFromIdentity(identity),
    ...(compactBuildFromOldInputs(artifacts, artifactRecipes) === undefined
      ? {}
      : { build: compactBuildFromOldInputs(artifacts, artifactRecipes) }),
    publish: compactPublishFromTargets(targets),
    strict,
    evidence: evidenceDirectory
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
