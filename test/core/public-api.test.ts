import { describe, expect, test } from "bun:test"
import * as Release from "../../src/index.js"
import { ReleaseInputError } from "../../src/api/errors.js"

describe("root public API", () => {
  test("exports the required lifecycle and reference surface", () => {
    const names = new Set(Object.keys(Release))
    for (const required of [
      "CompletePreparedReleaseRef",
      "CorrectionReport",
      "PreparationModeUnsupported",
      "ReleaseAbortedError",
      "ReleaseIncompleteError",
      "ReleaseInputError",
      "ReleasePreparationError",
      "correct",
      "decodeCompletePreparedReleaseRef",
      "encodeCompletePreparedReleaseRef",
      "inspect",
      "makeReleaseApi",
      "observe",
      "prepare",
      "publish",
      "release"
    ]) expect(names.has(required), `missing public export ${required}`).toBe(true)

    for (const banned of [
      "PublicationCredentialsInput",
      "PreparedBundle",
      "PublicationCredentials",
      "preparedDirectory"
    ]) expect(names.has(banned), `legacy public export ${banned}`).toBe(false)
  })

  test("input failures remain tagged errors", () => {
    expect(new ReleaseInputError({ reason: "invalid" })).toMatchObject({
      _tag: "ReleaseInputError",
      reason: "invalid"
    })
  })
})
