// Invariant: diagnostics derive from the same decoded plan and declared capabilities without executing publish operations.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  operationRequirements,
  operationSurfaceId,
  trustedPublishingAuthEnvNames,
  type Operation
} from "../grammar/operation.js"
import { readOptionalEnv } from "../host/platform.js"


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
}

export class ReleaseDiagnosticCheck extends Schema.Class<ReleaseDiagnosticCheck>("ReleaseDiagnosticCheck")({
  id: Schema.NonEmptyString,
  targetId: Schema.optional(Schema.NonEmptyString),
  status: ReleaseDiagnosticStatus,
  confidence: ReleaseDiagnosticConfidence,
  message: Schema.String
}) {}

export class ReleaseDiagnosticReport extends Schema.Class<ReleaseDiagnosticReport>("ReleaseDiagnosticReport")({
  schemaVersion: Schema.Literal("release-diagnostics/v1"),
  releaseName: Schema.NonEmptyString,
  releaseVersion: Schema.NonEmptyString,
  checks: Schema.Array(ReleaseDiagnosticCheck)
}) {}

const check = (input: Parameters<typeof ReleaseDiagnosticCheck.make>[0]) => ReleaseDiagnosticCheck.make(input)

interface SurfaceNeeds {
  readonly targetId: string
  readonly envNames: ReadonlyArray<string>
  readonly executables: ReadonlyArray<string>
  readonly trustedPublishing: boolean
}

const targetsForRelease = (planned: DoctorReleasePlan): ReadonlyArray<SurfaceNeeds> => {
  const targets = new Map<string, {
    readonly envNames: Set<string>
    readonly executables: Set<string>
  }>()
  for (const operation of planned.operations) {
    const surfaceId = operationSurfaceId(operation)
    if (surfaceId === undefined) continue
    const targetId = surfaceId === "file" ? "catalog" : surfaceId
    const target = targets.get(targetId) ?? { envNames: new Set<string>(), executables: new Set<string>() }
    targets.set(targetId, target)
    const requirements = operationRequirements(operation)
    for (const executable of requirements.executables) target.executables.add(executable)
    for (const name of requirements.envNames) target.envNames.add(name)
  }
  return [...targets.entries()].map(([targetId, target]) => {
    const trustedPublishing = trustedPublishingAuthEnvNames.every((name) => target.envNames.has(name))
    for (const name of trustedPublishingAuthEnvNames) target.envNames.delete(name)
    return {
      targetId,
      envNames: [...target.envNames].sort(),
      executables: [...target.executables].sort(),
      trustedPublishing
    }
  }).sort((left, right) => left.targetId.localeCompare(right.targetId))
}

const authChecksForPlan = Effect.fn("workflows.doctor.authChecksForPlan")(function*(
  targets: ReadonlyArray<SurfaceNeeds>,
  targetFilter: string | undefined
) {
  const checks: Array<ReleaseDiagnosticCheck> = []
  for (const { envNames, executables, targetId, trustedPublishing } of targets.filter(({ targetId }) => targetFilter === undefined
    || targetId === targetFilter || targetId.toLowerCase().includes(targetFilter.toLowerCase()))) {
    for (const name of envNames) {
      const present = (yield* readOptionalEnv(name)) !== undefined
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

    if (trustedPublishing) {
      const hasOidcUrl = (yield* readOptionalEnv("ACTIONS_ID_TOKEN_REQUEST_URL")) !== undefined
      const hasOidcToken = (yield* readOptionalEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN")) !== undefined
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

const capabilityChecksForPlan = (
  targets: ReadonlyArray<SurfaceNeeds>
): ReadonlyArray<ReleaseDiagnosticCheck> => {
  if (targets.length === 0) {
    return [
      check({
        id: "plan:operations",
        status: "info",
        confidence: "confirmed",
        message: "No release surfaces require operation checks."
      })
    ]
  }
  return targets.map(({ targetId }) =>
    check({
      id: `${targetId}:operations`,
      targetId,
      status: "ok",
      confidence: "confirmed",
      message: `${targetId} has grammar operations in the release plan.`
    })
  )
}

export interface DoctorReleasePlan {
  readonly identity: { readonly name: string; readonly version: string }
  readonly operations: ReadonlyArray<Operation>
  readonly evidenceDirectory: string
}

export const diagnoseRelease = Effect.fn("doctor.diagnoseRelease")(function*<R>(
  input: DoctorReleaseInput,
  pathName: string,
  plannedEffect: Effect.Effect<DoctorReleasePlan, { readonly configFailed: boolean; readonly message: string }, R>
) {
  const planned = yield* plannedEffect.pipe(
    Effect.match({
      onFailure: (error) => ({ _tag: "Failed" as const, error }),
      onSuccess: (plan) => ({ _tag: "Ok" as const, plan })
    })
  )
  const configFailed = planned._tag === "Failed" && planned.error.configFailed
  const validation = configFailed
    ? check({
        id: "config:validation",
        status: "fail",
        confidence: "confirmed",
        message: `Config validation failed: ${planned.error.message}`
      })
    : check({
        id: "config:validation",
        status: "ok",
        confidence: "confirmed",
        message: `Config ${pathName} is valid.`
      })

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
          message: `Plan construction failed: ${planned.error.message}`
        })
      ]
    })
  }

  const targets = targetsForRelease(planned.plan)
  const authChecks = yield* authChecksForPlan(targets, input.target)
  return ReleaseDiagnosticReport.make({
    schemaVersion: "release-diagnostics/v1",
    releaseName: planned.plan.identity.name,
    releaseVersion: planned.plan.identity.version,
    checks: [validation, check({
      id: "plan:construction",
      status: "ok",
      confidence: "confirmed",
      message: "Release plan can be constructed."
    }),
    ...capabilityChecksForPlan(targets),
    check({
      id: "evidence:directory",
      status: "ok",
      confidence: "confirmed",
      message: `Evidence directory ${planned.plan.evidenceDirectory} is valid.`
    }),
    ...authChecks]
  })
})

export const renderReleaseDiagnostics = (
  report: ReleaseDiagnosticReport,
  format: ReleaseDiagnosticsFormat = "text"
): string => {
  switch (format) {
    case "json":
      return `${JSON.stringify(report, null, 2)}\n`
    case "markdown": {
      const rows = report.checks.map((item) =>
        `| ${item.status} | ${item.confidence} | ${item.id} | ${item.message.replaceAll("|", "\\|")} |`)
      return [`# Release Diagnostics ${report.releaseName}@${report.releaseVersion}`, "",
        "| Status | Confidence | Check | Message |", "| --- | --- | --- | --- |", ...rows, ""].join("\n")
    }
    case "text": {
      const rows = report.checks.map((item) =>
        `${item.status.padEnd(4)} ${item.confidence.padEnd(11)} ${item.id}: ${item.message}`)
      return [`diagnostics: ${report.releaseName}@${report.releaseVersion}`, ...rows, ""].join("\n")
    }
  }
}
