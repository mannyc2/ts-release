import { CommandSpec, Operation } from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"

export type * from "../types/effect-internal.js"

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
    lines.push(
      `  - ${capability.targetId} [${capability.targetTag}] auth=${capability.authRequirement} ` +
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
    if (operation.gate.requiresExecute) {
      lines.push(`  gate: execute${operation.gate.requiresIrreversibleApproval ? " + irreversible approval" : ""}`)
    }
  }

  return `${lines.join("\n")}\n`
}
