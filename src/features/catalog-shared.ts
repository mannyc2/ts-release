// Invariant: catalog identity, artifact lookup, validation, and URL derivation have one shared owner.
import * as Effect from "effect/Effect"
import type { Artifact } from "../grammar/artifact.js"
import { artifactPathBaseName } from "../grammar/artifact.js"
import { PlanError } from "../grammar/errors.js"
import type { ReleaseIdentity } from "../grammar/state.js"
export const catalogPathBaseName = artifactPathBaseName

export const compactPackageShortName = (packageName: string): string => {
  const withoutScope = packageName.includes("/") ? packageName.split("/").at(-1) ?? packageName : packageName
  const normalized = withoutScope.replace(/^@/, "").replace(/[^A-Za-z0-9-]+/g, "-")
  return normalized.length === 0 ? "release" : normalized
}

export const projectPackageName = (project: {
  readonly name?: string | undefined
  readonly packageName?: string | undefined
}): string | undefined =>
  project.packageName ?? project.name

export const githubRepository = (config: {
  readonly project: { readonly repository?: string | undefined }
  readonly publish: { readonly github?: boolean | { readonly repository?: string | undefined } | undefined }
}): string | undefined => {
  const github = config.publish.github
  if (github === undefined || github === false) {
    return undefined
  }
  return github === true ? config.project.repository : github.repository ?? config.project.repository
}

export const catalogArtifactUrl = (
  section: {
    readonly url?: string | undefined
    readonly githubRepository?: string | undefined
  },
  identity: ReleaseIdentity,
  artifact: Artifact
): string =>
  section.url ??
    (section.githubRepository === undefined
      ? artifact.path
      : `https://github.com/${section.githubRepository}/releases/download/${identity.tag}/${artifactPathBaseName(artifact.path)}`)

export const findCatalogArtifact = (
  source: { readonly pipeId: string; readonly field: string; readonly target: string },
  artifacts: ReadonlyArray<Artifact>,
  artifactId: string
): Effect.Effect<Artifact, PlanError> => {
  const artifact = artifacts.find((candidate) => candidate.id === artifactId)
  if (artifact !== undefined) {
    return Effect.succeed(artifact)
  }
  return Effect.fail(PlanError.make({
    pipeId: source.pipeId,
    field: source.field,
    reason: `${source.target} target references missing artifact ${artifactId}.`
  }))
}

export const rejectInvalidCatalogArtifact = (
  source: { readonly pipeId: string; readonly field: string; readonly label: string },
  artifact: Artifact
): Effect.Effect<void, PlanError> => {
  if (artifact.kind === "package" || (artifact.extra?._tag === "file" && artifact.extra.format === "directory")) {
    return Effect.fail(PlanError.make({
      pipeId: source.pipeId,
      field: source.field,
      reason: `${source.label} artifacts must be file-like, not directories.`
    }))
  }
  if (artifact.checksum !== undefined && artifact.checksum.algorithm !== "sha256") {
    return Effect.fail(PlanError.make({
      pipeId: source.pipeId,
      field: `artifacts.${artifact.id}.checksum`,
      reason: `${source.label} artifacts require sha256 checksums.`
    }))
  }
  return Effect.void
}
