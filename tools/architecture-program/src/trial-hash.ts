import { createHash } from "node:crypto"
import { Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import { Sha256Hex as Sha256HexSchema, type Sha256Hex } from "./schema/primitives.js"

const textEncoder = new TextEncoder()
const maximumFrameLength = 0xffff_ffff
const decodeSha256Hex = Schema.decodeUnknownSync(Sha256HexSchema)

const validateDomain = (domain: string): void => {
  if (domain.length === 0) {
    throw new TypeError("Hash domain must not be empty.")
  }
  if (!domain.isWellFormed()) {
    throw new TypeError("Hash domain must not contain an unpaired UTF-16 surrogate.")
  }
  if (domain !== domain.normalize("NFC")) {
    throw new TypeError("Hash domain must be NFC-normalized.")
  }
  if (domain.includes("\u0000")) {
    throw new TypeError("Hash domain must not contain NUL.")
  }
}

const lengthPrefix = (byteLength: number): Uint8Array => {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > maximumFrameLength) {
    throw new RangeError("Hash frame exceeds the unsigned 32-bit byte-length limit.")
  }
  const prefix = new Uint8Array(4)
  new DataView(prefix.buffer).setUint32(0, byteLength, false)
  return prefix
}

/** Computes SHA-256 over the supplied bytes and validates the branded digest. */
export const sha256Bytes = (bytes: Uint8Array): Sha256Hex =>
  decodeSha256Hex(createHash("sha256").update(bytes).digest("hex"))

/** Hashes newline-terminated CanonicalJsonV1 bytes in an unambiguous domain frame. */
export const hashCanonicalValue = (domain: string, value: unknown): Sha256Hex => {
  validateDomain(domain)
  const domainBytes = textEncoder.encode(domain)
  const payloadBytes = canonicalJsonBytes(value)
  const digest = createHash("sha256")
    .update(lengthPrefix(domainBytes.byteLength))
    .update(domainBytes)
    .update(lengthPrefix(payloadBytes.byteLength))
    .update(payloadBytes)
    .digest("hex")
  return decodeSha256Hex(digest)
}

/** Validates CanonicalJsonV1 and hashes the exact document bytes without re-encoding. */
export const hashCanonicalDocumentBytes = (bytes: Uint8Array): Sha256Hex => {
  parseCanonicalJsonBytes(bytes)
  return sha256Bytes(bytes)
}
