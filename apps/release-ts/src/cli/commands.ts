import {
  ReleaseAbortedError,
  ReleaseIncompleteError,
  ReleasePreparationError,
  decodeCompletePreparedReleaseRef,
  encodeCompletePreparedReleaseRef,
  type CompletePreparedReleaseRef,
  type CorrectInput,
  type InspectOutput,
  type LocalCompletePreparedReleaseRef,
  type ReleaseApi
} from "@mannyc1/ts-release"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { realpathSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"

export const commandNames = [
  "init",
  "inspect",
  "prepare",
  "observe",
  "publish",
  "release",
  "correct"
] as const

export interface CliIo {
  readonly read: (path: string) => string
  readonly write: (path: string, value: string) => void
  readonly log: (value: string) => void
}

export type CliApi = Pick<
  ReleaseApi,
  "inspect" | "prepare" | "observe" | "publish" | "release" | "correct"
>

export type DisposableCliApi = CliApi & Pick<ReleaseApi, "dispose">
export type CliApiFactory = (storeDirectory: string) => DisposableCliApi

export class HostedPreparedReferenceUnsupported
  extends Schema.TaggedErrorClass<HostedPreparedReferenceUnsupported>()(
    "HostedPreparedReferenceUnsupported",
    {
      prepared: Schema.String,
      reason: Schema.String
    }
  ) {}

const json = (io: CliIo, path: string): unknown =>
  JSON.parse(io.read(realpathSync(path))) as unknown

const pathFrom = (cwd: string, value: string): string =>
  isAbsolute(value) ? value : resolve(cwd, value)

const workspaceFor = (cwd: string, config: string, root: string | undefined): string =>
  realpathSync(root === undefined
    ? isAbsolute(config)
      ? dirname(pathFrom(cwd, config))
      : cwd
    : pathFrom(cwd, root))

export const defaultStoreDirectory = (cwd: string): string =>
  resolve(cwd, ".release", "ts-release", "prepared")

export const resolveStoreDirectory = (cwd: string, value: string): string =>
  pathFrom(cwd, value)

const requireLocalPreparedReference = (
  prepared: CompletePreparedReleaseRef
): LocalCompletePreparedReleaseRef => {
  if (prepared.scheme === "local") return prepared
  const encoded = encodeCompletePreparedReleaseRef(prepared)
  throw new HostedPreparedReferenceUnsupported({
    prepared: encoded,
    reason: "This reference is loadable by a workflow job with actions:read; " +
      "re-run the failed run's publish job or dispatch the recovery workflow " +
      `with prepared-ref=${encoded}.`
  })
}

export const decodeLocalPreparedReference = async (
  value: string
): Promise<LocalCompletePreparedReleaseRef> => requireLocalPreparedReference(
  await Effect.runPromise(decodeCompletePreparedReleaseRef(value))
)

export type InitPreset = "bun-npm-github"

export interface InitOptions {
  readonly config: string
  readonly root: string
  readonly dryRun: boolean
  readonly force: boolean
  readonly preset?: InitPreset
  readonly prepareOnly: boolean
}

export interface InspectOptions {
  readonly config?: string
  readonly prepared?: LocalCompletePreparedReleaseRef
  readonly root: string
}

export interface PrepareOptions {
  readonly config: string
  readonly root: string
}

export interface ObserveOptions {
  readonly prepared: LocalCompletePreparedReleaseRef
}

export interface PublishOptions {
  readonly prepared: LocalCompletePreparedReleaseRef
}

export interface ReleaseOptions {
  readonly config: string
  readonly root: string
}

export interface CorrectOptions {
  readonly prepared: LocalCompletePreparedReleaseRef
  readonly correction: string
}

const printJson = (io: CliIo, value: unknown): void =>
  io.log(JSON.stringify(value, (_key, item) =>
    typeof item === "object" && item !== null && "toString" in item && Object.keys(item).length === 1
      ? String(item)
      : item))

const scopeWarning =
  "publish re-observes every subject and mutates only what a provider decision authorizes; " +
  "conflicts and unobservable outcomes still require operator action."

const unknownStateWarning =
  "publish re-observes every subject; per-subject state is unknown until reobserved, " +
  "and mutation occurs only after a provider decision."

const resumeLine = (prepared: LocalCompletePreparedReleaseRef): string =>
  `Resume: ts-release publish ${encodeCompletePreparedReleaseRef(prepared)}`

const oneLine = (value: string): string => value.replace(/\s+/gu, " ").trim()

const printIncomplete = (
  io: CliIo,
  prepared: LocalCompletePreparedReleaseRef,
  status: "blocked" | "uncertain"
): never => {
  io.log(scopeWarning)
  io.log(resumeLine(prepared))
  throw new ReleaseIncompleteError({
    prepared,
    status,
    reason: `The release report is ${status}; inspect the emitted report before resuming.`
  })
}

const printCaughtFailure = (io: CliIo, cause: unknown): void => {
  if (cause instanceof ReleasePreparationError) {
    io.log(
      "No remote mutation was attempted. Fix " +
      `${cause._tag}: ${oneLine(cause.cause)} and rerun 'ts-release release'.`
    )
    return
  }
  if (cause instanceof ReleaseAbortedError && cause.prepared?.scheme === "local") {
    io.log(unknownStateWarning)
    io.log(resumeLine(cause.prepared))
  }
}

export const runInit = async (
  api: CliApi,
  options: InitOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  if (options.preset === undefined && !options.prepareOnly) {
    throw new Error(
      "Noninteractive init requires --preset bun-npm-github or --prepare-only; " +
      "it never prompts or creates a green no-op release."
    )
  }
  const workspace = realpathSync(pathFrom(cwd, options.root))
  const config = options.prepareOnly
    ? { project: {}, versionFrom: "manifest" as const, publish: {} }
    : {
      project: {},
      versionFrom: "manifest" as const,
      npmPackage: { path: "." },
      publish: {
        npm: {
          registry: "https://registry.npmjs.org",
          trustedPublishing: { provider: "github-actions" as const },
          access: "public" as const,
          provenance: true
        },
        github: { draft: true, prerelease: false }
      }
    }
  await api.inspect({ config, workspace })
  const output = pathFrom(workspace, options.config)
  if (!options.force) {
    try {
      io.read(output)
      throw new Error(`Refusing to overwrite ${output}; pass --force.`)
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("Refusing")) throw cause
    }
  }
  const contents = `${JSON.stringify(config, null, 2)}\n`
  if (!options.dryRun) io.write(output, contents)
  printJson(io, { path: output, written: !options.dryRun })
}

export const runInspect = async (
  api: CliApi,
  options: InspectOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  let result: InspectOutput
  if (options.prepared !== undefined) {
    if (options.config !== undefined) {
      throw new Error("inspect accepts a prepared reference or --config, not both.")
    }
    result = await api.inspect({ prepared: options.prepared })
  } else {
    const config = options.config ?? "release.config.json"
    result = await api.inspect({
      config: json(io, pathFrom(cwd, config)),
      workspace: workspaceFor(cwd, config, options.root)
    })
  }
  printJson(io, result)
}

export const runPrepare = async (
  api: CliApi,
  options: PrepareOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const prepared = requireLocalPreparedReference(await api.prepare({
    config: json(io, pathFrom(cwd, options.config)),
    workspace: workspaceFor(cwd, options.config, options.root)
  }))
  io.log(encodeCompletePreparedReleaseRef(prepared))
}

export const runObserve = async (
  api: CliApi,
  options: ObserveOptions,
  _cwd: string,
  io: CliIo
): Promise<void> => {
  printJson(io, await api.observe({ prepared: options.prepared }))
}

export const runPublish = async (
  api: CliApi,
  options: PublishOptions,
  _cwd: string,
  io: CliIo
): Promise<void> => {
  try {
    const report = await api.publish({ prepared: options.prepared })
    printJson(io, report)
    if (report.status !== "complete") {
      printIncomplete(io, options.prepared, report.status)
    }
  } catch (cause) {
    printCaughtFailure(io, cause)
    throw cause
  }
}

export const runRelease = async (
  api: CliApi,
  options: ReleaseOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  try {
    const result = await api.release({
      config: json(io, pathFrom(cwd, options.config)),
      workspace: workspaceFor(cwd, options.config, options.root)
    })
    const prepared = requireLocalPreparedReference(result.prepared)
    printJson(io, {
      prepared: encodeCompletePreparedReleaseRef(prepared),
      report: result.report
    })
    if (result.report.status !== "complete") {
      printIncomplete(io, prepared, result.report.status)
    }
  } catch (cause) {
    printCaughtFailure(io, cause)
    throw cause
  }
}

export const runCorrect = async (
  api: CliApi,
  options: CorrectOptions,
  cwd: string,
  io: CliIo
): Promise<void> => {
  const correctionPath = realpathSync(pathFrom(cwd, options.correction))
  const correction = json(io, correctionPath) as CorrectInput["correction"]
  printJson(io, await api.correct({ prepared: options.prepared, correction }))
}
