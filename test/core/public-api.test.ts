import { describe, expect, test } from "bun:test"
import * as Release from "../../src/index.js"
import { ReleaseInputError } from "../../src/api/errors.js"

describe("root public API", () => {
  test("exports exactly the lifecycle and pure configuration helpers", () => {
    expect(Object.keys(Release).sort()).toEqual([
      "ReleaseInputError", "ReleaseRuntime", "correct", "defineRelease", "encodeResolvedConfig",
      "inspect", "makeReleaseApi", "prepare", "publish", "release", "resolveConfig", "unsupportedExecutionHost"
    ].sort())
  })

  test("input failures remain tagged errors", () => {
    expect(new ReleaseInputError({ reason: "invalid" })).toMatchObject({ _tag: "ReleaseInputError", reason: "invalid" })
  })
})
