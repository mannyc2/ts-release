import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { chmod, mkdtemp, readdir, readlink, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect, FileSystem, type Crypto, type Path } from "effect"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Artifact from "effect-build/Artifact"
import * as ProducerFile from "effect-build/Author/File"
import * as ProducerTree from "effect-build/Author/Tree"
import type * as Tool from "effect-build/Author/Tool"
import * as AppleModel from "effect-build-apple/Model"
import { adoptFile, adoptTree, restoreTree } from "../../../packages/ts-release/src/EffectBuild.js"
import {
  AdoptionError,
  Content,
  encodeBundle,
  finalize,
  loadBundle,
} from "../../../packages/ts-release/src/Bundle.js"
import { fileContentOwner, nodeDirectoryReader } from "../../../packages/ts-release/src/Node.js"

const provenance = Artifact.intrinsicProvenance("production-adoption/native-source")
const run = <A, E>(
  effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path | Crypto.Crypto>,
) => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))
const fixture = async (
  body: (root: string, owner: ReturnType<typeof fileContentOwner>) => Promise<void>,
) => {
  const root = await mkdtemp(join(tmpdir(), "release-producer-adoption-"))
  try {
    await body(
      root,
      fileContentOwner(
        join(root, "objects"),
        nodeDirectoryReader(process.env.TS_RELEASE_HTTP_PEER_NODE ?? "/usr/bin/node"),
      ),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
const fileAt = (root: string, selected: Artifact.Provenance = provenance) =>
  ProducerFile.publish(
    { destination: join(root, "producer.txt"), observation: "hashed", provenance: selected },
    (candidate) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString(candidate, "owned bytes")
      }),
  )
const treeAt = (root: string, selected: Artifact.Provenance = provenance) =>
  ProducerTree.publish(
    { outdir: join(root, "producer-tree"), observation: "hashed", provenance: selected },
    (candidate) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        yield* fs.makeDirectory(join(candidate, "bin"))
        yield* fs.chmod(join(candidate, "bin"), 0o750)
        yield* fs.writeFileString(join(candidate, "bin/run"), "owned bytes")
        yield* fs.chmod(join(candidate, "bin/run"), 0o755)
        yield* fs.writeFileString(join(candidate, "copy"), "owned bytes")
        yield* fs.symlink("bin/run", join(candidate, "link"))
      }),
  )

test(
  "public restoration preserves owned modes and links, rejects corrupt reads and unsupported roots before publication",
  () =>
    fixture(async (root, owner) => {
      const produced = await run(treeAt(root))
      const owned = await run(adoptTree(owner, "tree", produced))
      await rm(produced.root, { recursive: true })
      const destination = join(root, "restored")
      const restored = await run(restoreTree(owner, owned, destination, provenance))
    expect(String(restored.manifestDigest.value)).toBe(owned.upstreamManifestSha256)
    expect(String(restored.totalBytes)).toBe(owned.totalBytes)
      expect((await stat(join(destination, "bin"))).mode & 0o777).toBe(0o750)
      expect((await stat(join(destination, "bin/run"))).mode & 0o777).toBe(0o755)
      expect(await readlink(join(destination, "link"))).toBe("bin/run")
      await expect(run(restoreTree(owner, owned, destination, provenance))).rejects.toMatchObject({
        _tag: "TreeDestinationLocked",
      })
      const corrupt = join(root, "corrupt")
      await expect(
        run(
          restoreTree(
            { ...owner, read: () => Effect.succeed(new TextEncoder().encode("wrong bytes")) },
            owned,
            corrupt,
            provenance,
          ),
        ),
      ).rejects.toMatchObject({ _tag: "AdoptionError" })
      await expect(stat(corrupt)).rejects.toMatchObject({ code: "ENOENT" })
      let reads = 0
      await expect(
        run(
          restoreTree(
            {
              ...owner,
              read: () => {
                reads++
                return Effect.succeed(new Uint8Array())
              },
            },
            { ...owned, rootMode: Artifact.fileMode(0o555) },
            join(root, "unsupported"),
            provenance,
          ),
        ),
      ).rejects.toMatchObject({
        _tag: "AdoptionError",
        reason: "effect-build 0.6.3 restores only 0755 tree roots",
      })
      expect(reads).toBe(0)
      expect((await readdir(root)).filter((name) => name.startsWith(".effect-build"))).toEqual([])
    }),
  30_000,
)

test("actual finalized files and trees become path-free owned Bundle content before producer deletion", () =>
  fixture(async (root, owner) => {
    const source = await run(fileAt(root)),
      tree = await run(treeAt(root))
    const file = await run(adoptFile(owner, "file.txt", source))
    const owned = await run(adoptTree(owner, "tree", tree))
    expect(file.content).toEqual(new Content({ bytes: "11", sha256: source.digest.value }))
    expect(Number(file.deliveryMode)).toBe(0o644)
    expect(file.executable).toBeNull()
    expect(file.provenance).toEqual(provenance)
    expect(owned.rootMode).toBe(tree.rootMode)
    expect(owned.totalBytes).toBe("22")
    expect(owned.entries.map((entry) => [entry._tag, String(entry.relativePath)])).toEqual([
      ["TreeDirectory", "bin"],
      ["TreeFile", "bin/run"],
      ["TreeFile", "copy"],
      ["TreeLink", "link"],
    ])
    expect(owned.entries[0]).toMatchObject({ mode: 0o750 })
    expect(owned.entries[1]).toMatchObject({ mode: 0o755 })
    expect(owned.entries[3]).toMatchObject({ target: "bin/run" })
    expect(owned.upstreamManifestSha256).toBe(
      createHash("sha256")
        .update(
          JSON.stringify({
            rootMode: tree.rootMode,
            totalBytes: tree.totalBytes,
            entries: tree.entries,
          }),
        )
        .digest("hex"),
    )
    expect(await readdir(join(root, "objects"))).toEqual([source.digest.value])
    const bundle = await run(finalize([file, owned])),
      bytes = encodeBundle(bundle)
    expect(new TextDecoder().decode(bytes)).not.toContain(root)
    expect(Object.isFrozen(file.content)).toBe(true)
    expect(Object.isFrozen(owned.entries)).toBe(true)
    await rm(source.path)
    await rm(tree.root, { recursive: true })
    const reopened = fileContentOwner(
      join(root, "objects"),
      nodeDirectoryReader(process.env.TS_RELEASE_HTTP_PEER_NODE ?? "/usr/bin/node"),
    )
    expect(await run(loadBundle(reopened, bytes))).toEqual(bundle)
    expect(new TextDecoder().decode(await run(reopened.read(file.content)))).toBe("owned bytes")
  }))

test("adoption rejects source changes and forged identity while preserving the earlier owned copy", () =>
  fixture(async (root, owner) => {
    const source = await run(fileAt(root)),
      tree = await run(treeAt(root))
    const file = await run(adoptFile(owner, "safe", source))
    await chmod(source.path, 0o600)
    await writeFile(source.path, "evil bytes!")
    await expect(run(adoptFile(owner, "changed", source))).rejects.toThrow()
    await expect(
      run(
        adoptFile(owner, "huge", { ...source, bytes: Artifact.decimalBytes("9007199254740993") }),
      ),
    ).rejects.toThrow()
    await chmod(join(tree.root, "bin/run"), 0o600)
    await writeFile(join(tree.root, "bin/run"), "changed bytes")
    await expect(run(adoptTree(owner, "changed", tree))).rejects.toThrow()
    await writeFile(join(tree.root, "bin/run"), new Uint8Array(128 * 1024))
    const attempts: Artifact.HashedFileIdentity[] = []
    const counting = {
      ...owner,
      putFileOwned: (input: Artifact.HashedFileIdentity) => {
        attempts.push(input)
        return owner.putFileOwned(input)
      },
    }
    await expect(run(adoptTree(counting, "grown", tree))).rejects.toMatchObject({
      _tag: "TreeVerificationFailed",
    })
    expect(
      attempts.some((input) => String(input.path).endsWith("bin/run") && input.bytes === "11"),
    ).toBe(true)
    expect(new TextDecoder().decode(await run(owner.read(file.content)))).toBe("owned bytes")
    expect(
      (await readdir(join(root, "objects"))).filter((name) => name.startsWith(".copy-")),
    ).toEqual([])
  }))

test("invalid producer metadata, tree graph and capacity reject before destination or filesystem services", () =>
  fixture(async (root, owner) => {
    const tree = await run(treeAt(root)),
      file = await run(fileAt(root))
    let writes = 0
    const unused = {
      ...owner,
      putFileOwned: () =>
        Effect.sync(() => {
          writes++
          return new Content({ bytes: "0", sha256: "0".repeat(64) })
        }),
    }
    const invalidTrees = [
      { ...tree, manifestDigest: Artifact.sha256Digest("0".repeat(64)) },
      {
        ...tree,
        entries: tree.entries.map((entry) =>
          entry.kind === "file" ? { ...entry, mode: Artifact.fileMode(0o600) } : entry,
        ),
      },
      { ...tree, entries: [...tree.entries, tree.entries[0]!] },
      {
        ...tree,
        entries: tree.entries.map((entry) =>
          entry.kind === "symbolic-link" ? { ...entry, target: "../../outside" } : entry,
        ),
      },
      { ...tree, totalBytes: Artifact.decimalBytes("9007199254740993") },
      { ...tree, entries: Array.from({ length: 100001 }, () => tree.entries[0]!) },
    ]
    for (const input of invalidTrees) {
      const result = await Effect.runPromise(
        adoptTree(unused, "tree", input).pipe(
          Effect.catch((error) => Effect.succeed(error)),
        ) as Effect.Effect<unknown>,
      )
      expect(result).toBeInstanceOf(AdoptionError)
    }
    for (const input of [
      { ...file, _tag: "UnhashedFile" },
      { ...file, publication: { ...file.publication, committed: false } },
    ])
      await expect(run(adoptFile(unused, "file", input as Artifact.HashedFile))).rejects.toThrow()
    for (const name of ["../unsafe", "e\u0301.txt"])
      await expect(run(adoptFile(unused, name, file))).rejects.toThrow()
    const hidden = Object.defineProperty({ ...file }, "secret", {
      get: () => {
        throw new Error("credential")
      },
      enumerable: true,
    })
    await expect(run(adoptFile(unused, "file", hidden))).rejects.toThrow(
      "Artifact data could not be admitted",
    )
    expect(writes).toBe(0)
  }))

test("source metadata aliases and content-owner mismatches cannot alter adopted identity", () =>
  fixture(async (root, owner) => {
    const source = structuredClone(await run(fileAt(root)))
    const tamper = {
      ...owner,
      putFileOwned: (captured: Artifact.HashedFileIdentity) =>
        Effect.gen(function* () {
          expect(Object.isFrozen(captured)).toBe(true)
          ;(source as { bytes: string }).bytes = "9007199254740993"
          return yield* owner.putFileOwned(captured)
        }),
    }
    expect((await run(adoptFile(tamper, "file", source))).content.bytes).toBe("11")
    const wrong = {
      ...owner,
      putFileOwned: () => Effect.succeed(new Content({ bytes: "0", sha256: "0".repeat(64) })),
    }
    const native = await run(treeAt(root))
    await expect(run(adoptTree(wrong, "tree", native))).rejects.toMatchObject({
      _tag: "TreeVerificationFailed",
    })
    await expect(
      run(adoptFile(wrong, "file", { ...source, bytes: Artifact.decimalBytes("11") })),
    ).rejects.toThrow("differs from its producer")
  }))

test("verified tree snapshot cleanup retains readable permissions and closes private roots", () =>
  fixture(async (root, owner) => {
    const source = await run(treeAt(root))
    const snapshots: string[] = []
    await run(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const observed: FileSystem.FileSystem = {
          ...fs,
          makeTempDirectory: (options) =>
            fs.makeTempDirectory({ ...options, directory: root }).pipe(
              Effect.tap((path) =>
                Effect.sync(() => {
                  snapshots.push(path)
                }),
              ),
            ),
        }
        yield* adoptTree(owner, "tree", source).pipe(
          Effect.provideService(FileSystem.FileSystem, observed),
        )
      }),
    )
    expect(snapshots.length).toBeGreaterThan(0)
    for (const path of snapshots) expect(await Bun.file(join(path, "bin/run")).exists()).toBe(false)
    expect(
      (await readdir(root)).filter((name) => name.startsWith("effect-build-tree-snapshot-")),
    ).toEqual([])
  }))

test("public artifact subtypes retain core identity while native class extensions remain outside Bundle ownership", () =>
  fixture(async (root, owner) => {
    // Real finalization and native API classes, with deliberately non-native
    // signature observations. This proves admission shape, never Apple signing.
    const observation = <Name extends string>(name: Name): Tool.Observation<Name> => ({
      name,
      participants: [
        {
          role: "API-shape-only",
          name,
          version: "fixture-only",
          revision: "fixture-only",
          channel: "fixture-only",
          content: {
            bytes: Artifact.decimalBytes("0"),
            digest: Artifact.sha256Digest("0".repeat(64)),
          },
        },
      ],
      capabilities: [],
    })
    const codesign = observation("codesign"),
      notarytool = observation("notarytool")
    const file = await run(fileAt(root, codesign)),
      tree = await run(treeAt(root, codesign))
    const signature = new AppleModel.DeveloperIdDiskImageSignature({
      architecture: "arm64",
      certificateSha1: "0".repeat(40),
      tool: codesign,
      secureTimestamp: true,
    })
    const ticket = new AppleModel.NotarizationTicket({
      submissionId: "00000000-0000-4000-8000-000000000001",
      submittedKind: "dmg",
      submittedBytes: file.bytes,
      submittedDigest: file.digest,
      targetKind: "dmg",
      targetIdentityKind: "file-bytes",
      targetBytes: file.bytes,
      targetDigest: file.digest,
      targetArchitecture: "arm64",
      submissionTool: notarytool,
      acceptanceTool: notarytool,
    })
    const extended = {
      ...file,
      architecture: "arm64" as const,
      signature,
      notarizationTicket: ticket,
    }
    expect(AppleModel.hasDeveloperIdDiskImageSignature(extended)).toBe(true)
    expect(await run(adoptFile(owner, "file", extended))).toEqual(
      await run(adoptFile(owner, "file", file)),
    )
    const app = {
      ...tree,
      architecture: "arm64" as const,
      signature: new AppleModel.DeveloperIdApplicationSignature({
        architecture: "arm64",
        certificateSha1: "0".repeat(40),
        tool: codesign,
        hardenedRuntime: true,
        secureTimestamp: true,
      }),
    }
    expect(AppleModel.hasDeveloperIdApplicationSignature(app)).toBe(true)
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
    let gets = 0,
      writes = 0
    const unused = {
      ...owner,
      putFileOwned: (input: Artifact.HashedFileIdentity) => {
        writes++
        return owner.putFileOwned(input)
      },
    }
    const getter = {
      enumerable: true,
      get: () => {
        gets++
        return "must not execute"
      },
    }
    for (const invalid of [
      Object.defineProperty({ ...file }, "extension", getter),
      Object.defineProperty({ ...file }, "hidden", { value: "hidden" }),
      { ...file, [Symbol("extension")]: "hidden" },
      { ...file, digest: Object.defineProperty({ ...file.digest }, "value", getter) },
      { ...file, provenance: Object.defineProperty({ ...file.provenance }, "extension", getter) },
    ])
      await expect(run(adoptFile(unused, "file", invalid))).rejects.toBeInstanceOf(AdoptionError)
    expect(gets).toBe(0)
    expect(writes).toBe(0)
  }))
