import { parseArgs } from "node:util"
import * as Effect from "effect/Effect"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { runCandidateOracle } from "../test/rewrite/candidate-adapter.js"

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

process.stdout.write(encodeCanonicalJson(await Effect.runPromise(runCandidateOracle())))
