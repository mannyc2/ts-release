import { describe, expect, test } from "bun:test"
import * as Release from "../../src/index.js"

describe("hard public surface", () => {
  test("does not retain the obsolete review protocol", () => {
    for (const name of ["plan", "apply", "ship", "reviewExecution", "reviewPublish", "approve", "doctor", "recover", "ledger"]) {
      expect(Object.hasOwn(Release, name)).toBe(false)
    }
  })

  test("the API object has only the six lifecycle operations plus disposal", () => {
    const keys = ["inspect", "prepare", "publish", "release", "correct", "dispose"]
    expect(keys).toHaveLength(6)
  })
})
