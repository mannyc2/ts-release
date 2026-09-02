import { constants, type Stats } from "node:fs"
import { lstat, open, realpath, type FileHandle } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { Effect, Result } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import { decodeGateObservationForInvocation } from "./schema/harness-protocol.js"
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
import {
  TRIAL_GATE_SANDBOX_CANDIDATE_ROOT,
  TRIAL_GATE_SANDBOX_HOME,
  TRIAL_GATE_SANDBOX_REPOSITORY_ROOT
} from "./trial-gate-contract.js"
import { inventoryCanonicalTree } from "./trial-inventory.js"
import { inventoryRuntimeDependencyTree } from "./trial-runtime-dependency-tree.js"
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
  readonly bubblewrapExecutablePath: string
  readonly expectedBubblewrapExecutableSha256: Sha256Hex
  readonly runnerNodeModulesRoot: string
  readonly expectedRunnerNodeModulesSha256: Sha256Hex
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

const verifyRetainedExecutable = async (
  path: string,
  expectedSha256: Sha256Hex,
  label: string
): Promise<void> => {
  if (!isAbsolute(path) || resolve(path) !== path || await realpath(path) !== path) {
    throw new Error(`retained ${label} path must be one canonical resolved absolute path`)
  }
  const before = await lstat(path)
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o111) === 0) {
    throw new Error(`retained ${label} path must identify an executable regular file`)
  }
  if (typeof constants.O_NOFOLLOW !== "number") throw new Error("O_NOFOLLOW is unavailable")
  let handle: FileHandle | undefined
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const opened = await handle.stat()
    if (!opened.isFile() || !sameRetainedNode(before, opened)) {
      throw new Error(`opened ${label} inode differs from its retained path snapshot`)
    }
    const bytes = new Uint8Array(await handle.readFile())
    const afterRead = await handle.stat()
    const afterPath = await lstat(path)
    if (!afterRead.isFile() || !sameRetainedNode(opened, afterRead) ||
      !sameRetainedNode(afterRead, afterPath) || bytes.byteLength !== afterRead.size) {
      throw new Error(`retained ${label} executable changed while its bytes were verified`)
    }
    if (sha256Bytes(bytes) !== expectedSha256) {
      throw new Error(`retained ${label} executable does not equal the run-context digest`)
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
  "--silent",
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

const fixedOuterEnvironment = {
  PATH: "/usr/bin:/bin",
  LC_ALL: "C",
  LANG: "C",
  TZ: "UTC",
  NO_COLOR: "1"
} as const

const fixedGateEnvironment = {
  PATH: "/runtime:/usr/bin",
  HOME: TRIAL_GATE_SANDBOX_HOME,
  LC_ALL: "C",
  LANG: "C",
  TZ: "UTC",
  NO_COLOR: "1",
  TMPDIR: "/tmp"
} as const

export interface TrialGateIsolationPaths {
  readonly bubblewrapExecutablePath: string
  readonly bunExecutablePath: string
  readonly repositoryRoot: string
  readonly inspectionRoot: string
  readonly runnerNodeModulesRoot: string
}

/** The gate command can observe trusted inputs but has no writable repository or candidate mount. */
export const buildTrialGateIsolationArgv = (
  paths: TrialGateIsolationPaths,
  gate: ArchitectureTrialSpecV2["gateRequirements"][number]
): readonly [string, ...Array<string>] => [
  paths.bubblewrapExecutablePath,
  "--unshare-all",
  // bubblewrap 0.9 requires the explicit flag before --disable-userns even
  // though --unshare-all includes the user namespace semantically.
  "--unshare-user",
  "--disable-userns",
  "--assert-userns-disabled",
  "--new-session",
  "--die-with-parent",
  "--cap-drop",
  "ALL",
  "--hostname",
  "architecture-gate",
  "--clearenv",
  "--setenv", "PATH", fixedGateEnvironment.PATH,
  "--setenv", "HOME", fixedGateEnvironment.HOME,
  "--setenv", "LC_ALL", fixedGateEnvironment.LC_ALL,
  "--setenv", "LANG", fixedGateEnvironment.LANG,
  "--setenv", "TZ", fixedGateEnvironment.TZ,
  "--setenv", "NO_COLOR", fixedGateEnvironment.NO_COLOR,
  "--setenv", "TMPDIR", fixedGateEnvironment.TMPDIR,
  "--ro-bind", "/usr", "/usr",
  "--symlink", "usr/bin", "/bin",
  "--symlink", "usr/lib", "/lib",
  "--symlink", "usr/lib64", "/lib64",
  "--dev", "/dev",
  "--proc", "/proc",
  "--tmpfs", "/tmp",
  "--tmpfs", "/home",
  "--dir", TRIAL_GATE_SANDBOX_HOME,
  "--dir", "/runtime",
  "--ro-bind", paths.repositoryRoot, TRIAL_GATE_SANDBOX_REPOSITORY_ROOT,
  "--ro-bind", paths.inspectionRoot, TRIAL_GATE_SANDBOX_CANDIDATE_ROOT,
  "--ro-bind",
  paths.runnerNodeModulesRoot,
  `${TRIAL_GATE_SANDBOX_REPOSITORY_ROOT}/tools/architecture-program/node_modules`,
  "--ro-bind", paths.bunExecutablePath, "/runtime/bun",
  // Seal bubblewrap's otherwise-writable synthetic root after constructing
  // every mount. The non-recursive remount preserves only /tmp and /home as
  // writable scratch while repository, candidate, dependencies, and Bun stay
  // on their explicit read-only mounts.
  "--remount-ro", "/",
  "--chdir", TRIAL_GATE_SANDBOX_REPOSITORY_ROOT,
  "--",
  "/runtime/bun",
  ...gate.command.slice(1)
]

export const makeTrialGateCommandExecutor = (
  options: MakeTrialGateCommandExecutorOptions
): GateCommandExecutor => {
  const trialProcess = options.trialProcess ?? makeTrialProcess({
    inheritedEnvironment: fixedOuterEnvironment
  })

  const execute = Effect.fn("TrialGateCommandExecutor.execute")(function* (
    request: GateCommandExecutionRequest
  ) {
    const { gate } = request
    const shapeIssues = commandShapeIssues(gate)
    const cwdFlagIndex = gate.command.findIndex((argument) => argument === "--cwd")
    const declaredWorkingDirectory = gate.command[cwdFlagIndex + 1]
    const manifestPathIssues = shapeIssues.length === 0 && (declaredWorkingDirectory === undefined ||
      resolve(options.repositoryRoot, declaredWorkingDirectory, "package.json") !==
        options.runnerPackageManifestPath)
      ? ["gate.command-package-manifest-path"]
      : []
    const sourcePathIssues = shapeIssues.length === 0 && (declaredWorkingDirectory === undefined ||
      resolve(options.repositoryRoot, declaredWorkingDirectory, "src") !== options.runnerSourceRoot)
      ? ["gate.command-runner-source-path"]
      : []
    const configPathIssues = shapeIssues.length === 0 && (declaredWorkingDirectory === undefined ||
      resolve(options.repositoryRoot, declaredWorkingDirectory, "tsconfig.json") !==
        options.runnerTypeScriptConfigPath)
      ? ["gate.command-typescript-config-path"]
      : []
    const inputIssues = commandInputIssues(request)
    const declarationIssues = gate.hard && gate.expectedExit === 0 && !gate.credentials &&
      !gate.networkAccess && !gate.mutatesExternalState && gate.onFailure === "RejectCandidate"
      ? []
      : ["gate.command-declaration-policy"]
    if (shapeIssues.length > 0 || manifestPathIssues.length > 0 ||
      sourcePathIssues.length > 0 || configPathIssues.length > 0 ||
      inputIssues.length > 0 || declarationIssues.length > 0 || request.inspectionRoot === null) {
      return {
        processAttempt: new NotStartedProcessAttempt({
          executable: options.bubblewrapExecutablePath
        }),
        failureIds: [
          ...shapeIssues,
          ...manifestPathIssues,
          ...sourcePathIssues,
          ...configPathIssues,
          ...inputIssues,
          ...declarationIssues,
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
        processAttempt: new NotStartedProcessAttempt({ executable: options.bubblewrapExecutablePath }),
        failureIds: [rootBefore.failure]
      }
    }
    const inspectionBefore = yield* Effect.result(inventoryCanonicalTree(inspectionRoot).pipe(
      Effect.mapError(() => ArtifactId.make("gate.command-inspection-preverification"))
    ))
    if (Result.isFailure(inspectionBefore) ||
      inspectionBefore.success.treeSha256 !== request.commandInput.inspectedTreeSha256) {
      return {
        processAttempt: new NotStartedProcessAttempt({ executable: options.bubblewrapExecutablePath }),
        failureIds: [Result.isFailure(inspectionBefore)
          ? inspectionBefore.failure
          : ArtifactId.make("gate.command-inspection-tree-preverification")]
      }
    }
    const before = yield* Effect.result(Effect.tryPromise({
      try: () => verifyRetainedExecutable(
        options.bunExecutablePath,
        options.expectedBunExecutableSha256,
        "Bun"
      ),
      catch: () => ArtifactId.make("gate.command-bun-preverification")
    }))
    if (Result.isFailure(before)) {
      return {
        processAttempt: new NotStartedProcessAttempt({
          executable: options.bubblewrapExecutablePath
        }),
        failureIds: [before.failure]
      }
    }
    const bubblewrapBefore = yield* Effect.result(Effect.tryPromise({
      try: () => verifyRetainedExecutable(
        options.bubblewrapExecutablePath,
        options.expectedBubblewrapExecutableSha256,
        "bubblewrap"
      ),
      catch: () => ArtifactId.make("gate.command-bubblewrap-preverification")
    }))
    if (Result.isFailure(bubblewrapBefore)) {
      return {
        processAttempt: new NotStartedProcessAttempt({ executable: options.bubblewrapExecutablePath }),
        failureIds: [bubblewrapBefore.failure]
      }
    }
    const dependenciesBefore = yield* Effect.result(inventoryRuntimeDependencyTree(
      options.runnerNodeModulesRoot
    ).pipe(Effect.mapError(() =>
      ArtifactId.make("gate.command-runtime-dependencies-preverification"))))
    if (Result.isFailure(dependenciesBefore) ||
      dependenciesBefore.success.inventory.treeSha256 !==
        options.expectedRunnerNodeModulesSha256) {
      return {
        processAttempt: new NotStartedProcessAttempt({ executable: options.bubblewrapExecutablePath }),
        failureIds: [Result.isFailure(dependenciesBefore)
          ? dependenciesBefore.failure
          : ArtifactId.make("gate.command-runtime-dependencies-preverification")]
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
        processAttempt: new NotStartedProcessAttempt({ executable: options.bubblewrapExecutablePath }),
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
        processAttempt: new NotStartedProcessAttempt({ executable: options.bubblewrapExecutablePath }),
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
        processAttempt: new NotStartedProcessAttempt({ executable: options.bubblewrapExecutablePath }),
        failureIds: [sourceBefore.failure]
      }
    }
    const process = yield* Effect.result(trialProcess.run({
      argv: buildTrialGateIsolationArgv({
        bubblewrapExecutablePath: options.bubblewrapExecutablePath,
        bunExecutablePath: options.bunExecutablePath,
        repositoryRoot: options.repositoryRoot,
        inspectionRoot,
        runnerNodeModulesRoot: options.runnerNodeModulesRoot
      }, gate),
      cwd: options.repositoryRoot,
      stdin: canonicalJsonBytes({
        commandInput: encodeGateCommandInput(request.commandInput),
        executionLocal: { inspectionRoot: TRIAL_GATE_SANDBOX_CANDIDATE_ROOT }
      }),
      timeoutMilliseconds: TRIAL_GATE_COMMAND_TIMEOUT_MILLISECONDS,
      closedEnvironment: fixedOuterEnvironment
    }))
    const processAttempt = Result.isSuccess(process)
      ? attemptFromResult(process.success)
      : attemptFromError(process.failure, options.bubblewrapExecutablePath)
    const commandOutput = Result.isSuccess(process) &&
      process.success.exitCode === gate.expectedExit
      ? yield* Effect.result(Effect.gen(function* () {
          if (process.success.stderr.byteLength !== 0) {
            return yield* Effect.fail(ArtifactId.make("gate.command-stderr"))
          }
          const value = yield* Effect.try({
            try: () => parseCanonicalJsonBytes(process.success.stdout),
            catch: () => ArtifactId.make("gate.command-output")
          })
          return yield* decodeGateObservationForInvocation(
            request.commandInput.invocation,
            value
          ).pipe(Effect.mapError(() => ArtifactId.make("gate.command-output")))
        }))
      : null
    const afterBun = yield* Effect.result(Effect.tryPromise({
      try: () => verifyRetainedExecutable(
        options.bunExecutablePath,
        options.expectedBunExecutableSha256,
        "Bun"
      ),
      catch: () => ArtifactId.make("gate.command-bun-postverification")
    }))
    const afterBubblewrap = yield* Effect.result(Effect.tryPromise({
      try: () => verifyRetainedExecutable(
        options.bubblewrapExecutablePath,
        options.expectedBubblewrapExecutableSha256,
        "bubblewrap"
      ),
      catch: () => ArtifactId.make("gate.command-bubblewrap-postverification")
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
    const inspectionTreeAfter = yield* Effect.result(inventoryCanonicalTree(inspectionRoot).pipe(
      Effect.mapError(() => ArtifactId.make("gate.command-inspection-postverification"))
    ))
    const dependenciesAfter = yield* Effect.result(inventoryRuntimeDependencyTree(
      options.runnerNodeModulesRoot
    ).pipe(Effect.mapError(() =>
      ArtifactId.make("gate.command-runtime-dependencies-postverification"))))
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
        ...(commandOutput !== null && Result.isFailure(commandOutput)
          ? [commandOutput.failure]
          : []),
        ...(Result.isFailure(afterBun) ? [afterBun.failure] : []),
        ...(Result.isFailure(afterBubblewrap) ? [afterBubblewrap.failure] : []),
        ...(Result.isFailure(afterInspection) ? [afterInspection.failure] : []),
        ...(Result.isFailure(inspectionTreeAfter) ||
          inspectionTreeAfter.success.treeSha256 !== inspectionBefore.success.treeSha256
          ? [ArtifactId.make("gate.command-inspection-tree-postverification")]
          : []),
        ...(Result.isFailure(dependenciesAfter) ||
          dependenciesAfter.success.inventory.treeSha256 !==
            dependenciesBefore.success.inventory.treeSha256 ||
          JSON.stringify(dependenciesAfter.success.inventory.entries) !==
            JSON.stringify(dependenciesBefore.success.inventory.entries)
          ? [ArtifactId.make("gate.command-runtime-dependencies-postverification")]
          : []),
        ...(Result.isFailure(manifestAfter) ? [manifestAfter.failure] : []),
        ...(Result.isFailure(configAfter) ? [configAfter.failure] : []),
        ...(Result.isFailure(sourceAfter) ? [sourceAfter.failure] : [])
      ]
    }
  })
  return { execute }
}
