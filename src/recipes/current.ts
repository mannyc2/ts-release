import * as Effect from "effect/Effect"
import { ConfigValueError, PlanningFactsError } from "../model/errors.js"
import { ReleaseStages } from "../model/plan.js"
import type { CandidateConfig } from "./config.js"
import { lowerCurrentBuild } from "./current-build.js"
import { lowerCurrentCatalogs } from "./current-catalog.js"
import { lowerCurrentPublish } from "./current-publish.js"
import { emptyRows } from "./current-shared.js"

export const lowerCurrentConfig = Effect.fn("lowerCurrentConfig")(function*(
  config: CandidateConfig
) {
  const rows = yield* Effect.try({
    try: () => {
      // THE ORDER OF THESE CALLS IS LOAD-BEARING. Every step mutates the one
      // shared CurrentRows, and later steps read outputs earlier steps
      // recorded — by id, as bare strings, with no declared dependency:
      //   "npm-package"  — declared by lowerCurrentBuild (current-build.ts) or
      //                    lowerCurrentProviders, read by lowerCurrentPublish.
      //   "release-notes" / "final-notes"
      //                  — declared by lowerCurrentChangelog, read by
      //                    lowerCurrentAnnouncements (which prefers the final).
      // Reordering silently changes plan BYTES (a missing output turns a
      // publish row into a refusal, or flips announcements between the two
      // notes). The dogfood planId assertion in current-recipes.test.ts is the
      // pin; plans/README.md carries the design memo for fixing this properly.
      const current = emptyRows()
      lowerCurrentBuild(config, current)
      lowerCurrentCatalogs(config, current)
      lowerCurrentPublish(config, current)
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
