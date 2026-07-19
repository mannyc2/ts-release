// Invariant: deferred file content is literal parts plus typed holes the executor resolves against measured artifacts.
import * as Schema from "effect/Schema"
import { ArtifactId } from "./artifact.js"

export class Sha256Hole extends Schema.Class<Sha256Hole>("Sha256Hole")({
  artifactId: ArtifactId
}) {}

export class FilePartsContent extends Schema.TaggedClass<FilePartsContent>()("file-parts", {
  parts: Schema.Array(Schema.Union([Schema.String, Sha256Hole]))
}) {}

export const DeferredFileContent = Schema.Union([FilePartsContent])
export type DeferredFileContent = typeof DeferredFileContent.Type
