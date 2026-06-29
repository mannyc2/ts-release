import * as Effect from "effect/Effect"
import {
  ArtifactArchitecture,
  ArtifactInventoryItem,
  ArtifactLibc,
  ArtifactOperatingSystem,
  Checksum
} from "../domain/artifact.js"
import {
  CommandSpec,
  PublishCommandOperation,
  ValidateCommandOperation,
  ValidationNoteOperation
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
  readonly command: CommandSpec
}

interface DryRunValidationOperationOptions extends Omit<DryRunValidationNoteOptions, "dryRunSupport"> {
  readonly dryRunSupport: TargetDryRunSupport
  readonly nativeDescription: string
  readonly command: CommandSpec
}

interface ArtifactErrorReasons {
  readonly targetId: string
  readonly directoryReason: string
  readonly checksumReason: string
}

export interface ArtifactVariantCriteria {
  readonly os?: ArtifactOperatingSystem | undefined
  readonly arch?: ArtifactArchitecture | undefined
  readonly libc?: ArtifactLibc | undefined
  readonly binaryName?: string | undefined
  readonly executableExtension?: string | undefined
  readonly installPath?: string | undefined
  readonly targetTriple?: string | undefined
}

interface ArtifactInventory {
  readonly artifacts: ReadonlyArray<ArtifactInventoryItem>
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
}

interface CatalogGitPublishOperationOptions extends CatalogGitPushOperationOptions {
  readonly filePath: string
  readonly commitMessage: string
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
    command: noAuthCommand("git", ["-C", options.directory ?? ".", "push"])
  })
}

const catalogFilePath = (filePath: string, directory: string | undefined): string => {
  if (directory === undefined) {
    return filePath
  }
  const normalizedFilePath = filePath.replaceAll("\\", "/")
  const normalizedDirectory = directory.replaceAll("\\", "/").replace(/\/+$/, "")
  const prefix = `${normalizedDirectory}/`
  return normalizedFilePath.startsWith(prefix)
    ? normalizedFilePath.slice(prefix.length)
    : filePath
}

export const catalogGitPublishOperations = (
  options: CatalogGitPublishOperationOptions
): ReadonlyArray<PublishCommandOperation> => [
  PublishCommandOperation.make({
    id: `${options.id}:add`,
    targetId: options.targetId,
    description: `Stage ${catalogPathBaseName(options.filePath)} for ${options.targetId}.`,
    risk: "writes-local",
    command: noAuthCommand("git", [
      "-C",
      options.directory ?? ".",
      "add",
      catalogFilePath(options.filePath, options.directory)
    ])
  }),
  PublishCommandOperation.make({
    id: `${options.id}:commit`,
    targetId: options.targetId,
    description: `Commit ${catalogPathBaseName(options.filePath)} for ${options.targetId}.`,
    risk: "writes-local",
    command: noAuthCommand("git", [
      "-C",
      options.directory ?? ".",
      "commit",
      "-m",
      options.commitMessage
    ])
  }),
  catalogGitPushOperation(options)
]

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
    command: options.command
  })

export const validationNoteOperation = (options: DryRunValidationNoteOptions): ValidationNoteOperation =>
  ValidationNoteOperation.make({
    id: options.id,
    targetId: options.targetId,
    description: options.dryRunSupport === "simulated" ? options.simulatedDescription : options.skippedDescription,
    risk: "read-only",
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

const artifactMatchesVariantCriteria = (
  artifact: ArtifactInventoryItem,
  criteria: ArtifactVariantCriteria
): boolean => {
  const variant = artifact.variant
  if (variant === undefined) {
    return false
  }
  return (criteria.os === undefined || variant.os === criteria.os) &&
    (criteria.arch === undefined || variant.arch === criteria.arch) &&
    (criteria.libc === undefined || variant.libc === criteria.libc) &&
    (criteria.binaryName === undefined || variant.binaryName === criteria.binaryName) &&
    (criteria.executableExtension === undefined || variant.executableExtension === criteria.executableExtension) &&
    (criteria.installPath === undefined || variant.installPath === criteria.installPath) &&
    (criteria.targetTriple === undefined || variant.targetTriple === criteria.targetTriple)
}

export const findArtifactsByVariant = (
  model: ArtifactInventory,
  criteria: ArtifactVariantCriteria
): ReadonlyArray<ArtifactInventoryItem> =>
  model.artifacts.filter((artifact) => artifactMatchesVariantCriteria(artifact, criteria))

export const findRequiredArtifactVariant = Effect.fn("findRequiredArtifactVariant")(function*(
  model: ArtifactInventory,
  targetId: string,
  criteria: ArtifactVariantCriteria,
  missingReason: string,
  multipleReason: string = "Multiple artifacts matched the requested installable variant."
) {
  const artifacts = findArtifactsByVariant(model, criteria)
  if (artifacts.length === 0) {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId,
        reason: missingReason
      })
    )
  }
  if (artifacts.length > 1) {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId,
        reason: multipleReason
      })
    )
  }
  const artifact = artifacts[0]
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
