import { describe, expect, test } from "@effect/bun-test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { checkDocsClaims } from "../scripts/lib/docs-claims.js"
import { executableCapabilities } from "../src/capabilities/registry.js"

describe("executable capability documentation", () => {
  test("schema-only or unknown capability claims fail", () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-docs-"))
    mkdirSync(join(root, "docs"))
    writeFileSync(join(root, "docs", "comparison.md"),
      "<!-- claim capability:publish.not-a-real-handler -->\nUnknown.\n")
    const report = checkDocsClaims(root)
    expect(report.failures.join("\n")).toContain("no executable registry entry")
  })

  test("every registry entry names a source path and vertical test", () => {
    for (const entry of executableCapabilities) {
      expect(entry.entrypoint).toContain("src/")
      expect(entry.verticalTest).toContain("test/")
    }
  })
})
