// Invariant: resolved PyPI auth is validated once and only selected distribution files reach Twine.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { Artifact } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { CommandAction, CommandSpec, Operation } from "../../grammar/operation.js"
import { featurePlanner } from "../../grammar/planner.js"
import { findCatalogArtifact } from "../catalog/shared.js"
import {
  publishingAuthEnvNames,
  trustedPublishingConfigFields
} from "./trusted-publishing.js"
import { noAuthCommand, readOnlyCommandValidationOperation, validationNoteOperation } from "./operations.js"
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
  usernameEnv: Schema.optionalKey(Schema.String),
  passwordEnv: Schema.optionalKey(Schema.String),
  trustedPublishing: Schema.optionalKey(ReleaseConfigPyPiTrustedPublishing),
  artifactIds: Schema.optionalKey(Schema.NonEmptyArray(Schema.NonEmptyString))
}) {}

const selectArtifacts = Effect.fn("publish.pypi.selectArtifacts")(function*(
  section: ReleaseConfigPyPiPublish,
  available: ReadonlyArray<Artifact>
) {
  const artifacts = section.artifactIds === undefined
    ? available.filter((artifact) => artifact.kind === "wheel")
    : yield* Effect.forEach(section.artifactIds, (id) => findCatalogArtifact({
      pipeId: "publish:pypi", field: "publish.pypi.artifactIds", target: "PyPI"
    }, available, id))
  if (artifacts.length === 0) return yield* Effect.fail(PlanError.make({
    pipeId: "publish:pypi", field: "artifacts", reason: "PyPI target must have at least one artifact consumer."
  }))
  const directory = artifacts.find((artifact) =>
    artifact.kind === "package" || (artifact.extra?._tag === "file" && artifact.extra.format === "directory"))
  if (directory !== undefined) return yield* Effect.fail(PlanError.make({
    pipeId: "publish:pypi",
    field: "artifacts",
    reason: `PyPI target artifact ${directory.id} must be a built distribution file, not a directory.`
  }))
  return artifacts
})

const check = (id: string, description: string, section: ReleaseConfigPyPiPublish, args: ReadonlyArray<string>) =>
  readOnlyCommandValidationOperation({
    id, pipeId: "publish:pypi", description,
    command: noAuthCommand(section.pythonExecutable, args)
  })

export const publishPyPiPlanner = featurePlanner<ReleaseConfigPyPiPublish>("publish:pypi", (section, state) => Effect.gen(function*() {
    const paths = (yield* selectArtifacts(section, state.artifacts)).map(({ path }) => path)
    const operations: Array<Operation> = [
      check("pypi:python-version", "Check Python CLI availability.", section, ["--version"]),
      check("pypi:twine-version", "Check Twine CLI availability.", section, ["-m", "twine", "--version"])
    ]
    if (section.trustedPublishing !== undefined) operations.push(validationNoteOperation({
      id: "pypi:twine-trusted-publishing-auth",
      pipeId: "publish:pypi",
      description: "Record PyPI trusted publishing authentication mode.",
      message:
        `PyPI trusted publishing authenticates during twine upload with CI OIDC; twine check does not validate this mode. This target expects provider ${section.trustedPublishing.provider}, workflow ${section.trustedPublishing.workflow}, GitHub Actions permission id-token: write, and a trusted publisher configured on PyPI.`
    }))
    operations.push(
      check("pypi:twine-check", "Validate Python distribution metadata with twine check.", section, [
        "-m", "twine", "check", ...paths
      ]),
      Operation.make({
        id: "pypi:twine-upload",
        pipeId: "publish:pypi",
        phase: "publish",
        risk: "irreversible",
        description: `Publish ${state.identity.name}@${state.identity.version} to PyPI-compatible registry.`,
        action: CommandAction.make({ command: (() => {
          const env = publishingAuthEnvNames(section.trustedPublishing !== undefined, [section.usernameEnv, section.passwordEnv])
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
