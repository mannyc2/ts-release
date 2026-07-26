import { createHash } from "node:crypto"

export type Json =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<Json>
  | { readonly [key: string]: Json }

class StrictJsonParser {
  private index = 0
  constructor(private readonly text: string) {}

  parse(): Json {
    this.space()
    const value = this.value()
    this.space()
    if (this.index !== this.text.length) this.fail("trailing input")
    return value
  }

  private fail(reason: string): never {
    throw new Error(`Invalid strict JSON at ${this.index}: ${reason}`)
  }

  private space(): void {
    while (/[\t\n\r ]/u.test(this.text[this.index] ?? "")) this.index += 1
  }

  private take(expected: string): void {
    if (!this.text.startsWith(expected, this.index)) this.fail(`expected ${expected}`)
    this.index += expected.length
  }

  private value(): Json {
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
    if (token === "-" || token !== undefined && /[0-9]/u.test(token)) return this.number()
    return this.fail("expected value")
  }

  private string(): string {
    const start = this.index
    this.index += 1
    let escaped = false
    while (this.index < this.text.length) {
      const character = this.text[this.index]!
      if (!escaped && character === '"') {
        this.index += 1
        const value = JSON.parse(this.text.slice(start, this.index)) as string
        if (value !== value.normalize("NFC")) this.fail("non-NFC string")
        return value
      }
      if (!escaped && character.codePointAt(0)! < 0x20) this.fail("control character")
      escaped = !escaped && character === "\\"
      this.index += 1
    }
    return this.fail("unterminated string")
  }

  private number(): number {
    const match = /^-?(?:0|[1-9][0-9]*)/u.exec(this.text.slice(this.index))
    if (match === null) return this.fail("invalid number")
    const token = match[0]
    const next = this.text[this.index + token.length]
    if (next === "." || next === "e" || next === "E") this.fail("float")
    this.index += token.length
    const value = Number(token)
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) this.fail("unsafe integer")
    return value
  }

  private array(): ReadonlyArray<Json> {
    this.index += 1
    this.space()
    const result: Array<Json> = []
    if (this.text[this.index] === "]") {
      this.index += 1
      return result
    }
    while (true) {
      result.push(this.value())
      this.space()
      if (this.text[this.index] === "]") {
        this.index += 1
        return result
      }
      this.take(",")
      this.space()
    }
  }

  private object(): { readonly [key: string]: Json } {
    this.index += 1
    this.space()
    const result: Record<string, Json> = {}
    if (this.text[this.index] === "}") {
      this.index += 1
      return result
    }
    while (true) {
      if (this.text[this.index] !== '"') this.fail("expected object key")
      const key = this.string()
      if (Object.hasOwn(result, key)) this.fail(`duplicate key ${key}`)
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

const codePointOrder = (left: string, right: string): number => {
  const a = [...left]
  const b = [...right]
  let index = 0
  while (index < Math.min(a.length, b.length)) {
    const difference = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!
    if (difference !== 0) return difference
    index += 1
  }
  return a.length - b.length
}

const canonicalArray = (value: ReadonlyArray<unknown>, parents: Set<object>): string => {
  let index = 0
  while (index < value.length) {
    if (!Object.hasOwn(value, index)) throw new Error("sparse array")
    index += 1
  }
  return `[${value.map((item) => canonical(item, parents)).join(",")}]`
}

const canonicalObject = (value: object, parents: Set<object>): string => {
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error("non-plain object")
  const entries = Object.entries(value).map(([key, item]) => [key.normalize("NFC"), item] as const)
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new Error("normalized key collision")
  }
  entries.sort(([left], [right]) => codePointOrder(left, right))
  return `{${entries.map(([key, item]) =>
    `${JSON.stringify(key)}:${canonical(item, parents)}`).join(",")}}`
}

const canonical = (value: unknown, parents: Set<object>): string => {
  if (value === null || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"))
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new Error("unsafe number")
    return String(value)
  }
  if (typeof value !== "object") throw new Error("non-JSON value")
  if (parents.has(value)) throw new Error("cyclic value")
  parents.add(value)
  try {
    return Array.isArray(value)
      ? canonicalArray(value, parents)
      : canonicalObject(value, parents)
  } finally {
    parents.delete(value)
  }
}

const frame = (value: Uint8Array): Uint8Array => {
  const result = new Uint8Array(value.length + 4)
  new DataView(result.buffer).setUint32(0, value.length, false)
  result.set(value, 4)
  return result
}

export const parseStrictJson = (text: string): Json => new StrictJsonParser(text).parse()
export const encodeCanonicalJson = (value: unknown): string =>
  `${canonical(value, new Set())}\n`
export const hashFramed = (domain: string, parts: ReadonlyArray<Uint8Array>): string => {
  const hash = createHash("sha256")
  hash.update(frame(new TextEncoder().encode(domain.normalize("NFC"))))
  parts.forEach((part) => {
    hash.update(frame(part))
  })
  return hash.digest("hex")
}
