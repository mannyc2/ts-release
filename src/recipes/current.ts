import * as Effect from "effect/Effect"
import { ConfigValueError, PlanningFactsError } from "../model/errors.js"
import { ReleaseStages } from "../model/plan.js"
import type { CandidateConfig } from "./config.js"
import { lowerCurrentAnnouncements } from "./current-announcement.js"
import { lowerCurrentBuild } from "./current-build.js"
import { lowerCurrentCatalogs } from "./current-catalog.js"
import { lowerCurrentChangelog } from "./current-changelog.js"
import { lowerCurrentProviders } from "./current-providers.js"
import { lowerCurrentPublish } from "./current-publish.js"
import { lowerCurrentSupplyChain } from "./current-supply-chain.js"
import { emptyRows } from "./current-shared.js"

export const lowerCurrentConfig = Effect.fn("lowerCurrentConfig")(function*(
  config: CandidateConfig
) {
  const rows = yield* Effect.try({
    try: () => {
      const current = emptyRows()
      lowerCurrentBuild(config, current)
      lowerCurrentCatalogs(config, current); lowerCurrentChangelog(config, current)
      lowerCurrentSupplyChain(config, current)
      lowerCurrentPublish(config, current); lowerCurrentProviders(config, current)
      lowerCurrentAnnouncements(config, current)
      return current
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
