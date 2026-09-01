import { Buffer } from "node:buffer"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { EventEmitter } from "node:events"
import { existsSync } from "node:fs"
import { delimiter, join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { canonicalJsonBytes } from "../src/canonical-document.js"
import { sha256Bytes } from "../src/trial-hash.js"
import {
  TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
  TrialProcess,
  TrialProcessInvalidRequestError,
  TrialProcessIoError,
  TrialProcessOutputLimitError,
  TrialProcessSignalError,
  TrialProcessSpawnError,
  TrialProcessTimeoutError,
  makeTrialProcess,
  type TrialProcessRequest,
  type TrialProcessService
} from "../src/trial-process.js"

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()
const inheritedPath = process.env.PATH ?? "/usr/bin:/bin"
const bunExecutable = inheritedPath
  .split(delimiter)
  .map((directory) => join(directory, "bun"))
  .find(existsSync) ?? "bun"
const liveTestLayer = Layer.succeed(TrialProcess, makeTrialProcess({
  inheritedEnvironment: { PATH: inheritedPath }
}))

const request = (
  argv: readonly [string, ...string[]],
  overrides: Partial<Omit<TrialProcessRequest, "argv">> = {}
): TrialProcessRequest => ({
  argv,
  cwd: process.cwd(),
  stdin: canonicalJsonBytes({ input: "canonical" }),
  timeoutMilliseconds: 2_000,
  closedEnvironment: {},
  ...overrides
})

const run = (processRequest: TrialProcessRequest) =>
  Effect.gen(function* () {
    const trialProcess = yield* TrialProcess
    return yield* trialProcess.run(processRequest)
  }).pipe(Effect.provide(liveTestLayer))

const runWith = (service: TrialProcessService, processRequest: TrialProcessRequest) =>
  service.run(processRequest)

interface SyntheticStream extends EventEmitter {
  destroy: () => void
  end: (...args: ReadonlyArray<unknown>) => void
}

interface SyntheticChildHarness {
  readonly child: ChildProcessWithoutNullStreams
  readonly stdin: SyntheticStream
  readonly stdout: SyntheticStream
  readonly stderr: SyntheticStream
}

const makeSyntheticStream = (): SyntheticStream => Object.assign(new EventEmitter(), {
  destroy: () => undefined,
  end: (..._args: ReadonlyArray<unknown>) => undefined
})

const makeSyntheticSpawn = (
  drive: (harness: SyntheticChildHarness) => void
): typeof spawn => (() => {
  const stdin = makeSyntheticStream()
  const stdout = makeSyntheticStream()
  const stderr = makeSyntheticStream()
  const child = Object.assign(new EventEmitter(), {
    stdin,
    stdout,
    stderr,
    pid: undefined,
    kill: () => true
  }) as unknown as ChildProcessWithoutNullStreams
  queueMicrotask(() => drive({ child, stdin, stdout, stderr }))
  return child
}) as unknown as typeof spawn

describe("TrialProcess", () => {
  it("defaults unobserved signal streams to conservative Prefix captures", () => {
    const error = new TrialProcessSignalError("SIGKILL")
    expect(error.stdout).toMatchObject({ completeness: "Prefix", byteLength: 0 })
    expect(error.stderr).toMatchObject({ completeness: "Prefix", byteLength: 0 })
  })

  it.live("writes canonical stdin and captures stdout bytes", () =>
    Effect.gen(function* () {
      const stdin = canonicalJsonBytes({ message: "round trip" })
      const result = yield* run(request([
        bunExecutable,
        "-e",
        "const chunks=[];process.stdin.on('data',c=>chunks.push(c));process.stdin.on('end',()=>process.stdout.write(Buffer.concat(chunks)))"
      ], { stdin }))

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toEqual(stdin)
      expect(result.stderr).toEqual(new Uint8Array())
    }))

  it.live("returns nonzero exit codes and captured stderr", () =>
    Effect.gen(function* () {
      const result = yield* run(request([
        bunExecutable,
        "-e",
        "process.stderr.write('candidate rejected\\n');process.exit(7)"
      ]))

      expect(result.exitCode).toBe(7)
      expect(result.stdout).toEqual(new Uint8Array())
      expect(textDecoder.decode(result.stderr)).toBe("candidate rejected\n")
    }))

  it.live("reports child signals distinctly from spawn failures", () =>
    Effect.gen(function* () {
      const stdout = textEncoder.encode("signal stdout\n")
      const stderr = textEncoder.encode("signal stderr\n")
      const error = yield* run(request([
        bunExecutable,
        "-e",
        [
          "process.stdout.write('signal stdout\\n')",
          "process.stderr.write('signal stderr\\n')",
          "setTimeout(() => process.kill(process.pid, 'SIGTERM'), 10)"
        ].join(";")
      ])).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialProcessSignalError)
      expect(error._tag).toBe("TrialProcessSignalError")
      if (error._tag === "TrialProcessSignalError") {
        expect(error.signal).toBe("SIGTERM")
        expect(error.stdout).toEqual({
          completeness: "Complete",
          byteLength: stdout.byteLength,
          sha256: sha256Bytes(stdout)
        })
        expect(error.stderr).toEqual({
          completeness: "Complete",
          byteLength: stderr.byteLength,
          sha256: sha256Bytes(stderr)
        })
      }
    }))

  it.effect("retains exact stream evidence for every post-spawn I/O failure", () =>
    Effect.gen(function* () {
      const observedStdout = Buffer.from("observed stdout prefix\n")
      const observedStderr = Buffer.from("observed stderr prefix\n")
      for (const operation of ["stdin", "stdout", "stderr", "child", "close"] as const) {
        const service = makeTrialProcess({
          inheritedEnvironment: { PATH: inheritedPath },
          spawn: makeSyntheticSpawn(({ child, stdin, stdout, stderr }) => {
            child.emit("spawn")
            stdout.emit("data", observedStdout)
            stderr.emit("data", observedStderr)
            if (operation === "close") {
              stdout.emit("end")
              stderr.emit("end")
              child.emit("close", null, null)
            } else if (operation === "child") {
              child.emit("error", new Error("synthetic child failure"))
            } else {
              const cause = Object.assign(new Error(`synthetic ${operation} failure`), { code: "EIO" })
              const stream = { stdin, stdout, stderr }[operation]
              stream.emit("error", cause)
            }
          })
        })
        const error = yield* runWith(
          service,
          request([bunExecutable, "-e", "process.exit(0)"])
        ).pipe(Effect.flip)

        expect(error).toBeInstanceOf(TrialProcessIoError)
        expect(error._tag).toBe("TrialProcessIoError")
        if (error._tag === "TrialProcessIoError") {
          const completeness = operation === "close" ? "Complete" : "Prefix"
          expect(error.operation).toBe(operation)
          expect(error.stdout).toEqual({
            completeness,
            byteLength: observedStdout.byteLength,
            sha256: sha256Bytes(observedStdout)
          })
          expect(error.stderr).toEqual({
            completeness,
            byteLength: observedStderr.byteLength,
            sha256: sha256Bytes(observedStderr)
          })
        }
      }
    }))

  it.live("provides only PATH and the fixed deterministic environment", () =>
    Effect.gen(function* () {
      const result = yield* run(request([
        bunExecutable,
        "-e",
        "process.stdout.write(JSON.stringify(process.env))"
      ], {
        closedEnvironment: { PATH: inheritedPath, LC_ALL: "C", LANG: "C", TZ: "UTC", NO_COLOR: "1" }
      }))
      const environment = JSON.parse(textDecoder.decode(result.stdout)) as Record<string, string>

      expect(Object.keys(environment).sort()).toEqual(["LANG", "LC_ALL", "NO_COLOR", "PATH", "TZ"])
      expect(environment).toEqual({
        PATH: inheritedPath,
        LC_ALL: "C",
        LANG: "C",
        TZ: "UTC",
        NO_COLOR: "1"
      })
    }))

  it.live("adds only the frozen config-neutral variables for Git measurement", () =>
    Effect.gen(function* () {
      const result = yield* run(request([
        bunExecutable,
        "-e",
        "process.stdout.write(JSON.stringify(process.env))"
      ], { environmentProfile: "git-measurement" }))
      const environment = JSON.parse(textDecoder.decode(result.stdout)) as Record<string, string>

      expect(environment).toEqual({
        PATH: inheritedPath,
        LC_ALL: "C",
        LANG: "C",
        TZ: "UTC",
        NO_COLOR: "1",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        GIT_ATTR_NOSYSTEM: "1"
      })
    }))

  it.live("rejects requested credentials and strips inherited credentials and proxies", () =>
    Effect.gen(function* () {
      const requestedError = yield* run(request([bunExecutable, "-e", "process.exit(0)"], {
        closedEnvironment: { PATH: inheritedPath, HTTPS_PROXY: "http://proxy.invalid" }
      })).pipe(Effect.flip)
      const inheritedService = makeTrialProcess({
        inheritedEnvironment: {
          PATH: inheritedPath,
          CANDIDATE_TOKEN: "secret",
          HTTPS_PROXY: "http://proxy.invalid"
        }
      })
      const inheritedResult = yield* runWith(
        inheritedService,
        request([
          bunExecutable,
          "-e",
          "process.stdout.write(JSON.stringify(process.env))"
        ])
      )
      const childEnvironment = JSON.parse(textDecoder.decode(inheritedResult.stdout)) as Record<string, string>

      expect(requestedError).toBeInstanceOf(TrialProcessInvalidRequestError)
      expect(requestedError._tag).toBe("TrialProcessInvalidRequestError")
      if (requestedError._tag === "TrialProcessInvalidRequestError") {
        expect(requestedError.reason).toMatch(/credential or proxy/u)
      }
      expect(childEnvironment).toEqual({
        PATH: inheritedPath,
        LC_ALL: "C",
        LANG: "C",
        TZ: "UTC",
        NO_COLOR: "1"
      })
    }))

  it.live("kills a child that exceeds its timeout", () =>
    Effect.gen(function* () {
      const stdout = textEncoder.encode("timeout stdout\n")
      const stderr = textEncoder.encode("timeout stderr\n")
      const error = yield* run(request([
        bunExecutable,
        "-e",
        [
          "process.stdout.write('timeout stdout\\n')",
          "process.stderr.write('timeout stderr\\n')",
          "setInterval(() => {}, 1_000)"
        ].join(";")
      ], { timeoutMilliseconds: 250 })).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialProcessTimeoutError)
      expect(error._tag).toBe("TrialProcessTimeoutError")
      if (error._tag === "TrialProcessTimeoutError") {
        expect(error.timeoutMilliseconds).toBe(250)
        expect(error.stdout).toEqual({
          completeness: "Prefix",
          byteLength: stdout.byteLength,
          sha256: sha256Bytes(stdout)
        })
        expect(error.stderr).toEqual({
          completeness: "Prefix",
          byteLength: stderr.byteLength,
          sha256: sha256Bytes(stderr)
        })
      }
    }))

  it.live("applies the timeout to descendants that keep inherited output pipes open", () =>
    Effect.gen(function* () {
      const startedAt = Date.now()
      const error = yield* run(request([
        bunExecutable,
        "-e",
        [
          "const { spawn } = require('node:child_process')",
          "const descendant = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 700)'],",
          "  { stdio: ['ignore', 'inherit', 'inherit'] })",
          "descendant.unref()"
        ].join("\n")
      ], { timeoutMilliseconds: 25 })).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialProcessTimeoutError)
      expect(Date.now() - startedAt).toBeLessThan(500)
    }))

  for (const stream of ["stdout", "stderr"] as const) {
    it.live(`kills a child when ${stream} exceeds one MiB`, () =>
      Effect.gen(function* () {
        const emitted = new Uint8Array(TRIAL_PROCESS_OUTPUT_LIMIT_BYTES + 1).fill(0x61)
        const error = yield* run(request([
          bunExecutable,
          "-e",
          `process.${stream}.write(Buffer.alloc(${TRIAL_PROCESS_OUTPUT_LIMIT_BYTES + 1}, 0x61))`
        ])).pipe(Effect.flip)

        expect(error).toBeInstanceOf(TrialProcessOutputLimitError)
        expect(error._tag).toBe("TrialProcessOutputLimitError")
        if (error._tag === "TrialProcessOutputLimitError") {
          expect(error.stream).toBe(stream)
          expect(error.limitBytes).toBe(TRIAL_PROCESS_OUTPUT_LIMIT_BYTES)
          expect(error.observedBytes).toBe(emitted.byteLength)
          expect(error[stream]).toEqual({
            completeness: "Prefix",
            byteLength: emitted.byteLength,
            sha256: sha256Bytes(emitted)
          })
          const otherStream = stream === "stdout" ? "stderr" : "stdout"
          expect(error[otherStream]).toEqual({
            completeness: "Prefix",
            byteLength: 0,
            sha256: sha256Bytes(new Uint8Array())
          })
        }
      }))
  }

  it.live("passes argv structurally without shell interpolation", () =>
    Effect.gen(function* () {
      const literal = "$(printf interpolated);$HOME"
      const result = yield* run(request([
        bunExecutable,
        "-e",
        "process.stdout.write(JSON.stringify(process.argv.slice(1)))",
        literal
      ]))

      expect(JSON.parse(textDecoder.decode(result.stdout))).toEqual([literal])
    }))

  it.live("rejects an empty argv before spawning", () =>
    Effect.gen(function* () {
      const invalid = request([bunExecutable]) as TrialProcessRequest & { argv: ReadonlyArray<string> }
      Object.defineProperty(invalid, "argv", { value: [], enumerable: true })
      const error = yield* run(invalid as TrialProcessRequest).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialProcessInvalidRequestError)
      expect(error._tag).toBe("TrialProcessInvalidRequestError")
      if (error._tag === "TrialProcessInvalidRequestError") {
        expect(error.reason).toMatch(/argv must be a nonempty array/u)
      }
    }))

  it.live("rejects noncanonical stdin before spawning", () =>
    Effect.gen(function* () {
      const error = yield* run(request([bunExecutable, "-e", "process.exit(0)"], {
        stdin: new TextEncoder().encode('{"b":2,"a":1}\n')
      })).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialProcessInvalidRequestError)
      expect(error._tag).toBe("TrialProcessInvalidRequestError")
      if (error._tag === "TrialProcessInvalidRequestError") expect(error.reason).toMatch(/CanonicalJsonV1/u)
    }))

  it.live("reports spawn failures in the typed error channel", () =>
    Effect.gen(function* () {
      const error = yield* run(request([
        "/definitely-not-a-real-trial-executable",
        "literal"
      ])).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialProcessSpawnError)
      expect(error._tag).toBe("TrialProcessSpawnError")
      if (error._tag === "TrialProcessSpawnError") {
        expect(error.executable).toBe("/definitely-not-a-real-trial-executable")
      }
    }))
})
