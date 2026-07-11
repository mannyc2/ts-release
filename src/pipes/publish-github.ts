import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { Artifact } from "../pipeline/artifact.js"
import { artifactPathBaseName } from "../pipeline/artifact.js"
import {
  GitHubReleaseAssetSpec,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  Operation
} from "../pipeline/operation.js"
import { validationNoteOperation } from "../pipeline/operation-helpers.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import { PlanError } from "../pipeline/errors.js"
import { hasSemverPrerelease } from "../pipeline/semver.js"

export class ReleaseConfigGitHubPublish extends Schema.Class<ReleaseConfigGitHubPublish>(
  "ReleaseConfigGitHubPublish"
)({
  repository: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String),
  draft: Schema.optionalKey(Schema.Boolean),
  prerelease: Schema.optionalKey(Schema.Union([Schema.Boolean, Schema.Literal("auto")]))
}) {}

interface GitHubPublishSection {
  readonly repository?: string | undefined
  readonly tokenEnv?: string | undefined
  readonly draft: boolean
  readonly prerelease: boolean | "auto"
}

const sectionFromConfig = (config: {
  readonly project: {
    readonly repository?: string | undefined
  }
  readonly publish: {
    readonly github?: boolean | ReleaseConfigGitHubPublish | undefined
  }
}): GitHubPublishSection | undefined => {
  const publish = config.publish.github
  if (publish === undefined || publish === false) {
    return undefined
  }
  const object = publish === true ? undefined : publish
  return {
    repository: object?.repository ?? config.project.repository,
    tokenEnv: object?.tokenEnv,
    draft: object?.draft ?? true,
    prerelease: object?.prerelease ?? false
  }
}

const requireRepository = (
  section: GitHubPublishSection
): Effect.Effect<GitHubPublishSection & { readonly repository: string }, PlanError> => {
  if (section.repository !== undefined && section.repository.trim().length > 0) {
    return Effect.succeed({ ...section, repository: section.repository })
  }
  return Effect.fail(PlanError.make({
    pipeId: "publish:github",
    field: "publish.github.repository",
    reason: "GitHub publishing requires publish.github.repository or project.repository."
  }))
}

const releaseAssets = (artifacts: ReadonlyArray<Artifact>): ReadonlyArray<Artifact> =>
  artifacts.filter((artifact) =>
    artifact.kind !== "package" &&
    artifact.kind !== "wheel" &&
    artifact.kind !== "catalog-file"
  )

const rejectInvalidAssets = (artifacts: ReadonlyArray<Artifact>): Effect.Effect<void, PlanError> => {
  const directory = artifacts.find((artifact) =>
    artifact.kind === "package" || (artifact.extra?._tag === "file" && artifact.extra.format === "directory")
  )
  if (directory !== undefined) {
    return Effect.fail(PlanError.make({
      pipeId: "publish:github",
      field: "publish.github.assets",
      reason: "GitHub release assets must be file-like, not directories."
    }))
  }
  return Effect.void
}

const githubReleaseAssetName = (pathName: string): string =>
  artifactPathBaseName(pathName)

const githubReleaseTitle = (identity: ReleaseIdentity): string =>
  `${identity.name} ${identity.version}`

const githubPrerelease = (
  prerelease: boolean | "auto",
  identity: ReleaseIdentity
): boolean =>
  prerelease === "auto"
    ? hasSemverPrerelease(identity.version)
    : prerelease

const githubReleaseAssets = (artifacts: ReadonlyArray<Artifact>): ReadonlyArray<GitHubReleaseAssetSpec> =>
  artifacts.map((artifact) =>
    GitHubReleaseAssetSpec.make({
      artifactId: artifact.id,
      path: artifact.path,
      name: githubReleaseAssetName(artifact.path),
      contentType: "application/octet-stream"
    })
  )

export const publishGitHubPipe: Pipe<GitHubPublishSection> = {
  id: "publish:github",
  phase: "publish",
  section: sectionFromConfig,
  plan: (rawSection, state) =>
    Effect.gen(function*() {
      const section = yield* requireRepository(rawSection)
      const assets = releaseAssets(state.artifacts.artifacts)
      yield* rejectInvalidAssets(assets)
      const title = githubReleaseTitle(state.identity)
      const prerelease = githubPrerelease(section.prerelease, state.identity)
      return {
        ...emptyContribution,
        operations: [
          validationNoteOperation({
            id: "github:github-release-dry-run",
            pipeId: "publish:github",
            description: "Record simulated GitHub release dry-run validation.",
            message:
              "GitHub release dry-run validation is simulated by the deterministic release plan; GitHub Releases API creation is not called during validation."
          }),
          Operation.make({
            id: "github:github-release-create",
            pipeId: "publish:github",
            phase: "publish",
            risk: "externally-visible",
            description: `Create GitHub release for ${state.identity.name}@${state.identity.version}.`,
            action: GitHubReleaseCreateAction.make({
              repository: section.repository,
              tokenEnv: section.tokenEnv,
              tag: state.identity.tag,
              title,
              notes: state.identity.notes,
              draft: section.draft,
              prerelease,
              assets: githubReleaseAssets(assets)
            })
          }),
          Operation.make({
            id: "github:github-release-verify-api",
            pipeId: "publish:github",
            phase: "verify",
            risk: "read-only",
            description: "Verify the GitHub release through the GitHub API.",
            action: GitHubReleaseVerifyAction.make({
              repository: section.repository,
              tokenEnv: section.tokenEnv,
              tag: state.identity.tag,
              title,
              draft: section.draft,
              prerelease,
              assetNames: assets.map((artifact) => githubReleaseAssetName(artifact.path))
            })
          })
        ]
      }
    })
}
