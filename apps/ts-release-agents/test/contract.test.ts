import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { buildAgents } from "../src/build.js"
import { installAgentArchive } from "../src/install.js"

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

  test("archives install into disposable provider-owned layouts", () => {
    const archives = buildAgents({ archivesOnly: true })
    expect(existsSync(join(root, ".release", "agents", "codex"))).toBe(false)
    expect(existsSync(join(root, ".release", "agents", "claude"))).toBe(false)
    const disposableRoot = mkdtempSync(join(tmpdir(), "ts-release-agent-contract-"))
    try {
      for (const provider of ["codex", "claude"] as const) {
        const archive = archives.find((path) => path.endsWith(`ts-release-${provider}.zip`))
        expect(archive).toBeDefined()
        const installed = installAgentArchive(provider, archive!, disposableRoot)
        expect(installed.providerRoot).toBe(join(
          disposableRoot,
          provider === "codex" ? ".codex" : ".claude",
          "plugins",
          "cache",
          "local-archive",
          "ts-release"
        ))
        expect(installed.version).toBe("0.2.0")
        expect(installed.packageRoot).toBe(join(installed.providerRoot, installed.version))
        expect(existsSync(join(installed.packageRoot, provider === "codex" ? ".codex-plugin" : ".claude-plugin", "plugin.json"))).toBe(true)
        expect(existsSync(join(installed.packageRoot, "skills", "release", "SKILL.md"))).toBe(true)
        expect(installed.entries.every((entry) => entry.startsWith("ts-release/"))).toBe(true)
      }
    } finally {
      rmSync(disposableRoot, { recursive: true, force: true })
    }
  })
})
