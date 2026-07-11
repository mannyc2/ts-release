import {
  CommandSpec,
  Operation,
  type OperationRisk,
  operationApprovalLabel,
  operationApprovalRequirements
} from "../pipeline/operation.js"
import { ReleasePlanDocument } from "./plan-document.js"

const commandLine = (command: CommandSpec): string =>
  [command.executable, ...command.args].join(" ")

const commandArgv = (command: CommandSpec): ReadonlyArray<string> => [
  command.executable,
  ...command.args
]

const operationTargetId = (operation: Operation): string | undefined => {
  const parts = operation.pipeId.split(":")
  const targetId = parts[1]
  return operation.pipeId.startsWith("publish:") || operation.pipeId.startsWith("catalog:")
    ? targetId
    : undefined
}

const operationSurfaceIds = (plan: ReleasePlanDocument): ReadonlyArray<string> =>
  [...new Set(plan.state.operations.flatMap((operation) => {
    const targetId = operationTargetId(operation)
    return targetId === undefined ? [] : [targetId]
  }))].sort()

const riskOrder: ReadonlyArray<OperationRisk> = [
  "read-only",
  "writes-local",
  "externally-visible",
  "irreversible"
]

const approvalBoundaryRisks = new Set<OperationRisk>(["externally-visible", "irreversible"])

interface OperationRiskGroup {
  readonly risk: OperationRisk
  readonly operations: ReadonlyArray<Operation>
}

const operationRiskGroups = (plan: ReleasePlanDocument): ReadonlyArray<OperationRiskGroup> =>
  riskOrder.map((risk) => ({
    risk,
    operations: plan.state.operations.filter((operation) => operation.risk === risk)
  }))

const hasApprovalBoundaryOperations = (groups: ReadonlyArray<OperationRiskGroup>): boolean =>
  groups.some((group) => approvalBoundaryRisks.has(group.risk) && group.operations.length > 0)

const artifactLine = (artifact: ReleasePlanDocument["artifacts"][number]): string => {
  const checksum = artifact.checksum === undefined
    ? "checksum=none"
    : `checksum=${artifact.checksum.algorithm}:${artifact.checksum.value}`
  return `- ${artifact.id} ${artifact.path} [${artifact.format}] size=${artifact.sizeBytes} ${checksum}`
}

const operationDetailLines = (operation: Operation): ReadonlyArray<string> => {
  switch (operation.action._tag) {
    case "command":
      return [
        `command: ${commandLine(operation.action.command)}`,
        `argv: ${JSON.stringify(commandArgv(operation.action.command))}`
      ]
    case "write-file":
      return [`write: ${operation.action.path}`]
    case "note":
      return [`note: ${operation.action.message}`]
    case "http-check":
      return [
        `http: ${operation.action.request.method} ${operation.action.request.url}`,
        `expect: status ${operation.action.expectedStatus}, checks ${operation.action.checks.length}`
      ]
    case "github-release-create":
      return [
        `github-api: create release ${operation.action.repository} ${operation.action.tag} assets=${operation.action.assets.length}`
      ]
    case "github-release-verify":
      return [
        `github-api: verify release ${operation.action.repository} ${operation.action.tag} assets=${operation.action.assetNames.length}`
      ]
    case "check-file":
      return [`check-file: ${operation.action.path}`]
    case "stage":
      return [`stage: ${operation.action.intent._tag} artifacts=${operation.action.producesArtifactIds.length}`]
  }
}

const markdownCodeBlock = (language: string, contents: string): ReadonlyArray<string> => [
  `\`\`\`${language}`,
  contents,
  "```"
]

export const renderPlanJson = (plan: ReleasePlanDocument): string =>
  `${JSON.stringify(plan, null, 2)}\n`

export const renderPlanText = (plan: ReleasePlanDocument): string => {
  const lines: Array<string> = [
    `${plan.state.identity.name}@${plan.state.identity.version}`,
    `commit: ${plan.state.identity.commit}`,
    ...(plan.state.identity.snapshot ? ["snapshot: true"] : []),
    `evidence: ${plan.evidenceDirectory}`,
    `artifacts: ${plan.artifacts.length}`,
    `surfaces: ${operationSurfaceIds(plan).length}`,
    `operations: ${plan.state.operations.length}`,
    ""
  ]

  lines.push("artifacts:")
  for (const artifact of plan.artifacts) {
    lines.push(`  ${artifactLine(artifact)}`)
  }
  lines.push("")

  lines.push("surfaces:")
  for (const surface of operationSurfaceIds(plan)) {
    const count = plan.state.operations.filter((operation) => operationTargetId(operation) === surface).length
    lines.push(`  - ${surface} operations=${count}`)
  }
  lines.push("")

  lines.push("operations by risk:")
  const groups = operationRiskGroups(plan)
  const showApprovalBoundary = hasApprovalBoundaryOperations(groups)
  for (const group of groups) {
    if (group.risk === "externally-visible" && showApprovalBoundary) {
      lines.push("  -- approval boundary: externally visible and irreversible operations require explicit approval --")
    }
    lines.push(`  ${group.risk}:`)
    if (group.operations.length === 0) {
      lines.push("    - none")
      continue
    }
    for (const operation of group.operations) {
      lines.push(`    - ${operation.id} ${operation.description}`)
      for (const detail of operationDetailLines(operation)) {
        lines.push(`    ${detail}`)
      }
      const approval = operationApprovalRequirements(operation)
      if (approval.requiresExecute) {
        lines.push(`    approval: execute${approval.requiresIrreversibleApproval ? " + irreversible approval" : ""}`)
      }
    }
  }

  return `${lines.join("\n")}\n`
}

export const renderPlanSummary = (plan: ReleasePlanDocument): string => {
  const risks = [
    "read-only",
    "writes-local",
    "externally-visible",
    "irreversible"
  ]
  const lines: Array<string> = [
    `summary: ${plan.state.identity.name}@${plan.state.identity.version}`,
    `commit: ${plan.state.identity.commit}`,
    ...(plan.state.identity.snapshot ? ["snapshot: true"] : []),
    `evidence: ${plan.evidenceDirectory}`,
    `operations: ${plan.state.operations.length}`,
    "risk:"
  ]

  for (const risk of risks) {
    lines.push(`  ${risk}: ${plan.state.operations.filter((operation) => operation.risk === risk).length}`)
  }

  const executeOperations = plan.state.operations.filter((operation) =>
    operationApprovalRequirements(operation).requiresExecute
  )
  const irreversibleOperations = plan.state.operations.filter((operation) =>
    operationApprovalRequirements(operation).requiresIrreversibleApproval
  )
  lines.push(`execute required: ${executeOperations.length}`)
  lines.push(`irreversible approval required: ${irreversibleOperations.length}`)
  lines.push("")
  lines.push("surfaces:")
  for (const surface of operationSurfaceIds(plan)) {
    const count = plan.state.operations.filter((operation) => operationTargetId(operation) === surface).length
    lines.push(`  - ${surface} operations=${count}`)
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

export const renderPlanMarkdown = (plan: ReleasePlanDocument): string => {
  const lines: Array<string> = [
    `# Release Plan ${plan.state.identity.name}@${plan.state.identity.version}`,
    "",
    ...(plan.state.identity.snapshot ? ["**Snapshot release**", ""] : []),
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
  lines.push("## Operations By Risk")
  const groups = operationRiskGroups(plan)
  const showApprovalBoundary = hasApprovalBoundaryOperations(groups)
  for (const group of groups) {
    if (group.risk === "externally-visible" && showApprovalBoundary) {
      lines.push("")
      lines.push("> Approval boundary: externally visible and irreversible operations require explicit approval.")
    }

    lines.push("")
    lines.push(`### ${group.risk}`)

    if (group.operations.length === 0) {
      lines.push("")
      lines.push("- none")
      continue
    }

    for (const operation of group.operations) {
      lines.push("")
      lines.push(`#### ${operation.id}`)
      lines.push("")
      lines.push(`- target: ${operationTargetId(operation) ?? "none"}`)
      lines.push(`- risk: ${operation.risk}`)
      lines.push(`- approval: ${operationApprovalLabel(operation)}`)
      lines.push(`- why: ${operation.description}`)
      if (operation.action._tag === "command") {
        lines.push("")
        lines.push("Command argv:")
        lines.push("")
        lines.push(...markdownCodeBlock("json", JSON.stringify(commandArgv(operation.action.command), null, 2)))
      }
      if (operation.action._tag === "write-file") {
        lines.push(`- write path: ${operation.action.path}`)
      }
      if (operation.action._tag === "note") {
        lines.push(`- note: ${operation.action.message}`)
      }
      if (operation.action._tag === "http-check") {
        lines.push(`- http: ${operation.action.request.method} ${operation.action.request.url}`)
        lines.push(`- expected status: ${operation.action.expectedStatus}`)
        lines.push(`- checks: ${operation.action.checks.length}`)
      }
      if (operation.action._tag === "github-release-create") {
        lines.push(`- github-api: create release ${operation.action.repository} ${operation.action.tag}`)
        lines.push(`- assets: ${operation.action.assets.length}`)
      }
      if (operation.action._tag === "github-release-verify") {
        lines.push(`- github-api: verify release ${operation.action.repository} ${operation.action.tag}`)
        lines.push(`- assets: ${operation.action.assetNames.length}`)
      }
    }
  }

  return `${lines.join("\n")}\n`
}

export const renderReleasePlan = (
  plan: ReleasePlanDocument,
  format: "json" | "text" | "summary" | "markdown" = "text"
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
