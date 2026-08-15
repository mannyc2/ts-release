import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  truncateSync,
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
import {
  inspectPrepackedNpmTarball,
  npmTarballCompressedBytesLimit
} from "../../src/model/npm-tarball.js"
import { compileReleaseGraph } from "../../src/release/compiler.js"
import {
  StagingSnapshot,
  VerifiedPackage,
  VerifiedReleaseContext,
  VerifiedSource
} from "../../src/release/context.js"
import { prepareRelease } from "../../src/release/prepare.js"
import { decodePreparedRelease, encodePreparedRelease } from "../../src/release/prepared.js"
import { makeLocalPreparedReleaseStore } from "../../src/release/prepared-store.js"
import { materializeGitSource } from "../../src/platform/source-observer.js"
import { resolveConfig } from "../../src/resolve/resolve.js"
import type { RunCommand } from "../../src/drivers/process.js"
import { secureRead } from "../../src/drivers/workspace.js"
import { materializeExplicitInput } from "../../src/release/staging.js"

const text = (value: string): Uint8Array => new TextEncoder().encode(value)

const npmTarball = (
  packageName: string,
  version: string,
  dependencies: Readonly<Record<string, string>> = {},
  additionalEntries: ReadonlyArray<{ readonly path: string, readonly data: Uint8Array, readonly mode: number }> = []
): Uint8Array => tarGz([
  {
    path: "package/package.json",
    data: text(JSON.stringify({ name: packageName, version, dependencies })),
    mode: 0o644
  },
  { path: "package/index.js", data: text(`export const name = ${JSON.stringify(packageName)}\n`), mode: 0o644 },
  ...additionalEntries
])

const git = (root: string, ...argv: string[]): string => {
  const result = spawnSync("git", argv, { cwd: root, encoding: "utf8", stdio: "pipe" })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}

const repository = () => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-prepacked-source-"))
  writeFileSync(join(root, "package.json"), JSON.stringify({
    name: "effect-build",
    version: "0.3.0",
    repository: "https://github.com/owner/repository.git"
  }))
  git(root, "init", "-q")
  git(root, "config", "user.email", "fixture@example.test")
  git(root, "config", "user.name", "fixture")
  git(root, "add", ".")
  git(root, "commit", "-qm", "fixture")
  const manifest = new Uint8Array(readFileSync(join(root, "package.json")))
  const digest = sha256Digest(manifest)
  const source = VerifiedSource.make({
    commit: NonEmptyName.make(git(root, "rev-parse", "HEAD")),
    tree: NonEmptyName.make(git(root, "rev-parse", "HEAD^{tree}")),
    clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"),
    packageManifestDigest: digest,
    repository: "owner/repository",
    headTags: []
  })
  const context = VerifiedReleaseContext.make({
    workspace: WorkspaceRoot.make(root),
    source,
    package: VerifiedPackage.make({
      name: NonEmptyName.make("effect-build"),
      version: Version.make("0.3.0"),
      path: SafeRelativePath.make("package.json"),
      digest,
      repository: "owner/repository"
    })
  })
  return { root, context }
}

const authentication = { strategy: "token", credential: "NPM_TOKEN" } as const

const config = (subjects: ReadonlyArray<{
  readonly id: string
  readonly path: string
  readonly packageName: string
  readonly bytes: Uint8Array
}>) => ({
  project: {
    name: "effect-build",
    packageName: "effect-build",
    version: "0.3.0",
    tag: "v0.3.0",
    repository: "owner/repository"
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
      access: "public",
      authentication,
      provenance: "disabled"
    }))
  }
})

const facts = (context: VerifiedReleaseContext) => ({
  commit: context.source.commit,
  manifestName: context.package.name,
  manifestVersion: context.package.version,
  repository: context.source.repository
})

const materialize = (context: VerifiedReleaseContext, destination: WorkspaceRoot): Effect.Effect<StagingSnapshot, unknown> =>
  Effect.try({
    try: () => materializeGitSource(context.workspace, context.source, destination),
    catch: (cause) => cause
  })

describe("prepacked npm tarball validation", () => {
  test("accepts one bounded safe npm archive with exact embedded identity", () => {
    const bytes = npmTarball("effect-build", "0.3.0", { effect: "4.0.0-rc.108" })
    expect(inspectPrepackedNpmTarball("effect-build.tgz", bytes, "effect-build", "0.3.0"))
      .toEqual({ packageName: "effect-build", version: "0.3.0" })
  })

  test.each([
    ["wrong name", npmTarball("wrong", "0.3.0"), /name.*disagrees/iu],
    ["wrong version", npmTarball("effect-build", "9.9.9"), /version.*disagrees/iu],
    ["workspace dependency", npmTarball("effect-build", "0.3.0", { local: "workspace:^" }), /workspace.*dependency/iu],
    ["file dependency", npmTarball("effect-build", "0.3.0", { local: "file:../local" }), /file.*dependency/iu],
    ["link dependency", npmTarball("effect-build", "0.3.0", { local: "link:../local" }), /link.*dependency/iu],
    ["backslash-relative dependency", npmTarball("effect-build", "0.3.0", { local: ".\\local" }), /path.*dependency/iu],
    ["backslash-parent dependency", npmTarball("effect-build", "0.3.0", { local: "..\\local" }), /path.*dependency/iu],
    ["UNC dependency", npmTarball("effect-build", "0.3.0", { local: "\\\\server\\share\\local" }), /path.*dependency/iu],
    ["drive-relative dependency", npmTarball("effect-build", "0.3.0", { local: "C:local" }), /path.*dependency/iu],
    ["escaping entry", npmTarball("effect-build", "0.3.0", {}, [
      { path: "package/../escape", data: text("escape"), mode: 0o644 }
    ]), /escaping path/iu],
    ["duplicate manifest", tarGz([
      { path: "package/package.json", data: text(JSON.stringify({ name: "effect-build", version: "0.3.0" })), mode: 0o644 },
      { path: "package/package.json", data: text(JSON.stringify({ name: "effect-build", version: "0.3.0" })), mode: 0o644 }
    ]), /duplicate/iu]
  ] as const)("rejects %s", (_label, bytes, expected) => {
    expect(() => inspectPrepackedNpmTarball("effect-build.tgz", bytes, "effect-build", "0.3.0"))
      .toThrow(expected)
  })
})

describe("prepacked npm preparation", () => {
  test("materializes one explicit file with one bounded staged read and returns those exact bytes", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-explicit-read-")))
    const source = join(root, "source")
    const stage = join(root, "stage")
    mkdirSync(source)
    mkdirSync(stage)
    const value = text("one exact prepacked candidate\n")
    writeFileSync(join(source, "candidate.tgz"), value)
    let reads = 0
    try {
      const materialized = materializeExplicitInput({
        id: "prepacked-npm:core",
        sourceWorkspace: source,
        stageRoot: stage,
        path: SafeRelativePath.make("candidate.tgz"),
        maxFileBytes: value.length,
        readFile: (workspace, path, options) => {
          reads += 1
          return secureRead(workspace, path, options)
        }
      })
      expect(reads).toBe(1)
      expect(materialized.bytes).toEqual(value)
      expect(materialized.snapshot).toMatchObject({
        id: "prepacked-npm:core",
        kind: "file",
        size: value.length,
        digest: sha256Digest(value)
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("rejects an oversized compressed candidate before copying or reading it", async () => {
    const fixture = repository()
    const path = ".release/candidate/oversized.tgz"
    mkdirSync(join(fixture.root, path, ".."), { recursive: true })
    writeFileSync(join(fixture.root, path), "")
    truncateSync(join(fixture.root, path), npmTarballCompressedBytesLimit + 1)
    const authored = config([{
      id: "core",
      packageName: "effect-build",
      path,
      bytes: text("declared digest is unreachable because size fails first")
    }])
    try {
      const resolved = resolveConfig(authored, facts(fixture.context))
      await expect(Effect.runPromise(prepareRelease({
        context: fixture.context,
        graph: compileReleaseGraph(resolved, fixture.context),
        store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
        run: () => Effect.die("oversized prepacked input must fail before commands"),
        materializeSource: materialize
      }))).rejects.toMatchObject({
        _tag: "PreparationError",
        reason: expect.stringMatching(/size.*exceeds.*byte limit/iu)
      })
      expect(existsSync(join(fixture.root, ".release", "prepared"))).toBe(false)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  test("copies exact untracked blobs once, never runs npm pack, and preserves order after store reload", async () => {
    const fixture = repository()
    const core = npmTarball("effect-build", "0.3.0")
    const bun = npmTarball("effect-build-bun", "0.3.0", { "effect-build": "0.3.0" })
    const subjects = [
      { id: "z-core", packageName: "effect-build", path: ".release/candidate/effect-build.tgz", bytes: core },
      { id: "a-bun", packageName: "effect-build-bun", path: ".release/candidate/effect-build-bun.tgz", bytes: bun }
    ]
    for (const subject of subjects) {
      mkdirSync(join(fixture.root, subject.path, ".."), { recursive: true })
      writeFileSync(join(fixture.root, subject.path), subject.bytes)
    }
    const resolved = resolveConfig(config(subjects), facts(fixture.context))
    const graph = compileReleaseGraph(resolved, fixture.context)
    const store = makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared"))
    const calls: ReadonlyArray<never> = []
    const run: RunCommand = () => Effect.sync(() => {
      ;(calls as Array<never>).push(undefined as never)
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      const committed = await Effect.runPromise(prepareRelease({
        context: fixture.context,
        graph,
        store,
        run,
        materializeSource: materialize
      }))
      expect(calls).toHaveLength(0)
      expect(committed.bundle.manifest.provenance.execution.npmPack).toBe("not-used")
      expect(committed.bundle.manifest.publications.map((publication) => publication.id.toString()))
        .toEqual(["npm:z-core", "npm:a-bun"])
      expect(committed.bundle.blobs.get("prepacked-npm:z-core")).toEqual(core)
      expect(committed.bundle.blobs.get("prepacked-npm:a-bun")).toEqual(bun)
      const decoded = decodePreparedRelease(encodePreparedRelease(committed.bundle.manifest))
      expect(decoded.publications.map((publication) => publication.id.toString()))
        .toEqual(["npm:z-core", "npm:a-bun"])
      const reloaded = await Effect.runPromise(store.load(committed.ref))
      expect(reloaded.manifest.publications.map((publication) => publication.id.toString()))
        .toEqual(["npm:z-core", "npm:a-bun"])
      expect(reloaded.blobs.get("prepacked-npm:z-core")).toEqual(core)
      expect(reloaded.blobs.get("prepacked-npm:a-bun")).toEqual(bun)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  test("rejects a declared digest mismatch before any command or durable commit", async () => {
    const fixture = repository()
    const bytes = npmTarball("effect-build", "0.3.0")
    const path = ".release/candidate/effect-build.tgz"
    mkdirSync(join(fixture.root, path, ".."), { recursive: true })
    writeFileSync(join(fixture.root, path), bytes)
    const valid = config([{ id: "core", packageName: "effect-build", path, bytes }])
    const authored = {
      ...valid,
      publish: {
        prepackedNpm: valid.publish.prepackedNpm.map((publication) => ({
          ...publication,
          sha256: "f".repeat(64)
        }))
      }
    }
    let runs = 0
    try {
      const resolved = resolveConfig(authored, facts(fixture.context))
      await expect(Effect.runPromise(prepareRelease({
        context: fixture.context,
        graph: compileReleaseGraph(resolved, fixture.context),
        store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
        run: () => Effect.sync(() => {
          runs += 1
          return { exitCode: 0, stdout: "", stderr: "" }
        }),
        materializeSource: materialize
      }))).rejects.toMatchObject({
        _tag: "PreparationError",
        reason: expect.stringMatching(/sha-?256.*disagrees/iu)
      })
      expect(runs).toBe(0)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})
