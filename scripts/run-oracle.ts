import { parseArgs } from "node:util"
import * as Effect from "effect/Effect"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import {
  candidateGroups,
  runCandidateOracle,
  type CandidateGroup
} from "../test/rewrite/candidate-adapter.js"

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    candidate: { type: "boolean", default: false },
    group: { type: "string" }
  },
  strict: true
})

if (!values.candidate) {
  throw new Error("run-oracle only hosts the candidate roster; use test:oracle:current")
}
if (
  values.group !== undefined &&
  !candidateGroups.includes(values.group as CandidateGroup)
) {
  throw new Error(`Unknown candidate oracle group: ${values.group}`)
}

process.stdout.write(encodeCanonicalJson(await Effect.runPromise(
  runCandidateOracle(values.group as CandidateGroup | undefined)
)))
