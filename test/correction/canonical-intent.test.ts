import { describe, expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson } from "../../src/model/canonical.js"
import {
  Sha256Digest,
  digestEquals,
  parseSha256Hex,
  parseSha512Hex,
  sha256Digest
} from "../../src/model/digest.js"
import { NonEmptyName, Version } from "../../src/model/primitives.js"
import * as CorrectionModule from "../../src/correction/intent.js"
import {
  CorrectionIntentV2,
  CorrectionVariant,
  NpmDeprecationCorrection,
  correctionIdFor,
  decodeCorrectionIntent,
  encodeCorrectionIntent,
  makeCorrectionIntent
} from "../../src/correction/intent.js"

const preparedDigest = parseSha256Hex("a".repeat(64))
const correction = NpmDeprecationCorrection.make({
  provider: "npm",
  publicationId: NonEmptyName.make("npm-release"),
  registryUrl: "https://registry.example.test",
  packageName: NonEmptyName.make("fixture"),
  version: Version.make("1.0.0"),
  baselineDigest: parseSha256Hex("b".repeat(64)),
  tarballIntegrity: parseSha512Hex("c".repeat(128)),
  message: "Use fixture 1.0.1 instead."
})

const input = {
  schemaVersion: "correction-intent/v2" as const,
  preparedDigest,
  correction
}

describe("canonical correction intents", () => {
  test("V2 correction id hashes the exact canonical unsigned bytes deterministically", () => {
    const unsigned = {
      schemaVersion: input.schemaVersion,
      preparedDigest: Schema.encodeSync(Sha256Digest)(preparedDigest),
      correction: Schema.encodeSync(CorrectionVariant)(correction)
    }
    const expected = sha256Digest(new TextEncoder().encode(encodeCanonicalJson(unsigned)))
    const first = makeCorrectionIntent(input)
    const second = makeCorrectionIntent(input)

    expect(first).toBeInstanceOf(CorrectionIntentV2)
    expect(digestEquals(first.correctionId, expected)).toBe(true)
    expect(digestEquals(correctionIdFor(input), expected)).toBe(true)
    expect(first.correctionId).toEqual(second.correctionId)
    expect(encodeCorrectionIntent(first)).toEqual(encodeCorrectionIntent(second))
    expect(decodeCorrectionIntent(encodeCorrectionIntent(first))).toEqual(first)

    const durable = JSON.parse(new TextDecoder().decode(encodeCorrectionIntent(first))) as Record<string, unknown>
    expect(durable).toMatchObject({
      schemaVersion: "correction-intent/v2",
      preparedDigest: { _tag: "Sha256Digest", algorithm: "sha256", hex: "a".repeat(64) },
      correction: {
        baselineDigest: { _tag: "Sha256Digest", algorithm: "sha256", hex: "b".repeat(64) },
        tarballIntegrity: { _tag: "Sha512Digest", algorithm: "sha512", hex: "c".repeat(128) }
      },
      correctionId: { _tag: "Sha256Digest", algorithm: "sha256" }
    })
  })

  test("wrong ids, V1 bytes, unknown keys, and algorithm mixups are rejected", () => {
    const value = makeCorrectionIntent(input)
    expect(() => encodeCorrectionIntent(CorrectionIntentV2.make({
      ...value,
      correctionId: parseSha256Hex("b".repeat(64))
    }))).toThrow()

    const canonical = new TextDecoder().decode(encodeCorrectionIntent(value))
    const withExtra = `${canonical.slice(0, -2)},"extra":true}\n`
    expect(() => decodeCorrectionIntent(new TextEncoder().encode(withExtra))).toThrow()

    const legacy = canonical.replace("correction-intent/v2", "correction-intent/v1")
    expect(() => decodeCorrectionIntent(new TextEncoder().encode(legacy))).toThrow()
    expect(Object.hasOwn(CorrectionModule, "CorrectionIntentV1")).toBe(false)

    expect(() => makeCorrectionIntent({
      ...input,
      preparedDigest: parseSha512Hex("d".repeat(128)) as unknown as Sha256Digest
    })).toThrow()
    expect(() => makeCorrectionIntent({
      ...input,
      correction: NpmDeprecationCorrection.make({
        ...correction,
        tarballIntegrity: parseSha256Hex("e".repeat(64)) as never
      })
    })).toThrow()
  })
})
