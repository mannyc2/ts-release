import { describe, expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import * as Release from "../../src/index.js"
import { ReleaseInputError } from "../../src/api/errors.js"

describe("root public API", () => {
  test("exports the required lifecycle and reference surface", () => {
    const names = new Set(Object.keys(Release))
    for (const required of [
      "CompletePreparedReleaseRef",
      "CorrectionReport",
      "CredentialFailureCause",
      "CredentialStrategyUnsupported",
      "CredentialStrategyUnsupportedCause",
      "CredentialUnavailable",
      "CredentialUnavailableCause",
      "ObservationReport",
      "PreparationModeUnsupported",
      "ReleaseAbortedError",
      "ReleaseIncompleteError",
      "ReleaseInputError",
      "ReleasePreparationError",
      "ReleaseReport",
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

  test("credential acquisition errors and their safe report causes remain tagged", () => {
    expect(new Release.CredentialUnavailable({
      subject: "npm:fixture@1.0.0",
      provider: "npm",
      purpose: "publish",
      reason: "host credential unavailable"
    })).toMatchObject({ _tag: "CredentialUnavailable" })
    expect(new Release.CredentialStrategyUnsupported({
      subject: "npm:fixture@1.0.0",
      provider: "npm",
      strategy: "trusted-publishing",
      reason: "host strategy unsupported"
    })).toMatchObject({ _tag: "CredentialStrategyUnsupported" })

    const cause = Schema.decodeUnknownSync(Release.CredentialFailureCause)({
      _tag: "CredentialUnavailable",
      provider: "npm",
      purpose: "publish",
      strategy: "token"
    })
    expect(cause._tag).toBe("CredentialUnavailable")
    expect(cause.provider.toString()).toBe("npm")
    expect(cause.purpose).toBe("publish")
    expect(cause.strategy).toBe("token")
  })
})
