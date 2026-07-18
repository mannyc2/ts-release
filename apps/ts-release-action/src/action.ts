import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import type * as Crypto from "effect/Crypto"
import * as Inspectable from "effect/Inspectable"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import type { ArtifactStager } from "../../../src/engine/stager.js"
import { ReleasePlan } from "../../../src/pipeline/plan.js"
import * as Release from "../../../src/engine/engine.js"
import { operationSurfaceIds } from "../../../src/engine/summary.js"
import type { ReleaseCommandRunner } from "../../../src/host/host.js"
import type { ReleaseHttp } from "../../../src/host/http.js"
import type { GitHubApi } from "../../../src/engine/github.js"
import * as Doctor from "../../../src/workflows/doctor.js"
import { formatTaggedReason } from "../../../src/internal/error-message.js"
import {
  resolveWorkspacePath,
  validateWorkspaceWritePath
} from "../../../src/internal/workspace-path.js"
import { ActionOptions } from "./input.js"

type ReleaseDiagnosticReport = Doctor.ReleaseDiagnosticReport

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
  | GitHubApi
  | ArtifactStager

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

export const formatActionError = (cause: unknown): string =>
  formatTaggedReason(
    Cause.isCause(cause) ? Cause.squash(cause) : cause,
    renderActionCause
  ) ?? renderActionCause(cause)

const workspaceOutputPath = (
  path: Path.Path,
  options: ActionOptions,
  pathName: string
): Effect.Effect<string, ActionCommandError> => {
  const result = validateWorkspaceWritePath(path, options.root, pathName)
  return result._tag === "Ok"
    ? Effect.succeed(result.path)
    : Effect.fail(
      ActionCommandError.make({
        command: options.command,
        reason: result.reason === "empty-or-parent-traversal"
          ? "plan-path must be non-empty and must not contain parent traversal."
          : "plan-path must resolve inside the action root."
      })
    )
}

const workspaceConfigPath = (
  path: Path.Path,
  options: ActionOptions,
  pathName: string
): Effect.Effect<string, ActionCommandError> => {
  const rootPath = path.resolve(options.root)
  const result = validateWorkspaceWritePath(path, rootPath, pathName)
  if (result._tag === "Invalid") {
    return Effect.fail(
      ActionCommandError.make({
        command: options.command,
        reason: result.reason === "empty-or-parent-traversal"
          ? "config must be non-empty and must not contain parent traversal."
          : "config must resolve inside the action root."
      })
    )
  }
  return Effect.succeed(path.isAbsolute(pathName) ? path.relative(rootPath, result.path) : pathName)
}

const actionOptionsWithConfig = (
  options: ActionOptions,
  config: string
): ActionOptions =>
  ActionOptions.make({ ...options, config })

const releaseInput = (options: ActionOptions) => ({
  workspace: options.root,
  config: options.config,
  snapshot: options.snapshot,
  execute: options.execute,
  approvePublish: options.approvePublish
})

const textOutputFormat = (options: ActionOptions): "json" | "text" =>
  options.format === "json" ? "json" : "text"

const diagnosticsFormat = (options: ActionOptions): "json" | "text" | "markdown" =>
  options.format === "json" || options.format === "markdown" ? options.format : "text"

const diagnosticsInput = (options: ActionOptions) => ({
  root: options.root,
  configPath: options.config,
  format: diagnosticsFormat(options),
  target: options.target
})

const surfaceCount = (plan: ReleasePlan): number =>
  operationSurfaceIds(plan).length

const outputPlan = Effect.fn("action.outputPlan")(function*(io: ActionIo, plan: ReleasePlan, planPath: string) {
  yield* io.setOutput("release_name", plan.identity.name)
  yield* io.setOutput("release_version", plan.identity.version)
  yield* io.setOutput("operation_count", String(plan.operations.length))
  yield* io.setOutput(
    "irreversible_operation_count",
    String(plan.operations.filter((operation) => operation.risk === "irreversible").length)
  )
  yield* io.setOutput("surface_count", String(surfaceCount(plan)))
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
  const absoluteDirectory = resolveWorkspacePath(path, root, evidenceDirectory)
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
  const plan = yield* Release.planRelease(releaseInput(options))
  const contents = Release.renderReleasePlan(plan, options.format)
  const outputPath = yield* workspaceOutputPath(path, options, options.planPath)
  yield* io.writeFile(outputPath, contents)
  if (options.writeStepSummary) {
    const markdown = options.format === "markdown"
      ? contents
      : Release.renderReleasePlan(plan, "markdown")
    yield* io.appendSummary(markdown)
  }
  yield* outputPlan(io, plan, options.planPath)
  yield* io.setOutput("status", "passed")
  return plan
})

const runBuild = Effect.fn("action.runBuild")(function*(
  options: ActionOptions,
  io: ActionIo,
  observePlan: PlanObserver = NoopPlanObserver
) {
  const staged = yield* Release.buildReleaseArtifacts(releaseInput(options))
  observePlan(staged.plan)
  const rendered = Release.renderBuildArtifacts(staged, textOutputFormat(options))
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release build\n\n\`\`\`text\n${rendered.trimEnd()}\n\`\`\`\n`)
  }
  yield* outputEvidenceDirectory(io, staged.plan)
  yield* io.setOutput("status", "passed")
  return staged.plan
})

const runDiagnostics = Effect.fn("action.runDiagnostics")(function*(
  options: ActionOptions,
  io: ActionIo
) {
  const report = yield* Doctor.doctorRelease(diagnosticsInput(options))
  const rendered = Doctor.renderReleaseDiagnostics(report, diagnosticsFormat(options))
  if (options.writeStepSummary) {
    yield* io.appendSummary(rendered)
  }
  yield* io.setOutput("release_name", report.releaseName)
  yield* io.setOutput("release_version", report.releaseVersion)
  yield* failForDiagnostics("doctor", report, options.failOnWarnings)
  yield* io.setOutput("status", "passed")
})

const runVerify = Effect.fn("action.runVerify")(function*(
  options: ActionOptions,
  io: ActionIo,
  observePlan: PlanObserver = NoopPlanObserver
) {
  const plan = yield* Release.planRelease(releaseInput(options))
  observePlan(plan)
  yield* outputEvidenceDirectory(io, plan)
  yield* Release.writeVerificationEvidence(plan)
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release verify\n\nstatus: passed\n\nevidence: ${plan.evidenceDirectory}/verification.json\n`)
  }
  yield* io.setOutput("status", "passed")
  return plan
})

const runRelease = Effect.fn("action.runRelease")(function*(
  options: ActionOptions,
  io: ActionIo,
  observePlan: PlanObserver = NoopPlanObserver
) {
  const plan = yield* Release.planRelease(releaseInput(options))
  observePlan(plan)
  yield* outputEvidenceDirectory(io, plan)
  if (!options.execute) {
    if (options.writeStepSummary) {
      yield* io.appendSummary(
        `${Release.renderReleasePlan(plan, "markdown").trimEnd()}\n\nrelease planned only; set execute: true to run approved operations.\n`
      )
    }
    yield* io.setOutput("status", "passed")
    return plan
  }
  yield* Release.writeReleaseEvidence(plan, releaseInput(options))
  if (options.writeStepSummary) {
    yield* io.appendSummary(`## ts-release release\n\nstatus: passed\n\nevidence: ${plan.evidenceDirectory}/evidence.json\n`)
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
      case "doctor":
        yield* runDiagnostics(safeOptions, io)
        return
      case "build":
        rememberPlan(yield* runBuild(safeOptions, io))
        return
      case "release":
        yield* runRelease(safeOptions, io, rememberPlan)
        return
      case "verify":
        yield* runVerify(safeOptions, io, rememberPlan)
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
