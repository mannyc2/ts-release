import { expect } from "@effect/bun-test"
import { mkdtempSync, rmSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import type * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { runOperations, type OperationRunContext } from "../src/run/executor.js"
import type { CommandSpec, Operation } from "../src/grammar/operation.js"
import type { ExecutionApproval } from "../src/grammar/approval.js"
import { GitHubApi } from "../src/github/github.js"
import { ApiError } from "../src/host/http.js"
import {
  ArtifactStager,
  type ArtifactStageContext,
  type StageOperation
} from "../src/pack/stager.js"
import { ReleaseIdentity } from "../src/grammar/state.js"
import {
  commandKey,
  makeCommandRunnerLayer,
  ReleaseCommandRunnerTestLayer,
  type TestCommandResponse
} from "./host-fakes.js"

export {
  commandKey,
  httpRequestKey,
  makeTestCommandRunnerLayer,
  makeTestReleaseHttpLayer,
  ReleaseCommandRunnerTestLayer
} from "./host-fakes.js"
export type {
  TestCommandResponse,
  TestCommandRunnerOptions,
  TestHttpResponse,
  TestReleaseHttpOptions
} from "./host-fakes.js"

export const stageArtifactOperations = (
  operations: ReadonlyArray<StageOperation>, context: ArtifactStageContext
) => Effect.forEach(operations, (operation) => Effect.flatMap(ArtifactStager, (stager) => stager.stage(operation, context)))

export const runOperation = Effect.fn("test.runOperation")(function*(
  operation: Operation, approval: ExecutionApproval, context: OperationRunContext
) {
  const bundle = yield* runOperations([operation], approval, context)
  return bundle.records[0]!
})

export const makePipelineIdentity = (
  overrides: Partial<ConstructorParameters<typeof ReleaseIdentity>[0]> = {}
): ReleaseIdentity =>
  ReleaseIdentity.make({
    name: "release",
    normalizedName: "release",
    version: "0.1.0",
    commit: "abc123",
    shortCommit: "abc123",
    tag: "v0.1.0",
    versionSource: "config",
    snapshot: false,
    ...overrides
  })

export const makeTempDirectory = (prefix: string): Promise<string> => mkdtemp(join(tmpdir(), prefix))

export const makeTempDirectorySync = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix))

export const writeJsonFile = (path: string, value: unknown): Promise<void> =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`)

export const runBunProcess = async (
  args: ReadonlyArray<string>,
  options: {
    readonly cwd: string
    readonly env?: Readonly<Record<string, string | undefined>>
  }
) => {
  const subprocess = Bun.spawn([...args], {
    cwd: options.cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    ...(options.env === undefined ? {} : { env: options.env })
  })
  const read = (stream: ReadableStream<Uint8Array> | null) =>
    stream === null ? Promise.resolve("") : new Response(stream).text()
  const [stdout, stderr, exitCode] = await Promise.all([
    read(subprocess.stdout), read(subprocess.stderr), subprocess.exited
  ])
  return { exitCode, stdout, stderr }
}

export const withTempDirectory = <A, E, R>(
  prefix: string,
  use: (root: string) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | Scope.Scope> =>
  Effect.acquireRelease(
    Effect.promise(() => mkdtemp(join(tmpdir(), prefix))),
    (root) => Effect.promise(() => rm(root, { recursive: true, force: true })).pipe(Effect.orDie)
  ).pipe(Effect.flatMap(use))

export const withTempDirectoryPromise = async <A>(
  prefix: string,
  use: (root: string) => Promise<A>
): Promise<A> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await use(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

export const withTempDirectorySync = <A>(prefix: string, use: (root: string) => A): A => {
  const root = mkdtempSync(join(tmpdir(), prefix))
  try {
    return use(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

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
      ApiError.make({
        operation: "createRelease",
        url: request.repository,
        reason: "No test GitHub API response configured."
      })
    ),
  inspectRelease: (request) =>
    Effect.fail(
      ApiError.make({
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
  npmPackage: {
    path: "."
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
  npmPackage: {
    path: "."
  },
  artifacts: [
    {
      id: "archive",
      path: "artifacts/release-0.1.0.tgz",
      format: "tarball"
    }
  ],
  publish: {
    homebrew: {
      repository: "owner/homebrew-tap",
      formulaName: "release",
      formulaPath: ".release/generated/release.rb",
      artifactIds: ["archive"]
    },
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN"
    }
  },
  evidence: ".release/evidence"
})

type CliCommandResponse = TestCommandResponse

export const makeObservableCommandRunnerLayer = (options: {
  readonly env: ReadonlyMap<string, string>
  readonly commands: ReadonlyMap<string, CliCommandResponse>
  readonly timestamps?: ReadonlyArray<string> | undefined
}) => makeCommandRunnerLayer({
  env: options.env,
  commands: options.commands,
  timestamps: options.timestamps ?? ["2026-06-17T00:00:00.000Z", "2026-06-17T00:00:00.001Z"],
  durationMillis: 1
})

export const releaseIdentity = (overrides: Record<string, unknown> = {}) => ({
  name: "release",
  version: "0.1.0",
  commit: "abc123",
  tag: "v0.1.0",
  ...overrides
})

const compactProjectFromIdentity = (identity: Record<string, unknown>): Record<string, unknown> => {
  return {
    ...(typeof identity.name === "string" ? { name: identity.name, packageName: identity.name } : {}),
    ...(typeof identity.packageName === "string" ? { packageName: identity.packageName } : {}),
    ...(typeof identity.version === "string" ? { version: identity.version } : {}),
    ...(typeof identity.packagePath === "string" ? { packagePath: identity.packagePath } : {}),
    ...(typeof identity.commit === "string" ? { commit: identity.commit } : {}),
    ...(typeof identity.tag === "string" ? { tag: identity.tag } : {}),
    ...(typeof identity.tagTemplate === "string" ? { tagTemplate: identity.tagTemplate } : {}),
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

const isRecordArray = (
  value: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>
): value is ReadonlyArray<Record<string, unknown>> =>
  Array.isArray(value)

export const releaseConfig = ({
  identity = releaseIdentity(),
  versionFrom,
  artifacts,
  builds,
  npmPackage,
  pypiWheel,
  archives,
  checksum,
  publish = {},
  evidenceDirectory = ".release/evidence"
}: {
  readonly identity?: Record<string, unknown>
  readonly versionFrom?: string | undefined
  readonly artifacts: ReadonlyArray<Record<string, unknown>>
  readonly builds?: ReadonlyArray<Record<string, unknown>>
  readonly npmPackage?: boolean | Record<string, unknown>
  readonly pypiWheel?: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>
  readonly archives?: ReadonlyArray<Record<string, unknown>>
  readonly checksum?: Record<string, unknown>
  readonly publish?: Record<string, unknown>
  readonly evidenceDirectory?: string
}) =>
  JSON.stringify({
    project: compactProjectFromIdentity(identity),
    ...(versionFrom === undefined ? {} : { versionFrom }),
    ...(npmPackage === undefined ? {} : {
      npmPackage: typeof npmPackage === "object"
        ? copyFields(npmPackage, ["path"])
        : npmPackage
    }),
    ...(builds === undefined || builds.length === 0 ? {} : { builds }),
    ...(pypiWheel === undefined ? {} : {
      pypiWheel: isRecordArray(pypiWheel)
        ? pypiWheel
        : pypiWheel
    }),
    ...(artifacts.length === 0 ? {} : {
      artifacts
    }),
    ...(archives === undefined ? {} : { archives }),
    ...(checksum === undefined ? {} : { checksum }),
    publish,
    evidence: evidenceDirectory
  })

export const homebrewConfig = (overrides: Record<string, unknown> = {}) =>
  releaseConfig({
    artifacts: [
      {
        id: "archive",
        path: "artifacts/release-0.1.0.tgz",
        format: "tarball"
      }
    ],
    publish: {
      homebrew: {
        repository: "owner/homebrew-tap",
        formulaName: "release",
        formulaPath: ".release/generated/release.rb",
        artifactIds: ["archive"],
        homepage: "https://github.com/owner/release",
        url: "https://github.com/owner/release/releases/download/v0.1.0/release-0.1.0.tgz",
        installPath: "bin/release",
        ...overrides
      }
    }
  })

export const pypiConfig = (overrides: Record<string, unknown> = {}) =>
  releaseConfig({
    artifacts: [
      {
        id: "wheel",
        path: "dist/release-0.1.0-py3-none-any.whl",
        format: "file"
      }
    ],
    publish: {
      pypi: {
        repositoryUrl: "https://test.pypi.org/legacy/",
        artifactIds: ["wheel"],
        ...overrides
      }
    }
  })

export const scoopConfig = (overrides: Record<string, unknown> = {}) =>
  releaseConfig({
    artifacts: [
      {
        id: "archive",
        path: "artifacts/release-0.1.0.zip",
        format: "zip"
      }
    ],
    publish: {
      scoop: {
        repository: "owner/scoop-bucket",
        manifestName: "release",
        manifestPath: ".release/generated/release.json",
        artifactId: "archive",
        homepage: "https://github.com/owner/release",
        description: "Example Scoop release",
        license: "MIT",
        url: "https://github.com/owner/release/releases/download/v0.1.0/release-0.1.0.zip",
        bin: "release.exe",
        ...overrides
      }
    }
  })
