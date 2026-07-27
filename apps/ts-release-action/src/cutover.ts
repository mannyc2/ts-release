import { realpathSync } from "node:fs"
import { basename, dirname, isAbsolute, relative, resolve } from "node:path"
import type {
  ApplyInput, ExecutionReviewId, ExecutionScopeInput, OperationId,
  OperatorResolution, PlanId, PublishReviewId, ReleaseApi, Stage
} from "@mannyc1/ts-release"

export const actionCommands = ["plan", "apply", "doctor"] as const
export const actionOutputs = [
  "plan_id", "execution_review_id", "execution_receipt_id", "publish_review_id",
  "publish_receipt_id", "run_id", "run_path", "status", "evidence_path"
] as const
export interface ActionRuntime {
  readonly workspace: string
  readonly input: (name: string) => string
  readonly output: (name: typeof actionOutputs[number], value: string) => void
  readonly read: (path: string) => string
  readonly write: (path: string, value: string) => void
}
type ReleaseCommands = Pick<ReleaseApi, "plan" | "reviewExecution" | "apply">
type Command = typeof actionCommands[number]
const optional = (runtime: ActionRuntime, name: string): string | undefined => {
  const value = runtime.input(name).trim()
  return value.length === 0 ? undefined : value
}
const inside = (root: string, candidate: string): string => {
  const fromRoot = relative(root, candidate)
  if (fromRoot === ".." || fromRoot.startsWith("../") || isAbsolute(fromRoot)) {
    throw new Error("Action path is outside GITHUB_WORKSPACE.")
  }
  return candidate
}
const contained = (root: string, path: string): string =>
  inside(root, realpathSync(isAbsolute(path) ? path : resolve(root, path)))
const containedOutput = (root: string, path: string): string => {
  const candidate = isAbsolute(path) ? resolve(path) : resolve(root, path)
  return inside(root, resolve(realpathSync(dirname(candidate)), basename(candidate)))
}
const scope = (value: string | undefined): ExecutionScopeInput => value === undefined || value === "all"
  ? "all"
  : { operationIds: value.split(",").filter(Boolean).map((id) => id as OperationId) }
const resolutions = (value: string | undefined): ReadonlyArray<OperatorResolution> | undefined => {
  if (value === undefined) return undefined
  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed)) throw new Error("resolutions must be a JSON array.")
  return parsed as Array<OperatorResolution>
}
const accepted = (runtime: ActionRuntime, root: string) => {
  const path = optional(runtime, "plan-path")
  const planId = optional(runtime, "plan-id")
  if (path === undefined) throw new Error("plan-path is required.")
  if (planId === undefined) throw new Error("plan-id is required.")
  return {
    planBytes: runtime.read(contained(root, path)),
    expectedPlanId: planId as PlanId
  }
}
const planAction = async (
  api: ReleaseCommands,
  runtime: ActionRuntime,
  root: string
): Promise<void> => {
  const source = contained(root, optional(runtime, "config") ?? "release.config.json")
  const result = await api.plan({ config: JSON.parse(runtime.read(source)) as unknown, workspace: root })
  const output = containedOutput(root, optional(runtime, "plan-path") ?? "release-plan.json")
  runtime.write(output, result.bytes)
  runtime.output("plan_id", result.planId)
  runtime.output("status", "planned")
}
const reviewAction = async (
  api: ReleaseCommands,
  runtime: ActionRuntime,
  root: string,
  command: Command
): Promise<void> => {
  const review = await api.reviewExecution({
    ...accepted(runtime, root),
    scope: scope(optional(runtime, "scope"))
  })
  runtime.output("execution_review_id", review.executionReviewId)
  runtime.output("status", command === "doctor" ? "valid" : "review-required")
}
const applyInput = (runtime: ActionRuntime, root: string): ApplyInput => {
  const reviewer = optional(runtime, "reviewer")
  if (reviewer === undefined) throw new Error("reviewer is required.")
  const newRunPath = optional(runtime, "new-run")
  const resumeRunPath = optional(runtime, "resume")
  if ((newRunPath === undefined) === (resumeRunPath === undefined)) {
    throw new Error("Choose exactly one of new-run or resume.")
  }
  const review = optional(runtime, "confirm-execution")
  if (newRunPath !== undefined && review === undefined) {
    throw new Error("confirm-execution is required for a new run.")
  }
  const publish = optional(runtime, "confirm-publish")
  const through = optional(runtime, "through") as Stage | undefined
  const reconcile = optional(runtime, "reconcile")
  const resolutionItems = resolutions(optional(runtime, "resolutions"))
  const reason = optional(runtime, "reason")
  return {
    ...accepted(runtime, root),
    workspace: root,
    ...(newRunPath === undefined ? { resumeRunPath: resumeRunPath! } : {
      newRun: {
        path: newRunPath, scope: scope(optional(runtime, "scope")),
        executionReviewId: review! as ExecutionReviewId, reviewer,
        ...(reason === undefined ? {} : { reason })
      }
    }),
    ...(through === undefined ? {} : { through }),
    ...(publish === undefined ? {} : {
      publishConfirmation: { publishReviewId: publish as PublishReviewId, reviewer }
    }),
    ...(reconcile === undefined ? {} : {
      reconcile: reconcile.split(",").filter(Boolean).map((id) => id as OperationId)
    }),
    ...(resolutionItems === undefined ? {} : { resolutions: resolutionItems })
  }
}
const applyAction = async (
  api: ReleaseCommands,
  runtime: ActionRuntime,
  root: string
): Promise<void> => {
  const result = await api.apply(applyInput(runtime, root))
  runtime.output("execution_receipt_id", result.executionReceiptId)
  runtime.output("run_id", result.runId)
  runtime.output("run_path", result.runPath)
  runtime.output("status", result.status)
  runtime.output("evidence_path", `${result.runPath}.evidence.json`)
  if (result.nextPublishReviewId !== undefined) {
    runtime.output("publish_review_id", result.nextPublishReviewId)
  }
  if (result.publishReceiptId !== undefined) {
    runtime.output("publish_receipt_id", result.publishReceiptId)
  }
  runtime.write(`${result.runPath}.evidence.json`, JSON.stringify(result.evidence, null, 2))
}

export const runCutoverAction = async (
  api: ReleaseCommands,
  runtime: ActionRuntime
): Promise<void> => {
  const root = realpathSync(runtime.workspace)
  const command = (optional(runtime, "command") ?? "plan") as Command
  if (!actionCommands.includes(command)) throw new Error("command must be plan, apply, or doctor.")
  if (command === "plan") return planAction(api, runtime, root)
  if (command === "doctor" || optional(runtime, "review-only") === "true") {
    return reviewAction(api, runtime, root, command)
  }
  return applyAction(api, runtime, root)
}
