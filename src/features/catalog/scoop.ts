// Invariant: one selected file-like Windows artifact determines the entire deterministic Scoop manifest.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, SafeRelativePath } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { FilePartsContent, Sha256Hole } from "../../grammar/content.js"
import type { ReleaseIdentity } from "../../grammar/state.js"
import type { CatalogEntry } from "./file.js"
import {
  catalogArtifactUrl,
  catalogPathBaseName,
  compactPackageShortName,
  type CatalogResolutionConfig,
  findCatalogArtifact,
  githubRepository,
  projectPackageName,
  rejectInvalidCatalogArtifact
} from "./shared.js"
import { defaulted } from "../../grammar/defaulted.js"

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
  submit: Schema.optionalKey(Schema.Literals(["push", "pull-request"])),
  validate: Schema.optionalKey(Schema.Union([Schema.String, Schema.Array(Schema.String)]))
}) {}

export const resolveScoop = (
  section: ReleaseConfigScoopPublish | undefined,
  config: CatalogResolutionConfig
): CatalogEntry | undefined => {
  if (section === undefined) return undefined
  const manifestName = section.manifestName ?? compactPackageShortName(projectPackageName(config.project) ?? "release")
  const repository = githubRepository(config)
  const resolved = {
    ...section,
    manifestName,
    manifestPath: section.manifestPath ?? `.release/generated/${manifestName}.json`,
    bucketDirectory: section.bucketDirectory,
    ...(repository === undefined ? {} : { githubRepository: repository })
  } satisfies ScoopSection
  return {
    id: "scoop",
    repository: section.repository,
    file: resolved.manifestPath,
    ...(resolved.bucketDirectory === "." ? {} : { directory: resolved.bucketDirectory }),
    content: (context) => manifestContent(resolved, context.identity, context.artifacts),
    commitMessage: `Update ${manifestName} to {version}`,
    submit: section.submit ?? "push",
    ...(section.validate === undefined ? {} : { validate: section.validate }),
    ...(resolved.githubRepository === undefined ? {} : { githubRepository: resolved.githubRepository })
  }
}
type ScoopSection = ReleaseConfigScoopPublish & {
  readonly manifestName: string
  readonly manifestPath: string
  readonly githubRepository?: string | undefined
}

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
