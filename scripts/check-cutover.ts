import { readFileSync } from "node:fs"
import { encodeCanonicalJson } from "./lib/canonical-json.js"

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  readonly scripts: Readonly<Record<string, string>>
}
const required = [
  "check",
  "check:architecture",
  "check:import-rules",
  "check:loc",
  "check:parity",
  "check:source-budget",
  "check:superiority",
  "test:claim-cases",
  "test:driver-conformance",
  "test:fault-matrix",
  "test:oracle:candidate",
  "test:oracle:current"
]
const missing = required.filter((name) => packageJson.scripts[name] === undefined)
if (missing.length > 0) throw new Error(`Cutover constituent commands are missing: ${missing.join(", ")}`)
process.stdout.write(encodeCanonicalJson({
  schemaVersion: 1,
  status: "bootstrap-pending",
  constituentCommands: required
}))
