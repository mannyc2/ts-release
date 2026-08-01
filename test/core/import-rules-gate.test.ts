import { describe, expect, test } from "@effect/bun-test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  checkImportRules,
  type ImportRulesRoots
} from "../../scripts/lib/import-rules.js"

// Synthetic trees declare their own scan roots; production keeps the
// repo-specific list in `productionRoots`, exercised by the live-repo case.
const syntheticRoots: ImportRulesRoots = {
  source: "src",
  bareEffect: ["src"],
  appPlatform: [],
  hardCut: []
}
const withTree = <A>(
  files: Record<string, string>,
  use: (root: string) => A
): A => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-import-rules-"))
  try {
    mkdirSync(join(root, "src"), { recursive: true })
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), content)
    }
    return use(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
const failuresFor = (files: Record<string, string>): ReadonlyArray<string> =>
  withTree(files, (root) => checkImportRules(root, syntheticRoots).failures)

describe("import-rules gate", () => {
  test("a concept DAG violation fails with the owning directory's allowlist", () => {
    const failures = failuresFor({
      "src/model/a.ts": "import { b } from \"../api/b.js\"\nvoid b\n"
    })
    expect(failures.some((item) => item.includes("model/ may import only"))).toBe(true)
  })

  test("ambient Bun usage in src fails as a host-capability escape", () => {
    const failures = failuresFor({
      "src/apply/host.ts": "export const result = Bun.spawnSync([\"true\"])\n"
    })
    expect(failures.some((item) => item.includes("reaches Bun.spawnSync"))).toBe(true)
  })

  test("global fetch in src fails toward the injected HttpClient", () => {
    const failures = failuresFor({
      "src/probe.ts": "export const response = fetch(\"https://example.com\")\n"
    })
    expect(failures.some((item) => item.includes("calls global fetch"))).toBe(true)
  })

  test("node:fs outside the secure-open list fails", () => {
    const failures = failuresFor({
      "src/apply/apply2.ts": "import { readFileSync } from \"node:fs\"\nvoid readFileSync\n"
    })
    expect(failures.some((item) => item.includes("secure-open file list"))).toBe(true)
  })

  test("a broad effect import fails toward effect/<Module>", () => {
    const failures = failuresFor({
      "src/broad.ts": "import * as E from \"effect\"\nvoid E\n"
    })
    expect(failures.some((item) => item.includes("broad \"effect\""))).toBe(true)
  })

  test("a missing declared scan root throws instead of passing vacuously", () => {
    withTree({ "src/ok.ts": "export const ok = true\n" }, (root) => {
      expect(() =>
        checkImportRules(root, { ...syntheticRoots, bareEffect: ["src", "missing-root"] })
      ).toThrow(/declared scan root/)
    })
  })

  test("the live repository passes with full coverage", () => {
    const report = checkImportRules(process.cwd())
    expect(report.failures).toEqual([])
    expect(report.filesExamined).toBeGreaterThan(100)
  })
})
