import { describe, expect, test } from "@effect/bun-test"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { contained } from "../../src/drivers/contain.js"
import { within } from "../../src/api/input.js"

describe("one containment discipline", () => {
  test("contained is a strict lexical beneath-or-equal check", () => {
    expect(contained("/workspace", "/workspace")).toBe(true)
    expect(contained("/workspace", "/workspace/dist/cli")).toBe(true)
    expect(contained("/workspace", "/workspace-sibling")).toBe(false)
    expect(contained("/workspace", "/outside")).toBe(false)
    expect(contained("/workspace", "/")).toBe(false)
  })

  test("a symlinked directory component cannot relocate run state outside", () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-contain-")))
    try {
      const outside = join(directory, "outside")
      const root = join(directory, "workspace")
      mkdirSync(outside)
      mkdirSync(root)
      symlinkSync(outside, join(root, "linked"))
      expect(() => within(root, "linked/runs/ledger.json"))
        .toThrow(/Run path must remain inside the workspace/)
      // Not-yet-created directories stay allowed: only existing symlinked
      // components refuse.
      expect(within(root, ".release/runs/ledger.json"))
        .toBe(join(root, ".release/runs/ledger.json"))
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
