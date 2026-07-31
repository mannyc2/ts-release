import { describe, expect, test } from "bun:test"

const forbidden = new Set([
  "adapter", "adapterDefinition", "argv", "authority", "configPath", "credentialValue",
  "endpoint", "executable", "renderer", "rendererCode", "requestSchema", "responseSchema",
  "runtimeProfile", "templateCode", "validation"
])
const scan = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.every(scan)
  if (value === null || typeof value !== "object") return true
  return Object.entries(value).every(([key, child]) => !forbidden.has(key) && scan(child))
}

describe("complete supply-chain public config fixtures", () => {
  test("select built-ins and cannot inject operational profile internals", async () => {
    const fixture = await Bun.file("test/fixtures/parity/configs/supply-chain/configs.json").json()
    expect(fixture.schemaVersion).toBe("supply-chain-config-fixtures/v1")
    expect(fixture.fixtures).toHaveLength(10)
    expect(new Set(fixture.fixtures.map((item: any) => item.rowId)).size).toBe(10)
    for (const item of fixture.fixtures) {
      expect(item.config.project.name).toBeString()
      expect(item.config.publish).toBeObject()
      expect(item.config.supplyChain.length).toBeGreaterThan(0)
      expect(item.config.supplyChain.every((action: any) =>
        action.kind === "measure-size" || item.profileIds.includes(action.profileId)
      )).toBeTrue()
      expect(item.config.supplyChain.every((action: any) =>
        action.inputs.length > 0 && action.outputs.length > 0
      )).toBeTrue()
      expect(scan(item.config)).toBeTrue()
    }
  })
})
