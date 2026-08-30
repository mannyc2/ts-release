import { Schema } from "effect"

export type JsonPrimitive = boolean | null | number | string

export type JsonValue =
  | JsonPrimitive
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue }

/** A syntactically or semantically invalid strict JSON document. */
export class StrictJsonError extends Schema.TaggedError<StrictJsonError>()("StrictJsonError", {
  offset: Schema.Natural,
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(
    offset: number,
    reason: string
  ) {
    super({ offset, reason, message: `Invalid strict JSON at offset ${offset}: ${reason}.` })
  }
}

/** A JavaScript value that cannot be represented by CanonicalJsonV1. */
export class CanonicalJsonError extends Schema.TaggedError<CanonicalJsonError>()("CanonicalJsonError", {
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(reason: string) {
    super({ reason, message: `Invalid CanonicalJsonV1 value: ${reason}.` })
  }
}

/** JSON that is valid under the value rules, but is not canonically encoded. */
export class NonCanonicalDocumentError extends Schema.TaggedError<NonCanonicalDocumentError>()(
  "NonCanonicalDocumentError",
  { reason: Schema.String, message: Schema.String }
) {
  constructor(reason: string) {
    super({ reason, message: `Non-canonical JSON document: ${reason}.` })
  }
}

class JsonParser {
  private index = 0

  constructor(private readonly text: string) {}

  parse(): JsonValue {
    this.space()
    const value = this.value()
    this.space()
    if (this.index !== this.text.length) this.fail("unexpected trailing input")
    return value
  }

  private fail(reason: string): never {
    throw new StrictJsonError(this.index, reason)
  }

  private space(): void {
    while (/^[\t\n\r ]$/u.test(this.text[this.index] ?? "")) this.index += 1
  }

  private take(expected: string): void {
    if (!this.text.startsWith(expected, this.index)) {
      this.fail(`expected ${JSON.stringify(expected)}`)
    }
    this.index += expected.length
  }

  private value(): JsonValue {
    const token = this.text[this.index]
    if (token === "{") return this.object()
    if (token === "[") return this.array()
    if (token === '"') return this.string()
    if (token === "t") {
      this.take("true")
      return true
    }
    if (token === "f") {
      this.take("false")
      return false
    }
    if (token === "n") {
      this.take("null")
      return null
    }
    if (token === "-" || (token !== undefined && /^[0-9]$/u.test(token))) {
      return this.number()
    }
    return this.fail("expected a JSON value")
  }

  private string(): string {
    const start = this.index
    this.index += 1
    let escaped = false
    while (this.index < this.text.length) {
      const character = this.text[this.index]!
      if (!escaped && character === '"') {
        this.index += 1
        let parsed: string
        try {
          parsed = JSON.parse(this.text.slice(start, this.index)) as string
        } catch {
          return this.fail("invalid string escape")
        }
        if (!parsed.isWellFormed()) {
          return this.fail("string contains an unpaired UTF-16 surrogate")
        }
        if (parsed !== parsed.normalize("NFC")) {
          return this.fail("string is not NFC-normalized")
        }
        return parsed
      }
      if (!escaped && character.codePointAt(0)! < 0x20) {
        return this.fail("unescaped control character")
      }
      if (!escaped && character === "\\") {
        escaped = true
      } else {
        escaped = false
      }
      this.index += 1
    }
    return this.fail("unterminated string")
  }

  private number(): number {
    const rest = this.text.slice(this.index)
    const match = /^-?(?:0|[1-9][0-9]*)/u.exec(rest)
    if (match === null) return this.fail("invalid number")
    const token = match[0]
    const next = rest[token.length]
    if (next === "." || next === "e" || next === "E") {
      return this.fail("floats are not permitted")
    }
    this.index += token.length
    const value = Number(token)
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      return this.fail("number is not a non-negative-zero safe integer")
    }
    return value
  }

  private array(): ReadonlyArray<JsonValue> {
    this.index += 1
    this.space()
    const values: Array<JsonValue> = []
    if (this.text[this.index] === "]") {
      this.index += 1
      return values
    }
    while (true) {
      values.push(this.value())
      this.space()
      if (this.text[this.index] === "]") {
        this.index += 1
        return values
      }
      this.take(",")
      this.space()
    }
  }

  private object(): { readonly [key: string]: JsonValue } {
    this.index += 1
    this.space()
    const result = Object.create(null) as Record<string, JsonValue>
    const keys = new Set<string>()
    if (this.text[this.index] === "}") {
      this.index += 1
      return result
    }
    while (true) {
      if (this.text[this.index] !== '"') this.fail("expected an object key")
      const key = this.string()
      if (keys.has(key)) this.fail(`duplicate object key ${JSON.stringify(key)}`)
      keys.add(key)
      this.space()
      this.take(":")
      this.space()
      result[key] = this.value()
      this.space()
      if (this.text[this.index] === "}") {
        this.index += 1
        return result
      }
      this.take(",")
      this.space()
    }
  }
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })

const codePointCompare = (left: string, right: string): number => {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const leftPoint = leftPoints[index]!.codePointAt(0)!
    const rightPoint = rightPoints[index]!.codePointAt(0)!
    if (leftPoint !== rightPoint) return leftPoint - rightPoint
  }
  return leftPoints.length - rightPoints.length
}

const assertNfc = (value: string, description: string): void => {
  if (!value.isWellFormed()) {
    throw new CanonicalJsonError(`${description} contains an unpaired UTF-16 surrogate`)
  }
  if (value !== value.normalize("NFC")) {
    throw new CanonicalJsonError(`${description} is not NFC-normalized`)
  }
}

const canonicalString = (value: string, description: string): string => {
  assertNfc(value, description)
  return JSON.stringify(value)
}

const canonicalValue = (value: unknown, ancestors: Set<object>): string => {
  if (value === null || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "string") return canonicalString(value, "string")
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new CanonicalJsonError("only safe integers other than negative zero are accepted")
    }
    return String(value)
  }
  if (typeof value !== "object") {
    throw new CanonicalJsonError(`${typeof value} values are rejected`)
  }
  if (ancestors.has(value)) throw new CanonicalJsonError("cyclic values are rejected")
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const expectedKeys = new Set<PropertyKey>(["length"])
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new CanonicalJsonError("sparse arrays are rejected")
        }
        expectedKeys.add(String(index))
        const descriptor = Object.getOwnPropertyDescriptor(value, index)
        if (descriptor === undefined || !("value" in descriptor)) {
          throw new CanonicalJsonError("array accessors are rejected")
        }
      }
      const unexpectedKey = Reflect.ownKeys(value).find((key) => !expectedKeys.has(key))
      if (unexpectedKey !== undefined) {
        throw new CanonicalJsonError("array properties other than canonical indices and length are rejected")
      }
      return `[${value.map((item) => canonicalValue(item, ancestors)).join(",")}]`
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonError("only plain objects are accepted")
    }
    const entries: Array<[string, unknown]> = []
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new CanonicalJsonError("symbol object keys are rejected")
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new CanonicalJsonError("object accessors are rejected")
      }
      if (!descriptor.enumerable) {
        throw new CanonicalJsonError("non-enumerable object properties are rejected")
      }
      assertNfc(key, `object key ${JSON.stringify(key)}`)
      entries.push([key, descriptor.value])
    }
    return `{${entries
      .sort(([left], [right]) => codePointCompare(left, right))
      .map(([key, item]) => `${canonicalString(key, "object key")}:${canonicalValue(item, ancestors)}`)
      .join(",")}}`
  } finally {
    ancestors.delete(value)
  }
}

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

/** Parses JSON while rejecting duplicate keys, floats, unsafe integers, -0, and non-NFC text. */
export const parseStrictJson = (text: string): JsonValue => new JsonParser(text).parse()

/** Encodes a supported value as newline-terminated CanonicalJsonV1 text. */
export const encodeCanonicalJson = (value: unknown): string =>
  `${canonicalValue(value, new Set())}\n`

/** Encodes a supported value as newline-terminated UTF-8 CanonicalJsonV1 bytes. */
export const canonicalJsonBytes = (value: unknown): Uint8Array =>
  textEncoder.encode(encodeCanonicalJson(value))

/**
 * Parses CanonicalJsonV1 text and rejects any byte-significant representation
 * drift, including whitespace, key order, or alternate string escaping.
 */
export const parseCanonicalJson = (text: string): JsonValue => {
  const value = parseStrictJson(text)
  if (encodeCanonicalJson(value) !== text) {
    throw new NonCanonicalDocumentError("encoding differs from CanonicalJsonV1")
  }
  return value
}

/** Parses canonical UTF-8 bytes, rejecting malformed UTF-8 and all encoding drift. */
export const parseCanonicalJsonBytes = (bytes: Uint8Array): JsonValue => {
  let text: string
  try {
    text = textDecoder.decode(bytes)
  } catch {
    throw new NonCanonicalDocumentError("document is not valid UTF-8")
  }
  const value = parseStrictJson(text)
  if (!equalBytes(canonicalJsonBytes(value), bytes)) {
    throw new NonCanonicalDocumentError("bytes differ from CanonicalJsonV1")
  }
  return value
}
