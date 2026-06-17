import * as Effect from "effect/Effect"
import { ArtifactInventoryItem, Checksum } from "../domain/artifact.js"
import { ValidationNoteOperation, noApprovalGate } from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  TargetCapabilities,
  TargetConfig,
  TargetDryRunSupport,
  TargetValidationStrategy,
  targetAuthRequirement
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"

export type * from "../types/effect-internal.js"

interface DryRunValidationNoteOptions {
  readonly id: string
  readonly targetId: string
  readonly dryRunSupport: Exclude<TargetDryRunSupport, "native">
  readonly simulatedDescription: string
  readonly skippedDescription: string
  readonly simulatedMessage: string
  readonly skippedMessage: string
}

interface ArtifactErrorReasons {
  readonly targetId: string
  readonly directoryReason: string
  readonly checksumReason: string
}

export const validationStrategyForDryRun = (dryRunSupport: TargetDryRunSupport): TargetValidationStrategy => {
  if (dryRunSupport === "native") {
    return "native-command"
  }
  if (dryRunSupport === "simulated") {
    return "simulated-plan"
  }
  return "skipped"
}

export const targetCapabilitiesFor = (
  target: TargetConfig,
  validationStrategy: TargetValidationStrategy
): TargetCapabilities =>
  TargetCapabilities.make({
    targetId: target.id,
    targetTag: target._tag,
    authRequirement: targetAuthRequirement(target),
    dryRunSupport: target.dryRunSupport,
    mutability: target.mutability,
    recovery: target.recovery,
    validationStrategy
  })

export const validationNoteOperation = (options: DryRunValidationNoteOptions): ValidationNoteOperation =>
  ValidationNoteOperation.make({
    id: options.id,
    targetId: options.targetId,
    description: options.dryRunSupport === "simulated" ? options.simulatedDescription : options.skippedDescription,
    risk: "read-only",
    gate: noApprovalGate("Validation notes do not modify local or remote state."),
    message: options.dryRunSupport === "simulated" ? options.simulatedMessage : options.skippedMessage,
    skipped: options.dryRunSupport === "none",
    severity: options.dryRunSupport === "simulated" ? "info" : "warning"
  })

export const rejectNoDryRunInStrictMode = Effect.fn("rejectNoDryRunInStrictMode")(function*(
  target: TargetConfig,
  model: ReleaseModel,
  reason: string
) {
  if (model.strict && target.dryRunSupport === "none") {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason
      })
    )
  }
})

export const findRequiredArtifact = Effect.fn("findRequiredArtifact")(function*(
  model: ReleaseModel,
  targetId: string,
  artifactId: string,
  missingReason: string
) {
  const artifact = model.artifacts.find((item) => item.id === artifactId)
  if (artifact === undefined) {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId,
        reason: missingReason
      })
    )
  }
  return artifact
})

export const requireSha256FileArtifact = Effect.fn("requireSha256FileArtifact")(function*(
  artifact: ArtifactInventoryItem,
  reasons: ArtifactErrorReasons
) {
  if (artifact.format === "directory") {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: reasons.targetId,
        reason: reasons.directoryReason
      })
    )
  }
  if (artifact.checksum === undefined || artifact.checksum.algorithm !== "sha256") {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: reasons.targetId,
        reason: reasons.checksumReason
      })
    )
  }
  const checksum: Checksum = artifact.checksum
  return { artifact, checksum }
})
