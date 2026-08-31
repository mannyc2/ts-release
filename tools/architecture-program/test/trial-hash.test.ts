import { describe, expect, it } from "vitest"
import { canonicalJsonBytes } from "../src/canonical-document.js"
import {
  hashCanonicalDocumentBytes,
  hashCanonicalValue,
  sha256Bytes
} from "../src/trial-hash.js"

const textEncoder = new TextEncoder()

const concatBytes = (...parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }
  return result
}

const lengthPrefix = (byteLength: number): Uint8Array => {
  const prefix = new Uint8Array(4)
  new DataView(prefix.buffer).setUint32(0, byteLength, false)
  return prefix
}

const framedBytes = (domain: Uint8Array, payload: Uint8Array): Uint8Array =>
  concatBytes(lengthPrefix(domain.byteLength), domain, lengthPrefix(payload.byteLength), payload)

describe("trial hashes", () => {
  it("computes a schema-validated lowercase SHA-256 digest", () => {
    expect(sha256Bytes(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
  })

  it("separates hash domains", () => {
    const value = { caseId: "C01-example", outcome: "pass" }

    expect(hashCanonicalValue("ts-release/trial-case/1", value)).not.toBe(
      hashCanonicalValue("ts-release/trial-receipt/1", value)
    )
  })

  it("uses UTF-8 byte lengths and includes the canonical terminal LF", () => {
    const domain = "ts-release/trial-café/1"
    const domainBytes = textEncoder.encode(domain)
    const payloadBytes = canonicalJsonBytes({ z: 2, a: 1 })
    const actual = hashCanonicalValue(domain, { z: 2, a: 1 })

    expect(domainBytes.byteLength).toBeGreaterThan(domain.length)
    expect(payloadBytes.at(-1)).toBe(0x0a)
    expect(actual).toBe(sha256Bytes(framedBytes(domainBytes, payloadBytes)))

    const payloadWithoutLf = payloadBytes.slice(0, -1)
    expect(actual).not.toBe(sha256Bytes(framedBytes(domainBytes, payloadWithoutLf)))
  })

  it("length-prefixes boundaries that raw concatenation cannot distinguish", () => {
    const leftDomain = textEncoder.encode("a")
    const leftPayload = canonicalJsonBytes('"')
    const rightDomain = textEncoder.encode('a"\\')
    const rightPayload = canonicalJsonBytes("")

    expect(concatBytes(leftDomain, leftPayload)).toEqual(concatBytes(rightDomain, rightPayload))
    expect(hashCanonicalValue("a", '"')).not.toBe(hashCanonicalValue('a"\\', ""))
  })

  it("is deterministic across object insertion order", () => {
    expect(hashCanonicalValue("ts-release/trial-value/1", { z: 2, a: 1 })).toBe(
      hashCanonicalValue("ts-release/trial-value/1", { a: 1, z: 2 })
    )
  })

  it("changes when the canonical payload changes", () => {
    expect(hashCanonicalValue("ts-release/trial-value/1", { value: 1 })).not.toBe(
      hashCanonicalValue("ts-release/trial-value/1", { value: 2 })
    )
  })

  it.each([
    ["", /must not be empty/u],
    ["trial\u0000receipt", /must not contain NUL/u],
    ["cafe\u0301", /must be NFC-normalized/u],
    ["\ud800", /unpaired UTF-16 surrogate/u]
  ])("rejects an invalid hash domain", (domain, message) => {
    expect(() => hashCanonicalValue(domain, null)).toThrow(message)
  })

  it("validates canonical documents and hashes their exact raw bytes", () => {
    const bytes = canonicalJsonBytes({ receipt: "accepted", sequence: 1 })

    expect(hashCanonicalDocumentBytes(bytes)).toBe(sha256Bytes(bytes))
    expect(() => hashCanonicalDocumentBytes(
      textEncoder.encode('{"sequence":1,"receipt":"accepted"}\n')
    )).toThrow(/Non-canonical JSON document/u)
  })
})
