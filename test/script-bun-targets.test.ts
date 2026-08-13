import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../src/config/config.js"
import {
  bunArtifactTargetIds,
  bunArtifactTargets
} from "../src/capabilities/bun-targets.js"
import { sourcePreparationCapability } from "../src/capabilities/registry.js"
import { inspectBunBinaryHeader } from "../scripts/lib/bun-targets.js"

const header = (format: "elf" | "mach-o" | "pe", architecture: "x86_64" | "aarch64") => {
  const bytes = new Uint8Array(256)
  const view = new DataView(bytes.buffer)
  if (format === "elf") {
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1])
    view.setUint16(18, architecture === "x86_64" ? 0x3e : 0xb7, true)
  } else if (format === "mach-o") {
    view.setUint32(0, 0xfeedfacf, true)
    view.setUint32(4, architecture === "x86_64" ? 0x01000007 : 0x0100000c, true)
  } else {
    bytes.set([0x4d, 0x5a])
    view.setUint32(0x3c, 128, true)
    bytes.set([0x50, 0x45, 0, 0], 128)
    view.setUint16(132, architecture === "x86_64" ? 0x8664 : 0xaa64, true)
  }
  return bytes
}

describe("advertised Bun artifact targets", () => {
  test("capability support projects the canonical target ids", () => {
    expect([...sourcePreparationCapability.requirements.artifactTargets]).toEqual([...bunArtifactTargetIds])
    expect([...bunArtifactTargetIds]).toEqual(bunArtifactTargets.map(({ id }) => id))
  })

  test("keeps Windows absent until a real Windows public-entrypoint smoke certifies it", async () => {
    expect(bunArtifactTargetIds as ReadonlyArray<string>).not.toContain("windows-x64")
    expect(bunArtifactTargetIds as ReadonlyArray<string>).not.toContain("windows-arm64")
    for (const target of ["windows-x64", "windows-arm64"]) {
      await expect(Effect.runPromise(decodeConfig({
        project: { name: "target-fixture", version: "1.0.0", tag: "v1.0.0" },
        builds: [{ builder: "bun", entry: "src/index.ts", targets: [target] }]
      }))).rejects.toMatchObject({ _tag: "ConfigDecodeError" })
    }
  })

  for (const format of ["elf", "mach-o", "pe"] as const) {
    for (const architecture of ["x86_64", "aarch64"] as const) {
      test(`decodes ${format}/${architecture} from the binary header`, () => {
        expect(inspectBunBinaryHeader(header(format, architecture))).toEqual({ format, architecture })
      })
    }
  }

  test("refuses filename-free bytes with no supported executable header", () => {
    expect(() => inspectBunBinaryHeader(new Uint8Array(256))).toThrow(/no supported ELF, Mach-O, or PE/u)
  })
})
