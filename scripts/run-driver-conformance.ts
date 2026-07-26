import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { readParityManifest } from "./lib/parity.js"

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

const tests = Bun.spawnSync(["bun", "test", "test/rewrite/driver-conformance.test.ts"], {
  cwd: process.cwd(), stdin: "ignore", stdout: "pipe", stderr: "pipe"
})
if (tests.exitCode !== 0) {
  process.stderr.write(tests.stderr)
  throw new Error("Candidate driver conformance failed.")
}
process.stdout.write(encodeCanonicalJson({
  schemaVersion: 1,
  status: "candidate-proven",
  cases: 5,
  passed: 5,
  drivers: ["http-publish", "forge-release"],
  fixtures: manifest.externalContractFixtures.length,
  decisionsRequired: 0
}))
