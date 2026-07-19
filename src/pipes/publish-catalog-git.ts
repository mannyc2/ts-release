import * as Effect from "effect/Effect"
import { PlanError } from "../pipeline/errors.js"
import { emptyContribution, featurePlanner, type PipeContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import type { ResolvedHomebrew } from "./catalog-homebrew.js"
import type { ResolvedScoop } from "./catalog-scoop.js"
import {
  catalogGitPublishOperations,
  validationNoteOperation,
  type CatalogGitPublishOptions
} from "./shared.js"

const catalogGitPublish = Effect.fn("publish.catalogGit")(function*(
  tokenEnv: string | undefined,
  error: { readonly pipeId: string; readonly field: string; readonly reason: string },
  validation: Parameters<typeof validationNoteOperation>[0],
  publish: CatalogGitPublishOptions
): Effect.fn.Return<PipeContribution, PlanError> {
  if (tokenEnv !== undefined) {
    return yield* Effect.fail(PlanError.make(error))
  }
  return {
    ...emptyContribution,
    operations: [validationNoteOperation(validation), ...catalogGitPublishOperations(publish)]
  }
})

const identityDescription = (catalog: "Homebrew tap" | "Scoop bucket", identity: ReleaseIdentity): string =>
  `Push ${catalog} update for ${identity.name}@${identity.version}.`

export const publishHomebrewPlanner = featurePlanner<ResolvedHomebrew>("publish:homebrew", (section, state) => catalogGitPublish(
    section.tokenEnv,
    {
      pipeId: "publish:homebrew",
      field: "publish.homebrew.tokenEnv",
      reason:
        "Homebrew tap targets currently publish with plain git push and require Git credentials to be configured outside the release plan; tokenEnv is not supported yet."
    },
    {
      id: "homebrew:brew-audit",
      pipeId: "publish:homebrew",
      description: "Record simulated Homebrew formula validation.",
      message: "Homebrew formula validation is simulated by the deterministic release plan."
    },
    {
      id: "homebrew:homebrew-push",
      pipeId: "publish:homebrew",
      description: identityDescription("Homebrew tap", state.identity),
      directory: section.tapDirectory,
      filePath: section.formulaPath,
      commitMessage: `Update ${section.formulaName} to ${state.identity.version}`
    }
  ))

export const publishScoopPlanner = featurePlanner<ResolvedScoop>("publish:scoop", (section, state) => catalogGitPublish(
    section.tokenEnv,
    {
      pipeId: "publish:scoop",
      field: "publish.scoop.tokenEnv",
      reason:
        "Scoop bucket targets currently publish with plain git push and require Git credentials to be configured outside the release plan; tokenEnv is not supported yet."
    },
    {
      id: "scoop:scoop-manifest-validation",
      pipeId: "publish:scoop",
      description: "Record simulated Scoop manifest validation.",
      message: "Scoop manifest validation is simulated by the deterministic release plan."
    },
    {
      id: "scoop:scoop-push",
      pipeId: "publish:scoop",
      description: identityDescription("Scoop bucket", state.identity),
      directory: section.bucketDirectory,
      filePath: section.manifestPath,
      commitMessage: `Update ${section.manifestName} to ${state.identity.version}`
    }
  ))
