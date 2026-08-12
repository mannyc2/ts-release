import { describe, expect, test } from "bun:test"
import { decodePrepareInput, decodeReleaseInput } from "../../src/api/input.js"
import { PreparationModeUnsupported, ReleaseInputError } from "../../src/api/errors.js"

const base = { config: { project: {} }, workspace: "/tmp" }

describe("reserved preparation modes", () => {
  for (const mode of ["partition", "merge"] as const) {
    test(`recognizes and refuses ${mode} without defining its shape`, () => {
      try {
        decodePrepareInput({ ...base, mode, speculativeShape: { host: "unknown" } })
        throw new Error("reserved preparation mode unexpectedly decoded")
      } catch (cause) {
        expect(cause).toBeInstanceOf(PreparationModeUnsupported)
        expect(cause).toMatchObject({ mode, owner: "plan-235" })
      }
    })
  }

  test("keeps every other undeclared mode behind strict input decoding", () => {
    expect(() => decodePrepareInput({ ...base, mode: "partial" })).toThrow(ReleaseInputError)
  })

  test("allows the diagnostic empty-release flag only on release", () => {
    expect(decodeReleaseInput({ ...base, allowEmpty: true }).allowEmpty).toBe(true)
    expect(() => decodePrepareInput({ ...base, allowEmpty: true })).toThrow(ReleaseInputError)
  })
})
