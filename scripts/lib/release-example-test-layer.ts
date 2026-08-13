import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../../src/api/runtime.js"
import type { ReleaseApiLayer } from "../../src/api/types.js"
import { tarGz } from "../../src/drivers/archive.js"
import { DriverError } from "../../src/drivers/errors.js"
import type { RunCommand } from "../../src/drivers/process.js"
import { sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, SafeRelativePath, Version, WorkspaceRoot } from "../../src/model/primitives.js"
import {
  AuthorizedMutationHttp,
  CertifiedPublisherSpawn,
  CredentialPlatformError,
  NpmUserConfigResource
} from "../../src/platform/credentials.js"
import {
  CredentialProvider,
  CredentialUnavailable,
  makeCredentialProvider
} from "../../src/publication/authority.js"
import { HttpAuthorizer } from "../../src/publication/http.js"
import {
  SourceMaterializationError,
  ReleaseContextError,
  VerifiedPackage,
  VerifiedReleaseContext,
  VerifiedSource,
  type StagingSnapshot
} from "../../src/release/context.js"
import {
  PreparedReleaseStore,
  type PreparedReleaseStoreShape
} from "../../src/release/prepared-store.js"
import { snapshotStaging } from "../../src/release/staging.js"

const commit = NonEmptyName.make("2330000000000000000000000000000000000000")
const tree = NonEmptyName.make("2331111111111111111111111111111111111111")

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

export const deterministicExampleContext = (
  workspace: string,
  packageManifestPath: SafeRelativePath
): VerifiedReleaseContext => {
  const manifestBytes = new Uint8Array(readFileSync(join(workspace, packageManifestPath.toString())))
  const manifest = object(JSON.parse(new TextDecoder().decode(manifestBytes)), packageManifestPath.toString())
  const name = typeof manifest.name === "string" ? manifest.name : undefined
  const version = typeof manifest.version === "string" ? manifest.version : undefined
  const repository = typeof manifest.repository === "string" ? manifest.repository : undefined
  if (name === undefined || version === undefined) throw new Error("Example package identity is incomplete.")
  const digest = sha256Digest(manifestBytes)
  const source = VerifiedSource.make({
    commit,
    tree,
    clean: true,
    packageManifestPath,
    packageManifestDigest: digest,
    headTags: [],
    ...(repository === undefined ? {} : { repository })
  })
  return VerifiedReleaseContext.make({
    workspace: WorkspaceRoot.make(workspace),
    source,
    package: VerifiedPackage.make({
      name: NonEmptyName.make(name),
      version: Version.make(version),
      path: packageManifestPath,
      digest,
      ...(repository === undefined ? {} : { repository })
    })
  })
}

const materialize = (
  workspace: WorkspaceRoot,
  _source: VerifiedSource,
  destination: WorkspaceRoot
): Effect.Effect<StagingSnapshot, SourceMaterializationError> => Effect.try({
  try: () => {
    for (const entry of readdirSync(workspace.toString())) {
      if ([".git", ".release", "node_modules", "prepared-store"].includes(entry)) continue
      const source = join(workspace.toString(), entry)
      if (lstatSync(source).isSymbolicLink()) throw new Error(`Example source ${entry} is a symlink.`)
      cpSync(source, join(destination.toString(), entry), { recursive: true, dereference: false })
    }
    return snapshotStaging(destination.toString())
  },
  catch: (cause) => new SourceMaterializationError({
    field: "source.materialization",
    reason: cause instanceof Error ? cause.message : String(cause)
  })
})

const argumentAfter = (argv: ReadonlyArray<string>, name: string): string => {
  const index = argv.indexOf(name)
  const value = index < 0 ? undefined : argv[index + 1]
  if (value === undefined) throw new Error(`Default example command is missing ${name}.`)
  return value
}

const outcome = (stdout = "") => ({ exitCode: 0, stdout, stderr: "" })
const npmTool = {
  protocol: "ts-release-executable/v1" as const,
  command: "npm",
  sha256: "233".padEnd(64, "0")
}
const bunTool = {
  protocol: "ts-release-executable/v1" as const,
  command: "bun",
  sha256: "234".padEnd(64, "0")
}

/**
 * Closed command double for the public example gate. It materializes only the
 * exact local effects preparation expects and has no network or provider seam.
 */
const run: RunCommand = Effect.fn("runDefaultReleaseExampleCommand")((command) => Effect.try({
  try: () => {
    if (command.environmentNames.length !== 0) throw new Error("Example commands must receive a closed environment.")
    const argv = command.argv
    if (argv[0] === "test" && argv[1] === "-d" && argv[2] !== undefined) {
      const path = resolve(command.cwd, argv[2])
      return existsSync(path) && lstatSync(path).isDirectory()
        ? outcome()
        : { exitCode: 1, stdout: "", stderr: `${argv[2]} is not a directory` }
    }
    if (argv[0] === "bun" && argv[1] === "--version") {
      if (command.network !== "offline-cli") throw new Error("Bun version observation must use the offline CLI boundary.")
      return outcome(process.versions.bun)
    }
    if (argv[0] === "bun" && argv[1] === "install") {
      if (command.network !== "offline-cli") throw new Error("Bun dependency materialization must use the offline CLI boundary.")
      mkdirSync(join(command.cwd, "node_modules"), { recursive: true, mode: 0o700 })
      return outcome()
    }
    if (argv[0] === "bun" && argv[1] === "build") {
      if (command.network !== "deny") throw new Error("Bun builds must use the denied-network boundary.")
      const outputPath = resolve(command.cwd, argumentAfter(argv, "--outfile"))
      const target = argumentAfter(argv, "--target") as
        "bun-linux-x64" | "bun-linux-arm64" | "bun-darwin-x64" | "bun-darwin-arm64"
      mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 })
      writeFileSync(outputPath, `#!/bin/sh\n# deterministic example artifact: ${basename(outputPath)}\n`, { mode: 0o755 })
      chmodSync(outputPath, 0o755)
      const executing = target === "bun-linux-x64"
      const cachePlatform = target.slice(4).replace("arm64", "aarch64")
      return {
        ...outcome(),
        tool: bunTool,
        bunCompileRuntime: {
          protocol: "ts-release-bun-compile-runtime/v1" as const,
          target,
          bunVersion: process.versions.bun,
          source: executing ? "executing-bun" as const : "host-cache-private-copy" as const,
          cacheFile: executing ? "executing-bun" : `bun-${cachePlatform}-v${process.versions.bun}`,
          sha256: executing ? bunTool.sha256 : `${target.length}`.padEnd(64, "0")
        }
      }
    }
    if (argv[0] === "npm" && argv[1] === "--version") {
      if (command.network !== "offline-cli") throw new Error("npm version observation must use the offline CLI boundary.")
      return { ...outcome("10.9.4\n"), tool: npmTool }
    }
    if (argv[0] === "npm" && argv[1] === "pack") {
      if (command.network !== "offline-cli") throw new Error("npm pack must use the offline CLI boundary.")
      const packageRoot = resolve(command.cwd, argv[2] ?? ".")
      const manifestPath = join(packageRoot, "package.json")
      const manifestBytes = new Uint8Array(readFileSync(manifestPath))
      const manifest = object(JSON.parse(new TextDecoder().decode(manifestBytes)), "package.json")
      const packageName = typeof manifest.name === "string" ? manifest.name.replace(/^@/u, "").replaceAll("/", "-") : "package"
      const version = typeof manifest.version === "string" ? manifest.version : "0.0.0"
      const destination = resolve(command.cwd, argumentAfter(argv, "--pack-destination"))
      mkdirSync(destination, { recursive: true, mode: 0o700 })
      writeFileSync(join(destination, `${packageName}-${version}.tgz`), tarGz([{
        path: "package/package.json",
        data: manifestBytes,
        mode: 0o100644
      }]))
      return { ...outcome(JSON.stringify([{
        files: [{ path: "package.json", size: statSync(manifestPath).size, mode: 0o644 }]
      }])), tool: npmTool }
    }
    return { exitCode: 127, stdout: "", stderr: `Unsupported default example command: ${argv.join(" ")}` }
  },
  catch: (cause) => DriverError.make({
    reason: cause instanceof Error ? cause.message : String(cause),
    commitment: "before-commit"
  })
}))

const unavailable = () => Effect.fail(new CredentialPlatformError({
  phase: "mutate",
  commitment: "before-dispatch",
  reason: "Default example gate has no mutation authority."
}))

/** Default non-network test wiring for public example/template certification. */
export const makeDefaultReleaseExampleTestLayer = (
  preparedStore: PreparedReleaseStoreShape
): ReleaseApiLayer => {
  const source = {
    observe: (workspace: WorkspaceRoot, packageManifestPath: SafeRelativePath) => Effect.try({
      try: () => deterministicExampleContext(workspace.toString(), packageManifestPath),
      catch: (cause) => new ReleaseContextError({
        field: "example.context",
        reason: cause instanceof Error ? cause.message : String(cause)
      })
    }),
    materialize
  }
  const runtime: ReleaseRuntimeShape = { source, run }
  const credentials = makeCredentialProvider({
    acquire: (request) => Effect.fail(new CredentialUnavailable({
      subject: request.subject,
      provider: request.provider,
      purpose: request.purpose,
      reason: "Default example gate never acquires credentials."
    }))
  })
  return Layer.mergeAll(
    Layer.succeed(ReleaseRuntime, runtime),
    Layer.succeed(PreparedReleaseStore, preparedStore),
    Layer.succeed(CredentialProvider, credentials),
    Layer.succeed(HttpAuthorizer, { execute: unavailable }),
    Layer.succeed(AuthorizedMutationHttp, { execute: unavailable }),
    Layer.succeed(NpmUserConfigResource, { acquire: unavailable }),
    Layer.succeed(CertifiedPublisherSpawn, {
      preflightTrustedNpm: unavailable,
      spawn: unavailable
    })
  )
}
