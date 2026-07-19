// Invariant: one selected file-like Windows artifact determines the entire deterministic Scoop manifest.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, CatalogFileExtra, SafeRelativePath } from "../grammar/artifact.js"
import { PlanError } from "../grammar/errors.js"
import { FilePartsContent, Operation, Sha256Hole, WriteFileAction } from "../grammar/operation.js"
import { featurePlanner } from "../grammar/pipe.js"
import type { ReleaseIdentity } from "../grammar/state.js"
import {
  catalogArtifactUrl,
  catalogPathBaseName,
  compactPackageShortName,
  type CatalogResolutionConfig,
  findCatalogArtifact,
  githubRepository,
  projectPackageName,
  rejectInvalidCatalogArtifact
} from "./catalog-shared.js"
import { defaulted } from "../grammar/defaulted.js"

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
  bucketDirectory: defaulted(SafeRelativePath, "."),
  tokenEnv: Schema.optionalKey(Schema.String)
}) {}

export const resolveScoop = (section: ReleaseConfigScoopPublish | undefined, config: CatalogResolutionConfig) => {
  if (section === undefined) return undefined
  const manifestName = section.manifestName ?? compactPackageShortName(projectPackageName(config.project) ?? "release")
  return {
    ...section,
    manifestName, manifestPath: section.manifestPath ?? `.release/generated/${manifestName}.json`,
    bucketDirectory: section.bucketDirectory,
    githubRepository: githubRepository(config)
  }
}
export type ScoopSection = NonNullable<ReturnType<typeof resolveScoop>>

const source = {
  pipeId: "catalog:scoop", field: "publish.scoop.artifactId", target: "Scoop", label: "Scoop manifest"
}

const manifestContent = Effect.fn("catalog.scoop.manifestContent")(function*(
  section: ScoopSection,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<Artifact>
) {
  const artifact = section.artifactId === undefined
    ? artifacts.find(({ kind, platform }) => kind === "executable" && platform?.os === "windows")
    : yield* findCatalogArtifact(source, artifacts, section.artifactId)
  if (artifact === undefined) return yield* Effect.fail(PlanError.make({
    pipeId: source.pipeId,
    field: source.field,
    reason: "Scoop publishing requires artifactId or a windows executable artifact."
  }))
  yield* rejectInvalidCatalogArtifact(source, artifact)
  const binaryName = artifact.platform?.binaryName
  const bin = section.bin ?? (binaryName === undefined
    ? undefined
    : [[catalogPathBaseName(artifact.path), binaryName]])
  const prefix = JSON.stringify({
    version: identity.version,
    description: section.description ?? `${identity.name} ${identity.version} release artifact`,
    homepage: section.homepage ?? `https://github.com/${section.repository}`,
    ...(section.license === undefined ? {} : { license: section.license }),
    url: catalogArtifactUrl(section, identity, artifact)
  }, null, 2).slice(0, -2)
  const suffix = bin === undefined ? "\"\n}\n" : `\",\n${JSON.stringify({ bin }, null, 2).slice(2, -2)}\n}\n`
  return FilePartsContent.make({
    parts: [`${prefix},\n  "hash": "`, Sha256Hole.make({ artifactId: artifact.id }), suffix]
  })
})

export const catalogScoopPlanner = featurePlanner<ScoopSection>("catalog:scoop", (section, state) => Effect.gen(function*() {
    const path = section.manifestPath
    const contents = yield* manifestContent(section, state.identity, state.artifacts)
    return {
      artifacts: [Artifact.make({
        id: "scoop-manifest",
        kind: "catalog-file",
        path,
        producedBy: "catalog:scoop",
        extra: CatalogFileExtra.make({ catalog: "scoop", repository: section.repository })
      })],
      operations: [Operation.make({
        id: "scoop:scoop-render-manifest",
        pipeId: "catalog:scoop",
        phase: "catalog",
        risk: "writes-local",
        description: `Render Scoop manifest ${catalogPathBaseName(path)}.`,
        action: WriteFileAction.make({ path, contents })
      })]
    }
  }))
