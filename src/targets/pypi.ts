import * as Effect from "effect/Effect"
import {
  CommandSpec,
  Operation,
  PublishCommandOperation
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  PyPiRegistryTarget,
  TargetAuthSetup,
  TargetCapabilities,
  TargetRequiredPermission
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"
import { PyPiTargetAdapter } from "./adapter.js"
import {
  dryRunValidationOperation,
  noAuthCommand,
  readOnlyCommandValidationOperation,
  rejectNoDryRunInStrictMode,
  targetCapabilitiesFor,
  validationNoteOperation,
  validationStrategyForDryRun
} from "./adapter-helpers.js"

export type * from "../types/effect-internal.js"

const twineUsernameEnv = "TWINE_USERNAME"
const twinePasswordEnv = "TWINE_PASSWORD"
const trustedPublishingAuthEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
]

const envNames = (target: PyPiRegistryTarget): ReadonlyArray<string> =>
  target.trustedPublishing !== undefined
    ? trustedPublishingAuthEnvNames
    : target.usernameEnv === undefined || target.passwordEnv === undefined
    ? []
    : [target.usernameEnv, target.passwordEnv]

const pythonExecutable = (target: PyPiRegistryTarget): string =>
  target.pythonExecutable ?? "python"

const twineAuthCommand = (
  target: PyPiRegistryTarget,
  args: ReadonlyArray<string>
): CommandSpec =>
  CommandSpec.make({
    executable: pythonExecutable(target),
    args: ["-m", "twine", ...args],
    requiredEnv: envNames(target),
    redactedEnv: envNames(target)
  })

const trustedPublishingAuthSetup = (workflow: string): TargetAuthSetup =>
  TargetAuthSetup.make({
    runsIn: "ci",
    provider: "github-actions",
    workflow,
    requiredPermissions: [
      TargetRequiredPermission.make({ name: "id-token", value: "write" })
    ],
    prerequisites: ["pypi-trusted-publisher-configured"]
  })

export const pypiTargetCapabilities = (target: PyPiRegistryTarget): TargetCapabilities =>
  targetCapabilitiesFor(
    target,
    validationStrategyForDryRun(target.dryRunSupport),
    target.trustedPublishing === undefined
      ? undefined
      : trustedPublishingAuthSetup(target.trustedPublishing.workflow)
  )

const targetArtifacts = (target: PyPiRegistryTarget, model: ReleaseModel) =>
  model.artifacts.filter((artifact) => artifact.consumers.includes(target.id))

const pypiDryRunOperation = (target: PyPiRegistryTarget, artifactPaths: ReadonlyArray<string>): Operation =>
  dryRunValidationOperation({
    id: `${target.id}:twine-check`,
    targetId: target.id,
    dryRunSupport: target.dryRunSupport,
    nativeDescription: "Validate Python distribution metadata with twine check.",
    command: noAuthCommand(pythonExecutable(target), ["-m", "twine", "check", ...artifactPaths]),
    simulatedDescription: "Record simulated PyPI distribution validation.",
    skippedDescription: "Record skipped PyPI distribution validation.",
    simulatedMessage:
      "PyPI distribution validation is simulated by the deterministic release plan; no twine check command was planned.",
    skippedMessage: "PyPI distribution validation was skipped because this target declares no dry-run support."
  })

const pypiPublishArgs = (
  target: PyPiRegistryTarget,
  artifactPaths: ReadonlyArray<string>
): ReadonlyArray<string> => [
  "upload",
  "--non-interactive",
  "--repository-url",
  target.repositoryUrl,
  ...artifactPaths
]

const pypiAuthOperation = (target: PyPiRegistryTarget): ReadonlyArray<Operation> =>
  target.trustedPublishing === undefined
    ? []
    : [
      validationNoteOperation({
        id: `${target.id}:twine-trusted-publishing-auth`,
        targetId: target.id,
        dryRunSupport: "simulated",
        simulatedDescription: "Record PyPI trusted publishing authentication mode.",
        skippedDescription: "Record skipped PyPI trusted publishing authentication mode.",
        simulatedMessage:
          `PyPI trusted publishing authenticates during twine upload with CI OIDC; twine check does not validate this mode. This target expects provider ${target.trustedPublishing.provider}, workflow ${target.trustedPublishing.workflow}, GitHub Actions permission id-token: write, and a trusted publisher configured on PyPI.`,
        skippedMessage: "PyPI trusted publishing authentication validation was skipped."
      })
    ]

const validateAuthConfig = (target: PyPiRegistryTarget): Effect.Effect<void, PlanConstructionError> => {
  const hasUsername = target.usernameEnv !== undefined
  const hasPassword = target.passwordEnv !== undefined

  if (target.trustedPublishing !== undefined && (hasUsername || hasPassword)) {
    return Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: "PyPI trusted publishing uses CI OIDC and must not also declare usernameEnv or passwordEnv."
      })
    )
  }
  if (!hasUsername && !hasPassword) {
    return Effect.void
  }
  if (hasUsername !== hasPassword) {
    return Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: "PyPI token auth must configure both usernameEnv and passwordEnv, or neither."
      })
    )
  }
  if (target.usernameEnv === twineUsernameEnv && target.passwordEnv === twinePasswordEnv) {
    return Effect.void
  }
  return Effect.fail(
    PlanConstructionError.make({
      targetId: target.id,
      reason:
        "PyPI token auth only supports usernameEnv TWINE_USERNAME and passwordEnv TWINE_PASSWORD because Twine reads those environment variables directly; this adapter keeps secrets out of argv and does not remap env names."
    })
  )
}

export const planPyPiOperations = Effect.fn("planPyPiOperations")(function*(
  target: PyPiRegistryTarget,
  model: ReleaseModel
) {
  yield* validateAuthConfig(target)
  yield* rejectNoDryRunInStrictMode(target, model, "PyPI target declares no dry-run support in strict mode.")

  const artifacts = targetArtifacts(target, model)
  if (artifacts.length === 0) {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: "PyPI target must have at least one artifact consumer."
      })
    )
  }
  const directoryArtifact = artifacts.find((artifact) => artifact.format === "directory")
  if (directoryArtifact !== undefined) {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: `PyPI target artifact ${directoryArtifact.id} must be a built distribution file, not a directory.`
      })
    )
  }

  const artifactPaths = artifacts.map((artifact) => artifact.path)
  return [
    readOnlyCommandValidationOperation({
      id: `${target.id}:python-version`,
      targetId: target.id,
      description: "Check Python CLI availability.",
      command: noAuthCommand(pythonExecutable(target), ["--version"])
    }),
    readOnlyCommandValidationOperation({
      id: `${target.id}:twine-version`,
      targetId: target.id,
      description: "Check Twine CLI availability.",
      command: noAuthCommand(pythonExecutable(target), ["-m", "twine", "--version"])
    }),
    ...pypiAuthOperation(target),
    pypiDryRunOperation(target, artifactPaths),
    PublishCommandOperation.make({
      id: `${target.id}:twine-upload`,
      targetId: target.id,
      description: `Publish ${model.identity.name}@${model.identity.version} to PyPI-compatible registry.`,
      risk: "irreversible",
      command: twineAuthCommand(target, pypiPublishArgs(target, artifactPaths))
    })
  ] satisfies ReadonlyArray<Operation>
})

export const PyPiAdapter: PyPiTargetAdapter = {
  targetTag: "PyPiRegistryTarget",
  capabilities: pypiTargetCapabilities,
  planOperations: planPyPiOperations
}
