import { gunzipSync, inflateRawSync } from "node:zlib"
import * as Schema from "effect/Schema"
import { normalizePyPiProjectName, PyPiProjectName } from "./pypi.js"
import { NonEmptyName, Version } from "./primitives.js"

const metadataLimit = 4 * 1024 * 1024
const archiveLimit = 512 * 1024 * 1024

export class PythonDistributionError
  extends Schema.TaggedErrorClass<PythonDistributionError>()("PythonDistributionError", {
    filename: Schema.NonEmptyString,
    reason: Schema.NonEmptyString
  }) {}

export class WheelDistribution extends Schema.TaggedClass<WheelDistribution>()("wheel", {
  project: PyPiProjectName,
  version: Version,
  metadataVersion: NonEmptyName,
  pythonTag: NonEmptyName,
  abiTag: NonEmptyName,
  platformTag: NonEmptyName,
  mediaType: Schema.Literal("application/zip")
}) {}

export class SourceDistribution extends Schema.TaggedClass<SourceDistribution>()("sdist", {
  project: PyPiProjectName,
  version: Version,
  metadataVersion: NonEmptyName,
  pythonTag: Schema.Literal("source"),
  mediaType: Schema.Literal("application/gzip")
}) {}

export const PythonDistribution = Schema.Union([WheelDistribution, SourceDistribution])
export type PythonDistribution = typeof PythonDistribution.Type

const fail = (filename: string, reason: string): never => {
  throw PythonDistributionError.make({ filename, reason })
}

const safePath = (filename: string, path: string): string => {
  const checked = path.endsWith("/") ? path.slice(0, -1) : path
  if (path.length === 0 || path.includes("\0") || path.includes("\\") || path.startsWith("/") ||
      checked.length === 0 || /^[A-Za-z]:/u.test(path) || checked.split("/").some((part) => part === ".." || part === "")) {
    fail(filename, "Distribution archive contains a malformed or escaping path.")
  }
  return path
}

const utf8 = (filename: string, bytes: Uint8Array): string => {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes) } catch {
    return fail(filename, "Distribution metadata or archive path is not valid UTF-8.")
  }
}

type CoreMetadata = {
  readonly name: string
  readonly project: string
  readonly version: string
  readonly metadataVersion: string
}

const coreMetadata = (filename: string, bytes: Uint8Array): CoreMetadata => {
  if (bytes.length === 0 || bytes.length > metadataLimit) fail(filename, "Distribution core metadata has an invalid size.")
  const lines = utf8(filename, bytes).replaceAll("\r\n", "\n").split("\n")
  const values = new Map<string, Array<string>>()
  let current: string | undefined
  for (const line of lines) {
    if (line === "") break
    if (/^[ \t]/u.test(line)) {
      if (current === undefined) fail(filename, "Distribution core metadata begins with a continuation line.")
      const prior = values.get(current!)!
      prior[prior.length - 1] = `${prior.at(-1)!}\n${line.slice(1)}`
      continue
    }
    const index = line.indexOf(":")
    if (index <= 0) fail(filename, "Distribution core metadata contains a malformed header.")
    current = line.slice(0, index).toLowerCase()
    const value = line.slice(index + 1).trim()
    values.set(current, [...(values.get(current) ?? []), value])
  }
  const one = (name: string): string => {
    const found = values.get(name)
    const value = found?.length === 1 ? found[0] : undefined
    if (value === undefined || value.length === 0) fail(filename, `Distribution metadata requires exactly one ${name} field.`)
    return value!
  }
  const name = one("name")
  const version = one("version")
  const metadataVersion = one("metadata-version")
  if (!/^\d+\.\d+$/u.test(metadataVersion)) fail(filename, "Distribution Metadata-Version must use major.minor form.")
  if (!/^[A-Za-z0-9][A-Za-z0-9.!+_-]*$/u.test(version)) fail(filename, "Distribution Version is not a conservative Python package version.")
  let project: string
  try { project = normalizePyPiProjectName(name) } catch {
    return fail(filename, "Distribution Name is not a valid PyPI project name.")
  }
  return { name, project, version, metadataVersion }
}

const u16 = (filename: string, view: DataView, offset: number): number => {
  if (offset < 0 || offset + 2 > view.byteLength) fail(filename, "ZIP structure is truncated.")
  return view.getUint16(offset, true)
}

const u32 = (filename: string, view: DataView, offset: number): number => {
  if (offset < 0 || offset + 4 > view.byteLength) fail(filename, "ZIP structure is truncated.")
  return view.getUint32(offset, true)
}

type ZipEntry = {
  readonly path: string
  readonly flags: number
  readonly method: number
  readonly crc32: number
  readonly compressedSize: number
  readonly uncompressedSize: number
  readonly localOffset: number
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!
  return (crc ^ 0xffffffff) >>> 0
}

const zipEntries = (filename: string, bytes: Uint8Array): ReadonlyArray<ZipEntry> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  const minimum = Math.max(0, bytes.length - 65_557)
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (u32(filename, view, offset) === 0x06054b50) { eocd = offset; break }
  }
  if (eocd < 0 || u16(filename, view, eocd + 4) !== 0 || u16(filename, view, eocd + 6) !== 0) {
    fail(filename, "Wheel ZIP must be a single-disk archive with an end record.")
  }
  const count = u16(filename, view, eocd + 10)
  const size = u32(filename, view, eocd + 12)
  const start = u32(filename, view, eocd + 16)
  if (count === 0 || count === 0xffff || start === 0xffffffff || size === 0xffffffff || start + size > eocd) {
    fail(filename, "Wheel ZIP central directory is invalid or requires unsupported ZIP64 fields.")
  }
  const entries: Array<ZipEntry> = []
  const paths = new Set<string>()
  let offset = start
  for (let index = 0; index < count; index += 1) {
    if (u32(filename, view, offset) !== 0x02014b50) fail(filename, "Wheel ZIP central directory entry is malformed.")
    const flags = u16(filename, view, offset + 8)
    const method = u16(filename, view, offset + 10)
    const crc32 = u32(filename, view, offset + 16)
    const compressedSize = u32(filename, view, offset + 20)
    const uncompressedSize = u32(filename, view, offset + 24)
    const nameLength = u16(filename, view, offset + 28)
    const extraLength = u16(filename, view, offset + 30)
    const commentLength = u16(filename, view, offset + 32)
    const externalAttributes = u32(filename, view, offset + 38)
    const localOffset = u32(filename, view, offset + 42)
    const end = offset + 46 + nameLength + extraLength + commentLength
    if (end > start + size || (flags & 1) !== 0 || ![0, 8].includes(method)) {
      fail(filename, "Wheel ZIP uses an encrypted, unsupported, or truncated entry.")
    }
    const path = safePath(filename, utf8(filename, bytes.subarray(offset + 46, offset + 46 + nameLength)))
    const mode = externalAttributes >>> 16
    if ((mode & 0o170000) === 0o120000) fail(filename, "Wheel ZIP contains a symbolic link.")
    if (paths.has(path)) fail(filename, "Wheel ZIP repeats an archive path.")
    paths.add(path)
    if ([compressedSize, uncompressedSize, localOffset].includes(0xffffffff)) {
      fail(filename, "Wheel ZIP entry requires unsupported ZIP64 fields.")
    }
    entries.push({ path, flags, method, crc32, compressedSize, uncompressedSize, localOffset })
    offset = end
  }
  if (offset !== start + size) fail(filename, "Wheel ZIP central directory has trailing or missing data.")
  return entries
}

const zipContents = (filename: string, archive: Uint8Array, entry: ZipEntry): Uint8Array => {
  if (entry.uncompressedSize > metadataLimit) fail(filename, "Wheel metadata entry exceeds the supported bound.")
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  if (u32(filename, view, entry.localOffset) !== 0x04034b50) fail(filename, "Wheel ZIP local entry is malformed.")
  if (u16(filename, view, entry.localOffset + 6) !== entry.flags ||
      u16(filename, view, entry.localOffset + 8) !== entry.method ||
      u32(filename, view, entry.localOffset + 14) !== entry.crc32 ||
      u32(filename, view, entry.localOffset + 18) !== entry.compressedSize ||
      u32(filename, view, entry.localOffset + 22) !== entry.uncompressedSize) {
    fail(filename, "Wheel ZIP local entry disagrees with its central directory.")
  }
  const nameLength = u16(filename, view, entry.localOffset + 26)
  const extraLength = u16(filename, view, entry.localOffset + 28)
  const start = entry.localOffset + 30 + nameLength + extraLength
  const localPath = safePath(filename, utf8(filename, archive.subarray(entry.localOffset + 30, entry.localOffset + 30 + nameLength)))
  if (localPath !== entry.path) fail(filename, "Wheel ZIP local path disagrees with its central directory.")
  const end = start + entry.compressedSize
  if (end > archive.length) fail(filename, "Wheel ZIP entry bytes are truncated.")
  const compressed = archive.subarray(start, end)
  let result: Uint8Array
  try {
    result = entry.method === 0 ? new Uint8Array(compressed) : new Uint8Array(inflateRawSync(compressed, { maxOutputLength: metadataLimit }))
  } catch {
    return fail(filename, "Wheel ZIP metadata could not be decompressed.")
  }
  if (result.length !== entry.uncompressedSize) fail(filename, "Wheel ZIP metadata size disagrees with its central directory.")
  if (crc32(result) !== entry.crc32) fail(filename, "Wheel ZIP metadata CRC disagrees with its central directory.")
  return result
}

const wheel = (filename: string, bytes: Uint8Array, expectedProject: string, expectedVersion: string): WheelDistribution => {
  const entries = zipEntries(filename, bytes)
  const metadataEntries = entries.filter((entry) => /^[^/]+\.dist-info\/METADATA$/u.test(entry.path))
  if (metadataEntries.length !== 1) fail(filename, "Wheel requires exactly one top-level dist-info/METADATA entry.")
  const metadataEntry = metadataEntries[0]!
  const distInfo = metadataEntry.path.slice(0, -"/METADATA".length)
  const wheelEntry = entries.find((entry) => entry.path === `${distInfo}/WHEEL`)
  if (wheelEntry === undefined) fail(filename, "Wheel requires WHEEL metadata beside core metadata.")
  const metadata = coreMetadata(filename, zipContents(filename, bytes, metadataEntry))
  if (metadata.project !== expectedProject || metadata.version !== expectedVersion) {
    fail(filename, "Wheel embedded project/version disagrees with the resolved publication coordinate.")
  }
  const wheelProject = metadata.project.replaceAll("-", "_")
  const wheelVersion = metadata.version.replaceAll("-", "_")
  if (distInfo !== `${wheelProject}-${wheelVersion}.dist-info`) {
    fail(filename, "Wheel dist-info directory disagrees with embedded project/version metadata.")
  }
  const escaped = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  const match = new RegExp(
    `^${escaped(wheelProject)}-${escaped(wheelVersion)}(?:-[0-9][0-9A-Za-z_]*)?-([A-Za-z0-9_.]+)-([A-Za-z0-9_.]+)-([A-Za-z0-9_.]+)\\.whl$`,
    "u"
  ).exec(filename)
  if (match === null) fail(filename, "Wheel filename disagrees with embedded project/version or has malformed compatibility tags.")
  const [pythonTag, abiTag, platformTag] = match!.slice(1) as [string, string, string]
  const expanded = new Set(pythonTag.split(".").flatMap((python) =>
    abiTag.split(".").flatMap((abi) => platformTag.split(".").map((platform) => `${python}-${abi}-${platform}`))))
  const wheelTags = utf8(filename, zipContents(filename, bytes, wheelEntry!)).replaceAll("\r\n", "\n")
    .split("\n").filter((line) => line.startsWith("Tag: ")).map((line) => line.slice(5).trim())
  if (wheelTags.length === 0 || wheelTags.some((tag) => !expanded.has(tag))) {
    fail(filename, "Wheel WHEEL tags do not agree with its filename compatibility tags.")
  }
  return WheelDistribution.make({
    project: PyPiProjectName.make(metadata.project),
    version: Version.make(metadata.version),
    metadataVersion: NonEmptyName.make(metadata.metadataVersion),
    pythonTag: NonEmptyName.make(pythonTag),
    abiTag: NonEmptyName.make(abiTag),
    platformTag: NonEmptyName.make(platformTag),
    mediaType: "application/zip"
  })
}

const tarString = (bytes: Uint8Array): string => {
  const nul = bytes.indexOf(0)
  return new TextDecoder("utf-8", { fatal: true }).decode(nul < 0 ? bytes : bytes.subarray(0, nul))
}

const tarOctal = (filename: string, bytes: Uint8Array): number => {
  const value = tarString(bytes).trim().replace(/^0+/u, "") || "0"
  if (!/^[0-7]+$/u.test(value)) fail(filename, "Source distribution tar contains an invalid octal field.")
  const parsed = Number.parseInt(value, 8)
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(filename, "Source distribution tar size is out of range.")
  return parsed
}

const pax = (filename: string, bytes: Uint8Array): Readonly<Record<string, string>> => {
  const text = utf8(filename, bytes)
  const values: Record<string, string> = {}
  let offset = 0
  while (offset < text.length) {
    const space = text.indexOf(" ", offset)
    if (space < 0) fail(filename, "Source distribution PAX record is malformed.")
    const length = Number(text.slice(offset, space))
    if (!Number.isSafeInteger(length) || length <= space - offset + 1 || offset + length > text.length || text[offset + length - 1] !== "\n") {
      fail(filename, "Source distribution PAX record has an invalid length.")
    }
    const record = text.slice(space + 1, offset + length - 1)
    const equals = record.indexOf("=")
    if (equals <= 0) fail(filename, "Source distribution PAX record is missing a key.")
    values[record.slice(0, equals)] = record.slice(equals + 1)
    offset += length
  }
  return values
}

const sdist = (filename: string, bytes: Uint8Array, expectedProject: string, expectedVersion: string): SourceDistribution => {
  let tar: Uint8Array
  try { tar = new Uint8Array(gunzipSync(bytes, { maxOutputLength: archiveLimit })) } catch {
    return fail(filename, "Source distribution is not a bounded valid gzip stream.")
  }
  let offset = 0
  let pendingPax: Readonly<Record<string, string>> = {}
  const metadata: Array<{ readonly path: string, readonly bytes: Uint8Array }> = []
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      if (!tar.subarray(offset).every((byte) => byte === 0)) fail(filename, "Source distribution tar has nonzero data after its end marker.")
      break
    }
    let checksum = 0
    for (let index = 0; index < 512; index += 1) checksum += index >= 148 && index < 156 ? 32 : header[index]!
    if (checksum !== tarOctal(filename, header.subarray(148, 156))) fail(filename, "Source distribution tar header checksum is invalid.")
    const size = tarOctal(filename, header.subarray(124, 136))
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    if (dataEnd > tar.length) fail(filename, "Source distribution tar entry is truncated.")
    const type = String.fromCharCode(header[156]!)
    const rawName = tarString(header.subarray(0, 100))
    const prefix = tarString(header.subarray(345, 500))
    const rawPath = prefix.length === 0 ? rawName : `${prefix}/${rawName}`
    if (type === "x") {
      pendingPax = pax(filename, tar.subarray(dataStart, dataEnd))
    } else {
      const path = safePath(filename, pendingPax.path ?? rawPath)
      pendingPax = {}
      if (type === "1" || type === "2") fail(filename, "Source distribution tar contains a hard or symbolic link.")
      if (!["\0", "0", "5"].includes(type)) fail(filename, "Source distribution tar contains an unsupported entry type.")
      if ((type === "\0" || type === "0") && /\/PKG-INFO$/u.test(path)) {
        if (size > metadataLimit) fail(filename, "Source distribution PKG-INFO exceeds the supported bound.")
        metadata.push({ path, bytes: tar.subarray(dataStart, dataEnd) })
      }
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  if (metadata.length !== 1 || metadata[0]!.path.split("/").length !== 2) {
    fail(filename, "Source distribution requires exactly one root-directory PKG-INFO entry.")
  }
  const parsed = coreMetadata(filename, metadata[0]!.bytes)
  if (parsed.project !== expectedProject || parsed.version !== expectedVersion) {
    fail(filename, "Source distribution embedded project/version disagrees with the resolved publication coordinate.")
  }
  const suffix = `-${parsed.version}.tar.gz`
  if (!filename.endsWith(suffix) || normalizePyPiProjectName(filename.slice(0, -suffix.length)) !== parsed.project) {
    fail(filename, "Source distribution filename disagrees with embedded project/version metadata.")
  }
  const root = metadata[0]!.path.split("/")[0]!
  if (!root.endsWith(`-${parsed.version}`) || normalizePyPiProjectName(root.slice(0, -(`-${parsed.version}`).length)) !== parsed.project) {
    fail(filename, "Source distribution root directory disagrees with embedded project/version metadata.")
  }
  return SourceDistribution.make({
    project: PyPiProjectName.make(parsed.project),
    version: Version.make(parsed.version),
    metadataVersion: NonEmptyName.make(parsed.metadataVersion),
    pythonTag: "source",
    mediaType: "application/gzip"
  })
}

/** Strictly validate prebuilt distribution bytes against resolved identity. */
export const inspectPythonDistribution = (
  filename: string,
  bytes: Uint8Array,
  expectedProject: string,
  expectedVersion: string
): PythonDistribution => {
  if (filename.includes("/") || filename.includes("\\") || filename.length === 0) fail(filename || "<empty>", "Distribution filename must be a basename.")
  if (filename.endsWith(".whl")) return wheel(filename, bytes, expectedProject, expectedVersion)
  if (filename.endsWith(".tar.gz")) return sdist(filename, bytes, expectedProject, expectedVersion)
  return fail(filename, "Only .whl and .tar.gz source distributions are supported.")
}
