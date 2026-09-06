// Test-only convenience barrel. Host packages import their specific backend.
export { EVENT_BYTES, eventBytes, readEvent } from "./protocol.js"
export { SqliteJournal } from "./sqlite.js"
export { GitJournal } from "./git.js"
