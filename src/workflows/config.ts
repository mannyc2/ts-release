import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { ConfigReadError } from "../config/errors.js"
import { parseReleaseIntent } from "../config/load.js"
import { DEFAULT_CONFIG_PATH } from "../config/schema.js"
import { EvidenceBundle, ReleaseWorkflowEvidence } from "../domain/evidence.js"
import { ExecutionApproval } from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { ReleaseEligibilityDecision } from "../domain/remote-state.js"
import { ReleaseStatusReport } from "../domain/status.js"
import { createReleasePlan } from "../planner/create-release-plan.js"
import {
  executePlan,
  renderPlan as renderOperationPlan,
  runApprovedReleaseWorkflow,
  validatePlan,
  verifyPlan
} from "../planner/executor.js"
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
  checkReleaseDecision,
  checkReleaseIntentRequirement,
  renderReleaseEligibilityJson,
  renderReleaseEligibilityText
} from "../planner/release-eligibility.js"
import {
  releaseConfigFields,
  releaseExecuteField,
  releaseExecutionFields,
  releaseFormatField
} from "./options.js"
import {
  WorkflowEvidencePathsWritten,
  writeNamedEvidenceWithFailure,
  writeWorkflowEvidenceWithFailure
} from "./evidence.js"

export type * from "../types/effect-internal.js"

export const ReleasePlanFormat = Schema.Literals(["json", "text", "summary", "markdown"])
export type ReleasePlanFormat = typeof ReleasePlanFormat.Type

export const ReleaseConfigValidationFormat = Schema.Literals(["json", "text"])
export type ReleaseConfigValidationFormat = typeof ReleaseConfigValidationFormat.Type

export class ReleaseConfigOptions extends Schema.Class<ReleaseConfigOptions>("ReleaseConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String)
}) {}

export interface ReleaseConfigInput {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
}

export class ValidateReleaseConfigFileOptions extends Schema.Class<ValidateReleaseConfigFileOptions>(
  "ValidateReleaseConfigFileOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleaseConfigValidationFormat)
}) {}

export interface ValidateReleaseConfigFileInput extends ReleaseConfigInput {
  readonly format?: ReleaseConfigValidationFormat | undefined
}

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

export interface PlanReleaseConfigInput extends ReleaseConfigInput {
  readonly format?: ReleasePlanFormat | undefined
}

export class RenderReleaseConfigOptions extends Schema.Class<RenderReleaseConfigOptions>("RenderReleaseConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean)
}) {}

export interface RenderReleaseConfigInput extends ReleaseConfigInput {
  readonly execute?: boolean | undefined
}

export class ExplainReleaseConfigOptions extends Schema.Class<ExplainReleaseConfigOptions>(
  "ExplainReleaseConfigOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  operationId: Schema.String
}) {}

export interface ExplainReleaseConfigInput extends ReleaseConfigInput {
  readonly operationId: string
}

export class ReleaseExecutionOptions extends Schema.Class<ReleaseExecutionOptions>("ReleaseExecutionOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean),
  approveIrreversible: Schema.optionalKey(Schema.Boolean)
}) {}

export interface ReleaseExecutionInput extends ReleaseConfigInput {
  readonly execute?: boolean | undefined
  readonly approveIrreversible?: boolean | undefined
}

export class ReleaseStatusOptions extends Schema.Class<ReleaseStatusOptions>("ReleaseStatusOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleasePlanFormat)
}) {}

export interface ReleaseStatusInput extends ReleaseConfigInput {
  readonly format?: ReleasePlanFormat | undefined
}

export class ReleaseResumeConfigOptions extends Schema.Class<ReleaseResumeConfigOptions>("ReleaseResumeConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean),
  approveIrreversible: Schema.optionalKey(Schema.Boolean)
}) {}

export interface ReleaseResumeConfigInput extends ReleaseExecutionInput {}

export class ReleaseReconcileConfigOptions extends Schema.Class<ReleaseReconcileConfigOptions>(
  "ReleaseReconcileConfigOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean)
}) {}

export interface ReleaseReconcileConfigInput extends ReleaseConfigInput {
  readonly execute?: boolean | undefined
}

export class ReleaseEligibilityConfigOptions extends Schema.Class<ReleaseEligibilityConfigOptions>(
  "ReleaseEligibilityConfigOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  packagePath: Schema.optionalKey(Schema.String)
}) {}

export interface ReleaseEligibilityConfigInput extends ReleaseConfigInput {
  readonly packagePath?: string | undefined
}

export class ReleaseIntentCheckOptions extends Schema.Class<ReleaseIntentCheckOptions>("ReleaseIntentCheckOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String)
}) {}

export interface ReleaseIntentCheckInput extends ReleaseConfigInput {}

export class PlannedReleaseConfigPlanResult extends Schema.Class<PlannedReleaseConfigPlanResult>(
  "PlannedReleaseConfigPlanResult"
)({
  plan: ReleasePlan,
  contents: Schema.String
}) {}

export class PlannedReleaseConfigEvidenceResult extends Schema.Class<PlannedReleaseConfigEvidenceResult>(
  "PlannedReleaseConfigEvidenceResult"
)({
  plan: ReleasePlan,
  evidence: EvidenceBundle
}) {}

export class PlannedReleaseConfigWorkflowResult extends Schema.Class<PlannedReleaseConfigWorkflowResult>(
  "PlannedReleaseConfigWorkflowResult"
)({
  plan: ReleasePlan,
  evidence: ReleaseWorkflowEvidence
}) {}

export class PlannedReleaseConfigWrittenEvidenceResult extends Schema.Class<PlannedReleaseConfigWrittenEvidenceResult>(
  "PlannedReleaseConfigWrittenEvidenceResult"
)({
  plan: ReleasePlan,
  evidence: EvidenceBundle
}) {}

export class PlannedReleaseConfigWrittenWorkflowResult extends Schema.Class<PlannedReleaseConfigWrittenWorkflowResult>(
  "PlannedReleaseConfigWrittenWorkflowResult"
)({
  plan: ReleasePlan,
  paths: WorkflowEvidencePathsWritten
}) {}

export class PlannedReleaseConfigStatusResult extends Schema.Class<PlannedReleaseConfigStatusResult>(
  "PlannedReleaseConfigStatusResult"
)({
  plan: ReleasePlan,
  report: ReleaseStatusReport
}) {}

const releaseConfigOptionsFromInput = (
  input: ReleaseConfigInput = {}
): ReleaseConfigOptions =>
  ReleaseConfigOptions.make(releaseConfigFields(input))

const validateReleaseConfigFileOptionsFromInput = (
  input: ValidateReleaseConfigFileInput = {}
): ValidateReleaseConfigFileOptions =>
  ValidateReleaseConfigFileOptions.make({
    ...releaseConfigFields(input),
    ...releaseFormatField(input)
  })

const planReleaseConfigOptionsFromInput = (
  input: PlanReleaseConfigInput = {}
): PlanReleaseConfigOptions =>
  PlanReleaseConfigOptions.make({
    ...releaseConfigFields(input),
    ...releaseFormatField(input)
  })

const renderReleaseConfigOptionsFromInput = (
  input: RenderReleaseConfigInput = {}
): RenderReleaseConfigOptions =>
  RenderReleaseConfigOptions.make({
    ...releaseConfigFields(input),
    ...releaseExecuteField(input)
  })

const explainReleaseConfigOptionsFromInput = (
  input: ExplainReleaseConfigInput
): ExplainReleaseConfigOptions =>
  ExplainReleaseConfigOptions.make({
    ...releaseConfigFields(input),
    operationId: input.operationId
  })

const releaseExecutionOptionsFromInput = (
  input: ReleaseExecutionInput = {}
): ReleaseExecutionOptions =>
  ReleaseExecutionOptions.make(releaseExecutionFields(input))

const releaseStatusOptionsFromInput = (
  input: ReleaseStatusInput = {}
): ReleaseStatusOptions =>
  ReleaseStatusOptions.make({
    ...releaseConfigFields(input),
    ...releaseFormatField(input)
  })

const releaseResumeConfigOptionsFromInput = (
  input: ReleaseResumeConfigInput = {}
): ReleaseResumeConfigOptions =>
  ReleaseResumeConfigOptions.make(releaseExecutionFields(input))

const releaseReconcileConfigOptionsFromInput = (
  input: ReleaseReconcileConfigInput = {}
): ReleaseReconcileConfigOptions =>
  ReleaseReconcileConfigOptions.make({
    ...releaseConfigFields(input),
    ...releaseExecuteField(input)
  })

const releaseEligibilityConfigOptionsFromInput = (
  input: ReleaseEligibilityConfigInput = {}
): ReleaseEligibilityConfigOptions =>
  ReleaseEligibilityConfigOptions.make({
    ...releaseConfigFields(input),
    ...(input.packagePath === undefined ? {} : { packagePath: input.packagePath })
  })

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

const configReadPath = (path: Path.Path, options: ReleaseConfigOptions): string => {
  const pathName = configPath(options)
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

export const planReleaseConfig = Effect.fn("workflows.config.planReleaseConfig")(function*(
  input: PlanReleaseConfigInput = {}
) {
  const options = planReleaseConfigOptionsFromInput(input)
  const path = yield* Path.Path
  const pathName = configPath(options)
  const contents = yield* readReleaseConfig(options)
  const intent = yield* parseReleaseIntent(contents, pathName)
  return yield* createReleasePlan(intent, configRoot(path, options), pathName)
})

export const renderReleasePlan = (
  plan: ReleasePlan,
  format: ReleasePlanFormat = "text"
): string => {
  switch (format) {
    case "json":
      return renderPlanJson(plan)
    case "summary":
      return renderPlanSummary(plan)
    case "markdown":
      return renderPlanMarkdown(plan)
    case "text":
      return renderPlanText(plan)
  }
}

export const renderPlannedReleaseConfigPlan = Effect.fn("workflows.config.renderPlannedReleaseConfigPlan")(function*(
  input: PlanReleaseConfigInput = {}
) {
  const options = planReleaseConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  return PlannedReleaseConfigPlanResult.make({
    plan,
    contents: renderReleasePlan(plan, options.format ?? "text")
  })
})

export const renderReleaseConfigPlan = Effect.fn("workflows.config.renderReleaseConfigPlan")(function*(
  input: PlanReleaseConfigInput = {}
) {
  const result = yield* renderPlannedReleaseConfigPlan(input)
  return result.contents
})

export const explainReleaseConfigOperation = Effect.fn("workflows.config.explainReleaseConfigOperation")(function*(
  input: ExplainReleaseConfigInput
) {
  const options = explainReleaseConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(PlanReleaseConfigOptions.make({
    ...releaseConfigFields(options)
  }))
  return yield* renderPlanOperationExplanation(plan, options.operationId)
})

export const renderReleaseConfig = Effect.fn("workflows.config.renderReleaseConfig")(function*(
  input: RenderReleaseConfigInput = {}
) {
  const result = yield* planAndRenderReleaseConfig(input)
  return result.evidence
})

export const planAndRenderReleaseConfig = Effect.fn("workflows.config.planAndRenderReleaseConfig")(function*(
  input: RenderReleaseConfigInput = {}
) {
  const options = renderReleaseConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* renderOperationPlan(plan, renderApprovalFromOptions(options))
  return PlannedReleaseConfigEvidenceResult.make({ plan, evidence })
})

export const writePlannedRenderEvidence = Effect.fn("workflows.config.writePlannedRenderEvidence")(function*(
  plan: ReleasePlan,
  input: RenderReleaseConfigInput = {}
) {
  const options = renderReleaseConfigOptionsFromInput(input)
  return yield* writeNamedEvidenceWithFailure(
    plan,
    "render",
    renderOperationPlan(plan, renderApprovalFromOptions(options))
  )
})

export const planAndWriteRenderEvidence = Effect.fn("workflows.config.planAndWriteRenderEvidence")(function*(
  input: RenderReleaseConfigInput = {}
) {
  const options = renderReleaseConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* writePlannedRenderEvidence(plan, options)
  return PlannedReleaseConfigWrittenEvidenceResult.make({ plan, evidence })
})

export const validateReleaseConfigFile = Effect.fn("workflows.config.validateReleaseConfigFile")(function*(
  input: ValidateReleaseConfigFileInput = {}
) {
  const options = validateReleaseConfigFileOptionsFromInput(input)
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
  input: ValidateReleaseConfigFileInput = {}
) {
  const options = validateReleaseConfigFileOptionsFromInput(input)
  const result = yield* validateReleaseConfigFile(options)
  return (options.format ?? "text") === "json"
    ? renderReleaseConfigValidationJson(result)
    : renderReleaseConfigValidationText(result)
})

export const validateReleaseConfig = Effect.fn("workflows.config.validateReleaseConfig")(function*(
  input: ReleaseConfigInput = {}
) {
  const result = yield* planAndValidateReleaseConfig(input)
  return result.evidence
})

export const planAndValidateReleaseConfig = Effect.fn("workflows.config.planAndValidateReleaseConfig")(function*(
  input: ReleaseConfigInput = {}
) {
  const options = releaseConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* validatePlan(plan)
  return PlannedReleaseConfigEvidenceResult.make({ plan, evidence })
})

export const writePlannedValidationEvidence = Effect.fn("workflows.config.writePlannedValidationEvidence")(function*(
  plan: ReleasePlan
) {
  return yield* writeNamedEvidenceWithFailure(plan, "validation", validatePlan(plan))
})

export const planAndWriteValidationEvidence = Effect.fn("workflows.config.planAndWriteValidationEvidence")(function*(
  input: ReleaseConfigInput = {}
) {
  const options = releaseConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* writePlannedValidationEvidence(plan)
  return PlannedReleaseConfigWrittenEvidenceResult.make({ plan, evidence })
})

export const executeReleaseConfig = Effect.fn("workflows.config.executeReleaseConfig")(function*(
  input: ReleaseExecutionInput = {}
) {
  const result = yield* planAndExecuteReleaseConfig(input)
  return result.evidence
})

export const planAndExecuteReleaseConfig = Effect.fn("workflows.config.planAndExecuteReleaseConfig")(function*(
  input: ReleaseExecutionInput = {}
) {
  const options = releaseExecutionOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* executePlan(plan, approvalFromOptions(options))
  return PlannedReleaseConfigEvidenceResult.make({ plan, evidence })
})

export const writePlannedExecutionEvidence = Effect.fn("workflows.config.writePlannedExecutionEvidence")(function*(
  plan: ReleasePlan,
  input: ReleaseExecutionInput = {}
) {
  const options = releaseExecutionOptionsFromInput(input)
  return yield* writeNamedEvidenceWithFailure(plan, "execution", executePlan(plan, approvalFromOptions(options)))
})

export const planAndWriteExecutionEvidence = Effect.fn("workflows.config.planAndWriteExecutionEvidence")(function*(
  input: ReleaseExecutionInput = {}
) {
  const options = releaseExecutionOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* writePlannedExecutionEvidence(plan, options)
  return PlannedReleaseConfigWrittenEvidenceResult.make({ plan, evidence })
})

export const verifyReleaseConfig = Effect.fn("workflows.config.verifyReleaseConfig")(function*(
  input: ReleaseConfigInput = {}
) {
  const result = yield* planAndVerifyReleaseConfig(input)
  return result.evidence
})

export const planAndVerifyReleaseConfig = Effect.fn("workflows.config.planAndVerifyReleaseConfig")(function*(
  input: ReleaseConfigInput = {}
) {
  const options = releaseConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* verifyPlan(plan)
  return PlannedReleaseConfigEvidenceResult.make({ plan, evidence })
})

export const writePlannedVerificationEvidence = Effect.fn("workflows.config.writePlannedVerificationEvidence")(function*(
  plan: ReleasePlan
) {
  return yield* writeNamedEvidenceWithFailure(plan, "verification", verifyPlan(plan))
})

export const planAndWriteVerificationEvidence = Effect.fn("workflows.config.planAndWriteVerificationEvidence")(function*(
  input: ReleaseConfigInput = {}
) {
  const options = releaseConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* writePlannedVerificationEvidence(plan)
  return PlannedReleaseConfigWrittenEvidenceResult.make({ plan, evidence })
})

export const runReleaseConfig = Effect.fn("workflows.config.runReleaseConfig")(function*(
  input: ReleaseExecutionInput = {}
) {
  const result = yield* planAndRunReleaseConfig(input)
  return result.evidence
})

export const planAndRunReleaseConfig = Effect.fn("workflows.config.planAndRunReleaseConfig")(function*(
  input: ReleaseExecutionInput = {}
) {
  const options = releaseExecutionOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* runApprovedReleaseWorkflow(plan, approvalFromOptions(options))
  return PlannedReleaseConfigWorkflowResult.make({ plan, evidence })
})

export const writePlannedRunWorkflowEvidence = Effect.fn("workflows.config.writePlannedRunWorkflowEvidence")(function*(
  plan: ReleasePlan,
  input: ReleaseExecutionInput = {}
) {
  const options = releaseExecutionOptionsFromInput(input)
  return yield* writeWorkflowEvidenceWithFailure(
    plan,
    runApprovedReleaseWorkflow(plan, approvalFromOptions(options))
  )
})

export const planAndWriteRunWorkflowEvidence = Effect.fn("workflows.config.planAndWriteRunWorkflowEvidence")(function*(
  input: ReleaseExecutionInput = {}
) {
  const options = releaseExecutionOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const paths = yield* writePlannedRunWorkflowEvidence(plan, options)
  return PlannedReleaseConfigWrittenWorkflowResult.make({ plan, paths })
})

export const statusReleaseConfig = Effect.fn("workflows.config.statusReleaseConfig")(function*(
  input: ReleaseStatusInput = {}
) {
  const result = yield* planAndStatusReleaseConfig(input)
  return result.report
})

export const planAndStatusReleaseConfig = Effect.fn("workflows.config.planAndStatusReleaseConfig")(function*(
  input: ReleaseStatusInput = {}
) {
  const options = releaseStatusOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const report = yield* statusReleasePlan(plan)
  return PlannedReleaseConfigStatusResult.make({ plan, report })
})

export const renderReleaseStatus = Effect.fn("workflows.config.renderReleaseStatus")(function*(
  input: ReleaseStatusInput = {}
) {
  const options = releaseStatusOptionsFromInput(input)
  const report = yield* statusReleaseConfig(options)
  return renderReleaseStatusReport(report, options.format ?? "text")
})

export const renderReleaseStatusReport = (
  report: ReleaseStatusReport,
  format: ReleasePlanFormat = "text"
): string =>
  format === "json"
    ? renderReleaseStatusJson(report)
    : renderReleaseStatusText(report)

export const resumeReleaseConfig = Effect.fn("workflows.config.resumeReleaseConfig")(function*(
  input: ReleaseResumeConfigInput = {}
) {
  const result = yield* planAndResumeReleaseConfig(input)
  return result.evidence
})

export const planAndResumeReleaseConfig = Effect.fn("workflows.config.planAndResumeReleaseConfig")(function*(
  input: ReleaseResumeConfigInput = {}
) {
  const options = releaseResumeConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* resumeApprovedReleaseWorkflow(plan, resumeOptionsFromConfigOptions(options))
  return PlannedReleaseConfigWorkflowResult.make({ plan, evidence })
})

export const writePlannedResumeWorkflowEvidence = Effect.fn(
  "workflows.config.writePlannedResumeWorkflowEvidence"
)(function*(
  plan: ReleasePlan,
  input: ReleaseResumeConfigInput = {}
) {
  const options = releaseResumeConfigOptionsFromInput(input)
  return yield* writeWorkflowEvidenceWithFailure(
    plan,
    resumeApprovedReleaseWorkflow(plan, resumeOptionsFromConfigOptions(options))
  )
})

export const planAndWriteResumeWorkflowEvidence = Effect.fn(
  "workflows.config.planAndWriteResumeWorkflowEvidence"
)(function*(
  input: ReleaseResumeConfigInput = {}
) {
  const options = releaseResumeConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const paths = yield* writePlannedResumeWorkflowEvidence(plan, options)
  return PlannedReleaseConfigWrittenWorkflowResult.make({ plan, paths })
})

export const reconcileReleaseConfig = Effect.fn("workflows.config.reconcileReleaseConfig")(function*(
  input: ReleaseReconcileConfigInput = {}
) {
  const result = yield* planAndReconcileReleaseConfig(input)
  return result.evidence
})

export const planAndReconcileReleaseConfig = Effect.fn("workflows.config.planAndReconcileReleaseConfig")(function*(
  input: ReleaseReconcileConfigInput = {}
) {
  const options = releaseReconcileConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* reconcileReleasePlan(plan, reconcileOptionsFromConfigOptions(options))
  return PlannedReleaseConfigEvidenceResult.make({ plan, evidence })
})

export const writePlannedReconciliationEvidence = Effect.fn(
  "workflows.config.writePlannedReconciliationEvidence"
)(function*(
  plan: ReleasePlan,
  input: ReleaseReconcileConfigInput = {}
) {
  const options = releaseReconcileConfigOptionsFromInput(input)
  return yield* writeNamedEvidenceWithFailure(
    plan,
    "reconciliation",
    reconcileReleasePlan(plan, reconcileOptionsFromConfigOptions(options))
  )
})

export const planAndWriteReconciliationEvidence = Effect.fn(
  "workflows.config.planAndWriteReconciliationEvidence"
)(function*(
  input: ReleaseReconcileConfigInput = {}
) {
  const options = releaseReconcileConfigOptionsFromInput(input)
  const plan = yield* planReleaseConfig(options)
  const evidence = yield* writePlannedReconciliationEvidence(plan, options)
  return PlannedReleaseConfigWrittenEvidenceResult.make({ plan, evidence })
})

export const checkReleaseConfigEligibility = Effect.fn("workflows.config.checkReleaseConfigEligibility")(function*(
  input: ReleaseEligibilityConfigInput = {}
) {
  const options = releaseEligibilityConfigOptionsFromInput(input)
  const path = yield* Path.Path
  const pathName = configPath(options)
  const contents = yield* readReleaseConfig(options)
  const intent = yield* parseReleaseIntent(contents, pathName)
  return yield* checkReleaseDecision(intent, configRoot(path, options))
})

export const checkReleaseConfigIntent = Effect.fn("workflows.config.checkReleaseConfigIntent")(function*(
  input: ReleaseIntentCheckInput = {}
) {
  const options = releaseConfigOptionsFromInput(input)
  const path = yield* Path.Path
  const pathName = configPath(options)
  const contents = yield* readReleaseConfig(options)
  const intent = yield* parseReleaseIntent(contents, pathName)
  return yield* checkReleaseIntentRequirement(intent, configRoot(path, options))
})

export const renderReleaseEligibilityDecision = (
  decision: ReleaseEligibilityDecision,
  format: "json" | "text"
): string =>
  format === "json"
    ? renderReleaseEligibilityJson(decision)
    : renderReleaseEligibilityText(decision)

export const plan = planReleaseConfig
export const renderPlan = renderReleaseConfigPlan
export const renderPlannedPlan = renderPlannedReleaseConfigPlan
export const explain = explainReleaseConfigOperation
export const render = renderReleaseConfig
export const planAndRender = planAndRenderReleaseConfig
export const writePlannedRender = writePlannedRenderEvidence
export const planAndWriteRender = planAndWriteRenderEvidence
export const validateFile = validateReleaseConfigFile
export const renderValidation = renderReleaseConfigValidation
export const validate = validateReleaseConfig
export const planAndValidate = planAndValidateReleaseConfig
export const writePlannedValidation = writePlannedValidationEvidence
export const planAndWriteValidation = planAndWriteValidationEvidence
export const execute = executeReleaseConfig
export const planAndExecute = planAndExecuteReleaseConfig
export const writePlannedExecution = writePlannedExecutionEvidence
export const planAndWriteExecution = planAndWriteExecutionEvidence
export const verify = verifyReleaseConfig
export const planAndVerify = planAndVerifyReleaseConfig
export const writePlannedVerification = writePlannedVerificationEvidence
export const planAndWriteVerification = planAndWriteVerificationEvidence
export const run = runReleaseConfig
export const planAndRun = planAndRunReleaseConfig
export const writePlannedRun = writePlannedRunWorkflowEvidence
export const planAndWriteRun = planAndWriteRunWorkflowEvidence
export const status = statusReleaseConfig
export const planAndStatus = planAndStatusReleaseConfig
export const renderStatusReport = renderReleaseStatusReport
export const renderStatus = renderReleaseStatus
export const resume = resumeReleaseConfig
export const planAndResume = planAndResumeReleaseConfig
export const writePlannedResume = writePlannedResumeWorkflowEvidence
export const planAndWriteResume = planAndWriteResumeWorkflowEvidence
export const reconcile = reconcileReleaseConfig
export const planAndReconcile = planAndReconcileReleaseConfig
export const writePlannedReconcile = writePlannedReconciliationEvidence
export const planAndWriteReconcile = planAndWriteReconciliationEvidence
export const checkEligibility = checkReleaseConfigEligibility
export const checkIntent = checkReleaseConfigIntent
export const renderEligibilityDecision = renderReleaseEligibilityDecision
