import type { CandidateConfig } from "../recipes/config.js"
import type { ReleaseIntent } from "./config.js"
import type { VerifiedReleaseContext } from "./context.js"
import type { CapabilityContribution, OutputDeclaration } from "./graph.js"
import { linkContributions, ReleaseGraph } from "./graph.js"

export interface CompilationSnapshot {
  readonly config: CandidateConfig
  readonly context: VerifiedReleaseContext
  /** Immutable outputs from the preceding explicit compilation phase. */
  readonly availableArtifacts: ReadonlyArray<OutputDeclaration>
}

/**
 * The compiler states exactly what it consumes; the installed capability
 * registry satisfies these structurally, so the pure compiler never imports
 * the composition root.
 */
export interface PreparationContributor {
  readonly phase: "source" | "package" | "render"
  readonly contribute: (input: CompilationSnapshot) => CapabilityContribution
}

export interface PublicationContributor {
  readonly contribute: (input: CompilationSnapshot) => CapabilityContribution
}

export interface CompilerCapabilities {
  readonly preparation: ReadonlyArray<PreparationContributor>
  readonly publication: ReadonlyArray<PublicationContributor>
}

// Pure internal IR compiler. It reads only its arguments; the source observer,
// prepared store, and installed capability set are deliberately outside this
// function.
export const compileReleaseGraph = (
  intent: ReleaseIntent,
  context: VerifiedReleaseContext,
  capabilities: CompilerCapabilities
): ReleaseGraph => {
  const contributions: Array<CapabilityContribution> = []
  let artifacts: ReleaseGraph["artifacts"] = []
  for (const phase of ["source", "package", "render"] as const) {
    for (const module of capabilities.preparation.filter((candidate) => candidate.phase === phase)) {
      contributions.push(module.contribute({ config: intent, context, availableArtifacts: artifacts }))
    }
    artifacts = linkContributions(contributions).artifacts
  }
  for (const module of capabilities.publication) {
    contributions.push(module.contribute({ config: intent, context, availableArtifacts: artifacts }))
  }
  return linkContributions(contributions)
}
