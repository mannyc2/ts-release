import * as Schema from "effect/Schema"
import { JournalEvent } from "../internal/ReleaseModel.js"
import { canonical, parseCanonical } from "../internal/Identity.js"
import { fail } from "../internal/Error.js"

export const EVENT_BYTES = 1_048_576
const decode = Schema.decodeUnknownSync(JournalEvent, { onExcessProperty: "error" })
export const eventBytes = (event: JournalEvent): Uint8Array =>
  new TextEncoder().encode(canonical(decode(event)))

export const readEvent = (bytes: Uint8Array): JournalEvent => {
  if (bytes.byteLength > EVENT_BYTES)
    fail("event-too-large", "Event exceeds the journal byte limit")
  return decode(parseCanonical(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
}

export const encodeEvent = (event: JournalEvent, journalId: string): Uint8Array => {
  if (event.journalId !== journalId) fail("journal-mismatch", "Event belongs to another journal")
  const bytes = eventBytes(event)
  readEvent(bytes)
  return bytes
}
