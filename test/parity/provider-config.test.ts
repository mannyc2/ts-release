import { describe, expect, test } from "bun:test"

const forbidden = new Set([
  "adapter", "adapterDefinition", "argv", "authority", "configPath", "credentialValue",
  "executable", "renderer", "rendererCode", "requestSchema", "responseSchema",
  "runtimeProfile", "templateCode", "validation"
])
const scan = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.every(scan)
  if (value === null || typeof value !== "object") return true
  return Object.entries(value).every(([key, child]) => !forbidden.has(key) && scan(child))
}

describe("complete provider config fixtures", () => {
  test("keep named profiles closed and isolate the generic HTTP surface", async () => {
    const fixture = await Bun.file("test/fixtures/parity/configs/providers/configs.json").json()
    expect(fixture.schemaVersion).toBe("provider-config-fixtures/v1")
    expect(fixture.fixtures).toHaveLength(16)
    expect(new Set(fixture.fixtures.map((item: any) => item.rowId)).size).toBe(16)
    for (const item of fixture.fixtures) {
      expect(scan(item.config)).toBeTrue()
      expect(item.config.publish.providers).toBeArray()
      for (const action of item.config.publish.providers) {
        expect(action.profileId).toBeString()
        expect(action.ids).toBeArray()
        if (action.profileId === "http.generic-upload/v1") {
          expect(action.endpoint).toStartWith("https://")
          expect(action.bodyMapping).toBe("raw-artifact")
        } else {
          expect(action.endpoint).toBeUndefined()
          expect(action.headerNames).toBeUndefined()
          expect(action.bodyMapping).toBeUndefined()
        }
      }
    }
  })
})
