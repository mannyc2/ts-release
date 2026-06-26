import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  CommandSpec,
  Operation,
  operationApprovalLabel,
  operationApprovalRequirements,
  OperationId
} from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"

export type * from "../types/effect-internal.js"

export class PlanOperationNotFoundError extends Schema.TaggedErrorClass<PlanOperationNotFoundError>()(
  "PlanOperationNotFoundError",
  {
    operationId: OperationId
  }
) {}

const commandLine = (operation: Extract<Operation, { readonly command: CommandSpec }>): string =>
  [operation.command.executable, ...operation.command.args].join(" ")

const commandArgv = (operation: Extract<Operation, { readonly command: CommandSpec }>): ReadonlyArray<string> => [
  operation.command.executable,
  ...operation.command.args
]

const artifactLine = (artifact: ReleasePlan["artifacts"][number]): string => {
  const checksum = artifact.checksum === undefined
    ? "checksum=none"
    : `checksum=${artifact.checksum.algorithm}:${artifact.checksum.value}`
  return `- ${artifact.id} ${artifact.path} [${artifact.format}] size=${artifact.sizeBytes} ${checksum}`
}

const capabilitySetupFields = (capability: ReleasePlan["targetCapabilities"][number]): string => {
  const setup = capability.authSetup
  if (setup === undefined) {
    return ""
  }
  const permissions = setup.requiredPermissions
    .map((permission) => `required-permission=${permission.name}:${permission.value}`)
    .join(" ")
  const prerequisites = setup.prerequisites
    .map((prerequisite) =>
      prerequisite === "npm-package-exists" ? "package-prerequisite=exists" : `prerequisite=${prerequisite}`
    )
    .join(" ")
  return [
    `runs-in=${setup.runsIn}`,
    `provider=${setup.provider}`,
    `workflow=${setup.workflow}`,
    permissions,
    prerequisites
  ].filter((field) => field.length > 0).join(" ")
}

const operationTargetCapability = (
  plan: ReleasePlan,
  operation: Operation
): ReleasePlan["targetCapabilities"][number] | undefined => {
  if (operation.targetId === undefined) {
    return undefined
  }
  return plan.targetCapabilities.find((capability) => capability.targetId === operation.targetId)
}

const operationDetailLines = (operation: Operation): ReadonlyArray<string> => {
  if ("command" in operation) {
    return [
      `command: ${commandLine(operation)}`,
      `argv: ${JSON.stringify(commandArgv(operation))}`
    ]
  }
  if (operation._tag === "RenderFileOperation") {
    return [`write: ${operation.path}`]
  }
  if (operation._tag === "ValidationNoteOperation") {
    return [`note: ${operation.message}`]
  }
  if (operation._tag === "VerifyHttpOperation") {
    return [
      `http: ${operation.request.method} ${operation.request.url}`,
      `expect: status ${operation.expectedStatus}, checks ${operation.checks.length}`
    ]
  }
  return []
}

const markdownCodeBlock = (language: string, contents: string): ReadonlyArray<string> => [
  `\`\`\`${language}`,
  contents,
  "```"
]

export const renderPlanJson = (plan: ReleasePlan): string =>
  `${JSON.stringify(plan, null, 2)}\n`

export const renderPlanText = (plan: ReleasePlan): string => {
  const lines: Array<string> = [
    `${plan.identity.name}@${plan.identity.version}`,
    `commit: ${plan.identity.commit}`,
    `evidence: ${plan.evidenceDirectory}`,
    `artifacts: ${plan.artifacts.length}`,
    `targets: ${plan.targets.length}`,
    `operations: ${plan.operations.length}`,
    ""
  ]

  lines.push("artifacts:")
  for (const artifact of plan.artifacts) {
    lines.push(`  ${artifactLine(artifact)}`)
  }
  lines.push("")

  lines.push("targets:")
  for (const capability of plan.targetCapabilities) {
    const setupFields = capabilitySetupFields(capability)
    lines.push(
      `  - ${capability.targetId} [${capability.targetTag}] auth=${capability.authRequirement} ` +
        `${setupFields.length === 0 ? "" : `${setupFields} `}` +
        `dry-run=${capability.dryRunSupport} strategy=${capability.validationStrategy} ` +
        `mutability=${capability.mutability} recovery=${capability.recovery}`
    )
  }
  lines.push("")

  lines.push("operations:")
  for (const operation of plan.operations) {
    lines.push(`  - ${operation.id} [${operation.risk}] ${operation.description}`)
    if ("command" in operation) {
      lines.push(`  command: ${commandLine(operation)}`)
      lines.push(`  argv: ${JSON.stringify(commandArgv(operation))}`)
    }
    if (operation._tag === "RenderFileOperation") {
      lines.push(`  write: ${operation.path}`)
    }
    if (operation._tag === "ValidationNoteOperation") {
      lines.push(`  note: ${operation.message}`)
    }
    if (operation._tag === "VerifyHttpOperation") {
      lines.push(`  http: ${operation.request.method} ${operation.request.url}`)
      lines.push(`  expect: status ${operation.expectedStatus}, checks ${operation.checks.length}`)
    }
    const approval = operationApprovalRequirements(operation)
    if (approval.requiresExecute) {
      lines.push(`  approval: execute${approval.requiresIrreversibleApproval ? " + irreversible approval" : ""}`)
    }
  }

  return `${lines.join("\n")}\n`
}

export const renderPlanSummary = (plan: ReleasePlan): string => {
  const risks = [
    "read-only",
    "writes-local",
    "externally-visible",
    "irreversible"
  ]
  const lines: Array<string> = [
    `summary: ${plan.identity.name}@${plan.identity.version}`,
    `commit: ${plan.identity.commit}`,
    `evidence: ${plan.evidenceDirectory}`,
    `operations: ${plan.operations.length}`,
    "risk:"
  ]

  for (const risk of risks) {
    lines.push(`  ${risk}: ${plan.operations.filter((operation) => operation.risk === risk).length}`)
  }

  const executeOperations = plan.operations.filter((operation) =>
    operationApprovalRequirements(operation).requiresExecute
  )
  const irreversibleOperations = plan.operations.filter((operation) =>
    operationApprovalRequirements(operation).requiresIrreversibleApproval
  )
  lines.push(`execute required: ${executeOperations.length}`)
  lines.push(`irreversible approval required: ${irreversibleOperations.length}`)
  lines.push("")
  lines.push("targets:")
  for (const capability of plan.targetCapabilities) {
    const setupFields = capabilitySetupFields(capability)
    lines.push(
      `  - ${capability.targetId} [${capability.targetTag}] auth=${capability.authRequirement}` +
        `${setupFields.length === 0 ? "" : ` ${setupFields}`}`
    )
  }
  lines.push("")
  lines.push("approval-required operations:")
  for (const operation of executeOperations) {
    lines.push(`  - ${operation.id}: ${operationApprovalLabel(operation)} (${operation.risk})`)
  }
  if (executeOperations.length === 0) {
    lines.push("  - none")
  }

  return `${lines.join("\n")}\n`
}

export const renderPlanMarkdown = (plan: ReleasePlan): string => {
  const lines: Array<string> = [
    `# Release Plan ${plan.identity.name}@${plan.identity.version}`,
    "",
    "## Summary",
    "",
    ...renderPlanSummary(plan).trimEnd().split("\n"),
    "",
    "## Artifacts",
    ""
  ]

  for (const artifact of plan.artifacts) {
    lines.push(`- ${artifactLine(artifact)}`)
  }
  if (plan.artifacts.length === 0) {
    lines.push("- none")
  }

  lines.push("")
  lines.push("## Operations")
  for (const operation of plan.operations) {
    lines.push("")
    lines.push(`### ${operation.id}`)
    lines.push("")
    lines.push(`- target: ${operation.targetId ?? "none"}`)
    lines.push(`- risk: ${operation.risk}`)
    lines.push(`- approval: ${operationApprovalLabel(operation)}`)
    lines.push(`- why: ${operation.description}`)
    if ("command" in operation) {
      lines.push("")
      lines.push("Command argv:")
      lines.push("")
      lines.push(...markdownCodeBlock("json", JSON.stringify(commandArgv(operation), null, 2)))
    }
    if (operation._tag === "RenderFileOperation") {
      lines.push(`- write path: ${operation.path}`)
    }
    if (operation._tag === "ValidationNoteOperation") {
      lines.push(`- note: ${operation.message}`)
    }
    if (operation._tag === "VerifyHttpOperation") {
      lines.push(`- http: ${operation.request.method} ${operation.request.url}`)
      lines.push(`- expected status: ${operation.expectedStatus}`)
      lines.push(`- checks: ${operation.checks.length}`)
    }
  }

  return `${lines.join("\n")}\n`
}

const renderOperationExplanationText = (plan: ReleasePlan, operation: Operation): string => {
  const capability = operationTargetCapability(plan, operation)
  const lines: Array<string> = [
    `operation: ${operation.id}`,
    `target: ${operation.targetId ?? "none"}`,
    `risk: ${operation.risk}`,
    `why: ${operation.description}`,
    `execution approval: ${operationApprovalLabel(operation)}`
  ]

  if (capability !== undefined) {
    lines.push(
      `target capability: auth=${capability.authRequirement} dry-run=${capability.dryRunSupport} ` +
        `strategy=${capability.validationStrategy} mutability=${capability.mutability} recovery=${capability.recovery}`
    )
    const setupFields = capabilitySetupFields(capability)
    if (setupFields.length > 0) {
      lines.push(`target setup: ${setupFields}`)
    }
  }

  lines.push(...operationDetailLines(operation))
  return `${lines.join("\n")}\n`
}

export const renderPlanOperationExplanation = Effect.fn("renderPlanOperationExplanation")(function*(
  plan: ReleasePlan,
  operationId: string
) {
  const operation = plan.operations.find((candidate) => candidate.id === operationId)
  if (operation === undefined) {
    return yield* Effect.fail(PlanOperationNotFoundError.make({ operationId }))
  }
  return renderOperationExplanationText(plan, operation)
})
