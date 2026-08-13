import type { ReleaseIntent } from "./config.js"
import type { VerifiedReleaseContext } from "./context.js"
import {
  preparationCapabilities,
  publicationCapabilities
} from "../capabilities/registry.js"
import type { CapabilityContribution } from "./graph.js"
import { linkContributions, ReleaseGraph } from "./graph.js"

// Pure internal IR compiler. It reads only its arguments; the source observer
// and prepared store are deliberately outside this function.
export const compileReleaseGraph = (
  intent: ReleaseIntent,
  context: VerifiedReleaseContext
): ReleaseGraph => {
  const contributions: Array<CapabilityContribution> = []
  let artifacts: ReleaseGraph["artifacts"] = []
  for (const phase of ["source", "package", "render"] as const) {
    for (const module of preparationCapabilities.filter((candidate) => candidate.phase === phase)) {
      contributions.push(module.contribute({ config: intent, context, availableArtifacts: artifacts }))
    }
    artifacts = linkContributions(contributions).artifacts
  }
  for (const module of publicationCapabilities) {
    contributions.push(module.contribute({ config: intent, context, availableArtifacts: artifacts }))
  }
  return linkContributions(contributions)
}
