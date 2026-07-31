import { describe, expect, test } from "bun:test"
import { normalizeProviderEndpoint } from "../../src/recipes/current-publish.js"

describe("self-hosted provider URL policy", () => {
  test("normalizes HTTPS origin, port, and base path", () => {
    expect(normalizeProviderEndpoint("https://Forge.Example:443/api/")).toBe("https://forge.example/api")
    expect(normalizeProviderEndpoint("https://forge.example:8443/base")).toBe(
      "https://forge.example:8443/base"
    )
  })

  test("rejects authority confusion, traversal, and forbidden literal address classes", () => {
    for (const value of [
      "http://forge.example/api", "https://user@forge.example/api", "https://forge.example/api?q=1",
      "https://forge.example/a/../b", "https://127.0.0.1/api", "https://169.254.1.1/api",
      "https://localhost/api"
    ]) expect(() => normalizeProviderEndpoint(value)).toThrow()
  })
})
