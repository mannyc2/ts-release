import { existsSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import type { ReleaseApi } from "@mannyc1/ts-release"

export const actionCommands = ["prepare", "publish", "inspect", "correct"] as const
export const actionOutputs = ["status", "prepared_path", "report_path"] as const
export type ActionCommand = typeof actionCommands[number]

export interface ActionRuntime {
  readonly workspace: string
  readonly input: (name: string) => string
  readonly output: (name: typeof actionOutputs[number], value: string) => void
  readonly read: (path: string) => string
  readonly write: (path: string, value: string) => void
}

const reportRelativePath = ".release/ts-release/action-report.json"
const preparedRelativePath = ".release/ts-release/prepared"

export const inside = (root: string, candidate: string): string => {
  const child = relative(root, candidate)
  if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error("Action path is outside GITHUB_WORKSPACE.")
  return candidate
}

const pathInWorkspace = (root: string, value: string, mustExist: boolean): string => {
  const candidate = inside(root, resolve(root, value))
  if (!mustExist) return candidate
  if (!existsSync(candidate)) throw new Error(`Action path does not exist: ${value}`)
  return inside(root, realpathSync(candidate))
}

const present = (value: string): boolean => value.length > 0
const fail = (reason: string): never => { throw new Error(reason) }
const command = (value: string): ActionCommand => {
  if ((actionCommands as ReadonlyArray<string>).includes(value)) return value as ActionCommand
  return fail(`Action command must be one of ${actionCommands.join(", ")}.`)
}
const configJson = (runtime: ActionRuntime, path: string): unknown => {
  try { return JSON.parse(runtime.read(path)) as unknown } catch (cause) {
    throw new Error(`Action configuration is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}
const token = (...names: ReadonlyArray<string>): string | undefined => {
  for (const name of names) {
    const value = process.env[name]
    if (value !== undefined && value.length > 0) return value
  }
  return undefined
}
const credentials = (): NonNullable<Parameters<ReleaseApi["publish"]>[0]["credentials"]> | undefined => {
  const npm = token("NPM_TOKEN")
  const github = token("GITHUB_TOKEN", "GH_TOKEN")
  if (npm === undefined && github === undefined) return undefined
  return {
    ...(npm === undefined ? {} : { npm: { read: npm, publish: npm } }),
    ...(github === undefined ? {} : { github: { read: github, publish: github } })
  }
}
const publishInput = (prepared: string): Parameters<ReleaseApi["publish"]>[0] => {
  const value = credentials()
  return value === undefined ? { prepared } : { prepared, credentials: value }
}
const correctInput = (prepared: string, correction: string): Parameters<ReleaseApi["correct"]>[0] => {
  const value = credentials()
  return value === undefined ? { prepared, correction } : { prepared, correction, credentials: value }
}
const redact = (value: string): string => {
  const secrets = [process.env.NPM_TOKEN, process.env.GITHUB_TOKEN, process.env.GH_TOKEN]
    .filter((secret): secret is string => secret !== undefined && secret.length > 0)
  return secrets.reduce((result, secret) => result.replaceAll(secret, "[REDACTED]"), value)
    .replace(/(?:npm|ghp|ghs|github_pat)_[A-Za-z0-9_]+/gu, "[REDACTED]")
}
const printable = (value: unknown): string => JSON.stringify(value, (_key, nested) => {
  if (typeof nested === "object" && nested !== null && "toString" in nested && Object.keys(nested).length === 1) return String(nested)
  return nested
}, 2)
const reportPath = (root: string): string => inside(root, resolve(root, reportRelativePath))
const writeReport = (runtime: ActionRuntime, root: string, value: unknown): string => {
  const path = reportPath(root)
  runtime.write(path, `${redact(printable(value))}\n`)
  runtime.output("report_path", path)
  return path
}
const rejectExtra = (values: Record<string, string>, allowed: ReadonlyArray<string>): void => {
  for (const [name, value] of Object.entries(values)) if (present(value) && !allowed.includes(name)) {
    fail(`Action input '${name}' is not valid for command '${values.command}'.`)
  }
}

export const runAction = async (
  api: Pick<ReleaseApi, "prepare" | "publish" | "inspect" | "correct">,
  runtime: ActionRuntime
): Promise<void> => {
  const root = realpathSync(runtime.workspace)
  const values = {
    command: runtime.input("command"), config: runtime.input("config"),
    prepared: runtime.input("prepared"), correction: runtime.input("correction")
  }
  try {
    const selected = command(values.command)
    rejectExtra(values, selected === "prepare" ? ["command", "config"] : selected === "inspect" ? ["command", "config", "prepared"] : selected === "publish" ? ["command", "prepared"] : ["command", "prepared", "correction"])
    if (selected === "inspect" && present(values.config) === present(values.prepared)) fail("inspect requires exactly one of config or prepared.")
    const actionResult = selected === "prepare"
      ? await api.prepare({
        config: configJson(runtime, pathInWorkspace(root, values.config || fail("prepare requires config."), true)),
        workspace: root, preparedDirectory: pathInWorkspace(root, preparedRelativePath, false)
      })
      : selected === "inspect"
      ? values.prepared.length > 0
        ? await api.inspect({ prepared: pathInWorkspace(root, values.prepared, true) })
        : await api.inspect({
          config: configJson(runtime, pathInWorkspace(root, values.config || fail("inspect requires config or prepared."), true)), workspace: root
        })
      : selected === "publish"
      ? await api.publish(publishInput(pathInWorkspace(root, values.prepared || fail("publish requires prepared."), true)))
      : await api.correct(correctInput(
        pathInWorkspace(root, values.prepared || fail("correct requires prepared."), true),
        pathInWorkspace(root, values.correction || fail("correct requires correction."), true)
      ))
    const report = { schemaVersion: "ts-release-action-report/v1", command: selected, status: "complete", result: actionResult }
    if (selected === "prepare") runtime.output("prepared_path", (actionResult as { readonly directory: string }).directory)
    writeReport(runtime, root, report)
    runtime.output("status", "complete")
  } catch (cause) {
    const message = redact(cause instanceof Error ? cause.message : String(cause))
    try { writeReport(runtime, root, { schemaVersion: "ts-release-action-report/v1", command: values.command, status: "failed", error: message }) } catch { /* preserve the primary Action error */ }
    runtime.output("status", "failed")
    throw new Error(message)
  }
}
