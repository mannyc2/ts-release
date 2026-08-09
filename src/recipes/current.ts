import * as Effect from "effect/Effect"
import { ConfigValueError, PlanningFactsError } from "../model/errors.js"
import { ReleaseStages } from "../model/plan.js"
import type { CandidateConfig } from "./config.js"
import { lowerLegacyBuild } from "./current-build.js"
import { lowerLegacyCatalogs } from "./current-catalog.js"
import { lowerLegacyPublish } from "./current-publish.js"
import { emptyLegacyRows } from "./current-shared.js"

// Temporary projection for the pre-217 release-plan/v6 boundary. It is an
// immutable stage projection; the new release graph owns all new semantics.
export const lowerLegacyConfig = Effect.fn("lowerLegacyConfig")(function*(
  config: CandidateConfig
) {
  const rows = yield* Effect.try({
    try: () => {
      let rows = lowerLegacyBuild(config, emptyLegacyRows())
      rows = lowerLegacyCatalogs(config, rows)
      return lowerLegacyPublish(config, rows)
    },
    // A typed lowering failure keeps its identity instead of being flattened
    // into an untyped string: planning is the layer users read most.
    catch: (cause) => cause instanceof ConfigValueError ? cause
      : PlanningFactsError.make({
        reason: cause instanceof Error ? cause.message : String(cause)
      })
  })
  return ReleaseStages.make({
    build: rows.build, process: rows.process, catalog: rows.catalog,
    validate: rows.validate, publish: rows.publish, announce: rows.announce, verify: rows.verify
  })
})
