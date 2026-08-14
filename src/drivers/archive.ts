import { deflateRawSync, gzipSync } from "node:zlib"

export interface ArchiveEntry {
  readonly path: string
  readonly data: Uint8Array
  readonly mode: number
}
const text = (value: string) => new TextEncoder().encode(value)
const concat = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}
const integer = (bytes: number, value: number): Uint8Array => {
  const output = new Uint8Array(bytes)
  const view = new DataView(output.buffer)
  if (bytes === 2) view.setUint16(0, value, true)
  else view.setUint32(0, value, true)
  return output
}
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (const bit of Array.from({ length: 8 }, (_, index) => index)) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})
const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!
  return (crc ^ 0xffffffff) >>> 0
}
export type ZipCompression = "store" | "deflate"

export const zip = (
  entries: ReadonlyArray<ArchiveEntry>,
  compression: ZipCompression = "store"
): Uint8Array => {
  const bodies: Array<Uint8Array> = []
  const central: Array<Uint8Array> = []
  let offset = 0
  for (const entry of entries) {
    const name = text(entry.path)
    const crc = crc32(entry.data)
    const method = compression === "deflate" ? 8 : 0
    const body = compression === "deflate"
      ? new Uint8Array(deflateRawSync(entry.data, { level: 9 }))
      : entry.data
    const local = concat([
      integer(4, 0x04034b50), integer(2, 20), integer(2, 0x0800), integer(2, method),
      integer(2, 0), integer(2, 0), integer(4, crc), integer(4, body.length),
      integer(4, entry.data.length), integer(2, name.length), integer(2, 0), name
    ])
    bodies.push(local, body)
    central.push(concat([
      integer(4, 0x02014b50), integer(2, 0x0314), integer(2, 20), integer(2, 0x0800),
      integer(2, method), integer(2, 0), integer(2, 0), integer(4, crc),
      integer(4, body.length), integer(4, entry.data.length), integer(2, name.length),
      integer(2, 0), integer(2, 0), integer(2, 0), integer(2, 0),
      integer(4, entry.mode << 16), integer(4, offset), name
    ]))
    offset += local.length + body.length
  }
  const directory = concat(central)
  return concat([
    ...bodies, directory, integer(4, 0x06054b50), integer(2, 0), integer(2, 0),
    integer(2, entries.length), integer(2, entries.length), integer(4, directory.length),
    integer(4, offset), integer(2, 0)
  ])
}
const ascii = (output: Uint8Array, offset: number, length: number, value: string): void => {
  const bytes = text(value)
  if (bytes.length > length) throw new Error(`Archive path is too long: ${value}`)
  output.set(bytes, offset)
}
const octal = (output: Uint8Array, offset: number, length: number, value: number): void => {
  ascii(output, offset, length - 2, value.toString(8).padStart(length - 2, "0"))
  output[offset + length - 2] = 0
  output[offset + length - 1] = 0x20
}
const tarHeader = (entry: ArchiveEntry): Uint8Array => {
  const header = new Uint8Array(512)
  ascii(header, 0, 100, entry.path)
  octal(header, 100, 8, entry.mode & 0o777)
  octal(header, 108, 8, 0)
  octal(header, 116, 8, 0)
  octal(header, 124, 12, entry.data.length)
  octal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  header[156] = 0x30
  ascii(header, 257, 6, "ustar")
  ascii(header, 263, 2, "00")
  octal(header, 148, 8, header.reduce((sum, byte) => sum + byte, 0))
  return header
}
// Level 9 is explicit because it is the level at which every zlib we ship on
// emits identical deflate bytes; the 10-byte header is then overwritten so no
// clock (MTIME) or platform (OS) leaks into an artifact.
export const tarGz = (entries: ReadonlyArray<ArchiveEntry>): Uint8Array => {
  const packed = new Uint8Array(gzipSync(concat(entries.flatMap((entry) => [
    tarHeader(entry), entry.data,
    new Uint8Array(entry.data.length % 512 === 0 ? 0 : 512 - entry.data.length % 512)
  ]).concat([new Uint8Array(1024)])), { level: 9 }))
  packed.fill(0, 4, 8)
  packed[9] = 0xff
  return packed
}
