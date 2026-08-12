import { realpathSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import type { InspectOutput, ReleaseApi } from "@mannyc1/ts-release"

export const commandNames = ["init", "inspect", "prepare", "publish", "release", "correct"] as const
export interface CliIo { readonly read: (path: string) => string, readonly write: (path: string, value: string) => void, readonly log: (value: string) => void }
export type CliApi = Pick<ReleaseApi, "inspect" | "prepare" | "publish" | "release" | "correct">

const json = (io: CliIo, path: string): unknown => JSON.parse(io.read(realpathSync(path))) as unknown
const pathFrom = (cwd: string, value: string): string => isAbsolute(value) ? value : resolve(cwd, value)
const workspaceFor = (cwd: string, config: string, root: string | undefined): string => realpathSync(root === undefined ? isAbsolute(config) ? dirname(pathFrom(cwd, config)) : cwd : pathFrom(cwd, root))

export type InitPreset = "bun-npm-github"
export interface InitOptions {
  readonly config: string
  readonly root: string
  readonly dryRun: boolean
  readonly force: boolean
  readonly preset?: InitPreset
  readonly prepareOnly: boolean
}
export interface InspectOptions { readonly config?: string, readonly prepared?: string, readonly root: string }
export interface PrepareOptions { readonly config: string, readonly root: string, readonly out?: string }
export interface PublishOptions { readonly prepared: string }
export interface ReleaseOptions { readonly config: string, readonly root: string, readonly out?: string }
export interface CorrectOptions { readonly prepared: string, readonly correction: string }

const printInspection = (io: CliIo, result: InspectOutput): void => io.log(JSON.stringify(result, (_key, value) => typeof value === "object" && value !== null && "toString" in value && Object.keys(value).length === 1 ? String(value) : value))

export const runInit = async (api: CliApi, options: InitOptions, cwd: string, io: CliIo): Promise<void> => {
  if (options.preset === undefined && !options.prepareOnly) {
    throw new Error("Noninteractive init requires --preset bun-npm-github or --prepare-only; it never prompts or creates a green no-op release.")
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
    try { io.read(output); throw new Error(`Refusing to overwrite ${output}; pass --force.`) } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("Refusing")) throw cause
    }
  }
  const contents = `${JSON.stringify(config, null, 2)}\n`
  if (!options.dryRun) io.write(output, contents)
  io.log(JSON.stringify({ path: output, written: !options.dryRun }))
}

export const runInspect = async (api: CliApi, options: InspectOptions, cwd: string, io: CliIo): Promise<void> => {
  const result = await api.inspect({
    ...(options.config === undefined ? {} : { config: json(io, pathFrom(cwd, options.config)) }),
    ...(options.prepared === undefined ? {} : { prepared: pathFrom(cwd, options.prepared) }),
    ...(options.config === undefined ? {} : { workspace: realpathSync(pathFrom(cwd, options.root)) })
  })
  printInspection(io, result)
}

export const runPrepare = async (api: CliApi, options: PrepareOptions, cwd: string, io: CliIo): Promise<void> => {
  const result = await api.prepare({ config: json(io, pathFrom(cwd, options.config)), workspace: realpathSync(pathFrom(cwd, options.root)), ...(options.out === undefined ? {} : { preparedDirectory: pathFrom(cwd, options.out) }) })
  io.log(JSON.stringify({ prepared: result.directory }))
}

export const runPublish = async (api: CliApi, options: PublishOptions, cwd: string, io: CliIo): Promise<void> => {
  const result = await api.publish({ prepared: pathFrom(cwd, options.prepared) })
  io.log(JSON.stringify(result))
}

export const runRelease = async (api: CliApi, options: ReleaseOptions, cwd: string, io: CliIo): Promise<void> => {
  const result = await api.release({ config: json(io, pathFrom(cwd, options.config)), workspace: realpathSync(pathFrom(cwd, options.root)), ...(options.out === undefined ? {} : { preparedDirectory: pathFrom(cwd, options.out) }) })
  io.log(JSON.stringify({ prepared: result.prepared.directory, publications: result.publications }))
}

export const runCorrect = async (api: CliApi, options: CorrectOptions, cwd: string, io: CliIo): Promise<void> => {
  const result = await api.correct({ prepared: pathFrom(cwd, options.prepared), correction: pathFrom(cwd, options.correction) })
  io.log(JSON.stringify(result))
}
