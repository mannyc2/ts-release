import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

type ArchiveEntry = { readonly path: string, readonly data: Uint8Array, readonly mode: number }
const encoder = new TextEncoder()
const text = (value: string): Uint8Array => encoder.encode(value)
const concat = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}
const integer = (bytes: number, value: number): Uint8Array => {
  const result = new Uint8Array(bytes)
  const view = new DataView(result.buffer)
  if (bytes === 2) view.setUint16(0, value, true)
  else view.setUint32(0, value, true)
  return result
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
const zip = (entries: ReadonlyArray<ArchiveEntry>): Uint8Array => {
  const bodies: Uint8Array[] = [], central: Uint8Array[] = []
  let offset = 0
  for (const entry of [...entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    const name = text(entry.path), crc = crc32(entry.data)
    const local = concat([integer(4, 0x04034b50), integer(2, 20), integer(2, 0x0800), integer(2, 0), integer(2, 0), integer(2, 0), integer(4, crc), integer(4, entry.data.length), integer(4, entry.data.length), integer(2, name.length), integer(2, 0), name])
    bodies.push(local, entry.data)
    central.push(concat([integer(4, 0x02014b50), integer(2, 0x0314), integer(2, 20), integer(2, 0x0800), integer(2, 0), integer(2, 0), integer(2, 0), integer(4, crc), integer(4, entry.data.length), integer(4, entry.data.length), integer(2, name.length), integer(2, 0), integer(2, 0), integer(2, 0), integer(2, 0), integer(4, entry.mode << 16), integer(4, offset), name]))
    offset += local.length + entry.data.length
  }
  const directory = concat(central)
  return concat([...bodies, directory, integer(4, 0x06054b50), integer(2, 0), integer(2, 0), integer(2, entries.length), integer(2, entries.length), integer(4, directory.length), integer(4, offset), integer(2, 0)])
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const app = join(root, "apps", "ts-release-agents")
const output = join(root, ".release", "agents")
const version = (): string => {
  const value = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: unknown }
  if (typeof value.version !== "string" || value.version.length === 0) throw new Error("Root package version is missing.")
  return value.version
}
const write = (path: string, contents: string | Uint8Array): void => {
  mkdirSync(dirname(path), { recursive: true, mode: 0o755 })
  writeFileSync(path, contents, { mode: 0o644 })
}
const copyTree = (source: string, target: string, entries: ReadonlyArray<string>): void => {
  for (const entry of entries) write(join(target, entry), readFileSync(join(source, entry)))
}
const filesUnder = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? filesUnder(path).map((child) => join(entry.name, child)) : [entry.name]
})
const generatedManifest = (provider: "codex" | "claude", packageVersion: string): Record<string, unknown> => {
  const authored = JSON.parse(readFileSync(join(app, "manifests", `${provider}.json`), "utf8")) as Record<string, unknown>
  return provider === "codex"
    ? { ...authored, version: packageVersion }
    : { ...authored, version: packageVersion, author: { name: "mannyc2", url: "https://github.com/mannyc2/ts-release" }, repository: "https://github.com/mannyc2/ts-release" }
}
const packageFiles = (provider: "codex" | "claude", packageRoot: string, packageVersion: string): void => {
  const native = provider === "codex" ? ".codex-plugin" : ".claude-plugin"
  write(join(packageRoot, native, "plugin.json"), `${JSON.stringify(generatedManifest(provider, packageVersion), null, 2)}\n`)
  write(join(packageRoot, "README.md"), readFileSync(join(app, "README.md")))
  write(join(packageRoot, "LICENSE"), readFileSync(join(app, "LICENSE")))
  write(join(packageRoot, "evals", "cases.json"), readFileSync(join(app, "evals", "cases.json")))
  copyTree(join(app, "skills"), join(packageRoot, "skills"), filesUnder(join(app, "skills")))
}

export const buildAgents = (): ReadonlyArray<string> => {
  const packageVersion = version()
  rmSync(output, { recursive: true, force: true })
  const created: string[] = []
  for (const provider of ["codex", "claude"] as const) {
    const packageRoot = join(output, provider, "ts-release")
    packageFiles(provider, packageRoot, packageVersion)
    const entries = filesUnder(packageRoot).map((path): ArchiveEntry => ({
      path: join("ts-release", path).replaceAll("\\", "/"), data: new Uint8Array(readFileSync(join(packageRoot, path))), mode: 0o100644
    }))
    const archive = join(output, "archives", `ts-release-${provider}.zip`)
    write(archive, zip(entries))
    created.push(archive)
  }
  return created
}

if (import.meta.main) {
  for (const path of buildAgents()) console.log(path.slice(root.length + 1))
}
