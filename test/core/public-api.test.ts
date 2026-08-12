import { describe, expect, test } from "bun:test"
import * as Release from "../../src/index.js"
import { ReleaseInputError } from "../../src/api/errors.js"

describe("root public API", () => {
  test("exports exactly the lifecycle and pure configuration helpers", () => {
    expect(Object.keys(Release).sort()).toEqual([
      "CompletePreparedReleaseRef", "GitHubActionsCompletePreparedReleaseRef", "LocalCompletePreparedReleaseRef",
      "PreparationModeUnsupported", "PreparedReleaseRefCodecError", "PreparedReleaseRefMalformedError",
      "PreparedReleaseRefUnknownSchemeError", "ReleaseAbortedError", "ReleaseIncompleteError",
      "ReleaseInputError", "ReleasePreparationError", "ReleaseRuntime", "correct",
      "decodeCompletePreparedReleaseRef", "defineRelease", "encodeCompletePreparedReleaseRef",
      "encodeResolvedConfig", "inspect", "makeGitHubActionsCompletePreparedReleaseRef",
      "makeLocalCompletePreparedReleaseRef", "makeReleaseApi", "prepare", "publish", "release",
      "resolveConfig", "unsupportedExecutionHost"
    ].sort())
  })

  test("input failures remain tagged errors", () => {
    expect(new ReleaseInputError({ reason: "invalid" })).toMatchObject({ _tag: "ReleaseInputError", reason: "invalid" })
  })
})
