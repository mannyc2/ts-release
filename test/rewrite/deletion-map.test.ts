import { describe, expect, test } from "@effect/bun-test"
import { parseStrictJson } from "../../scripts/lib/strict-json.js"

describe("Plan 176 executable deletion map", () => {
  test("has total incumbent ownership and zero unresolved entries", () => {
    const result = Bun.spawnSync(["bun", "run", "scripts/check-deletion-map.ts"], {
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe"
    })
    expect(result.exitCode).toBe(0)
    const report = parseStrictJson(result.stdout.toString()) as {
      readonly files: number
      readonly unresolved: number
      readonly parity: { readonly customization: number; readonly pro: number }
    }
    expect(report.files).toBe(23)
    expect(report.unresolved).toBe(0)
    expect(report.parity).toEqual({ customization: 50, pro: 9 })
  })
})
