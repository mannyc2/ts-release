import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"

const lowercaseHex = (algorithm: "sha1" | "sha256" | "sha512", length: number) =>
  Schema.String.check(Schema.makeFilter((value: string) =>
    new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value)
      ? undefined
      : `${algorithm} digest bytes must be exactly ${length} lowercase hexadecimal characters.`
  )).pipe(Schema.brand(`${algorithm}Hex`))

export const Sha1Hex = lowercaseHex("sha1", 40)
export type Sha1Hex = typeof Sha1Hex.Type

export const Sha256Hex = lowercaseHex("sha256", 64)
export type Sha256Hex = typeof Sha256Hex.Type

export const Sha512Hex = lowercaseHex("sha512", 128)
export type Sha512Hex = typeof Sha512Hex.Type

export class Sha1Digest
  extends Schema.TaggedClass<Sha1Digest>()("Sha1Digest", {
    algorithm: Schema.Literal("sha1"),
    hex: Sha1Hex
  }) {}

export class Sha256Digest
  extends Schema.TaggedClass<Sha256Digest>()("Sha256Digest", {
    algorithm: Schema.Literal("sha256"),
    hex: Sha256Hex
  }) {}

export class Sha512Digest
  extends Schema.TaggedClass<Sha512Digest>()("Sha512Digest", {
    algorithm: Schema.Literal("sha512"),
    hex: Sha512Hex
  }) {}

export const AlgorithmDigest = Schema.Union([
  Sha1Digest,
  Sha256Digest,
  Sha512Digest
])
export type AlgorithmDigest = typeof AlgorithmDigest.Type

export const DigestEncoding = Schema.Literals([
  "sha1-hex",
  "sha256-hex",
  "sha512-hex",
  "github-sha256",
  "npm-sha512-sri",
  "npm-sha1-shasum"
])
export type DigestEncoding = typeof DigestEncoding.Type

export class DigestCodecError
  extends Schema.TaggedErrorClass<DigestCodecError>()("DigestCodecError", {
    encoding: DigestEncoding,
    reason: Schema.NonEmptyString
  }) {}

const decodeHex = (
  value: unknown,
  encoding: "sha1-hex" | "sha256-hex" | "sha512-hex",
  length: 40 | 64 | 128
): string => {
  if (typeof value !== "string" ||
      !new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value)) {
    throw new DigestCodecError({
      encoding,
      reason: `Value is not a canonical ${encoding} digest encoding.`
    })
  }
  return value
}

export const parseSha1Hex = (value: unknown): Sha1Digest => Sha1Digest.make({
  algorithm: "sha1",
  hex: Sha1Hex.make(decodeHex(value, "sha1-hex", 40))
})

export const parseSha256Hex = (value: unknown): Sha256Digest => Sha256Digest.make({
  algorithm: "sha256",
  hex: Sha256Hex.make(decodeHex(value, "sha256-hex", 64))
})

export const parseSha512Hex = (value: unknown): Sha512Digest => Sha512Digest.make({
  algorithm: "sha512",
  hex: Sha512Hex.make(decodeHex(value, "sha512-hex", 128))
})

export const formatSha1Hex = (digest: Sha1Digest): Sha1Hex => digest.hex
export const formatSha256Hex = (digest: Sha256Digest): Sha256Hex => digest.hex
export const formatSha512Hex = (digest: Sha512Digest): Sha512Hex => digest.hex

export const parseGitHubSha256 = (value: unknown): Sha256Digest => {
  if (typeof value !== "string" || !value.startsWith("sha256:")) {
    throw new DigestCodecError({
      encoding: "github-sha256",
      reason: "GitHub SHA-256 must use the canonical sha256:<lowercase-hex> encoding."
    })
  }
  try {
    return parseSha256Hex(value.slice("sha256:".length))
  } catch {
    throw new DigestCodecError({
      encoding: "github-sha256",
      reason: "GitHub SHA-256 must use the canonical sha256:<lowercase-hex> encoding."
    })
  }
}

export const formatGitHubSha256 = (digest: Sha256Digest): string =>
  `sha256:${formatSha256Hex(digest)}`

export const parseNpmSha512Sri = (value: unknown): Sha512Digest => {
  if (typeof value !== "string" || !value.startsWith("sha512-")) {
    throw new DigestCodecError({
      encoding: "npm-sha512-sri",
      reason: "npm SHA-512 integrity must use the canonical sha512-<base64> SRI encoding."
    })
  }
  const encoded = value.slice("sha512-".length)
  if (!/^[A-Za-z0-9+/]{86}==$/u.test(encoded)) {
    throw new DigestCodecError({
      encoding: "npm-sha512-sri",
      reason: "npm SHA-512 integrity contains malformed or noncanonical base64."
    })
  }
  const bytes = Buffer.from(encoded, "base64")
  if (bytes.length !== 64 || bytes.toString("base64") !== encoded) {
    throw new DigestCodecError({
      encoding: "npm-sha512-sri",
      reason: "npm SHA-512 integrity contains malformed or noncanonical base64."
    })
  }
  return parseSha512Hex(bytes.toString("hex"))
}

export const formatNpmSha512Sri = (digest: Sha512Digest): string =>
  `sha512-${Buffer.from(formatSha512Hex(digest), "hex").toString("base64")}`

export const parseNpmSha1Shasum = (value: unknown): Sha1Digest => {
  try {
    const parsed = parseSha1Hex(value)
    return Sha1Digest.make({ algorithm: "sha1", hex: parsed.hex })
  } catch {
    throw new DigestCodecError({
      encoding: "npm-sha1-shasum",
      reason: "npm shasum must be exactly 40 lowercase hexadecimal SHA-1 characters."
    })
  }
}

export const formatNpmSha1Shasum = (digest: Sha1Digest): string =>
  formatSha1Hex(digest)

const hashHex = (algorithm: "sha1" | "sha256" | "sha512", bytes: Uint8Array): string =>
  createHash(algorithm).update(bytes).digest("hex")

export const sha1Digest = (bytes: Uint8Array): Sha1Digest =>
  parseSha1Hex(hashHex("sha1", bytes))

export const sha256Digest = (bytes: Uint8Array): Sha256Digest =>
  parseSha256Hex(hashHex("sha256", bytes))

export const sha512Digest = (bytes: Uint8Array): Sha512Digest =>
  parseSha512Hex(hashHex("sha512", bytes))

export const digestEquals = (
  left: AlgorithmDigest,
  right: AlgorithmDigest
): boolean => left.algorithm === right.algorithm && left.hex === right.hex
