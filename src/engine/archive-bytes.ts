// Invariant: archive entries are normalized once and encoded into deterministic ZIP or tar.gz bytes.
export interface ArchiveByteEntry {
  readonly path: string
  readonly data: Uint8Array
  readonly mode: number
}

interface CentralDirectoryEntry extends ArchiveByteEntry {
  readonly crc32: number
  readonly offset: number
}

const encoder = new TextEncoder()

export const bytes = (value: string): Uint8Array =>
  encoder.encode(value)

export const concatBytes = (parts: ReadonlyArray<Uint8Array>): Uint8Array<ArrayBuffer> => {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const output: Uint8Array<ArrayBuffer> = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

const uint16 = (value: number): Uint8Array => {
  const output = new Uint8Array(2)
  new DataView(output.buffer).setUint16(0, value, true)
  return output
}

const uint32 = (value: number): Uint8Array => {
  const output = new Uint8Array(4)
  new DataView(output.buffer).setUint32(0, value, true)
  return output
}

const crcTable = (() => {
  const table: Array<number> = []
  for (let value = 0; value < 256; value += 1) {
    let crc = value
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table.push(crc >>> 0)
  }
  return table
})()

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const localFileHeader = (entry: ArchiveByteEntry, crc: number): Uint8Array => {
  const name = bytes(entry.path)
  return concatBytes([
    uint32(0x04034b50),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(crc),
    uint32(entry.data.byteLength),
    uint32(entry.data.byteLength),
    uint16(name.byteLength),
    uint16(0),
    name
  ])
}

const centralDirectoryHeader = (entry: CentralDirectoryEntry): Uint8Array => {
  const name = bytes(entry.path)
  return concatBytes([
    uint32(0x02014b50),
    uint16(0x0314),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(entry.crc32),
    uint32(entry.data.byteLength),
    uint32(entry.data.byteLength),
    uint16(name.byteLength),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(entry.mode << 16),
    uint32(entry.offset),
    name
  ])
}

const endOfCentralDirectory = (
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
): Uint8Array =>
  concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entryCount),
    uint16(entryCount),
    uint32(centralDirectorySize),
    uint32(centralDirectoryOffset),
    uint16(0)
  ])

export const buildZipArchive = (entries: ReadonlyArray<ArchiveByteEntry>): Uint8Array => {
  const localParts: Array<Uint8Array> = []
  const centralEntries: Array<CentralDirectoryEntry> = []
  let offset = 0

  for (const entry of entries) {
    const crc = crc32(entry.data)
    const header = localFileHeader(entry, crc)
    localParts.push(header, entry.data)
    centralEntries.push({
      ...entry,
      crc32: crc,
      offset
    })
    offset += header.byteLength + entry.data.byteLength
  }

  const centralDirectory = concatBytes(centralEntries.map(centralDirectoryHeader))
  return concatBytes([
    ...localParts,
    centralDirectory,
    endOfCentralDirectory(centralEntries.length, centralDirectory.byteLength, offset)
  ])
}

const writeAscii = (output: Uint8Array, offset: number, length: number, value: string): void => {
  const data = bytes(value)
  if (data.byteLength > length) {
    throw new Error(`Tar entry field is too long: ${value}`)
  }
  output.set(data, offset)
}

const writeOctal = (output: Uint8Array, offset: number, length: number, value: number): void => {
  const text = value.toString(8).padStart(length - 2, "0")
  writeAscii(output, offset, length - 2, text)
  output[offset + length - 2] = 0
  output[offset + length - 1] = 0x20
}

const tarPadding = (length: number): Uint8Array => {
  const remainder = length % 512
  return new Uint8Array(remainder === 0 ? 0 : 512 - remainder)
}

const tarHeader = (entry: ArchiveByteEntry): Uint8Array => {
  const header = new Uint8Array(512)
  writeAscii(header, 0, 100, entry.path)
  writeOctal(header, 100, 8, entry.mode & 0o777)
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, entry.data.byteLength)
  writeOctal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  header[156] = 0x30
  writeAscii(header, 257, 6, "ustar")
  writeAscii(header, 263, 2, "00")
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  writeOctal(header, 148, 8, checksum)
  return header
}

export const buildTarArchive = (entries: ReadonlyArray<ArchiveByteEntry>): Uint8Array<ArrayBuffer> => {
  const parts: Array<Uint8Array> = []
  for (const entry of entries) {
    parts.push(tarHeader(entry), entry.data, tarPadding(entry.data.byteLength))
  }
  parts.push(new Uint8Array(1024))
  return concatBytes(parts)
}

export const buildTarGzArchive = (entries: ReadonlyArray<ArchiveByteEntry>): Uint8Array<ArrayBuffer> =>
  Bun.gzipSync(buildTarArchive(entries))
