// Invariant: every builder adapter maps one resolved build target to canonical artifacts and operations without executing them.
import type * as Effect from "effect/Effect"
import { Artifact, ExecutableExtra, makeArtifact, type InstallableArtifactVariant } from "../../grammar/artifact.js"
import type { PlanError } from "../../grammar/errors.js"
import type { UnboundOperation } from "../../grammar/planner.js"
import type { ReleaseIdentity } from "../../grammar/state.js"
import type { PlatformTarget } from "../../grammar/platform.js"

export interface BuilderPlan {
  readonly operations: ReadonlyArray<UnboundOperation>
  readonly artifacts: ReadonlyArray<Artifact>
}

export const executableArtifact = (input: {
  readonly id: string
  readonly builder: "bun" | "command" | "prebuilt"
  readonly binary: string
  readonly path: string
  readonly platform: InstallableArtifactVariant
  readonly targetTriple: string
  readonly binaryName?: string | undefined
  readonly installPath?: string | undefined
}): Artifact => makeArtifact({
  id: input.id,
  path: input.path,
  producedBy: `build:${input.builder}`,
  platform: {
    ...input.platform,
    binaryName: input.binaryName ?? input.binary,
    ...(input.installPath === undefined ? {} : { installPath: input.installPath }),
    targetTriple: input.targetTriple
  },
  extra: ExecutableExtra.make({
    binary: input.binary,
    extension: input.platform.executableExtension ?? "",
    builderId: input.builder
  })
})

export type Builder<Options extends { readonly builder: string }> = (
  options: Options,
  identity: ReleaseIdentity,
  target: PlatformTarget
) => Effect.Effect<BuilderPlan, PlanError>
