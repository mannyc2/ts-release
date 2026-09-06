import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { JournalEvent, LabError } from "../machine/src/contracts.js"
import { canonical, parseCanonical } from "../machine/src/identity.js"

// Research backend implementations. They persist the machine's actual events;
// they do not implement release policy or manufacture dispatch permission.
export const EVENT_BYTES = 1_048_576
export const encoder = new TextEncoder()
const decode = Schema.decodeUnknownSync(JournalEvent, { onExcessProperty: "error" })
export const fail = (code: string, message: string): never => { throw new LabError({ code, message }) }
export const caught = (error: unknown) => error instanceof LabError ? error : new LabError({ code: "storage", message: String(error) })
export const attempt = <A>(name: string, body: () => A) => Effect.fn(name)(() => Effect.try({ try: body, catch: caught }))()

export const eventBytes = (event: JournalEvent) => encoder.encode(canonical(decode(event)))
export function readEvent(bytes: Uint8Array, limit = EVENT_BYTES): JournalEvent {
  if (bytes.byteLength > limit) fail("event-too-large", "Event exceeds the symmetric storage byte limit")
  return decode(parseCanonical(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
}
export function body(event: JournalEvent, journalId: string, limit: number): string {
  if (event.journalId !== journalId) fail("journal-mismatch", "Storage namespace differs from event journal")
  const bytes = eventBytes(event)
  readEvent(bytes, limit)
  return new TextDecoder().decode(bytes)
}
