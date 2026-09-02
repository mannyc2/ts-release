import { describe, expect, test } from "bun:test"
import { CASE_ACTIONS, CASE_IDS, FORBIDDEN_TRANSITIONS } from "../src/kernel.js"
import { adoptFinalizedArtifacts, runAction, runBunHost, runCli, runLibraryConsumer, runNodeHost, runPackedExternal } from "../src/consumers.js"
import { runPackRehearsal } from "./pack-rehearsal.js"

describe("T1 root topology", () => {
  test("executes every host and provider shape", async () => {
    expect(await runLibraryConsumer("request-1")).toHaveLength(2)
    expect(await runNodeHost("request-2")).toHaveLength(2)
    expect(await runBunHost("request-3")).toHaveLength(2)
    expect(await runCli("request-4")).toBe("provider-a,provider-b")
    expect((await runAction("request-5")).operations).toHaveLength(2)
    expect(await runPackedExternal("request-6")).toHaveLength(2)
  })

  test("preserves finalized file and tree values losslessly", () => {
    const source = Uint8Array.from([1, 2, 3])
    const adopted = adoptFinalizedArtifacts([
      { logicalName: "file", bytes: source, sizeDecimal: "3", mode: 0o644 },
      { logicalName: "tree-link", bytes: new Uint8Array(), sizeDecimal: "0", mode: 0o120000, symlinkTarget: "dist/file" }
    ])
    source[0] = 9
    expect(adopted[0]!.bytes[0]).toBe(1)
    expect(adopted[1]!.mode).toBe(0o120000)
    expect(() => adoptFinalizedArtifacts([{ logicalName: "escape", bytes: new Uint8Array(), sizeDecimal: "0", mode: 0o120000, symlinkTarget: "../outside" }])).toThrow()
  })

  test("binds the full selected-machine case grammar", () => {
    expect(CASE_IDS).toHaveLength(16)
    expect(Object.keys(CASE_ACTIONS)).toHaveLength(16)
    expect(FORBIDDEN_TRANSITIONS).toHaveLength(4)
  })

  test("executes the exact generated bundle under Node and Bun", async () => {
    const root = new URL("../", import.meta.url).pathname
    const surface = await Bun.file(`${root}generated/SURFACE.json`).json() as { readonly packages: ReadonlyArray<{ readonly name: string; readonly declarationExports: ReadonlyArray<string>; readonly runtimeExports: ReadonlyArray<string> }> }
    const expected = surface.packages.find(({ name }) => name === "@trial/release")!
    expect(expected.declarationExports).toEqual(expected.runtimeExports)
    const program = "Promise.all([import('./generated/index.mjs'),import('./delivery/t1-root.bundle.mjs')]).then(async ([runtime,bundle])=>{const v=await bundle.runCli('packed');if(v!=='provider-a,provider-b')process.exit(2);process.stdout.write(JSON.stringify(Object.keys(runtime).sort()))})"
    const node = Bun.spawnSync(["node", "--input-type=module", "--eval", program], { cwd: root })
    const bun = Bun.spawnSync([process.execPath, "--eval", program], { cwd: root })
    expect(node.exitCode).toBe(0)
    expect(bun.exitCode).toBe(0)
    const decode = (bytes: Uint8Array): ReadonlyArray<string> => JSON.parse(new TextDecoder().decode(bytes)) as ReadonlyArray<string>
    expect(decode(node.stdout)).toEqual([...expected.runtimeExports].sort())
    expect(decode(bun.stdout)).toEqual([...expected.runtimeExports].sort())
  })

  test("packs, installs, and rejects partial/skewed publication offline", async () => {
    const result = await runPackRehearsal(new URL("../", import.meta.url).pathname)
    expect(result).toMatchObject({ packageCount: 2, node: true, bun: true, cli: true, action: true, external: true, partialPublicationRejected: true, versionSkewRejected: true })
  }, 30_000)
})
