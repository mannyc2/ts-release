import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { pathToFileURL } from "node:url"

export class UnsafeReleaseArtifactsPathError extends Schema.TaggedErrorClass<UnsafeReleaseArtifactsPathError>()(
  "UnsafeReleaseArtifactsPathError",
  {
    path: Schema.String,
    reason: Schema.String
  }
) {}

export class ReleaseArtifactsBuildError extends Schema.TaggedErrorClass<ReleaseArtifactsBuildError>()(
  "ReleaseArtifactsBuildError",
  {
    operation: Schema.String,
    path: Schema.optionalKey(Schema.String),
    reason: Schema.String,
    cause: Schema.optionalKey(Schema.Defect())
  }
) {}

export interface ReleasePackageIdentity {
  readonly name: string
  readonly version: string
}

export interface ReleaseCliArtifactTarget {
  readonly id: string
  readonly bunTarget: Bun.Build.CompileTarget
  readonly outfile: string
}

export interface BuiltReleaseArtifacts {
  readonly tarball: string
  readonly cliArtifacts: ReadonlyArray<ReleaseCliArtifactTarget>
}

const artifactsDirectory = ".release/artifacts"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const commandOutput = (stream: Stream.Stream<Uint8Array, unknown>) =>
  Stream.mkString(Stream.decodeText(stream))

export const normalizedArtifactPackageName = (name: string): string => {
  const withoutScopePrefix = name.startsWith("@") ? name.slice(1) : name
  return withoutScopePrefix.replaceAll("/", "-")
}

export const packageArtifactPrefix = (identity: ReleasePackageIdentity): string =>
  `${normalizedArtifactPackageName(identity.name)}-${identity.version}`

export const packageTarballArtifactPath = (identity: ReleasePackageIdentity): string =>
  `${artifactsDirectory}/${packageArtifactPrefix(identity)}.tgz`

export const releaseCliArtifactTargets = (version: string): ReadonlyArray<ReleaseCliArtifactTarget> => [
  {
    id: "cli-linux-x64",
    bunTarget: "bun-linux-x64-baseline",
    outfile: `${artifactsDirectory}/ts-release-${version}-linux-x64`
  },
  {
    id: "cli-linux-arm64",
    bunTarget: "bun-linux-arm64",
    outfile: `${artifactsDirectory}/ts-release-${version}-linux-arm64`
  },
  {
    id: "cli-darwin-x64",
    bunTarget: "bun-darwin-x64",
    outfile: `${artifactsDirectory}/ts-release-${version}-darwin-x64`
  },
  {
    id: "cli-darwin-arm64",
    bunTarget: "bun-darwin-arm64",
    outfile: `${artifactsDirectory}/ts-release-${version}-darwin-arm64`
  },
  {
    id: "cli-windows-x64",
    bunTarget: "bun-windows-x64-baseline",
    outfile: `${artifactsDirectory}/ts-release-${version}-windows-x64.exe`
  }
]

export const expectedReleaseArtifactPaths = (identity: ReleasePackageIdentity): ReadonlyArray<string> => [
  packageTarballArtifactPath(identity),
  ...releaseCliArtifactTargets(identity.version).map((target) => target.outfile)
]

export const assertSafeReleaseArtifactsDirectory = Effect.fn("scripts.assertSafeReleaseArtifactsDirectory")(function*(
  root: string,
  directory: string = artifactsDirectory
) {
  const path = yield* Path.Path
  const resolvedRoot = path.resolve(root)
  const expectedDirectory = path.resolve(resolvedRoot, artifactsDirectory)
  const resolvedDirectory = path.resolve(resolvedRoot, directory)

  if (
    resolvedDirectory !== expectedDirectory ||
    path.dirname(resolvedDirectory) !== path.resolve(resolvedRoot, ".release") ||
    path.basename(resolvedDirectory) !== "artifacts"
  ) {
    return yield* Effect.fail(
      UnsafeReleaseArtifactsPathError.make({
        path: resolvedDirectory,
        reason: "Refusing to remove or prepare anything except .release/artifacts under the repository root."
      })
    )
  }

  return resolvedDirectory
})

const readPackageIdentity = Effect.fn("scripts.readPackageIdentity")(function*(root: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packagePath = path.resolve(root, "package.json")
  const contents = yield* fs.readFileString(packagePath).pipe(
    Effect.mapError((cause) =>
      ReleaseArtifactsBuildError.make({
        operation: "readPackageJson",
        path: packagePath,
        reason: "Unable to read package.json.",
        cause
      })
    )
  )
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) =>
      ReleaseArtifactsBuildError.make({
        operation: "readPackageJson",
        path: packagePath,
        reason: "package.json is not valid JSON.",
        cause
      })
  })
  if (!isRecord(parsed) || typeof parsed.name !== "string" || parsed.name.length === 0) {
    return yield* Effect.fail(
      ReleaseArtifactsBuildError.make({
        operation: "readPackageJson",
        path: packagePath,
        reason: "package.json name must be a non-empty string."
      })
    )
  }
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    return yield* Effect.fail(
      ReleaseArtifactsBuildError.make({
        operation: "readPackageJson",
        path: packagePath,
        reason: "package.json version must be a non-empty string."
      })
    )
  }
  return {
    name: parsed.name,
    version: parsed.version
  }
})

const prepareReleaseArtifactsDirectory = Effect.fn("scripts.prepareReleaseArtifactsDirectory")(function*(root: string) {
  const fs = yield* FileSystem.FileSystem
  const directory = yield* assertSafeReleaseArtifactsDirectory(root)
  yield* Effect.gen(function*() {
    yield* fs.remove(directory, { recursive: true, force: true })
    yield* fs.makeDirectory(directory, { recursive: true })
  }).pipe(
    Effect.mapError((cause) =>
      ReleaseArtifactsBuildError.make({
        operation: "prepareArtifactsDirectory",
        path: directory,
        reason: "Unable to prepare .release/artifacts.",
        cause
      })
    )
  )
  return directory
})

const runChildProcess = Effect.fn("scripts.runChildProcess")(function*(
  command: ChildProcess.Command
) {
  const spawner = yield* ChildProcessSpawner
  const output = yield* Effect.scoped(
    Effect.gen(function*() {
      const handle = yield* spawner.spawn(command)
      return yield* Effect.all({
        stdout: commandOutput(handle.stdout),
        stderr: commandOutput(handle.stderr),
        exitCode: handle.exitCode
      }, { concurrency: "unbounded" })
    })
  )
  return {
    exitCode: Number(output.exitCode),
    stdout: output.stdout,
    stderr: output.stderr
  }
})

const runBunPack = Effect.fn("scripts.runBunPack")(function*(
  root: string,
  identity: ReleasePackageIdentity
) {
  const filename = packageTarballArtifactPath(identity)
  const result = yield* runChildProcess(
    ChildProcess.make(
      "bun",
      [
        "pm",
        "pack",
        "--filename",
        filename,
        "--quiet",
        "--ignore-scripts"
      ],
      {
        cwd: root,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe"
      }
    )
  ).pipe(
    Effect.mapError((cause) =>
      ReleaseArtifactsBuildError.make({
        operation: "bunPmPack",
        path: filename,
        reason: "Unable to run bun pm pack.",
        cause
      })
    )
  )
  const output = `${result.stdout}${result.stderr}`
  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      ReleaseArtifactsBuildError.make({
        operation: "bunPmPack",
        path: filename,
        reason: output.trim().length === 0 ? `bun pm pack exited with ${result.exitCode}.` : output.trim()
      })
    )
  }
  return filename
})

const compileCliArtifact = Effect.fn("scripts.compileCliArtifact")(function*(
  root: string,
  target: ReleaseCliArtifactTarget
) {
  const path = yield* Path.Path
  const output = yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: [path.resolve(root, "apps/release-ts/src/cli/main.ts")],
        compile: {
          target: target.bunTarget,
          outfile: path.resolve(root, target.outfile)
        }
      }),
    catch: (cause) =>
      ReleaseArtifactsBuildError.make({
        operation: "bunBuildCompile",
        path: target.outfile,
        reason: `Bun.build rejected while compiling ${target.id}.`,
        cause
      })
  }
  )
  if (!output.success) {
    const reason = output.logs.map((log) => String(log)).join("\n").trim()
    return yield* Effect.fail(
      ReleaseArtifactsBuildError.make({
        operation: "bunBuildCompile",
        path: target.outfile,
        reason: reason.length === 0 ? `Bun.build failed for ${target.id}.` : reason
      })
    )
  }
})

export const buildReleaseArtifacts = Effect.fn("scripts.buildReleaseArtifacts")(function*(
  root: string = process.cwd()
) {
  const identity = yield* readPackageIdentity(root)
  yield* prepareReleaseArtifactsDirectory(root)
  const tarball = yield* runBunPack(root, identity)
  const cliArtifacts = releaseCliArtifactTargets(identity.version)
  for (const target of cliArtifacts) {
    yield* compileCliArtifact(root, target)
  }
  return {
    tarball,
    cliArtifacts
  }
})

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  BunRuntime.runMain(buildReleaseArtifacts().pipe(Effect.provide(BunServices.layer)))
}
