import * as Schema from "effect/Schema"
import { Artifact } from "./artifact.js"


export class ArtifactCatalog extends Schema.Class<ArtifactCatalog>("ArtifactCatalog")({
  artifacts: Schema.Array(Artifact)
}) {
  static readonly empty = ArtifactCatalog.make({ artifacts: [] })
}

export const appendArtifacts = (
  catalog: ArtifactCatalog,
  artifacts: ReadonlyArray<Artifact>
): ArtifactCatalog =>
  ArtifactCatalog.make({ artifacts: [...catalog.artifacts, ...artifacts] })
