import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { ConfigReadError } from "../config/errors.js"
import { parseReleaseIntent } from "../config/load.js"
import { DEFAULT_CONFIG_PATH } from "../config/schema.js"
import { ExecutionApproval } from "../domain/operation.js"
import { createReleasePlan } from "../planner/create-release-plan.js"
import { executePlan, renderPlan, runApprovedReleaseWorkflow, validatePlan, verifyPlan } from "../planner/executor.js"
import {
  renderPlanJson,
  renderPlanMarkdown,
  renderPlanOperationExplanation,
  renderPlanSummary,
  renderPlanText
} from "../planner/render-plan.js"
import {
  ReleaseResumeOptions,
  renderReleaseStatusJson,
  renderReleaseStatusText,
  resumeApprovedReleaseWorkflow,
  statusReleasePlan
} from "../planner/status.js"
import {
  reconcileReleasePlan,
  ReleaseReconcileOptions
} from "../planner/reconcile.js"
import {
  checkReleaseEligibility,
  ReleasePackageManifest,
  releaseEligibilityRemoteCheckFromIntent
} from "../planner/release-eligibility.js"
import { ReleaseEligibilityCheckError } from "../planner/errors.js"
import { RELEASE_VERSION } from "../version.js"

export type * from "../types/effect-internal.js"

export { RELEASE_VERSION }

export const ReleasePlanFormat = Schema.Literals(["json", "text", "summary", "markdown"])
export type ReleasePlanFormat = typeof ReleasePlanFormat.Type

export const ReleaseConfigValidationFormat = Schema.Literals(["json", "text"])
export type ReleaseConfigValidationFormat = typeof ReleaseConfigValidationFormat.Type

export class ReleaseConfigOptions extends Schema.Class<ReleaseConfigOptions>("ReleaseConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String)
}) {}

export class ValidateReleaseConfigFileOptions extends Schema.Class<ValidateReleaseConfigFileOptions>(
  "ValidateReleaseConfigFileOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleaseConfigValidationFormat)
}) {}

export class ReleaseConfigValidationResult extends Schema.Class<ReleaseConfigValidationResult>(
  "ReleaseConfigValidationResult"
)({
  schemaVersion: Schema.Literal("release-config-validation/v1"),
  path: Schema.String,
  valid: Schema.Boolean
}) {}

export class PlanReleaseConfigOptions extends Schema.Class<PlanReleaseConfigOptions>("PlanReleaseConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleasePlanFormat)
}) {}

export class RenderReleaseConfigOptions extends Schema.Class<RenderReleaseConfigOptions>("RenderReleaseConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean)
}) {}

export class ExplainReleaseConfigOptions extends Schema.Class<ExplainReleaseConfigOptions>(
  "ExplainReleaseConfigOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  operationId: Schema.String
}) {}

export class ReleaseExecutionOptions extends Schema.Class<ReleaseExecutionOptions>("ReleaseExecutionOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean),
  approveIrreversible: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseStatusOptions extends Schema.Class<ReleaseStatusOptions>("ReleaseStatusOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleasePlanFormat)
}) {}

export class ReleaseResumeConfigOptions extends Schema.Class<ReleaseResumeConfigOptions>("ReleaseResumeConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean),
  approveIrreversible: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseReconcileConfigOptions extends Schema.Class<ReleaseReconcileConfigOptions>(
  "ReleaseReconcileConfigOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseEligibilityConfigOptions extends Schema.Class<ReleaseEligibilityConfigOptions>(
  "ReleaseEligibilityConfigOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  packagePath: Schema.optionalKey(Schema.String)
}) {}

const configRoot = (path: Path.Path, options: ReleaseConfigOptions): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

const configPath = (options: ReleaseConfigOptions): string =>
  options.configPath ?? DEFAULT_CONFIG_PATH

const packagePath = (options: ReleaseEligibilityConfigOptions): string =>
  options.packagePath ?? "package.json"

const configReadPath = (path: Path.Path, options: ReleaseConfigOptions): string => {
  const pathName = configPath(options)
  return path.isAbsolute(pathName) ? pathName : path.resolve(configRoot(path, options), pathName)
}

const packageReadPath = (path: Path.Path, options: ReleaseEligibilityConfigOptions): string => {
  const pathName = packagePath(options)
  return path.isAbsolute(pathName) ? pathName : path.resolve(configRoot(path, options), pathName)
}

const approvalFromOptions = (options: ReleaseExecutionOptions): ExecutionApproval =>
  ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: options.approveIrreversible ?? false
  })

const resumeOptionsFromConfigOptions = (options: ReleaseResumeConfigOptions): ReleaseResumeOptions =>
  ReleaseResumeOptions.make({
    execute: options.execute ?? false,
    approveIrreversible: options.approveIrreversible ?? false
  })

const reconcileOptionsFromConfigOptions = (options: ReleaseReconcileConfigOptions): ReleaseReconcileOptions =>
  ReleaseReconcileOptions.make({
    execute: options.execute ?? false
  })

const renderApprovalFromOptions = (options: RenderReleaseConfigOptions): ExecutionApproval =>
  ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: false
  })

const readReleaseConfig = Effect.fn("workflows.config.readReleaseConfig")(function*(options: ReleaseConfigOptions) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const pathName = configPath(options)
  const readPath = configReadPath(path, options)
  return yield* fs.readFileString(readPath).pipe(
    Effect.mapError((error) =>
      ConfigReadError.make({
        path: pathName,
        reason: error.message
      })
    )
  )
})

const decodePackageManifest = Schema.decodeUnknownEffect(ReleasePackageManifest)

const readPackageManifest = Effect.fn("workflows.config.readPackageManifest")(function*(
  options: ReleaseEligibilityConfigOptions
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const pathName = packagePath(options)
  const readPath = packageReadPath(path, options)
  const contents = yield* fs.readFileString(readPath).pipe(
    Effect.mapError((error) =>
      ConfigReadError.make({
        path: pathName,
        reason: error.message
      })
    )
  )
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) =>
      ReleaseEligibilityCheckError.make({
        reason: `package manifest is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`
      })
  })
  return yield* decodePackageManifest(parsed).pipe(
    Effect.mapError((error) =>
      ReleaseEligibilityCheckError.make({
        reason: `package manifest is missing release identity fields: ${error.message}`
      })
    )
  )
})

export const planReleaseConfig = Effect.fn("workflows.config.planReleaseConfig")(function*(
  options: PlanReleaseConfigOptions = PlanReleaseConfigOptions.make({})
) {
  const path = yield* Path.Path
  const pathName = configPath(options)
  const contents = yield* readReleaseConfig(options)
  const intent = yield* parseReleaseIntent(contents, pathName)
  return yield* createReleasePlan(intent, configRoot(path, options), pathName)
})

export const renderReleaseConfigPlan = Effect.fn("workflows.config.renderReleaseConfigPlan")(function*(
  options: PlanReleaseConfigOptions = PlanReleaseConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  switch (options.format ?? "text") {
    case "json":
      return renderPlanJson(plan)
    case "summary":
      return renderPlanSummary(plan)
    case "markdown":
      return renderPlanMarkdown(plan)
    case "text":
      return renderPlanText(plan)
  }
})

export const explainReleaseConfigOperation = Effect.fn("workflows.config.explainReleaseConfigOperation")(function*(
  options: ExplainReleaseConfigOptions
) {
  const plan = yield* planReleaseConfig(PlanReleaseConfigOptions.make({
    ...(options.root === undefined ? {} : { root: options.root }),
    ...(options.configPath === undefined ? {} : { configPath: options.configPath })
  }))
  return yield* renderPlanOperationExplanation(plan, options.operationId)
})

export const renderReleaseConfig = Effect.fn("workflows.config.renderReleaseConfig")(function*(
  options: RenderReleaseConfigOptions = RenderReleaseConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* renderPlan(plan, renderApprovalFromOptions(options))
})

export const validateReleaseConfigFile = Effect.fn("workflows.config.validateReleaseConfigFile")(function*(
  options: ValidateReleaseConfigFileOptions = ValidateReleaseConfigFileOptions.make({})
) {
  const pathName = configPath(options)
  const contents = yield* readReleaseConfig(options)
  yield* parseReleaseIntent(contents, pathName)
  return ReleaseConfigValidationResult.make({
    schemaVersion: "release-config-validation/v1",
    path: pathName,
    valid: true
  })
})

export const renderReleaseConfigValidationJson = (result: ReleaseConfigValidationResult): string =>
  `${JSON.stringify(result, null, 2)}\n`

export const renderReleaseConfigValidationText = (result: ReleaseConfigValidationResult): string =>
  `config: ${result.path}\nvalid: ${result.valid ? "true" : "false"}\n`

export const renderReleaseConfigValidation = Effect.fn("workflows.config.renderReleaseConfigValidation")(function*(
  options: ValidateReleaseConfigFileOptions = ValidateReleaseConfigFileOptions.make({})
) {
  const result = yield* validateReleaseConfigFile(options)
  return (options.format ?? "text") === "json"
    ? renderReleaseConfigValidationJson(result)
    : renderReleaseConfigValidationText(result)
})

export const validateReleaseConfig = Effect.fn("workflows.config.validateReleaseConfig")(function*(
  options: ReleaseConfigOptions = ReleaseConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* validatePlan(plan)
})

export const executeReleaseConfig = Effect.fn("workflows.config.executeReleaseConfig")(function*(
  options: ReleaseExecutionOptions = ReleaseExecutionOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* executePlan(plan, approvalFromOptions(options))
})

export const verifyReleaseConfig = Effect.fn("workflows.config.verifyReleaseConfig")(function*(
  options: ReleaseConfigOptions = ReleaseConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* verifyPlan(plan)
})

export const runReleaseConfig = Effect.fn("workflows.config.runReleaseConfig")(function*(
  options: ReleaseExecutionOptions = ReleaseExecutionOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* runApprovedReleaseWorkflow(plan, approvalFromOptions(options))
})

export const statusReleaseConfig = Effect.fn("workflows.config.statusReleaseConfig")(function*(
  options: ReleaseStatusOptions = ReleaseStatusOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* statusReleasePlan(plan)
})

export const renderReleaseStatus = Effect.fn("workflows.config.renderReleaseStatus")(function*(
  options: ReleaseStatusOptions = ReleaseStatusOptions.make({})
) {
  const report = yield* statusReleaseConfig(options)
  return (options.format ?? "text") === "json"
    ? renderReleaseStatusJson(report)
    : renderReleaseStatusText(report)
})

export const resumeReleaseConfig = Effect.fn("workflows.config.resumeReleaseConfig")(function*(
  options: ReleaseResumeConfigOptions = ReleaseResumeConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* resumeApprovedReleaseWorkflow(plan, resumeOptionsFromConfigOptions(options))
})

export const reconcileReleaseConfig = Effect.fn("workflows.config.reconcileReleaseConfig")(function*(
  options: ReleaseReconcileConfigOptions = ReleaseReconcileConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* reconcileReleasePlan(plan, reconcileOptionsFromConfigOptions(options))
})

export const checkReleaseConfigEligibility = Effect.fn("workflows.config.checkReleaseConfigEligibility")(function*(
  options: ReleaseEligibilityConfigOptions = ReleaseEligibilityConfigOptions.make({})
) {
  const pathName = configPath(options)
  const contents = yield* readReleaseConfig(options)
  const intent = yield* parseReleaseIntent(contents, pathName)
  const manifest = yield* readPackageManifest(options)
  const remoteCheck = yield* releaseEligibilityRemoteCheckFromIntent(manifest, intent)
  return yield* checkReleaseEligibility(remoteCheck)
})
