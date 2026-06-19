import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import type * as Crypto from "effect/Crypto"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { EvidenceBundle, ReleaseWorkflowEvidence } from "@mannyc1/ts-release/domain/evidence"
import { ReleasePlan } from "@mannyc1/ts-release/domain/release"
import {
  OperationFailedError
} from "@mannyc1/ts-release/planner/errors"
import type { ReleaseCommandRunner } from "@mannyc1/ts-release/host"
import type { ReleaseHttp } from "@mannyc1/ts-release/host/http"
import type { TargetRegistry } from "@mannyc1/ts-release/targets/registry"
import {
  ReleaseConfigOptions,
  ReleaseExecutionOptions,
  ReleaseReconcileConfigOptions,
  ReleaseResumeConfigOptions,
  ReleaseStatusOptions,
  ValidateReleaseConfigFileOptions,
  PlanReleaseConfigOptions,
  planReleaseConfig,
  reconcileReleaseConfig,
  renderReleaseConfigPlan,
  renderReleaseConfigValidation,
  renderReleaseStatus,
  resumeReleaseConfig,
  runReleaseConfig,
  statusReleaseConfig,
  validateReleaseConfig
} from "@mannyc1/ts-release/workflows/config"
import {
  checkAuthReleaseConfig,
  checkCiReleaseConfig,
  doctorReleaseConfig,
  ReleaseDiagnosticReport,
  ReleaseDiagnosticsOptions,
  renderReleaseDiagnostics
} from "@mannyc1/ts-release/workflows/diagnostics"
import {
  writeFailedOperationEvidence,
  writeNamedEvidence,
  writeWorkflowEvidence
} from "@mannyc1/ts-release/workflows/evidence"
import { ActionOptions } from "./input.js"

export interface ActionIo {
  readonly setOutput: (name: string, value: string) => Effect.Effect<void, unknown>
  readonly setFailed: (message: string) => Effect.Effect<void, unknown>
  readonly appendSummary: (markdown: string) => Effect.Effect<void, unknown>
  readonly writeFile: (path: string, contents: string) => Effect.Effect<void, unknown>
  readonly info: (message: string) => Effect.Effect<void, unknown>
}

export interface ActionArtifactClient {
  readonly uploadArtifact: (
    name: string,
    files: ReadonlyArray<string>,
    rootDirectory: string
  ) => Effect.Effect<void, ActionArtifactUploadError>
}

export class ActionCommandError extends Schema.TaggedErrorClass<ActionCommandError>()("ActionCommandError", {
  command: Schema.String,
  reason: Schema.String
}) {}

export class ActionArtifactUploadError extends Schema.TaggedErrorClass<ActionArtifactUploadError>()(
  "ActionArtifactUploadError",
  {
    reason: Schema.String
  }
) {}

export const NoopActionArtifactClient: ActionArtifactClient = {
  uploadArtifact: () => Effect.void
}

export type ActionRuntimeServices =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | ReleaseCommandRunner
  | ReleaseHttp
  | TargetRegistry

type PlanObserver = (plan: ReleasePlan) => void

const NoopPlanObserver: PlanObserver = () => {}

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const formatTaggedError = (cause: unknown): string | undefined => {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "_tag" in cause &&
    typeof cause._tag === "string"
  ) {
    const reason = "reason" in cause && typeof cause.reason === "string"
      ? `: ${cause.reason}`
      : ""
    return `${cause._tag}${reason}`
  }
  return undefined
}

export const formatActionError = (cause: unknown): string =>
  formatTaggedError(Cause.isCause(cause) ? Cause.squash(cause) : cause) ??
    formatUnknown(Cause.isCause(cause) ? Cause.squash(cause) : cause)

const workspacePath = (path: Path.Path, root: string, pathName: string): string =>
  path.isAbsolute(pathName) ? pathName : path.resolve(root, pathName)

const hasParentTraversal = (pathName: string): boolean =>
  pathName.split(/[\\/]+/).includes("..")

const isInsideWorkspace = (path: Path.Path, root: string, targetPath: string): boolean => {
  const relative = path.relative(path.resolve(root), targetPath)
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

const workspaceOutputPath = (
  path: Path.Path,
  options: ActionOptions,
  pathName: string
): Effect.Effect<string, ActionCommandError> => {
  if (pathName.trim().length === 0 || hasParentTraversal(pathName)) {
    return Effect.fail(
      ActionCommandError.make({
        command: options.command,
        reason: "plan-path must be non-empty and must not contain parent traversal."
      })
    )
  }
  const rootPath = path.resolve(options.root)
  const targetPath = path.isAbsolute(pathName)
    ? path.resolve(pathName)
    : path.resolve(rootPath, pathName)
  if (isInsideWorkspace(path, rootPath, targetPath)) {
    return Effect.succeed(targetPath)
  }
  return Effect.fail(
    ActionCommandError.make({
      command: options.command,
      reason: "plan-path must resolve inside the action root."
    })
  )
}

const planOptions = (options: ActionOptions): PlanReleaseConfigOptions =>
  PlanReleaseConfigOptions.make({
    root: options.root,
    configPath: options.config,
    format: options.format
  })

const releaseOptions = (options: ActionOptions): ReleaseConfigOptions =>
  ReleaseConfigOptions.make({
    root: options.root,
    configPath: options.config
  })

const validationOptions = (options: ActionOptions): ValidateReleaseConfigFileOptions =>
  ValidateReleaseConfigFileOptions.make({
    root: options.root,
    configPath: options.config,
    format: options.format === "json" ? "json" : "text"
  })

const statusOptions = (options: ActionOptions): ReleaseStatusOptions =>
  ReleaseStatusOptions.make({
    root: options.root,
    configPath: options.config,
    format: options.format === "json" ? "json" : "text"
  })

const executionOptions = (options: ActionOptions): ReleaseExecutionOptions =>
  ReleaseExecutionOptions.make({
    root: options.root,
    configPath: options.config,
    execute: options.execute,
    approveIrreversible: options.approveIrreversible
  })

const resumeOptions = (options: ActionOptions): ReleaseResumeConfigOptions =>
  ReleaseResumeConfigOptions.make({
    root: options.root,
    configPath: options.config,
    execute: options.execute,
    approveIrreversible: options.approveIrreversible
  })

const reconcileOptions = (options: ActionOptions): ReleaseReconcileConfigOptions =>
  ReleaseReconcileConfigOptions.make({
    root: options.root,
    configPath: options.config,
    execute: options.execute
  })

const diagnosticsFormat = (options: ActionOptions): "json" | "text" | "markdown" =>
  options.format === "json" || options.format === "markdown" ? options.format : "text"

const diagnosticsOptions = (options: ActionOptions): ReleaseDiagnosticsOptions =>
  ReleaseDiagnosticsOptions.make({
    root: options.root,
    configPath: options.config,
    format: diagnosticsFormat(options),
    ...(options.target === undefined ? {} : { target: options.target }),
    ...(options.workflow === undefined ? {} : { workflow: options.workflow })
  })

const outputPlan = Effect.fn("action.outputPlan")(function*(io: ActionIo, plan: ReleasePlan, planPath: string) {
  yield* io.setOutput("release_name", plan.identity.name)
  yield* io.setOutput("release_version", plan.identity.version)
  yield* io.setOutput("operation_count", String(plan.operations.length))
  yield* io.setOutput(
    "irreversible_operation_count",
    String(plan.operations.filter((operation) => operation.risk === "irreversible").length)
  )
  yield* io.setOutput("target_count", String(plan.targets.length))
  yield* io.setOutput("evidence_directory", plan.evidenceDirectory)
  yield* io.setOutput("plan_path", planPath)
})

const outputEvidenceDirectory = Effect.fn("action.outputEvidenceDirectory")(function*(
  io: ActionIo,
  plan: ReleasePlan
) {
  yield* io.setOutput("release_name", plan.identity.name)
  yield* io.setOutput("release_version", plan.identity.version)
  yield* io.setOutput("evidence_directory", plan.evidenceDirectory)
})

const hasDiagnosticFailure = (report: ReleaseDiagnosticReport): boolean =>
  report.checks.some((check) => check.status === "fail")

const hasDiagnosticWarning = (report: ReleaseDiagnosticReport): boolean =>
  report.checks.some((check) => check.status === "warn")

const isOperationFailedError = (error: unknown): error is OperationFailedError =>
  error instanceof OperationFailedError ||
  (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "OperationFailedError"
  )

const failForDiagnostics = (
  command: string,
  report: ReleaseDiagnosticReport,
  failOnWarnings: boolean
): Effect.Effect<void, ActionCommandError> => {
  if (hasDiagnosticFailure(report)) {
    return Effect.fail(ActionCommandError.make({
      command,
      reason: "Diagnostics reported failing checks."
    }))
  }
  if (failOnWarnings && hasDiagnosticWarning(report)) {
    return Effect.fail(ActionCommandError.make({
      command,
      reason: "Diagnostics reported warnings and fail-on-warnings is true."
    }))
  }
  return Effect.void
}

const writeNamedEvidenceWithFailure = <E, R>(
  plan: ReleasePlan,
  name: string,
  effect: Effect.Effect<EvidenceBundle, E, R>
) =>
  effect.pipe(
    Effect.matchEffect({
      onFailure: (error): Effect.Effect<never, unknown, FileSystem.FileSystem | Path.Path> =>
        isOperationFailedError(error)
          ? writeFailedOperationEvidence(plan, name, error).pipe(
            Effect.flatMap(() => Effect.fail(error))
          )
          : Effect.fail(error),
      onSuccess: (evidence) => writeNamedEvidence(plan, name, evidence)
    })
  )

const writeWorkflowEvidenceWithFailure = <E, R>(
  plan: ReleasePlan,
  effect: Effect.Effect<ReleaseWorkflowEvidence, E, R>
) =>
  effect.pipe(
    Effect.matchEffect({
      onFailure: (error): Effect.Effect<never, unknown, FileSystem.FileSystem | Path.Path> => {
        if (!isOperationFailedError(error) || error.workflowEvidence === undefined) {
          return Effect.fail(error)
        }
        return writeWorkflowEvidence(plan, error.workflowEvidence).pipe(
          Effect.flatMap(() => Effect.fail(error))
        )
      },
      onSuccess: (evidence) => writeWorkflowEvidence(plan, evidence)
    })
  )

const collectEvidenceFiles = Effect.fn("action.collectEvidenceFiles")(function*(
  root: string,
  evidenceDirectory: string
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const absoluteDirectory = workspacePath(path, root, evidenceDirectory)
  const exists = yield* fs.exists(absoluteDirectory)
  if (!exists) {
    return {
      directory: absoluteDirectory,
      files: []
    }
  }
  const entries = yield* fs.readDirectory(absoluteDirectory, { recursive: true })
  return {
    directory: absoluteDirectory,
    files: entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => path.resolve(absoluteDirectory, entry))
      .sort()
  }
})

const uploadEvidence = Effect.fn("action.uploadEvidence")(function*(
  options: ActionOptions,
  io: ActionIo,
  artifactClient: ActionArtifactClient,
  plan: ReleasePlan | undefined
) {
  if (!options.uploadEvidence) {
    return
  }
  if (plan === undefined) {
    yield* io.info("No release plan was available; evidence upload skipped.")
    return
  }
  const evidence = yield* collectEvidenceFiles(plan.source.root, plan.evidenceDirectory)
  if (evidence.files.length === 0) {
    yield* io.info(`No evidence files found in ${plan.evidenceDirectory}; evidence upload skipped.`)
    return
  }
  yield* artifactClient.uploadArtifact(options.evidenceArtifactName, evidence.files, evidence.directory)
})

const ignoreUploadFailure = <R>(
  upload: Effect.Effect<void, unknown, R>,
  io: ActionIo
) =>
  upload.pipe(
    Effect.matchEffect({
      onFailure: (uploadError) => io.info(`Evidence upload failed: ${formatUnknown(uploadError)}`),
      onSuccess: () => Effect.void
    })
  )

const withEvidenceUpload = <A, E, R>(
  options: ActionOptions,
  io: ActionIo,
  artifactClient: ActionArtifactClient,
  planRef: () => ReleasePlan | undefined,
  effect: Effect.Effect<A, E, R>
) =>
  effect.pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        ignoreUploadFailure(uploadEvidence(options, io, artifactClient, planRef()), io).pipe(
          Effect.flatMap(() => Effect.fail(error))
        ),
      onSuccess: (result) =>
        uploadEvidence(options, io, artifactClient, planRef()).pipe(
          Effect.map(() => result)
        )
    })
  )

const ensureRuntime = (options: ActionOptions): Effect.Effect<void, ActionCommandError> => {
  if (options.runtime === "bundled") {
    return Effect.void
  }
  return Effect.fail(ActionCommandError.make({
    command: options.command,
    reason:
      "runtime: workspace is deferred because a safe same-module-graph Node runtime requires the workspace to provide @mannyc1/ts-release, effect, and the aligned @effect/platform-node package. Use runtime: bundled."
  }))
}

const runPlan = Effect.fn("action.runPlan")(function*(options: ActionOptions, io: ActionIo) {
  const path = yield* Path.Path
  const plan = yield* planReleaseConfig(planOptions(options))
  const rendered = yield* renderReleaseConfigPlan(planOptions(options))
  const outputPath = yield* workspaceOutputPath(path, options, options.planPath)
  yield* io.writeFile(outputPath, rendered)
  if (options.writeStepSummary) {
    const markdown = options.format === "markdown"
      ? rendered
      : yield* renderReleaseConfigPlan(PlanReleaseConfigOptions.make({
        root: options.root,
        configPath: options.config,
        format: "markdown"
      }))
    yield* io.appendSummary(markdown)
  }
  yield* outputPlan(io, plan, options.planPath)
  yield* io.setOutput("status", "passed")
  return plan
})

const runValidateConfig = Effect.fn("action.runValidateConfig")(function*(options: ActionOptions, io: ActionIo) {
  const rendered = yield* renderReleaseConfigValidation(validationOptions(options))
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release validate-config\n\n\`\`\`text\n${rendered.trimEnd()}\n\`\`\`\n`)
  }
  yield* io.setOutput("status", "passed")
})

const runStatus = Effect.fn("action.runStatus")(function*(options: ActionOptions, io: ActionIo) {
  const report = yield* statusReleaseConfig(statusOptions(options))
  const rendered = yield* renderReleaseStatus(statusOptions(options))
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release status\n\n\`\`\`text\n${rendered.trimEnd()}\n\`\`\`\n`)
  }
  yield* io.setOutput("release_name", report.releaseName)
  yield* io.setOutput("release_version", report.releaseVersion)
  yield* io.setOutput("evidence_directory", report.evidenceDirectory)
  yield* io.setOutput("status", report.overallStatus)
})

const runDiagnostics = Effect.fn("action.runDiagnostics")(function*(
  command: "doctor" | "check-auth" | "check-ci",
  options: ActionOptions,
  io: ActionIo
) {
  const report = command === "doctor"
    ? yield* doctorReleaseConfig(diagnosticsOptions(options))
    : command === "check-auth"
    ? yield* checkAuthReleaseConfig(diagnosticsOptions(options))
    : yield* checkCiReleaseConfig(diagnosticsOptions(options))
  const rendered = renderReleaseDiagnostics(report, diagnosticsFormat(options))
  if (options.writeStepSummary) {
    yield* io.appendSummary(rendered)
  }
  yield* io.setOutput("release_name", report.releaseName)
  yield* io.setOutput("release_version", report.releaseVersion)
  yield* failForDiagnostics(command, report, options.failOnWarnings)
  yield* io.setOutput("status", "passed")
})

const runValidate = Effect.fn("action.runValidate")(function*(
  options: ActionOptions,
  io: ActionIo,
  observePlan: PlanObserver = NoopPlanObserver
) {
  const plan = yield* planReleaseConfig(planOptions(options))
  observePlan(plan)
  yield* outputEvidenceDirectory(io, plan)
  yield* writeNamedEvidenceWithFailure(plan, "validation", validateReleaseConfig(releaseOptions(options)))
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release validate\n\nstatus: passed\n\nevidence: ${plan.evidenceDirectory}/validation.json\n`)
  }
  yield* io.setOutput("status", "passed")
  return plan
})

const runWorkflow = Effect.fn("action.runWorkflow")(function*(
  command: "run" | "resume",
  options: ActionOptions,
  io: ActionIo,
  observePlan: PlanObserver = NoopPlanObserver
) {
  const plan = yield* planReleaseConfig(planOptions(options))
  observePlan(plan)
  yield* outputEvidenceDirectory(io, plan)
  yield* writeWorkflowEvidenceWithFailure(
    plan,
    command === "run"
      ? runReleaseConfig(executionOptions(options))
      : resumeReleaseConfig(resumeOptions(options))
  )
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release ${command}\n\nstatus: passed\n\nevidence: ${plan.evidenceDirectory}\n`)
  }
  yield* io.setOutput("status", "passed")
  return plan
})

const runReconcile = Effect.fn("action.runReconcile")(function*(
  options: ActionOptions,
  io: ActionIo,
  observePlan: PlanObserver = NoopPlanObserver
) {
  const plan = yield* planReleaseConfig(planOptions(options))
  observePlan(plan)
  yield* outputEvidenceDirectory(io, plan)
  yield* writeNamedEvidenceWithFailure(plan, "reconciliation", reconcileReleaseConfig(reconcileOptions(options)))
  if (options.writeStepSummary) {
    yield* io.appendSummary(
      `## ts-release reconcile\n\nstatus: passed\n\nevidence: ${plan.evidenceDirectory}/reconciliation.json\n`
    )
  }
  yield* io.setOutput("status", "passed")
  return plan
})

export const runActionEffect = Effect.fn("action.runActionEffect")(function*(
  options: ActionOptions,
  io: ActionIo,
  artifactClient: ActionArtifactClient = NoopActionArtifactClient
) {
  yield* ensureRuntime(options)
  let planForUpload: ReleasePlan | undefined
  const rememberPlan = (plan: ReleasePlan): ReleasePlan => {
    planForUpload = plan
    return plan
  }
  yield* withEvidenceUpload(options, io, artifactClient, () => planForUpload, Effect.gen(function*() {
    switch (options.command) {
      case "plan":
        rememberPlan(yield* runPlan(options, io))
        return
      case "validate-config":
        yield* runValidateConfig(options, io)
        return
      case "status":
        yield* runStatus(options, io)
        return
      case "doctor":
      case "check-auth":
      case "check-ci":
        yield* runDiagnostics(options.command, options, io)
        return
      case "validate":
        yield* runValidate(options, io, rememberPlan)
        return
      case "run":
      case "resume":
        yield* runWorkflow(options.command, options, io, rememberPlan)
        return
      case "reconcile":
        yield* runReconcile(options, io, rememberPlan)
        return
    }
  }))
})

export const runAction = async <R>(
  options: ActionOptions,
  io: ActionIo,
  layer: Layer.Layer<ActionRuntimeServices>,
  artifactClient: ActionArtifactClient = NoopActionArtifactClient
): Promise<void> => {
  const exit = await Effect.runPromiseExit(
    runActionEffect(options, io, artifactClient).pipe(Effect.provide(layer))
  )
  if (exit._tag === "Failure") {
    const message = formatActionError(exit.cause)
    await Effect.runPromise(io.setOutput("status", "failed"))
    await Effect.runPromise(io.setFailed(message))
  }
}
