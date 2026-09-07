import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Model from "./Model.js"
import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { ReleaseError } from "@mannyc1/ts-release"
import { verifiedArtifacts, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import { decodeJson as parseJson } from "@mannyc1/ts-release/http"

export const invalid = (code: string): never => {
  throw new ReleaseError({
    code: `npm-${code}`,
    message: `npm ${code.replaceAll("-", " ")} could not be admitted`,
  })
}
export const attempt = <A>(body: () => A) =>
  Effect.try({
    try: body,
    catch: (error) =>
      error instanceof ReleaseError
        ? error
        : new ReleaseError({ code: "npm-data", message: "npm data could not be admitted" }),
  })
export const digest = (algorithm: string, bytes: Uint8Array) =>
  createHash(algorithm).update(bytes).digest("hex")
export const encode = (input: unknown) => new TextEncoder().encode(JSON.stringify(input))
export const object = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("object")
  return input as Record<string, unknown>
}

export { decodeJson as parseJson } from "@mannyc1/ts-release/http"
const tarString = (bytes: Uint8Array) =>
  new TextDecoder("utf-8", { fatal: true }).decode(
    bytes.subarray(0, bytes.indexOf(0) < 0 ? bytes.length : bytes.indexOf(0)),
  )
const tarNumber = (bytes: Uint8Array) => {
  const text = tarString(bytes).trim()
  if (!/^[0-7]+$/u.test(text)) return invalid("tar-number")
  const value = Number.parseInt(text, 8)
  if (!Number.isSafeInteger(value)) invalid("tar-number")
  return value
}
/** Native package metadata is extracted from the exact bounded owned tarball. */
export const readManifest = (bytes: Uint8Array): Record<string, unknown> => {
  const tar = gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 })
  let offset = 0,
    pathOverride: string | undefined,
    manifest: Uint8Array | undefined,
    ended = false
  const paths = new Set<string>()
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      if (tar.length - offset < 1024 || !tar.subarray(offset).every((byte) => byte === 0))
        invalid("tar-end")
      ended = true
      break
    }
    const checksum = header.reduce(
      (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
      0,
    )
    if (checksum !== tarNumber(header.subarray(148, 156))) invalid("tar-checksum")
    const size = tarNumber(header.subarray(124, 136)),
      type = header[156],
      start = offset + 512
    if (start + Math.ceil(size / 512) * 512 > tar.length) invalid("tar-truncated")
    const data = tar.subarray(start, start + size)
    if (type === 120 || type === 76) {
      if (pathOverride !== undefined) invalid("tar-extension-chain")
      if (type === 76) pathOverride = tarString(data)
      else {
        let cursor = 0
        while (cursor < data.length) {
          const space = data.indexOf(32, cursor),
            lengthText = new TextDecoder().decode(data.subarray(cursor, space))
          if (space < cursor || !/^[1-9][0-9]*$/u.test(lengthText)) invalid("tar-pax-length")
          const length = Number(lengthText),
            end = cursor + length
          if (
            !Number.isSafeInteger(length) ||
            end <= space + 1 ||
            end > data.length ||
            data[end - 1] !== 10
          )
            invalid("tar-pax-length")
          const entry = new TextDecoder("utf-8", { fatal: true }).decode(
            data.subarray(space + 1, end - 1),
          )
          if (!entry.startsWith("path=") || pathOverride !== undefined) invalid("tar-pax-key")
          pathOverride = entry.slice(5)
          cursor = end
        }
        if (pathOverride === undefined) invalid("tar-pax-empty")
      }
    } else {
      const prefix = tarString(header.subarray(345, 500))
      let path =
        pathOverride ?? `${prefix ? `${prefix}/` : ""}${tarString(header.subarray(0, 100))}`
      pathOverride = undefined
      if (![0, 48, 53].includes(type!)) invalid("tar-entry-type")
      if (type === 53) path = path.replace(/\/$/u, "")
      if (
        path !== path.normalize("NFC") ||
        path.includes("\\") ||
        path.split("/").some((part) => !part || part === "." || part === "..") ||
        !(path === "package" || path.startsWith("package/"))
      )
        invalid("tar-path")
      const folded = path.toLowerCase()
      if (paths.has(folded)) invalid("tar-duplicate-path")
      paths.add(folded)
      if (type === 53 && size !== 0) invalid("tar-directory-bytes")
      if (path === "package/package.json" && type !== 53) {
        if (manifest || size > 1024 * 1024) invalid("tar-manifest")
        manifest = data
      }
    }
    offset = start + Math.ceil(size / 512) * 512
  }
  if (!ended || !manifest || pathOverride !== undefined) invalid("tar-manifest")
  return object(parseJson(manifest!))
}

export const own = <A, I>(codec: Schema.Codec<A, I>, input: unknown): A => {
  const decode = Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })
  const value = decode(input)
  return decode(parseJson(encode(Schema.encodeSync(codec)(value))))
}
export const captureArtifacts = (access: ArtifactAccess) =>
  verifiedArtifacts(access, 128 * 1024 * 1024)
export const metadataUrl = (packageName: string) =>
  `https://registry.npmjs.org/${encodeURIComponent(packageName).replace(/^%40/u, "@").replace(/%2F/gu, "%2f")}`
export class NativeScope extends Schema.Class<NativeScope>("NpmNativeScope")({
  definitionId: Schema.Literals(["npm.publish", "npm.dist-tag"]),
  intent: Schema.Union([Model.publishCodec, Model.DistTagIntent]),
}) {
  get name() {
    return this.intent.name
  }
  get version() {
    return this.intent.version
  }
  get tag() {
    return "initialTag" in this.intent ? this.intent.initialTag : this.intent.tag
  }
  get authorization() {
    return this.intent.authorization
  }
}
export const scopeFor = (input: Model.PublishIntent | Model.DistTagIntent): string => {
  const intent =
    "initialTag" in input ? own(Model.publishCodec, input) : own(Model.DistTagIntent, input)
  return JSON.stringify(
    new NativeScope({
      definitionId: "initialTag" in intent ? "npm.publish" : "npm.dist-tag",
      intent,
    }),
  )
}
export const readScope = (scope: string): NativeScope => {
  const value = own(NativeScope, parseJson(new TextEncoder().encode(scope)))
  if (
    value.definitionId !== ("initialTag" in value.intent ? "npm.publish" : "npm.dist-tag") ||
    JSON.stringify(value) !== scope
  )
    invalid("scope-encoding")
  return value
}
export const endpointFor = (scope: NativeScope, read = false): string =>
  read || scope.definitionId === "npm.publish"
    ? metadataUrl(scope.name)
    : `https://registry.npmjs.org/-/package/${encodeURIComponent(scope.name).replace(/^%40/u, "@").replace(/%2F/gu, "%2f")}/dist-tags/${encodeURIComponent(scope.tag)}`
