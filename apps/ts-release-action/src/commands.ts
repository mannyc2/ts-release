import { existsSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import type { ReleaseApi } from "@mannyc1/ts-release"

export const actionCommands = ["release", "prepare", "publish"] as const
export const actionInputs = ["command", "config", "prepared"] as const
export const actionOutputs = ["prepared-ref", "report-ref"] as const
export type ActionCommand = typeof actionCommands[number]
export type ActionOutput = typeof actionOutputs[number]

export interface PreparedReferenceChannel {
  readonly emit: (reference: string) => Promise<void>
  readonly current: () => string | undefined
}

export const makePreparedReferenceChannel = (input: {
  readonly output: (name: ActionOutput, value: string) => void
  readonly summarize: (message: string) => Promise<void>
}): PreparedReferenceChannel => {
  let current: string | undefined
  return {
    emit: async (reference) => {
      current = reference
      input.output("prepared-ref", reference)
      await input.summarize([
        `Prepared release: ${reference}`,
        "Recovery: re-run the failed publish job on this workflow run; artifacts persist across attempts."
      ].join("\n"))
    },
    current: () => current
  }
}

export interface ActionRuntime {
  readonly workspace: string
  readonly input: (name: typeof actionInputs[number]) => string
  readonly output: (name: ActionOutput, value: string) => void
  readonly read: (path: string) => string
  readonly write: (path: string, value: string) => void
  readonly resolvePrepared: (reference: string) => Promise<string>
  readonly preparedReference: PreparedReferenceChannel
  readonly summarize: (message: string) => Promise<void>
}

const reportRelativePath = ".release/ts-release/action-report.json"

export const inside = (root: string, candidate: string): string => {
  const child = relative(root, candidate)
  if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error("Action path is outside GITHUB_WORKSPACE.")
  }
  return candidate
}

const pathInWorkspace = (root: string, value: string): string => {
  const candidate = inside(root, resolve(root, value))
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
const redact = (value: string): string => value
  .replace(/(?:npm|ghp|ghs|github_pat)_[A-Za-z0-9_]+/gu, "[REDACTED]")
  .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/giu, "Bearer [REDACTED]")

const printable = (value: unknown): string => JSON.stringify(value, (_key, nested) => {
  if (typeof nested === "object" && nested !== null && "toString" in nested && Object.keys(nested).length === 1) {
    return String(nested)
  }
  return nested
}, 2)

const reportPath = (root: string): string => inside(root, resolve(root, reportRelativePath))
const writeReport = (runtime: ActionRuntime, root: string, value: unknown): void => {
  runtime.write(reportPath(root), `${redact(printable(value))}\n`)
  runtime.output("report-ref", reportRelativePath)
}

const rejectExtra = (values: Record<string, string>, allowed: ReadonlyArray<string>): void => {
  for (const [name, value] of Object.entries(values)) {
    if (present(value) && !allowed.includes(name)) {
      fail(`Action input '${name}' is not valid for command '${values.command}'.`)
    }
  }
}

const reportStatus = (result: unknown): "complete" | "blocked" | "uncertain" => {
  if (Array.isArray(result)) {
    return result.every((item) => typeof item === "object" && item !== null &&
      (item as { readonly _tag?: unknown })._tag === "PublicationConverged")
      ? "complete"
      : result.some((item) => typeof item === "object" && item !== null &&
        ((item as { readonly _tag?: unknown })._tag === "PublicationObserved" ||
          (item as { readonly _tag?: unknown })._tag === "UncertainSubject"))
      ? "uncertain"
      : "blocked"
  }
  if (typeof result !== "object" || result === null) return "blocked"
  const record = result as Record<string, unknown>
  if (record.status === "complete" || record.status === "blocked" || record.status === "uncertain") {
    return record.status
  }
  if (record.report !== undefined) return reportStatus(record.report)
  if (record.publications !== undefined) return reportStatus(record.publications)
  return "blocked"
}

const reportProjection = (command: ActionCommand, result: unknown, prepared: string | undefined): unknown => {
  if (command === "prepare") return { prepared }
  if (command === "release" && typeof result === "object" && result !== null) {
    const record = result as Record<string, unknown>
    return { prepared, report: record.report ?? record.publications }
  }
  return result
}

class ReportedActionError extends Error {}

const recoveryGuidance = (reference: string): string => [
  `Prepared release remains available as ${reference}.`,
  "Re-run the failed publish job on this workflow run; artifacts persist across attempts."
].join("\n")

export const runAction = async (
  api: Pick<ReleaseApi, "release" | "prepare" | "publish">,
  runtime: ActionRuntime
): Promise<void> => {
  const root = realpathSync(runtime.workspace)
  const values = {
    command: runtime.input("command"),
    config: runtime.input("config"),
    prepared: runtime.input("prepared")
  }
  try {
    const selected = command(values.command)
    rejectExtra(values, selected === "publish" ? ["command", "prepared"] : ["command", "config"])

    let result: unknown
    if (selected === "publish") {
      const reference = values.prepared || fail("publish requires prepared.")
      const directory = await runtime.resolvePrepared(reference)
      result = await api.publish({ prepared: directory })
    } else {
      const config = configJson(runtime, pathInWorkspace(root, values.config || fail(`${selected} requires config.`)))
      result = selected === "release"
        ? await api.release({ config, workspace: root })
        : await api.prepare({ config, workspace: root })
    }

    const prepared = runtime.preparedReference.current() ??
      fail(`${selected} completed without a durable prepared reference.`)
    const status = selected === "prepare" ? "complete" : reportStatus(result)
    const report = {
      schemaVersion: "ts-release-action-report/v2",
      command: selected,
      status,
      prepared,
      result: reportProjection(selected, result, prepared)
    }
    writeReport(runtime, root, report)
    if (status !== "complete") {
      await runtime.summarize(recoveryGuidance(prepared))
      throw new ReportedActionError(`Action ${selected} report is ${status}; no complete release is claimed.`)
    }
  } catch (cause) {
    const message = redact(cause instanceof Error ? cause.message : String(cause))
    const prepared = runtime.preparedReference.current()
    if (!(cause instanceof ReportedActionError)) {
      try {
        writeReport(runtime, root, {
          schemaVersion: "ts-release-action-report/v2",
          command: values.command,
          status: "failed",
          ...(prepared === undefined ? {} : { prepared }),
          error: message
        })
      } catch { /* preserve the primary Action error */ }
    }
    if (prepared !== undefined && !(cause instanceof ReportedActionError)) {
      try { await runtime.summarize(recoveryGuidance(prepared)) } catch { /* preserve the primary Action error */ }
    }
    throw new Error(message)
  }
}
