import * as Schema from "effect/Schema"
import { Artifact, ArtifactKind } from "./artifact.js"
import type { ArtifactArchitecture, ArtifactLibc, ArtifactOperatingSystem } from "./artifact.js"


export class ArtifactCatalog extends Schema.Class<ArtifactCatalog>("ArtifactCatalog")({
  artifacts: Schema.Array(Artifact)
}) {
  static readonly empty = ArtifactCatalog.make({ artifacts: [] })
}

export type ArtifactFilter = (artifact: Artifact) => boolean

export const byKind = (...kinds: ReadonlyArray<ArtifactKind>): ArtifactFilter =>
  (artifact) => kinds.includes(artifact.kind)

export const byOs = (...os: ReadonlyArray<ArtifactOperatingSystem>): ArtifactFilter =>
  (artifact) => artifact.platform !== undefined && os.includes(artifact.platform.os)

export const byArch = (...arch: ReadonlyArray<ArtifactArchitecture>): ArtifactFilter =>
  (artifact) => artifact.platform !== undefined && arch.includes(artifact.platform.arch)

export const byLibc = (...libc: ReadonlyArray<ArtifactLibc>): ArtifactFilter =>
  (artifact) => artifact.platform?.libc !== undefined && libc.includes(artifact.platform.libc)

export const byProducer = (...pipeIds: ReadonlyArray<string>): ArtifactFilter =>
  (artifact) => pipeIds.includes(artifact.producedBy)

export const byId = (...ids: ReadonlyArray<string>): ArtifactFilter =>
  (artifact) => ids.includes(artifact.id)

export const and = (...filters: ReadonlyArray<ArtifactFilter>): ArtifactFilter =>
  (artifact) => filters.every((filter) => filter(artifact))

export const or = (...filters: ReadonlyArray<ArtifactFilter>): ArtifactFilter =>
  (artifact) => filters.some((filter) => filter(artifact))

export const not = (filter: ArtifactFilter): ArtifactFilter =>
  (artifact) => !filter(artifact)

export const filterCatalog = (
  catalog: ArtifactCatalog,
  ...filters: ReadonlyArray<ArtifactFilter>
): ReadonlyArray<Artifact> =>
  catalog.artifacts.filter(and(...filters))

export const appendArtifacts = (
  catalog: ArtifactCatalog,
  artifacts: ReadonlyArray<Artifact>
): ArtifactCatalog =>
  ArtifactCatalog.make({ artifacts: [...catalog.artifacts, ...artifacts] })
