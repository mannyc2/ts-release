// Invariant: one decoded Action request delegates once and derives every output, summary, and upload from that result.
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import type * as Crypto from "effect/Crypto"
import * as Inspectable from "effect/Inspectable"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import type { ArtifactStager } from "../../../src/pack/stager.js"
import { ReleasePlan } from "../../../src/grammar/plan.js"
import * as Release from "../../../src/engine/engine.js"
import { operationSurfaceIds } from "../../../src/render/summary.js"
import type { ReleaseCommandRunner } from "../../../src/host/host.js"
import type { ReleaseHttp } from "../../../src/host/http.js"
import type { GitHubApi } from "../../../src/github/github.js"
import * as Doctor from "../../../src/doctor/doctor.js"
import { formatTaggedReason } from "../../../src/api/error-message.js"
import {
  resolveWorkspacePath,
  validateWorkspaceWritePath
} from "../../../src/host/workspace-path.js"
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

const workspaceActionPath = (
  path: Path.Path,
  options: ActionOptions,
  pathName: string,
  field: "plan-path" | "config"
): Effect.Effect<string, ActionCommandError> => {
  const rootPath = path.resolve(options.root)
  const result = validateWorkspaceWritePath(path, field === "config" ? rootPath : options.root, pathName)
  if (result._tag === "Invalid") {
    return Effect.fail(
      ActionCommandError.make({
        reason: result.reason === "empty-or-parent-traversal"
          ? `${field} must be non-empty and must not contain parent traversal.`
          : `${field} must resolve inside the action root.`
      })
    )
  }
  return Effect.succeed(field === "config" && path.isAbsolute(pathName)
    ? path.relative(rootPath, result.path)
    : field === "config" ? pathName : result.path)
}

const releaseInput = (options: ActionOptions) => ({
  workspace: options.root,
  config: options.config,
  snapshot: options.snapshot,
  execute: options.execute,
  approvePublish: options.approvePublish
})

const diagnosticsFormat = (options: ActionOptions): "json" | "text" | "markdown" =>
  options.format === "json" || options.format === "markdown" ? options.format : "text"

const diagnosticsInput = (options: ActionOptions) => ({
  root: options.root,
  configPath: options.config,
  target: options.target
})

const outputPlan = Effect.fn("action.outputPlan")(function*(
  io: ActionIo,
  plan: ReleasePlan,
  planPath?: string
) {
  const outputs = planPath === undefined ? {} : {
    operation_count: String(plan.operations.length),
    irreversible_operation_count: String(plan.operations.filter((operation) => operation.risk === "irreversible").length),
    surface_count: String(operationSurfaceIds(plan).length),
    plan_path: planPath
  }
  yield* Effect.forEach(Object.entries({
    release_name: plan.identity.name,
    release_version: plan.identity.version,
    evidence_directory: plan.evidenceDirectory,
    ...outputs
  }), ([name, value]) => io.setOutput(name, value), { discard: true })
})

const failForDiagnostics = (
  report: ReleaseDiagnosticReport,
  failOnWarnings: boolean
): Effect.Effect<void, ActionCommandError> => {
  const failed = report.checks.some((check) => check.status === "fail")
  const warned = failOnWarnings && report.checks.some((check) => check.status === "warn")
  return failed || warned
    ? Effect.fail(ActionCommandError.make({ reason: failed
      ? "Diagnostics reported failing checks."
      : "Diagnostics reported warnings and fail-on-warnings is true." }))
    : Effect.void
}

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
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const directory = resolveWorkspacePath(path, plan.source.root, plan.evidenceDirectory)
  const files = (yield* fs.exists(directory))
    ? (yield* fs.readDirectory(directory, { recursive: true }))
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => path.resolve(directory, entry)).sort()
    : []
  if (files.length === 0) {
    yield* io.info(`No evidence files found in ${plan.evidenceDirectory}; evidence upload skipped.`)
    return
  }
  yield* artifactClient.uploadArtifact(options.evidenceArtifactName, files, directory)
})

const withEvidenceUpload = <A, E, R>(
  options: ActionOptions,
  io: ActionIo,
  artifactClient: ActionArtifactClient,
  planRef: () => ReleasePlan | undefined,
  effect: Effect.Effect<A, E, R>
) => effect.pipe(Effect.onExit((exit) => {
  const upload = uploadEvidence(options, io, artifactClient, planRef())
  return exit._tag === "Failure"
    ? upload.pipe(Effect.catch((error) => io.info(`Evidence upload failed: ${formatActionError(error)}`)))
    : upload
}))

const ensureRuntime = (options: ActionOptions): Effect.Effect<void, ActionCommandError> => {
  if (options.runtime === "bundled") {
    return Effect.void
  }
  return Effect.fail(ActionCommandError.make({
    reason:
      "runtime: workspace is deferred because a safe same-module-graph Node runtime requires the workspace to provide @mannyc1/ts-release, effect, and the aligned @effect/platform-node package. Use runtime: bundled."
  }))
}

export const runActionEffect = Effect.fn("action.runActionEffect")(function*(
  options: ActionOptions,
  io: ActionIo,
  artifactClient: ActionArtifactClient = NoopActionArtifactClient
) {
  const path = yield* Path.Path
  const config = yield* workspaceActionPath(path, options, options.config, "config")
  const safeOptions = ActionOptions.make({ ...options, config })
  yield* ensureRuntime(safeOptions)
  let planForUpload: ReleasePlan | undefined
  const rememberPlan = (plan: ReleasePlan): ReleasePlan => {
    planForUpload = plan
    return plan
  }
  yield* withEvidenceUpload(safeOptions, io, artifactClient, () => planForUpload, Effect.gen(function*() {
    switch (safeOptions.command) {
      case "plan":
        {
          const plan = yield* Release.planRelease(releaseInput(safeOptions))
          const contents = Release.renderReleasePlan(plan, safeOptions.format)
          const outputPath = yield* workspaceActionPath(path, safeOptions, safeOptions.planPath, "plan-path")
          yield* io.writeFile(outputPath, contents)
          if (safeOptions.writeStepSummary) yield* io.appendSummary(safeOptions.format === "markdown"
            ? contents : Release.renderReleasePlan(plan, "markdown"))
          yield* outputPlan(io, plan, safeOptions.planPath)
          rememberPlan(plan)
        }
        return
      case "doctor":
        {
          const report = yield* Release.doctorRelease(diagnosticsInput(safeOptions))
          if (safeOptions.writeStepSummary) {
            yield* io.appendSummary(Doctor.renderReleaseDiagnostics(report, diagnosticsFormat(safeOptions)))
          }
          yield* io.setOutput("release_name", report.releaseName)
          yield* io.setOutput("release_version", report.releaseVersion)
          yield* failForDiagnostics(report, safeOptions.failOnWarnings)
        }
        return
      case "build":
        {
          const staged = yield* Release.build(releaseInput(safeOptions))
          rememberPlan(staged.plan)
          const rendered = Release.renderBuildArtifacts(staged, safeOptions.format === "json" ? "json" : "text")
          if (safeOptions.writeStepSummary) {
            yield* io.appendSummary(`## ts-release build\n\n\`\`\`text\n${rendered.trimEnd()}\n\`\`\`\n`)
          }
          yield* outputPlan(io, staged.plan)
        }
        return
      case "release":
      case "verify":
        {
          const command = safeOptions.command
          const plan = yield* Release.planRelease(releaseInput(safeOptions))
          rememberPlan(plan)
          yield* outputPlan(io, plan)
          if (command === "release" && !safeOptions.execute) {
            if (safeOptions.writeStepSummary) yield* io.appendSummary(
              `${Release.renderReleasePlan(plan, "markdown").trimEnd()}\n\nrelease planned only; set execute: true to run approved operations.\n`)
            return
          }
          yield* (command === "verify"
            ? Release.verify(releaseInput(safeOptions))
            : Release.release(releaseInput(safeOptions)))
          if (safeOptions.writeStepSummary) {
            const evidenceName = command === "verify" ? "verification" : "evidence"
            yield* io.appendSummary(
              `## ts-release ${command}\n\nstatus: passed\n\nevidence: ${plan.evidenceDirectory}/${evidenceName}.json\n`)
          }
        }
        return
    }
  }))
  yield* io.setOutput("status", "passed")
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
