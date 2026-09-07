import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { chmod, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, FileSystem, Schema } from "effect"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Artifact from "effect-build/Artifact"
import * as Producer from "effect-build/Author/File"
import * as ProducerTree from "effect-build/Author/Tree"
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

const provenance = Artifact.intrinsicProvenance("kernel-test/source-bytes")
const fileFor = (content: Content) =>
  new File({
    logicalName: Artifact.portableRelativePath("artifact.txt"),
    content,
    deliveryMode: Artifact.fileMode(0o644),
    executable: null,
    provenance,
  })
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
    const source = await Effect.runPromise(
      Producer.publish(
        {
          destination: join(root, "producer.txt"),
          observation: "hashed",
          provenance,
        },
        (path) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem
            yield* fs.writeFileString(path, "exact owned bytes")
          }),
      ).pipe(Effect.provide(BunServices.layer)),
    )
    const content = await Effect.runPromise(owner.putFileOwned(source))
    expect(content.sha256).toBe(source.digest.value)
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
      Effect.runPromise(owner.read(new Content({ bytes: "536870913", sha256: content.sha256 }))),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(owner.read({ ...content, sha256: "../outside" } as Content)),
    ).rejects.toThrow()
  }))

test("bundle wire data rejects legacy, extra, noncanonical and duplicate identities before content IO", () =>
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
      encoded.replace("ts-release/bundle/1", "lab/owned-bundle/1"),
      encoded.replace('"artifacts":', '"extra":true,"artifacts":'),
      encoded + "\n",
      encoded.replace('"format":', '"format":"ts-release/bundle/1","format":'),
      encoded.replace("artifact.txt", "e\u0301.txt"),
    ])
      await expect(
        Effect.runPromise(loadBundle(counting, new TextEncoder().encode(text))),
      ).rejects.toThrow()
    await expect(Effect.runPromise(finalize([file, file]))).rejects.toThrow()
    expect(verifications).toBe(0)
  }))

test("tree metadata preserves ordered upstream identity and rejects unsafe graphs before IO", () =>
  fixture(async (_root, owner) => {
    const content = await Effect.runPromise(owner.putOwned(new Uint8Array([1])))
    const native = {
      rootMode: 0o755,
      totalBytes: "1",
      entries: [
        {
          kind: "file",
          relativePath: "file",
          mode: 0o644,
          bytes: "1",
          digest: { algorithm: "sha256", value: content.sha256 },
        },
        { kind: "symbolic-link", relativePath: "link", target: "file" },
      ],
    }
    const value = {
      format: "ts-release/bundle/1",
      artifacts: [
        {
          _tag: "OwnedTree",
          logicalName: "tree",
          rootMode: native.rootMode,
          totalBytes: native.totalBytes,
          upstreamManifestSha256: createHash("sha256").update(JSON.stringify(native)).digest("hex"),
          entries: [
            { _tag: "TreeFile", relativePath: "file", mode: 0o644, content },
            { _tag: "TreeLink", relativePath: "link", target: "file" },
          ],
          provenance,
        },
      ],
    }
    const encode = (input: unknown) => encodeBundle(Schema.decodeUnknownSync(Bundle)(input))
    expect((await Effect.runPromise(loadBundle(owner, encode(value)))).artifacts).toHaveLength(1)
    let verifications = 0
    const counting = {
      ...owner,
      verify: () =>
        Effect.sync(() => {
          verifications++
        }),
    }
    for (const target of [
      "../../outside",
      "link",
      "missing",
      "C:/outside",
      "/outside",
      "file/child",
    ]) {
      const changed = structuredClone(value)
      changed.artifacts[0]!.entries[1]!.target = target
      await expect(Effect.runPromise(loadBundle(counting, encode(changed)))).rejects.toThrow()
      await expect(
        Effect.runPromise(finalize(Schema.decodeUnknownSync(Bundle)(changed).artifacts)),
      ).rejects.toThrow()
    }
    const changed = structuredClone(value)
    changed.artifacts[0]!.upstreamManifestSha256 = "0".repeat(64)
    await expect(Effect.runPromise(loadBundle(counting, encode(changed)))).rejects.toThrow()
    expect(verifications).toBe(0)
  }))

test("tree links expand before parent traversal and native UTF-8 order is preserved", () =>
  fixture(async (root, owner) => {
    const tree = await Effect.runPromise(
      ProducerTree.publish(
        {
          outdir: join(root, "native-tree"),
          observation: "hashed",
          provenance,
        },
        (path) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem
            yield* fs.writeFileString(join(path, "\ue000"), "a")
            yield* fs.writeFileString(join(path, "\u{10000}"), "a")
          }),
      ).pipe(Effect.provide(BunServices.layer)),
    )
    expect(tree.entries.map((entry) => String(entry.relativePath))).toEqual(["\ue000", "\u{10000}"])
    const content = await Effect.runPromise(owner.putOwned(new TextEncoder().encode("a")))
    const value = {
      format: "ts-release/bundle/1",
      artifacts: [
        {
          _tag: "OwnedTree",
          logicalName: "tree",
          rootMode: tree.rootMode,
          totalBytes: tree.totalBytes,
          upstreamManifestSha256: tree.manifestDigest.value,
          entries: tree.entries.map((entry) => ({
            _tag: "TreeFile",
            relativePath: entry.relativePath,
            mode: entry.kind === "file" ? entry.mode : 0,
            content,
          })),
          provenance,
        },
      ],
    }
    const bundle = await Effect.runPromise(
      finalize(Schema.decodeUnknownSync(Bundle)(value).artifacts),
    )
    expect(
      (await Effect.runPromise(loadBundle(owner, encodeBundle(bundle)))).artifacts,
    ).toHaveLength(1)
    const links = {
      format: "ts-release/bundle/1",
      artifacts: [
        {
          _tag: "OwnedTree",
          logicalName: "links",
          rootMode: 0o755,
          totalBytes: "0",
          upstreamManifestSha256: "0".repeat(64),
          entries: [
            { _tag: "TreeLink", relativePath: "d", target: "." },
            { _tag: "TreeLink", relativePath: "s", target: "d/.." },
          ],
          provenance,
        },
      ],
    }
    const decoded = Schema.decodeUnknownSync(Bundle)(links)
    await expect(Effect.runPromise(finalize(decoded.artifacts))).rejects.toThrow("escapes tree")
    await expect(Effect.runPromise(loadBundle(owner, encodeBundle(decoded)))).rejects.toThrow(
      "escapes tree",
    )
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
