import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  CatalogFileExtra,
  SafeRelativePath
} from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  catalogArtifactUrl,
  compactPackageShortName,
  findCatalogArtifact,
  githubRepository,
  projectPackageName,
  rejectInvalidCatalogArtifact
} from "./shared.js"
import {
  Operation,
  ScoopManifestContent,
  WriteFileAction
} from "../pipeline/operation.js"
import { catalogPathBaseName } from "../pipeline/operation-helpers.js"
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
    artifactId: publish.artifactId,
    homepage: publish.homepage,
    description: publish.description,
    license: publish.license,
    url: publish.url,
    bin: publish.bin,
    bucketDirectory: publish.bucketDirectory,
    tokenEnv: publish.tokenEnv,
    githubRepository: repository
  }
}

// Totalized section: after defaults, manifestName/manifestPath are facts.
export interface NormalizedScoopSection extends ScoopSection {
  readonly manifestName: string
  readonly manifestPath: string
}

export const defaultScoopSection = (
  section: ScoopSection,
  identity: ReleaseIdentity
): NormalizedScoopSection => {
  const manifestName = section.manifestName ?? compactPackageShortName(identity.normalizedName)
  return {
    ...section,
    manifestName,
    manifestPath: section.manifestPath ?? `.release/generated/${manifestName}.json`
  }
}

const errorSource = {
  pipeId: "catalog:scoop",
  field: "publish.scoop.artifactId",
  target: "Scoop",
  label: "Scoop manifest"
}

const selectArtifact = Effect.fn("catalog.scoop.selectArtifact")(function*(
  section: ScoopSection,
  artifacts: ReadonlyArray<Artifact>
) {
  if (section.artifactId !== undefined) {
    return yield* findCatalogArtifact(errorSource, artifacts, section.artifactId)
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
  yield* rejectInvalidCatalogArtifact(errorSource, artifact)
  const bin = artifactBin(section, artifact)
  return ScoopManifestContent.make({
    version: identity.version,
    description: section.description ?? `${identity.name} ${identity.version} release artifact`,
    homepage: section.homepage ?? `https://github.com/${section.repository}`,
    license: section.license,
    url: catalogArtifactUrl(section, identity, artifact),
    bin,
    artifactId: artifact.id
  })
})

export const catalogScoopPipe: Pipe<ScoopSection> = {
  id: "catalog:scoop",
  phase: "catalog",
  section: scoopSectionFromConfig,
  plan: (rawSection, state) =>
    Effect.gen(function*() {
      const section = defaultScoopSection(rawSection, state.identity)
      const manifestPath = section.manifestPath
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
