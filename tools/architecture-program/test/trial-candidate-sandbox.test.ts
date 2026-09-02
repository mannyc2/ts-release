import { existsSync } from "node:fs"
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile
} from "node:fs/promises"
import { dirname, join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import {
  type ArchitectureCandidateManifestV2,
  decodeCandidateManifest
} from "../src/schema/candidate-manifest.js"
import {
  TrialCandidateSandbox,
  TrialCandidateSandboxError,
  makeTrialCandidateSandbox,
  makeTrialCandidateSandboxLayer
} from "../src/trial-candidate-sandbox.js"

interface Fixture {
  readonly outer: string
  readonly source: string
  readonly sandboxes: string
  readonly external: string
}

interface FixtureFile {
  readonly path: string
  readonly content: string
  readonly mode: number
}

const fixtureFiles: ReadonlyArray<FixtureFile> = [
  { path: "src/index.ts", content: "export const candidate = true\n", mode: 0o711 },
  { path: "trial-adapter.ts", content: "export const adapter = true\n", mode: 0o666 },
  { path: "trial-candidate.json", content: "{\"candidate\":true}\n", mode: 0o600 }
]

const fileEntry = (path: string, product: boolean) => ({
  path,
  laneId: product ? "product-source" : "tooling",
  moduleId: product ? "module.candidate" : null,
  packageId: product ? "package.candidate" : null,
  ownerRoleIds: product ? ["candidate-owner"] : [],
  conceptIds: product ? ["candidate-concept"] : [],
  centralBranchIds: []
})

const manifestDocument = () => ({
  schemaVersion: "ts-release/architecture-candidate-manifest/v2",
  candidateId: "M1-extracted-fold",
  scope: "machine",
  model: "extracted-fold",
  implementationRoot: "prototypes/research-complete-machine/M1-extracted-fold",
  files: [
    fileEntry("src/index.ts", true),
    fileEntry("trial-adapter.ts", false),
    fileEntry("trial-candidate.json", false)
  ],
  publicSurfaceIds: [],
  durableFormatIds: [],
  dependencyEdges: []
})

const decodeManifest = (input: unknown): Promise<ArchitectureCandidateManifestV2> =>
  Effect.runPromise(decodeCandidateManifest(input))

const materialize = async (
  root: string,
  files: ReadonlyArray<FixtureFile> = fixtureFiles
): Promise<void> => {
  for (const file of files) {
    const target = join(root, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.content)
    await chmod(target, file.mode)
  }
}

const withFixture = async <A>(use: (fixture: Fixture) => Promise<A>): Promise<A> => {
  const outer = await mkdtemp("/tmp/architecture-candidate-sandbox-test-")
  const fixture = {
    outer,
    source: join(outer, "source"),
    sandboxes: join(outer, "sandboxes"),
    external: join(outer, "external")
  }
  await mkdir(fixture.source)
  await mkdir(fixture.sandboxes)
  await mkdir(fixture.external)
  try {
    return await use(fixture)
  } finally {
    await rm(outer, { recursive: true, force: true })
  }
}

const listRegularFiles = async (root: string): Promise<ReadonlyArray<string>> => {
  const output: Array<string> = []
  const visit = async (path: string, prefix: string): Promise<void> => {
    for (const name of (await readdir(path)).sort()) {
      const absolute = join(path, name)
      const relative = prefix === "" ? name : `${prefix}/${name}`
      const stat = await lstat(absolute)
      if (stat.isDirectory()) await visit(absolute, relative)
      else if (stat.isFile()) output.push(relative)
    }
  }
  await visit(root, "")
  return output
}

const createExit = (
  service: ReturnType<typeof makeTrialCandidateSandbox>,
  candidateRoot: string,
  manifest: ArchitectureCandidateManifestV2
) => Effect.runPromiseExit(Effect.scoped(service.create({ candidateRoot, manifest })))

describe("TrialCandidateSandbox", () => {
  it("creates fresh exact copies with canonical modes and cleans both at scope close", async () =>
    withFixture(async ({ source, sandboxes }) => {
      await materialize(source)
      const manifest = await decodeManifest(manifestDocument())
      const service = makeTrialCandidateSandbox({ tempParent: sandboxes })
      let firstRoot = ""
      let secondRoot = ""

      await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
        const first = yield* service.create({ candidateRoot: source, manifest })
        const second = yield* service.create({ candidateRoot: source, manifest })
        firstRoot = first.root
        secondRoot = second.root

        expect(first.root).not.toBe(second.root)
        expect(yield* Effect.promise(() => listRegularFiles(first.root)))
          .toEqual(manifest.files.map(({ path }) => path))
        expect(yield* Effect.promise(() => listRegularFiles(second.root)))
          .toEqual(manifest.files.map(({ path }) => path))
        expect((yield* Effect.promise(() => lstat(first.root))).mode & 0o7777).toBe(0o700)
        expect((yield* Effect.promise(() => lstat(join(first.root, "src")))).mode & 0o7777)
          .toBe(0o700)
        expect((yield* Effect.promise(() => lstat(join(first.root, "src/index.ts")))).mode & 0o7777)
          .toBe(0o755)
        expect((yield* Effect.promise(() => lstat(join(first.root, "trial-adapter.ts")))).mode & 0o7777)
          .toBe(0o644)
        expect((yield* Effect.promise(() => lstat(join(first.root, "trial-candidate.json")))).mode & 0o7777)
          .toBe(0o644)
        expect(yield* Effect.promise(() => readFile(join(first.root, "src/index.ts"), "utf8")))
          .toBe("export const candidate = true\n")
        expect(existsSync(join(first.root, "node_modules"))).toBe(false)
      })))

      expect(existsSync(firstRoot)).toBe(false)
      expect(existsSync(secondRoot)).toBe(false)
      expect(await readdir(sandboxes)).toEqual([])
    }))

  it("provides the scoped constructor through the Effect service layer", async () =>
    withFixture(async ({ source, sandboxes }) => {
      await materialize(source)
      const manifest = await decodeManifest(manifestDocument())
      let isolatedRoot = ""
      const program = Effect.gen(function* () {
        const sandbox = yield* TrialCandidateSandbox
        const isolated = yield* sandbox.create({ candidateRoot: source, manifest })
        isolatedRoot = isolated.root
        expect(existsSync(isolated.root)).toBe(true)
      }).pipe(Effect.provide(makeTrialCandidateSandboxLayer({ tempParent: sandboxes })))

      await Effect.runPromise(Effect.scoped(program))
      expect(existsSync(isolatedRoot)).toBe(false)
    }))

  it("normalizes Bun Uint8Array directory names during scoped cleanup", async () =>
    withFixture(async ({ source, sandboxes }) => {
      await materialize(source)
      const manifest = await decodeManifest(manifestDocument())
      const service = makeTrialCandidateSandbox({
        tempParent: sandboxes,
        fileSystem: {
          readdir: async (path) => (await readdir(path, { encoding: "buffer" }))
            .map((name) => new Uint8Array(name)) as unknown as ReadonlyArray<Buffer>
        }
      })

      await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
        const isolated = yield* service.create({ candidateRoot: source, manifest })
        expect(existsSync(isolated.root)).toBe(true)
      })))

      expect(await readdir(sandboxes)).toEqual([])
    }))

  it("rejects missing, extra, credential, and node_modules source assumptions", async () =>
    withFixture(async ({ outer, sandboxes }) => {
      const manifest = await decodeManifest(manifestDocument())
      const service = makeTrialCandidateSandbox({ tempParent: sandboxes })
      const scenarioFiles: ReadonlyArray<ReadonlyArray<FixtureFile>> = [
        fixtureFiles.slice(0, -1),
        [...fixtureFiles, { path: "rogue.ts", content: "rogue\n", mode: 0o644 }],
        [...fixtureFiles, { path: ".env", content: "TOKEN=secret\n", mode: 0o600 }]
      ]
      for (const [index, files] of scenarioFiles.entries()) {
        const root = join(outer, `scenario-${index}`)
        await mkdir(root)
        await materialize(root, files)
        const exit = await createExit(service, root, manifest)
        expect(Exit.isFailure(exit)).toBe(true)
      }

      const nodeModulesRoot = join(outer, "node-modules-scenario")
      await mkdir(nodeModulesRoot)
      await materialize(nodeModulesRoot)
      await mkdir(join(nodeModulesRoot, "node_modules"))
      const nodeModulesExit = await createExit(service, nodeModulesRoot, manifest)
      expect(Exit.isFailure(nodeModulesExit)).toBe(true)
      expect(await readdir(sandboxes)).toEqual([])
    }))

  it("rejects source file and root symlinks", async () =>
    withFixture(async ({ outer, source, sandboxes }) => {
      const manifest = await decodeManifest(manifestDocument())
      const service = makeTrialCandidateSandbox({ tempParent: sandboxes })
      await materialize(source)
      await unlink(join(source, "src/index.ts"))
      await symlink("../trial-adapter.ts", join(source, "src/index.ts"))
      const fileLinkExit = await createExit(service, source, manifest)
      expect(Exit.isFailure(fileLinkExit)).toBe(true)

      const realRoot = join(outer, "real-root")
      const linkedRoot = join(outer, "linked-root")
      await mkdir(realRoot)
      await materialize(realRoot)
      await symlink(realRoot, linkedRoot)
      const rootLinkExit = await createExit(service, linkedRoot, manifest)
      expect(Exit.isFailure(rootLinkExit)).toBe(true)
    }))

  it("detects a source replacement between snapshot and O_NOFOLLOW open and cleans the failed copy", async () =>
    withFixture(async ({ source, sandboxes }) => {
      await materialize(source)
      const manifest = await decodeManifest(manifestDocument())
      const target = join(source, "src/index.ts")
      let replaced = false
      const service = makeTrialCandidateSandbox({
        tempParent: sandboxes,
        fileSystem: {
          open: async (path, flags, mode) => {
            if (!replaced && path === target) {
              replaced = true
              await writeFile(target, "replacement after snapshot\n")
            }
            return open(path, flags, mode)
          }
        }
      })

      const exit = await createExit(service, source, manifest)
      expect(Exit.isFailure(exit)).toBe(true)
      expect(replaced).toBe(true)
      expect(await readdir(sandboxes)).toEqual([])
    }))

  it("rejects traversal, noncanonical paths, and credential-bearing manifest entries before writes", async () =>
    withFixture(async ({ source, sandboxes, external }) => {
      await materialize(source)
      const manifest = await decodeManifest(manifestDocument())
      const service = makeTrialCandidateSandbox({ tempParent: sandboxes })
      const sentinel = join(external, "sentinel.txt")
      await writeFile(sentinel, "unchanged\n")

      for (const hostilePath of ["../external/sentinel.txt", "/tmp/escape.ts", "src\\escape.ts", ".npmrc"]) {
        const hostileManifest = {
          ...manifest,
          files: [
            { ...manifest.files[0]!, path: hostilePath },
            ...manifest.files.slice(1)
          ]
        } as unknown as ArchitectureCandidateManifestV2
        const exit = await createExit(service, source, hostileManifest)
        expect(Exit.isFailure(exit)).toBe(true)
      }

      expect(await readFile(sentinel, "utf8")).toBe("unchanged\n")
      expect(await readdir(sandboxes)).toEqual([])
    }))

  it("rejects symlinked or out-of-/tmp parents and an escaping mkdtemp result", async () =>
    withFixture(async ({ outer, source, sandboxes, external }) => {
      await materialize(source)
      const manifest = await decodeManifest(manifestDocument())
      const linkedParent = join(outer, "linked-sandboxes")
      await symlink(sandboxes, linkedParent)

      for (const service of [
        makeTrialCandidateSandbox({ tempParent: linkedParent }),
        makeTrialCandidateSandbox({ tempParent: "/mnt/models/dev/ts-release" })
      ]) {
        const exit = await createExit(service, source, manifest)
        expect(Exit.isFailure(exit)).toBe(true)
      }

      const sentinel = join(external, "do-not-remove.txt")
      await writeFile(sentinel, "present\n")
      const escaping = makeTrialCandidateSandbox({
        tempParent: sandboxes,
        fileSystem: { mkdtemp: async () => external }
      })
      const escapeExit = await createExit(escaping, source, manifest)
      expect(Exit.isFailure(escapeExit)).toBe(true)
      expect(await readFile(sentinel, "utf8")).toBe("present\n")
      expect(await readdir(sandboxes)).toEqual([])
    }))

  it("uses the typed error channel for invalid isolation requests", async () =>
    withFixture(async ({ source, sandboxes }) => {
      await materialize(source)
      const manifest = await decodeManifest(manifestDocument())
      const service = makeTrialCandidateSandbox({ tempParent: sandboxes })
      const error = await Effect.runPromise(
        Effect.scoped(service.create({ candidateRoot: `${source}/../source`, manifest })).pipe(Effect.flip)
      )

      expect(error).toBeInstanceOf(TrialCandidateSandboxError)
      expect(error._tag).toBe("TrialCandidateSandboxError")
      expect(error.operation).toBe("validate")
    }))
})
