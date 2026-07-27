import * as Effect from "effect/Effect"
import { PlanningFactsError } from "../model/errors.js"
import { ReleaseStages } from "../model/plan.js"
import type { CandidateConfig } from "./config.js"
import { lowerCurrentBuild } from "./current-build.js"
import { lowerCurrentCatalogs } from "./current-catalog.js"
import { lowerCurrentPublish } from "./current-publish.js"
import { lowerCurrentSupplyChain } from "./current-supply-chain.js"
import { emptyRows } from "./current-shared.js"

export const lowerCurrentConfig = Effect.fn("rewrite.lowerCurrentConfig")(function*(
  config: CandidateConfig
) {
  const rows = yield* Effect.try({
    try: () => {
      const current = emptyRows()
      lowerCurrentBuild(config, current)
      lowerCurrentCatalogs(config, current)
      lowerCurrentSupplyChain(config, current)
      lowerCurrentPublish(config, current)
      return current
    },
    catch: (cause) => PlanningFactsError.make({
      reason: cause instanceof Error ? cause.message : String(cause)
    })
  })
  return ReleaseStages.make({
    build: rows.build, process: rows.process, catalog: rows.catalog,
    validate: rows.validate, publish: rows.publish, announce: [], verify: rows.verify
  })
})
