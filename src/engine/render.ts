// Invariant: every text, Markdown, summary, and JSON projection reads the same immutable canonical plan.
import {
  CommandSpec,
  Operation,
  type OperationRisk,
  operationApprovalRequirements
} from "../pipeline/operation.js"
import * as Schema from "effect/Schema"
import { ReleasePlan } from "../pipeline/plan.js"
import { operationSurfaceId, operationSurfaceIds } from "./summary.js"

const commandLine = (command: CommandSpec): string =>
  [command.executable, ...command.args].join(" ")

const commandArgv = (command: CommandSpec): ReadonlyArray<string> => [
  command.executable,
  ...command.args
]

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

const operationRiskGroups = (plan: ReleasePlan): ReadonlyArray<OperationRiskGroup> =>
  riskOrder.map((risk) => ({
    risk,
    operations: plan.operations.filter((operation) => operation.risk === risk)
  }))

const hasApprovalBoundaryOperations = (groups: ReadonlyArray<OperationRiskGroup>): boolean =>
  groups.some((group) => approvalBoundaryRisks.has(group.risk) && group.operations.length > 0)

const artifactLine = (artifact: ReleasePlan["artifacts"][number]): string => {
  const checksum = artifact.checksum === undefined
    ? "checksum=none"
    : `checksum=${artifact.checksum.algorithm}:${artifact.checksum.value}`
  const platform = artifact.platform === undefined
    ? "platform=none"
    : `platform=${[artifact.platform.os, artifact.platform.arch, artifact.platform.libc].filter((part) => part !== undefined).join("-")}`
  return `- ${artifact.id} ${artifact.path} [${artifact.kind}] produced-by=${artifact.producedBy} ${platform} ${checksum}`
}

const operationDetails = (
  operation: Operation
): { readonly text: ReadonlyArray<string>; readonly markdown: ReadonlyArray<string> } => {
  switch (operation.action._tag) {
    case "command":
      return {
        text: [
          `command: ${commandLine(operation.action.command)}`,
          `argv: ${JSON.stringify(commandArgv(operation.action.command))}`
        ],
        markdown: [
          "",
          "Command argv:",
          "",
          ...markdownCodeBlock("json", JSON.stringify(commandArgv(operation.action.command), null, 2))
        ]
      }
    case "write-file":
      return { text: [`write: ${operation.action.path}`], markdown: [`- write path: ${operation.action.path}`] }
    case "note":
      return { text: [`note: ${operation.action.message}`], markdown: [`- note: ${operation.action.message}`] }
    case "github-release-create":
      return {
        text: [
          `github-api: create release ${operation.action.repository} ${operation.action.tag} assets=${operation.action.assets.length}`
        ],
        markdown: [
          `- github-api: create release ${operation.action.repository} ${operation.action.tag}`,
          `- assets: ${operation.action.assets.length}`
        ]
      }
    case "github-release-verify":
      return {
        text: [
          `github-api: verify release ${operation.action.repository} ${operation.action.tag} assets=${operation.action.assetNames.length}`
        ],
        markdown: [
          `- github-api: verify release ${operation.action.repository} ${operation.action.tag}`,
          `- assets: ${operation.action.assetNames.length}`
        ]
      }
    case "check-file":
      return { text: [`check-file: ${operation.action.path}`], markdown: [] }
    case "stage":
      return {
        text: [`stage: ${operation.action.intent._tag} artifacts=${operation.action.producesArtifactIds.length}`],
        markdown: []
      }
  }
}

const markdownCodeBlock = (language: string, contents: string): ReadonlyArray<string> => [
  `\`\`\`${language}`,
  contents,
  "```"
]

const surfaceLines = (plan: ReleasePlan): ReadonlyArray<string> => operationSurfaceIds(plan).map((surface) =>
  `  - ${surface} operations=${plan.operations.filter((operation) => operationSurfaceId(operation) === surface).length}`)

export const renderPlanJson = (plan: ReleasePlan): string =>
  `${JSON.stringify(Schema.encodeSync(ReleasePlan)(plan), null, 2)}\n`

export const renderPlanText = (plan: ReleasePlan): string => {
  const lines: Array<string> = [
    `${plan.identity.name}@${plan.identity.version}`,
    `commit: ${plan.identity.commit}`,
    ...(plan.identity.snapshot ? ["snapshot: true"] : []),
    `evidence: ${plan.evidenceDirectory}`,
    `artifacts: ${plan.artifacts.length}`,
    `surfaces: ${operationSurfaceIds(plan).length}`,
    `operations: ${plan.operations.length}`,
    ""
  ]

  lines.push("artifacts:")
  for (const artifact of plan.artifacts) {
    lines.push(`  ${artifactLine(artifact)}`)
  }
  lines.push("")

  lines.push("surfaces:")
  lines.push(...surfaceLines(plan))
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
      for (const detail of operationDetails(operation).text) {
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

export const renderPlanSummary = (plan: ReleasePlan): string => {
  const lines: Array<string> = [
    `summary: ${plan.identity.name}@${plan.identity.version}`,
    `commit: ${plan.identity.commit}`,
    ...(plan.identity.snapshot ? ["snapshot: true"] : []),
    `evidence: ${plan.evidenceDirectory}`,
    `operations: ${plan.operations.length}`,
    "risk:"
  ]

  for (const risk of riskOrder) {
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
  lines.push("surfaces:")
  lines.push(...surfaceLines(plan))
  lines.push("")
  lines.push("approval-required operations:")
  for (const operation of executeOperations) {
    lines.push(`  - ${operation.id}: ${operationApprovalRequirements(operation).label} (${operation.risk})`)
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
    ...(plan.identity.snapshot ? ["**Snapshot release**", ""] : []),
    "## Summary",
    "",
    ...renderPlanSummary(plan).trimEnd().split("\n"),
    "",
    "## Artifacts",
    ""
  ]

  for (const artifact of plan.artifacts) {
    lines.push(artifactLine(artifact))
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
      lines.push(`- target: ${operationSurfaceId(operation) ?? "none"}`)
      lines.push(`- risk: ${operation.risk}`)
      lines.push(`- approval: ${operationApprovalRequirements(operation).label}`)
      lines.push(`- why: ${operation.description}`)
      lines.push(...operationDetails(operation).markdown)
    }
  }

  return `${lines.join("\n")}\n`
}

export const renderReleasePlan = (
  plan: ReleasePlan,
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
