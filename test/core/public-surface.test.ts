import { describe, expect, test } from "bun:test"
import * as Release from "../../src/index.js"
import { NodeReleaseLayer } from "../../src/platform/node.js"

describe("hard public surface", () => {
  test("does not retain the obsolete review protocol", () => {
    for (const name of ["plan", "apply", "ship", "reviewExecution", "reviewPublish", "approve", "doctor", "recover", "ledger"]) {
      expect(Object.hasOwn(Release, name)).toBe(false)
    }
  })

  test("the API object exposes the six lifecycle operations plus disposal", async () => {
    const api = Release.makeReleaseApi(NodeReleaseLayer)
    try {
      expect(Object.keys(api).sort()).toEqual([
        "correct",
        "dispose",
        "inspect",
        "observe",
        "prepare",
        "publish",
        "release"
      ])
    } finally {
      await api.dispose()
    }
  })
})
