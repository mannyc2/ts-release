import { parseArgs } from "node:util"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { readParityManifest } from "./lib/parity.js"

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { bootstrap: { type: "boolean", default: false } },
  strict: true
})
if (!values.bootstrap) throw new Error("Driver conformance is bootstrap-pending until its owning plan.")

const manifest = readParityManifest(process.cwd())
const fixtureIds = new Set(manifest.externalContractFixtures.map((fixture) => fixture.id))
for (const row of manifest.rows.filter((candidate) => candidate.scope === "included")) {
  for (const id of row.contractFixtureIds) {
    if (!fixtureIds.has(id)) throw new Error(`${row.id}: missing external fixture ${id}`)
  }
}
for (const fixture of manifest.externalContractFixtures) {
  if (fixture.requiredFields.length === 0) {
    throw new Error(`${fixture.id}: external fixture has no frozen fields`)
  }
}

process.stdout.write(encodeCanonicalJson({
  schemaVersion: 1,
  status: "candidate-pending",
  fixtures: manifest.externalContractFixtures.length,
  ready: 0,
  decisionsRequired: manifest.externalContractFixtures.length
}))
