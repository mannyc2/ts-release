import { describe, expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import {
  AlgorithmDigest,
  DigestCodecError,
  Sha1Digest,
  Sha256Digest,
  Sha512Digest,
  digestEquals,
  formatGitHubSha256,
  formatNpmSha1Shasum,
  formatNpmSha512Sri,
  formatSha256Hex,
  parseGitHubSha256,
  parseNpmSha1Shasum,
  parseNpmSha512Sri,
  parseSha1Hex,
  parseSha256Hex,
  parseSha512Hex,
  sha1Digest,
  sha256Digest,
  sha512Digest
} from "../../src/model/digest.js"

const bytes = new TextEncoder().encode("exact digest fixture bytes\n")

describe("algorithm-tagged digest algebra", () => {
  test("recomputes each algorithm independently from exact bytes", () => {
    const sha1 = sha1Digest(bytes)
    const sha256 = sha256Digest(bytes)
    const sha512 = sha512Digest(bytes)

    expect(sha1).toBeInstanceOf(Sha1Digest)
    expect(sha256).toBeInstanceOf(Sha256Digest)
    expect(sha512).toBeInstanceOf(Sha512Digest)
    expect(sha1.hex).toHaveLength(40)
    expect(sha256.hex).toHaveLength(64)
    expect(sha512.hex).toHaveLength(128)
    expect(new Set([sha1.hex, sha256.hex, sha512.hex]).size).toBe(3)
    expect(digestEquals(sha256, parseSha256Hex(sha256.hex))).toBe(true)
    expect(digestEquals(sha256, sha512)).toBe(false)
  })

  test("round-trips raw, GitHub, npm SRI, and npm shasum encodings", () => {
    const sha1 = sha1Digest(bytes)
    const sha256 = sha256Digest(bytes)
    const sha512 = sha512Digest(bytes)

    expect(parseSha1Hex(sha1.hex)).toEqual(sha1)
    expect(parseSha256Hex(formatSha256Hex(sha256))).toEqual(sha256)
    expect(parseSha512Hex(sha512.hex)).toEqual(sha512)
    expect(parseGitHubSha256(formatGitHubSha256(sha256))).toEqual(sha256)
    expect(parseNpmSha512Sri(formatNpmSha512Sri(sha512))).toEqual(sha512)
    expect(parseNpmSha1Shasum(formatNpmSha1Shasum(sha1))).toEqual(sha1)
  })

  test("rejects malformed length, case, prefix, padding, and algorithm", () => {
    const sha256 = sha256Digest(bytes)
    const sha512 = sha512Digest(bytes)
    for (const [parse, value, encoding] of [
      [parseSha1Hex, "a".repeat(39), "sha1-hex"],
      [parseSha256Hex, sha256.hex.toUpperCase(), "sha256-hex"],
      [parseSha512Hex, "a".repeat(127), "sha512-hex"],
      [parseGitHubSha256, `sha512:${sha256.hex}`, "github-sha256"],
      [parseNpmSha512Sri, formatNpmSha512Sri(sha512).replace(/==$/u, "="), "npm-sha512-sri"],
      [parseNpmSha1Shasum, sha256.hex, "npm-sha1-shasum"]
    ] as const) {
      expect(() => parse(value)).toThrow(DigestCodecError)
      try { parse(value) } catch (cause) {
        expect(cause).toMatchObject({ _tag: "DigestCodecError", encoding })
      }
    }
  })

  test("durable decoding rejects a tag/algorithm/length contradiction", () => {
    const encoded = Schema.encodeSync(AlgorithmDigest)(sha256Digest(bytes))
    expect(Schema.decodeUnknownSync(AlgorithmDigest)(encoded)).toEqual(sha256Digest(bytes))
    expect(() => Schema.decodeUnknownSync(AlgorithmDigest)({
      ...encoded,
      algorithm: "sha512"
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(AlgorithmDigest)({
      _tag: "Sha512Digest",
      algorithm: "sha512",
      hex: "a".repeat(64)
    })).toThrow()
  })
})
