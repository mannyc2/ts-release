// Invariant: resolved PyPI auth is validated once and only selected distribution files reach Twine.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { Artifact } from "../../grammar/artifact.js"
import { artifactIsDirectoryLike } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { CommandAction, CommandSpec } from "../../grammar/operation.js"
import { featureOperation, featurePlanner, type UnboundOperation } from "../../grammar/planner.js"
import { selectByIdsOrDefault } from "../shared.js"
import {
  publishingAuthEnvNames,
  trustedPublishingConfigFields
} from "./trusted-publishing.js"
import {
  noAuthCommand,
  readOnlyCommandValidationOperation,
  trustedPublishingMessage,
  validationNoteOperation
} from "./operations.js"
import { defaulted } from "../../grammar/defaulted.js"

export class ReleaseConfigPyPiTrustedPublishing extends Schema.Class<ReleaseConfigPyPiTrustedPublishing>(
  "ReleaseConfigPyPiTrustedPublishing"
)({
  ...trustedPublishingConfigFields,
  publisherConfigured: Schema.optionalKey(Schema.Literal(true))
}) {}

export class ReleaseConfigPyPiPublish extends Schema.Class<ReleaseConfigPyPiPublish>("ReleaseConfigPyPiPublish")({
  repositoryUrl: defaulted(Schema.String, "https://upload.pypi.org/legacy/"),
  pythonExecutable: defaulted(Schema.String, "python"),
  trustedPublishing: Schema.optionalKey(ReleaseConfigPyPiTrustedPublishing),
  ids: Schema.optionalKey(Schema.NonEmptyArray(Schema.NonEmptyString))
}) {}

// Twine reads these environment variable names directly.
const twineAuthEnvNames = ["TWINE_USERNAME", "TWINE_PASSWORD"] as const

const selectArtifacts = Effect.fn("publish.pypi.selectArtifacts")(function*(
  section: ReleaseConfigPyPiPublish,
  available: ReadonlyArray<Artifact>
) {
  const artifacts = yield* selectByIdsOrDefault(section.ids, available,
    (artifact) => artifact.kind === "wheel", {
      source: { pipeId: "publish:pypi", field: "publish.pypi.ids", target: "PyPI" }
    })
  if (artifacts.length === 0) return yield* Effect.fail(PlanError.make({
    pipeId: "publish:pypi", field: "artifacts", reason: "PyPI target must have at least one artifact consumer."
  }))
  const directory = artifacts.find(artifactIsDirectoryLike)
  if (directory !== undefined) return yield* Effect.fail(PlanError.make({
    pipeId: "publish:pypi",
    field: "artifacts",
    reason: `PyPI target artifact ${directory.id} must be a built distribution file, not a directory.`
  }))
  return artifacts
})

const check = (id: string, description: string, section: ReleaseConfigPyPiPublish, args: ReadonlyArray<string>) =>
  readOnlyCommandValidationOperation({
    id, description,
    command: noAuthCommand(section.pythonExecutable, args)
  })

export const publishPyPiPlanner = featurePlanner<ReleaseConfigPyPiPublish>("publish:pypi", (section, state) => Effect.gen(function*() {
    const paths = (yield* selectArtifacts(section, state.artifacts)).map(({ path }) => path)
    const operations: Array<UnboundOperation> = []
    if (section.trustedPublishing !== undefined) operations.push(validationNoteOperation({
      id: "pypi:twine-trusted-publishing-auth",
      description: "Record PyPI trusted publishing authentication mode.",
      message: trustedPublishingMessage({
        target: "PyPI", publishCommand: "twine upload", validationCommand: "twine check",
        provider: section.trustedPublishing.provider, workflow: section.trustedPublishing.workflow,
        expectation: "a trusted publisher configured on PyPI"
      })
    }))
    operations.push(
      check("pypi:twine-check", "Validate Python distribution metadata with twine check.", section, [
        "-m", "twine", "check", ...paths
      ]),
      featureOperation({
        id: "pypi:twine-upload",
        phase: "publish",
        risk: "irreversible",
        description: `Publish ${state.identity.name}@${state.identity.version} to PyPI-compatible registry.`,
        action: CommandAction.make({ command: (() => {
          const env = publishingAuthEnvNames(section.trustedPublishing !== undefined, twineAuthEnvNames)
          return CommandSpec.make({
            executable: section.pythonExecutable,
            args: ["-m", "twine", "upload", "--non-interactive", "--repository-url", section.repositoryUrl, ...paths],
            requiredEnv: env,
            redactedEnv: env
          })
        })() })
      })
    )
    return { operations }
  }))
