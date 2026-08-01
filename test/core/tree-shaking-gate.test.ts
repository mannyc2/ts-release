import { describe, expect, test } from "@effect/bun-test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { checkTreeShaking } from "../../scripts/lib/tree-shaking.js"

const withTree = <A>(
  files: Record<string, string>,
  use: (root: string) => A
): A => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-tree-shaking-"))
  try {
    // The gate requires the repo-shaped roots to exist.
    mkdirSync(join(root, "src"), { recursive: true })
    mkdirSync(join(root, "apps/release-ts/src"), { recursive: true })
    mkdirSync(join(root, "apps/release-ts/scripts"), { recursive: true })
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), content)
    }
    return use(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe("tree-shaking gate", () => {
  test("a banned external prefix in an export graph fails", () => {
    const failures = withTree({
      "package.json": JSON.stringify({
        name: "@mannyc1/ts-release",
        exports: { ".": "./dist/index.js" }
      }),
      "src/index.ts": "import * as Cli from \"effect/unstable/cli\"\nvoid Cli\n"
    }, (root) => checkTreeShaking(root).failures)
    expect(failures.some((item) =>
      item.includes("imports banned package effect/unstable/cli"))).toBe(true)
  })

  test("an export target without a source counterpart fails", () => {
    const failures = withTree({
      "package.json": JSON.stringify({
        name: "@mannyc1/ts-release",
        exports: { ".": "./dist/index.js", "./ghost": "./dist/ghost.js" }
      }),
      "src/index.ts": "export const ok = true\n"
    }, (root) => checkTreeShaking(root).failures)
    expect(failures.some((item) =>
      item.includes("has no source counterpart"))).toBe(true)
  })

  test("the live repository passes with full coverage", () => {
    const report = checkTreeShaking(process.cwd())
    expect(report.failures).toEqual([])
    expect(report.filesExamined).toBeGreaterThan(0)
  })
})
