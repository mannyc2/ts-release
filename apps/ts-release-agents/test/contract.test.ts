import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { buildAgents } from "../src/build.js"

const root = process.cwd()
const equal = (left: Uint8Array, right: Uint8Array): boolean => left.length === right.length && left.every((byte, index) => byte === right[index])

describe("agent distribution contract", () => {
  test("two identical projections are byte-identical", () => {
    const first = buildAgents().map((path) => new Uint8Array(readFileSync(path)))
    const second = buildAgents().map((path) => new Uint8Array(readFileSync(path)))
    expect(first.length).toBe(2)
    expect(first.every((value, index) => equal(value, second[index]!))).toBe(true)
  })

  test("provider-native generated layouts are contained and versioned", () => {
    for (const provider of ["codex", "claude"]) {
      const native = provider === "codex" ? ".codex-plugin" : ".claude-plugin"
      const manifest = join(root, ".release", "agents", provider, "ts-release", native, "plugin.json")
      expect(existsSync(manifest)).toBe(true)
      expect(JSON.parse(readFileSync(manifest, "utf8")).version).toBe("0.2.0")
    }
  })
})
