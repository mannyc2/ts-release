import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import type * as Crypto from "effect/Crypto"
import * as Inspectable from "effect/Inspectable"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { ReleasePlan } from "@mannyc1/ts-release/domain/release"
import type { ReleaseCommandRunner } from "@mannyc1/ts-release/host"
import type { ReleaseHttp } from "@mannyc1/ts-release/host/http"
import type { TargetRegistry } from "@mannyc1/ts-release/targets/registry"
import { Config, Diagnostics } from "@mannyc1/ts-release/workflows"
import { ActionOptions } from "./input.js"

type ReleaseDiagnosticReport = Diagnostics.ReleaseDiagnosticReport

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
    reason: Schema.String,
    cause: Schema.optionalKey(Schema.Defect())
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

const renderActionCause = (cause: unknown): string => {
  if (Cause.isCause(cause)) {
    return Cause.pretty(cause)
  }
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message
  }
  return Inspectable.toStringUnknown(cause)
}

const formatTaggedError = (cause: unknown): string | undefined => {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "_tag" in cause &&
    typeof cause._tag === "string"
  ) {
    const reason = "reason" in cause && typeof cause.reason === "string" ? cause.reason : undefined
    const causeMessage = "cause" in cause && cause.cause !== undefined ? renderActionCause(cause.cause) : undefined
    const causeSuffix = causeMessage !== undefined &&
        causeMessage.length > 0 &&
        causeMessage !== reason
      ? ` (cause: ${causeMessage})`
      : ""
    return `${cause._tag}${reason === undefined ? "" : `: ${reason}`}${causeSuffix}`
  }
  return undefined
}

export const formatActionError = (cause: unknown): string =>
  formatTaggedError(Cause.isCause(cause) ? Cause.squash(cause) : cause) ??
    renderActionCause(cause)

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

const workspaceConfigPath = (
  path: Path.Path,
  options: ActionOptions,
  pathName: string
): Effect.Effect<string, ActionCommandError> => {
  if (pathName.trim().length === 0 || hasParentTraversal(pathName)) {
    return Effect.fail(
      ActionCommandError.make({
        command: options.command,
        reason: "config must be non-empty and must not contain parent traversal."
      })
    )
  }
  const rootPath = path.resolve(options.root)
  const targetPath = path.isAbsolute(pathName)
    ? path.resolve(pathName)
    : path.resolve(rootPath, pathName)
  if (!isInsideWorkspace(path, rootPath, targetPath)) {
    return Effect.fail(
      ActionCommandError.make({
        command: options.command,
        reason: "config must resolve inside the action root."
      })
    )
  }
  return Effect.succeed(
    path.isAbsolute(pathName)
      ? path.relative(rootPath, targetPath)
      : pathName
  )
}

const actionOptionsWithConfig = (
  options: ActionOptions,
  config: string
): ActionOptions =>
  ActionOptions.make({
    root: options.root,
    command: options.command,
    config,
    format: options.format,
    writeStepSummary: options.writeStepSummary,
    planPath: options.planPath,
    failOnWarnings: options.failOnWarnings,
    ...(options.target === undefined ? {} : { target: options.target }),
    ...(options.workflow === undefined ? {} : { workflow: options.workflow }),
    runtime: options.runtime,
    execute: options.execute,
    approveIrreversible: options.approveIrreversible,
    uploadEvidence: options.uploadEvidence,
    evidenceArtifactName: options.evidenceArtifactName
  })

const planInput = (options: ActionOptions) => ({
  root: options.root,
  configPath: options.config,
  format: options.format
})

const releaseInput = (options: ActionOptions) => ({
  root: options.root,
  configPath: options.config
})

const textOutputFormat = (options: ActionOptions): "json" | "text" =>
  options.format === "json" ? "json" : "text"

const validationInput = (options: ActionOptions) => ({
  root: options.root,
  configPath: options.config,
  format: textOutputFormat(options)
})

const eligibilityInput = (options: ActionOptions) => ({
  root: options.root,
  configPath: options.config
})

const executionInput = (options: ActionOptions) => ({
  root: options.root,
  configPath: options.config,
  execute: options.execute,
  approveIrreversible: options.approveIrreversible
})

const reconcileInput = (options: ActionOptions) => ({
  root: options.root,
  configPath: options.config,
  execute: options.execute
})

const diagnosticsFormat = (options: ActionOptions): "json" | "text" | "markdown" =>
  options.format === "json" || options.format === "markdown" ? options.format : "text"

const diagnosticsInput = (options: ActionOptions) => ({
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
      onFailure: (uploadError) => io.info(`Evidence upload failed: ${formatActionError(uploadError)}`),
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
  const planned = yield* Config.renderPlannedPlan(planInput(options))
  const outputPath = yield* workspaceOutputPath(path, options, options.planPath)
  yield* io.writeFile(outputPath, planned.contents)
  if (options.writeStepSummary) {
    const markdown = options.format === "markdown"
      ? planned.contents
      : Config.renderReleasePlan(planned.plan, "markdown")
    yield* io.appendSummary(markdown)
  }
  yield* outputPlan(io, planned.plan, options.planPath)
  yield* io.setOutput("status", "passed")
  return planned.plan
})

const runValidateConfig = Effect.fn("action.runValidateConfig")(function*(options: ActionOptions, io: ActionIo) {
  const rendered = yield* Config.renderValidation(validationInput(options))
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release validate-config\n\n\`\`\`text\n${rendered.trimEnd()}\n\`\`\`\n`)
  }
  yield* io.setOutput("status", "passed")
})

const runEligibility = Effect.fn("action.runEligibility")(function*(options: ActionOptions, io: ActionIo) {
  const decision = yield* Config.checkEligibility(eligibilityInput(options))
  const rendered = Config.renderEligibilityDecision(decision, options.format === "json" ? "json" : "text")
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release eligibility\n\n\`\`\`text\n${rendered.trimEnd()}\n\`\`\`\n`)
  }
  if (decision.packageName !== undefined) {
    yield* io.setOutput("release_name", decision.packageName)
  }
  if (decision.packageVersion !== undefined) {
    yield* io.setOutput("release_version", decision.packageVersion)
  }
  yield* io.setOutput("should_release", decision.shouldRelease ? "true" : "false")
  yield* io.setOutput("eligibility_status", decision.status)
  if (decision.status === "partial") {
    return yield* Effect.fail(ActionCommandError.make({
      command: options.command,
      reason: decision.reason
    }))
  }
  yield* io.setOutput("status", "passed")
})

const runCheckIntent = Effect.fn("action.runCheckIntent")(function*(options: ActionOptions, io: ActionIo) {
  const decision = yield* Config.checkIntent(eligibilityInput(options))
  const rendered = Config.renderEligibilityDecision(decision, options.format === "json" ? "json" : "text")
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release check-intent\n\n\`\`\`text\n${rendered.trimEnd()}\n\`\`\`\n`)
  }
  if (decision.packageName !== undefined) {
    yield* io.setOutput("release_name", decision.packageName)
  }
  if (decision.packageVersion !== undefined) {
    yield* io.setOutput("release_version", decision.packageVersion)
  }
  yield* io.setOutput("should_release", decision.shouldRelease ? "true" : "false")
  yield* io.setOutput("eligibility_status", decision.status)
  if (decision.status === "partial") {
    return yield* Effect.fail(ActionCommandError.make({
      command: options.command,
      reason: decision.reason
    }))
  }
  yield* io.setOutput("status", "passed")
})

const runDiagnostics = Effect.fn("action.runDiagnostics")(function*(
  command: "doctor" | "check-auth" | "check-ci",
  options: ActionOptions,
  io: ActionIo
) {
  const report = command === "doctor"
    ? yield* Diagnostics.doctor(diagnosticsInput(options))
    : command === "check-auth"
    ? yield* Diagnostics.checkAuth(diagnosticsInput(options))
    : yield* Diagnostics.checkCi(diagnosticsInput(options))
  const rendered = Diagnostics.render(report, diagnosticsFormat(options))
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
  const plan = yield* Config.plan(releaseInput(options))
  observePlan(plan)
  yield* outputEvidenceDirectory(io, plan)
  yield* Config.writePlannedValidation(plan)
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release validate\n\nstatus: passed\n\nevidence: ${plan.evidenceDirectory}/validation.json\n`)
  }
  yield* io.setOutput("status", "passed")
  return plan
})

const runWorkflow = Effect.fn("action.runWorkflow")(function*(
  options: ActionOptions,
  io: ActionIo,
  observePlan: PlanObserver = NoopPlanObserver
) {
  const plan = yield* Config.plan(releaseInput(options))
  observePlan(plan)
  yield* outputEvidenceDirectory(io, plan)
  yield* Config.writePlannedRun(plan, executionInput(options))
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release run\n\nstatus: passed\n\nevidence: ${plan.evidenceDirectory}/evidence.json\n`)
  }
  yield* io.setOutput("status", "passed")
  return plan
})

const runReconcile = Effect.fn("action.runReconcile")(function*(
  options: ActionOptions,
  io: ActionIo,
  observePlan: PlanObserver = NoopPlanObserver
) {
  const plan = yield* Config.plan(releaseInput(options))
  observePlan(plan)
  yield* outputEvidenceDirectory(io, plan)
  yield* Config.writePlannedReconcile(plan, reconcileInput(options))
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
  const path = yield* Path.Path
  const config = yield* workspaceConfigPath(path, options, options.config)
  const safeOptions = actionOptionsWithConfig(options, config)
  yield* ensureRuntime(safeOptions)
  let planForUpload: ReleasePlan | undefined
  const rememberPlan = (plan: ReleasePlan): ReleasePlan => {
    planForUpload = plan
    return plan
  }
  yield* withEvidenceUpload(safeOptions, io, artifactClient, () => planForUpload, Effect.gen(function*() {
    switch (safeOptions.command) {
      case "plan":
        rememberPlan(yield* runPlan(safeOptions, io))
        return
      case "validate-config":
        yield* runValidateConfig(safeOptions, io)
        return
      case "eligibility":
        yield* runEligibility(safeOptions, io)
        return
      case "check-intent":
        yield* runCheckIntent(safeOptions, io)
        return
      case "doctor":
      case "check-auth":
      case "check-ci":
        yield* runDiagnostics(safeOptions.command, safeOptions, io)
        return
      case "validate":
        yield* runValidate(safeOptions, io, rememberPlan)
        return
      case "run":
        yield* runWorkflow(safeOptions, io, rememberPlan)
        return
      case "reconcile":
        yield* runReconcile(safeOptions, io, rememberPlan)
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
