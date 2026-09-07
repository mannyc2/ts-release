import { createHash } from "node:crypto"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const path = "docs/refactor/evidence/launch-evidence.json"
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const assert = (test: unknown, message: string): void => { if (!test) throw new Error(message) }
const wavesText = await Bun.file(resolve(root, "docs/refactor/architecture-program/handoff/waves.json")).text()
const waves = JSON.parse(wavesText)
const ledger = await Bun.file(resolve(root, path)).json()
assert(ledger.format === "ts-release/launch-evidence/1", "Unknown launch evidence format")
assert(ledger.wavesSha256 === sha256(wavesText), "Launch evidence binds stale wave assignments")
assert(Array.isArray(ledger.outcomes) && ledger.outcomes.length === 69, "Exactly 69 outcomes are required")
assert(new Set(ledger.outcomes.map((row: { id: string }) => row.id)).size === 69, "Duplicate outcome IDs")
let open = 0
for (const original of waves.outcomes) {
  const row = ledger.outcomes.find((item: { id: string }) => item.id === original.id)
  assert(row && same(Object.keys(row).sort(), ["id", "oracleSha256", "records", "status"]), `Invalid evidence row ${original.id}`)
  assert(row.oracleSha256 === sha256(JSON.stringify(original)), `Changed or incomplete native oracle ${original.id}`)
  assert(Array.isArray(row.records), `Missing records ${original.id}`)
  // No implemented native receipt verifier exists before the production waves.
  // Reject claimed passes instead of allowing free-text or lab receipts to close rows.
  assert(row.status === "open" && row.records.length === 0,
    `${original.id}: native executed-receipt admission is owned by Plans 009/010 and is not implemented yet`)
  open++
}
console.log(JSON.stringify({ selected: 69, open, closed: 69 - open, productionAcceptance: false }))
if (process.argv.includes("--require-closed") && open > 0) {
  throw new Error(`${open} open selected outcomes; release closure is not satisfied`)
}
