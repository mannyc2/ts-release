import * as Schema from "effect/Schema"
import { CandidateConfig } from "../recipes/config.js"

// The graph kernel consumes the already-decoded candidate value. Keeping this
// alias at the new owner makes the migration boundary explicit; public input
// decoding is cut over by plan 217, while no second semantic schema is added.
export const ReleaseIntent = CandidateConfig
export type ReleaseIntent = typeof CandidateConfig.Type

export const decodeReleaseIntent = Schema.decodeUnknownSync(ReleaseIntent, {
  onExcessProperty: "error"
})
