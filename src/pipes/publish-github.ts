// Invariant: the GitHub planner receives one resolved release policy and emits only file-like assets.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { Artifact } from "../pipeline/artifact.js"
import { artifactPathBaseName } from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  GitHubReleaseAssetSpec,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  Operation
} from "../pipeline/operation.js"
import { featurePlanner } from "../pipeline/pipe.js"
import { hasSemverPrerelease } from "../pipeline/semver.js"
import { validationNoteOperation } from "./shared.js"

export class ReleaseConfigGitHubPublish extends Schema.Class<ReleaseConfigGitHubPublish>(
  "ReleaseConfigGitHubPublish"
)({
  repository: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String),
  draft: Schema.optionalKey(Schema.Boolean),
  prerelease: Schema.optionalKey(Schema.Union([Schema.Boolean, Schema.Literal("auto")]))
}) {}

export interface ResolvedGitHubPublish {
  readonly repository: string
  readonly tokenEnv?: string | undefined
  readonly draft: boolean
  readonly prerelease: boolean | "auto"
}

export const resolveGitHubPublish = (config: {
  readonly project: { readonly repository?: string }
  readonly publish: { readonly github?: boolean | ReleaseConfigGitHubPublish }
}): ResolvedGitHubPublish | undefined => {
  const publish = config.publish.github
  if (publish === undefined || publish === false) return undefined
  const section = publish === true ? undefined : publish
  return {
    repository: section?.repository ?? config.project.repository ?? "",
    tokenEnv: section?.tokenEnv,
    draft: section?.draft ?? true,
    prerelease: section?.prerelease ?? false
  }
}

const assetsForRelease = (artifacts: ReadonlyArray<Artifact>): ReadonlyArray<Artifact> =>
  artifacts.filter(({ kind }) => kind !== "package" && kind !== "wheel" && kind !== "catalog-file")

export const publishGitHubPlanner = featurePlanner<ResolvedGitHubPublish>("publish:github", (section, state) => Effect.gen(function*() {
    const repository = section.repository
    const artifacts = assetsForRelease(state.artifacts)
    if (artifacts.some(({ extra }) => extra?._tag === "file" && extra.format === "directory")) {
      return yield* Effect.fail(PlanError.make({
        pipeId: "publish:github",
        field: "publish.github.assets",
        reason: "GitHub release assets must be file-like, not directories."
      }))
    }
    const title = `${state.identity.name} ${state.identity.version}`
    const prerelease = section.prerelease === "auto"
      ? hasSemverPrerelease(state.identity.version)
      : section.prerelease
    const assets = artifacts.map((artifact) => GitHubReleaseAssetSpec.make({
      artifactId: artifact.id,
      path: artifact.path,
      name: artifactPathBaseName(artifact.path),
      contentType: "application/octet-stream"
    }))
    return {
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
            repository, tokenEnv: section.tokenEnv, tag: state.identity.tag, title,
            notes: state.identity.notes, draft: section.draft, prerelease, assets
          })
        }),
        Operation.make({
          id: "github:github-release-verify-api",
          pipeId: "publish:github",
          phase: "verify",
          risk: "read-only",
          description: "Verify the GitHub release through the GitHub API.",
          action: GitHubReleaseVerifyAction.make({
            repository, tokenEnv: section.tokenEnv, tag: state.identity.tag, title,
            draft: section.draft, prerelease, assetNames: assets.map(({ name }) => name)
          })
        })
      ]
    }
  }))
