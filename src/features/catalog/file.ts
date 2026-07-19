// Invariant: each generic catalog entry produces one deterministic file and its declared validation/publish operations.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, artifactPathBaseName, CatalogFileExtra, SafeRelativePath } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { Operation, WriteFileAction } from "../../grammar/operation.js"
import { FilePartsContent, Sha256Hole } from "../../grammar/content.js"
import { featurePlanner, type PlannerContext } from "../../grammar/planner.js"
import { renderTemplate } from "../../grammar/template.js"
import { defaulted } from "../../grammar/defaulted.js"
export class ReleaseConfigCatalogFactHole extends Schema.Class<ReleaseConfigCatalogFactHole>("ReleaseConfigCatalogFactHole")({
  fact: Schema.Literals(["sha256", "downloadUrl", "assetName"]), artifact: Schema.NonEmptyString
}) {}
export class ReleaseConfigCatalogEntry extends Schema.Class<ReleaseConfigCatalogEntry>("ReleaseConfigCatalogEntry")({
  id: Schema.NonEmptyString, repository: Schema.String,
  file: SafeRelativePath, directory: Schema.optionalKey(SafeRelativePath),
  content: Schema.Union([Schema.String, Schema.Array(Schema.Union([Schema.String, ReleaseConfigCatalogFactHole]))]),
  commitMessage: defaulted(Schema.String, "Update {name} to {version}"),
  submit: defaulted(Schema.Literals(["push", "pull-request"]), "push"),
  validate: Schema.optionalKey(Schema.Union([Schema.String, Schema.Array(Schema.String)]))
}) {}
export type CatalogEntry = ReleaseConfigCatalogEntry & { readonly githubRepository?: string | undefined }
export const catalogWritePath = (entry: Pick<CatalogEntry, "directory" | "file">): string => entry.directory === undefined ? entry.file : `${entry.directory}/${entry.file}`
type RenderedPart = string | Sha256Hole
const appendText = (parts: Array<RenderedPart>, text: string): void => {
  const previous = parts[parts.length - 1]
  if (typeof previous === "string") parts[parts.length - 1] = previous + text
  else parts.push(text)
}
const contentError = (entry: CatalogEntry, reason: string) => PlanError.make({ pipeId: "catalog:file",
  field: `catalogs.${entry.id}.content`, reason })
const planContent = Effect.fn("catalog.file.planContent")(function*(entry: CatalogEntry,
  context: PlannerContext) {
  const parts: Array<RenderedPart> = []
  for (const part of typeof entry.content === "string" ? [entry.content] : entry.content) {
    if (typeof part === "string") { appendText(parts, renderTemplate(part, { identity: context.identity })); continue }
    const artifact = context.artifacts.find(({ id }) => id === part.artifact)
    if (artifact === undefined) return yield* Effect.fail(contentError(entry,
      `Catalog entry ${entry.id} references missing artifact ${part.artifact}.`))
    if (part.fact === "assetName") appendText(parts, artifactPathBaseName(artifact.path))
    else if (part.fact === "sha256") parts.push(Sha256Hole.make({ artifactId: artifact.id }))
    else {
      const repository = entry.githubRepository
      if (repository === undefined || repository.trim().length === 0) return yield* Effect.fail(contentError(entry,
        `Catalog entry ${entry.id} downloadUrl requires publish.github.repository or project.repository.`))
      appendText(parts, `https://github.com/${repository}/releases/download/${context.identity.tag}/${artifactPathBaseName(artifact.path)}`)
    }
  }
  return parts.some((part) => typeof part !== "string") ? FilePartsContent.make({ parts }) : parts.join("")
})
export const catalogGenericPlanner = featurePlanner<ReadonlyArray<CatalogEntry>>(
  "catalog:file", (entries, context) => Effect.gen(function*() {
    const duplicate = entries.find((entry, index) => entries.findIndex(({ id }) => id === entry.id) !== index)
    if (duplicate !== undefined) return yield* Effect.fail(PlanError.make({
      pipeId: "catalog:file", field: "catalogs[].id", reason: `Duplicate catalog id: ${duplicate.id}`
    }))
    const artifacts: Array<Artifact> = [], operations: Array<Operation> = []
    for (const entry of entries) {
      const path = catalogWritePath(entry)
      const contents = yield* planContent(entry, context)
      artifacts.push(Artifact.make({ id: `catalog-file-${entry.id}`, kind: "catalog-file", path,
        producedBy: "catalog:file", extra: CatalogFileExtra.make({ catalog: entry.id, repository: entry.repository }) }))
      operations.push(Operation.make({ id: `catalog:${entry.id}:render`, pipeId: "catalog:file", phase: "catalog",
        risk: "writes-local", description: `Render ${entry.id} catalog file ${path}.`,
        action: WriteFileAction.make({ path, contents }) }))
    }
    return { artifacts, operations }
  }))
