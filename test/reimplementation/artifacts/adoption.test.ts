import { expect, test } from "bun:test"
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect, FileSystem, Schema, type Crypto, type Path } from "effect"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as Apple from "effect-build-apple"
import { adoptFile, adoptTree, restoreTree } from "../../../packages/ts-release/src/EffectBuild.js"
import {
  AdoptionError,
  Content,
  encodeBundle,
  finalize,
  loadBundle,
} from "../../../packages/ts-release/src/Bundle.js"
import { fileContentOwner } from "../../../packages/ts-release/src/Node.js"
import { manifestSha256, producedBy } from "./tree-fixture.js"

const run = <A, E>(
  effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path | Crypto.Crypto>,
) => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))
const fixture = async (
  body: (root: string, owner: ReturnType<typeof fileContentOwner>) => Promise<void>,
) => {
  const root = await mkdtemp(join(tmpdir(), "release-producer-adoption-"))
  try {
    await body(root, fileContentOwner(join(root, "objects")))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
const fileAt = async (root: string) => {
  const path = join(root, "producer.txt")
  await writeFile(path, "owned bytes")
  return run(Artifact.file(path, producedBy))
}
const treeAt = async (root: string) => {
  const path = join(root, "producer-tree")
  await Bun.write(join(path, "bin/run"), "owned bytes")
  await chmod(join(path, "bin/run"), 0o755)
  await chmod(join(path, "bin"), 0o750)
  await Bun.write(join(path, "copy"), "owned bytes")
  await symlink("bin/run", join(path, "link"))
  return run(Artifact.directory(path, producedBy))
}

for (const [runtime, services] of [
  ["Bun", BunServices.layer],
  ["Node", NodeServices.layer],
] as const) {
  const runOn: typeof run = (effect) => Effect.runPromise(effect.pipe(Effect.provide(services)))

  for (const kind of ["file", "empty-directory", "directory", "dangling-link"] as const)
    test(`${runtime} restoration preserves a ${kind} created at the destination claim`, () =>
      fixture(async (root, owner) => {
        const source = await treeAt(root)
        const tree = await runOn(adoptTree(owner, "tree", source))
        // Refusal must also clean staged directories whose final modes are read-only.
        const readOnlyTree = {
          ...tree,
          rootMode: 0o555,
        }
        const destination = join(root, "restored")
        let originalInode: number | undefined
        const restore = Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          const raced: FileSystem.FileSystem = {
            ...fs,
            makeDirectory: (path, options) =>
              Effect.gen(function* () {
                if (path === destination) {
                  yield* Effect.promise(async () => {
                    if (kind === "file") await writeFile(destination, "other writer")
                    else if (kind === "dangling-link") await symlink("missing-target", destination)
                    else {
                      await mkdir(destination)
                      if (kind === "directory")
                        await writeFile(join(destination, "keep.txt"), "other writer")
                    }
                    originalInode = (await lstat(destination)).ino
                  })
                }
                return yield* fs.makeDirectory(path, options)
              }),
          }
          return yield* restoreTree(owner, readOnlyTree, destination).pipe(
            Effect.provideService(FileSystem.FileSystem, raced),
          )
        })
        await expect(runOn(restore)).rejects.toThrow("Restore destination already exists")
        if (originalInode === undefined) throw new Error("Destination claim was not exercised")
        expect((await lstat(destination)).ino).toBe(originalInode)
        if (kind === "file") expect(await readFile(destination, "utf8")).toBe("other writer")
        else if (kind === "dangling-link")
          expect(await readlink(destination)).toBe("missing-target")
        else expect(await readdir(destination)).toEqual(kind === "directory" ? ["keep.txt"] : [])
        expect(
          (await readdir(root)).filter((name) => name.startsWith(".ts-release-restore-")),
        ).toEqual([])
      }))

  test(`${runtime} restoration never removes a destination populated before the final rename`, () =>
    fixture(async (root, owner) => {
      const source = await treeAt(root)
      const tree = await runOn(adoptTree(owner, "tree", source))
      const destination = join(root, "restored")
      const restore = Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        return yield* restoreTree(owner, tree, destination).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (from, to) =>
              Effect.gen(function* () {
                if (to === destination)
                  yield* fs.writeFileString(join(destination, "keep.txt"), "other writer")
                return yield* fs.rename(from, to)
              }),
          }),
        )
      })
      await expect(runOn(restore)).rejects.toThrow()
      expect(await readFile(join(destination, "keep.txt"), "utf8")).toBe("other writer")
      expect(await readdir(destination)).toEqual(["keep.txt"])
      expect(
        (await readdir(root)).filter((name) => name.startsWith(".ts-release-restore-")),
      ).toEqual([])
    }))
}

test("restoration refuses an existing dangling destination without replacing its link", () =>
  fixture(async (root, owner) => {
    const source = await treeAt(root)
    const tree = await run(adoptTree(owner, "tree", source))
    const destination = join(root, "restored")
    await symlink("missing-target", destination)
    await expect(run(restoreTree(owner, tree, destination))).rejects.toThrow(
      "Restore destination already exists",
    )
    expect(await readlink(destination)).toBe("missing-target")
  }))

test("restoration preserves owned modes and links, refuses occupied destinations and corrupt reads", () =>
  fixture(async (root, owner) => {
    const produced = await treeAt(root)
    const owned = await run(adoptTree(owner, "tree", produced))
    await rm(produced.path, { recursive: true })
    const destination = join(root, "restored")
    const restored = await run(restoreTree(owner, owned, destination))
    expect(restored.path).toBe(destination)
    expect(restored.sha256).toBe(owned.sha256)
    expect(restored.bytes).toBe(owned.bytes)
    expect((await stat(join(destination, "bin"))).mode & 0o777).toBe(0o750)
    expect((await stat(join(destination, "bin/run"))).mode & 0o777).toBe(0o755)
    expect(await readlink(join(destination, "link"))).toBe("bin/run")
    await expect(run(restoreTree(owner, owned, destination))).rejects.toThrow(
      "Restore destination already exists",
    )
    const corrupt = join(root, "corrupt")
    await expect(
      run(
        restoreTree(
          { ...owner, read: () => Effect.succeed(new TextEncoder().encode("wrong bytes")) },
          owned,
          corrupt,
        ),
      ),
    ).rejects.toMatchObject({ _tag: "AdoptionError" })
    await expect(stat(corrupt)).rejects.toMatchObject({ code: "ENOENT" })
    // A read-only root is restored faithfully: the mode is applied after the entries.
    const readOnly = await run(
      restoreTree(owner, { ...owned, rootMode: 0o555 } as typeof owned, join(root, "read-only")),
    )
    expect(readOnly.rootMode).toBe(0o555)
    await chmod(join(root, "read-only"), 0o755)
    expect((await readdir(root)).filter((name) => name.startsWith(".ts-release-restore-"))).toEqual(
      [],
    )
  }))

test("produced files and directories become path-free owned Bundle content before producer deletion", () =>
  fixture(async (root, owner) => {
    const source = await fileAt(root),
      tree = await treeAt(root)
    const file = await run(adoptFile(owner, "file.txt", source))
    const owned = await run(adoptTree(owner, "tree", tree))
    expect(file.content).toEqual(new Content({ bytes: 11, sha256: source.sha256 }))
    expect(file.deliveryMode).toBe(0o644)
    expect(file.executable).toBeNull()
    expect(file.producedBy).toEqual(producedBy)
    expect(owned.rootMode).toBe(tree.rootMode)
    expect(owned.bytes).toBe(22)
    expect(owned.entries.map((entry) => [entry.kind, entry.path])).toEqual([
      ["directory", "bin"],
      ["file", "bin/run"],
      ["file", "copy"],
      ["symlink", "link"],
    ])
    expect(owned.entries[0]).toMatchObject({ mode: 0o750 })
    expect(owned.entries[1]).toMatchObject({ mode: 0o755 })
    expect(owned.entries[3]).toMatchObject({ linkTarget: "bin/run" })
    // The owned identity is effect-build's manifest digest, reproduced by the test fixture.
    expect(owned.sha256).toBe(tree.sha256)
    expect(manifestSha256(tree.entries)).toBe(tree.sha256)
    expect(await readdir(join(root, "objects"))).toEqual([source.sha256])
    const bundle = await run(finalize([file, owned])),
      bytes = encodeBundle(bundle)
    expect(new TextDecoder().decode(bytes)).not.toContain(root)
    expect(Object.isFrozen(file.content)).toBe(true)
    expect(Object.isFrozen(owned.entries)).toBe(true)
    await rm(source.path)
    await rm(tree.path, { recursive: true })
    const reopened = fileContentOwner(join(root, "objects"))
    expect(await run(loadBundle(reopened, bytes))).toEqual(bundle)
    expect(new TextDecoder().decode(await run(reopened.read(file.content)))).toBe("owned bytes")
  }))

test("adoption rejects changed sources and forged identities while preserving the earlier owned copy", () =>
  fixture(async (root, owner) => {
    const source = await fileAt(root),
      tree = await treeAt(root)
    const file = await run(adoptFile(owner, "safe", source))
    await chmod(source.path, 0o600)
    await writeFile(source.path, "evil bytes!")
    await expect(run(adoptFile(owner, "changed", source))).rejects.toThrow()
    await expect(run(adoptFile(owner, "huge", { ...source, bytes: 2 ** 53 }))).rejects.toThrow()
    await chmod(join(tree.path, "bin/run"), 0o600)
    await writeFile(join(tree.path, "bin/run"), "changed bytes")
    await expect(run(adoptTree(owner, "changed", tree))).rejects.toThrow()
    await writeFile(join(tree.path, "bin/run"), new Uint8Array(128 * 1024))
    const attempts: { path: string; bytes: number }[] = []
    const counting = {
      ...owner,
      putFileOwned: (input: { path: string; bytes: number; sha256: string }) => {
        attempts.push(input)
        return owner.putFileOwned(input)
      },
    }
    await expect(run(adoptTree(counting, "grown", tree))).rejects.toMatchObject({
      _tag: "AdoptionError",
    })
    expect(attempts.some((input) => input.path.endsWith("bin/run") && input.bytes === 11)).toBe(
      true,
    )
    expect(new TextDecoder().decode(await run(owner.read(file.content)))).toBe("owned bytes")
    expect(
      (await readdir(join(root, "objects"))).filter((name) => name.startsWith(".copy-")),
    ).toEqual([])
  }))

test("invalid producer metadata, tree graphs and identities reject before any copy", () =>
  fixture(async (root, owner) => {
    const tree = await treeAt(root),
      file = await fileAt(root)
    let writes = 0
    const unused = {
      ...owner,
      putFileOwned: () =>
        Effect.sync(() => {
          writes++
          return new Content({ bytes: 0, sha256: "0".repeat(64) })
        }),
    }
    const invalidTrees = [
      { ...tree, sha256: "0".repeat(64) },
      {
        ...tree,
        entries: tree.entries.map((entry) =>
          entry.kind === "file" ? { ...entry, mode: 0o600 } : entry,
        ),
      },
      { ...tree, entries: [...tree.entries, tree.entries[0]!] },
      {
        ...tree,
        entries: tree.entries.map((entry) =>
          entry.kind === "symlink" ? { ...entry, linkTarget: "../../outside" } : entry,
        ),
      },
      { ...tree, bytes: 2 ** 53 },
      { ...tree, rootMode: 0o10000 },
    ]
    for (const input of invalidTrees)
      await expect(
        run(adoptTree(unused, "tree", input as Artifact.Directory)),
      ).rejects.toBeInstanceOf(AdoptionError)
    for (const input of [
      { ...file, kind: "blob" },
      { ...file, kind: "executable" },
      { ...file, path: "" },
    ])
      await expect(run(adoptFile(unused, "file", input as Artifact.File))).rejects.toThrow()
    for (const name of ["../unsafe", "é.txt", "/absolute", "back\\slash"])
      await expect(run(adoptFile(unused, name, file))).rejects.toThrow()
    const accessor = Object.defineProperty({ ...file }, "sha256", {
      get: () => {
        throw new Error("must not be invoked")
      },
      enumerable: true,
    })
    await expect(run(adoptFile(unused, "file", accessor))).rejects.toThrow("must be plain data")
    expect(writes).toBe(0)
  }))

test("source record aliases and content-owner mismatches cannot alter the adopted identity", () =>
  fixture(async (root, owner) => {
    const source = structuredClone(await fileAt(root))
    const tamper = {
      ...owner,
      putFileOwned: (captured: { path: string; bytes: number; sha256: string }) =>
        Effect.gen(function* () {
          expect(Object.isFrozen(captured)).toBe(true)
          ;(source as { bytes: number }).bytes = 2 ** 53
          return yield* owner.putFileOwned(captured)
        }),
    }
    expect((await run(adoptFile(tamper, "file", source))).content.bytes).toBe(11)
    const wrong = {
      ...owner,
      putFileOwned: () => Effect.succeed(new Content({ bytes: 0, sha256: "0".repeat(64) })),
    }
    const native = await treeAt(root)
    await expect(run(adoptTree(wrong, "tree", native))).rejects.toThrow("differs from its manifest")
    await expect(run(adoptFile(wrong, "file", { ...source, bytes: 11 }))).rejects.toThrow(
      "differs from its producer",
    )
  }))

test("provider refinements stay outside Bundle ownership while core identity is retained", () =>
  fixture(async (root, owner) => {
    // Real records with deliberately non-native signature refinements. This
    // proves the admission shape, never Apple signing.
    const file = await fileAt(root),
      tree = await treeAt(root)
    const signature = { certificateSha1: "0".repeat(40), secureTimestamp: true as const }
    const dmg = { ...file, product: "dmg" as const, signature }
    expect(await run(adoptFile(owner, "file", dmg))).toEqual(
      await run(adoptFile(owner, "file", file)),
    )
    const app = {
      ...tree,
      product: "app" as const,
      signature: { ...signature, hardenedRuntime: true as const },
    }
    expect(Schema.is(Apple.SignedApp)(app)).toBe(true)
    expect(await run(adoptTree(owner, "tree", app))).toEqual(
      await run(adoptTree(owner, "tree", tree)),
    )
    class ExternalEvidence {
      optional = undefined
      callback = () => "never invoked"
    }
    const external = { ...file, runtime: new ExternalEvidence(), extension: new ExternalEvidence() }
    expect(await run(adoptFile(owner, "file", external))).toEqual(
      await run(adoptFile(owner, "file", file)),
    )
    let gets = 0
    const getter = {
      enumerable: true,
      get: () => {
        gets++
        return "must not execute"
      },
    }
    expect(
      await run(adoptFile(owner, "file", Object.defineProperty({ ...file }, "extension", getter))),
    ).toEqual(await run(adoptFile(owner, "file", file)))
    const producer = Object.defineProperty({ ...file.producedBy }, "path", getter)
    await expect(
      run(adoptFile(owner, "file", { ...file, producedBy: producer })),
    ).rejects.toBeInstanceOf(AdoptionError)
    expect(gets).toBe(0)
  }))
