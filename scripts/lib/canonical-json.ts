import { createHash } from "node:crypto"

export type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonPrimitive | ReadonlyArray<JsonValue> | { readonly [key: string]: JsonValue }

const textEncoder = new TextEncoder()

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

const canonicalString = (value: string): string => JSON.stringify(value.normalize("NFC"))

const canonicalValue = (value: unknown, ancestors: Set<object>): string => {
  if (value === null || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "string") return canonicalString(value)
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new Error("CanonicalJsonV1 accepts safe integers only.")
    }
    return String(value)
  }
  if (typeof value !== "object") {
    throw new Error(`CanonicalJsonV1 rejects ${typeof value} values.`)
  }
  if (ancestors.has(value)) throw new Error("CanonicalJsonV1 rejects cyclic values.")
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new Error("CanonicalJsonV1 rejects sparse arrays.")
      }
      return `[${value.map((item) => canonicalValue(item, ancestors)).join(",")}]`
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("CanonicalJsonV1 accepts plain objects only.")
    }
    const normalized = new Map<string, unknown>()
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.normalize("NFC")
      if (normalized.has(normalizedKey)) {
        throw new Error(`CanonicalJsonV1 object key collision after NFC normalization: ${normalizedKey}`)
      }
      normalized.set(normalizedKey, item)
    }
    return `{${[...normalized.entries()]
      .sort(([left], [right]) => codePointCompare(left, right))
      .map(([key, item]) => `${canonicalString(key)}:${canonicalValue(item, ancestors)}`)
      .join(",")}}`
  } finally {
    ancestors.delete(value)
  }
}

export const encodeCanonicalJson = (value: unknown): string =>
  `${canonicalValue(value, new Set())}\n`

export const canonicalJsonBytes = (value: unknown): Uint8Array =>
  textEncoder.encode(encodeCanonicalJson(value))

export const sha256Hex = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex")

const frame = (bytes: Uint8Array): Uint8Array => {
  if (bytes.length > 0xffff_ffff) throw new Error("Canonical hash frame exceeds u32.")
  const framed = new Uint8Array(4 + bytes.length)
  new DataView(framed.buffer).setUint32(0, bytes.length, false)
  framed.set(bytes, 4)
  return framed
}

export const hashFramed = (
  domain: string,
  parts: ReadonlyArray<Uint8Array | string>
): string => {
  const domainBytes = textEncoder.encode(domain.normalize("NFC"))
  const hash = createHash("sha256")
  hash.update(frame(domainBytes))
  for (const part of parts) {
    hash.update(frame(typeof part === "string" ? textEncoder.encode(part) : part))
  }
  return hash.digest("hex")
}

export const canonicalJsonHash = (value: unknown): string =>
  sha256Hex(canonicalJsonBytes(value))
