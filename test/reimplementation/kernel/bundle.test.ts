import { expect, test } from "bun:test"
import { chmod, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, FileSystem, Schema, type Crypto, type Path } from "effect"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Artifact from "effect-build/Artifact"
import {
  Bundle,
  Content,
  File,
  finalize,
  encodeBundle,
  loadBundle,
} from "../../../packages/ts-release/src/Bundle.js"
import { fileContentOwner } from "../../../packages/ts-release/src/Node.js"
import { createOperation, createPlan, loadPlan } from "../../../packages/ts-release/src/index.js"
import { ownedTree, producedBy, treeEntries } from "../artifacts/tree-fixture.js"

const fileFor = (content: Content) =>
  new File({
    logicalName: "artifact.txt",
    content,
    deliveryMode: 0o644,
    executable: null,
    producedBy,
  })
const run = <A, E>(
  effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path | Crypto.Crypto>,
) => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))
async function fixture(
  body: (root: string, owner: ReturnType<typeof fileContentOwner>) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "kernel-owned-bundle-"))
  try {
    await body(root, fileContentOwner(join(root, "objects")))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test("owned Bundle survives producer deletion and binds an immutable Plan", () =>
  fixture(async (root, owner) => {
    const produced = join(root, "producer.txt")
    await writeFile(produced, "exact owned bytes")
    const source = await run(Artifact.file(produced, producedBy))
    const content = await Effect.runPromise(owner.putFileOwned(source))
    expect(content.sha256).toBe(source.sha256)
    const artifacts = [fileFor(content)]
    const bundle = await Effect.runPromise(finalize(artifacts))
    artifacts.length = 0
    expect(bundle.artifacts).toHaveLength(1)
    expect(Object.isFrozen(bundle.artifacts[0])).toBe(true)
    const bytes = encodeBundle(bundle)
    expect(new TextDecoder().decode(bytes)).not.toContain(root)
    const bundleContent = await Effect.runPromise(owner.putOwned(bytes))
    const descriptor = {
      definitionId: "kernel-test/publish",
      intentVersion: "1",
      intentCodec: File,
    }
    const operation = await Effect.runPromise(createOperation(descriptor, bundle.artifacts[0]))
    const plan = await Effect.runPromise(createPlan(bundleContent.sha256, [operation]))
    await rm(source.path)
    const reopened = fileContentOwner(join(root, "objects"))
    const loaded = await Effect.runPromise(
      loadBundle(reopened, await Effect.runPromise(reopened.read(bundleContent))),
    )
    expect(loaded).toEqual(bundle)
    expect(await Effect.runPromise(loadPlan(plan, [descriptor]))).toEqual(plan)
    expect(new TextDecoder().decode(await Effect.runPromise(reopened.read(content)))).toBe(
      "exact owned bytes",
    )
  }))

test("buffer ownership, content collisions, symlinks and byte limits fail without replacement", () =>
  fixture(async (root, owner) => {
    const input = new Uint8Array([1, 2, 3])
    const pending = owner.putOwned(input)
    input[0] = 9
    const content = await Effect.runPromise(pending)
    expect(await Effect.runPromise(owner.read(content))).toEqual(new Uint8Array([1, 2, 3]))
    expect(await Effect.runPromise(owner.putOwned(new Uint8Array([1, 2, 3])))).toEqual(content)
    const stored = join(root, "objects", content.sha256)
    await chmod(stored, 0o600)
    await writeFile(stored, new Uint8Array([3, 2, 1]))
    await expect(Effect.runPromise(owner.verify(content))).rejects.toThrow()
    await expect(Effect.runPromise(owner.putOwned(new Uint8Array([1, 2, 3])))).rejects.toThrow()
    expect(
      (await readdir(join(root, "objects"))).filter((name) => name.startsWith(".copy-")),
    ).toEqual([])
    await rm(stored)
    const outside = join(root, "outside")
    await writeFile(outside, new Uint8Array([1, 2, 3]))
    await symlink(outside, stored)
    await expect(Effect.runPromise(owner.read(content))).rejects.toThrow()
    await expect(
      Effect.runPromise(owner.read(new Content({ bytes: 536870913, sha256: content.sha256 }))),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(owner.read({ ...content, sha256: "../outside" } as Content)),
    ).rejects.toThrow()
  }))

test("bundle wire data rejects retired, extra, noncanonical and duplicate identities before content IO", () =>
  fixture(async (_root, owner) => {
    const content = await Effect.runPromise(owner.putOwned(new Uint8Array([1])))
    const file = fileFor(content)
    const bundle = await Effect.runPromise(finalize([file]))
    let verifications = 0
    const counting = {
      ...owner,
      verify: () =>
        Effect.sync(() => {
          verifications++
        }),
    }
    const encoded = new TextDecoder().decode(encodeBundle(bundle))
    for (const text of [
      encoded.replace("ts-release/bundle/2", "lab/owned-bundle/2"),
      encoded.replace('"artifacts":', '"extra":true,"artifacts":'),
      encoded + "\n",
      encoded.replace('"format":', '"format":"ts-release/bundle/2","format":'),
      encoded.replace("artifact.txt", "e\u0301.txt"),
    ])
      await expect(
        Effect.runPromise(loadBundle(counting, new TextEncoder().encode(text))),
      ).rejects.toThrow()
    // A format 1 Bundle names the effect-build 0.6 model; it is refused by name, not by accident.
    const retired = encoded.replace("ts-release/bundle/2", "ts-release/bundle/1")
    await expect(
      Effect.runPromise(loadBundle(counting, new TextEncoder().encode(retired))),
    ).rejects.toThrow("ts-release/bundle/1 records effect-build 0.6 identities")
    await expect(Effect.runPromise(finalize([file, file]))).rejects.toThrow()
    expect(verifications).toBe(0)
  }))

test("tree metadata preserves the upstream manifest identity and rejects unsafe graphs before IO", () =>
  fixture(async (_root, owner) => {
    const content = await Effect.runPromise(owner.putOwned(new Uint8Array([1])))
    const tree = ownedTree("tree", [
      treeEntries.file("file", content),
      treeEntries.symlink("link", "file"),
    ])
    const value = new Bundle({ format: "ts-release/bundle/2", artifacts: [tree] })
    expect(
      (await Effect.runPromise(loadBundle(owner, encodeBundle(value)))).artifacts,
    ).toHaveLength(1)
    let verifications = 0
    const counting = {
      ...owner,
      verify: () =>
        Effect.sync(() => {
          verifications++
        }),
    }
    const withLink = (linkTarget: string) =>
      ownedTree("tree", [
        treeEntries.file("file", content),
        treeEntries.symlink("link", linkTarget),
      ])
    for (const target of [
      "../../outside",
      "link",
      "missing",
      "C:/outside",
      "/outside",
      "file/child",
    ]) {
      const changed = withLink(target)
      await expect(
        Effect.runPromise(
          loadBundle(counting, encodeBundle(new Bundle({ ...value, artifacts: [changed] }))),
        ),
      ).rejects.toThrow()
      await expect(Effect.runPromise(finalize([changed]))).rejects.toThrow()
    }
    const forged = Schema.decodeUnknownSync(Bundle)({
      ...Schema.encodeSync(Bundle)(value),
      artifacts: [{ ...Schema.encodeSync(Bundle)(value).artifacts[0], sha256: "0".repeat(64) }],
    })
    await expect(Effect.runPromise(loadBundle(counting, encodeBundle(forged)))).rejects.toThrow(
      "recorded tree identity",
    )
    expect(verifications).toBe(0)
  }))

test("tree links expand before parent traversal and upstream entry order is preserved", () =>
  fixture(async (root, owner) => {
    const native = join(root, "native-tree")
    await Bun.write(join(native, "\ue000"), "a")
    await Bun.write(join(native, "\u{10000}"), "a")
    const tree = await run(Artifact.directory(native, producedBy))
    expect(tree.entries.map((entry) => entry.path)).toEqual(["\u{10000}", "\ue000"])
    const content = await Effect.runPromise(owner.putOwned(new TextEncoder().encode("a")))
    const owned = ownedTree(
      "tree",
      tree.entries.map((entry) => treeEntries.file(entry.path, content, entry.mode)),
    )
    expect(owned.sha256).toBe(tree.sha256)
    const bundle = await Effect.runPromise(finalize([owned]))
    expect(
      (await Effect.runPromise(loadBundle(owner, encodeBundle(bundle)))).artifacts,
    ).toHaveLength(1)
    const links = ownedTree("links", [
      treeEntries.symlink("d", "."),
      treeEntries.symlink("s", "d/.."),
    ])
    await expect(Effect.runPromise(finalize([links]))).rejects.toThrow("escapes tree")
    await expect(
      Effect.runPromise(
        loadBundle(owner, encodeBundle(new Bundle({ ...bundle, artifacts: [links] }))),
      ),
    ).rejects.toThrow("escapes tree")
  }))

test("special-file inputs reject without waiting for another FIFO endpoint", () =>
  fixture(async (root, owner) => {
    const content = await Effect.runPromise(owner.putOwned(new Uint8Array([1])))
    const stored = join(root, "objects", content.sha256)
    await rm(stored)
    const fifo = Bun.spawn(["mkfifo", stored], { stdout: "pipe", stderr: "pipe" })
    expect(await fifo.exited).toBe(0)
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "content-runner.ts"),
        join(root, "objects"),
        content.sha256,
      ],
      { stdout: "pipe", stderr: "pipe" },
    )
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const exit = await Promise.race([
        child.exited,
        new Promise<"timeout">((resolve) => {
          timer = setTimeout(() => resolve("timeout"), 2000)
        }),
      ])
      expect(exit).toBe(0)
      expect(await new Response(child.stdout).text()).toContain('"rejected":3')
    } finally {
      clearTimeout(timer)
      child.kill()
      await child.exited
    }
  }))
