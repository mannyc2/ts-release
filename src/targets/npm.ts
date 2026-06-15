import * as Effect from "effect/Effect"
import {
  CommandSpec,
  irreversibleGate,
  noApprovalGate,
  Operation,
  PublishCommandOperation,
  ValidateCommandOperation,
  ValidationNoteOperation
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import { NpmRegistryTarget, TargetCapabilities, targetAuthRequirement, TargetValidationStrategy } from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"
import { NpmTargetAdapter } from "./adapter.js"

export type * from "../types/effect-internal.js"

const envNames = (target: NpmRegistryTarget): ReadonlyArray<string> =>
  target.tokenEnv === undefined ? [] : [target.tokenEnv]

const npmCommand = (
  target: NpmRegistryTarget,
  args: ReadonlyArray<string>,
  cwd: string | undefined,
  includeAuth: boolean
): CommandSpec =>
  CommandSpec.make({
    executable: "npm",
    args: [...args],
    ...(cwd === undefined ? {} : { cwd }),
    requiredEnv: includeAuth ? envNames(target) : [],
    redactedEnv: includeAuth ? envNames(target) : []
  })

const npmValidationStrategy = (target: NpmRegistryTarget): TargetValidationStrategy => {
  if (target.dryRunSupport === "native") {
    return "native-command"
  }
  if (target.dryRunSupport === "simulated") {
    return "simulated-plan"
  }
  return "skipped"
}

export const npmTargetCapabilities = (target: NpmRegistryTarget): TargetCapabilities =>
  TargetCapabilities.make({
    targetId: target.id,
    targetTag: target._tag,
    authRequirement: targetAuthRequirement(target),
    dryRunSupport: target.dryRunSupport,
    mutability: target.mutability,
    recovery: target.recovery,
    validationStrategy: npmValidationStrategy(target)
  })

const npmDryRunOperation = (target: NpmRegistryTarget): Operation =>
  target.dryRunSupport === "native"
    ? ValidateCommandOperation.make({
      id: `${target.id}:npm-pack-dry-run`,
      targetId: target.id,
      description: "Validate npm package contents with npm pack dry-run.",
      risk: "read-only",
      gate: noApprovalGate("npm pack --dry-run validates package contents without publishing."),
      command: npmCommand(target, ["pack", "--dry-run", "--json", target.packagePath], undefined, false)
    })
    : ValidationNoteOperation.make({
      id: `${target.id}:npm-pack-dry-run`,
      targetId: target.id,
      description: target.dryRunSupport === "simulated"
        ? "Record simulated npm dry-run validation."
        : "Record skipped npm dry-run validation.",
      risk: "read-only",
      gate: noApprovalGate("Validation notes do not modify local or remote state."),
      message: target.dryRunSupport === "simulated"
        ? "npm dry-run validation is marked as simulated by target configuration; no npm pack --dry-run command was planned."
        : "npm dry-run validation was skipped because this target declares no dry-run support.",
      skipped: target.dryRunSupport === "none",
      severity: "warning"
    })

const npmPublishArgs = (target: NpmRegistryTarget): ReadonlyArray<string> => {
  const args = ["publish", target.packagePath, "--registry", target.registry]
  if (target.provenance === true) {
    args.push("--provenance")
  }
  return args
}

export const planNpmOperations = Effect.fn("planNpmOperations")(function*(
  target: NpmRegistryTarget,
  model: ReleaseModel
) {
  if (model.strict && target.dryRunSupport === "none") {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: "npm target declares no dry-run support in strict mode."
      })
    )
  }
  const operations: Array<Operation> = [
    ValidateCommandOperation.make({
      id: `${target.id}:npm-version`,
      targetId: target.id,
      description: "Check npm CLI availability.",
      risk: "read-only",
      gate: noApprovalGate("CLI availability validation is read-only."),
      command: npmCommand(target, ["--version"], undefined, false)
    }),
    ValidateCommandOperation.make({
      id: `${target.id}:npm-whoami`,
      targetId: target.id,
      description: "Validate npm CLI authentication.",
      risk: "read-only",
      gate: noApprovalGate("npm whoami checks CLI authentication without publishing."),
      command: npmCommand(target, ["whoami", "--registry", target.registry], undefined, true)
    }),
    npmDryRunOperation(target),
    PublishCommandOperation.make({
      id: `${target.id}:npm-publish`,
      targetId: target.id,
      description: `Publish ${model.identity.name}@${model.identity.version} to npm.`,
      risk: "irreversible",
      gate: irreversibleGate("npm package versions are immutable once published."),
      command: npmCommand(target, npmPublishArgs(target), undefined, true)
    })
  ]

  return operations
})

export const NpmAdapter: NpmTargetAdapter = {
  targetTag: "NpmRegistryTarget",
  capabilities: npmTargetCapabilities,
  planOperations: planNpmOperations
}
