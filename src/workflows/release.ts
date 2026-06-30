import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { StagedArtifactRecipeResult } from "../artifacts/adapter.js"
import { stageAllArtifactRecipes } from "../artifacts/registry.js"
import { ConfigReadError } from "../config/errors.js"
import { parseReleaseIntent } from "../config/load.js"
import { DEFAULT_CONFIG_PATH } from "../config/schema.js"
import { EvidenceBundle } from "../domain/evidence.js"
import { ExecutionApproval, Operation } from "../domain/operation.js"
import { ReleaseIdentity, ReleaseName, ReleasePlan, ReleaseVersion } from "../domain/release.js"
import { TargetConfig, TargetId } from "../domain/target.js"
import { createReleasePlan } from "../planner/create-release-plan.js"
import { writeEvidenceBundle } from "../planner/evidence-recorder.js"
import {
  renderPlan,
  runApprovedReleaseWorkflow,
  verifyPlan
} from "../planner/executor.js"
import { EvidenceWriteError, OperationFailedError } from "../planner/errors.js"
import { resolveReleaseBuild } from "../planner/normalize-release.js"
import {
  renderPlanJson,
  renderPlanMarkdown,
  renderPlanSummary,
  renderPlanText
} from "../planner/render-plan.js"
import {
  releaseConfigFields,
  releaseExecutionFields,
  releaseFormatField
} from "./options.js"

export type * from "../types/effect-internal.js"

export const ReleasePlanFormat = Schema.Literals(["json", "text", "summary", "markdown"])
export type ReleasePlanFormat = typeof ReleasePlanFormat.Type

export const StageArtifactsFormat = Schema.Literals(["json", "text"])
export type StageArtifactsFormat = typeof StageArtifactsFormat.Type

export const ReleaseDiagnosticsFormat = Schema.Literals(["json", "text", "markdown"])
export type ReleaseDiagnosticsFormat = typeof ReleaseDiagnosticsFormat.Type

export const ReleaseDiagnosticStatus = Schema.Literals(["ok", "warn", "fail", "info"])
export type ReleaseDiagnosticStatus = typeof ReleaseDiagnosticStatus.Type

export const ReleaseDiagnosticConfidence = Schema.Literals(["confirmed", "inferred", "not-checked"])
export type ReleaseDiagnosticConfidence = typeof ReleaseDiagnosticConfidence.Type

export class ReleaseSourceOptions extends Schema.Class<ReleaseSourceOptions>("ReleaseSourceOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String)
}) {}

export interface ReleaseSourceInput {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
}

export class PlanReleaseOptions extends Schema.Class<PlanReleaseOptions>("PlanReleaseOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleasePlanFormat)
}) {}

export interface PlanReleaseInput extends ReleaseSourceInput {
  readonly format?: ReleasePlanFormat | undefined
}

export class BuildReleaseArtifactsOptions extends Schema.Class<BuildReleaseArtifactsOptions>(
  "BuildReleaseArtifactsOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(StageArtifactsFormat)
}) {}

export interface BuildReleaseArtifactsInput extends ReleaseSourceInput {
  readonly format?: StageArtifactsFormat | undefined
}

export class ReleaseExecutionOptions extends Schema.Class<ReleaseExecutionOptions>("ReleaseExecutionOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean),
  approveIrreversible: Schema.optionalKey(Schema.Boolean)
}) {}

export interface ReleaseExecutionInput extends ReleaseSourceInput {
  readonly execute?: boolean | undefined
  readonly approveIrreversible?: boolean | undefined
}

export class DoctorReleaseOptions extends Schema.Class<DoctorReleaseOptions>("DoctorReleaseOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  target: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleaseDiagnosticsFormat)
}) {}

export interface DoctorReleaseInput extends ReleaseSourceInput {
  readonly target?: string | undefined
  readonly format?: ReleaseDiagnosticsFormat | undefined
}

export class ReleaseDiagnosticCheck extends Schema.Class<ReleaseDiagnosticCheck>("ReleaseDiagnosticCheck")({
  id: Schema.NonEmptyString,
  targetId: Schema.optionalKey(TargetId),
  status: ReleaseDiagnosticStatus,
  confidence: ReleaseDiagnosticConfidence,
  message: Schema.String
}) {}

export class ReleaseDiagnosticReport extends Schema.Class<ReleaseDiagnosticReport>("ReleaseDiagnosticReport")({
  schemaVersion: Schema.Literal("release-diagnostics/v1"),
  releaseName: ReleaseName,
  releaseVersion: ReleaseVersion,
  checks: Schema.Array(ReleaseDiagnosticCheck)
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

export class ReleaseEvidenceResult extends Schema.Class<ReleaseEvidenceResult>("ReleaseEvidenceResult")({
  plan: ReleasePlan,
  evidence: EvidenceBundle
}) {}

const sourceOptionsFromInput = (input: ReleaseSourceInput = {}): ReleaseSourceOptions =>
  ReleaseSourceOptions.make(releaseConfigFields(input))

const planOptionsFromInput = (input: PlanReleaseInput = {}): PlanReleaseOptions =>
  PlanReleaseOptions.make({
    ...releaseConfigFields(input),
    ...releaseFormatField(input)
  })

const buildOptionsFromInput = (input: BuildReleaseArtifactsInput = {}): BuildReleaseArtifactsOptions =>
  BuildReleaseArtifactsOptions.make({
    ...releaseConfigFields(input),
    ...releaseFormatField(input)
  })

const executionOptionsFromInput = (input: ReleaseExecutionInput = {}): ReleaseExecutionOptions =>
  ReleaseExecutionOptions.make(releaseExecutionFields(input))

const doctorOptionsFromInput = (input: DoctorReleaseInput = {}): DoctorReleaseOptions =>
  DoctorReleaseOptions.make({
    ...releaseConfigFields(input),
    ...(input.target === undefined ? {} : { target: input.target }),
    ...releaseFormatField(input)
  })

const configPath = (options: ReleaseSourceOptions): string =>
  options.configPath ?? DEFAULT_CONFIG_PATH

const configRoot = (path: Path.Path, options: ReleaseSourceOptions): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

const configReadPath = (path: Path.Path, options: ReleaseSourceOptions): string => {
  const pathName = configPath(options)
  return path.isAbsolute(pathName) ? pathName : path.resolve(configRoot(path, options), pathName)
}

const approvalFromOptions = (options: ReleaseExecutionOptions): ExecutionApproval =>
  ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: options.approveIrreversible ?? false
  })

const readReleaseConfig = Effect.fn("workflows.release.readReleaseConfig")(function*(options: ReleaseSourceOptions) {
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

export const planRelease = Effect.fn("workflows.release.planRelease")(function*(input: PlanReleaseInput = {}) {
  const options = planOptionsFromInput(input)
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

export const buildReleaseArtifacts = Effect.fn("workflows.release.buildReleaseArtifacts")(function*(
  input: BuildReleaseArtifactsInput = {}
) {
  const options = buildOptionsFromInput(input)
  const path = yield* Path.Path
  const pathName = configPath(options)
  const root = configRoot(path, options)
  const contents = yield* readReleaseConfig(options)
  const intent = yield* parseReleaseIntent(contents, pathName)
  const build = yield* resolveReleaseBuild(intent, root)
  const recipes = build.artifactRecipes
  const staged = recipes.length === 0
    ? []
    : yield* stageAllArtifactRecipes(recipes, {
      root,
      identity: build.identity,
      configPath: pathName
    })
  const plan = yield* createReleasePlan(intent, root, pathName)
  return StagedReleaseArtifactsResult.make({
    schemaVersion: "artifact-stage/v1",
    identity: build.identity,
    configPath: pathName,
    recipes: staged,
    plan
  })
})

export const renderBuildArtifactsJson = (result: StagedReleaseArtifactsResult): string =>
  `${JSON.stringify(result, null, 2)}\n`

export const renderBuildArtifactsText = (result: StagedReleaseArtifactsResult): string => {
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

export const renderBuildArtifacts = (
  result: StagedReleaseArtifactsResult,
  format: StageArtifactsFormat = "text"
): string =>
  format === "json"
    ? renderBuildArtifactsJson(result)
    : renderBuildArtifactsText(result)

const releaseEvidencePath = (plan: ReleasePlan, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

const releaseWorkflowEvidencePath = (plan: ReleasePlan): string =>
  releaseEvidencePath(plan, "evidence")

const writeNamedEvidence = Effect.fn("workflows.release.writeNamedEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  evidence: EvidenceBundle
) {
  const path = releaseEvidencePath(plan, name)
  yield* writeEvidenceBundle(path, evidence, plan.source.root)
  return path
})

const writeWorkflowEvidence = Effect.fn("workflows.release.writeWorkflowEvidence")(function*(
  plan: ReleasePlan,
  evidence: EvidenceBundle
) {
  const path = releaseWorkflowEvidencePath(plan)
  yield* writeEvidenceBundle(path, evidence, plan.source.root)
  return path
})

const isOperationFailedError = (error: unknown): error is OperationFailedError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "OperationFailedError"

const writeNamedEvidenceWithFailure = <E, R>(
  plan: ReleasePlan,
  name: string,
  effect: Effect.Effect<EvidenceBundle, E | OperationFailedError, R>
): Effect.Effect<EvidenceBundle, E | OperationFailedError | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> =>
  effect.pipe(
    Effect.catchIf(isOperationFailedError, (error) =>
      Effect.gen(function*() {
        if (error.evidence !== undefined) {
          yield* writeNamedEvidence(plan, name, error.evidence)
        }
        return yield* Effect.fail(error)
      })
    ),
    Effect.flatMap((evidence) =>
      writeNamedEvidence(plan, name, evidence).pipe(
        Effect.map(() => evidence)
      )
    )
  )

const writeWorkflowEvidenceWithFailure = <E, R>(
  plan: ReleasePlan,
  effect: Effect.Effect<EvidenceBundle, E | OperationFailedError, R>
): Effect.Effect<EvidenceBundle, E | OperationFailedError | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> =>
  effect.pipe(
    Effect.catchIf(isOperationFailedError, (error) =>
      Effect.gen(function*() {
        if (error.evidence !== undefined) {
          yield* writeWorkflowEvidence(plan, error.evidence)
        }
        return yield* Effect.fail(error)
      })
    ),
    Effect.flatMap((evidence) =>
      writeWorkflowEvidence(plan, evidence).pipe(
        Effect.map(() => evidence)
      )
    )
  )

export const writeVerificationEvidence = Effect.fn("workflows.release.writeVerificationEvidence")(function*(
  plan: ReleasePlan
) {
  return yield* writeNamedEvidenceWithFailure(plan, "verification", verifyPlan(plan))
})

export const writeRenderEvidence = Effect.fn("workflows.release.writeRenderEvidence")(function*(
  plan: ReleasePlan,
  input: ReleaseExecutionInput = {}
) {
  const options = executionOptionsFromInput(input)
  const approval = ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: false
  })
  return yield* writeNamedEvidenceWithFailure(plan, "render", renderPlan(plan, approval))
})

export const writeReleaseEvidence = Effect.fn("workflows.release.writeReleaseEvidence")(function*(
  plan: ReleasePlan,
  input: ReleaseExecutionInput = {}
) {
  const options = executionOptionsFromInput(input)
  return yield* writeWorkflowEvidenceWithFailure(
    plan,
    runApprovedReleaseWorkflow(plan, approvalFromOptions(options))
  )
})

export const verifyRelease = Effect.fn("workflows.release.verifyRelease")(function*(
  input: ReleaseSourceInput = {}
) {
  const options = sourceOptionsFromInput(input)
  const plan = yield* planRelease(options)
  const evidence = yield* writeVerificationEvidence(plan)
  return ReleaseEvidenceResult.make({ plan, evidence })
})

export const renderReleaseFiles = Effect.fn("workflows.release.renderReleaseFiles")(function*(
  input: ReleaseExecutionInput = {}
) {
  const options = executionOptionsFromInput(input)
  const plan = yield* planRelease(options)
  const evidence = yield* writeRenderEvidence(plan, options)
  return ReleaseEvidenceResult.make({ plan, evidence })
})

export const runApprovedRelease = Effect.fn("workflows.release.runApprovedRelease")(function*(
  input: ReleaseExecutionInput = {}
) {
  const options = executionOptionsFromInput(input)
  const plan = yield* planRelease(options)
  const evidence = yield* writeReleaseEvidence(plan, options)
  return ReleaseEvidenceResult.make({ plan, evidence })
})

const readOptionalEnv = (name: string): Effect.Effect<string | undefined> =>
  Config.string(name).pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined)
  )

const envExists = Effect.fn("workflows.release.envExists")(function*(name: string) {
  const value = yield* readOptionalEnv(name)
  return value !== undefined
})

const check = (input: {
  readonly id: string
  readonly targetId?: string | undefined
  readonly status: ReleaseDiagnosticStatus
  readonly confidence: ReleaseDiagnosticConfidence
  readonly message: string
}): ReleaseDiagnosticCheck =>
  ReleaseDiagnosticCheck.make({
    id: input.id,
    ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
    status: input.status,
    confidence: input.confidence,
    message: input.message
  })

const reportForIdentity = (
  identity: Pick<ReleaseIdentity, "name" | "version">,
  checks: ReadonlyArray<ReleaseDiagnosticCheck>
): ReleaseDiagnosticReport =>
  ReleaseDiagnosticReport.make({
    schemaVersion: "release-diagnostics/v1",
    releaseName: identity.name,
    releaseVersion: identity.version,
    checks: [...checks]
  })

const targetMatches = (target: TargetConfig, filter: string | undefined): boolean =>
  filter === undefined ||
  target.id === filter ||
  target._tag.toLowerCase().includes(filter.toLowerCase())

const operationsForTarget = (plan: ReleasePlan, targetId: string): ReadonlyArray<Operation> =>
  plan.operations.filter((operation) => operation.targetId === targetId)

const commandEnvNames = (operations: ReadonlyArray<Operation>): ReadonlyArray<string> => {
  const names = new Set<string>()
  for (const operation of operations) {
    if ("command" in operation) {
      for (const name of operation.command.requiredEnv) {
        names.add(name)
      }
    }
    if (operation._tag === "VerifyHttpOperation") {
      for (const name of operation.request.requiredEnv) {
        names.add(name)
      }
    }
    if (
      (operation._tag === "PublishGitHubReleaseOperation" || operation._tag === "VerifyGitHubReleaseOperation") &&
      operation.tokenEnv !== undefined
    ) {
      names.add(operation.tokenEnv)
    }
  }
  return [...names].sort()
}

const commandExecutables = (operations: ReadonlyArray<Operation>): ReadonlyArray<string> => {
  const names = new Set<string>()
  for (const operation of operations) {
    if ("command" in operation) {
      names.add(operation.command.executable)
    }
  }
  return [...names].sort()
}

const authChecksForPlan = Effect.fn("workflows.release.authChecksForPlan")(function*(
  plan: ReleasePlan,
  targetFilter: string | undefined
) {
  const checks: Array<ReleaseDiagnosticCheck> = []
  for (const target of plan.targets.filter((candidate) => targetMatches(candidate, targetFilter))) {
    const capability = plan.targetCapabilities.find((candidate) => candidate.targetId === target.id)
    const operations = operationsForTarget(plan, target.id)
    if (capability?.authRequirement === "env-token") {
      for (const name of commandEnvNames(operations)) {
        const present = yield* envExists(name)
        checks.push(check({
          id: `${target.id}:env:${name}`,
          targetId: target.id,
          status: present ? "ok" : "fail",
          confidence: "confirmed",
          message: present
            ? `${target.id} requires ${name}; the variable is present.`
            : `${target.id} requires ${name}; the variable is missing.`
        }))
      }
      continue
    }

    if (capability?.authRequirement === "trusted-publishing") {
      const hasOidcUrl = yield* envExists("ACTIONS_ID_TOKEN_REQUEST_URL")
      const hasOidcToken = yield* envExists("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
      checks.push(check({
        id: `${target.id}:trusted-publishing`,
        targetId: target.id,
        status: hasOidcUrl && hasOidcToken ? "ok" : "info",
        confidence: hasOidcUrl && hasOidcToken ? "confirmed" : "inferred",
        message: hasOidcUrl && hasOidcToken
          ? `${target.id} has GitHub Actions OIDC request environment available.`
          : `${target.id} uses trusted publishing; provider setup is confirmed only inside GitHub Actions.`
      }))
      if (capability.authSetup !== undefined) {
        checks.push(check({
          id: `${target.id}:trusted-publishing-setup`,
          targetId: target.id,
          status: "info",
          confidence: "inferred",
          message:
            `${target.id} expects workflow ${capability.authSetup.workflow}, ` +
            `permissions ${capability.authSetup.requiredPermissions.map((permission) => `${permission.name}: ${permission.value}`).join(", ")}, ` +
            `and prerequisites ${capability.authSetup.prerequisites.join(", ")}.`
        }))
      }
      continue
    }

    const executables = commandExecutables(operations)
    checks.push(check({
      id: `${target.id}:cli-auth`,
      targetId: target.id,
      status: "info",
      confidence: "inferred",
      message: executables.length === 0
        ? `${target.id} has no command-line authentication checks in the plan.`
        : `${target.id} expects local CLI/auth readiness for: ${executables.join(", ")}.`
    }))
  }
  if (checks.length === 0) {
    checks.push(check({
      id: "auth:no-targets",
      status: "info",
      confidence: "not-checked",
      message: targetFilter === undefined
        ? "No release targets were found."
        : `No release target matched ${targetFilter}.`
    }))
  }
  return checks
})

const capabilityChecksForPlan = (plan: ReleasePlan): ReadonlyArray<ReleaseDiagnosticCheck> => {
  if (plan.targets.length === 0) {
    return [
      check({
        id: "plan:target-capabilities",
        status: "info",
        confidence: "confirmed",
        message: "No release targets require capability checks."
      })
    ]
  }
  const checks: Array<ReleaseDiagnosticCheck> = []
  for (const target of plan.targets) {
    const capability = plan.targetCapabilities.find((candidate) => candidate.targetId === target.id)
    checks.push(check({
      id: `${target.id}:capabilities`,
      targetId: target.id,
      status: capability === undefined ? "fail" : "ok",
      confidence: "confirmed",
      message: capability === undefined
        ? `${target.id} is missing target capabilities.`
        : `${target.id} capabilities are present.`
    }))
  }
  return checks
}

type PlannedRelease =
  | {
    readonly _tag: "Failed"
    readonly message: string
  }
  | {
    readonly _tag: "Ok"
    readonly plan: ReleasePlan
  }

const plannedFailure = (message: string): PlannedRelease => ({
  _tag: "Failed",
  message
})

const plannedSuccess = (plan: ReleasePlan): PlannedRelease => ({
  _tag: "Ok",
  plan
})

export const doctorRelease = Effect.fn("workflows.release.doctorRelease")(function*(
  input: DoctorReleaseInput = {}
) {
  const options = doctorOptionsFromInput(input)
  const sourceOptions = sourceOptionsFromInput(options)
  const pathName = configPath(sourceOptions)
  const validation = yield* readReleaseConfig(sourceOptions).pipe(
    Effect.flatMap((contents) => parseReleaseIntent(contents, pathName)),
    Effect.match({
      onFailure: (error) => check({
        id: "config:validation",
        status: "fail",
        confidence: "confirmed",
        message: `Config validation failed: ${error.message}`
      }),
      onSuccess: () => check({
        id: "config:validation",
        status: "ok",
        confidence: "confirmed",
        message: `Config ${pathName} is valid.`
      })
    })
  )

  const planned = yield* planRelease(options).pipe(
    Effect.match({
      onFailure: (error) => plannedFailure(error.message),
      onSuccess: plannedSuccess
    })
  )

  if (planned._tag === "Failed") {
    return ReleaseDiagnosticReport.make({
      schemaVersion: "release-diagnostics/v1",
      releaseName: "unknown",
      releaseVersion: "unknown",
      checks: [
        validation,
        check({
          id: "plan:construction",
          status: "fail",
          confidence: "confirmed",
          message: `Plan construction failed: ${planned.message}`
        })
      ]
    })
  }

  const authChecks = yield* authChecksForPlan(planned.plan, options.target)
  return reportForIdentity(planned.plan.identity, [
    validation,
    check({
      id: "plan:construction",
      status: "ok",
      confidence: "confirmed",
      message: "Release plan can be constructed."
    }),
    ...capabilityChecksForPlan(planned.plan),
    check({
      id: "evidence:directory",
      status: "ok",
      confidence: "confirmed",
      message: `Evidence directory ${planned.plan.evidenceDirectory} is valid.`
    }),
    ...authChecks
  ])
})

export const renderReleaseDiagnosticsJson = (report: ReleaseDiagnosticReport): string =>
  `${JSON.stringify(report, null, 2)}\n`

export const renderReleaseDiagnosticsText = (report: ReleaseDiagnosticReport): string => {
  const lines: Array<string> = [
    `diagnostics: ${report.releaseName}@${report.releaseVersion}`
  ]
  for (const item of report.checks) {
    lines.push(`${item.status.padEnd(4)} ${item.confidence.padEnd(11)} ${item.id}: ${item.message}`)
  }
  return `${lines.join("\n")}\n`
}

export const renderReleaseDiagnosticsMarkdown = (report: ReleaseDiagnosticReport): string => {
  const lines: Array<string> = [
    `# Release Diagnostics ${report.releaseName}@${report.releaseVersion}`,
    "",
    "| Status | Confidence | Check | Message |",
    "| --- | --- | --- | --- |"
  ]
  for (const item of report.checks) {
    lines.push(`| ${item.status} | ${item.confidence} | ${item.id} | ${item.message.replaceAll("|", "\\|")} |`)
  }
  return `${lines.join("\n")}\n`
}

export const renderReleaseDiagnostics = (
  report: ReleaseDiagnosticReport,
  format: ReleaseDiagnosticsFormat = "text"
): string => {
  switch (format) {
    case "json":
      return renderReleaseDiagnosticsJson(report)
    case "markdown":
      return renderReleaseDiagnosticsMarkdown(report)
    case "text":
      return renderReleaseDiagnosticsText(report)
  }
}
