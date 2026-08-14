import { describe, expect, test } from "bun:test"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  buildEmbeddedPythonWheel,
  embeddedPythonWheelEntries,
  embeddedPythonWheelFilename,
  embeddedPythonWheelTargets,
  type EmbeddedPythonWheelTarget
} from "../src/drivers/python-wheel.js"
import { inspectPythonDistribution } from "../src/model/python-distribution.js"

const root = process.cwd()
const metadata = {
  version: "0.2.2",
  summary: "Deterministic TypeScript release automation.",
  homepage: "https://github.com/mannyc2/ts-release",
  license: "MIT"
}

const executable = (target: EmbeddedPythonWheelTarget): Uint8Array => {
  const bytes = new Uint8Array(16_384)
  const view = new DataView(bytes.buffer)
  if (target.format === "elf") {
    bytes.set([0x7f, 0x45, 0x4c, 0x46])
    bytes[4] = 2
    bytes[5] = 1
    view.setUint16(18, target.architecture === "x86_64" ? 0x3e : 0xb7, true)
    bytes.set(new TextEncoder().encode("GLIBC_2.17"), 128)
  } else {
    view.setUint32(0, 0xfeedfacf, true)
    view.setUint32(4, target.architecture === "x86_64" ? 0x01000007 : 0x0100000c, true)
    view.setUint32(16, 1, true)
    view.setUint32(20, 24, true)
    view.setUint32(32, 0x32, true)
    view.setUint32(36, 24, true)
    view.setUint32(40, 1, true)
    view.setUint32(44, 13 << 16, true)
  }
  return bytes
}

describe("embedded PyPI wheel build", () => {
  test("creates deterministic, compressed, metadata-valid wheels for every advertised target", () => {
    for (const target of embeddedPythonWheelTargets) {
      const binary = executable(target)
      const input = { target, binary, ...metadata }
      const entries = embeddedPythonWheelEntries(input)
      expect(entries.map(({ path }) => path)).toContain("ts_release/bin/ts-release")
      expect(new TextDecoder().decode(entries.find(({ path }) => path === "ts_release/cli.py")!.data))
        .toContain("os.execv(binary_path")
      const first = buildEmbeddedPythonWheel(input)
      const second = buildEmbeddedPythonWheel(input)
      expect(first).toEqual(second)
      expect(first.length).toBeLessThan(binary.length)
      const filename = embeddedPythonWheelFilename(target, metadata.version)
      expect(inspectPythonDistribution(filename, first, "ts-release", metadata.version)).toMatchObject({
        _tag: "wheel",
        project: "ts-release",
        version: metadata.version,
        platformTag: target.wheelTag.split("-").at(-1)
      })
    }
  })

  test("build command requires the exact four headers, tags, and output names", () => {
    const workspace = mkdtempSync(join(tmpdir(), "ts-release-pypi-wheel-build-"))
    try {
      writeFileSync(join(workspace, "package.json"), JSON.stringify({
        version: metadata.version,
        description: metadata.summary,
        homepage: metadata.homepage,
        license: metadata.license
      }))
      const arguments_: string[] = []
      for (const target of embeddedPythonWheelTargets) {
        const input = join(workspace, "inputs", target.id)
        const output = join(workspace, "outputs", embeddedPythonWheelFilename(target, metadata.version))
        mkdirSync(join(workspace, "inputs"), { recursive: true })
        writeFileSync(input, executable(target), { mode: 0o755 })
        arguments_.push(target.id, input, output)
      }
      const result = Bun.spawnSync([
        process.execPath,
        join(root, "scripts/build-pypi-wheels.ts"),
        ...arguments_
      ], { cwd: workspace, stdout: "pipe", stderr: "pipe" })
      expect(new TextDecoder().decode(result.stderr)).toBe("")
      expect(result.exitCode).toBe(0)
      const report = JSON.parse(new TextDecoder().decode(result.stdout)) as {
        readonly schemaVersion: string
        readonly wheels: ReadonlyArray<{ readonly filename: string }>
      }
      expect(report.schemaVersion).toBe("ts-release/pypi-wheel-build/v1")
      expect(report.wheels).toHaveLength(4)
      for (const target of embeddedPythonWheelTargets) {
        const filename = embeddedPythonWheelFilename(target, metadata.version)
        const wheel = new Uint8Array(readFileSync(join(workspace, "outputs", filename)))
        expect(inspectPythonDistribution(filename, wheel, "ts-release", metadata.version)._tag).toBe("wheel")
      }
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  })
})
