import * as Effect from "effect/Effect"
import { PlanError } from "../pipeline/errors.js"
import {
  catalogGitPublishOperations,
  dryRunValidationOperation,
  noAuthCommand
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
  defaults: defaultHomebrewSection,
  plan: (section, state) =>
    Effect.gen(function*() {
      yield* rejectUnsupportedTokenEnv(section)
      const formulaPath = section.formulaPath ?? `.release/generated/${section.formulaName ?? "release"}.rb`
      return {
        ...emptyContribution,
        operations: [
          dryRunValidationOperation({
            id: "homebrew:brew-audit",
            pipeId: "publish:homebrew",
            dryRunSupport: "simulated",
            nativeDescription: "Validate generated Homebrew formula with brew audit.",
            command: noAuthCommand("brew", ["audit", "--strict", "--formula", formulaPath]),
            simulatedDescription: "Record simulated Homebrew formula validation.",
            skippedDescription: "Record skipped Homebrew formula validation.",
            simulatedMessage: "Homebrew formula validation is simulated by the deterministic release plan.",
            skippedMessage: "Homebrew formula validation was skipped because this target declares no dry-run support."
          }),
          ...catalogGitPublishOperations({
            id: "homebrew:homebrew-push",
            pipeId: "publish:homebrew",
            description: `Push Homebrew tap update for ${state.identity.name}@${state.identity.version}.`,
            directory: section.tapDirectory,
            filePath: formulaPath,
            commitMessage: `Update ${section.formulaName ?? "release"} to ${state.identity.version}`
          })
        ]
      }
    })
}
