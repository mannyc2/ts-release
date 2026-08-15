import * as Effect from "effect/Effect"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { tarGz } from "../../src/drivers/archive.js"
import { sha256Digest } from "../../src/model/digest.js"
import {
  NonEmptyName,
  SafeRelativePath,
  Version,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import { compileReleaseGraph } from "../../src/release/compiler.js"
import {
  type StagingSnapshot,
  VerifiedPackage,
  VerifiedReleaseContext,
  VerifiedSource
} from "../../src/release/context.js"
import { prepareRelease } from "../../src/release/prepare.js"
import {
  makeLocalPreparedReleaseStore,
  type PreparedBundle
} from "../../src/release/prepared-store.js"
import { materializeGitSource } from "../../src/platform/source-observer.js"
import { resolveConfig } from "../../src/resolve/resolve.js"

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value)

const git = (root: string, ...argv: string[]): string => {
  const result = spawnSync("git", argv, { cwd: root, encoding: "utf8", stdio: "pipe" })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}

export const prepackedPackages = [
  { id: "q-core", packageName: "effect-build" },
  { id: "a-bun", packageName: "effect-build-bun" },
  { id: "z-deno", packageName: "effect-build-deno" },
  { id: "b-esbuild", packageName: "effect-build-esbuild" },
  { id: "y-node-sea", packageName: "effect-build-node-sea" }
] as const

export interface PrepackedMultipackageSubject {
  readonly id: typeof prepackedPackages[number]["id"]
  readonly packageName: typeof prepackedPackages[number]["packageName"]
  readonly path: string
  readonly artifactId: string
  readonly bytes: Uint8Array
}

export interface PrepackedMultipackageFixture {
  readonly root: string
  readonly context: VerifiedReleaseContext
  readonly subjects: ReadonlyArray<PrepackedMultipackageSubject>
  readonly bundle: PreparedBundle
  readonly preparationCommands: number
  readonly cleanup: () => void
}

const tarball = (packageName: string): Uint8Array => tarGz([
  {
    path: "package/package.json",
    data: bytes(JSON.stringify({
      name: packageName,
      version: "0.3.0",
      type: "module",
      ...(packageName === "effect-build"
        ? { peerDependencies: { effect: "4.0.0-rc.108" } }
        : { dependencies: { "effect-build": "0.3.0" } })
    })),
    mode: 0o644
  },
  {
    path: "package/index.js",
    data: bytes(`export const packageName = ${JSON.stringify(packageName)}\n`),
    mode: 0o644
  }
])

const makeContext = (root: string): VerifiedReleaseContext => {
  const manifest = new Uint8Array(readFileSync(join(root, "package.json")))
  const digest = sha256Digest(manifest)
  return VerifiedReleaseContext.make({
    workspace: WorkspaceRoot.make(root),
    source: VerifiedSource.make({
      commit: NonEmptyName.make(git(root, "rev-parse", "HEAD")),
      tree: NonEmptyName.make(git(root, "rev-parse", "HEAD^{tree}")),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: digest,
      repository: "owner/project",
      headTags: []
    }),
    package: VerifiedPackage.make({
      name: NonEmptyName.make("effect-build"),
      version: Version.make("0.3.0"),
      path: SafeRelativePath.make("package.json"),
      digest,
      repository: "owner/project"
    })
  })
}

const materialize = (
  context: VerifiedReleaseContext,
  destination: WorkspaceRoot
): Effect.Effect<StagingSnapshot, unknown> => Effect.try({
  try: () => materializeGitSource(context.workspace, context.source, destination),
  catch: (cause) => cause
})

export const makePrepackedMultipackageFixture = async (): Promise<PrepackedMultipackageFixture> => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-prepacked-five-"))
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({
      name: "effect-build",
      version: "0.3.0",
      repository: "https://github.com/owner/project.git"
    }))
    git(root, "init", "-q")
    git(root, "config", "user.email", "fixture@example.test")
    git(root, "config", "user.name", "fixture")
    git(root, "add", "package.json")
    git(root, "commit", "-qm", "fixture")
    const context = makeContext(root)
    const subjects = prepackedPackages.map(({ id, packageName }): PrepackedMultipackageSubject => {
      const value = tarball(packageName)
      const path = `.release/candidate/${packageName}.tgz`
      mkdirSync(join(root, path, ".."), { recursive: true })
      writeFileSync(join(root, path), value)
      return { id, packageName, path, artifactId: `prepacked-npm:${id}`, bytes: value }
    })
    const authentication = { strategy: "token", credential: "NPM_TOKEN" } as const
    const authored = {
      project: {
        name: "effect-build",
        packageName: "effect-build",
        version: "0.3.0",
        tag: "v0.3.0",
        repository: "owner/project"
      },
      publish: {
        prepackedNpm: subjects.map((subject) => ({
          id: subject.id,
          path: subject.path,
          packageName: subject.packageName,
          version: "0.3.0",
          sha256: sha256Digest(subject.bytes).hex,
          registry: "https://registry.npmjs.org/",
          distTag: "latest",
          access: "public" as const,
          authentication,
          provenance: "disabled" as const
        })),
        github: {
          repository: "owner/project",
          tokenEnv: "GITHUB_TOKEN",
          draft: false,
          prerelease: false,
          body: "exact five-package candidate",
          ids: subjects.map((subject) => subject.artifactId)
        }
      }
    }
    const resolved = resolveConfig(authored, {
      commit: context.source.commit,
      manifestName: context.package.name,
      manifestVersion: context.package.version,
      repository: context.source.repository
    })
    const graph = compileReleaseGraph(resolved, context)
    const store = makeLocalPreparedReleaseStore(join(root, ".release", "prepared"))
    let preparationCommands = 0
    const committed = await Effect.runPromise(prepareRelease({
      context,
      graph,
      store,
      run: () => Effect.sync(() => {
        preparationCommands += 1
        return { exitCode: 97, stdout: "", stderr: "prepacked preparation must not run a command" }
      }),
      materializeSource: materialize
    }))
    const bundle = await Effect.runPromise(store.load(committed.ref))
    return {
      root,
      context,
      subjects,
      bundle,
      preparationCommands,
      cleanup: () => rmSync(root, { recursive: true, force: true })
    } as PrepackedMultipackageFixture
  } catch (cause) {
    rmSync(root, { recursive: true, force: true })
    throw cause
  }
}
