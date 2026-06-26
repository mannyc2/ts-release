import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { parseReleaseIntent } from "../config/load.js"
import { DEFAULT_CONFIG_PATH } from "../config/schema.js"
import { Operation } from "../domain/operation.js"
import { ReleaseIdentity, ReleaseName, ReleasePlan, ReleaseVersion } from "../domain/release.js"
import { TargetConfig, TargetId, targetOrder } from "../domain/target.js"
import { resolveReleaseIdentitySource } from "../planner/normalize-release.js"
import {
  PlanReleaseConfigOptions,
  planReleaseConfig,
  ValidateReleaseConfigFileOptions,
  validateReleaseConfigFile
} from "./config.js"
import {
  releaseConfigFields,
  releaseFormatField
} from "./options.js"

export type * from "../types/effect-internal.js"

export const ReleaseDiagnosticStatus = Schema.Literals(["ok", "warn", "fail", "info"])
export type ReleaseDiagnosticStatus = typeof ReleaseDiagnosticStatus.Type

export const ReleaseDiagnosticConfidence = Schema.Literals(["confirmed", "inferred", "not-checked"])
export type ReleaseDiagnosticConfidence = typeof ReleaseDiagnosticConfidence.Type

export const ReleaseDiagnosticsFormat = Schema.Literals(["json", "text", "markdown"])
export type ReleaseDiagnosticsFormat = typeof ReleaseDiagnosticsFormat.Type

export const ReleaseCiProvider = Schema.Literals(["github-actions"])
export type ReleaseCiProvider = typeof ReleaseCiProvider.Type

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

export class ReleaseDiagnosticsOptions extends Schema.Class<ReleaseDiagnosticsOptions>("ReleaseDiagnosticsOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  target: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(ReleaseCiProvider),
  workflow: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleaseDiagnosticsFormat),
  missingCiIsNotChecked: Schema.optionalKey(Schema.Boolean)
}) {}

export interface ReleaseDiagnosticsInput {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
  readonly target?: string | undefined
  readonly provider?: ReleaseCiProvider | undefined
  readonly workflow?: string | undefined
  readonly format?: ReleaseDiagnosticsFormat | undefined
  readonly missingCiIsNotChecked?: boolean | undefined
}

const releaseDiagnosticsOptionsFromInput = (
  input: ReleaseDiagnosticsInput = {}
): ReleaseDiagnosticsOptions =>
  ReleaseDiagnosticsOptions.make({
    ...releaseConfigFields(input),
    ...(input.target === undefined ? {} : { target: input.target }),
    ...(input.provider === undefined ? {} : { provider: input.provider }),
    ...(input.workflow === undefined ? {} : { workflow: input.workflow }),
    ...releaseFormatField(input),
    ...(input.missingCiIsNotChecked === undefined ? {} : { missingCiIsNotChecked: input.missingCiIsNotChecked })
  })

const readOptionalEnv = (name: string): Effect.Effect<string | undefined> =>
  Config.string(name).pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined)
  )

const envExists = Effect.fn("diagnostics.envExists")(function*(name: string) {
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

interface ReleaseCiDiagnosticSubject {
  readonly identity: ReleaseIdentity
  readonly targets: ReadonlyArray<TargetConfig>
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

const authChecksForPlan = Effect.fn("diagnostics.authChecksForPlan")(function*(
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
          : `${target.id} uses npm trusted publishing; provider setup is confirmed only inside GitHub Actions.`
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

const basename = (pathName: string): string => {
  const parts = pathName.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? pathName
}

const workspacePath = (path: Path.Path, root: string, pathName: string): string =>
  path.isAbsolute(pathName) ? pathName : path.resolve(root, pathName)

const configRoot = (path: Path.Path, options: ReleaseDiagnosticsOptions): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

const planOptionsFromDiagnostics = (options: ReleaseDiagnosticsOptions): PlanReleaseConfigOptions =>
  PlanReleaseConfigOptions.make(releaseConfigFields(options))

const validationOptionsFromDiagnostics = (options: ReleaseDiagnosticsOptions): ValidateReleaseConfigFileOptions =>
  ValidateReleaseConfigFileOptions.make(releaseConfigFields(options))

const configPath = (options: ReleaseDiagnosticsOptions): string =>
  options.configPath ?? DEFAULT_CONFIG_PATH

const configReadPath = (path: Path.Path, options: ReleaseDiagnosticsOptions): string => {
  const pathName = configPath(options)
  return path.isAbsolute(pathName) ? pathName : path.resolve(configRoot(path, options), pathName)
}

const readReleaseCiDiagnosticSubject = Effect.fn("diagnostics.readReleaseCiDiagnosticSubject")(function*(
  options: ReleaseDiagnosticsOptions
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const pathName = configPath(options)
  const root = configRoot(path, options)
  const contents = yield* fs.readFileString(configReadPath(path, options))
  const intent = yield* parseReleaseIntent(contents, pathName)
  const identity = yield* resolveReleaseIdentitySource(intent.identity, root)
  const targets = [...intent.targets].sort(targetOrder)
  return {
    identity,
    targets
  }
})

const inferredTrustedPublishingWorkflow = (subject: ReleaseCiDiagnosticSubject): string | undefined => {
  for (const target of subject.targets) {
    if (target._tag === "NpmRegistryTarget" && target.trustedPublishing !== undefined) {
      return target.trustedPublishing.workflow
    }
  }
  return undefined
}

const defaultWorkflowPath = (subject: ReleaseCiDiagnosticSubject): string | undefined => {
  const workflow = inferredTrustedPublishingWorkflow(subject)
  return workflow === undefined ? undefined : `.github/workflows/${workflow}`
}

interface WorkflowJobBlock {
  readonly name: string
  readonly contents: string
}

const workflowJobBlocks = (contents: string): ReadonlyArray<WorkflowJobBlock> => {
  const lines = contents.split(/\r?\n/)
  const jobsStart = lines.findIndex((line) => /^jobs:\s*$/.test(line))
  if (jobsStart < 0) {
    return []
  }
  const jobs: Array<WorkflowJobBlock> = []
  for (let index = jobsStart + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    if (/^[A-Za-z0-9_-]+:\s*$/.test(line)) {
      break
    }
    const match = /^  ([A-Za-z0-9_-]+):\s*$/.exec(line)
    if (match === null) {
      continue
    }
    const name = match[1] ?? ""
    const collected: Array<string> = []
    for (let jobIndex = index; jobIndex < lines.length; jobIndex += 1) {
      const jobLine = lines[jobIndex] ?? ""
      if (jobIndex > index && (/^  [A-Za-z0-9_-]+:\s*$/.test(jobLine) || /^[A-Za-z0-9_-]+:\s*$/.test(jobLine))) {
        break
      }
      collected.push(jobLine)
    }
    jobs.push({
      name,
      contents: collected.join("\n")
    })
  }
  return jobs
}

const hasPermission = (block: string, name: string, value: string): boolean => {
  const pattern = new RegExp(`^\\s+${name}:\\s*${value}\\s*$`, "m")
  return pattern.test(block)
}

const hasUploadAlways = (block: string): boolean =>
  block.includes("actions/upload-artifact") && /^\s+if:\s*always\(\)\s*$/m.test(block)

const hasTsReleaseAction = (block: string): boolean =>
  /^\s+(?:-\s+)?uses:\s+(mannyc2\/ts-release-action@v1|\.\/apps\/ts-release-action)\s*$/m.test(block)

const hasYamlValue = (block: string, name: string, value: string): boolean => {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^\\s+${name}:\\s*["']?${escaped}["']?\\s*$`, "m").test(block)
}

const hasActionCommand = (block: string, command: string): boolean =>
  hasTsReleaseAction(block) && hasYamlValue(block, "command", command)

const hasActionTruthyInput = (block: string, name: string): boolean =>
  hasTsReleaseAction(block) && hasYamlValue(block, name, "true")

const hasCliPlanReview = (block: string): boolean =>
  (block.includes(" cli plan ") || block.includes(" release plan ") || block.includes("run cli plan ")) &&
  block.includes("--format markdown")

const hasActionPlanReview = (block: string): boolean =>
  hasActionCommand(block, "plan") && hasYamlValue(block, "format", "markdown")

const hasPlanReview = (block: string): boolean =>
  hasCliPlanReview(block) || hasActionPlanReview(block)

const jobExecutesRelease = (block: string): boolean =>
  block.includes("--execute") ||
  hasActionTruthyInput(block, "execute") ||
  hasActionCommand(block, "run") ||
  hasActionCommand(block, "reconcile")

const hasCliApprovedExecution = (block: string): boolean =>
  block.includes("run") && block.includes("--execute") && block.includes("--approve-irreversible")

const hasActionApprovedExecution = (block: string): boolean =>
  hasActionCommand(block, "run") &&
  hasActionTruthyInput(block, "execute") &&
  hasActionTruthyInput(block, "approve-irreversible")

const hasApprovedExecution = (block: string): boolean =>
  hasCliApprovedExecution(block) || hasActionApprovedExecution(block)

const hasEnvironment = (block: string): boolean =>
  /^\s+environment:\s*\S+/m.test(block)

const planReviewJobs = (jobs: ReadonlyArray<WorkflowJobBlock>): ReadonlyArray<WorkflowJobBlock> =>
  jobs.filter((job) => hasPlanReview(job.contents) && !jobExecutesRelease(job.contents))

const planExecutionCandidates = (jobs: ReadonlyArray<WorkflowJobBlock>): ReadonlyArray<WorkflowJobBlock> =>
  jobs.filter((job) => job.name === "plan" || hasPlanReview(job.contents))

const executeJobCandidates = (jobs: ReadonlyArray<WorkflowJobBlock>): ReadonlyArray<WorkflowJobBlock> =>
  jobs.filter((job) => hasApprovedExecution(job.contents))

const fallbackNamedJob = (
  jobs: ReadonlyArray<WorkflowJobBlock>,
  name: string
): WorkflowJobBlock | undefined =>
  jobs.find((job) => job.name === name)

const hasWorkflowTrustedTarget = (subject: ReleaseCiDiagnosticSubject): boolean =>
  subject.targets.some((target) => target._tag === "NpmRegistryTarget" && target.trustedPublishing !== undefined)

const hasGitHubReleaseTarget = (subject: ReleaseCiDiagnosticSubject): boolean =>
  subject.targets.some((target) => target._tag === "GitHubReleaseTarget")

const ciChecksForContents = (
  subject: ReleaseCiDiagnosticSubject,
  workflowPath: string,
  contents: string
): ReadonlyArray<ReleaseDiagnosticCheck> => {
  const checks: Array<ReleaseDiagnosticCheck> = [
    check({
      id: "ci:workflow-file",
      status: "ok",
      confidence: "confirmed",
      message: `Workflow file ${workflowPath} exists.`
    })
  ]
  const expectedWorkflow = inferredTrustedPublishingWorkflow(subject)
  if (expectedWorkflow !== undefined) {
    const matches = basename(workflowPath) === expectedWorkflow
    checks.push(check({
      id: "ci:workflow-name",
      status: matches ? "ok" : "fail",
      confidence: "confirmed",
      message: matches
        ? `Workflow filename matches trusted publishing workflow ${expectedWorkflow}.`
        : `Workflow filename ${basename(workflowPath)} does not match trusted publishing workflow ${expectedWorkflow}.`
    }))
  }

  const jobs = workflowJobBlocks(contents)
  const safePlanJobs = planReviewJobs(jobs)
  const unsafePlanJobs = planExecutionCandidates(jobs).filter((job) => jobExecutesRelease(job.contents))
  const planJob = safePlanJobs[0] ?? fallbackNamedJob(jobs, "plan")
  const executeJobs = executeJobCandidates(jobs)
  const executeJob = executeJobs[0] ?? fallbackNamedJob(jobs, "execute")
  const executeJobHasApprovedExecution = executeJob === undefined ? false : hasApprovedExecution(executeJob.contents)
  checks.push(check({
    id: "ci:plan-job",
    status: safePlanJobs.length === 0 ? "fail" : "ok",
    confidence: "confirmed",
    message: safePlanJobs.length === 0
      ? "Workflow is missing a plan review job."
      : `Workflow has a plan review job (${safePlanJobs[0]?.name ?? "unknown"}).`
  }))
  checks.push(check({
    id: "ci:plan-job-no-execute",
    status: unsafePlanJobs.length > 0 ? "fail" : "ok",
    confidence: "confirmed",
    message: unsafePlanJobs.length > 0
      ? `Plan review candidate includes release execution (${unsafePlanJobs.map((job) => job.name).join(", ")}).`
      : "Plan review jobs do not execute release operations."
  }))
  checks.push(check({
    id: "ci:plan-review",
    status: safePlanJobs.length > 0 ? "ok" : "warn",
    confidence: "confirmed",
    message: safePlanJobs.length > 0
      ? "Plan review job records a Markdown release plan."
      : "Workflow should record a Markdown release plan in a non-executing job."
  }))
  checks.push(check({
    id: "ci:plan-artifact",
    status: planJob !== undefined && hasUploadAlways(planJob.contents) ? "ok" : "warn",
    confidence: "confirmed",
    message: planJob !== undefined && hasUploadAlways(planJob.contents)
      ? "Plan review job uploads review artifacts with if: always()."
      : "Plan review job should upload review artifacts with if: always()."
  }))

  checks.push(check({
    id: "ci:execute-job",
    status: executeJobHasApprovedExecution ? "ok" : "fail",
    confidence: "confirmed",
    message: executeJobHasApprovedExecution
      ? `Workflow has an approved execute job (${executeJob?.name ?? "unknown"}).`
      : "Workflow is missing a job that runs approved release execution."
  }))
  if (executeJob !== undefined) {
    checks.push(check({
      id: "ci:execute-environment",
      status: hasEnvironment(executeJob.contents) ? "ok" : "fail",
      confidence: "confirmed",
      message: hasEnvironment(executeJob.contents)
        ? "Execute job is protected by a GitHub environment."
        : "Execute job must configure a GitHub environment."
    }))
    if (hasWorkflowTrustedTarget(subject)) {
      checks.push(check({
        id: "ci:execute-id-token",
        status: hasPermission(executeJob.contents, "id-token", "write") ? "ok" : "fail",
        confidence: "confirmed",
        message: hasPermission(executeJob.contents, "id-token", "write")
          ? "Execute job grants id-token: write for trusted publishing."
          : "Execute job must grant id-token: write for trusted publishing."
      }))
    }
    if (hasGitHubReleaseTarget(subject)) {
      checks.push(check({
        id: "ci:execute-contents",
        status: hasPermission(executeJob.contents, "contents", "write") ? "ok" : "fail",
        confidence: "confirmed",
        message: hasPermission(executeJob.contents, "contents", "write")
          ? "Execute job grants contents: write for GitHub Releases."
          : "Execute job must grant contents: write for GitHub Releases."
      }))
    }
    checks.push(check({
      id: "ci:execute-approval",
      status: executeJobHasApprovedExecution ? "ok" : "fail",
      confidence: "confirmed",
      message: executeJobHasApprovedExecution
        ? "Execute job runs approved release execution."
        : "Execute job must run release execution with execute and irreversible approval."
    }))
    checks.push(check({
      id: "ci:execute-evidence",
      status: hasUploadAlways(executeJob.contents) ? "ok" : "warn",
      confidence: "confirmed",
      message: hasUploadAlways(executeJob.contents)
        ? "Execute job uploads evidence with if: always()."
        : "Execute job should upload evidence with if: always()."
    }))
  }

  return checks
}

const readWorkflowChecks = Effect.fn("diagnostics.readWorkflowChecks")(function*(
  subject: ReleaseCiDiagnosticSubject,
  options: ReleaseDiagnosticsOptions
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = configRoot(path, options)
  const workflowPath = options.workflow ?? defaultWorkflowPath(subject) ?? ".github/workflows/release.yml"
  const absolutePath = workspacePath(path, root, workflowPath)
  const exists = yield* fs.exists(absolutePath)
  if (!exists) {
    return [
      check({
        id: "ci:workflow-file",
        status: options.missingCiIsNotChecked === true ? "info" : "fail",
        confidence: "not-checked",
        message: options.missingCiIsNotChecked === true
          ? `Workflow file ${workflowPath} was not found; CI was not checked.`
          : `Workflow file ${workflowPath} was not found.`
      })
    ]
  }
  const contents = yield* fs.readFileString(absolutePath)
  return ciChecksForContents(subject, workflowPath, contents)
})

export const checkAuthReleaseConfig = Effect.fn("diagnostics.checkAuthReleaseConfig")(function*(
  input: ReleaseDiagnosticsInput = {}
) {
  const options = releaseDiagnosticsOptionsFromInput(input)
  const plan = yield* planReleaseConfig(planOptionsFromDiagnostics(options))
  const checks = yield* authChecksForPlan(plan, options.target)
  return reportForIdentity(plan.identity, checks)
})

export const checkCiReleaseConfig = Effect.fn("diagnostics.checkCiReleaseConfig")(function*(
  input: ReleaseDiagnosticsInput = {}
) {
  const options = releaseDiagnosticsOptionsFromInput(input)
  const subject = yield* readReleaseCiDiagnosticSubject(options)
  const checks = yield* readWorkflowChecks(subject, options)
  return reportForIdentity(subject.identity, checks)
})

export const doctorReleaseConfig = Effect.fn("diagnostics.doctorReleaseConfig")(function*(
  input: ReleaseDiagnosticsInput = {}
) {
  const options = releaseDiagnosticsOptionsFromInput(input)
  const validation = yield* validateReleaseConfigFile(validationOptionsFromDiagnostics(options)).pipe(
    Effect.match({
      onFailure: (error) => check({
        id: "config:validation",
        status: "fail",
        confidence: "confirmed",
        message: `Config validation failed: ${error.message}`
      }),
      onSuccess: (result) => check({
        id: "config:validation",
        status: "ok",
        confidence: "confirmed",
        message: `Config ${result.path} is valid.`
      })
    })
  )

  const planned = yield* planReleaseConfig(planOptionsFromDiagnostics(options)).pipe(
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
  const workflow = options.workflow ?? defaultWorkflowPath(planned.plan)
  const ciChecks = yield* readWorkflowChecks(
    planned.plan,
    ReleaseDiagnosticsOptions.make({
      ...releaseConfigFields(options),
      ...(workflow === undefined ? {} : { workflow }),
      missingCiIsNotChecked: true
    })
  )
  return reportForIdentity(planned.plan.identity, [
    validation,
    check({
      id: "plan:construction",
      status: "ok",
      confidence: "confirmed",
      message: "Release plan can be constructed."
    }),
    ...authChecks,
    ...ciChecks
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

export const checkAuth = checkAuthReleaseConfig
export const checkCi = checkCiReleaseConfig
export const doctor = doctorReleaseConfig
export const render = renderReleaseDiagnostics
