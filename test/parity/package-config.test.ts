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

describe("complete package public config fixtures", () => {
  test("select built-ins and cannot inject operational profile internals", async () => {
    const fixture = await Bun.file("test/fixtures/parity/configs/packages/configs.json").json()
    expect(fixture.schemaVersion).toBe("package-config-fixtures/v1")
    expect(fixture.fixtures).toHaveLength(21)
    expect(new Set(fixture.fixtures.map((item: any) => item.rowId)).size).toBe(21)
    for (const item of fixture.fixtures) {
      expect(item.config.project.name).toBeString()
      expect(item.config.publish).toBeObject()
      expect(item.config.builds).toHaveLength(1)
      expect(item.config.builds[0].profileId).toBe(item.profileIds[0])
      expect(item.config.builds[0].inputs.length).toBeGreaterThan(0)
      expect(item.config.builds[0].outputs.length).toBeGreaterThan(0)
      expect(item.config.builds[0].options).toEqual({})
      expect(scan(item.config)).toBeTrue()
    }
  })
})
