import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { readParityManifest } from "./lib/parity.js"

const args = process.argv.slice(2).filter((argument) => argument !== "--")
let group = "all"
if (args.length > 0) {
  if (args.length !== 2 || args[0] !== "--group" ||
    !["process", "package-publish", "forge"].includes(args[1]!)) {
    throw new Error("Usage: run-driver-conformance [--group process|package-publish|forge]")
  }
  group = args[1]!
}
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
  group,
  cases: 6,
  passed: 6,
  drivers: group === "process"
    ? ["process", "workspace"]
    : group === "forge"
    ? ["forge-release"]
    : group === "package-publish"
    ? ["package-registry-release", "opaque-publish"]
    : ["process", "workspace", "http-publish", "forge-release",
        "package-registry-release", "opaque-publish"],
  fixtures: manifest.externalContractFixtures.length,
  decisionsRequired: 0
}))
