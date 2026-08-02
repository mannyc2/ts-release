import { describe, expect, test } from "@effect/bun-test"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { checkSkillPlugin } from "../../scripts/lib/skill-plugin.js"

const root = process.cwd()
const RESOURCES = [
  "package.json",
  "apps/release-ts/release.config.json",
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  "ts-release-plugin",
  // The gate resolves every repo path the plugin markdown names, so the copy
  // has to carry the suites it points agents at.
  "test/core"
]
const withPluginCopy = async <A>(
  use: (copy: string) => Promise<A> | A
): Promise<A> => {
  const copy = mkdtempSync(join(tmpdir(), "ts-release-skill-plugin-"))
  try {
    for (const resource of RESOURCES) {
      mkdirSync(dirname(join(copy, resource)), { recursive: true })
      cpSync(join(root, resource), join(copy, resource), { recursive: true })
    }
    return await use(copy)
  } finally {
    rmSync(copy, { recursive: true, force: true })
  }
}
const mutateJson = (path: string, mutate: (value: Record<string, unknown>) => void): void => {
  const value = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
  mutate(value)
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
const json = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(root, path), "utf8")) as Record<string, unknown>

describe("ts-release plugin structural contract", () => {
  test("the live repository reports ready with aligned versions and exact evals", () => {
    const report = checkSkillPlugin(root)
    expect(report.problems).toEqual([])
    expect(report.status).toBe("ready")
    expect(report.version).toBe(String(json("package.json").version))
    expect(report.evals).toEqual({ positive: 5, negative: 3 })
  })

  test("both native manifests share the one skill tree and stay integration-free", () => {
    const codex = json("ts-release-plugin/.codex-plugin/plugin.json")
    const claude = json("ts-release-plugin/.claude-plugin/plugin.json")
    expect(codex.name).toBe("ts-release")
    expect(claude.name).toBe("ts-release")
    expect(codex.skills).toBe("./skills/")
    expect(codex.description).toBe(claude.description)
    const skill = readFileSync(join(root, "ts-release-plugin/skills/release/SKILL.md"), "utf8")
    expect(skill.startsWith("---\nname: release\n")).toBe(true)
    for (const manifest of [codex, claude]) {
      for (const key of ["mcpServers", "apps", "hooks", "agents", "commands"]) {
        expect(manifest).not.toHaveProperty(key)
      }
    }
    expect(claude).not.toHaveProperty("interface")
  })

  test("both repository catalogs install the same local plugin tree", () => {
    const codex = json(".agents/plugins/marketplace.json")
    const claude = json(".claude-plugin/marketplace.json")
    expect(codex.name).toBe("mannyc2-ts-release")
    expect(claude.name).toBe("mannyc2-ts-release")
    const codexEntry = (codex.plugins as Array<Record<string, unknown>>)[0]!
    const claudeEntry = (claude.plugins as Array<Record<string, unknown>>)[0]!
    expect((codexEntry.source as Record<string, unknown>).path).toBe("./ts-release-plugin")
    expect(claudeEntry.source).toBe("./ts-release-plugin")
    expect(codexEntry.version).toBe(claudeEntry.version)
  })

  test("eight eval cases carry the exact record keys", () => {
    const document = json("ts-release-plugin/evals/cases.json")
    const cases = document.cases as Array<Record<string, unknown>>
    expect(cases).toHaveLength(8)
    for (const item of cases) {
      expect(Object.keys(item).sort()).toEqual([
        "expectedActions", "expectedPhases", "forbiddenActions",
        "id", "kind", "prompt", "requiredResultFields"
      ])
    }
  })

  test("every aligned version field rejects drift independently", () =>
    withPluginCopy(async (copy) => {
      expect(checkSkillPlugin(copy).status).toBe("ready")
      const versionCarriers = [
        "ts-release-plugin/.codex-plugin/plugin.json",
        "ts-release-plugin/.claude-plugin/plugin.json",
        "apps/release-ts/release.config.json",
        ".agents/plugins/marketplace.json",
        ".claude-plugin/marketplace.json"
      ]
      for (const carrier of versionCarriers) {
        await withPluginCopy((drifted) => {
          mutateJson(join(drifted, carrier), (value) => {
            if (carrier.endsWith("marketplace.json")) {
              const plugins = value.plugins as Array<Record<string, unknown>>
              plugins[0]!.version = "9.9.9"
            } else if (carrier.endsWith("release.config.json")) {
              const project = value.project as Record<string, unknown>
              project.version = "9.9.9"
            } else {
              value.version = "9.9.9"
            }
          })
          const report = checkSkillPlugin(drifted)
          expect(report.status).toBe("broken")
          expect(report.problems.length).toBeGreaterThan(0)
        })
      }
    }))

  test("reserved marketplace names and external links are refused", () =>
    withPluginCopy(async (copy) => {
      mutateJson(join(copy, ".claude-plugin/marketplace.json"), (value) => {
        value.name = "claude-community"
      })
      const reserved = checkSkillPlugin(copy)
      expect(reserved.status).toBe("broken")
      expect(reserved.problems.some((item) => item.includes("reserved"))).toBe(true)
      await withPluginCopy((escaped) => {
        const reference = join(escaped, "ts-release-plugin/skills/release/references/recovery.md")
        writeFileSync(reference, `${readFileSync(reference, "utf8")}\nSee [more](../../../README.md).\n`)
        const report = checkSkillPlugin(escaped)
        expect(report.status).toBe("broken")
        expect(report.problems.some((item) => item.includes("links outside"))).toBe(true)
      })
    }))

  test("secret-like values and third-party installer instructions are refused", () =>
    withPluginCopy(async (copy) => {
      const readme = join(copy, "ts-release-plugin/README.md")
      writeFileSync(readme, `${readFileSync(readme, "utf8")}\ntoken: ghp_${"a".repeat(30)}\n`)
      const secret = checkSkillPlugin(copy)
      expect(secret.status).toBe("broken")
      expect(secret.problems.some((item) => item.includes("secret-like"))).toBe(true)
      await withPluginCopy((installer) => {
        const target = join(installer, "ts-release-plugin/README.md")
        writeFileSync(target, `${readFileSync(target, "utf8")}\nRun npx skills add ts-release.\n`)
        const report = checkSkillPlugin(installer)
        expect(report.status).toBe("broken")
        expect(report.problems.some((item) => item.includes("third-party installer"))).toBe(true)
      })
    }))

  // The failure this gate exists for: the shipped runbook named test/rewrite/*
  // suites for months after the directory became test/core/.
  test("a repo path or gate name the plugin names must resolve", () =>
    withPluginCopy(async (copy) => {
      const reference = join(copy, "ts-release-plugin/skills/release/references/verification.md")
      writeFileSync(reference, readFileSync(reference, "utf8")
        .replace("test/core/archive-files.test.ts", "test/rewrite/archive-files.test.ts"))
      const moved = checkSkillPlugin(copy)
      expect(moved.status).toBe("broken")
      expect(moved.problems.some((item) =>
        item.includes("verification.md") && item.includes("test/rewrite/archive-files.test.ts"))).toBe(true)
      await withPluginCopy((renamed) => {
        const path = join(renamed, "ts-release-plugin/skills/release/references/verification.md")
        writeFileSync(path, readFileSync(path, "utf8")
          .replace("bun run check:portable", "bun run check:portability"))
        const report = checkSkillPlugin(renamed)
        expect(report.status).toBe("broken")
        expect(report.problems.some((item) =>
          item.includes("missing package script check:portability"))).toBe(true)
      })
    }))
})
