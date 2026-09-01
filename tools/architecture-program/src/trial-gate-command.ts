import { constants, type Stats } from "node:fs"
import { lstat, open, realpath, type FileHandle } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { Effect, Result } from "effect"
import { canonicalJsonBytes } from "./canonical-document.js"
import { ArtifactId, type Sha256Hex } from "./schema/primitives.js"
import {
  CompleteProcessStreamEvidence,
  ExitedProcessAttempt,
  IoFailedProcessAttempt,
  NotStartedProcessAttempt,
  OutputLimitedProcessAttempt,
  PrefixProcessStreamEvidence,
  SignaledProcessAttempt,
  TimedOutProcessAttempt,
  computeGateCommandInputSha256,
  encodeGateCommandInput,
  makeGateCommandInput,
  type GateCommandInputV2,
  type ProcessAttemptEvidence,
  type ProcessStreamEvidence
} from "./schema/trial-result.js"
import { gateDefinitionSha256, type ArchitectureTrialSpecV2 } from "./schema/trial-spec.js"
import { sha256Bytes } from "./trial-hash.js"
import { inventoryCanonicalTree } from "./trial-inventory.js"
import {
  TrialProcessIoError,
  TrialProcessOutputLimitError,
  TrialProcessSignalError,
  TrialProcessTimeoutError,
  makeTrialProcess,
  type TrialProcessError,
  type TrialProcessResult,
  type TrialProcessService,
  type TrialProcessStreamCapture
} from "./trial-process.js"

export const TRIAL_GATE_COMMAND_TIMEOUT_MILLISECONDS = 30_000

export interface MakeTrialGateCommandExecutorOptions {
  readonly repositoryRoot: string
  readonly runnerSourceRoot: string
  readonly expectedRunnerSourceTreeSha256: Sha256Hex
  readonly runnerPackageManifestPath: string
  readonly expectedRunnerPackageManifestSha256: Sha256Hex
  readonly runnerTypeScriptConfigPath: string
  readonly expectedRunnerTypeScriptConfigSha256: Sha256Hex
  readonly bunExecutablePath: string
  readonly expectedBunExecutableSha256: Sha256Hex
  readonly inheritedPath: string
  readonly trialProcess?: TrialProcessService
}

export interface GateCommandExecution {
  readonly processAttempt: ProcessAttemptEvidence
  readonly failureIds: ReadonlyArray<typeof ArtifactId.Type>
}

export interface GateCommandExecutionRequest {
  readonly gate: ArchitectureTrialSpecV2["gateRequirements"][number]
  readonly commandInput: GateCommandInputV2
  /** Ephemeral host path to the already hash-verified no-follow snapshot. Never receipt identity. */
  readonly inspectionRoot: string | null
}

export interface GateCommandExecutor {
  readonly execute: (
    request: GateCommandExecutionRequest
  ) => Effect.Effect<unknown, never, never>
}

const sameStat = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.mode === right.mode &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

const sameRetainedNode = (left: Stats, right: Stats): boolean =>
  sameStat(left, right) &&
  left.nlink === right.nlink &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.rdev === right.rdev

const verifyBunExecutable = async (
  path: string,
  expectedSha256: Sha256Hex
): Promise<void> => {
  if (!isAbsolute(path) || resolve(path) !== path || await realpath(path) !== path) {
    throw new Error("retained Bun path must be one canonical resolved absolute path")
  }
  const before = await lstat(path)
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o111) === 0) {
    throw new Error("retained Bun path must identify an executable regular file")
  }
  if (typeof constants.O_NOFOLLOW !== "number") throw new Error("O_NOFOLLOW is unavailable")
  let handle: FileHandle | undefined
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const opened = await handle.stat()
    if (!opened.isFile() || !sameRetainedNode(before, opened)) {
      throw new Error("opened Bun inode differs from its retained path snapshot")
    }
    const bytes = new Uint8Array(await handle.readFile())
    const afterRead = await handle.stat()
    const afterPath = await lstat(path)
    if (!afterRead.isFile() || !sameRetainedNode(opened, afterRead) ||
      !sameRetainedNode(afterRead, afterPath) || bytes.byteLength !== afterRead.size) {
      throw new Error("retained Bun executable changed while its bytes were verified")
    }
    if (sha256Bytes(bytes) !== expectedSha256) {
      throw new Error("retained Bun executable does not equal the run-context digest")
    }
  } finally {
    await handle?.close()
  }
}

const verifyRetainedRegularFile = async (
  path: string,
  expectedSha256: Sha256Hex,
  label: string
): Promise<void> => {
  if (!isAbsolute(path) || resolve(path) !== path || await realpath(path) !== path) {
    throw new Error(`${label} path must be one canonical resolved absolute path`)
  }
  const before = await lstat(path)
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
    throw new Error(`${label} must be one unique regular file`)
  }
  if (typeof constants.O_NOFOLLOW !== "number") throw new Error("O_NOFOLLOW is unavailable")
  let handle: FileHandle | undefined
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const opened = await handle.stat()
    if (!opened.isFile() || !sameRetainedNode(before, opened)) {
      throw new Error(`opened ${label} differs from its retained path snapshot`)
    }
    const bytes = new Uint8Array(await handle.readFile())
    const afterRead = await handle.stat()
    const afterPath = await lstat(path)
    if (!afterRead.isFile() || !sameRetainedNode(opened, afterRead) ||
      !sameRetainedNode(afterRead, afterPath) || bytes.byteLength !== afterRead.size) {
      throw new Error(`${label} changed while its bytes were verified`)
    }
    if (sha256Bytes(bytes) !== expectedSha256) {
      throw new Error(`${label} does not equal the preflight digest`)
    }
  } finally {
    await handle?.close()
  }
}

const verifyRunnerSource = Effect.fn("TrialGateCommandExecutor.verifyRunnerSource")(function* (
  root: string,
  expectedSha256: Sha256Hex,
  failureId: string
) {
  yield* Effect.tryPromise({
    try: async () => {
      if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root) {
        throw new Error("runner source root must be one canonical resolved absolute path")
      }
      const stat = await lstat(root)
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error("runner source root must be a no-follow directory")
      }
    },
    catch: () => ArtifactId.make(failureId)
  })
  const inventory = yield* inventoryCanonicalTree(root).pipe(
    Effect.mapError(() => ArtifactId.make(failureId))
  )
  if (inventory.treeSha256 !== expectedSha256) {
    return yield* Effect.fail(ArtifactId.make(failureId))
  }
})

const complete = (bytes: Uint8Array): CompleteProcessStreamEvidence =>
  new CompleteProcessStreamEvidence({
    byteLength: bytes.byteLength,
    sha256: sha256Bytes(bytes)
  })

const fromCapture = (capture: TrialProcessStreamCapture): ProcessStreamEvidence =>
  capture.completeness === "Complete"
    ? new CompleteProcessStreamEvidence({
        byteLength: capture.byteLength,
        sha256: capture.sha256
      })
    : new PrefixProcessStreamEvidence({
        byteLength: capture.byteLength,
        sha256: capture.sha256
      })

const attemptFromResult = (result: TrialProcessResult): ProcessAttemptEvidence =>
  new ExitedProcessAttempt({
    exitCode: result.exitCode,
    stdout: complete(result.stdout),
    stderr: complete(result.stderr)
  })

const attemptFromError = (
  error: TrialProcessError,
  executable: string
): ProcessAttemptEvidence => {
  if (error instanceof TrialProcessIoError) {
    return new IoFailedProcessAttempt({
      operation: error.operation,
      stdout: fromCapture(error.stdout),
      stderr: fromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessTimeoutError) {
    return new TimedOutProcessAttempt({
      timeoutMilliseconds: error.timeoutMilliseconds,
      stdout: fromCapture(error.stdout),
      stderr: fromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessSignalError) {
    return new SignaledProcessAttempt({
      signal: error.signal,
      stdout: fromCapture(error.stdout),
      stderr: fromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessOutputLimitError) {
    return new OutputLimitedProcessAttempt({
      stream: error.stream,
      limitBytes: error.limitBytes,
      observedBytes: error.observedBytes,
      stdout: fromCapture(error.stdout),
      stderr: fromCapture(error.stderr)
    })
  }
  return new NotStartedProcessAttempt({ executable })
}

const commandShapeIssues = (
  gate: ArchitectureTrialSpecV2["gateRequirements"][number]
): ReadonlyArray<string> => JSON.stringify(gate.command) !== JSON.stringify([
  "bun",
  "run",
  "--no-env-file",
  "--config=/dev/null",
  "--no-install",
  "--shell=bun",
  "--cwd",
  "tools/architecture-program",
  gate.scope === "machine" ? "gate:machine" : "gate:topology",
  "--",
  "--gate",
  gate.id
])
  ? ["gate.command-shape"]
  : gate.command.some((argument) => !argument.isWellFormed() ||
      argument !== argument.normalize("NFC") || argument.includes("\u0000"))
  ? ["gate.command-text"]
  : []

const commandInputIssues = (
  request: GateCommandExecutionRequest
): ReadonlyArray<string> => {
  const expected = makeGateCommandInput(
    request.commandInput.invocation,
    request.commandInput.inspectedTreeSha256
  )
  return [
    ...(request.commandInput.invocation.gateId === request.gate.id
      ? []
      : ["gate.command-input-gate"]),
    ...(request.commandInput.invocation.definitionSha256 === gateDefinitionSha256(request.gate) &&
      JSON.stringify(request.commandInput.invocation.lawIds) === JSON.stringify(request.gate.lawIds) &&
      JSON.stringify(request.commandInput.invocation.caseIds) === JSON.stringify(request.gate.caseIds) &&
      JSON.stringify(request.commandInput.invocation.probeIds) === JSON.stringify(request.gate.probeIds)
      ? []
      : ["gate.command-input-definition"]),
    ...(request.commandInput.inspectedTreeSha256 ===
      request.commandInput.invocation.candidateTreeSha256
      ? []
      : ["gate.command-input-tree"]),
    ...(request.commandInput.invocationSha256 === expected.invocationSha256
      ? []
      : ["gate.command-input-invocation"]),
    ...(computeGateCommandInputSha256(request.commandInput) ===
      computeGateCommandInputSha256(expected)
      ? []
      : ["gate.command-input-canonical"])
  ]
}

export const makeTrialGateCommandExecutor = (
  options: MakeTrialGateCommandExecutorOptions
): GateCommandExecutor => {
  const trialProcess = options.trialProcess ?? makeTrialProcess({
    inheritedEnvironment: { PATH: options.inheritedPath }
  })

  const execute = Effect.fn("TrialGateCommandExecutor.execute")(function* (
    request: GateCommandExecutionRequest
  ) {
    const { gate } = request
    const shapeIssues = commandShapeIssues(gate)
    const manifestPathIssues = shapeIssues.length === 0 && (gate.command[7] === undefined ||
      resolve(options.repositoryRoot, gate.command[7], "package.json") !==
        options.runnerPackageManifestPath)
      ? ["gate.command-package-manifest-path"]
      : []
    const sourcePathIssues = shapeIssues.length === 0 && (gate.command[7] === undefined ||
      resolve(options.repositoryRoot, gate.command[7], "src") !== options.runnerSourceRoot)
      ? ["gate.command-runner-source-path"]
      : []
    const configPathIssues = shapeIssues.length === 0 && (gate.command[7] === undefined ||
      resolve(options.repositoryRoot, gate.command[7], "tsconfig.json") !==
        options.runnerTypeScriptConfigPath)
      ? ["gate.command-typescript-config-path"]
      : []
    const inputIssues = commandInputIssues(request)
    if (shapeIssues.length > 0 || manifestPathIssues.length > 0 ||
      sourcePathIssues.length > 0 || configPathIssues.length > 0 ||
      inputIssues.length > 0 || request.inspectionRoot === null) {
      return {
        processAttempt: new NotStartedProcessAttempt({
          executable: options.bunExecutablePath
        }),
        failureIds: [
          ...shapeIssues,
          ...manifestPathIssues,
          ...sourcePathIssues,
          ...configPathIssues,
          ...inputIssues,
          ...(request.inspectionRoot === null ? ["gate.command-inspection-snapshot"] : [])
        ].map((id) => ArtifactId.make(id))
      }
    }
    const inspectionRoot = request.inspectionRoot
    const rootBefore = yield* Effect.result(Effect.tryPromise({
      try: async () => {
        if (!isAbsolute(inspectionRoot) || resolve(inspectionRoot) !== inspectionRoot ||
          await realpath(inspectionRoot) !== inspectionRoot) {
          throw new Error("inspection root must be one canonical resolved absolute path")
        }
        const stat = await lstat(inspectionRoot)
        if (!stat.isDirectory() || stat.isSymbolicLink()) {
          throw new Error("inspection root must be a no-follow directory")
        }
        return stat
      },
      catch: () => ArtifactId.make("gate.command-inspection-preverification")
    }))
    if (Result.isFailure(rootBefore)) {
      return {
        processAttempt: new NotStartedProcessAttempt({ executable: options.bunExecutablePath }),
        failureIds: [rootBefore.failure]
      }
    }
    const before = yield* Effect.result(Effect.tryPromise({
      try: () => verifyBunExecutable(
        options.bunExecutablePath,
        options.expectedBunExecutableSha256
      ),
      catch: () => ArtifactId.make("gate.command-bun-preverification")
    }))
    if (Result.isFailure(before)) {
      return {
        processAttempt: new NotStartedProcessAttempt({
          executable: options.bunExecutablePath
        }),
        failureIds: [before.failure]
      }
    }
    const manifestBefore = yield* Effect.result(Effect.tryPromise({
      try: () => verifyRetainedRegularFile(
        options.runnerPackageManifestPath,
        options.expectedRunnerPackageManifestSha256,
        "runner package manifest"
      ),
      catch: () => ArtifactId.make("gate.command-package-manifest-preverification")
    }))
    if (Result.isFailure(manifestBefore)) {
      return {
        processAttempt: new NotStartedProcessAttempt({ executable: options.bunExecutablePath }),
        failureIds: [manifestBefore.failure]
      }
    }
    const configBefore = yield* Effect.result(Effect.tryPromise({
      try: () => verifyRetainedRegularFile(
        options.runnerTypeScriptConfigPath,
        options.expectedRunnerTypeScriptConfigSha256,
        "runner TypeScript config"
      ),
      catch: () => ArtifactId.make("gate.command-typescript-config-preverification")
    }))
    if (Result.isFailure(configBefore)) {
      return {
        processAttempt: new NotStartedProcessAttempt({ executable: options.bunExecutablePath }),
        failureIds: [configBefore.failure]
      }
    }
    const sourceBefore = yield* Effect.result(verifyRunnerSource(
      options.runnerSourceRoot,
      options.expectedRunnerSourceTreeSha256,
      "gate.command-runner-source-preverification"
    ))
    if (Result.isFailure(sourceBefore)) {
      return {
        processAttempt: new NotStartedProcessAttempt({ executable: options.bunExecutablePath }),
        failureIds: [sourceBefore.failure]
      }
    }
    const process = yield* Effect.result(trialProcess.run({
      argv: [options.bunExecutablePath, ...gate.command.slice(1)],
      cwd: options.repositoryRoot,
      stdin: canonicalJsonBytes({
        commandInput: encodeGateCommandInput(request.commandInput),
        executionLocal: { inspectionRoot }
      }),
      timeoutMilliseconds: TRIAL_GATE_COMMAND_TIMEOUT_MILLISECONDS,
      closedEnvironment: { PATH: options.inheritedPath }
    }))
    const processAttempt = Result.isSuccess(process)
      ? attemptFromResult(process.success)
      : attemptFromError(process.failure, options.bunExecutablePath)
    const afterBun = yield* Effect.result(Effect.tryPromise({
      try: () => verifyBunExecutable(
        options.bunExecutablePath,
        options.expectedBunExecutableSha256
      ),
      catch: () => ArtifactId.make("gate.command-bun-postverification")
    }))
    const afterInspection = yield* Effect.result(Effect.tryPromise({
      try: async () => {
        const rootAfter = await lstat(inspectionRoot)
        if (!rootAfter.isDirectory() || rootAfter.isSymbolicLink() ||
          !sameRetainedNode(rootBefore.success, rootAfter) ||
          await realpath(inspectionRoot) !== inspectionRoot) {
          throw new Error("inspection root identity changed during gate command")
        }
      },
      catch: () => ArtifactId.make("gate.command-inspection-postverification")
    }))
    const manifestAfter = yield* Effect.result(Effect.tryPromise({
      try: () => verifyRetainedRegularFile(
        options.runnerPackageManifestPath,
        options.expectedRunnerPackageManifestSha256,
        "runner package manifest"
      ),
      catch: () => ArtifactId.make("gate.command-package-manifest-postverification")
    }))
    const configAfter = yield* Effect.result(Effect.tryPromise({
      try: () => verifyRetainedRegularFile(
        options.runnerTypeScriptConfigPath,
        options.expectedRunnerTypeScriptConfigSha256,
        "runner TypeScript config"
      ),
      catch: () => ArtifactId.make("gate.command-typescript-config-postverification")
    }))
    const sourceAfter = yield* Effect.result(verifyRunnerSource(
      options.runnerSourceRoot,
      options.expectedRunnerSourceTreeSha256,
      "gate.command-runner-source-postverification"
    ))
    return {
      processAttempt,
      failureIds: [
        ...(Result.isFailure(process) ? [ArtifactId.make("gate.command-process-failure")] : []),
        ...(Result.isFailure(afterBun) ? [afterBun.failure] : []),
        ...(Result.isFailure(afterInspection) ? [afterInspection.failure] : []),
        ...(Result.isFailure(manifestAfter) ? [manifestAfter.failure] : []),
        ...(Result.isFailure(configAfter) ? [configAfter.failure] : []),
        ...(Result.isFailure(sourceAfter) ? [sourceAfter.failure] : [])
      ]
    }
  })
  return { execute }
}
