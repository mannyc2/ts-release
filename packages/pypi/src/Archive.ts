import { gunzipSync, inflateRawSync, crc32 } from "node:zlib"
import { readTarBytes, registerArchivePath } from "@mannyc1/ts-release/bundle"
import { invalid, MAX_BYTES } from "./Native.js"

const text = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(bytes)
const register = (seen: Set<string>, name: string) => {
  registerArchivePath(seen, name, name.endsWith("/"), () => invalid("archive-path"))
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
export const readTar = (input: Uint8Array) =>
  new Map(
    readTarBytes(
      gunzipSync(input, { maxOutputLength: MAX_BYTES }),
      MAX_BYTES,
      new Set(["mtime", "atime", "ctime"]),
      (reason) => invalid(`tar-${reason}`),
    ).flatMap((entry) => (entry.kind === "file" ? [[entry.path, entry.body] as const] : [])),
  )
