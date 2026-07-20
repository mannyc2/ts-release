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
  githubRepository,
  projectHomepage,
  projectPackageName,
  rejectInvalidCatalogArtifact,
  requireProjectFact,
} from "./shared.js"
import { selectByIdsOrDefault } from "../shared.js"
import { defaulted } from "../../grammar/defaulted.js"

export class ReleaseConfigScoopPublish extends Schema.Class<ReleaseConfigScoopPublish>(
  "ReleaseConfigScoopPublish"
)({
  repository: Schema.String,
  manifestName: Schema.optionalKey(Schema.String),
  manifestPath: Schema.optionalKey(SafeRelativePath),
  ids: Schema.optionalKey(Schema.NonEmptyArray(Schema.NonEmptyString)),
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
    description: config.project.description,
    homepage: projectHomepage(config),
    license: config.project.license,
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
  readonly description?: string | undefined
  readonly homepage?: string | undefined
  readonly license?: string | undefined
  readonly githubRepository?: string | undefined
}

const source = {
  pipeId: "catalog:scoop", field: "publish.scoop.ids", target: "Scoop", label: "Scoop manifest"
}

const manifestContent = Effect.fn("catalog.scoop.manifestContent")(function*(
  section: ScoopSection,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<Artifact>
) {
  const selected = yield* selectByIdsOrDefault(section.ids, artifacts,
    ({ kind, platform }) => kind === "executable" && platform?.os === "windows", { source, limit: 1 })
  if (selected.length > 1) return yield* Effect.fail(PlanError.make({
    pipeId: source.pipeId,
    field: source.field,
    reason: "Scoop manifests reference exactly one artifact."
  }))
  const artifact = selected[0]
  if (artifact === undefined) return yield* Effect.fail(PlanError.make({
    pipeId: source.pipeId,
    field: source.field,
    reason: "Scoop publishing requires ids or a windows executable artifact."
  }))
  yield* rejectInvalidCatalogArtifact(source, artifact)
  const description = yield* requireProjectFact(source, "project.description", section.description)
  const homepage = yield* requireProjectFact(source, "project.homepage", section.homepage)
  const binaryName = artifact.platform?.binaryName
  const bin = section.bin ?? (binaryName === undefined
    ? undefined
    : [[catalogPathBaseName(artifact.path), binaryName]])
  const prefix = JSON.stringify({
    version: identity.version,
    description,
    homepage,
    ...(section.license === undefined ? {} : { license: section.license }),
    url: catalogArtifactUrl(section, identity, artifact)
  }, null, 2).slice(0, -2)
  const suffix = bin === undefined ? "\"\n}\n" : `\",\n${JSON.stringify({ bin }, null, 2).slice(2, -2)}\n}\n`
  return FilePartsContent.make({
    parts: [`${prefix},\n  "hash": "`, Sha256Hole.make({ artifactId: artifact.id }), suffix]
  })
})
