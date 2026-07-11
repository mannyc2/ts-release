import * as Effect from "effect/Effect"
import { PlanError } from "../pipeline/errors.js"
import {
  catalogGitPublishOperations,
  validationNoteOperation
} from "../pipeline/operation-helpers.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import {
  defaultScoopSection,
  scoopSectionFromConfig,
  type ScoopSection
} from "./catalog-scoop.js"

const rejectUnsupportedTokenEnv = (section: ScoopSection): Effect.Effect<void, PlanError> =>
  section.tokenEnv === undefined
    ? Effect.void
    : Effect.fail(PlanError.make({
      pipeId: "publish:scoop",
      field: "publish.scoop.tokenEnv",
      reason:
        "Scoop bucket targets currently publish with plain git push and require Git credentials to be configured outside the release plan; tokenEnv is not supported yet."
    }))

export const publishScoopPipe: Pipe<ScoopSection> = {
  id: "publish:scoop",
  phase: "publish",
  section: scoopSectionFromConfig,
  plan: (rawSection, state) =>
    Effect.gen(function*() {
      const section = defaultScoopSection(rawSection, state.identity)
      yield* rejectUnsupportedTokenEnv(section)
      const manifestPath = section.manifestPath
      return {
        ...emptyContribution,
        operations: [
          validationNoteOperation({
            id: "scoop:scoop-manifest-validation",
            pipeId: "publish:scoop",
            description: "Record simulated Scoop manifest validation.",
            message: "Scoop manifest validation is simulated by the deterministic release plan."
          }),
          ...catalogGitPublishOperations({
            id: "scoop:scoop-push",
            pipeId: "publish:scoop",
            description: `Push Scoop bucket update for ${state.identity.name}@${state.identity.version}.`,
            directory: section.bucketDirectory,
            filePath: manifestPath,
            commitMessage: `Update ${section.manifestName} to ${state.identity.version}`
          })
        ]
      }
    })
}
