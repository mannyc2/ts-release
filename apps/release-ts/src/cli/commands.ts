import { realpathSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type {
  ApplyInput, ExecutionReviewId, ExecutionScopeInput, OperationId,
  OperatorResolution, PlanId, PublishReviewId, ReleaseApi, Stage
} from "@mannyc1/ts-release"

export const commandNames = ["init", "doctor", "plan", "apply"] as const
const packageRoot = fileURLToPath(new URL("../../../../", import.meta.url))
export interface CliIo {
  readonly read: (path: string) => string
  readonly write: (path: string, value: string) => void
  readonly log: (value: string) => void
}
type ReleaseCommands = Pick<ReleaseApi, "plan" | "reviewExecution" | "apply">
// The command bodies take decoded values; argv decoding belongs to the CLI
// front door, and release policy belongs to the api.
export interface InitOptions {
  readonly template: string, readonly config: string, readonly root: string
  readonly package: string, readonly repo: string, readonly tap: string
  readonly bucket: string, readonly write: boolean
}
export interface PlanOptions {
  readonly config: string, readonly root?: string | undefined, readonly out?: string | undefined
}
export interface ReviewOptions {
  readonly plan: string, readonly planId: string, readonly scope?: string | undefined
  readonly doctor: boolean
}
export interface ApplyOptions {
  readonly plan: string, readonly planId: string, readonly root: string
  readonly reviewer?: string | undefined, readonly newRun?: string | undefined
  readonly resume?: string | undefined, readonly confirmExecution?: string | undefined
  readonly confirmPublish?: string | undefined, readonly scope?: string | undefined
  readonly through?: string | undefined, readonly reason?: string | undefined
  readonly reconcile?: string | undefined, readonly resolutions?: string | undefined
}

export const selectCliWorkspace = (
  cwd: string,
  configPath: string,
  explicitRoot?: string
): string => realpathSync(explicitRoot !== undefined
  ? resolve(cwd, explicitRoot)
  : isAbsolute(configPath) ? dirname(configPath) : cwd)
const scope = (value: string | undefined): ExecutionScopeInput => value === undefined || value === "all"
  ? "all"
  : { operationIds: value.split(",").filter(Boolean).map((id) => id as OperationId) }
const resolutions = (value: string | undefined): ReadonlyArray<OperatorResolution> | undefined => {
  if (value === undefined) return undefined
  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed) || parsed.some((item) =>
    typeof item !== "object" || item === null ||
    !["committed", "absent"].includes(String(Reflect.get(item, "outcome"))) ||
    ["operationId", "operator", "reason"].some((key) =>
      typeof Reflect.get(item, key) !== "string" || Reflect.get(item, key).length === 0))) {
    throw new Error("--resolutions must be a JSON array of operationId, outcome, operator, and reason.")
  }
  return parsed as Array<OperatorResolution>
}
const accepted = (plan: string, planId: string, cwd: string, io: CliIo) => ({
  planBytes: io.read(realpathSync(resolve(cwd, plan))),
  expectedPlanId: planId as PlanId
})

export const runInit = (options: InitOptions, cwd: string, io: CliIo): void => {
  const root = realpathSync(resolve(cwd, options.root))
  const source = resolve(packageRoot, "templates", options.template, "release.config.json")
  const replacements = new Map([
    ["@scope/pkg", options.package],
    ["owner/repo", options.repo],
    ["owner/homebrew-tap", options.tap],
    ["owner/scoop-bucket", options.bucket]
  ])
  let contents = io.read(source)
  for (const [from, to] of replacements) contents = contents.replaceAll(from, to)
  const output = resolve(root, options.config)
  if (options.write) io.write(output, contents)
  io.log(JSON.stringify({ template: options.template, path: output, written: options.write }))
}
export const runPlan = async (
  api: ReleaseCommands,
  options: PlanOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const workspace = selectCliWorkspace(cwd, options.config, options.root)
  const source = isAbsolute(options.config) ? options.config : resolve(workspace, options.config)
  const result = await api.plan({
    config: JSON.parse(io.read(realpathSync(source))) as unknown,
    workspace
  })
  if (options.out === undefined) io.log(result.bytes)
  else io.write(resolve(cwd, options.out), result.bytes)
  io.log(JSON.stringify({ planId: result.planId }))
}
export const runReview = async (
  api: ReleaseCommands,
  options: ReviewOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const review = await api.reviewExecution({
    ...accepted(options.plan, options.planId, cwd, io),
    scope: scope(options.scope)
  })
  io.log(JSON.stringify({
    status: options.doctor ? "valid" : "review-required",
    executionReviewId: review.executionReviewId,
    operationIds: review.scope.operationIds
  }))
}
const applyInput = (options: ApplyOptions, cwd: string, io: CliIo): ApplyInput => {
  if (options.reviewer === undefined) throw new Error("--reviewer is required.")
  if ((options.newRun === undefined) === (options.resume === undefined)) {
    throw new Error("Choose exactly one of --new-run or --resume.")
  }
  if (options.newRun !== undefined && options.confirmExecution === undefined) {
    throw new Error("--confirm-execution is required for a new run.")
  }
  const resolutionItems = resolutions(options.resolutions)
  return {
    ...accepted(options.plan, options.planId, cwd, io),
    workspace: realpathSync(resolve(cwd, options.root)),
    ...(options.newRun === undefined
      ? { resumeRunPath: options.resume! }
      : {
          newRun: {
            path: options.newRun, scope: scope(options.scope),
            executionReviewId: options.confirmExecution! as ExecutionReviewId,
            reviewer: options.reviewer,
            ...(options.reason === undefined ? {} : { reason: options.reason })
          }
        }),
    ...(options.through === undefined ? {} : { through: options.through as Stage }),
    ...(options.confirmPublish === undefined ? {} : {
      publishConfirmation: {
        publishReviewId: options.confirmPublish as PublishReviewId, reviewer: options.reviewer
      }
    }),
    ...(options.reconcile === undefined ? {} : {
      reconcile: options.reconcile.split(",").filter(Boolean).map((id) => id as OperationId)
    }),
    ...(resolutionItems === undefined ? {} : { resolutions: resolutionItems })
  }
}
export const runApply = async (
  api: ReleaseCommands,
  options: ApplyOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const result = await api.apply(applyInput(options, cwd, io))
  io.log(JSON.stringify({
    status: result.status, runId: result.runId, runPath: result.runPath,
    executionReceiptId: result.executionReceiptId,
    ...(result.nextPublishReviewId === undefined ? {} : {
      publishReviewId: result.nextPublishReviewId
    }),
    ...(result.publishReceiptId === undefined ? {} : { publishReceiptId: result.publishReceiptId })
  }))
}
