import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  artifactPathBaseName,
  CatalogFileExtra,
  SafeRelativePath
} from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  Operation,
  ScoopManifestContent,
  WriteFileAction
} from "../pipeline/operation.js"
import { catalogPathBaseName } from "../pipeline/operation-helpers.js"
import { optionalField } from "../pipeline/optional-field.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"

export class ReleaseConfigScoopPublish extends Schema.Class<ReleaseConfigScoopPublish>(
  "ReleaseConfigScoopPublish"
)({
  repository: Schema.String,
  manifestName: Schema.optionalKey(Schema.String),
  manifestPath: Schema.optionalKey(SafeRelativePath),
  artifactId: Schema.optionalKey(Schema.String),
  homepage: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  license: Schema.optionalKey(Schema.String),
  url: Schema.optionalKey(Schema.String),
  bin: Schema.optionalKey(Schema.String),
  bucketDirectory: Schema.optionalKey(SafeRelativePath),
  tokenEnv: Schema.optionalKey(Schema.String)
}) {}

export interface ScoopSection {
  readonly repository: string
  readonly manifestName?: string | undefined
  readonly manifestPath?: string | undefined
  readonly artifactId?: string | undefined
  readonly homepage?: string | undefined
  readonly description?: string | undefined
  readonly license?: string | undefined
  readonly url?: string | undefined
  readonly bin?: string | undefined
  readonly bucketDirectory?: string | undefined
  readonly tokenEnv?: string | undefined
  readonly githubRepository?: string | undefined
}

const compactPackageShortName = (packageName: string): string => {
  const withoutScope = packageName.includes("/") ? packageName.split("/").at(-1) ?? packageName : packageName
  const normalized = withoutScope.replace(/^@/, "").replace(/[^A-Za-z0-9-]+/g, "-")
  return normalized.length === 0 ? "release" : normalized
}

const projectPackageName = (project: {
  readonly name?: string | undefined
  readonly package?: string | undefined
  readonly packageName?: string | undefined
}): string | undefined =>
  project.packageName ?? project.package ?? project.name

const githubRepository = (config: {
  readonly project: { readonly repository?: string | undefined }
  readonly publish: { readonly github?: boolean | { readonly repository?: string | undefined } | undefined }
}): string | undefined => {
  const github = config.publish.github
  if (github === undefined || github === false) {
    return undefined
  }
  return github === true ? config.project.repository : github.repository ?? config.project.repository
}

export const scoopSectionFromConfig = (config: {
  readonly project: {
    readonly name?: string | undefined
    readonly package?: string | undefined
    readonly packageName?: string | undefined
    readonly repository?: string | undefined
  }
  readonly publish: {
    readonly github?: boolean | { readonly repository?: string | undefined } | undefined
    readonly scoop?: ReleaseConfigScoopPublish | undefined
  }
}): ScoopSection | undefined => {
  const publish = config.publish.scoop
  if (publish === undefined) {
    return undefined
  }
  const manifestName = publish.manifestName ?? compactPackageShortName(projectPackageName(config.project) ?? "release")
  const repository = githubRepository(config)
  return {
    repository: publish.repository,
    manifestName,
    manifestPath: publish.manifestPath ?? `.release/generated/${manifestName}.json`,
    ...optionalField(publish.artifactId, (artifactId) => ({ artifactId })),
    ...optionalField(publish.homepage, (homepage) => ({ homepage })),
    ...optionalField(publish.description, (description) => ({ description })),
    ...optionalField(publish.license, (license) => ({ license })),
    ...optionalField(publish.url, (url) => ({ url })),
    ...optionalField(publish.bin, (bin) => ({ bin })),
    ...optionalField(publish.bucketDirectory, (bucketDirectory) => ({ bucketDirectory })),
    ...optionalField(publish.tokenEnv, (tokenEnv) => ({ tokenEnv })),
    ...optionalField(repository, (githubRepository) => ({ githubRepository }))
  }
}

export const defaultScoopSection = (
  section: ScoopSection,
  identity: ReleaseIdentity
): ScoopSection => {
  const manifestName = section.manifestName ?? compactPackageShortName(identity.normalizedName)
  return {
    ...section,
    manifestName,
    manifestPath: section.manifestPath ?? `.release/generated/${manifestName}.json`
  }
}

const findArtifact = (
  artifactId: string,
  artifacts: ReadonlyArray<Artifact>
): Effect.Effect<Artifact, PlanError> => {
  const artifact = artifacts.find((candidate) => candidate.id === artifactId)
  if (artifact !== undefined) {
    return Effect.succeed(artifact)
  }
  return Effect.fail(PlanError.make({
    pipeId: "catalog:scoop",
    field: "publish.scoop.artifactId",
    reason: `Scoop target references missing artifact ${artifactId}.`
  }))
}

const selectArtifact = Effect.fn("catalog.scoop.selectArtifact")(function*(
  section: ScoopSection,
  artifacts: ReadonlyArray<Artifact>
) {
  if (section.artifactId !== undefined) {
    return yield* findArtifact(section.artifactId, artifacts)
  }
  const artifact = artifacts.find((candidate) =>
    candidate.kind === "executable" && candidate.platform?.os === "windows"
  )
  if (artifact !== undefined) {
    return artifact
  }
  return yield* Effect.fail(PlanError.make({
    pipeId: "catalog:scoop",
    field: "publish.scoop.artifactId",
    reason: "Scoop publishing requires artifactId or a windows executable artifact."
  }))
})

const artifactUrl = (
  section: ScoopSection,
  identity: ReleaseIdentity,
  artifact: Artifact
): string =>
  section.url ??
    (section.githubRepository === undefined
      ? artifact.path
      : `https://github.com/${section.githubRepository}/releases/download/${identity.tag}/${artifactPathBaseName(artifact.path)}`)

const rejectInvalidScoopArtifact = (artifact: Artifact): Effect.Effect<void, PlanError> => {
  if (artifact.kind === "package" || (artifact.extra?._tag === "file" && artifact.extra.format === "directory")) {
    return Effect.fail(PlanError.make({
      pipeId: "catalog:scoop",
      field: "publish.scoop.artifactId",
      reason: "Scoop manifest artifacts must be file-like, not directories."
    }))
  }
  if (artifact.checksum !== undefined && artifact.checksum.algorithm !== "sha256") {
    return Effect.fail(PlanError.make({
      pipeId: "catalog:scoop",
      field: `artifacts.${artifact.id}.checksum`,
      reason: "Scoop manifest artifacts require sha256 checksums."
    }))
  }
  return Effect.void
}

const artifactBin = (
  section: ScoopSection,
  artifact: Artifact
): string | ReadonlyArray<ReadonlyArray<string>> | undefined => {
  if (section.bin !== undefined) {
    return section.bin
  }
  const binaryName = artifact.platform?.binaryName
  return binaryName === undefined
    ? undefined
    : [[catalogPathBaseName(artifact.path), binaryName]]
}

const manifestContent = Effect.fn("catalog.scoop.manifestContent")(function*(
  section: ScoopSection,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<Artifact>
) {
  const artifact = yield* selectArtifact(section, artifacts)
  yield* rejectInvalidScoopArtifact(artifact)
  const bin = artifactBin(section, artifact)
  return ScoopManifestContent.make({
    version: identity.version,
    description: section.description ?? `${identity.name} ${identity.version} release artifact`,
    homepage: section.homepage ?? `https://github.com/${section.repository}`,
    ...optionalField(section.license, (license) => ({ license })),
    url: artifactUrl(section, identity, artifact),
    ...optionalField(bin, (binValue) => ({ bin: binValue })),
    artifactId: artifact.id
  })
})

export const catalogScoopPipe: Pipe<ScoopSection> = {
  id: "catalog:scoop",
  phase: "catalog",
  section: scoopSectionFromConfig,
  defaults: defaultScoopSection,
  plan: (section, state) =>
    Effect.gen(function*() {
      const manifestPath = section.manifestPath ?? `.release/generated/${section.manifestName ?? "release"}.json`
      const content = yield* manifestContent(section, state.identity, state.artifacts.artifacts)
      return {
        ...emptyContribution,
        artifacts: [
          Artifact.make({
            id: "scoop-manifest",
            kind: "catalog-file",
            path: manifestPath,
            producedBy: "catalog:scoop",
            extra: CatalogFileExtra.make({
              catalog: "scoop",
              repository: section.repository
            })
          })
        ],
        operations: [
          Operation.make({
            id: "scoop:scoop-render-manifest",
            pipeId: "catalog:scoop",
            phase: "catalog",
            risk: "writes-local",
            description: `Render Scoop manifest ${catalogPathBaseName(manifestPath)}.`,
            action: WriteFileAction.make({
              path: manifestPath,
              contents: content
            })
          })
        ]
      }
    })
}
