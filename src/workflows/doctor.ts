import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { parseReleaseIntent } from "../config/load.js"
import { configPath, readReleaseConfig } from "../config/resolve.js"
import { envExists, planRelease } from "../engine/engine.js"
import type { Operation } from "../pipeline/operation.js"
import type { ReleasePlan } from "../pipeline/plan.js"


const ReleaseName = Schema.NonEmptyString
const ReleaseVersion = Schema.NonEmptyString
const TargetId = Schema.NonEmptyString

export const ReleaseDiagnosticsFormat = Schema.Literals(["json", "text", "markdown"])
export type ReleaseDiagnosticsFormat = typeof ReleaseDiagnosticsFormat.Type

export const ReleaseDiagnosticStatus = Schema.Literals(["ok", "warn", "fail", "info"])
export type ReleaseDiagnosticStatus = typeof ReleaseDiagnosticStatus.Type

export const ReleaseDiagnosticConfidence = Schema.Literals(["confirmed", "inferred", "not-checked"])
export type ReleaseDiagnosticConfidence = typeof ReleaseDiagnosticConfidence.Type

export interface DoctorReleaseInput {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
  readonly target?: string | undefined
  readonly format?: ReleaseDiagnosticsFormat | undefined
}

export class ReleaseDiagnosticCheck extends Schema.Class<ReleaseDiagnosticCheck>("ReleaseDiagnosticCheck")({
  id: Schema.NonEmptyString,
  targetId: Schema.optional(TargetId),
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

const check = (input: {
  readonly id: string
  readonly targetId?: string | undefined
  readonly status: ReleaseDiagnosticStatus
  readonly confidence: ReleaseDiagnosticConfidence
  readonly message: string
}): ReleaseDiagnosticCheck =>
  ReleaseDiagnosticCheck.make({
    id: input.id,
    targetId: input.targetId,
    status: input.status,
    confidence: input.confidence,
    message: input.message
  })

const reportForIdentity = (
  identity: Pick<ReleasePlan["identity"], "name" | "version">,
  checks: ReadonlyArray<ReleaseDiagnosticCheck>
): ReleaseDiagnosticReport =>
  ReleaseDiagnosticReport.make({
    schemaVersion: "release-diagnostics/v1",
    releaseName: identity.name,
    releaseVersion: identity.version,
    checks: [...checks]
  })

const operationTargetId = (operation: Operation): string | undefined => {
  const parts = operation.pipeId.split(":")
  const targetId = parts[1]
  return operation.pipeId.startsWith("publish:") || operation.pipeId.startsWith("catalog:")
    ? targetId
    : undefined
}

const operationsForTarget = (plan: ReleasePlan, targetId: string): ReadonlyArray<Operation> =>
  plan.operations.filter((operation) => operationTargetId(operation) === targetId)

const targetMatches = (targetId: string, filter: string | undefined): boolean =>
  filter === undefined || targetId === filter || targetId.toLowerCase().includes(filter.toLowerCase())

const targetIdsForPlan = (plan: ReleasePlan, filter: string | undefined): ReadonlyArray<string> =>
  [...new Set(plan.operations.flatMap((operation) => {
    const targetId = operationTargetId(operation)
    return targetId === undefined || !targetMatches(targetId, filter) ? [] : [targetId]
  }))].sort()

const operationEnvNames = (operation: Operation): ReadonlyArray<string> => {
  switch (operation.action._tag) {
    case "command": return operation.action.command.requiredEnv
    case "http-check": return operation.action.request.requiredEnv
    case "github-release-create":
    case "github-release-verify": return operation.action.tokenEnv === undefined ? [] : [operation.action.tokenEnv]
    default: return []
  }
}

const commandEnvNames = (operations: ReadonlyArray<Operation>): ReadonlyArray<string> =>
  [...new Set(operations.flatMap(operationEnvNames))].sort()

const commandExecutables = (operations: ReadonlyArray<Operation>): ReadonlyArray<string> =>
  [...new Set(operations.flatMap((operation) =>
    operation.action._tag === "command" ? [operation.action.command.executable] : []
  ))].sort()

const hasTrustedPublishingNote = (targetId: string, operations: ReadonlyArray<Operation>): boolean =>
  operations.some((operation) =>
    operation.id === `${targetId}:${targetId}-trusted-publishing-auth` ||
    (operation.action._tag === "note" && operation.action.message.toLowerCase().includes("trusted publishing"))
  )

const authChecksForPlan = Effect.fn("workflows.doctor.authChecksForPlan")(function*(
  plan: ReleasePlan,
  targetFilter: string | undefined
) {
  const checks: Array<ReleaseDiagnosticCheck> = []
  for (const targetId of targetIdsForPlan(plan, targetFilter)) {
    const operations = operationsForTarget(plan, targetId)
    const envNames = commandEnvNames(operations)
    for (const name of envNames) {
      const present = yield* envExists(name)
      checks.push(check({
        id: `${targetId}:env:${name}`,
        targetId,
        status: present ? "ok" : "fail",
        confidence: "confirmed",
        message: present
          ? `${targetId} requires ${name}; the variable is present.`
          : `${targetId} requires ${name}; the variable is missing.`
      }))
    }
    if (envNames.length > 0) {
      continue
    }

    if (hasTrustedPublishingNote(targetId, operations)) {
      const hasOidcUrl = yield* envExists("ACTIONS_ID_TOKEN_REQUEST_URL")
      const hasOidcToken = yield* envExists("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
      checks.push(check({
        id: `${targetId}:trusted-publishing`,
        targetId,
        status: hasOidcUrl && hasOidcToken ? "ok" : "info",
        confidence: hasOidcUrl && hasOidcToken ? "confirmed" : "inferred",
        message: hasOidcUrl && hasOidcToken
          ? `${targetId} has GitHub Actions OIDC request environment available.`
          : `${targetId} uses trusted publishing; provider setup is confirmed only inside GitHub Actions.`
      }))
      continue
    }

    const executables = commandExecutables(operations)
    checks.push(check({
      id: `${targetId}:cli-auth`,
      targetId,
      status: "info",
      confidence: "inferred",
      message: executables.length === 0
        ? `${targetId} has no command-line authentication checks in the plan.`
        : `${targetId} expects local CLI/auth readiness for: ${executables.join(", ")}.`
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
  const targetIds = targetIdsForPlan(plan, undefined)
  if (targetIds.length === 0) {
    return [
      check({
        id: "plan:operations",
        status: "info",
        confidence: "confirmed",
        message: "No release surfaces require operation checks."
      })
    ]
  }
  return targetIds.map((targetId) =>
    check({
      id: `${targetId}:operations`,
      targetId,
      status: operationsForTarget(plan, targetId).length === 0 ? "fail" : "ok",
      confidence: "confirmed",
      message: `${targetId} has grammar operations in the release plan.`
    })
  )
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

export const doctorRelease = Effect.fn("workflows.doctor.doctorRelease")(function*(
  input: DoctorReleaseInput = {}
) {
  const pathName = configPath(input)
  const validation = yield* readReleaseConfig(input).pipe(
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

  const planned = yield* planRelease(input).pipe(
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

  const authChecks = yield* authChecksForPlan(planned.plan, input.target)
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
  const lines = report.checks.map((item) =>
    `${item.status.padEnd(4)} ${item.confidence.padEnd(11)} ${item.id}: ${item.message}`
  )
  lines.unshift(`diagnostics: ${report.releaseName}@${report.releaseVersion}`)
  return `${lines.join("\n")}\n`
}

export const renderReleaseDiagnosticsMarkdown = (report: ReleaseDiagnosticReport): string => {
  const lines = [
    `# Release Diagnostics ${report.releaseName}@${report.releaseVersion}`,
    "",
    "| Status | Confidence | Check | Message |",
    "| --- | --- | --- | --- |",
    ...report.checks.map((item) =>
      `| ${item.status} | ${item.confidence} | ${item.id} | ${item.message.replaceAll("|", "\\|")} |`
    )
  ]
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
