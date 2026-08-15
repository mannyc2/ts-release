import { gunzipSync } from "node:zlib"
import * as Schema from "effect/Schema"

const manifestLimit = 4 * 1024 * 1024
export const npmTarballCompressedBytesLimit = 512 * 1024 * 1024
const archiveLimit = 512 * 1024 * 1024
const entryLimit = 100_000

export class NpmTarballError
  extends Schema.TaggedErrorClass<NpmTarballError>()("NpmTarballError", {
    filename: Schema.NonEmptyString,
    reason: Schema.NonEmptyString,
    message: Schema.NonEmptyString
  }) {}

const fail = (filename: string, reason: string): never => {
  throw NpmTarballError.make({ filename, reason, message: reason })
}

const utf8 = (filename: string, bytes: Uint8Array): string => {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes) } catch {
    return fail(filename, "npm tarball metadata or archive path is not valid UTF-8.")
  }
}

const tarString = (filename: string, bytes: Uint8Array): string => {
  const nul = bytes.indexOf(0)
  return utf8(filename, nul < 0 ? bytes : bytes.subarray(0, nul))
}

const tarOctal = (filename: string, bytes: Uint8Array): number => {
  const value = tarString(filename, bytes).trim().replace(/^0+/u, "") || "0"
  if (!/^[0-7]+$/u.test(value)) fail(filename, "npm tarball contains an invalid octal field.")
  const parsed = Number.parseInt(value, 8)
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(filename, "npm tarball entry size is out of range.")
  return parsed
}

const safePath = (filename: string, path: string): string => {
  const checked = path.endsWith("/") ? path.slice(0, -1) : path
  if (path.length === 0 || path.includes("\0") || path.includes("\\") || path.startsWith("/") ||
      checked.length === 0 || /^[A-Za-z]:/u.test(path) ||
      checked.split("/").some((part) => part === "" || part === "." || part === "..")) {
    return fail(filename, "npm tarball contains a malformed or escaping path.")
  }
  if (checked !== "package" && !checked.startsWith("package/")) {
    return fail(filename, "npm tarball entries must remain beneath the package/ root.")
  }
  return path
}

const pax = (filename: string, bytes: Uint8Array): Readonly<Record<string, string>> => {
  const text = utf8(filename, bytes)
  const values: Record<string, string> = {}
  let offset = 0
  while (offset < text.length) {
    const space = text.indexOf(" ", offset)
    if (space < 0) fail(filename, "npm tarball PAX record is malformed.")
    const length = Number(text.slice(offset, space))
    if (!Number.isSafeInteger(length) || length <= space - offset + 1 ||
        offset + length > text.length || text[offset + length - 1] !== "\n") {
      fail(filename, "npm tarball PAX record has an invalid length.")
    }
    const record = text.slice(space + 1, offset + length - 1)
    const equals = record.indexOf("=")
    if (equals <= 0) fail(filename, "npm tarball PAX record is missing a key.")
    const key = record.slice(0, equals)
    if (Object.hasOwn(values, key)) fail(filename, `npm tarball PAX record repeats ${key}.`)
    values[key] = record.slice(equals + 1)
    offset += length
  }
  if (Object.hasOwn(values, "linkpath") || Object.hasOwn(values, "size") ||
      Object.keys(values).some((key) => key.startsWith("GNU.sparse"))) {
    fail(filename, "npm tarball PAX record attempts to override link, size, or sparse-file semantics.")
  }
  return values
}

const localDependency = (value: string): string | undefined => {
  const normalized = value.trim().toLowerCase()
  const protocol = /^(workspace|file|link|portal):/u.exec(normalized)?.[1]
  if (protocol !== undefined) return protocol
  if (/^(?:\.{1,2}[\\/]|[\\/]|~[\\/]|[a-z]:)/u.test(normalized)) return "path"
  return undefined
}

const inspectManifest = (
  filename: string,
  bytes: Uint8Array,
  expectedName: string,
  expectedVersion: string
): { readonly packageName: string, readonly version: string } => {
  if (bytes.length === 0 || bytes.length > manifestLimit) {
    fail(filename, "npm tarball package.json has an invalid size.")
  }
  let value: unknown
  try { value = JSON.parse(utf8(filename, bytes)) } catch {
    return fail(filename, "npm tarball package.json is not valid JSON.")
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(filename, "npm tarball package.json root must be an object.")
  }
  const manifest = value as Record<string, unknown>
  if (typeof manifest.name !== "string" || manifest.name !== expectedName) {
    fail(filename, "npm tarball embedded package name disagrees with the resolved publication coordinate.")
  }
  if (typeof manifest.version !== "string" || manifest.version !== expectedVersion) {
    fail(filename, "npm tarball embedded package version disagrees with the resolved publication coordinate.")
  }
  const packageName = manifest.name as string
  const version = manifest.version as string
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"] as const) {
    const dependencies = manifest[field]
    if (dependencies === undefined) continue
    if (typeof dependencies !== "object" || dependencies === null || Array.isArray(dependencies)) {
      fail(filename, `npm tarball package.json ${field} must be an object.`)
    }
    for (const [name, specifier] of Object.entries(dependencies as Record<string, unknown>)) {
      if (typeof specifier !== "string") {
        fail(filename, `npm tarball package.json ${field}.${name} must be a string.`)
      }
      const local = localDependency(specifier as string)
      if (local !== undefined) {
        fail(filename, `npm tarball package.json contains a ${local} dependency at ${field}.${name}.`)
      }
    }
  }
  return { packageName, version }
}

/** Strictly validate one already-packed npm tarball against its resolved identity. */
export const inspectPrepackedNpmTarball = (
  filename: string,
  bytes: Uint8Array,
  expectedName: string,
  expectedVersion: string
): { readonly packageName: string, readonly version: string } => {
  if (filename.length === 0 || filename.includes("/") || filename.includes("\\") || !filename.endsWith(".tgz")) {
    fail(filename || "<empty>", "npm tarball filename must be a .tgz basename.")
  }
  let tar: Uint8Array
  try { tar = new Uint8Array(gunzipSync(bytes, { maxOutputLength: archiveLimit })) } catch {
    return fail(filename, "npm tarball is not a bounded valid gzip stream.")
  }
  let offset = 0
  let entries = 0
  let ended = false
  let pendingPax: Readonly<Record<string, string>> | undefined
  const paths = new Set<string>()
  const manifests: Array<Uint8Array> = []
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      if (!tar.subarray(offset).every((byte) => byte === 0)) {
        fail(filename, "npm tarball has nonzero data after its end marker.")
      }
      ended = true
      break
    }
    entries += 1
    if (entries > entryLimit) fail(filename, "npm tarball exceeds the supported entry count.")
    let checksum = 0
    for (let index = 0; index < 512; index += 1) checksum += index >= 148 && index < 156 ? 32 : header[index]!
    if (checksum !== tarOctal(filename, header.subarray(148, 156))) {
      fail(filename, "npm tarball header checksum is invalid.")
    }
    const size = tarOctal(filename, header.subarray(124, 136))
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    const next = dataStart + Math.ceil(size / 512) * 512
    if (dataEnd > tar.length || next > tar.length) fail(filename, "npm tarball entry is truncated.")
    const type = String.fromCharCode(header[156]!)
    const rawName = tarString(filename, header.subarray(0, 100))
    const prefix = tarString(filename, header.subarray(345, 500))
    const rawPath = prefix.length === 0 ? rawName : `${prefix}/${rawName}`
    if (type === "x") {
      if (pendingPax !== undefined) fail(filename, "npm tarball repeats local PAX metadata before an entry.")
      pendingPax = pax(filename, tar.subarray(dataStart, dataEnd))
    } else {
      const path = safePath(filename, pendingPax?.path ?? rawPath)
      pendingPax = undefined
      if (type === "1" || type === "2") fail(filename, "npm tarball contains a hard or symbolic link.")
      if (!["\0", "0", "5"].includes(type)) fail(filename, "npm tarball contains an unsupported entry type.")
      const folded = path.replace(/\/$/u, "").toLocaleLowerCase("en-US")
      if (paths.has(folded)) fail(filename, `npm tarball contains a duplicate or case-colliding path ${path}.`)
      paths.add(folded)
      if ((type === "\0" || type === "0") && path === "package/package.json") {
        if (size > manifestLimit) fail(filename, "npm tarball package.json exceeds the supported bound.")
        manifests.push(tar.subarray(dataStart, dataEnd))
      }
    }
    offset = next
  }
  if (!ended || pendingPax !== undefined) fail(filename, "npm tarball is missing a complete end marker or PAX target.")
  if (manifests.length !== 1) fail(filename, "npm tarball requires exactly one package/package.json entry; duplicate manifests are forbidden.")
  return inspectManifest(filename, manifests[0]!, expectedName, expectedVersion)
}
