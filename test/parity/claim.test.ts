import { describe, expect, test } from "@effect/bun-test"
import {
  FINAL_PARITY_CLAIM,
  readParityManifest,
  validateParityClaim
} from "../../scripts/lib/parity.js"

describe("parity claim contract", () => {
  test("the sole permitted claim names pin, denominators, and exclusions", () => {
    const manifest = readParityManifest(process.cwd())
    expect(FINAL_PARITY_CLAIM).toContain("v2.17.0")
    expect(FINAL_PARITY_CLAIM).toContain("107/107")
    expect(FINAL_PARITY_CLAIM).toContain("33/33")
    expect(FINAL_PARITY_CLAIM).toContain("exclud")
    expect(() => validateParityClaim(manifest.claim, 107, 33)).not.toThrow()
  })

  test("static, stale, and unqualified claims refuse", () => {
    expect(() => validateParityClaim(FINAL_PARITY_CLAIM, 0, 0)).toThrow()
    expect(() => validateParityClaim("full parity", 107, 33)).toThrow()
    expect(() => validateParityClaim("parity is full", 107, 33)).toThrow()
  })
})
