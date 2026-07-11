import * as Effect from "effect/Effect"
import { PlanError } from "../pipeline/errors.js"
import {
  catalogGitPublishOperations,
  validationNoteOperation
} from "../pipeline/operation-helpers.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import {
  defaultHomebrewSection,
  homebrewSectionFromConfig,
  type HomebrewSection
} from "./catalog-homebrew.js"

const rejectUnsupportedTokenEnv = (section: HomebrewSection): Effect.Effect<void, PlanError> =>
  section.tokenEnv === undefined
    ? Effect.void
    : Effect.fail(PlanError.make({
      pipeId: "publish:homebrew",
      field: "publish.homebrew.tokenEnv",
      reason:
        "Homebrew tap targets currently publish with plain git push and require Git credentials to be configured outside the release plan; tokenEnv is not supported yet."
    }))

export const publishHomebrewPipe: Pipe<HomebrewSection> = {
  id: "publish:homebrew",
  phase: "publish",
  section: homebrewSectionFromConfig,
  plan: (rawSection, state) =>
    Effect.gen(function*() {
      const section = defaultHomebrewSection(rawSection, state.identity)
      yield* rejectUnsupportedTokenEnv(section)
      const formulaPath = section.formulaPath
      return {
        ...emptyContribution,
        operations: [
          validationNoteOperation({
            id: "homebrew:brew-audit",
            pipeId: "publish:homebrew",
            description: "Record simulated Homebrew formula validation.",
            message: "Homebrew formula validation is simulated by the deterministic release plan."
          }),
          ...catalogGitPublishOperations({
            id: "homebrew:homebrew-push",
            pipeId: "publish:homebrew",
            description: `Push Homebrew tap update for ${state.identity.name}@${state.identity.version}.`,
            directory: section.tapDirectory,
            filePath: formulaPath,
            commitMessage: `Update ${section.formulaName} to ${state.identity.version}`
          })
        ]
      }
    })
}
