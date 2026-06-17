import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { mkdir, readFile, rm, stat } from "node:fs/promises"
import { basename, dirname, resolve } from "node:path"
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
    reason: Schema.String
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

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

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
  const resolvedRoot = resolve(root)
  const expectedDirectory = resolve(resolvedRoot, artifactsDirectory)
  const resolvedDirectory = resolve(resolvedRoot, directory)

  if (
    resolvedDirectory !== expectedDirectory ||
    dirname(resolvedDirectory) !== resolve(resolvedRoot, ".release") ||
    basename(resolvedDirectory) !== "artifacts"
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
  const packagePath = resolve(root, "package.json")
  const contents = yield* Effect.tryPromise({
    try: () => readFile(packagePath, "utf8"),
    catch: (cause) =>
      ReleaseArtifactsBuildError.make({
        operation: "readPackageJson",
        path: packagePath,
        reason: formatUnknown(cause)
      })
  })
  const parsed: unknown = JSON.parse(contents)
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
  const directory = yield* assertSafeReleaseArtifactsDirectory(root)
  yield* Effect.tryPromise({
    try: async () => {
      await rm(directory, { recursive: true, force: true })
      await mkdir(directory, { recursive: true })
    },
    catch: (cause) =>
      ReleaseArtifactsBuildError.make({
        operation: "prepareArtifactsDirectory",
        path: directory,
        reason: formatUnknown(cause)
      })
  })
  return directory
})

const verifyBuiltCli = Effect.fn("scripts.verifyBuiltCli")(function*(root: string) {
  const cliPath = resolve(root, "dist/cli/main.js")
  const info = yield* Effect.tryPromise({
    try: () => stat(cliPath),
    catch: (cause) =>
      ReleaseArtifactsBuildError.make({
        operation: "verifyBuiltCli",
        path: cliPath,
        reason: `dist/cli/main.js is required before packaging; run bun run build. ${formatUnknown(cause)}`
      })
  })
  if (!info.isFile()) {
    return yield* Effect.fail(
      ReleaseArtifactsBuildError.make({
        operation: "verifyBuiltCli",
        path: cliPath,
        reason: "dist/cli/main.js is required before packaging; run bun run build."
      })
    )
  }
})

const runBunPack = Effect.fn("scripts.runBunPack")(function*(
  root: string,
  identity: ReleasePackageIdentity
) {
  const filename = packageTarballArtifactPath(identity)
  const subprocess = Bun.spawn([
    "bun",
    "pm",
    "pack",
    "--filename",
    filename,
    "--quiet",
    "--ignore-scripts"
  ], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  const stdout = streamText(subprocess.stdout)
  const stderr = streamText(subprocess.stderr)
  const exitCode = yield* Effect.promise(() => subprocess.exited)
  const output = `${yield* Effect.promise(() => stdout)}${yield* Effect.promise(() => stderr)}`
  if (exitCode !== 0) {
    return yield* Effect.fail(
      ReleaseArtifactsBuildError.make({
        operation: "bunPmPack",
        path: packageTarballArtifactPath(identity),
        reason: output.trim().length === 0 ? `bun pm pack exited with ${exitCode}.` : output.trim()
      })
    )
  }
  return packageTarballArtifactPath(identity)
})

const compileCliArtifact = Effect.fn("scripts.compileCliArtifact")(function*(
  root: string,
  target: ReleaseCliArtifactTarget
) {
  const output = yield* Effect.promise(() =>
    Bun.build({
      entrypoints: [resolve(root, "src/cli/main.ts")],
      compile: {
        target: target.bunTarget,
        outfile: resolve(root, target.outfile)
      }
    })
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
  yield* verifyBuiltCli(root)
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
  BunRuntime.runMain(buildReleaseArtifacts())
}
