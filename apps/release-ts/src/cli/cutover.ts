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
interface Parsed {
  readonly command: typeof commandNames[number]
  readonly positional: ReadonlyArray<string>
  readonly flags: Readonly<Record<string, string | true>>
}
const parse = (argv: ReadonlyArray<string>): Parsed => {
  const [command, ...rest] = argv
  if (!commandNames.includes(command as typeof commandNames[number])) {
    throw new Error(`Unknown command ${command ?? ""}. Expected ${commandNames.join(", ")}.`)
  }
  const positional: Array<string> = []
  const flags: Record<string, string | true> = {}
  let index = 0
  while (index < rest.length) {
    const value = rest[index]!
    if (!value.startsWith("--")) positional.push(value)
    else {
      const name = value.slice(2)
      const next = rest[index + 1]
      if (next === undefined || next.startsWith("--")) flags[name] = true
      else {
        flags[name] = next
        index += 1
      }
    }
    index += 1
  }
  return { command: command as Parsed["command"], positional, flags }
}
const flag = (parsed: Parsed, name: string): string | undefined => {
  const value = parsed.flags[name]
  return typeof value === "string" ? value : undefined
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
const accepted = (parsed: Parsed, cwd: string, io: CliIo) => {
  const path = parsed.positional[0]
  if (path === undefined) throw new Error(`${parsed.command} requires a plan file.`)
  const planId = flag(parsed, "plan-id")
  if (planId === undefined) throw new Error("--plan-id is required.")
  return {
    planBytes: io.read(realpathSync(resolve(cwd, path))),
    expectedPlanId: planId as PlanId
  }
}
const initialize = (parsed: Parsed, cwd: string, io: CliIo): void => {
  const template = flag(parsed, "template") ?? "npm-only"
  const configPath = flag(parsed, "config") ?? "release.config.json"
  const root = realpathSync(resolve(cwd, flag(parsed, "root") ?? "."))
  const source = resolve(packageRoot, "templates", template, "release.config.json")
  const replacements = new Map([
    ["@scope/pkg", flag(parsed, "package") ?? "@scope/pkg"],
    ["owner/repo", flag(parsed, "repo") ?? "owner/repo"],
    ["owner/homebrew-tap", flag(parsed, "tap") ?? "owner/homebrew-tap"],
    ["owner/scoop-bucket", flag(parsed, "bucket") ?? "owner/scoop-bucket"]
  ])
  let contents = io.read(source)
  for (const [from, to] of replacements) contents = contents.replaceAll(from, to)
  const output = resolve(root, configPath)
  if (parsed.flags.write === true) io.write(output, contents)
  io.log(JSON.stringify({ template, path: output, written: parsed.flags.write === true }))
}
const planCommand = async (
  api: ReleaseCommands,
  parsed: Parsed,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const configPath = flag(parsed, "config") ?? "release.config.json"
  const workspace = selectCliWorkspace(cwd, configPath, flag(parsed, "root"))
  const source = isAbsolute(configPath) ? configPath : resolve(workspace, configPath)
  const result = await api.plan({
    config: JSON.parse(io.read(realpathSync(source))) as unknown,
    workspace
  })
  const out = flag(parsed, "out")
  if (out === undefined) io.log(result.bytes)
  else io.write(resolve(cwd, out), result.bytes)
  io.log(JSON.stringify({ planId: result.planId }))
}
const reviewCommand = async (
  api: ReleaseCommands,
  parsed: Parsed,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const review = await api.reviewExecution({
    ...accepted(parsed, cwd, io),
    scope: scope(flag(parsed, "scope"))
  })
  io.log(JSON.stringify({
    status: parsed.command === "doctor" ? "valid" : "review-required",
    executionReviewId: review.executionReviewId,
    operationIds: review.scope.operationIds
  }))
}
const applyInput = (parsed: Parsed, cwd: string, io: CliIo): ApplyInput => {
  const reviewer = flag(parsed, "reviewer")
  if (reviewer === undefined) throw new Error("--reviewer is required.")
  const newRunPath = flag(parsed, "new-run")
  const resumeRunPath = flag(parsed, "resume")
  if ((newRunPath === undefined) === (resumeRunPath === undefined)) {
    throw new Error("Choose exactly one of --new-run or --resume.")
  }
  const executionReview = flag(parsed, "confirm-execution")
  if (newRunPath !== undefined && executionReview === undefined) {
    throw new Error("--confirm-execution is required for a new run.")
  }
  const publish = flag(parsed, "confirm-publish")
  const reconcile = flag(parsed, "reconcile")
  const resolutionItems = resolutions(flag(parsed, "resolutions"))
  const reason = flag(parsed, "reason")
  return {
    ...accepted(parsed, cwd, io),
    workspace: realpathSync(resolve(cwd, flag(parsed, "root") ?? ".")),
    ...(newRunPath === undefined
      ? { resumeRunPath: resumeRunPath! }
      : {
          newRun: {
            path: newRunPath, scope: scope(flag(parsed, "scope")),
            executionReviewId: executionReview! as ExecutionReviewId, reviewer,
            ...(reason === undefined ? {} : { reason })
          }
        }),
    ...(flag(parsed, "through") === undefined ? {} : { through: flag(parsed, "through") as Stage }),
    ...(publish === undefined ? {} : {
      publishConfirmation: { publishReviewId: publish as PublishReviewId, reviewer }
    }),
    ...(reconcile === undefined ? {} : {
      reconcile: reconcile.split(",").filter(Boolean).map((id) => id as OperationId)
    }),
    ...(resolutionItems === undefined ? {} : { resolutions: resolutionItems })
  }
}
const applyCommand = async (
  api: ReleaseCommands,
  parsed: Parsed,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const result = await api.apply(applyInput(parsed, cwd, io))
  io.log(JSON.stringify({
    status: result.status, runId: result.runId, runPath: result.runPath,
    executionReceiptId: result.executionReceiptId,
    ...(result.nextPublishReviewId === undefined ? {} : {
      publishReviewId: result.nextPublishReviewId
    }),
    ...(result.publishReceiptId === undefined ? {} : { publishReceiptId: result.publishReceiptId })
  }))
}

export const runCutoverCli = async (
  api: ReleaseCommands,
  argv: ReadonlyArray<string>,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const parsed = parse(argv)
  if (parsed.command === "init") return initialize(parsed, cwd, io)
  if (parsed.command === "plan") return planCommand(api, parsed, cwd, io)
  if (parsed.command === "doctor" || parsed.flags["review-only"] === true) {
    return reviewCommand(api, parsed, cwd, io)
  }
  return applyCommand(api, parsed, cwd, io)
}
