import { createHash } from "node:crypto"

interface Entry {
  readonly path: string
  readonly data: Uint8Array
  readonly mode: number
}
const text = (value: string) => new TextEncoder().encode(value)
const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}
const integer = (size: 2 | 4, value: number): Uint8Array => {
  const output = new Uint8Array(size)
  if (size === 2) new DataView(output.buffer).setUint16(0, value, true)
  else new DataView(output.buffer).setUint32(0, value, true)
  return output
}
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})
const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!
  return (crc ^ 0xffffffff) >>> 0
}
const zip = (entries: readonly Entry[]): Uint8Array => {
  const bodies: Uint8Array[] = [],
    central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = text(entry.path),
      crc = crc32(entry.data)
    const local = concat([
      integer(4, 0x04034b50),
      integer(2, 20),
      integer(2, 0x0800),
      integer(2, 0),
      integer(2, 0),
      integer(2, 0),
      integer(4, crc),
      integer(4, entry.data.length),
      integer(4, entry.data.length),
      integer(2, name.length),
      integer(2, 0),
      name,
    ])
    bodies.push(local, entry.data)
    central.push(
      concat([
        integer(4, 0x02014b50),
        integer(2, 0x0314),
        integer(2, 20),
        integer(2, 0x0800),
        integer(2, 0),
        integer(2, 0),
        integer(2, 0),
        integer(4, crc),
        integer(4, entry.data.length),
        integer(4, entry.data.length),
        integer(2, name.length),
        integer(2, 0),
        integer(2, 0),
        integer(2, 0),
        integer(2, 0),
        integer(4, entry.mode << 16),
        integer(4, offset),
        name,
      ]),
    )
    offset += local.length + entry.data.length
  }
  const directory = concat(central)
  return concat([
    ...bodies,
    directory,
    integer(4, 0x06054b50),
    integer(2, 0),
    integer(2, 0),
    integer(2, entries.length),
    integer(2, entries.length),
    integer(4, directory.length),
    integer(4, offset),
    integer(2, 0),
  ])
}

const platforms = [
  "manylinux_2_17_x86_64",
  "manylinux_2_17_aarch64",
  "macosx_13_0_x86_64",
  "macosx_13_0_arm64",
] as const
export const wheels = (version: string) =>
  platforms.map((platform, index) => {
    const dist = `ts_release-${version.replaceAll("-", "_")}.dist-info`
    const executable = new Uint8Array(4096)
    executable.set(index < 2 ? [0x7f, 0x45, 0x4c, 0x46] : [0xcf, 0xfa, 0xed, 0xfe])
    const entries: Entry[] = [
      {
        path: "ts_release/__init__.py",
        data: text(`__version__ = ${JSON.stringify(version)}\n`),
        mode: 0o100644,
      },
      {
        path: "ts_release/cli.py",
        data: text(
          "import os,sys\ndef main(): os.execv(os.path.join(os.path.dirname(__file__),'bin','ts-release'),sys.argv)\n",
        ),
        mode: 0o100644,
      },
      { path: "ts_release/bin/ts-release", data: executable, mode: 0o100755 },
      {
        path: `${dist}/METADATA`,
        data: text(
          `Metadata-Version: 2.4\nName: ts-release\nVersion: ${version}\nSummary: Deterministic TypeScript release automation.\nRequires-Python: >=3.9\n\n`,
        ),
        mode: 0o100644,
      },
      {
        path: `${dist}/WHEEL`,
        data: text(
          `Wheel-Version: 1.0\nGenerator: ts-release\nRoot-Is-Purelib: false\nTag: py3-none-${platform}\n`,
        ),
        mode: 0o100644,
      },
      {
        path: `${dist}/entry_points.txt`,
        data: text("[console_scripts]\nts-release = ts_release.cli:main\n"),
        mode: 0o100644,
      },
      { path: `${dist}/top_level.txt`, data: text("ts_release\n"), mode: 0o100644 },
    ].sort((left, right) => left.path.localeCompare(right.path))
    const record = entries.map(
      ({ path, data }) =>
        `${path},sha256=${createHash("sha256").update(data).digest("base64url")},${data.length}`,
    )
    const recordPath = `${dist}/RECORD`
    record.push(`${recordPath},,`)
    entries.push({ path: recordPath, data: text(`${record.join("\n")}\n`), mode: 0o100644 })
    return {
      filename: `ts_release-${version.replaceAll("-", "_")}-py3-none-${platform}.whl`,
      bytes: zip(entries),
    }
  })
