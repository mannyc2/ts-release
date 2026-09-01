import { existsSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import {
  decodeCompletePreparedReleaseRef,
  encodeCompletePreparedReleaseRef,
  type CompletePreparedReleaseRef,
  type ReleaseApi
} from "@mannyc1/ts-release"
import * as Effect from "effect/Effect"

export const actionCommands = ["release", "prepare", "inspect", "publish"] as const
export const actionInputs = ["command", "config", "prepared"] as const
export const actionOutputs = ["prepared-ref", "report-ref"] as const
export type ActionCommand = typeof actionCommands[number]
export type ActionOutput = typeof actionOutputs[number]

export interface PreparedReferenceChannel {
  readonly emit: (reference: string) => Promise<void>
  readonly current: () => string | undefined
}

const workflowRecoveryGuidance = (reference: string): string => [
  `Prepared release: ${reference}`,
  `Automatic workflow recovery: dispatch the same exact candidate with prepared_ref=${reference}.`,
  "Reviewed workflow recovery: re-run the failed publish job in the producer workflow run."
].join("\n")

export const makePreparedReferenceChannel = (input: {
  readonly output: (name: ActionOutput, value: string) => void
  readonly summarize: (message: string) => Promise<void>
}): PreparedReferenceChannel => {
  let current: string | undefined
  return {
    emit: async (reference) => {
      current = reference
      input.output("prepared-ref", reference)
      await input.summarize(workflowRecoveryGuidance(reference))
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

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined

/** Effect/schema errors can be Error instances with an empty `message` and a
 * durable string in `reason` or `cause`. Preserve that diagnostic without
 * serializing arbitrary error objects or secrets. */
export const actionErrorMessage = (cause: unknown): string => {
  const direct = cause instanceof Error ? nonEmptyString(cause.message) : nonEmptyString(cause)
  if (direct !== undefined) return redact(direct)
  if (typeof cause === "object" && cause !== null) {
    const record = cause as { readonly reason?: unknown, readonly cause?: unknown }
    const structured = nonEmptyString(record.reason) ?? nonEmptyString(record.cause)
    if (structured !== undefined) return redact(structured)
  }
  return "Action failed without a diagnostic message."
}

const printable = (value: unknown): string => JSON.stringify(value, (_key, nested) => {
  if (
    typeof nested === "object" && nested !== null && !Array.isArray(nested) &&
    Object.getPrototypeOf(nested) !== Object.prototype && Object.getPrototypeOf(nested) !== null &&
    "toString" in nested && nested.toString !== Object.prototype.toString &&
    Object.keys(nested).length === 1
  ) {
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

class ReportedActionError extends Error {}

const recoveryGuidance = workflowRecoveryGuidance

const decodePrepared = (value: string): Promise<CompletePreparedReleaseRef> =>
  Effect.runPromise(decodeCompletePreparedReleaseRef(value))

const confirmedPrepared = (
  reference: CompletePreparedReleaseRef,
  channel: PreparedReferenceChannel
): string => {
  const encoded = encodeCompletePreparedReleaseRef(reference)
  const emitted = channel.current() ?? fail("Operation completed without a durable prepared reference.")
  if (emitted !== encoded) {
    fail("Operation returned a different prepared reference than its durable store committed.")
  }
  return encoded
}

export const runAction = async (
  api: Pick<ReleaseApi, "release" | "prepare" | "inspect" | "publish">,
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
    rejectExtra(values, selected === "publish" || selected === "inspect"
      ? ["command", "prepared"]
      : ["command", "config"])

    let prepared: string
    let report: Awaited<ReturnType<ReleaseApi["publish"]>> | undefined
    if (selected === "publish" || selected === "inspect") {
      const reference = await decodePrepared(values.prepared || fail(`${selected} requires prepared.`))
      prepared = encodeCompletePreparedReleaseRef(reference)
      await runtime.preparedReference.emit(prepared)
      if (selected === "publish") report = await api.publish({ prepared: reference })
      else {
        await api.inspect({ prepared: reference })
        report = undefined
      }
    } else {
      const config = configJson(runtime, pathInWorkspace(root, values.config || fail(`${selected} requires config.`)))
      if (selected === "release") {
        const result = await api.release({ config, workspace: root })
        prepared = confirmedPrepared(result.prepared, runtime.preparedReference)
        report = result.report
      } else {
        const result = await api.prepare({ config, workspace: root })
        prepared = confirmedPrepared(result, runtime.preparedReference)
        report = undefined
      }
    }

    const status = report?.status ?? "complete"
    const actionReport = {
      schemaVersion: "ts-release-action-report/v2",
      command: selected,
      status,
      prepared,
      ...(report === undefined ? {} : { report })
    }
    writeReport(runtime, root, actionReport)
    if (status !== "complete") {
      await runtime.summarize(recoveryGuidance(prepared))
      throw new ReportedActionError(`Action ${selected} report is ${status}; no complete release is claimed.`)
    }
  } catch (cause) {
    const message = actionErrorMessage(cause)
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
