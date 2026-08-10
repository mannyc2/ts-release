import { mkdirSync, realpathSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import type { ReleaseApi } from "@mannyc1/ts-release"

export const actionCommands = ["release"] as const
export const actionOutputs = ["prepared", "status"] as const
export interface ActionRuntime {
  readonly workspace: string
  readonly input: (name: string) => string
  readonly output: (name: typeof actionOutputs[number], value: string) => void
  readonly read: (path: string) => string
  readonly write: (path: string, value: string) => void
}

export const inside = (root: string, candidate: string): string => {
  const child = relative(root, candidate)
  if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error("Action path is outside GITHUB_WORKSPACE.")
  return candidate
}
const pathInWorkspace = (root: string, value: string): string => inside(root, resolve(root, value))

export const runAction = async (api: Pick<ReleaseApi, "release">, runtime: ActionRuntime): Promise<void> => {
  const root = realpathSync(runtime.workspace)
  const configPath = pathInWorkspace(root, runtime.input("config") || "release.config.json")
  const output = runtime.input("prepared") || ".release/ts-release/prepared"
  const preparedDirectory = resolve(root, output)
  mkdirSync(dirname(preparedDirectory), { recursive: true })
  const npmToken = runtime.input("npm-token") || process.env.NPM_TOKEN
  const githubToken = runtime.input("github-token") || process.env.GITHUB_TOKEN
  const result = await api.release({
    config: JSON.parse(runtime.read(configPath)) as unknown, workspace: root, preparedDirectory,
    ...(npmToken === undefined && githubToken === undefined ? {} : {
      credentials: {
        ...(npmToken === undefined ? {} : { npm: { read: npmToken, publish: npmToken } }),
        ...(githubToken === undefined ? {} : { github: { read: githubToken, publish: githubToken } })
      }
    })
  })
  runtime.output("prepared", result.prepared.directory)
  runtime.output("status", "complete")
}
