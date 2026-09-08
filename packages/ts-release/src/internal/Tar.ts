export type TarEntry = Readonly<{ path: string; kind: "file" | "directory"; body: Uint8Array }>
const decoder = new TextDecoder("utf-8", { fatal: true })
const cstring = (bytes: Uint8Array) => {
  const end = bytes.indexOf(0)
  return decoder.decode(bytes.subarray(0, end < 0 ? bytes.length : end))
}
export const registerArchivePath = (
  seen: Set<string>,
  raw: string,
  directory: boolean,
  invalid: (reason: string) => never,
) => {
  const path = directory && raw.endsWith("/") ? raw.slice(0, -1) : raw,
    key = path.toLowerCase()
  if (
    !path ||
    path.length > 1024 ||
    path !== path.normalize("NFC") ||
    /[\\:\u0000-\u001f\u007f]/u.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    seen.has(key) ||
    seen.size >= 100_000
  )
    invalid("path")
  seen.add(key)
  return path
}

/** Strict bounded ustar/PAX reader over provider-decompressed bytes. */
export const readTarBytes = (
  input: Uint8Array,
  maximumBytes: number,
  allowedPaxFields: ReadonlySet<string>,
  invalid: (reason: string) => never,
): readonly TarEntry[] => {
  if (!Number.isSafeInteger(maximumBytes) || input.length > maximumBytes) invalid("bound")
  const bytes = input
  const entries: TarEntry[] = [],
    seen = new Set<string>()
  let offset = 0,
    override: string | undefined
  const number = (field: Uint8Array) => {
    const value = cstring(field).trim()
    if (!/^[0-7]+$/u.test(value)) return invalid("number")
    const parsed = Number.parseInt(value, 8)
    return Number.isSafeInteger(parsed) ? parsed : invalid("number")
  }
  const paxPath = (body: Uint8Array) => {
    let cursor = 0,
      selected: string | undefined
    while (cursor < body.length) {
      const space = body.indexOf(32, cursor),
        raw = decoder.decode(body.subarray(cursor, space))
      if (space < cursor || !/^[1-9][0-9]*$/u.test(raw)) invalid("pax")
      const length = Number(raw),
        end = cursor + length
      if (!Number.isSafeInteger(length) || end <= space + 1 || end > body.length) invalid("pax")
      const line = decoder.decode(body.subarray(space + 1, end))
      if (!line.endsWith("\n")) invalid("pax")
      const equals = line.indexOf("=")
      if (equals <= 0) invalid("pax")
      const key = line.slice(0, equals),
        value = line.slice(equals + 1, -1)
      if (key === "path") {
        if (selected !== undefined) invalid("pax-path")
        selected = value
      } else if (!allowedPaxFields.has(key) || !/^-?[0-9]+(?:\.[0-9]+)?$/u.test(value))
        invalid("pax-field")
      cursor = end
    }
    return selected
  }
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      if (
        override !== undefined ||
        bytes.length - offset < 1024 ||
        !bytes.subarray(offset).every((byte) => byte === 0)
      )
        invalid("end")
      return entries
    }
    if (
      header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0) !==
      number(header.subarray(148, 156))
    )
      invalid("checksum")
    const size = number(header.subarray(124, 136)),
      type = header[156],
      start = offset + 512
    offset = start + Math.ceil(size / 512) * 512
    if (offset > bytes.length) invalid("truncated")
    const body = bytes.subarray(start, start + size)
    if (type === 120 || type === 76) {
      if (override !== undefined || size > 65536) invalid("extension")
      override = type === 76 ? cstring(body) : paxPath(body)
      continue
    }
    const prefix = cstring(header.subarray(345, 500)),
      raw = override ?? `${prefix ? `${prefix}/` : ""}${cstring(header.subarray(0, 100))}`
    override = undefined
    if (type === 0 || type === 48)
      entries.push({ path: registerArchivePath(seen, raw, false, invalid), kind: "file", body })
    else if (type === 53 && size === 0)
      entries.push({
        path: registerArchivePath(seen, raw, true, invalid),
        kind: "directory",
        body,
      })
    else invalid("entry-kind")
  }
  return invalid("end")
}
