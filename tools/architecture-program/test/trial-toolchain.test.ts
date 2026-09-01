import { resolve } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import {
  TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES,
  TRIAL_TOOLCHAIN_GIT_TIMEOUT_MILLISECONDS,
  TrialToolchain,
  TrialToolchainInputError,
  TrialToolchainPackageError,
  TrialToolchainProcessError,
  TrialToolchainVersionError,
  makeTrialToolchain,
  type TrialToolchainFileProbe,
  type TrialToolchainProcessProbe,
  type TrialToolchainProcessRequest,
  type TrialToolchainProbes,
  type TrialToolchainRuntimeProbe
} from "../src/trial-toolchain.js"
import { sha256Bytes } from "../src/trial-hash.js"

const encoder = new TextEncoder()
const programRoot = resolve("/fixture/architecture-program")
const typescriptPackagePath = resolve(programRoot, "node_modules", "typescript", "package.json")
const effectPackagePath = resolve(programRoot, "node_modules", "effect", "package.json")
const bunExecutablePath = "/runtime/bun"
const gitExecutablePath = "/exact/bin/git"
const bubblewrapExecutablePath = "/usr/bin/bwrap"
const bunExecutableBytes = encoder.encode("exact bun executable")
const gitExecutableBytes = encoder.encode("exact git executable")
const bubblewrapExecutableBytes = encoder.encode("exact bubblewrap executable")

const packageBytes = (name: string, version: unknown): Uint8Array =>
  encoder.encode(JSON.stringify({ name, version }))

const successfulGitProcessResult = {
  exitCode: 0,
  stdout: encoder.encode("git version 2.47.3\n"),
  stderr: new Uint8Array()
}
const successfulBubblewrapProcessResult = {
  exitCode: 0,
  stdout: encoder.encode("bubblewrap 0.9.0\n"),
  stderr: new Uint8Array()
}

const executableStat = (bytes: Uint8Array) => ({
  dev: 1,
  ino: 2,
  mode: 0o100755,
  size: bytes.byteLength,
  mtimeMs: 1,
  ctimeMs: 1,
  isFile: () => true,
  isSymbolicLink: () => false
}) as any

interface ProbeOverrides {
  readonly file?: Partial<TrialToolchainFileProbe>
  readonly process?: TrialToolchainProcessProbe
  readonly runtime?: Partial<TrialToolchainRuntimeProbe>
}

const defaultRead = (path: string) => path === typescriptPackagePath
  ? Effect.succeed(packageBytes("typescript", "6.0.3"))
  : path === effectPackagePath
  ? Effect.succeed(packageBytes("effect", "4.0.0-rc.108"))
  : path === bunExecutablePath
  ? Effect.succeed(bunExecutableBytes)
  : path === gitExecutablePath
  ? Effect.succeed(gitExecutableBytes)
  : path === bubblewrapExecutablePath
  ? Effect.succeed(bubblewrapExecutableBytes)
  : Effect.fail(new Error(`unexpected path ${path}`))

const makeProbes = (overrides: ProbeOverrides = {}): TrialToolchainProbes => ({
  file: {
    read: defaultRead,
    realpath: (path) => Effect.succeed(path),
    lstat: (path) => path === bunExecutablePath
      ? Effect.succeed(executableStat(bunExecutableBytes))
      : path === gitExecutablePath
      ? Effect.succeed(executableStat(gitExecutableBytes))
      : path === bubblewrapExecutablePath
      ? Effect.succeed(executableStat(bubblewrapExecutableBytes))
      : Effect.fail(new Error(`unexpected stat ${path}`)),
    ...overrides.file
  },
  process: overrides.process ?? {
    run: (request) => Effect.succeed(
      request.argv[0] === bubblewrapExecutablePath
        ? successfulBubblewrapProcessResult
        : successfulGitProcessResult
    )
  },
  runtime: {
    bunVersion: () => "1.3.14",
    bunExecutablePath: () => bunExecutablePath,
    gitExecutablePath: () => gitExecutablePath,
    bubblewrapExecutablePath: () => bubblewrapExecutablePath,
    inheritedPath: () => "/exact/bin:/usr/bin",
    ...overrides.runtime
  }
})

describe("TrialToolchain", () => {
  it.effect("binds exact executable bytes and discovers structural toolchain versions", () =>
    Effect.gen(function* () {
      const readPaths: Array<string> = []
      const requests: Array<TrialToolchainProcessRequest> = []
      const probes = makeProbes({
        file: {
          read: (path) => {
            readPaths.push(path)
            if (path === typescriptPackagePath) {
              return Effect.succeed(packageBytes("typescript", "6.0.3"))
            }
            if (path === effectPackagePath) {
              return Effect.succeed(packageBytes("effect", "4.0.0-rc.108"))
            }
            if (path === bunExecutablePath) return Effect.succeed(bunExecutableBytes)
            if (path === gitExecutablePath) return Effect.succeed(gitExecutableBytes)
            if (path === bubblewrapExecutablePath) {
              return Effect.succeed(bubblewrapExecutableBytes)
            }
            return Effect.fail(new Error(`unexpected path ${path}`))
          }
        },
        process: {
          run: (request) => {
            requests.push(request)
            return Effect.succeed(
              request.argv[0] === bubblewrapExecutablePath
                ? successfulBubblewrapProcessResult
                : successfulGitProcessResult
            )
          }
        }
      })
      const spoofedCallerClaim = {
        bun: "99.0.0",
        typescript: "99.0.0",
        effect: "99.0.0",
        git: "99.0.0"
      }

      const toolchain = yield* makeTrialToolchain(probes).discover(programRoot)

      expect(toolchain).toEqual({
        bun: "1.3.14",
        bunExecutableSha256: sha256Bytes(bunExecutableBytes),
        typescript: "6.0.3",
        effect: "4.0.0-rc.108",
        git: "2.47.3",
        gitExecutableSha256: sha256Bytes(gitExecutableBytes),
        bubblewrapVersion: "0.9.0",
        bubblewrapExecutableSha256: sha256Bytes(bubblewrapExecutableBytes)
      })
      expect(toolchain).not.toEqual(spoofedCallerClaim)
      expect(readPaths).toEqual([
        bunExecutablePath,
        gitExecutablePath,
        bubblewrapExecutablePath,
        typescriptPackagePath,
        effectPackagePath
      ])
      const expectedRequest = (argv: readonly [string, "--version"]) => ({
        argv,
        cwd: programRoot,
        closedEnvironment: {
          PATH: "/exact/bin:/usr/bin",
          LC_ALL: "C",
          LANG: "C",
          TZ: "UTC",
          NO_COLOR: "1"
        },
        timeoutMilliseconds: TRIAL_TOOLCHAIN_GIT_TIMEOUT_MILLISECONDS,
        outputLimitBytes: TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES,
        shell: false
      })
      expect(requests).toEqual([
        expectedRequest([gitExecutablePath, "--version"]),
        expectedRequest([bubblewrapExecutablePath, "--version"])
      ])
    }))

  it.effect("provides the injectable constructor through the Effect service boundary", () => {
    const service = makeTrialToolchain(makeProbes())
    return Effect.gen(function* () {
      const toolchainService = yield* TrialToolchain
      const toolchain = yield* toolchainService.discover(programRoot)
      expect(toolchain.git).toBe("2.47.3")
    }).pipe(Effect.provide(Layer.succeed(TrialToolchain, service)))
  })

  it.effect("rejects a structured caller claim instead of accepting claimed versions", () =>
    Effect.gen(function* () {
      let probeCalls = 0
      const probes = makeProbes({
        runtime: {
          bunVersion: () => {
            probeCalls += 1
            return "1.3.14"
          },
          inheritedPath: () => "/usr/bin"
        }
      })
      const spoofedInput = {
        programRoot,
        toolchain: { bun: "99.0.0", typescript: "99.0.0", effect: "99.0.0", git: "99.0.0" }
      } as unknown as string

      const error = yield* makeTrialToolchain(probes).discover(spoofedInput).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialToolchainInputError)
      expect(error._tag).toBe("TrialToolchainInputError")
      expect(probeCalls).toBe(0)
    }))

  it.effect("rejects malformed or missing runtime and package versions", () =>
    Effect.gen(function* () {
      const malformedBun = yield* makeTrialToolchain(makeProbes({
        runtime: { bunVersion: () => "v1.3.14", inheritedPath: () => "/usr/bin" }
      })).discover(programRoot).pipe(Effect.flip)
      expect(malformedBun).toBeInstanceOf(TrialToolchainVersionError)
      if (malformedBun._tag === "TrialToolchainVersionError") expect(malformedBun.tool).toBe("bun")

      const missingTypeScript = yield* makeTrialToolchain(makeProbes({
        file: {
          read: (path) => path === typescriptPackagePath
            ? Effect.succeed(encoder.encode(JSON.stringify({ name: "typescript" })))
            : defaultRead(path)
        }
      })).discover(programRoot).pipe(Effect.flip)
      expect(missingTypeScript).toBeInstanceOf(TrialToolchainVersionError)
      if (missingTypeScript._tag === "TrialToolchainVersionError") {
        expect(missingTypeScript.tool).toBe("typescript")
      }

      const wrongEffectPackage = yield* makeTrialToolchain(makeProbes({
        file: {
          read: (path) => path === typescriptPackagePath
            ? Effect.succeed(packageBytes("typescript", "6.0.3"))
            : path === effectPackagePath
            ? Effect.succeed(packageBytes("spoofed-effect", "4.0.0-rc.108"))
            : defaultRead(path)
        }
      })).discover(programRoot).pipe(Effect.flip)
      expect(wrongEffectPackage).toBeInstanceOf(TrialToolchainPackageError)
      if (wrongEffectPackage._tag === "TrialToolchainPackageError") {
        expect(wrongEffectPackage.tool).toBe("effect")
      }
    }))

  it.effect("maps missing package files and process-probe failures to typed Schema errors", () =>
    Effect.gen(function* () {
      const missingPackage = yield* makeTrialToolchain(makeProbes({
        file: {
          read: (path) => path === typescriptPackagePath
            ? Effect.fail(new Error("ENOENT"))
            : defaultRead(path)
        }
      })).discover(programRoot).pipe(Effect.flip)
      expect(missingPackage).toBeInstanceOf(TrialToolchainPackageError)
      if (missingPackage._tag === "TrialToolchainPackageError") {
        expect(missingPackage.path).toBe(typescriptPackagePath)
        expect(missingPackage.reason).toContain("ENOENT")
      }

      const processFailure = yield* makeTrialToolchain(makeProbes({
        process: { run: () => Effect.fail(new Error("timed out")) }
      })).discover(programRoot).pipe(Effect.flip)
      expect(processFailure).toBeInstanceOf(TrialToolchainProcessError)
      if (processFailure._tag === "TrialToolchainProcessError") {
        expect(processFailure.reason).toContain("timed out")
      }
    }))

  it.effect("rejects missing PATH, nonzero Git, stderr output, and malformed Git versions", () =>
    Effect.gen(function* () {
      const missingPath = yield* makeTrialToolchain(makeProbes({
        runtime: { bunVersion: () => "1.3.14", inheritedPath: () => undefined }
      })).discover(programRoot).pipe(Effect.flip)
      expect(missingPath).toBeInstanceOf(TrialToolchainInputError)

      const invalidResults = [
        {
          result: { exitCode: 7, stdout: new Uint8Array(), stderr: new Uint8Array() },
          error: TrialToolchainProcessError
        },
        {
          result: { exitCode: 0, stdout: encoder.encode("git version 2.47.3\n"), stderr: encoder.encode("warning") },
          error: TrialToolchainProcessError
        },
        {
          result: { exitCode: 0, stdout: encoder.encode("Git 2.47.3\n"), stderr: new Uint8Array() },
          error: TrialToolchainVersionError
        }
      ] as const
      for (const invalid of invalidResults) {
        const error = yield* makeTrialToolchain(makeProbes({
          process: { run: () => Effect.succeed(invalid.result) }
        })).discover(programRoot).pipe(Effect.flip)
        expect(error).toBeInstanceOf(invalid.error)
      }
    }))

  it.effect("rejects injected process output that exceeds the live byte bound", () =>
    Effect.gen(function* () {
      const error = yield* makeTrialToolchain(makeProbes({
        process: {
          run: () => Effect.succeed({
            exitCode: 0,
            stdout: new Uint8Array(TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES + 1),
            stderr: new Uint8Array()
          })
        }
      })).discover(programRoot).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialToolchainProcessError)
      if (error._tag === "TrialToolchainProcessError") expect(error.reason).toContain("stdout exceeded")
    }))
})
