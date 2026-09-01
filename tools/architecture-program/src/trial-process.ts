import { Buffer } from "node:buffer"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createHash, type Hash } from "node:crypto"
import { Context, Effect, Layer, Schema } from "effect"
import { parseCanonicalJsonBytes } from "./canonical-document.js"
import { Sha256Hex, type Sha256Hex as Sha256HexType } from "./schema/primitives.js"
import { sha256Bytes } from "./trial-hash.js"

export const TRIAL_PROCESS_OUTPUT_LIMIT_BYTES = 1_048_576

const maximumTimeoutMilliseconds = 2_147_483_647
const fixedEnvironment = {
  LC_ALL: "C",
  LANG: "C",
  TZ: "UTC",
  NO_COLOR: "1"
} as const
const fixedGitMeasurementEnvironment = {
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_ATTR_NOSYSTEM: "1"
} as const

export type TrialProcessEnvironmentProfile = "candidate" | "git-measurement"

const OutputStream = Schema.Literals(["stdout", "stderr"])
type OutputStream = typeof OutputStream.Type
const ProcessIoOperation = Schema.Literals(["stdin", "stdout", "stderr", "child", "close"])
export type TrialProcessIoOperation = typeof ProcessIoOperation.Type
const CaptureCompleteness = Schema.Literals(["Complete", "Prefix"])
export type TrialProcessCaptureCompleteness = typeof CaptureCompleteness.Type

/** Exact bytes observed by the parent, distinguished from a claim that the stream reached EOF. */
export class TrialProcessStreamCapture extends Schema.Class<TrialProcessStreamCapture>(
  "TrialProcessStreamCapture"
)({
  completeness: CaptureCompleteness,
  byteLength: Schema.Natural,
  sha256: Sha256Hex
}) {}

export const makeTrialProcessStreamCapture = (
  completeness: TrialProcessCaptureCompleteness,
  bytes: Uint8Array
): TrialProcessStreamCapture => new TrialProcessStreamCapture({
  completeness,
  byteLength: bytes.byteLength,
  sha256: sha256Bytes(bytes)
})

const emptyCapture = (
  completeness: TrialProcessCaptureCompleteness
): TrialProcessStreamCapture => makeTrialProcessStreamCapture(completeness, new Uint8Array())

export class TrialProcessInvalidRequestError extends Schema.TaggedError<TrialProcessInvalidRequestError>()(
  "TrialProcessInvalidRequestError",
  { reason: Schema.String, message: Schema.String }
) {
  constructor(reason: string) {
    super({ reason, message: `Invalid trial process request: ${reason}.` })
  }
}

export class TrialProcessSpawnError extends Schema.TaggedError<TrialProcessSpawnError>()(
  "TrialProcessSpawnError",
  { executable: Schema.String, reason: Schema.String, message: Schema.String }
) {
  constructor(executable: string, sourceCause: unknown) {
    const reason = sourceCause instanceof Error ? sourceCause.message : String(sourceCause)
    super({ executable, reason, message: `Unable to run ${JSON.stringify(executable)}: ${reason}.` })
  }
}

export class TrialProcessTimeoutError extends Schema.TaggedError<TrialProcessTimeoutError>()(
  "TrialProcessTimeoutError",
  {
    timeoutMilliseconds: Schema.Natural,
    stdout: TrialProcessStreamCapture,
    stderr: TrialProcessStreamCapture,
    message: Schema.String
  }
) {
  constructor(
    timeoutMilliseconds: number,
    stdout: TrialProcessStreamCapture = emptyCapture("Prefix"),
    stderr: TrialProcessStreamCapture = emptyCapture("Prefix")
  ) {
    super({
      timeoutMilliseconds,
      stdout,
      stderr,
      message: `Trial process exceeded its ${timeoutMilliseconds} millisecond timeout.`
    })
  }
}

export class TrialProcessSignalError extends Schema.TaggedError<TrialProcessSignalError>()(
  "TrialProcessSignalError",
  {
    signal: Schema.String,
    stdout: TrialProcessStreamCapture,
    stderr: TrialProcessStreamCapture,
    message: Schema.String
  }
) {
  constructor(
    signal: string,
    stdout: TrialProcessStreamCapture = emptyCapture("Prefix"),
    stderr: TrialProcessStreamCapture = emptyCapture("Prefix")
  ) {
    super({ stdout, stderr, signal, message: `Trial process was terminated by ${signal}.` })
  }
}

export class TrialProcessOutputLimitError extends Schema.TaggedError<TrialProcessOutputLimitError>()(
  "TrialProcessOutputLimitError",
  {
    stream: OutputStream,
    limitBytes: Schema.Natural,
    observedBytes: Schema.Natural,
    stdout: TrialProcessStreamCapture,
    stderr: TrialProcessStreamCapture,
    message: Schema.String
  }
) {
  constructor(
    stream: OutputStream,
    observedBytes: number,
    stdout: TrialProcessStreamCapture,
    stderr: TrialProcessStreamCapture
  ) {
    super({
      stream,
      limitBytes: TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
      observedBytes,
      stdout,
      stderr,
      message: `Trial process ${stream} exceeded the ${TRIAL_PROCESS_OUTPUT_LIMIT_BYTES} byte limit.`
    })
  }
}

/** The child started, but its process or stdio channel failed before a factual exit was available. */
export class TrialProcessIoError extends Schema.TaggedError<TrialProcessIoError>()(
  "TrialProcessIoError",
  {
    operation: ProcessIoOperation,
    reason: Schema.String,
    stdout: TrialProcessStreamCapture,
    stderr: TrialProcessStreamCapture,
    message: Schema.String
  }
) {
  constructor(
    operation: TrialProcessIoOperation,
    sourceCause: unknown,
    stdout: TrialProcessStreamCapture,
    stderr: TrialProcessStreamCapture
  ) {
    const reason = sourceCause instanceof Error ? sourceCause.message : String(sourceCause)
    super({
      operation,
      reason,
      stdout,
      stderr,
      message: `Trial process ${operation} channel failed after start: ${reason}.`
    })
  }
}

export type TrialProcessError =
  | TrialProcessInvalidRequestError
  | TrialProcessIoError
  | TrialProcessOutputLimitError
  | TrialProcessSignalError
  | TrialProcessSpawnError
  | TrialProcessTimeoutError

export type TrialProcessClosedEnvironment = Readonly<Record<string, string | undefined>>

export interface TrialProcessRequest {
  readonly argv: readonly [string, ...string[]]
  readonly cwd: string
  readonly stdin: Uint8Array
  readonly timeoutMilliseconds: number
  readonly closedEnvironment: TrialProcessClosedEnvironment
  readonly environmentProfile?: TrialProcessEnvironmentProfile
}

export interface TrialProcessResult {
  readonly exitCode: number
  readonly stdout: Uint8Array
  readonly stderr: Uint8Array
}

export interface TrialProcessService {
  readonly run: (
    request: TrialProcessRequest
  ) => Effect.Effect<TrialProcessResult, TrialProcessError, never>
}

export interface MakeTrialProcessOptions {
  readonly inheritedEnvironment?: TrialProcessClosedEnvironment
  readonly spawn?: typeof spawn
}

interface ValidatedTrialProcessRequest {
  readonly argv: readonly [string, ...string[]]
  readonly cwd: string
  readonly stdin: Uint8Array
  readonly timeoutMilliseconds: number
  readonly path: string
  readonly environmentProfile: TrialProcessEnvironmentProfile
}

type RuntimeError =
  | TrialProcessIoError
  | TrialProcessOutputLimitError
  | TrialProcessSignalError
  | TrialProcessSpawnError
  | TrialProcessTimeoutError

const credentialOrProxyVariableName = (name: string): boolean =>
  /(?:^|_)(?:AUTH(?:ORIZATION)?|CREDENTIALS?|KEY|PASS(?:WORD|WD)?|SECRET|TOKEN)(?:_|$)/iu.test(name) ||
  /(?:^|_)PROXY(?:_|$)/iu.test(name)

const invalidRequest = (reason: string): never => {
  throw new TrialProcessInvalidRequestError(reason)
}

const describeCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const validateText = (value: unknown, name: string, allowEmpty: boolean): string => {
  if (typeof value !== "string") return invalidRequest(`${name} must be a string`)
  if (!allowEmpty && value.length === 0) invalidRequest(`${name} must not be empty`)
  if (!value.isWellFormed()) invalidRequest(`${name} must not contain an unpaired UTF-16 surrogate`)
  if (value.includes("\u0000")) invalidRequest(`${name} must not contain NUL`)
  return value
}

const requestedPath = (environment: unknown): string | undefined => {
  if (typeof environment !== "object" || environment === null || Array.isArray(environment)) {
    return invalidRequest("closedEnvironment must be an object")
  }
  const prototype = Object.getPrototypeOf(environment)
  if (prototype !== Object.prototype && prototype !== null) {
    return invalidRequest("closedEnvironment must be a plain object")
  }

  let path: string | undefined
  for (const key of Reflect.ownKeys(environment)) {
    if (typeof key !== "string") return invalidRequest("closedEnvironment must not contain symbol keys")
    if (credentialOrProxyVariableName(key)) {
      invalidRequest(`closedEnvironment requests forbidden credential or proxy variable ${JSON.stringify(key)}`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(environment, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return invalidRequest(`closedEnvironment variable ${JSON.stringify(key)} must be an enumerable data property`)
    }
    const value = descriptor.value as unknown
    if (value !== undefined && typeof value !== "string") {
      invalidRequest(`closedEnvironment variable ${JSON.stringify(key)} must be a string`)
    }
    if (key === "PATH") {
      path = value as string | undefined
      continue
    }
    if (Object.hasOwn(fixedEnvironment, key)) {
      const expected = fixedEnvironment[key as keyof typeof fixedEnvironment]
      if (value !== undefined && value !== expected) {
        invalidRequest(`closedEnvironment variable ${key} must equal ${JSON.stringify(expected)}`)
      }
      continue
    }
    invalidRequest(`closedEnvironment must not request variable ${JSON.stringify(key)}`)
  }
  return path
}

const inheritedPath = (environment: TrialProcessClosedEnvironment): string | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(environment, "PATH")
  if (descriptor === undefined) return undefined
  if (!("value" in descriptor)) invalidRequest("inherited PATH must be a data property")
  if (descriptor.value !== undefined && typeof descriptor.value !== "string") {
    invalidRequest("inherited PATH must be a string")
  }
  return descriptor.value as string | undefined
}

const validateRequest = (
  request: TrialProcessRequest,
  environment: TrialProcessClosedEnvironment
): ValidatedTrialProcessRequest => {
  if (typeof request !== "object" || request === null) invalidRequest("request must be an object")
  if (!Array.isArray(request.argv) || request.argv.length === 0) {
    invalidRequest("argv must be a nonempty array")
  }
  const argv = request.argv.map((argument, index) =>
    validateText(argument, `argv[${index}]`, index !== 0))
  if (argv.length === 0) return invalidRequest("argv must be a nonempty array")

  const cwd = validateText(request.cwd, "cwd", false)
  if (!(request.stdin instanceof Uint8Array)) invalidRequest("stdin must be a Uint8Array")
  const stdin = Uint8Array.from(request.stdin)
  try {
    parseCanonicalJsonBytes(stdin)
  } catch (cause) {
    invalidRequest(`stdin must be CanonicalJsonV1 (${describeCause(cause)})`)
  }

  if (!Number.isSafeInteger(request.timeoutMilliseconds) ||
    request.timeoutMilliseconds <= 0 ||
    request.timeoutMilliseconds > maximumTimeoutMilliseconds) {
    invalidRequest(`timeoutMilliseconds must be an integer from 1 through ${maximumTimeoutMilliseconds}`)
  }

  const suppliedPath = requestedPath(request.closedEnvironment)
  const path = validateText(suppliedPath ?? inheritedPath(environment), "PATH", false)
  const environmentProfile = request.environmentProfile ?? "candidate"
  if (environmentProfile !== "candidate" && environmentProfile !== "git-measurement") {
    invalidRequest("environmentProfile must be candidate or git-measurement")
  }
  return {
    argv: argv as [string, ...string[]],
    cwd,
    stdin,
    timeoutMilliseconds: request.timeoutMilliseconds,
    path,
    environmentProfile
  }
}

const execute = (
  request: ValidatedTrialProcessRequest,
  spawnChild: typeof spawn
): Effect.Effect<TrialProcessResult, RuntimeError> =>
  Effect.callback<TrialProcessResult, RuntimeError>((resume) => {
    const childEnvironment: NodeJS.ProcessEnv = {
      PATH: request.path,
      ...fixedEnvironment,
      ...(request.environmentProfile === "git-measurement"
        ? fixedGitMeasurementEnvironment
        : {})
    }

    let child: ChildProcessWithoutNullStreams
    try {
      child = spawnChild(request.argv[0], request.argv.slice(1), {
        cwd: request.cwd,
        detached: process.platform !== "win32",
        env: childEnvironment,
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      }) as ChildProcessWithoutNullStreams
    } catch (cause) {
      resume(Effect.fail(new TrialProcessSpawnError(request.argv[0], cause)))
      return
    }

    if (child.stdin === null || child.stdout === null || child.stderr === null) {
      try {
        child.kill("SIGKILL")
      } catch {
        // The typed spawn failure below is authoritative.
      }
      resume(Effect.fail(new TrialProcessSpawnError(request.argv[0], "spawn did not create piped stdio")))
      return
    }

    const stdoutChunks: Array<Buffer> = []
    const stderrChunks: Array<Buffer> = []
    const stdoutHash = createHash("sha256")
    const stderrHash = createHash("sha256")
    let stdoutBytes = 0
    let stderrBytes = 0
    let completed = false
    let failure: RuntimeError | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    let closeOutcome: readonly [number | null, NodeJS.Signals | null] | undefined
    let stdoutEnded = false
    let stderrEnded = false
    let spawned = false

    const killInvocation = (): void => {
      if (process.platform !== "win32" && child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGKILL")
          return
        } catch {
          // Fall back to the direct handle. The process group may already be gone.
        }
      }
      try {
        child.kill("SIGKILL")
      } catch {
        // A concurrent exit is observed by the close handler.
      }
    }

    const stopInvocation = (): void => {
      killInvocation()
      child.stdin.destroy()
      child.stdout.destroy()
      child.stderr.destroy()
    }

    const finishCapture = (
      completeness: TrialProcessCaptureCompleteness,
      byteLength: number,
      hash: Hash
    ): TrialProcessStreamCapture => new TrialProcessStreamCapture({
      completeness,
      byteLength,
      sha256: hash.digest("hex") as Sha256HexType
    })

    const interruptedCaptures = (
      forcedPrefix?: OutputStream
    ): readonly [TrialProcessStreamCapture, TrialProcessStreamCapture] => [
      finishCapture(
        forcedPrefix === "stdout" || !stdoutEnded ? "Prefix" : "Complete",
        stdoutBytes,
        stdoutHash
      ),
      finishCapture(
        forcedPrefix === "stderr" || !stderrEnded ? "Prefix" : "Complete",
        stderrBytes,
        stderrHash
      )
    ]

    const onStdout = (chunk: Buffer): void => {
      const observedBytes = stdoutBytes + chunk.byteLength
      stdoutBytes = observedBytes
      stdoutHash.update(chunk)
      if (observedBytes > TRIAL_PROCESS_OUTPUT_LIMIT_BYTES) {
        const [stdout, stderr] = interruptedCaptures("stdout")
        failure ??= new TrialProcessOutputLimitError("stdout", observedBytes, stdout, stderr)
        stopInvocation()
        finish(closeOutcome?.[0] ?? null, closeOutcome?.[1] ?? null)
        return
      }
      stdoutChunks.push(Buffer.from(chunk))
    }

    const onStderr = (chunk: Buffer): void => {
      const observedBytes = stderrBytes + chunk.byteLength
      stderrBytes = observedBytes
      stderrHash.update(chunk)
      if (observedBytes > TRIAL_PROCESS_OUTPUT_LIMIT_BYTES) {
        const [stdout, stderr] = interruptedCaptures("stderr")
        failure ??= new TrialProcessOutputLimitError("stderr", observedBytes, stdout, stderr)
        stopInvocation()
        finish(closeOutcome?.[0] ?? null, closeOutcome?.[1] ?? null)
        return
      }
      stderrChunks.push(Buffer.from(chunk))
    }

    const failIoInvocation = (operation: TrialProcessIoOperation, cause: unknown): void => {
      if (completed || failure !== undefined) return
      const [stdout, stderr] = interruptedCaptures()
      failure = new TrialProcessIoError(operation, cause, stdout, stderr)
      stopInvocation()
      finish(closeOutcome?.[0] ?? null, closeOutcome?.[1] ?? null)
    }

    const onStdoutError = (cause: Error): void => failIoInvocation("stdout", cause)
    const onStderrError = (cause: Error): void => failIoInvocation("stderr", cause)

    const onStdinError = (cause: NodeJS.ErrnoException): void => {
      if (cause.code === "EPIPE" || cause.code === "ERR_STREAM_DESTROYED") return
      failIoInvocation("stdin", cause)
    }

    const cleanup = (): void => {
      if (timeout !== undefined) clearTimeout(timeout)
      child.stdout.off("data", onStdout)
      child.stdout.off("end", onStdoutEnd)
      child.stdout.off("error", onStdoutError)
      child.stderr.off("data", onStderr)
      child.stderr.off("end", onStderrEnd)
      child.stderr.off("error", onStderrError)
      child.stdin.off("error", onStdinError)
      child.off("spawn", onSpawn)
      child.off("error", onChildError)
      child.off("close", onClose)
    }

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      if (completed) return
      completed = true
      cleanup()
      if (failure !== undefined) {
        resume(Effect.fail(failure))
        return
      }
      if (exitCode === null) {
        if (signal === null) {
          resume(Effect.fail(new TrialProcessIoError(
            "close",
            "process closed without an exit code or signal",
            finishCapture(stdoutEnded ? "Complete" : "Prefix", stdoutBytes, stdoutHash),
            finishCapture(stderrEnded ? "Complete" : "Prefix", stderrBytes, stderrHash)
          )))
        } else {
          resume(Effect.fail(new TrialProcessSignalError(
            signal,
            finishCapture("Complete", stdoutBytes, stdoutHash),
            finishCapture("Complete", stderrBytes, stderrHash)
          )))
        }
        return
      }
      resume(Effect.succeed({
        exitCode,
        stdout: new Uint8Array(Buffer.concat(stdoutChunks, stdoutBytes)),
        stderr: new Uint8Array(Buffer.concat(stderrChunks, stderrBytes))
      }))
    }

    function onSpawn(): void {
      spawned = true
    }

    function onChildError(cause: Error): void {
      if (completed || failure !== undefined) return
      if (spawned) {
        const [stdout, stderr] = interruptedCaptures()
        failure = new TrialProcessIoError("child", cause, stdout, stderr)
      } else {
        failure = new TrialProcessSpawnError(request.argv[0], cause)
      }
      stopInvocation()
      finish(closeOutcome?.[0] ?? null, closeOutcome?.[1] ?? null)
    }

    const maybeFinish = (): void => {
      if (closeOutcome === undefined || !stdoutEnded || !stderrEnded) return
      finish(closeOutcome[0], closeOutcome[1])
    }

    function onStdoutEnd(): void {
      stdoutEnded = true
      maybeFinish()
    }

    function onStderrEnd(): void {
      stderrEnded = true
      maybeFinish()
    }

    function onClose(exitCode: number | null, signal: NodeJS.Signals | null): void {
      closeOutcome = [exitCode, signal]
      maybeFinish()
    }

    child.stdout.on("data", onStdout)
    child.stdout.once("end", onStdoutEnd)
    child.stdout.once("error", onStdoutError)
    child.stderr.on("data", onStderr)
    child.stderr.once("end", onStderrEnd)
    child.stderr.once("error", onStderrError)
    child.stdin.once("error", onStdinError)
    child.once("spawn", onSpawn)
    child.once("error", onChildError)
    child.once("close", onClose)

    timeout = setTimeout(() => {
      if (completed) return
      const [stdout, stderr] = interruptedCaptures()
      failure ??= new TrialProcessTimeoutError(request.timeoutMilliseconds, stdout, stderr)
      stopInvocation()
      finish(closeOutcome?.[0] ?? null, closeOutcome?.[1] ?? null)
    }, request.timeoutMilliseconds)

    try {
      child.stdin.end(request.stdin)
    } catch (cause) {
      failIoInvocation("stdin", cause)
    }

    return Effect.sync(() => {
      if (completed) return
      completed = true
      cleanup()
      stopInvocation()
    })
  })

export const makeTrialProcess = (
  options: MakeTrialProcessOptions = {}
): TrialProcessService => {
  const environment = options.inheritedEnvironment ?? process.env
  const spawnChild = options.spawn ?? spawn
  const run = Effect.fn("TrialProcess.run")(function* (request: TrialProcessRequest) {
    const validated = yield* Effect.try({
      try: () => validateRequest(request, environment),
      catch: (cause) => cause instanceof TrialProcessInvalidRequestError
        ? cause
        : new TrialProcessInvalidRequestError(describeCause(cause))
    })
    return yield* execute(validated, spawnChild)
  })
  return { run }
}

export class TrialProcess extends Context.Service<TrialProcess, TrialProcessService>()(
  "@ts-release/architecture-program/TrialProcess"
) {
  static readonly layer = Layer.sync(TrialProcess, () => makeTrialProcess())
}

export const TrialProcessLive = TrialProcess.layer
