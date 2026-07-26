import type { JsonValue } from "./canonical-json.js"

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
    throw new Error(`Invalid strict JSON at offset ${this.index}: ${reason}.`)
  }

  private space(): void {
    while (/[\t\n\r ]/u.test(this.text[this.index] ?? "")) this.index += 1
  }

  private take(expected: string): void {
    if (!this.text.startsWith(expected, this.index)) this.fail(`expected ${JSON.stringify(expected)}`)
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
    if (token === "-" || (token !== undefined && /[0-9]/u.test(token))) return this.number()
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
        const parsed = JSON.parse(this.text.slice(start, this.index)) as string
        if (parsed !== parsed.normalize("NFC")) this.fail("string is not NFC-normalized")
        return parsed
      }
      if (!escaped && character.codePointAt(0)! < 0x20) this.fail("unescaped control character")
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
    const result: Record<string, JsonValue> = {}
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

export const parseStrictJson = (text: string): JsonValue => new JsonParser(text).parse()

export const expectObject = (
  value: JsonValue,
  name: string
): { readonly [key: string]: JsonValue } => {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${name} must be an object.`)
  }
  if (Array.isArray(value)) throw new Error(`${name} must be an object.`)
  return value as { readonly [key: string]: JsonValue }
}

export const expectExactKeys = (
  value: { readonly [key: string]: JsonValue },
  required: ReadonlyArray<string>,
  optional: ReadonlyArray<string> = []
): void => {
  const permitted = new Set([...required, ...optional])
  const missing = required.filter((key) => !(key in value))
  const excess = Object.keys(value).filter((key) => !permitted.has(key))
  if (missing.length > 0 || excess.length > 0) {
    throw new Error(
      `Strict object keys mismatch; missing=[${missing.join(",")}], excess=[${excess.join(",")}].`
    )
  }
}
