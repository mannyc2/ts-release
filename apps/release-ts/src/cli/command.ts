import * as Effect from "effect/Effect"
import * as Argument from "effect/unstable/cli/Argument"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import {
  commandNames,
  decodeLocalPreparedReference,
  defaultStoreDirectory,
  resolveStoreDirectory,
  runCorrect,
  runInit,
  runInspect,
  runObserve,
  runPrepare,
  runPublish,
  runRelease,
  type CliApi,
  type CliApiFactory,
  type CliIo
} from "./commands.js"

export {
  commandNames,
  type CliApi,
  type CliApiFactory,
  type CliIo
} from "./commands.js"

const text = (name: string, fallback?: string) => fallback === undefined
  ? Flag.string(name)
  : Flag.string(name).pipe(Flag.withDefault(fallback))

const optionalText = (name: string) => Flag.string(name).pipe(Flag.optional)
const optionalArgument = (name: string) => Argument.string(name).pipe(Argument.optional)

const at = <A>(value: import("effect/Option").Option<A>): A | undefined =>
  value._tag === "Some" ? value.value : undefined

const promise = <A>(evaluate: () => Promise<A>) => Effect.tryPromise({
  try: evaluate,
  catch: (cause) => cause
})

export const makeCli = (
  makeApi: CliApiFactory,
  cwd: string,
  io: CliIo
) => {
  const application = Command.make("ts-release").pipe(
    Command.withDescription("Deterministic preparation, publication, and correction."),
    Command.withSharedFlags({
      store: text("store", defaultStoreDirectory(cwd))
    })
  )

  const withApi = (operation: (api: CliApi) => Promise<void>) => Effect.gen(function*() {
    const { store } = yield* application
    const api = yield* Effect.try({
      try: () => makeApi(resolveStoreDirectory(cwd, store)),
      catch: (cause) => cause
    })
    yield* Effect.acquireUseRelease(
      Effect.succeed(api),
      () => promise(() => operation(api)),
      () => Effect.promise(() => api.dispose())
    )
  })

  const decode = (value: string) => promise(() => decodeLocalPreparedReference(value))

  const initCommand = Command.make("init", {
    config: text("config", "release.config.json"),
    root: text("root", "."),
    dryRun: Flag.boolean("dry-run").pipe(Flag.withDefault(false)),
    force: Flag.boolean("force").pipe(Flag.withDefault(false)),
    preset: Flag.choice("preset", ["bun-npm-github"] as const).pipe(Flag.optional),
    prepareOnly: Flag.boolean("prepare-only").pipe(Flag.withDefault(false))
  }, (options) => {
    const preset = at(options.preset) as "bun-npm-github" | undefined
    const { preset: _preset, ...rest } = options
    return withApi((api) => runInit(
      api,
      { ...rest, ...(preset === undefined ? {} : { preset }) },
      cwd,
      io
    ))
  }).pipe(Command.withDescription(
    "Create an explicit automatic-release preset or a preparation-only configuration."
  ))

  const inspectCommand = Command.make("inspect", {
    prepared: optionalArgument("prepared"),
    config: optionalText("config"),
    root: text("root", ".")
  }, (options) => Effect.gen(function*() {
    const preparedText = at(options.prepared)
    const prepared = preparedText === undefined
      ? undefined
      : yield* decode(preparedText)
    const config = at(options.config)
    yield* withApi((api) => runInspect(api, {
      root: options.root,
      ...(config === undefined ? {} : { config }),
      ...(prepared === undefined ? {} : { prepared })
    }, cwd, io))
  })).pipe(Command.withDescription("Inspect authored configuration or a prepared release."))

  const prepareCommand = Command.make("prepare", {
    config: text("config", "release.config.json"),
    root: text("root", ".")
  }, (options) => withApi((api) => runPrepare(api, options, cwd, io))).pipe(
    Command.withDescription("Build and durably store an exact prepared release bundle.")
  )

  const observeCommand = Command.make("observe", {
    prepared: Argument.string("prepared").pipe(
      Argument.withDescription("Canonical local prepared reference.")
    )
  }, (options) => Effect.gen(function*() {
    const prepared = yield* decode(options.prepared)
    yield* withApi((api) => runObserve(api, { prepared }, cwd, io))
  })).pipe(Command.withDescription("Observe a prepared release without mutation."))

  const publishCommand = Command.make("publish", {
    prepared: Argument.string("prepared").pipe(
      Argument.withDescription("Canonical local prepared reference.")
    )
  }, (options) => Effect.gen(function*() {
    const prepared = yield* decode(options.prepared)
    yield* withApi((api) => runPublish(api, { prepared }, cwd, io))
  })).pipe(Command.withDescription("Observe and publish one prepared release."))

  const releaseCommand = Command.make("release", {
    config: text("config", "release.config.json"),
    root: text("root", ".")
  }, (options) => withApi((api) => runRelease(api, options, cwd, io))).pipe(
    Command.withDescription("Prepare, durably store, and publish automatically.")
  )

  const correctCommand = Command.make("correct", {
    prepared: Argument.string("prepared").pipe(
      Argument.withDescription("Canonical local prepared reference.")
    ),
    correction: Argument.string("correction").pipe(
      Argument.withDescription("Authored correction file.")
    )
  }, (options) => Effect.gen(function*() {
    const prepared = yield* decode(options.prepared)
    yield* withApi((api) => runCorrect(api, {
      prepared,
      correction: options.correction
    }, cwd, io))
  })).pipe(Command.withDescription("Apply one provider-specific forward correction."))

  return application.pipe(Command.withSubcommands([
    initCommand,
    inspectCommand,
    prepareCommand,
    observeCommand,
    publishCommand,
    releaseCommand,
    correctCommand
  ]))
}
