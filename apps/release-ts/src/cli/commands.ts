import * as Schema from "effect/Schema"
import { realpathSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { observeGitFacts } from "./facts.js"
import {
  encodeResolvedConfig, ExecutionReviewId, OperationId, PlanId, PublishReviewId,
  resolveConfig, Stage
} from "@mannyc1/ts-release"
import type {
  ApplyInput, ExecutionScopeInput, OperatorResolution, ReleaseApi, ReleasePlanV6
} from "@mannyc1/ts-release"

export const commandNames = ["init", "doctor", "plan", "apply", "ship"] as const
// The reviewer recorded when one process planned, confirmed, and applied a
// release — nobody independent looked. This EXACT string, and only this string,
// marks such a run; consumers key on the `self:` prefix. The carrier is the run
// ledger's approval receipts (src/model/run.ts), which durably record
// `reviewer`. The evidence projection deliberately carries NO reviewer field
// (src/view/evidence.ts), so anything distinguishing a gated run from a
// one-shot run reads the LEDGER — do not "fix" evidence to include it.
export const SELF_REVIEWER = "self:one-shot"
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
export interface ResolveOptions {
  readonly fromGit: boolean, readonly emitResolved?: string | undefined
}
export interface PlanOptions extends ResolveOptions {
  readonly config: string, readonly root?: string | undefined, readonly out?: string | undefined
}
export interface ReviewOptions {
  readonly plan: string, readonly planId: string, readonly scope?: string | undefined
  readonly doctor: boolean
}
export interface ShipOptions extends ResolveOptions {
  readonly config: string, readonly root?: string | undefined
  readonly out: string, readonly runs: string
  readonly scope?: string | undefined, readonly reason?: string | undefined
}
export interface ApplyOptions {
  readonly plan: string, readonly planId: string, readonly root: string
  readonly reviewer?: string | undefined, readonly newRun?: string | undefined
  readonly resume?: string | undefined, readonly confirmExecution?: string | undefined
  readonly confirmPublish?: string | undefined, readonly scope?: string | undefined
  readonly through?: string | undefined, readonly reason?: string | undefined
  readonly reconcile?: string | undefined, readonly resolutions?: string | undefined
  readonly retry?: string | undefined
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
  : { operationIds: value.split(",").filter(Boolean).map((id) => OperationId.make(id)) }
// The api is the validator; the CLI only keeps JSON parse errors readable.
const resolutions = (value: string | undefined): ReadonlyArray<OperatorResolution> | undefined => {
  if (value === undefined) return undefined
  try {
    return JSON.parse(value) as Array<OperatorResolution>
  } catch {
    throw new Error("--resolutions must be valid JSON.")
  }
}
const accepted = (plan: string, planId: string, cwd: string, io: CliIo) => ({
  planBytes: io.read(realpathSync(resolve(cwd, plan))),
  expectedPlanId: PlanId.make(planId)
})

const RESOLVED_CONFIG = ".release/resolved.config.json"
// One config read, then — only when asked — one observation and one pure
// resolution. Without `--from-git` this is byte-for-byte the behavior the CLI
// has always had: the parsed value goes to the api untouched, and a config
// carrying authoring directives is refused by the core's excess-property error.
const loadConfig = (
  options: PlanOptions | ShipOptions, cwd: string, io: CliIo
): { readonly workspace: string, readonly config: unknown } => {
  const workspace = selectCliWorkspace(cwd, options.config, options.root)
  const source = isAbsolute(options.config) ? options.config : resolve(workspace, options.config)
  const authored = JSON.parse(io.read(realpathSync(source))) as unknown
  if (!options.fromGit) return { workspace, config: authored }
  const packagePath = (authored as { npmPackage?: { path?: string } } | null)?.npmPackage?.path ?? "."
  const config = resolveConfig(authored, observeGitFacts(workspace, io, packagePath))
  // Advisory output: the reviewable IR of what was actually planned. No command
  // ever reads it back.
  io.write(resolve(cwd, options.emitResolved ?? RESOLVED_CONFIG), encodeResolvedConfig(config))
  return { workspace, config }
}

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
  const { config, workspace } = loadConfig(options, cwd, io)
  const result = await api.plan({ config, workspace })
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
            executionReviewId: ExecutionReviewId.make(options.confirmExecution!),
            reviewer: options.reviewer,
            ...(options.reason === undefined ? {} : { reason: options.reason })
          }
        }),
    ...(options.through === undefined ? {} : {
      through: Schema.decodeUnknownSync(Stage)(options.through)
    }),
    ...(options.confirmPublish === undefined ? {} : {
      publishConfirmation: {
        publishReviewId: PublishReviewId.make(options.confirmPublish), reviewer: options.reviewer
      }
    }),
    ...(options.reconcile === undefined ? {} : {
      reconcile: options.reconcile.split(",").filter(Boolean).map((id) => OperationId.make(id))
    }),
    ...(resolutionItems === undefined ? {} : { resolutions: resolutionItems }),
    ...(options.retry === undefined ? {} : {
      retry: options.retry.split(",").filter(Boolean).map((id) => OperationId.make(id))
    })
  }
}
// Stage rows in plan order. Every operation carries an id and a tag, which is
// all the conspicuous surface needs; the app does not re-decode plan bytes and
// does not own the taxonomy.
type StageOperation = { readonly id: OperationId, readonly _tag: string }
const stageRows = (plan: ReleasePlanV6): ReadonlyArray<readonly [string, ReadonlyArray<StageOperation>]> => [
  ["build", plan.stages.build], ["process", plan.stages.process], ["catalog", plan.stages.catalog],
  ["validate", plan.stages.validate], ["publish", plan.stages.publish],
  ["announce", plan.stages.announce], ["verify", plan.stages.verify]
]
// SPEC §8: trusted execution and remote publication stay conspicuous in review
// surfaces. `ship` replaces the human PAUSE, never the display.
//
// The derivation is structural and exact, not a copy of the authority table:
// `Exec` is the only LocalExec mechanism anywhere, and the publish and announce
// stages admit exactly `Exec` plus RemotePublish mechanisms (src/model/
// operation.ts) — so a publish-or-announce operation that is not `Exec` reaches
// the wire, and nothing else does.
const conspicuous = (plan: ReleasePlanV6, executionReviewId: string): string => {
  const rows = stageRows(plan)
  const wire = [...plan.stages.publish, ...plan.stages.announce] as ReadonlyArray<StageOperation>
  return JSON.stringify({
    review: "execution",
    executionReviewId,
    stages: Object.fromEntries(rows.map(([name, operations]) => [name, operations.length])),
    exec: rows.flatMap(([, operations]) =>
      operations.filter((operation) => operation._tag === "Exec").map((operation) => operation.id)
    ),
    remotePublish: wire.filter((operation) => operation._tag !== "Exec").map((operation) => operation.id)
  })
}

// `io.log` is stdout and the CLI runtime reports a thrown error on stderr with
// a nonzero exit, so the continuation guidance travels IN the error rather than
// through a channel this app does not have. Paths are absolute because `--out`
// resolves against the CWD while the runs path resolves against the WORKSPACE:
// with `--root` elsewhere, a relative hint would be wrong from the reader's
// shell.
const stagedContinuation = (
  planPath: string, planId: string, runs: string, workspace: string, publishSide: boolean
): string =>
  [
    "",
    "Next steps — the staged flow continues this exact run:",
    `  ts-release apply ${planPath} --plan-id ${planId} --resume ${runs} --root ${workspace} --reviewer <you>`,
    ...(publishSide
      ? [
        "  # publication outcome in doubt — observe, judge, or re-attempt:",
        `  #   --reconcile <operationIds>   read the remote and record what is there`,
        `  #   --resolutions '[{"operationId":"<id>","outcome":"committed|absent","operator":"<you>","reason":"<why>"}]'`,
        `  #   --retry <operationIds>       re-attempt an outcome proven absent`
      ]
      : [])
  ].join("\n")

export const runShip = async (
  api: ReleaseCommands,
  options: ShipOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const workspace = selectCliWorkspace(cwd, options.config, options.root)
  const runs = resolve(workspace, options.runs)
  const planPath = resolve(cwd, options.out)
  const executionScope = scope(options.scope)
  let planId = "<planId>"
  let publishSide = false
  try {
    const planned = await api.plan({ config: loadConfig(options, cwd, io).config, workspace })
    planId = planned.planId
    // Always written: it is the review artifact, and it is what a staged
    // `apply` continues from if anything below stops.
    io.write(planPath, planned.bytes)
    io.log(JSON.stringify({ planId: planned.planId }))

    const accepted = { planBytes: planned.bytes, expectedPlanId: planned.planId }
    const review = await api.reviewExecution({ ...accepted, scope: executionScope })
    io.log(conspicuous(planned.plan, review.executionReviewId))

    const materialized = await api.apply({
      ...accepted,
      workspace,
      through: Schema.decodeUnknownSync(Stage)("validate"),
      newRun: {
        path: options.runs, scope: executionScope,
        executionReviewId: review.executionReviewId, reviewer: SELF_REVIEWER,
        ...(options.reason === undefined ? {} : { reason: options.reason })
      }
    })
    publishSide = true
    io.log(JSON.stringify({
      status: materialized.status, runId: materialized.runId, runPath: materialized.runPath,
      executionReceiptId: materialized.executionReceiptId,
      ...(materialized.nextPublishReviewId === undefined ? {} : {
        publishReviewId: materialized.nextPublishReviewId
      })
    }))

    const result = materialized.nextPublishReviewId === undefined ? materialized : await api.apply({
      ...accepted,
      workspace,
      resumeRunPath: options.runs,
      through: Schema.decodeUnknownSync(Stage)("verify"),
      publishConfirmation: {
        publishReviewId: materialized.nextPublishReviewId, reviewer: SELF_REVIEWER
      }
    })
    // The staged CLI writes no sidecar because its caller scripts the chain and
    // holds every output; a one-shot user has no other machine-readable summary.
    const evidencePath = `${result.runPath}.evidence.json`
    io.write(evidencePath, `${JSON.stringify(result.evidence, null, 2)}\n`)
    io.log(JSON.stringify({
      mode: "one-shot", status: result.status, runId: result.runId, runPath: result.runPath,
      executionReceiptId: result.executionReceiptId,
      ...(result.publishReceiptId === undefined ? {} : { publishReceiptId: result.publishReceiptId }),
      evidencePath
    }))
    if (result.status !== "complete") {
      throw new Error(`Run stopped at frontier ${result.evidence.frontier} with status ${result.status}.`)
    }
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    // A duplicate logical run is the one refusal with a second legitimate
    // answer, so it carries both.
    const duplicate = reason.includes("Logical run already exists")
      ? "\nOr start a new logical run with --reason <why>."
      : ""
    throw new Error(
      `${reason}${stagedContinuation(planPath, planId, runs, workspace, publishSide)}${duplicate}`,
      { cause }
    )
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
