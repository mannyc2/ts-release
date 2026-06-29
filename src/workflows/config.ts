import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { StagedArtifactRecipeResult } from "../artifacts/adapter.js"
import { stageAllArtifactRecipes } from "../artifacts/registry.js"
import { ConfigReadError } from "../config/errors.js"
import { parseReleaseIntent } from "../config/load.js"
import { DEFAULT_CONFIG_PATH } from "../config/schema.js"
import { EvidenceBundle } from "../domain/evidence.js"
import { ExecutionApproval, OperationId } from "../domain/operation.js"
import { ReleaseIdentity, ReleasePlan } from "../domain/release.js"
import { createReleasePlan } from "../planner/create-release-plan.js"
import {
  executePlan,
  renderPlan as renderOperationPlan,
  runApprovedReleaseWorkflow,
  validatePlan,
  verifyPlan
} from "../planner/executor.js"
import { resolveReleaseIdentitySource } from "../planner/normalize-release.js"
import {
  renderPlanJson,
  renderPlanMarkdown,
  renderPlanOperationExplanation,
  renderPlanSummary,
  renderPlanText
} from "../planner/render-plan.js"
import {
  reconcileReleasePlan,
  ReleaseReconcileOptions
} from "../planner/reconcile.js"
import {
  releaseConfigFields,
  releaseExecuteField,
  releaseExecutionFields,
  releaseFormatField
} from "./options.js"
import {
  writeNamedEvidenceWithFailure,
  writeWorkflowEvidenceWithFailure
} from "./evidence.js"

export type * from "../types/effect-internal.js"

export const ReleasePlanFormat = Schema.Literals(["json", "text", "summary", "markdown"])
export type ReleasePlanFormat = typeof ReleasePlanFormat.Type

export const ReleaseConfigValidationFormat = Schema.Literals(["json", "text"])
export type ReleaseConfigValidationFormat = typeof ReleaseConfigValidationFormat.Type

export const StageArtifactsFormat = Schema.Literals(["json", "text"])
export type StageArtifactsFormat = typeof StageArtifactsFormat.Type

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

export class StageArtifactsConfigOptions extends Schema.Class<StageArtifactsConfigOptions>(
  "StageArtifactsConfigOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(StageArtifactsFormat)
}) {}

export interface StageArtifactsConfigInput extends ReleaseConfigInput {
  readonly format?: StageArtifactsFormat | undefined
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
  operationId: OperationId
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

export class PlannedReleaseConfigPlanResult extends Schema.Class<PlannedReleaseConfigPlanResult>(
  "PlannedReleaseConfigPlanResult"
)({
  plan: ReleasePlan,
  contents: Schema.String
}) {}

export class StagedReleaseArtifactsResult extends Schema.Class<StagedReleaseArtifactsResult>(
  "StagedReleaseArtifactsResult"
)({
  schemaVersion: Schema.Literal("artifact-stage/v1"),
  identity: ReleaseIdentity,
  configPath: Schema.String,
  recipes: Schema.Array(StagedArtifactRecipeResult),
  plan: ReleasePlan
}) {}

export class PlannedReleaseConfigEvidenceResult extends Schema.Class<PlannedReleaseConfigEvidenceResult>(
  "PlannedReleaseConfigEvidenceResult"
)({
  plan: ReleasePlan,
  evidence: EvidenceBundle
}) {}

export class PlannedReleaseConfigWrittenEvidenceResult extends Schema.Class<PlannedReleaseConfigWrittenEvidenceResult>(
  "PlannedReleaseConfigWrittenEvidenceResult"
)({
  plan: ReleasePlan,
  evidence: EvidenceBundle
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

const stageArtifactsConfigOptionsFromInput = (
  input: StageArtifactsConfigInput = {}
): StageArtifactsConfigOptions =>
  StageArtifactsConfigOptions.make({
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

const releaseReconcileConfigOptionsFromInput = (
  input: ReleaseReconcileConfigInput = {}
): ReleaseReconcileConfigOptions =>
  ReleaseReconcileConfigOptions.make({
    ...releaseConfigFields(input),
    ...releaseExecuteField(input)
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

export const renderStagedArtifactsJson = (result: StagedReleaseArtifactsResult): string =>
  `${JSON.stringify(result, null, 2)}\n`

export const renderStagedArtifactsText = (result: StagedReleaseArtifactsResult): string => {
  const artifacts = result.recipes.flatMap((recipe) => recipe.artifacts)
  const lines = [
    `staged artifact recipes: ${result.recipes.length}`,
    "artifacts:"
  ]
  if (artifacts.length === 0) {
    lines.push("  none")
  } else {
    for (const artifact of artifacts) {
      lines.push(`  ${artifact.id} ${artifact.path}`)
    }
  }
  return `${lines.join("\n")}\n`
}

export const renderStagedArtifacts = (
  result: StagedReleaseArtifactsResult,
  format: StageArtifactsFormat = "text"
): string =>
  format === "json"
    ? renderStagedArtifactsJson(result)
    : renderStagedArtifactsText(result)

export const stageReleaseConfigArtifacts = Effect.fn("workflows.config.stageReleaseConfigArtifacts")(function*(
  input: StageArtifactsConfigInput = {}
) {
  const options = stageArtifactsConfigOptionsFromInput(input)
  const path = yield* Path.Path
  const pathName = configPath(options)
  const root = configRoot(path, options)
  const contents = yield* readReleaseConfig(options)
  const intent = yield* parseReleaseIntent(contents, pathName)
  const identity = yield* resolveReleaseIdentitySource(intent.identity, root)
  const recipes = intent.artifactRecipes ?? []
  const staged = recipes.length === 0
    ? []
    : yield* stageAllArtifactRecipes(recipes, {
      root,
      identity,
      configPath: pathName
    })
  const plan = yield* createReleasePlan(intent, root, pathName)
  return StagedReleaseArtifactsResult.make({
    schemaVersion: "artifact-stage/v1",
    identity,
    configPath: pathName,
    recipes: staged,
    plan
  })
})

export const renderStageReleaseConfigArtifacts = Effect.fn(
  "workflows.config.renderStageReleaseConfigArtifacts"
)(function*(
  input: StageArtifactsConfigInput = {}
) {
  const options = stageArtifactsConfigOptionsFromInput(input)
  const result = yield* stageReleaseConfigArtifacts(options)
  return renderStagedArtifacts(result, options.format ?? "text")
})

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
  return PlannedReleaseConfigEvidenceResult.make({ plan, evidence })
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
  const evidence = yield* writePlannedRunWorkflowEvidence(plan, options)
  return PlannedReleaseConfigWrittenEvidenceResult.make({ plan, evidence })
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

export const plan = planReleaseConfig
export const renderPlan = renderReleaseConfigPlan
export const renderPlannedPlan = renderPlannedReleaseConfigPlan
export const stageArtifacts = stageReleaseConfigArtifacts
export const renderStageArtifacts = renderStageReleaseConfigArtifacts
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
export const reconcile = reconcileReleaseConfig
export const planAndReconcile = planAndReconcileReleaseConfig
export const writePlannedReconcile = writePlannedReconciliationEvidence
export const planAndWriteReconcile = planAndWriteReconciliationEvidence
