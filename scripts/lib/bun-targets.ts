import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  statSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  bunArtifactTargets,
  type BunBinaryArchitecture,
  type BunBinaryFormat
} from "../../src/capabilities/bun-targets.js"

export type ExecutableFormat = BunBinaryFormat | "pe"
export type ExecutableArchitecture = BunBinaryArchitecture

export interface BunBinaryIdentity {
  readonly format: ExecutableFormat
  readonly architecture: ExecutableArchitecture
}

export interface BunTargetCertification {
  readonly target: string
  readonly bunTarget: string
  readonly format: BunBinaryFormat
  readonly architecture: BunBinaryArchitecture
  readonly bytes: number
}

export interface BunTargetCertificationReport {
  readonly failures: ReadonlyArray<string>
  readonly results: ReadonlyArray<BunTargetCertification>
}

const has = (bytes: Uint8Array, offset: number, expected: ReadonlyArray<number>): boolean =>
  expected.every((value, index) => bytes[offset + index] === value)

const viewOf = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

const architecture = (
  value: number,
  x64: number,
  arm64: number,
  format: ExecutableFormat
): ExecutableArchitecture => {
  if (value === x64) return "x86_64"
  if (value === arm64) return "aarch64"
  throw new Error(`${format} header declares unsupported CPU value 0x${value.toString(16)}.`)
}

/** Decode only platform-owned executable headers; filenames and `file(1)` output are not evidence. */
export const inspectBunBinaryHeader = (bytes: Uint8Array): BunBinaryIdentity => {
  if (bytes.length < 64) throw new Error("Executable header is shorter than 64 bytes.")
  const view = viewOf(bytes)
  if (has(bytes, 0, [0x7f, 0x45, 0x4c, 0x46])) {
    if (bytes[4] !== 2 || bytes[5] !== 1) {
      throw new Error("ELF executable must use the 64-bit little-endian encoding.")
    }
    return {
      format: "elf",
      architecture: architecture(view.getUint16(18, true), 0x3e, 0xb7, "elf")
    }
  }
  if (view.getUint32(0, true) === 0xfeedfacf) {
    return {
      format: "mach-o",
      architecture: architecture(view.getUint32(4, true), 0x01000007, 0x0100000c, "mach-o")
    }
  }
  if (has(bytes, 0, [0x4d, 0x5a])) {
    const pe = view.getUint32(0x3c, true)
    if (pe + 6 > bytes.length || !has(bytes, pe, [0x50, 0x45, 0x00, 0x00])) {
      throw new Error("PE executable has an invalid or out-of-range COFF header offset.")
    }
    return {
      format: "pe",
      architecture: architecture(view.getUint16(pe + 4, true), 0x8664, 0xaa64, "pe")
    }
  }
  throw new Error("Executable has no supported ELF, Mach-O, or PE header.")
}

const readHeader = (path: string): Uint8Array => {
  const descriptor = openSync(path, "r")
  try {
    const bytes = new Uint8Array(4096)
    const length = readSync(descriptor, bytes, 0, bytes.length, 0)
    return bytes.subarray(0, length)
  } finally {
    closeSync(descriptor)
  }
}

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes).trim()

/**
 * Cross-compile the shipped CLI entrypoint for every advertised artifact
 * target and prove the target from its executable header.
 */
export const certifyAdvertisedBunTargets = (
  root: string,
  entry = "apps/release-ts/src/cli/node-main.ts"
): BunTargetCertificationReport => {
  const directory = mkdtempSync(join(tmpdir(), "ts-release-bun-targets-"))
  const failures: Array<string> = []
  const results: Array<BunTargetCertification> = []
  try {
    for (const target of bunArtifactTargets) {
      const output = join(directory, target.id)
      const compiled = Bun.spawnSync([
        process.execPath,
        "build",
        resolve(root, entry),
        "--compile",
        `--target=${target.bunTarget}`,
        `--outfile=${output}`
      ], {
        cwd: root,
        env: { ...process.env, NO_COLOR: "1" },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 120_000
      })
      if (compiled.exitedDueToTimeout === true || compiled.exitCode !== 0) {
        failures.push(
          `${target.id} failed ${target.bunTarget} compilation: ${
            text(compiled.stderr) || text(compiled.stdout) || `exit ${compiled.exitCode}`
          }`
        )
        continue
      }
      if (!existsSync(output)) {
        failures.push(`${target.id} compilation did not create ${output}.`)
        continue
      }
      try {
        const identity = inspectBunBinaryHeader(readHeader(output))
        if (identity.format !== target.format || identity.architecture !== target.architecture) {
          failures.push(
            `${target.id} produced ${identity.format}/${identity.architecture}, expected ${target.format}/${target.architecture}.`
          )
          continue
        }
        results.push({
          target: target.id,
          bunTarget: target.bunTarget,
          format: identity.format,
          architecture: identity.architecture,
          bytes: statSync(output).size
        })
      } catch (cause) {
        failures.push(`${target.id} header validation failed: ${cause instanceof Error ? cause.message : String(cause)}`)
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
  return { failures, results }
}
