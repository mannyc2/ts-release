import { parseArgs } from "node:util"
import { encodeCanonicalJson } from "./lib/canonical-json.js"

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    candidate: { type: "boolean", default: false }
  },
  strict: true
})

if (!values.candidate) {
  throw new Error("run-oracle only hosts the candidate roster; use test:oracle:current")
}

process.stdout.write(encodeCanonicalJson({
  schemaVersion: 1,
  adapter: "candidate",
  status: "candidate-pending",
  supportedRoster: [
    "incumbent-example-corpus",
    "command-builder",
    "prebuilt-builder"
  ]
}))
