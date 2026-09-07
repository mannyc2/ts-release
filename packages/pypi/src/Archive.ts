import { gunzipSync, inflateRawSync, crc32 } from "node:zlib"
import { invalid, MAX_BYTES } from "./Native.js"

const text = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(bytes)
const path = (name: string) => {
  const clean = name.endsWith("/") ? name.slice(0, -1) : name
  if (
    !clean ||
    clean.length > 1024 ||
    /[\\\u0000-\u001f]/u.test(clean) ||
    clean !== clean.normalize("NFC") ||
    clean.split("/").some((part) => !part || part === "." || part === "..") ||
    clean.includes(":")
  )
    invalid("archive-path")
  return clean
}
const register = (seen: Set<string>, name: string) => {
  const key = path(name).toLowerCase()
  if (seen.has(key)) invalid("archive-duplicate")
  seen.add(key)
  if (seen.size > 100_000) invalid("archive-entry-bound")
}
/** No extraction to a filesystem. Bound decompression and validate complete
 * ZIP32 headers, central/local correspondence, CRC and non-overlapping data. */
export const readZip = (input: Uint8Array) => {
  const bytes = Buffer.from(input),
    files = new Map<string, Uint8Array>(),
    seen = new Set<string>()
  if (bytes.length < 22) return invalid("zip-header")
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--
  if (
    end < 0 ||
    bytes.readUInt32LE(end) !== 0x06054b50 ||
    end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length ||
    bytes.readUInt32LE(end + 4) !== 0 ||
    bytes.readUInt16LE(end + 8) !== bytes.readUInt16LE(end + 10)
  )
    invalid("zip-directory")
  const count = bytes.readUInt16LE(end + 10),
    directory = bytes.readUInt32LE(end + 16)
  if (count === 65535 || directory + bytes.readUInt32LE(end + 12) !== end) invalid("zip-directory")
  let cursor = directory,
    total = 0
  const spans: Array<readonly [number, number]> = []
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50)
      invalid("zip-central-header")
    const flags = bytes.readUInt16LE(cursor + 8),
      method = bytes.readUInt16LE(cursor + 10)
    const compressed = bytes.readUInt32LE(cursor + 20),
      size = bytes.readUInt32LE(cursor + 24)
    const nameSize = bytes.readUInt16LE(cursor + 28),
      extraSize = bytes.readUInt16LE(cursor + 30),
      commentSize = bytes.readUInt16LE(cursor + 32)
    const local = bytes.readUInt32LE(cursor + 42),
      name = text(bytes.subarray(cursor + 46, cursor + 46 + nameSize))
    if (
      cursor + 46 + nameSize + extraSize + commentSize > end ||
      flags & ~0x808 ||
      ![0, 8].includes(method) ||
      bytes.readUInt16LE(cursor + 34) !== 0 ||
      ![0, 0x4000, 0x8000].includes((bytes.readUInt32LE(cursor + 38) >>> 16) & 0xf000) ||
      local + 30 > directory ||
      bytes.readUInt32LE(local) !== 0x04034b50 ||
      bytes.readUInt16LE(local + 6) !== flags ||
      bytes.readUInt16LE(local + 8) !== method ||
      bytes.readUInt16LE(local + 26) !== nameSize ||
      text(bytes.subarray(local + 30, local + 30 + nameSize)) !== name
    )
      invalid("zip-file-header")
    register(seen, name)
    const start = local + 30 + nameSize + bytes.readUInt16LE(local + 28),
      finish = start + compressed
    total += size
    if (finish > directory || total > MAX_BYTES || spans.some(([a, b]) => local < b && finish > a))
      invalid("zip-file-bound")
    spans.push([local, finish])
    if (
      !(flags & 8) &&
      (bytes.readUInt32LE(local + 14) !== bytes.readUInt32LE(cursor + 16) ||
        bytes.readUInt32LE(local + 18) !== compressed ||
        bytes.readUInt32LE(local + 22) !== size)
    )
      invalid("zip-file-facts")
    const body =
      method === 0
        ? bytes.subarray(start, finish)
        : inflateRawSync(bytes.subarray(start, finish), { maxOutputLength: Math.max(size, 1) })
    if (body.length !== size || crc32(body) !== bytes.readUInt32LE(cursor + 16))
      invalid("zip-file-crc")
    if (name.endsWith("/")) {
      if (size !== 0) invalid("zip-directory-content")
    } else files.set(name, body)
    cursor += 46 + nameSize + extraSize + commentSize
  }
  if (cursor !== end) invalid("zip-directory-size")
  return files
}
const cstring = (bytes: Uint8Array) =>
  text(bytes.subarray(0, bytes.indexOf(0) < 0 ? bytes.length : bytes.indexOf(0)))
const octal = (bytes: Uint8Array) => {
  const value = cstring(bytes).trim()
  if (!/^[0-7]+$/u.test(value)) return invalid("tar-number")
  const number = parseInt(value, 8)
  if (!Number.isSafeInteger(number)) invalid("tar-number")
  return number
}
export const readTar = (input: Uint8Array) => {
  const bytes = gunzipSync(input, { maxOutputLength: MAX_BYTES }),
    files = new Map<string, Uint8Array>(),
    seen = new Set<string>()
  let offset = 0,
    override: string | undefined
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      if (
        override !== undefined ||
        bytes.length - offset < 1024 ||
        !bytes.subarray(offset).every((byte) => byte === 0)
      )
        invalid("tar-end")
      return files
    }
    if (
      header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0) !==
      octal(header.subarray(148, 156))
    )
      invalid("tar-checksum")
    const size = octal(header.subarray(124, 136)),
      type = header[156],
      start = offset + 512
    offset = start + Math.ceil(size / 512) * 512
    if (offset > bytes.length) invalid("tar-truncated")
    const body = bytes.subarray(start, start + size)
    if (type === 120 || type === 76) {
      if (override !== undefined || size > 65536) invalid("tar-extension")
      if (type === 76) override = cstring(body)
      else {
        let cursor = 0
        while (cursor < body.length) {
          const space = body.indexOf(32, cursor),
            raw = text(body.subarray(cursor, space))
          if (space < cursor || !/^[1-9][0-9]*$/u.test(raw)) invalid("tar-pax")
          const length = Number(raw),
            line = text(body.subarray(space + 1, cursor + length))
          if (
            !Number.isSafeInteger(length) ||
            length <= space - cursor + 1 ||
            cursor + length > body.length ||
            !line.endsWith("\n")
          )
            invalid("tar-pax")
          const equals = line.indexOf("="),
            key = line.slice(0, equals),
            value = line.slice(equals + 1, -1)
          if (key === "path") {
            if (override !== undefined) invalid("tar-pax-path")
            override = value
          } else if (
            !["mtime", "atime", "ctime"].includes(key) ||
            !/^-?[0-9]+(?:\.[0-9]+)?$/u.test(value)
          )
            invalid("tar-pax-field")
          cursor += length
        }
      }
      continue
    }
    const prefix = cstring(header.subarray(345, 500)),
      name = override ?? `${prefix ? prefix + "/" : ""}${cstring(header.subarray(0, 100))}`
    override = undefined
    register(seen, name)
    if (type === 0 || type === 48) files.set(name, body)
    else if (type !== 53 || size !== 0) invalid("tar-entry-kind")
  }
  return invalid("tar-end")
}
