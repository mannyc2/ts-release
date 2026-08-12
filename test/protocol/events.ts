import { createHash } from "node:crypto"

export const ProtocolEventSchemaVersion = "release-protocol-event/v1" as const

type ProtocolPhase = "observe" | "mutate"
type GrantKind = "AnonymousAccess" | "ScopedSecret" | "WorkloadIdentity"

interface EventContext {
  readonly schemaVersion: typeof ProtocolEventSchemaVersion
  readonly provider: "github" | "npm"
  readonly phase: ProtocolPhase
  readonly attempt?: number
}

export interface HttpExchange extends EventContext {
  readonly _tag: "HttpExchange"
  readonly method: "GET" | "POST"
  readonly url: string
  readonly status?: number
  readonly grantKind?: GrantKind
  readonly requestHeaders?: Readonly<Record<string, string>>
  readonly requestBodySha256?: string
  readonly requestBodyLength?: number
  readonly responseBodySha256?: string
  readonly responseBodyLength?: number
}

export interface ProcessSpawn extends EventContext {
  readonly _tag: "ProcessSpawn"
  readonly argv: readonly [string, ...Array<string>]
  readonly cwd: string
  readonly environmentNames: ReadonlyArray<string>
  readonly grantKind?: GrantKind
}

export interface ProcessExit extends EventContext {
  readonly _tag: "ProcessExit"
  readonly exitCode: number
}

export interface ProcessSignal extends EventContext {
  readonly _tag: "ProcessSignal"
  readonly signal: string
}

export interface StreamFailure extends EventContext {
  readonly _tag: "StreamFailure"
  readonly stream: "stdin" | "stdout" | "stderr"
  readonly reason: string
}

export interface FaultInjected extends EventContext {
  readonly _tag: "FaultInjected"
  readonly point: string
  readonly commitment: "before-dispatch" | "started" | "unknown"
}

export type ProtocolEvent =
  | HttpExchange
  | ProcessSpawn
  | ProcessExit
  | ProcessSignal
  | StreamFailure
  | FaultInjected

type EventInput<Event extends ProtocolEvent> = Omit<Event, "schemaVersion" | "_tag">

const makeEvent = <Tag extends ProtocolEvent["_tag"], Event extends Extract<ProtocolEvent, { readonly _tag: Tag }>>(
  tag: Tag,
  input: EventInput<Event>
): Event => ({ schemaVersion: ProtocolEventSchemaVersion, _tag: tag, ...input }) as Event

export const httpExchange = (input: EventInput<HttpExchange>): HttpExchange =>
  makeEvent("HttpExchange", input)

export const processSpawn = (input: EventInput<ProcessSpawn>): ProcessSpawn =>
  makeEvent("ProcessSpawn", input)

export const processExit = (input: EventInput<ProcessExit>): ProcessExit =>
  makeEvent("ProcessExit", input)

export const processSignal = (input: EventInput<ProcessSignal>): ProcessSignal =>
  makeEvent("ProcessSignal", input)

export const streamFailure = (input: EventInput<StreamFailure>): StreamFailure =>
  makeEvent("StreamFailure", input)

export const faultInjected = (input: EventInput<FaultInjected>): FaultInjected =>
  makeEvent("FaultInjected", input)

const credentialHeader = /^(?:authorization|proxy-authorization|npm-auth-type|npm-token|x-auth-token)$/iu
const credentialQuery = /(?:token|auth|password|secret|key)/iu
const tokenLike = /(?:gh[pousr]_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|Bearer\s+\S+|Basic\s+\S+)/giu

const scrubText = (value: string): string => value.replace(tokenLike, "<redacted>")

const scrubUrl = (value: string): string => {
  try {
    const url = new URL(value)
    if (url.username !== "") url.username = "redacted"
    if (url.password !== "") url.password = "redacted"
    for (const key of [...url.searchParams.keys()]) {
      if (credentialQuery.test(key)) url.searchParams.set(key, "<redacted>")
    }
    return scrubText(url.toString())
  } catch {
    return scrubText(value)
  }
}

const scrubHeaders = (
  headers: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> | undefined => headers === undefined
  ? undefined
  : Object.fromEntries(Object.entries(headers).map(([name, value]) => [
    name.toLowerCase(),
    credentialHeader.test(name) ? "<redacted>" : scrubText(value)
  ]).sort((left, right) => left[0]! < right[0]! ? -1 : left[0]! > right[0]! ? 1 : 0))

const scrubArgv = (argv: readonly [string, ...Array<string>]): readonly [string, ...Array<string>] => {
  const result = argv.map(scrubText)
  for (let index = 0; index < result.length - 1; index += 1) {
    if (result[index] === "--userconfig") result[index + 1] = "<redacted-userconfig>"
  }
  return result as [string, ...Array<string>]
}

/**
 * Sanitizes transcripts at the persistence boundary. Protocol doubles should
 * still avoid recording secret material in the first place; this is the final
 * denylist before a JSONL golden can be written or compared.
 */
export const sanitizeProtocolEvents = (
  events: ReadonlyArray<ProtocolEvent>
): ReadonlyArray<ProtocolEvent> => events.map((event): ProtocolEvent => {
  switch (event._tag) {
    case "HttpExchange": {
      const headers = scrubHeaders(event.requestHeaders)
      return {
        ...event,
        url: scrubUrl(event.url),
        ...(headers === undefined ? {} : { requestHeaders: headers })
      }
    }
    case "ProcessSpawn":
      return { ...event, argv: scrubArgv(event.argv), cwd: scrubText(event.cwd) }
    case "StreamFailure":
      return { ...event, reason: scrubText(event.reason) }
    case "ProcessSignal":
      return { ...event, signal: scrubText(event.signal) }
    case "FaultInjected":
      return { ...event, point: scrubText(event.point) }
    case "ProcessExit":
      return event
  }
})

export const encodeProtocolJsonLines = (events: ReadonlyArray<ProtocolEvent>): string =>
  `${sanitizeProtocolEvents(events).map((event) => JSON.stringify(event)).join("\n")}\n`

export const protocolBodyFingerprint = (
  body: Uint8Array | string
): { readonly sha256: string, readonly length: number } => {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body
  return { sha256: createHash("sha256").update(bytes).digest("hex"), length: bytes.length }
}
