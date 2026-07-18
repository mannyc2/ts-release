import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { Artifact } from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  CommandAction,
  CommandSpec,
  Operation
} from "../pipeline/operation.js"
import {
  noAuthCommand,
  readOnlyCommandValidationOperation,
  validationNoteOperation
} from "../pipeline/operation-helpers.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import {
  compactTrustedPublishing,
  findCatalogArtifact,
  publishingAuthEnvNames,
  trustedPublishingConfigFields,
  type TrustedPublishingSection
} from "./shared.js"

export class ReleaseConfigPyPiTrustedPublishing extends Schema.Class<ReleaseConfigPyPiTrustedPublishing>(
  "ReleaseConfigPyPiTrustedPublishing"
)({
  ...trustedPublishingConfigFields,
  publisherConfigured: Schema.optionalKey(Schema.Literal(true))
}) {}

export class ReleaseConfigPyPiPublish extends Schema.Class<ReleaseConfigPyPiPublish>("ReleaseConfigPyPiPublish")({
  repositoryUrl: Schema.optionalKey(Schema.String),
  pythonExecutable: Schema.optionalKey(Schema.String),
  usernameEnv: Schema.optionalKey(Schema.String),
  passwordEnv: Schema.optionalKey(Schema.String),
  trustedPublishing: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigPyPiTrustedPublishing])),
  artifactIds: Schema.optionalKey(Schema.NonEmptyArray(Schema.NonEmptyString))
}) {}

export interface ResolvedPyPiPublish {
  readonly repositoryUrl: string
  readonly pythonExecutable: string
  readonly usernameEnv?: string | undefined
  readonly passwordEnv?: string | undefined
  readonly trustedPublishing?: TrustedPublishingSection | undefined
  readonly artifactIds?: readonly [string, ...Array<string>] | undefined
}

const twineUsernameEnv = "TWINE_USERNAME"
const twinePasswordEnv = "TWINE_PASSWORD"

export const resolvePyPiPublish = (
  publish: boolean | ReleaseConfigPyPiPublish | undefined
): ResolvedPyPiPublish | undefined => {
  if (publish === undefined || publish === false) {
    return undefined
  }
  const object = publish === true ? undefined : publish
  return {
    repositoryUrl: object?.repositoryUrl ?? "https://upload.pypi.org/legacy/",
    pythonExecutable: object?.pythonExecutable ?? "python",
    usernameEnv: object?.usernameEnv,
    passwordEnv: object?.passwordEnv,
    trustedPublishing: compactTrustedPublishing(object?.trustedPublishing),
    artifactIds: object?.artifactIds
  }
}

const envNames = (section: ResolvedPyPiPublish): ReadonlyArray<string> =>
  publishingAuthEnvNames(section.trustedPublishing, [section.usernameEnv, section.passwordEnv])

const twineAuthCommand = (
  section: ResolvedPyPiPublish,
  args: ReadonlyArray<string>
): CommandSpec =>
  CommandSpec.make({
    executable: section.pythonExecutable,
    args: ["-m", "twine", ...args],
    requiredEnv: envNames(section),
    redactedEnv: envNames(section)
  })

const validateAuthConfig = (section: ResolvedPyPiPublish): Effect.Effect<void, PlanError> => {
  const hasUsername = section.usernameEnv !== undefined
  const hasPassword = section.passwordEnv !== undefined

  if (section.trustedPublishing !== undefined && (hasUsername || hasPassword)) {
    return Effect.fail(PlanError.make({
      pipeId: "publish:pypi",
      field: "publish.pypi",
      reason: "PyPI trusted publishing uses CI OIDC and must not also declare usernameEnv or passwordEnv."
    }))
  }
  if (!hasUsername && !hasPassword) {
    return Effect.void
  }
  if (hasUsername !== hasPassword) {
    return Effect.fail(PlanError.make({
      pipeId: "publish:pypi",
      field: "publish.pypi",
      reason: "PyPI token auth must configure both usernameEnv and passwordEnv, or neither."
    }))
  }
  if (section.usernameEnv === twineUsernameEnv && section.passwordEnv === twinePasswordEnv) {
    return Effect.void
  }
  return Effect.fail(PlanError.make({
    pipeId: "publish:pypi",
    field: "publish.pypi",
    reason:
      "PyPI token auth only supports usernameEnv TWINE_USERNAME and passwordEnv TWINE_PASSWORD because Twine reads those environment variables directly; this adapter keeps secrets out of argv and does not remap env names."
  }))
}

const pypiArtifactErrorSource = {
  pipeId: "publish:pypi",
  field: "publish.pypi.artifactIds",
  target: "PyPI"
}

const pypiArtifacts = Effect.fn("publish.pypi.selectArtifacts")(function*(
  section: ResolvedPyPiPublish,
  artifacts: ReadonlyArray<Artifact>
) {
  if (section.artifactIds !== undefined) {
    return yield* Effect.forEach(section.artifactIds, (artifactId) =>
      findCatalogArtifact(pypiArtifactErrorSource, artifacts, artifactId)
    )
  }
  return artifacts.filter((artifact) => artifact.kind === "wheel")
})

const rejectInvalidArtifacts = (
  artifacts: ReadonlyArray<Artifact>
): Effect.Effect<void, PlanError> => {
  if (artifacts.length === 0) {
    return Effect.fail(PlanError.make({
      pipeId: "publish:pypi",
      field: "artifacts",
      reason: "PyPI target must have at least one artifact consumer."
    }))
  }
  const directoryArtifact = artifacts.find((artifact) =>
    artifact.kind === "package" || (artifact.extra?._tag === "file" && artifact.extra.format === "directory")
  )
  if (directoryArtifact !== undefined) {
    return Effect.fail(PlanError.make({
      pipeId: "publish:pypi",
      field: "artifacts",
      reason: `PyPI target artifact ${directoryArtifact.id} must be a built distribution file, not a directory.`
    }))
  }
  return Effect.void
}

const pypiAuthOperation = (section: ResolvedPyPiPublish): ReadonlyArray<Operation> =>
  section.trustedPublishing === undefined
    ? []
    : [
      validationNoteOperation({
        id: "pypi:twine-trusted-publishing-auth",
        pipeId: "publish:pypi",
        description: "Record PyPI trusted publishing authentication mode.",
        message:
          `PyPI trusted publishing authenticates during twine upload with CI OIDC; twine check does not validate this mode. This target expects provider ${section.trustedPublishing.provider}, workflow ${section.trustedPublishing.workflow}, GitHub Actions permission id-token: write, and a trusted publisher configured on PyPI.`
      })
    ]

const pypiPublishArgs = (
  section: ResolvedPyPiPublish,
  artifactPaths: ReadonlyArray<string>
): ReadonlyArray<string> => [
  "upload",
  "--non-interactive",
  "--repository-url",
  section.repositoryUrl,
  ...artifactPaths
]

export const publishPyPiPlanner: FeaturePlanner<ResolvedPyPiPublish> = {
  id: "publish:pypi",
  plan: (section, state) =>
    Effect.gen(function*() {
      yield* validateAuthConfig(section)
      const artifacts = yield* pypiArtifacts(section, state.artifacts)
      yield* rejectInvalidArtifacts(artifacts)
      const artifactPaths = artifacts.map((artifact) => artifact.path)
      return {
        ...emptyContribution,
        operations: [
          readOnlyCommandValidationOperation({
            id: "pypi:python-version",
            pipeId: "publish:pypi",
            description: "Check Python CLI availability.",
            command: noAuthCommand(section.pythonExecutable, ["--version"])
          }),
          readOnlyCommandValidationOperation({
            id: "pypi:twine-version",
            pipeId: "publish:pypi",
            description: "Check Twine CLI availability.",
            command: noAuthCommand(section.pythonExecutable, ["-m", "twine", "--version"])
          }),
          ...pypiAuthOperation(section),
          readOnlyCommandValidationOperation({
            id: "pypi:twine-check",
            pipeId: "publish:pypi",
            description: "Validate Python distribution metadata with twine check.",
            command: noAuthCommand(section.pythonExecutable, ["-m", "twine", "check", ...artifactPaths])
          }),
          Operation.make({
            id: "pypi:twine-upload",
            pipeId: "publish:pypi",
            phase: "publish",
            risk: "irreversible",
            description: `Publish ${state.identity.name}@${state.identity.version} to PyPI-compatible registry.`,
            action: CommandAction.make({ command: twineAuthCommand(section, pypiPublishArgs(section, artifactPaths)) })
          })
        ]
      }
    })
}
