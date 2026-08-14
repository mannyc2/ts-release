import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from "node:fs"
import { basename, dirname, relative, resolve } from "node:path"
import { exit } from "node:process"
import { createHash } from "node:crypto"
import {
  buildEmbeddedPythonWheel,
  embeddedPythonWheelFilename,
  embeddedPythonWheelTargets,
  type EmbeddedPythonWheelTarget
} from "../src/drivers/python-wheel.js"
import { inspectPythonDistribution } from "../src/model/python-distribution.js"
import { inspectBunBinaryHeader } from "./lib/bun-targets.js"

interface PackageManifest {
  readonly version?: unknown
  readonly description?: unknown
  readonly homepage?: unknown
  readonly license?: unknown
}

interface RequestedWheel {
  readonly target: EmbeddedPythonWheelTarget
  readonly input: string
  readonly output: string
}

const root = realpathSync(process.cwd())
const args = process.argv.slice(2)
const fail = (reason: string): never => { throw new Error(reason) }
const textField = (manifest: PackageManifest, field: keyof PackageManifest): string => {
  const value = manifest[field]
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fail(`package.json must provide a nonempty ${field}.`)
}
const workspacePath = (value: string, label: string): string => {
  const path = resolve(root, value)
  const fromRoot = relative(root, path)
  if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith("../") || resolve(root, fromRoot) !== path) {
    return fail(`${label} must be a workspace-relative child path.`)
  }
  return path
}

const parse = (): ReadonlyArray<RequestedWheel> => {
  if (args.length !== embeddedPythonWheelTargets.length * 3) {
    return fail("usage: build-pypi-wheels <target> <input> <output> for every advertised target")
  }
  const targets = new Map(embeddedPythonWheelTargets.map((target) => [target.id, target]))
  const requested: RequestedWheel[] = []
  for (let index = 0; index < args.length; index += 3) {
    const id = args[index]!
    const target = targets.get(id as EmbeddedPythonWheelTarget["id"])
    if (target === undefined) return fail(`Unknown embedded-wheel target ${JSON.stringify(id)}.`)
    requested.push({
      target,
      input: workspacePath(args[index + 1]!, `${id} input`),
      output: workspacePath(args[index + 2]!, `${id} output`)
    })
  }
  const ids = requested.map(({ target }) => target.id)
  if (new Set(ids).size !== embeddedPythonWheelTargets.length ||
      embeddedPythonWheelTargets.some(({ id }) => !ids.includes(id))) {
    fail("Embedded-wheel build must name every advertised target exactly once.")
  }
  return requested
}

const glibcVersions = (binary: Uint8Array): ReadonlyArray<readonly [number, number]> => {
  const found = new Map<string, readonly [number, number]>()
  const prefix = [0x47, 0x4c, 0x49, 0x42, 0x43, 0x5f]
  for (let index = 0; index <= binary.length - prefix.length; index += 1) {
    if (!prefix.every((value, offset) => binary[index + offset] === value)) continue
    let cursor = index + prefix.length
    let majorText = ""
    while (cursor < binary.length && binary[cursor]! >= 0x30 && binary[cursor]! <= 0x39) {
      majorText += String.fromCharCode(binary[cursor++]!)
    }
    if (majorText.length === 0 || binary[cursor++] !== 0x2e) continue
    let minorText = ""
    while (cursor < binary.length && binary[cursor]! >= 0x30 && binary[cursor]! <= 0x39) {
      minorText += String.fromCharCode(binary[cursor++]!)
    }
    if (minorText.length === 0) continue
    found.set(`${majorText}.${minorText}`, [Number(majorText), Number(minorText)])
  }
  return [...found.values()]
}

const assertManylinux217 = (target: EmbeddedPythonWheelTarget, binary: Uint8Array): void => {
  if (target.format !== "elf") return
  const versions = glibcVersions(binary)
  if (versions.length === 0) fail(`${target.id} has no readable GLIBC symbol-version requirements.`)
  const unsupported = versions.find(([major, minor]) => major > 2 || (major === 2 && minor > 17))
  if (unsupported !== undefined) {
    fail(`${target.id} requires GLIBC_${unsupported[0]}.${unsupported[1]}, above its manylinux_2_17 wheel tag.`)
  }
}

const macOsMinimum = (binary: Uint8Array): readonly [number, number, number] => {
  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)
  if (binary.length < 32 || view.getUint32(0, true) !== 0xfeedfacf) fail("Mach-O header is invalid.")
  const commands = view.getUint32(16, true)
  let offset = 32
  for (let index = 0; index < commands; index += 1) {
    if (offset + 8 > binary.length) fail("Mach-O load commands are truncated.")
    const command = view.getUint32(offset, true)
    const size = view.getUint32(offset + 4, true)
    if (size < 8 || offset + size > binary.length) fail("Mach-O load command size is invalid.")
    const encoded = command === 0x32
      ? view.getUint32(offset + 12, true)
      : command === 0x24
      ? view.getUint32(offset + 8, true)
      : undefined
    if (encoded !== undefined) return [(encoded >>> 16) & 0xffff, (encoded >>> 8) & 0xff, encoded & 0xff]
    offset += size
  }
  return fail("Mach-O executable has no minimum macOS load command.")
}

const assertMacOs13 = (target: EmbeddedPythonWheelTarget, binary: Uint8Array): void => {
  if (target.format !== "mach-o") return
  const [major, minor] = macOsMinimum(binary)
  if (major > 13 || (major === 13 && minor > 0)) {
    fail(`${target.id} requires macOS ${major}.${minor}, above its macosx_13_0 wheel tag.`)
  }
}

const main = (): void => {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as PackageManifest
  const version = textField(manifest, "version")
  const summary = textField(manifest, "description")
  const homepage = textField(manifest, "homepage")
  const license = textField(manifest, "license")
  const results = parse().map(({ target, input, output }) => {
    const inputStat = lstatSync(input)
    if (!inputStat.isFile() || inputStat.isSymbolicLink() || realpathSync(input) !== input) {
      fail(`${target.id} input must be a canonical regular file.`)
    }
    const binary = new Uint8Array(readFileSync(input))
    const identity = inspectBunBinaryHeader(binary.subarray(0, Math.min(binary.length, 4096)))
    if (identity.format !== target.format || identity.architecture !== target.architecture) {
      fail(`${target.id} input is ${identity.format}/${identity.architecture}, expected ${target.format}/${target.architecture}.`)
    }
    assertManylinux217(target, binary)
    assertMacOs13(target, binary)
    const expected = embeddedPythonWheelFilename(target, version)
    if (basename(output) !== expected) {
      fail(`${target.id} output must be named ${expected}, got ${basename(output)}.`)
    }
    const wheel = buildEmbeddedPythonWheel({ target, version, summary, homepage, license, binary })
    const distribution = inspectPythonDistribution(expected, wheel, "ts-release", version)
    if (distribution._tag !== "wheel" || distribution.platformTag !== target.wheelTag.split("-").at(-1)) {
      fail(`${target.id} wheel did not preserve its exact compatibility tag.`)
    }
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, wheel, { mode: 0o644, flag: "wx" })
    return {
      target: target.id,
      filename: expected,
      bytes: wheel.length,
      sha256: createHash("sha256").update(wheel).digest("hex")
    }
  })
  console.log(JSON.stringify({ schemaVersion: "ts-release/pypi-wheel-build/v1", version, wheels: results }))
}

try {
  main()
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
