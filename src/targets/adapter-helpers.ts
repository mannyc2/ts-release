import * as Effect from "effect/Effect"
import { ArtifactInventoryItem, Checksum } from "../domain/artifact.js"
import {
  CommandSpec,
  PublishCommandOperation,
  ValidateCommandOperation,
  ValidationNoteOperation,
  executeGate,
  irreversibleGate,
  noApprovalGate
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  TargetAuthSetup,
  TargetCapabilities,
  TargetConfig,
  TargetDryRunSupport,
  TargetMutability,
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

interface ReadOnlyCommandValidationOptions {
  readonly id: string
  readonly targetId: string
  readonly description: string
  readonly gateReason: string
  readonly command: CommandSpec
}

interface DryRunValidationOperationOptions extends Omit<DryRunValidationNoteOptions, "dryRunSupport"> {
  readonly dryRunSupport: TargetDryRunSupport
  readonly nativeDescription: string
  readonly nativeGateReason: string
  readonly command: CommandSpec
}

interface ArtifactErrorReasons {
  readonly targetId: string
  readonly directoryReason: string
  readonly checksumReason: string
}

interface UnsupportedCatalogTokenEnvOptions {
  readonly targetId: string
  readonly targetLabel: string
  readonly tokenEnv: string | undefined
}

interface CatalogGitPushOperationOptions {
  readonly id: string
  readonly targetId: string
  readonly description: string
  readonly mutability: TargetMutability
  readonly directory: string | undefined
  readonly irreversibleReason: string
  readonly externallyVisibleReason: string
}

export const noAuthCommand = (
  executable: string,
  args: ReadonlyArray<string>
): CommandSpec =>
  CommandSpec.make({
    executable,
    args: [...args],
    requiredEnv: [],
    redactedEnv: []
  })

export const catalogPathBaseName = (pathName: string): string => {
  const parts = pathName.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? pathName
}

export const rejectUnsupportedCatalogTokenEnv = Effect.fn("rejectUnsupportedCatalogTokenEnv")(function*(
  options: UnsupportedCatalogTokenEnvOptions
) {
  if (options.tokenEnv !== undefined) {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: options.targetId,
        reason:
          `${options.targetLabel} targets currently publish with plain git push and require Git credentials to be configured outside the release plan; tokenEnv is not supported yet.`
      })
    )
  }
})

export const catalogGitPushOperation = (options: CatalogGitPushOperationOptions): PublishCommandOperation => {
  const publishRisk = options.mutability === "immutable" ? "irreversible" : "externally-visible"
  return PublishCommandOperation.make({
    id: options.id,
    targetId: options.targetId,
    description: options.description,
    risk: publishRisk,
    gate: publishRisk === "irreversible"
      ? irreversibleGate(options.irreversibleReason)
      : executeGate(options.externallyVisibleReason),
    command: noAuthCommand("git", ["-C", options.directory ?? ".", "push"])
  })
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
  validationStrategy: TargetValidationStrategy,
  authSetup?: TargetAuthSetup | undefined
): TargetCapabilities =>
  TargetCapabilities.make({
    targetId: target.id,
    targetTag: target._tag,
    authRequirement: targetAuthRequirement(target),
    dryRunSupport: target.dryRunSupport,
    mutability: target.mutability,
    recovery: target.recovery,
    validationStrategy,
    ...(authSetup === undefined ? {} : { authSetup })
  })

export const readOnlyCommandValidationOperation = (
  options: ReadOnlyCommandValidationOptions
): ValidateCommandOperation =>
  ValidateCommandOperation.make({
    id: options.id,
    targetId: options.targetId,
    description: options.description,
    risk: "read-only",
    gate: noApprovalGate(options.gateReason),
    command: options.command
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

export const dryRunValidationOperation = (
  options: DryRunValidationOperationOptions
): ValidateCommandOperation | ValidationNoteOperation =>
  options.dryRunSupport === "native"
    ? readOnlyCommandValidationOperation({
      id: options.id,
      targetId: options.targetId,
      description: options.nativeDescription,
      gateReason: options.nativeGateReason,
      command: options.command
    })
    : validationNoteOperation({
      id: options.id,
      targetId: options.targetId,
      dryRunSupport: options.dryRunSupport,
      simulatedDescription: options.simulatedDescription,
      skippedDescription: options.skippedDescription,
      simulatedMessage: options.simulatedMessage,
      skippedMessage: options.skippedMessage
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
