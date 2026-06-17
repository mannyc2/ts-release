import * as Effect from "effect/Effect"
import {
  CommandSpec,
  irreversibleGate,
  noApprovalGate,
  Operation,
  PublishCommandOperation,
  ValidateCommandOperation,
  VerifyRemoteOperation
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  NpmRegistryTarget,
  TargetAuthSetup,
  TargetCapabilities,
  TargetRequiredPermission
} from "../domain/target.js"
import { NpmTargetAdapter } from "./adapter.js"
import {
  rejectNoDryRunInStrictMode,
  targetCapabilitiesFor,
  validationNoteOperation,
  validationStrategyForDryRun
} from "./adapter-helpers.js"

export type * from "../types/effect-internal.js"

const isTrustedPublishing = (target: NpmRegistryTarget): boolean =>
  target.trustedPublishing !== undefined

const envNames = (target: NpmRegistryTarget): ReadonlyArray<string> =>
  isTrustedPublishing(target) || target.tokenEnv === undefined ? [] : [target.tokenEnv]

const trustedPublishingRequiredEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
]

const requiredAuthEnvNames = (target: NpmRegistryTarget): ReadonlyArray<string> =>
  isTrustedPublishing(target) ? trustedPublishingRequiredEnvNames : envNames(target)

const redactedAuthEnvNames = (target: NpmRegistryTarget): ReadonlyArray<string> =>
  isTrustedPublishing(target) ? trustedPublishingRequiredEnvNames : envNames(target)

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
    requiredEnv: includeAuth ? requiredAuthEnvNames(target) : [],
    redactedEnv: includeAuth ? redactedAuthEnvNames(target) : []
  })

const trustedPublishingAuthSetup = (workflow: string): TargetAuthSetup =>
  TargetAuthSetup.make({
    runsIn: "ci",
    provider: "github-actions",
    workflow,
    requiredPermissions: [
      TargetRequiredPermission.make({ name: "id-token", value: "write" })
    ],
    prerequisites: ["npm-package-exists"]
  })

export const npmTargetCapabilities = (target: NpmRegistryTarget): TargetCapabilities => {
  const trustedPublishing = target.trustedPublishing
  if (trustedPublishing === undefined) {
    return targetCapabilitiesFor(target, validationStrategyForDryRun(target.dryRunSupport))
  }
  return TargetCapabilities.make({
    targetId: target.id,
    targetTag: target._tag,
    authRequirement: "trusted-publishing",
    dryRunSupport: target.dryRunSupport,
    mutability: target.mutability,
    recovery: target.recovery,
    validationStrategy: validationStrategyForDryRun(target.dryRunSupport),
    authSetup: trustedPublishingAuthSetup(trustedPublishing.workflow)
  })
}

const npmDryRunOperation = (target: NpmRegistryTarget): Operation => {
  const dryRunSupport = target.dryRunSupport
  return dryRunSupport === "native"
    ? ValidateCommandOperation.make({
      id: `${target.id}:npm-pack-dry-run`,
      targetId: target.id,
      description: "Validate npm package contents with npm pack dry-run.",
      risk: "read-only",
      gate: noApprovalGate("npm pack --dry-run validates package contents without publishing."),
      command: npmCommand(target, ["pack", "--dry-run", "--json", target.packagePath], undefined, false)
    })
    : validationNoteOperation({
      id: `${target.id}:npm-pack-dry-run`,
      targetId: target.id,
      dryRunSupport,
      simulatedDescription: "Record simulated npm dry-run validation.",
      skippedDescription: "Record skipped npm dry-run validation.",
      simulatedMessage:
        "npm dry-run validation is marked as simulated by target configuration; no npm pack --dry-run command was planned.",
      skippedMessage: "npm dry-run validation was skipped because this target declares no dry-run support."
    })
}

const npmAuthOperation = (target: NpmRegistryTarget): Operation =>
  target.trustedPublishing !== undefined
    ? validationNoteOperation({
      id: `${target.id}:npm-trusted-publishing-auth`,
      targetId: target.id,
      dryRunSupport: "simulated",
      simulatedDescription: "Record npm trusted publishing authentication mode.",
      skippedDescription: "Record skipped npm trusted publishing authentication mode.",
      simulatedMessage:
        `NPM trusted publishing authenticates during npm publish with CI OIDC; npm whoami does not validate this mode. This target expects provider ${target.trustedPublishing.provider}, workflow ${target.trustedPublishing.workflow}, GitHub Actions permission id-token: write, and package ${target.packageName} to already exist on the registry.`,
      skippedMessage: "NPM trusted publishing authentication validation was skipped."
    })
    : ValidateCommandOperation.make({
      id: `${target.id}:npm-whoami`,
      targetId: target.id,
      description: "Validate npm CLI authentication.",
      risk: "read-only",
      gate: noApprovalGate("npm whoami checks CLI authentication without publishing."),
      command: npmCommand(target, ["whoami", "--registry", target.registry], undefined, true)
    })

const npmPackageExistsOperation = (target: NpmRegistryTarget): Operation =>
  ValidateCommandOperation.make({
    id: `${target.id}:npm-package-exists`,
    targetId: target.id,
    description: "Verify npm package exists before trusted publishing.",
    risk: "read-only",
    gate: noApprovalGate("npm view checks package metadata without publishing."),
    command: npmCommand(target, ["view", target.packageName, "name", "--registry", target.registry], undefined, false)
  })

const npmPublishArgs = (target: NpmRegistryTarget): ReadonlyArray<string> => {
  const args = ["publish", target.packagePath, "--registry", target.registry]
  if (target.access !== undefined) {
    args.push("--access", target.access)
  }
  if (target.provenance === true) {
    args.push("--provenance")
  }
  return args
}

export const planNpmOperations = Effect.fn("planNpmOperations")(function*(
  target: NpmRegistryTarget,
  model: ReleaseModel
) {
  yield* rejectNoDryRunInStrictMode(target, model, "npm target declares no dry-run support in strict mode.")
  const operations: Array<Operation> = [
    ValidateCommandOperation.make({
      id: `${target.id}:npm-version`,
      targetId: target.id,
      description: "Check npm CLI availability.",
      risk: "read-only",
      gate: noApprovalGate("CLI availability validation is read-only."),
      command: npmCommand(target, ["--version"], undefined, false)
    }),
    npmAuthOperation(target),
    ...(target.trustedPublishing?.verifyPackageExists === true ? [npmPackageExistsOperation(target)] : []),
    npmDryRunOperation(target),
    PublishCommandOperation.make({
      id: `${target.id}:npm-publish`,
      targetId: target.id,
      description: `Publish ${target.packageName}@${model.identity.version} to npm.`,
      risk: "irreversible",
      gate: irreversibleGate("npm package versions are immutable once published."),
      command: npmCommand(target, npmPublishArgs(target), undefined, true)
    }),
    VerifyRemoteOperation.make({
      id: `${target.id}:npm-version-verify`,
      targetId: target.id,
      description: `Verify ${target.packageName}@${model.identity.version} exists on npm.`,
      risk: "read-only",
      gate: noApprovalGate("npm view verifies published package metadata without publishing."),
      command: npmCommand(
        target,
        ["view", `${target.packageName}@${model.identity.version}`, "version", "--registry", target.registry],
        undefined,
        false
      )
    })
  ]

  return operations
})

export const NpmAdapter: NpmTargetAdapter = {
  targetTag: "NpmRegistryTarget",
  capabilities: npmTargetCapabilities,
  planOperations: planNpmOperations
}
