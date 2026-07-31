import { describe, expect, test } from "@effect/bun-test"
import {
  encodeCanonicalJson,
  hashFramed
} from "../../scripts/lib/canonical-json.js"
import { parseStrictJson } from "../../scripts/lib/strict-json.js"

describe("CanonicalJsonV1", () => {
  test("normalizes Unicode and orders keys by Unicode code point", () => {
    expect(encodeCanonicalJson({ "\u{10000}": 2, "\uE000": 1, "e\u0301": "e\u0301" })).toBe(
      "{\"é\":\"é\",\"\":1,\"𐀀\":2}\n"
    )
  })

  test("rejects duplicate keys, floats, unsafe integers, and negative zero", () => {
    expect(() => parseStrictJson('{"a":1,"a":2}')).toThrow("duplicate")
    expect(() => parseStrictJson("1.5")).toThrow("floats")
    expect(() => parseStrictJson("9007199254740992")).toThrow("safe integer")
    expect(() => parseStrictJson("-0")).toThrow("non-negative-zero")
  })

  test("length framing prevents concatenation and domain confusion", () => {
    expect(hashFramed("domain/v1", ["ab", "c"])).not.toBe(
      hashFramed("domain/v1", ["a", "bc"])
    )
    expect(hashFramed("domain/v1", ["abc"])).not.toBe(
      hashFramed("other/v1", ["abc"])
    )
  })
})
