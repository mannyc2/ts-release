import { describe, expect, it } from "vitest"
import {
  CanonicalJsonError,
  NonCanonicalDocumentError,
  StrictJsonError,
  canonicalJsonBytes,
  encodeCanonicalJson,
  parseCanonicalJson,
  parseCanonicalJsonBytes,
  parseStrictJson
} from "../src/canonical-document.js"

describe("CanonicalJsonV1", () => {
  it("encodes and parses the canonical representation", () => {
    const value = {
      z: [true, null, 7],
      a: { "😀": "composed café", z: 0 }
    }
    const canonical = '{"a":{"z":0,"😀":"composed café"},"z":[true,null,7]}\n'

    expect(encodeCanonicalJson(value)).toBe(canonical)
    expect(canonicalJsonBytes(value)).toEqual(new TextEncoder().encode(canonical))
    expect(parseCanonicalJson(canonical)).toEqual(value)
    expect(parseCanonicalJsonBytes(new TextEncoder().encode(canonical))).toEqual(value)
  })

  it("rejects duplicate object keys before JavaScript can collapse them", () => {
    expect(() => parseStrictJson('{"a":1,"a":2}')).toThrow(StrictJsonError)
    expect(() => parseCanonicalJsonBytes(new TextEncoder().encode('{"a":1,"a":2}\n')))
      .toThrow(/duplicate object key/u)
  })

  it.each([
    String.raw`{"a":1,"\u0061":2}`,
    String.raw`{"/":1,"\/":2}`,
    String.raw`{"😀":1,"\ud83d\ude00":2}`
  ])("rejects decoded-equivalent duplicate keys in %s", (document: string) => {
    expect(() => parseStrictJson(document)).toThrow(/duplicate object key/u)
  })

  it.each([
    ['{"a":1, "b":2}\n', "whitespace drift"],
    ['{"b":2,"a":1}\n', "key-order drift"],
    ['{"a":1}', "missing terminal newline"]
  ])("rejects %s as %s", (document: string) => {
    expect(() => parseCanonicalJsonBytes(new TextEncoder().encode(document)))
      .toThrow(NonCanonicalDocumentError)
  })

  it("rejects non-NFC strings and keys instead of normalizing them", () => {
    const decomposed = "cafe\u0301"

    expect(() => encodeCanonicalJson(decomposed)).toThrow(CanonicalJsonError)
    expect(() => encodeCanonicalJson({ [decomposed]: true })).toThrow(CanonicalJsonError)
    expect(() => parseStrictJson(`${JSON.stringify(decomposed)}\n`)).toThrow(StrictJsonError)
    expect(() => parseStrictJson(`{${JSON.stringify(decomposed)}:true}\n`)).toThrow(StrictJsonError)
  })

  it("rejects unpaired UTF-16 surrogates while accepting valid pairs", () => {
    for (const value of ["\ud800", "\udc00", "\udc00\ud800"]) {
      expect(() => encodeCanonicalJson(value)).toThrow(/unpaired UTF-16 surrogate/u)
      expect(() => parseStrictJson(`${JSON.stringify(value)}\n`)).toThrow(/unpaired UTF-16 surrogate/u)
      expect(() => parseStrictJson(`"${value}"`)).toThrow(/unpaired UTF-16 surrogate/u)
    }

    expect(encodeCanonicalJson("😀")).toBe('"😀"\n')
    expect(parseCanonicalJson('"😀"\n')).toBe("😀")
  })

  it("sorts object keys by Unicode code point and preserves prefix order", () => {
    expect(encodeCanonicalJson({ "𐀀": 2, "a-a": 4, aa: 3, "\ue000": 1 }))
      .toBe('{"a-a":4,"aa":3,"":1,"𐀀":2}\n')
  })

  it.each([
    [1.5, "a float"],
    [Number.MAX_SAFE_INTEGER + 1, "an unsafe integer"],
    [-0, "negative zero"]
  ])("rejects %s when encoding %s", (value: number) => {
    expect(() => encodeCanonicalJson(value)).toThrow(CanonicalJsonError)
  })

  it.each([
    ["1.5", "a float"],
    ["9007199254740992", "an unsafe integer"],
    ["-0", "negative zero"]
  ])("rejects %s when parsing %s", (document: string) => {
    expect(() => parseStrictJson(document)).toThrow(StrictJsonError)
  })

  it("accepts the safe-integer boundaries and rejects noncanonical number grammar", () => {
    expect(parseCanonicalJson(`${Number.MAX_SAFE_INTEGER}\n`)).toBe(Number.MAX_SAFE_INTEGER)
    expect(parseCanonicalJson(`${Number.MIN_SAFE_INTEGER}\n`)).toBe(Number.MIN_SAFE_INTEGER)
    for (const document of ["9007199254740992", "-9007199254740992", "01", "+1", "1.", "1e0"]) {
      expect(() => parseStrictJson(document)).toThrow(StrictJsonError)
    }
  })

  it("rejects malformed escapes and unescaped controls", () => {
    for (const document of [String.raw`"\x20"`, String.raw`"\u12xz"`, '"line\nfeed"']) {
      expect(() => parseStrictJson(document)).toThrow(StrictJsonError)
    }
  })

  it("rejects byte-order marks and malformed UTF-8", () => {
    expect(() => parseCanonicalJsonBytes(new TextEncoder().encode('\ufeff{"a":1}\n')))
      .toThrow(StrictJsonError)
    expect(() => parseCanonicalJsonBytes(Uint8Array.from([0xc0, 0xaf])))
      .toThrow(NonCanonicalDocumentError)
  })

  it("rejects values that would lose own properties or invoke accessors", () => {
    const arrayWithExtra = [1] as Array<number> & { extra?: number }
    arrayWithExtra.extra = 2
    const objectWithSymbol = { a: 1 } as Record<PropertyKey, unknown>
    objectWithSymbol[Symbol("hidden")] = 2
    const objectWithHidden = { a: 1 }
    Object.defineProperty(objectWithHidden, "hidden", { value: 2 })
    const objectWithGetter = Object.defineProperty({}, "a", { enumerable: true, get: () => 1 })

    for (const value of [arrayWithExtra, objectWithSymbol, objectWithHidden, objectWithGetter]) {
      expect(() => encodeCanonicalJson(value)).toThrow(CanonicalJsonError)
    }
  })

  it("rejects cycles and unsupported values", () => {
    const cyclic: Array<unknown> = []
    cyclic.push(cyclic)

    expect(() => encodeCanonicalJson(cyclic)).toThrow(/cyclic/u)
    expect(() => encodeCanonicalJson(undefined)).toThrow(/undefined/u)
    expect(() => encodeCanonicalJson(new Date(0))).toThrow(/plain objects/u)
  })

  it("rejects sparse and indirect cycles but accepts shared acyclic data and null prototypes", () => {
    const sparse = new Array(2)
    sparse[1] = true
    const left: Record<string, unknown> = {}
    const right: Record<string, unknown> = { left }
    left.right = right
    const shared = { value: 1 }
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, { value: 1 })

    expect(() => encodeCanonicalJson(sparse)).toThrow(/sparse/u)
    expect(() => encodeCanonicalJson(left)).toThrow(/cyclic/u)
    expect(encodeCanonicalJson([shared, shared])).toBe('[{"value":1},{"value":1}]\n')
    expect(encodeCanonicalJson(nullPrototype)).toBe('{"value":1}\n')
  })
})
