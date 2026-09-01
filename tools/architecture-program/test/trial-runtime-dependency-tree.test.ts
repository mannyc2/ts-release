import { Buffer } from "node:buffer"
import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile
} from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Result } from "effect"
import {
  RuntimeDependencyTreeError,
  inventoryRuntimeDependencyTree,
  sameRuntimeDependencyRootSnapshot
} from "../src/trial-runtime-dependency-tree.js"

const withRoot = async <A>(use: (root: string) => Promise<A>): Promise<A> => {
  const root = await mkdtemp("/tmp/trial-runtime-dependencies-")
  try {
    return await use(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const rawChildPath = (root: string, name: Uint8Array): Buffer =>
  Buffer.concat([Buffer.from(`${root}/`), Buffer.from(name)])

describe("runtime dependency tree v2", () => {
  it("hashes sorted regular bytes and .bin symlink target text with root identity", async () =>
    withRoot(async (root) => {
      await mkdir(join(root, ".bin"))
      await mkdir(join(root, "pkg"))
      await writeFile(join(root, "pkg/data.txt"), "data\n")
      await writeFile(join(root, "pkg/tool.mjs"), "export default 1\n")
      await chmod(join(root, "pkg/data.txt"), 0o644)
      await chmod(join(root, "pkg/tool.mjs"), 0o755)
      await symlink("../pkg/tool.mjs", join(root, ".bin/tool"))

      const first = await Effect.runPromise(inventoryRuntimeDependencyTree(root))
      const second = await Effect.runPromise(inventoryRuntimeDependencyTree(root))
      expect(first.inventory.entries.map((entry) => ({ ...entry }))).toEqual([
        { _tag: "SymbolicLink", path: ".bin/tool", target: "../pkg/tool.mjs" },
        {
          _tag: "RegularFile",
          path: "pkg/data.txt",
          mode: "100644",
          byteLength: 5,
          bytesSha256: "6667b2d1aab6a00caa5aee5af8ad9f1465e567abf1c209d15727d57b3e8f6e5f"
        },
        {
          _tag: "RegularFile",
          path: "pkg/tool.mjs",
          mode: "100755",
          byteLength: 17,
          bytesSha256: "7f91f377ddf291164013ac18d6e2098b2a9f02bacc02cfb6fc191cc205474858"
        }
      ])
      expect(first.inventory.treeSha256).toBe(second.inventory.treeSha256)
      expect(first.inventory.treeSha256).toBe(
        "ff05e9185bd59cf307f8639d45b56fdef33081fd4108faba3f9f14f9b06f79e5"
      )
      expect(sameRuntimeDependencyRootSnapshot(first.root, second.root)).toBe(true)
    }))

  it("rejects absolute and escaping symbolic-link targets", async () => {
    for (const target of ["/etc/passwd", "../../outside"]) {
      await withRoot(async (root) => {
        await mkdir(join(root, ".bin"))
        await symlink(target, join(root, ".bin/hostile"))
        const result = await Effect.runPromise(
          inventoryRuntimeDependencyTree(root).pipe(Effect.result)
        )
        expect(Result.isFailure(result)).toBe(true)
        if (Result.isFailure(result)) {
          expect(result.failure).toBeInstanceOf(RuntimeDependencyTreeError)
          expect(result.failure.reason).toMatch(/absolute|escapes/u)
        }
      })
    }
  })

  it("rejects invalid UTF-8 names instead of colliding them with U+FFFD", async () =>
    withRoot(async (root) => {
      await writeFile(rawChildPath(root, Uint8Array.of(0xff)), "INVALID\n")
      await writeFile(join(root, "�"), "VALID\n")
      const result = await Effect.runPromise(
        inventoryRuntimeDependencyTree(root).pipe(Effect.result)
      )
      expect(Result.isFailure(result)).toBe(true)
      if (Result.isFailure(result)) expect(result.failure.reason).toContain("not valid UTF-8")
    }))

  it("rejects invalid UTF-8 symbolic-link target bytes", async () =>
    withRoot(async (root) => {
      await symlink(Buffer.from([0xff]), join(root, "hostile-link"))
      const result = await Effect.runPromise(
        inventoryRuntimeDependencyTree(root).pipe(Effect.result)
      )
      expect(Result.isFailure(result)).toBe(true)
      if (Result.isFailure(result)) expect(result.failure.reason).toContain("not valid UTF-8")
    }))

  it("rejects hash-invisible empty directories", async () =>
    withRoot(async (root) => {
      await mkdir(join(root, "empty"))
      const result = await Effect.runPromise(
        inventoryRuntimeDependencyTree(root).pipe(Effect.result)
      )
      expect(Result.isFailure(result)).toBe(true)
      if (Result.isFailure(result)) expect(result.failure.reason).toContain("empty directories")
    }))
})
