import * as Schema from "effect/Schema"
import { Sha256Digest } from "../model/digest.js"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath } from "../model/primitives.js"
import { ArtifactCollectionId } from "../model/artifact-collection.js"
import type { VerifiedReleaseContext } from "./context.js"
import type { GraphPreparation, GraphPublication, ReleaseGraph } from "./graph.js"
import type { PreparedBundle } from "./prepared-store.js"

const optional = Schema.optionalKey

export class ReleaseInspection extends Schema.Class<ReleaseInspection>("ReleaseInspection")({
  source: Schema.Struct({ commit: NonEmptyName, tree: NonEmptyName, clean: Schema.Literal(true), repository: optional(Schema.NonEmptyString) }),
  package: Schema.Struct({ name: NonEmptyName, version: Schema.NonEmptyString, path: SafeRelativePath }),
  artifacts: Schema.Array(Schema.Struct({ id: OutputId, path: SafeRelativePath, kind: Schema.String })),
  collections: Schema.Array(Schema.Struct({ id: ArtifactCollectionId, producer: OperationId, root: SafeRelativePath })),
  preparations: Schema.Array(Schema.Struct({ id: OperationId, kind: Schema.String, inputs: Schema.Array(OutputId) })),
  publications: Schema.Array(Schema.Struct({ id: OperationId, destination: Schema.String, subject: Schema.NonEmptyString })),
  requirements: Schema.Array(Schema.NonEmptyString),
  capabilities: Schema.Array(Schema.NonEmptyString)
}) {}

const preparationKind = (value: GraphPreparation): string => value._tag.replace(/^Graph/u, "")
const requirements = (preparations: ReadonlyArray<GraphPreparation>): ReadonlyArray<string> => [
  ...new Set(preparations.flatMap((preparation) => preparation._tag === "GraphCommandCheck" || preparation._tag === "GraphCommandArtifact" || preparation._tag === "GraphCommandCollection" || preparation._tag === "GraphNpmPackageBuild"
    ? [`command:${preparation.argv[0]!}`] : []))
].sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
const publication = (value: GraphPublication) => value._tag === "GraphNpmPublication" || value._tag === "GraphPrepackedNpmPublication"
  ? { id: value.id, destination: "npm", subject: `${value.packageName}@${value.version} (${value.registryUrl})` }
  : value._tag === "GraphPyPiPublication"
  ? { id: value.id, destination: "pypi", subject: `${value.project}==${value.version} (${value.repository})` }
  : value._tag === "GraphGitHubPublication"
  ? { id: value.id, destination: "github", subject: `${value.repository}#${value.tag}` }
  : { id: value.id, destination: "catalog-git", subject: `${value.repository}#${value.branch}:${value.targetPath}` }

/** Pure user projection. It does not encode, persist, approve, or execute the graph. */
export const inspectRelease = (
  context: VerifiedReleaseContext, graph: ReleaseGraph, capabilities: ReadonlyArray<string> = []
): ReleaseInspection => ReleaseInspection.make({
  source: {
    commit: context.source.commit, tree: context.source.tree, clean: true,
    ...(context.source.repository === undefined ? {} : { repository: context.source.repository })
  },
  package: { name: context.package.name, version: context.package.version, path: context.package.path },
  artifacts: graph.artifacts.map(({ id, path, kind }) => ({ id, path, kind })),
  collections: graph.collections.map(({ id, producer, root }) => ({ id, producer, root })),
  preparations: graph.preparations.map((preparation) => ({ id: preparation.id, kind: preparationKind(preparation), inputs: preparation.inputs })),
  publications: graph.publications.map(publication), requirements: requirements(graph.preparations),
  capabilities: [...capabilities].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map((value) => NonEmptyName.make(value))
})

export class PreparedReleaseInspection extends Schema.Class<PreparedReleaseInspection>("PreparedReleaseInspection")({
  bundleDirectory: Schema.String,
  source: Schema.Struct({ commit: NonEmptyName, tree: NonEmptyName, clean: Schema.Literal(true), packageManifestPath: SafeRelativePath, packageManifestDigest: Sha256Digest }),
  project: Schema.Struct({ name: NonEmptyName, packageName: Schema.optionalKey(NonEmptyName), version: Schema.NonEmptyString, tag: NonEmptyName, repository: Schema.optionalKey(Schema.NonEmptyString) }),
  artifacts: Schema.Array(Schema.Struct({ id: OutputId, path: SafeRelativePath, kind: Schema.String, size: Schema.Number, digest: Sha256Digest, mediaType: Schema.optionalKey(Schema.NonEmptyString) })),
  collections: Schema.Array(Schema.Struct({
    id: ArtifactCollectionId,
    producer: OperationId,
    root: SafeRelativePath,
    members: Schema.Array(Schema.Struct({ key: SafeRelativePath, artifactId: OutputId }))
  })),
  publications: Schema.Array(Schema.Struct({ id: NonEmptyName, destination: Schema.Literals(["npm", "pypi", "github", "catalog-git"]), subject: Schema.NonEmptyString })),
}) {}

export const inspectPreparedRelease = (bundle: PreparedBundle): PreparedReleaseInspection => PreparedReleaseInspection.make({
  bundleDirectory: bundle.directory,
  source: bundle.manifest.source,
  project: bundle.manifest.project,
  artifacts: bundle.manifest.artifacts,
  collections: bundle.manifest.collections.map(({ contract, members }) => ({
    id: contract.id,
    producer: contract.producer,
    root: contract.root,
    members
  })),
  publications: bundle.manifest.publications.map((publication) => publication._tag === "PreparedNpmPublication"
    ? { id: publication.id, destination: "npm", subject: `${publication.packageName}@${publication.version} (${publication.registryUrl})` }
    : publication._tag === "PreparedPyPiPublication"
    ? { id: publication.id, destination: "pypi", subject: `${publication.project}==${publication.version} (${publication.repository})` }
    : publication._tag === "PreparedGitHubPublication"
    ? { id: publication.id, destination: "github", subject: `${publication.repository}#${publication.tag}` }
    : { id: publication.id, destination: "catalog-git", subject: `${publication.repository}#${publication.branch}:${publication.targetPath}` })
})
