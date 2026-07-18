import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { Artifact } from "../pipeline/artifact.js"
import { artifactPathBaseName, WorkflowFileName } from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import type { ReleaseIdentity } from "../pipeline/state.js"

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

export const trustedPublishingAuthEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
]

export const TrustedPublishingProvider = Schema.Literals(["github-actions"])
export const trustedPublishingConfigFields = {
  provider: Schema.optionalKey(TrustedPublishingProvider),
  workflow: Schema.optionalKey(WorkflowFileName)
}

export interface TrustedPublishingSection {
  readonly provider: "github-actions"
  readonly workflow: string
}

export const compactTrustedPublishing = (
  config:
    | boolean
    | {
      readonly provider?: "github-actions" | undefined
      readonly workflow?: string | undefined
    }
    | undefined
): TrustedPublishingSection | undefined => {
  if (config === undefined || config === false) {
    return undefined
  }
  if (config === true) {
    return { provider: "github-actions", workflow: "release.yml" }
  }
  return {
    provider: config.provider ?? "github-actions",
    workflow: config.workflow ?? "release.yml"
  }
}

export const publishingAuthEnvNames = (
  trustedPublishing: TrustedPublishingSection | undefined,
  credentialEnvNames: ReadonlyArray<string | undefined>
): ReadonlyArray<string> =>
  trustedPublishing === undefined
    ? credentialEnvNames.filter((name): name is string => name !== undefined)
    : trustedPublishingAuthEnvNames
