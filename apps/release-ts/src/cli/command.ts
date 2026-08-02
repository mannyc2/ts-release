// Invariant: this module only declares argv shape and delegates; release policy
// stays behind the api object handed to makeCli.
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Argument from "effect/unstable/cli/Argument"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import type { ReleaseApi } from "@mannyc1/ts-release"
import {
  runApply,
  runInit,
  runPlan,
  runReview,
  runShip,
  type CliIo
} from "./commands.js"

export { commandNames, selectCliWorkspace, SELF_REVIEWER, type CliIo } from "./commands.js"

type ReleaseCommands = Pick<ReleaseApi, "plan" | "reviewExecution" | "apply">
const optionalText = (name: string) => Flag.string(name).pipe(Flag.optional)
const text = (name: string, fallback: string) =>
  Flag.string(name).pipe(Flag.withDefault(fallback))
const planArgument = Argument.string("plan").pipe(
  Argument.withDescription("Canonical release plan file.")
)
const planIdFlag = Flag.string("plan-id").pipe(
  Flag.withDescription("Expected PlanId of the supplied plan bytes.")
)
const scopeFlag = optionalText("scope")
const rootFlag = text("root", ".")
const at = <A>(value: Option.Option<A>): A | undefined => Option.getOrUndefined(value)

const initCommand = (cwd: string, io: CliIo) => Command.make("init", {
  template: text("template", "npm-only"),
  config: text("config", "release.config.json"),
  root: rootFlag,
  package: text("package", "@scope/pkg"),
  repo: text("repo", "owner/repo"),
  tap: text("tap", "owner/homebrew-tap"),
  bucket: text("bucket", "owner/scoop-bucket"),
  write: Flag.boolean("write").pipe(Flag.withDefault(false))
}, (options) => Effect.sync(() => runInit(options, cwd, io))).pipe(
  Command.withDescription("Render a template release config.")
)
const planCommand = (api: ReleaseCommands, cwd: string, io: CliIo) => Command.make("plan", {
  config: text("config", "release.config.json"),
  root: optionalText("root"),
  out: optionalText("out")
}, (options) => Effect.promise(() => runPlan(api, {
  config: options.config, root: at(options.root), out: at(options.out)
}, cwd, io))).pipe(
  Command.withDescription("Compile a config into canonical release plan bytes.")
)
const doctorCommand = (api: ReleaseCommands, cwd: string, io: CliIo) => Command.make("doctor", {
  plan: planArgument,
  planId: planIdFlag,
  scope: scopeFlag
}, (options) => Effect.promise(() => runReview(api, {
  plan: options.plan, planId: options.planId, scope: at(options.scope), doctor: true
}, cwd, io))).pipe(
  Command.withDescription("Validate plan bytes and derive the execution review challenge.")
)
const applyCommand = (api: ReleaseCommands, cwd: string, io: CliIo) => Command.make("apply", {
  plan: planArgument,
  planId: planIdFlag,
  scope: scopeFlag,
  root: rootFlag,
  reviewOnly: Flag.boolean("review-only").pipe(Flag.withDefault(false)),
  reviewer: optionalText("reviewer"),
  newRun: Flag.string("new-run").pipe(
    Flag.withDescription("Directory that stores run ledgers; the file name is the derived logical-run id."),
    Flag.optional
  ),
  resume: Flag.string("resume").pipe(
    Flag.withDescription("Run-ledger file, or a runs directory holding exactly one."),
    Flag.optional
  ),
  confirmExecution: optionalText("confirm-execution"),
  confirmPublish: optionalText("confirm-publish"),
  through: optionalText("through"),
  reason: optionalText("reason"),
  reconcile: optionalText("reconcile"),
  resolutions: optionalText("resolutions"),
  retry: optionalText("retry")
}, (options) => Effect.promise(() => options.reviewOnly
  ? runReview(api, {
      plan: options.plan, planId: options.planId, scope: at(options.scope), doctor: false
    }, cwd, io)
  : runApply(api, {
      plan: options.plan, planId: options.planId, root: options.root,
      scope: at(options.scope), reviewer: at(options.reviewer), newRun: at(options.newRun),
      resume: at(options.resume), confirmExecution: at(options.confirmExecution),
      confirmPublish: at(options.confirmPublish), through: at(options.through),
      reason: at(options.reason), reconcile: at(options.reconcile),
      resolutions: at(options.resolutions), retry: at(options.retry)
    }, cwd, io))).pipe(
  Command.withDescription("Execute an approved plan against a durable run ledger.")
)
const shipCommand = (api: ReleaseCommands, cwd: string, io: CliIo) => Command.make("ship", {
  config: text("config", "release.config.json"),
  root: optionalText("root"),
  out: text("out", ".release/release-plan.json"),
  runs: text("runs", ".release/runs"),
  scope: scopeFlag,
  reason: optionalText("reason")
}, (options) => Effect.promise(() => runShip(api, {
  config: options.config, root: at(options.root), out: options.out, runs: options.runs,
  scope: at(options.scope), reason: at(options.reason)
}, cwd, io))).pipe(
  Command.withDescription(
    "Plan, self-confirm, and apply in one process; records reviewer self:one-shot. Use plan/apply for independently reviewed releases."
  )
)

export const makeCli = (api: ReleaseCommands, cwd: string, io: CliIo) =>
  Command.make("ts-release").pipe(
    Command.withDescription("Portable artifact and package-manager distribution planning."),
    Command.withSubcommands([
      initCommand(cwd, io),
      doctorCommand(api, cwd, io),
      planCommand(api, cwd, io),
      applyCommand(api, cwd, io),
      shipCommand(api, cwd, io)
    ])
  )
