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
  FilePartsContent,
  Operation,
  Sha256Hole,
  WriteFileAction
} from "../pipeline/operation.js"
import { catalogPathBaseName } from "../pipeline/operation-helpers.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import { validateSafeRelativePathEffect } from "../pipeline/template.js"

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

export interface ResolvedScoop {
  readonly repository: string
  readonly manifestName: string
  readonly manifestPath: string
  readonly artifactId?: string | undefined
  readonly homepage?: string | undefined
  readonly description?: string | undefined
  readonly license?: string | undefined
  readonly url?: string | undefined
  readonly bin?: string | undefined
  readonly bucketDirectory: string
  readonly tokenEnv?: string | undefined
  readonly githubRepository?: string | undefined
}

export const resolveScoop = (config: {
  readonly project: {
    readonly name?: string | undefined
    readonly packageName?: string | undefined
    readonly repository?: string | undefined
  }
  readonly publish: {
    readonly github?: boolean | { readonly repository?: string | undefined } | undefined
    readonly scoop?: ReleaseConfigScoopPublish | undefined
  }
}): ResolvedScoop | undefined => {
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
    bucketDirectory: publish.bucketDirectory ?? ".",
    tokenEnv: publish.tokenEnv,
    githubRepository: repository
  }
}

const errorSource = {
  pipeId: "catalog:scoop",
  field: "publish.scoop.artifactId",
  target: "Scoop",
  label: "Scoop manifest"
}

const selectArtifact = Effect.fn("catalog.scoop.selectArtifact")(function*(
  section: ResolvedScoop,
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
  section: ResolvedScoop,
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
  section: ResolvedScoop,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<Artifact>
) {
  const artifact = yield* selectArtifact(section, artifacts)
  yield* rejectInvalidCatalogArtifact(errorSource, artifact)
  const bin = artifactBin(section, artifact)
  const prefix = JSON.stringify({
    version: identity.version,
    description: section.description ?? `${identity.name} ${identity.version} release artifact`,
    homepage: section.homepage ?? `https://github.com/${section.repository}`,
    ...(section.license === undefined ? {} : { license: section.license }),
    url: catalogArtifactUrl(section, identity, artifact)
  }, null, 2).slice(0, -2)
  const suffix = bin === undefined
    ? "\"\n}\n"
    : `\",\n${JSON.stringify({ bin }, null, 2).slice(2, -2)}\n}\n`
  return FilePartsContent.make({
    parts: [
      `${prefix},\n  "hash": "`,
      Sha256Hole.make({ artifactId: artifact.id }),
      suffix
    ]
  })
})

export const catalogScoopPlanner: FeaturePlanner<ResolvedScoop> = {
  id: "catalog:scoop",
  plan: (section, state) =>
    Effect.gen(function*() {
      const manifestPath = yield* validateSafeRelativePathEffect(section.manifestPath, {
        pipeId: "catalog:scoop",
        field: "publish.scoop.manifestPath"
      })
      const content = yield* manifestContent(section, state.identity, state.artifacts)
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
