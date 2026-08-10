import * as Effect from "effect/Effect"
import * as Argument from "effect/unstable/cli/Argument"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { commandNames, runCorrect, runInit, runInspect, runPrepare, runPublish, runRelease, type CliApi, type CliIo } from "./commands.js"

export { commandNames, type CliApi, type CliIo } from "./commands.js"
const text = (name: string, fallback?: string) => fallback === undefined ? Flag.string(name) : Flag.string(name).pipe(Flag.withDefault(fallback))
const optionalText = (name: string) => Flag.string(name).pipe(Flag.optional)
const at = <A>(value: import("effect/Option").Option<A>): A | undefined => value._tag === "Some" ? value.value : undefined

const initCommand = (api: CliApi, cwd: string, io: CliIo) => Command.make("init", {
  config: text("config", "release.config.json"), root: text("root", "."), dryRun: Flag.boolean("dry-run").pipe(Flag.withDefault(false)), force: Flag.boolean("force").pipe(Flag.withDefault(false))
}, (options) => Effect.promise(() => runInit(api, options, cwd, io))).pipe(Command.withDescription("Create the smallest authored release configuration."))
const inspectCommand = (api: CliApi, cwd: string, io: CliIo) => Command.make("inspect", {
  config: optionalText("config"), prepared: optionalText("prepared"), root: text("root", "."),
  json: Flag.boolean("json").pipe(Flag.withDefault(false))
}, (options) => Effect.promise(() => {
  const config = at(options.config)
  const prepared = at(options.prepared)
  return runInspect(api, { root: options.root, ...(config === undefined ? {} : { config }), ...(prepared === undefined ? {} : { prepared }) }, cwd, io)
})).pipe(Command.withDescription("Inspect authored configuration or a prepared release."))
const prepareCommand = (api: CliApi, cwd: string, io: CliIo) => Command.make("prepare", {
  config: text("config", "release.config.json"), root: text("root", "."), out: optionalText("out")
}, (options) => Effect.promise(() => {
  const out = at(options.out)
  return runPrepare(api, { config: options.config, root: options.root, ...(out === undefined ? {} : { out }) }, cwd, io)
})).pipe(Command.withDescription("Build and store an exact prepared release bundle."))
const publishCommand = (api: CliApi, cwd: string, io: CliIo) => Command.make("publish", {
  prepared: Argument.string("prepared").pipe(Argument.withDescription("Prepared release bundle directory."))
}, (options) => Effect.promise(() => runPublish(api, { prepared: options.prepared }, cwd, io))).pipe(Command.withDescription("Observe and publish one prepared release."))
const releaseCommand = (api: CliApi, cwd: string, io: CliIo) => Command.make("release", {
  config: text("config", "release.config.json"), root: text("root", "."), out: optionalText("out")
}, (options) => Effect.promise(() => {
  const out = at(options.out)
  return runRelease(api, { config: options.config, root: options.root, ...(out === undefined ? {} : { out }) }, cwd, io)
})).pipe(Command.withDescription("Prepare and publish automatically."))
const correctCommand = (api: CliApi, cwd: string, io: CliIo) => Command.make("correct", {
  prepared: Argument.string("prepared").pipe(Argument.withDescription("Prepared release bundle directory.")), correction: Argument.string("correction").pipe(Argument.withDescription("Canonical correction intent file."))
}, (options) => Effect.promise(() => runCorrect(api, options, cwd, io))).pipe(Command.withDescription("Apply one provider-specific forward correction."))

export const makeCli = (api: CliApi, cwd: string, io: CliIo) => Command.make("ts-release").pipe(
  Command.withDescription("Deterministic preparation, publication, and correction."),
  Command.withSubcommands([
    initCommand(api, cwd, io), inspectCommand(api, cwd, io), prepareCommand(api, cwd, io),
    publishCommand(api, cwd, io), releaseCommand(api, cwd, io), correctCommand(api, cwd, io)
  ])
)
