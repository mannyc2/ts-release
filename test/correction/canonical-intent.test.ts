import { describe, expect, test } from "bun:test"
import { Digest, NonEmptyName, Version } from "../../src/model/primitives.js"
import {
  CorrectionIntentV1, NpmDeprecationCorrection, decodeCorrectionIntent, encodeCorrectionIntent,
  makeCorrectionIntent
} from "../../src/correction/intent.js"

const correction = NpmDeprecationCorrection.make({
  provider: "npm", publicationId: NonEmptyName.make("npm-release"), registryUrl: "https://registry.example.test",
  packageName: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tarballIntegrity: "sha512-integrity",
  message: "Use fixture 1.0.1 instead."
})

describe("canonical correction intents", () => {
  test("correction id and bytes are deterministic", () => {
    const input = { schemaVersion: "correction-intent/v1" as const, preparedDigest: Digest.make("a".repeat(64)), correction }
    const first = makeCorrectionIntent(input)
    const second = makeCorrectionIntent(input)
    expect(first.correctionId).toBe(second.correctionId)
    expect(encodeCorrectionIntent(first)).toEqual(encodeCorrectionIntent(second))
    expect(decodeCorrectionIntent(encodeCorrectionIntent(first))).toEqual(first)
  })

  test("wrong correction ids and unknown keys are rejected", () => {
    const value = makeCorrectionIntent({ schemaVersion: "correction-intent/v1", preparedDigest: Digest.make("a".repeat(64)), correction })
    expect(() => encodeCorrectionIntent(CorrectionIntentV1.make({ ...value, correctionId: Digest.make("b".repeat(64)) }))).toThrow()
    const canonical = new TextDecoder().decode(encodeCorrectionIntent(value))
    const text = `${canonical.slice(0, -2)},"extra":true}\n`
    expect(() => decodeCorrectionIntent(new TextEncoder().encode(text))).toThrow()
  })
})
