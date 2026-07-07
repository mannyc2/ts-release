import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { WorkflowFileName } from "../pipeline/artifact.js"
import type { Artifact } from "../pipeline/artifact.js"
import { byKind, filterCatalog } from "../pipeline/catalog.js"
import { PlanError } from "../pipeline/errors.js"
import {
  CommandAction,
  CommandSpec,
  Operation
} from "../pipeline/operation.js"
import {
  dryRunValidationOperation,
  noAuthCommand,
  readOnlyCommandValidationOperation,
  validationNoteOperation
} from "../pipeline/operation-helpers.js"
import { optionalField } from "../pipeline/optional-field.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"

const TrustedPublishingProvider = Schema.Literals(["github-actions"])

export class ReleaseConfigPyPiTrustedPublishing extends Schema.Class<ReleaseConfigPyPiTrustedPublishing>(
  "ReleaseConfigPyPiTrustedPublishing"
)({
  provider: Schema.optionalKey(TrustedPublishingProvider),
  workflow: Schema.optionalKey(WorkflowFileName),
  publisherConfigured: Schema.optionalKey(Schema.Literal(true))
}) {}

export class ReleaseConfigPyPiPublish extends Schema.Class<ReleaseConfigPyPiPublish>("ReleaseConfigPyPiPublish")({
  repositoryUrl: Schema.optionalKey(Schema.String),
  pythonExecutable: Schema.optionalKey(Schema.String),
  usernameEnv: Schema.optionalKey(Schema.String),
  passwordEnv: Schema.optionalKey(Schema.String),
  trustedPublishing: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigPyPiTrustedPublishing]))
}) {}

interface PyPiTrustedPublishingSection {
  readonly provider: "github-actions"
  readonly workflow: string
}

interface PyPiPublishSection {
  readonly repositoryUrl: string
  readonly pythonExecutable?: string | undefined
  readonly usernameEnv?: string | undefined
  readonly passwordEnv?: string | undefined
  readonly trustedPublishing?: PyPiTrustedPublishingSection | undefined
}

const twineUsernameEnv = "TWINE_USERNAME"
const twinePasswordEnv = "TWINE_PASSWORD"
const trustedPublishingAuthEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
]

const compactTrustedPublishing = (
  config: boolean | ReleaseConfigPyPiTrustedPublishing | undefined
): PyPiTrustedPublishingSection | undefined => {
  if (config === undefined || config === false) {
    return undefined
  }
  if (config === true) {
    return {
      provider: "github-actions",
      workflow: "release.yml"
    }
  }
  return {
    provider: config.provider ?? "github-actions",
    workflow: config.workflow ?? "release.yml"
  }
}

const sectionFromConfig = (config: {
  readonly publish: {
    readonly pypi?: boolean | ReleaseConfigPyPiPublish | undefined
  }
}): PyPiPublishSection | undefined => {
  const publish = config.publish.pypi
  if (publish === undefined || publish === false) {
    return undefined
  }
  const object = publish === true ? undefined : publish
  return {
    repositoryUrl: object?.repositoryUrl ?? "https://upload.pypi.org/legacy/",
    ...optionalField(object?.pythonExecutable, (pythonExecutable) => ({ pythonExecutable })),
    ...optionalField(object?.usernameEnv, (usernameEnv) => ({ usernameEnv })),
    ...optionalField(object?.passwordEnv, (passwordEnv) => ({ passwordEnv })),
    ...optionalField(object?.trustedPublishing, (trustedPublishing) => ({
      trustedPublishing: compactTrustedPublishing(trustedPublishing)
    }))
  }
}

const pythonExecutable = (section: PyPiPublishSection): string =>
  section.pythonExecutable ?? "python"

const envNames = (section: PyPiPublishSection): ReadonlyArray<string> =>
  section.trustedPublishing !== undefined
    ? trustedPublishingAuthEnvNames
    : section.usernameEnv === undefined || section.passwordEnv === undefined
    ? []
    : [section.usernameEnv, section.passwordEnv]

const twineAuthCommand = (
  section: PyPiPublishSection,
  args: ReadonlyArray<string>
): CommandSpec =>
  CommandSpec.make({
    executable: pythonExecutable(section),
    args: ["-m", "twine", ...args],
    requiredEnv: envNames(section),
    redactedEnv: envNames(section)
  })

const validateAuthConfig = (section: PyPiPublishSection): Effect.Effect<void, PlanError> => {
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

const pypiArtifacts = (artifacts: ReadonlyArray<Artifact>): ReadonlyArray<Artifact> =>
  artifacts.filter((artifact) => artifact.kind === "wheel" || artifact.id === "wheel")

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

const pypiAuthOperation = (section: PyPiPublishSection): ReadonlyArray<Operation> =>
  section.trustedPublishing === undefined
    ? []
    : [
      validationNoteOperation({
        id: "pypi:twine-trusted-publishing-auth",
        pipeId: "publish:pypi",
        dryRunSupport: "simulated",
        simulatedDescription: "Record PyPI trusted publishing authentication mode.",
        skippedDescription: "Record skipped PyPI trusted publishing authentication mode.",
        simulatedMessage:
          `PyPI trusted publishing authenticates during twine upload with CI OIDC; twine check does not validate this mode. This target expects provider ${section.trustedPublishing.provider}, workflow ${section.trustedPublishing.workflow}, GitHub Actions permission id-token: write, and a trusted publisher configured on PyPI.`,
        skippedMessage: "PyPI trusted publishing authentication validation was skipped."
      })
    ]

const pypiPublishArgs = (
  section: PyPiPublishSection,
  artifactPaths: ReadonlyArray<string>
): ReadonlyArray<string> => [
  "upload",
  "--non-interactive",
  "--repository-url",
  section.repositoryUrl,
  ...artifactPaths
]

export const publishPyPiPipe: Pipe<PyPiPublishSection> = {
  id: "publish:pypi",
  phase: "publish",
  section: sectionFromConfig,
  defaults: (section) => section,
  plan: (section, state) =>
    Effect.gen(function*() {
      yield* validateAuthConfig(section)
      const artifacts = pypiArtifacts(filterCatalog(state.artifacts, byKind("wheel", "file")))
      yield* rejectInvalidArtifacts(artifacts)
      const artifactPaths = artifacts.map((artifact) => artifact.path)
      return {
        ...emptyContribution,
        operations: [
          readOnlyCommandValidationOperation({
            id: "pypi:python-version",
            pipeId: "publish:pypi",
            description: "Check Python CLI availability.",
            command: noAuthCommand(pythonExecutable(section), ["--version"])
          }),
          readOnlyCommandValidationOperation({
            id: "pypi:twine-version",
            pipeId: "publish:pypi",
            description: "Check Twine CLI availability.",
            command: noAuthCommand(pythonExecutable(section), ["-m", "twine", "--version"])
          }),
          ...pypiAuthOperation(section),
          dryRunValidationOperation({
            id: "pypi:twine-check",
            pipeId: "publish:pypi",
            dryRunSupport: "native",
            nativeDescription: "Validate Python distribution metadata with twine check.",
            command: noAuthCommand(pythonExecutable(section), ["-m", "twine", "check", ...artifactPaths]),
            simulatedDescription: "Record simulated PyPI distribution validation.",
            skippedDescription: "Record skipped PyPI distribution validation.",
            simulatedMessage:
              "PyPI distribution validation is simulated by the deterministic release plan; no twine check command was planned.",
            skippedMessage: "PyPI distribution validation was skipped because this target declares no dry-run support."
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
