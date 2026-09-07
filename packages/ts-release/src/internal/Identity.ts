import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { ReleaseError, attempt, fail } from "./Error.js"

/** Canonical JSON includes every owned field; hidden data and accessors reject. */
export const canonical = (input: unknown): string => {
  const active = new Set<object>()
  const visit = (value: unknown): string => {
    if (value === null || typeof value === "boolean") return JSON.stringify(value)
    if (typeof value === "string") {
      if (value !== value.normalize("NFC"))
        fail("noncanonical-string", "Strings must already be NFC")
      if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))
        fail("invalid-string", "Unpaired surrogate")
      return JSON.stringify(value)
    }
    if (typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0))
      return String(value)
    if (typeof value !== "object" || value === null)
      return fail("invalid-json", "Only canonical JSON values and safe integers are allowed")
    if (active.has(value)) fail("cyclic-data", "Canonical data cannot contain cycles")
    active.add(value)
    const array = Array.isArray(value)
    const keys = Reflect.ownKeys(value).filter((key) => !(array && key === "length"))
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (typeof key !== "string" || !descriptor.enumerable || !("value" in descriptor))
        fail("hidden-data", "Canonical data cannot contain symbols, hidden properties or accessors")
    }
    let encoded: string
    if (array) {
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index)))
        fail("invalid-json-array", "Arrays must be dense and contain only indexed elements")
      encoded = `[${value.map(visit).join(",")}]`
    } else {
      let prototype = Object.getPrototypeOf(value)
      let schemaClass = false
      while (prototype && prototype !== Object.prototype) {
        if (
          Reflect.ownKeys(prototype).some(
            (key) => typeof key === "string" && key.startsWith("~effect/Schema/Class/"),
          )
        )
          schemaClass = true
        prototype = Object.getPrototypeOf(prototype)
      }
      if (
        Object.getPrototypeOf(value) !== null &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        !schemaClass
      )
        fail("invalid-json-object", "Only plain records and Schema classes are canonical data")
      encoded = `{${(keys as string[])
        .sort()
        .map((key) => `${visit(key)}:${visit(Object.getOwnPropertyDescriptor(value, key)!.value)}`)
        .join(",")}}`
    }
    active.delete(value)
    return encoded
  }
  return visit(input)
}

/** Copy only admitted data; never retain caller aliases behind durable identities. */
export const copyData = (input: unknown): unknown => JSON.parse(canonical(input))
/** Unicode scalar order equals UTF-8 byte order for admitted strings. */
export const compareText = (left: string, right: string): number => {
  const a = [...left],
    b = [...right]
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!
    if (difference) return difference
  }
  return a.length - b.length
}
export const freeze = <A>(value: A): A => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
/** Own the complete wire value before decoding; preserve durable Schema classes. */
export const decodeOwned = <A, I>(codec: Schema.Codec<A, I>, input: unknown): A =>
  freeze(Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(copyData(input)))

export const parseCanonical = (text: string): unknown => {
  const value: unknown = JSON.parse(text)
  if (canonical(value) !== text)
    fail("noncanonical-json", "Input must be exact canonical JSON, without duplicate keys")
  return value
}
export const sha256 = Effect.fn("ts-release.sha256")(function* (bytes: Uint8Array) {
  const digest = yield* Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    catch: () =>
      new ReleaseError({ code: "digest-failed", message: "Host WebCrypto SHA-256 failed" }),
  })
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
})
export const hashCanonical = Effect.fn("ts-release.hashCanonical")(function* (
  domain: string,
  value: unknown,
) {
  const encoded = yield* attempt(() => canonical(value))
  const utf8 = new TextEncoder()
  const domainBytes = utf8.encode(domain)
  const payloadBytes = utf8.encode(encoded)
  const prefix = utf8.encode(`${domainBytes.length}:`)
  const middle = utf8.encode(`${payloadBytes.length}:`)
  const bytes = new Uint8Array(
    prefix.length + domainBytes.length + middle.length + payloadBytes.length,
  )
  bytes.set(prefix)
  bytes.set(domainBytes, prefix.length)
  bytes.set(middle, prefix.length + domainBytes.length)
  bytes.set(payloadBytes, prefix.length + domainBytes.length + middle.length)
  return yield* sha256(bytes)
})
