import { describe, expect, test } from "bun:test"
import { INVALID_VERSION_STATES, adoptFinalizedArtifacts, runAction, runBunHost, runCli, runLibraryConsumer, runNodeHost, runPackedExternal } from "../apps/consumers.js"
import { CASE_ACTIONS, CASE_IDS, FORBIDDEN_TRANSITIONS } from "../packages/kernel/src/index.js"
import { runPackRehearsal } from "./pack-rehearsal.js"
describe("T3 provider vertical topology", () => {
  test("executes independent providers through every consumer", async () => { expect(await runLibraryConsumer("one")).toHaveLength(2); expect(await runNodeHost("two")).toHaveLength(2); expect(await runBunHost("three")).toHaveLength(2); expect(await runCli("four")).toBe("provider-a,provider-b"); expect((await runAction("five")).operations).toHaveLength(2); expect(await runPackedExternal("six")).toHaveLength(2) })
  test("preserves artifacts and enumerates all partial publications", () => { const bytes = Uint8Array.from([1, 2]); const adopted = adoptFinalizedArtifacts([{ logicalName: "file", bytes, sizeDecimal: "2", mode: 0o644 }]); bytes[0] = 9; expect(adopted[0]!.bytes[0]).toBe(1); expect(INVALID_VERSION_STATES).toHaveLength(6) })
  test("contains all machine cases without provider sibling edges", () => { expect(CASE_IDS).toHaveLength(16); expect(Object.keys(CASE_ACTIONS)).toHaveLength(16); expect(FORBIDDEN_TRANSITIONS).toHaveLength(4) })
  test("executes generated verticals and the delivery artifact under Node and Bun", async () => {
    const root = new URL("../", import.meta.url).pathname
    const surface = await Bun.file(`${root}generated/SURFACE.json`).json() as { readonly packages: ReadonlyArray<unknown> }
    expect(surface.packages).toHaveLength(5)
    const program = "import('./delivery/t3-verticals.bundle.mjs').then(async m=>{if(await m.runCli('packed')!=='provider-a,provider-b')process.exit(2);if((await m.runAction('packed')).operations.length!==2)process.exit(3);if((await m.runPackedExternal('packed')).length!==2)process.exit(4)})"
    expect(Bun.spawnSync(["node", "--input-type=module", "--eval", program], { cwd: root }).exitCode).toBe(0)
    expect(Bun.spawnSync([process.execPath, "--eval", program], { cwd: root }).exitCode).toBe(0)
  })
  test("packs, installs, and rejects partial/skewed publication offline", async () => {
    const result = await runPackRehearsal(new URL("../", import.meta.url).pathname)
    expect(result).toMatchObject({ packageCount: 5, node: true, bun: true, cli: true, action: true, external: true, partialPublicationRejected: true, versionSkewRejected: true })
  }, 30_000)
})
