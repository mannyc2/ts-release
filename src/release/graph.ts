import * as Schema from "effect/Schema"
import { OutputDeclaration, type ContentValue } from "../model/operation.js"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath } from "../model/primitives.js"

const optional = Schema.optionalKey
const argv = Schema.NonEmptyArray(Schema.String)

export class GraphCommandCheck extends Schema.TaggedClass<GraphCommandCheck>()("GraphCommandCheck", {
  id: OperationId, argv, cwd: SafeRelativePath, environmentNames: Schema.Array(Schema.NonEmptyString),
  inputs: Schema.Array(OutputId), sourceCommit: NonEmptyName
}) {}

export class GraphCommandArtifact extends Schema.TaggedClass<GraphCommandArtifact>()("GraphCommandArtifact", {
  id: OperationId, argv, cwd: SafeRelativePath, environmentNames: Schema.Array(Schema.NonEmptyString),
  inputs: Schema.Array(OutputId), outputs: Schema.NonEmptyArray(OutputDeclaration), sourceCommit: NonEmptyName
}) {}

export class GraphArchive extends Schema.TaggedClass<GraphArchive>()("GraphArchive", {
  id: OperationId, inputs: Schema.Array(OutputId), output: OutputDeclaration,
  format: Schema.Literals(["tar.gz", "zip"]), files: optional(Schema.NonEmptyArray(Schema.String))
}) {}

export class GraphChecksum extends Schema.TaggedClass<GraphChecksum>()("GraphChecksum", {
  id: OperationId, inputs: Schema.NonEmptyArray(OutputId), output: OutputDeclaration,
  algorithm: Schema.Literals(["sha256", "sha512"])
}) {}

export class GraphCatalog extends Schema.TaggedClass<GraphCatalog>()("GraphCatalog", {
  id: OperationId, inputs: Schema.Array(OutputId), output: OutputDeclaration, content: Schema.Union([
    Schema.String, Schema.Array(Schema.Union([Schema.String, Schema.Struct({
      fact: Schema.Literals(["sha256", "downloadUrl", "assetName"]), outputId: OutputId
    })]))
  ])
}) {}

export const GraphPreparation = Schema.Union([
  GraphCommandCheck, GraphCommandArtifact, GraphArchive, GraphChecksum, GraphCatalog
])
export type GraphPreparation = typeof GraphPreparation.Type

export class GraphNpmPublication extends Schema.TaggedClass<GraphNpmPublication>()("GraphNpmPublication", {
  id: OperationId, packageName: NonEmptyName, version: NonEmptyName, registryUrl: Schema.NonEmptyString,
  artifactIds: Schema.Array(OutputId)
}) {}

export class GraphGitHubPublication extends Schema.TaggedClass<GraphGitHubPublication>()("GraphGitHubPublication", {
  id: OperationId, repository: Schema.NonEmptyString, tag: NonEmptyName, title: NonEmptyName,
  body: optional(Schema.String), bodyArtifact: optional(OutputId), assetIds: Schema.Array(OutputId)
}) {}

export const GraphPublication = Schema.Union([GraphNpmPublication, GraphGitHubPublication])
export type GraphPublication = typeof GraphPublication.Type

export class CapabilityContribution extends Schema.Class<CapabilityContribution>("CapabilityContribution")({
  artifacts: Schema.Array(OutputDeclaration), preparations: Schema.Array(GraphPreparation),
  publications: Schema.Array(GraphPublication)
}) {}

export class ReleaseGraph extends Schema.Class<ReleaseGraph>("ReleaseGraph")({
  artifacts: Schema.Array(OutputDeclaration), preparations: Schema.Array(GraphPreparation),
  publications: Schema.Array(GraphPublication)
}) {}

export class GraphLinkError
  extends Schema.TaggedErrorClass<GraphLinkError>()("GraphLinkError", {
    kind: Schema.Literals(["duplicate", "missing", "cycle", "path", "reference"]),
    value: Schema.String, reason: Schema.String
  }) {}

// `localeCompare` is environment-dependent. Graph order is an internal
// identity, so it uses the repository's plain code-point order instead.
const byId = (left: { readonly id: { toString(): string } }, right: { readonly id: { toString(): string } }) => {
  const a = left.id.toString()
  const b = right.id.toString()
  return a < b ? -1 : a > b ? 1 : 0
}

const preparationInputs = (preparation: GraphPreparation): ReadonlyArray<OutputId> => preparation.inputs
const preparationOutputs = (preparation: GraphPreparation): ReadonlyArray<OutputDeclaration> =>
  preparation._tag === "GraphCommandArtifact" ? preparation.outputs
    : preparation._tag === "GraphArchive" || preparation._tag === "GraphChecksum" || preparation._tag === "GraphCatalog"
    ? [preparation.output] : []

export const linkContributions = (
  contributions: ReadonlyArray<CapabilityContribution>
): ReleaseGraph => {
  const declared = contributions.flatMap((item) => item.artifacts)
  const allPreparationOutputs = contributions.flatMap((item) => item.preparations.flatMap(preparationOutputs))
  const artifactIds = new Set<string>()
  for (const artifact of declared) {
    if (artifactIds.has(artifact.id.toString())) throw new GraphLinkError({
      kind: "duplicate", value: artifact.id.toString(), reason: "Artifact id has more than one declaration."
    })
    artifactIds.add(artifact.id.toString())
  }
  for (const artifact of allPreparationOutputs) artifactIds.add(artifact.id.toString())
  const artifacts = [...declared, ...allPreparationOutputs.filter((item) =>
    !declared.some((declaredArtifact) => declaredArtifact.id === item.id)
  )].sort(byId)
  const paths = new Map<string, string>()
  for (const artifact of artifacts) {
    const path = artifact.path.toString()
    const previous = paths.get(path)
    if (previous !== undefined && previous !== artifact.id.toString()) throw new GraphLinkError({
      kind: "path", value: path, reason: `Artifacts ${previous} and ${artifact.id} share one output path.`
    })
    paths.set(path, artifact.id.toString())
  }
  const preparations = contributions.flatMap((item) => item.preparations).sort(byId)
  const operationIds = new Set<string>()
  const producers = new Map<string, string>()
  for (const preparation of preparations) {
    const id = preparation.id.toString()
    if (operationIds.has(id)) throw new GraphLinkError({
      kind: "duplicate", value: id, reason: "Preparation id has more than one producer."
    })
    operationIds.add(id)
    for (const input of preparationInputs(preparation)) {
      if (!artifactIds.has(input.toString())) throw new GraphLinkError({
        kind: "missing", value: input.toString(), reason: `Preparation ${id} references no artifact.`
      })
    }
    for (const output of preparationOutputs(preparation)) {
      const outputId = output.id.toString()
      if (declared.some((artifact) => artifact.id.toString() === outputId)) throw new GraphLinkError({
        kind: "duplicate", value: outputId, reason: "A declared artifact cannot also be a preparation output."
      })
      if (producers.has(outputId)) throw new GraphLinkError({
        kind: "duplicate", value: outputId, reason: "Output has more than one producer."
      })
      if (preparation._tag === "GraphCommandArtifact" && ["directory", "package"].includes(output.kind)) throw new GraphLinkError({
        kind: "path", value: outputId, reason: "Generic command outputs must be regular files."
      })
      if (preparation._tag === "GraphCommandArtifact" && preparation.inputs.some((input) => input.toString() === outputId)) throw new GraphLinkError({
        kind: "reference", value: outputId, reason: "Command inputs and outputs must be disjoint."
      })
      if (preparation._tag === "GraphCommandArtifact" && preparation.inputs.some((input) =>
        artifacts.find((artifact) => artifact.id.toString() === input.toString())?.path === output.path)) throw new GraphLinkError({
        kind: "path", value: outputId, reason: "Command outputs must not overwrite input paths."
      })
      producers.set(outputId, id)
    }
    const references = preparation._tag === "GraphCommandCheck" || preparation._tag === "GraphCommandArtifact"
      ? preparation.argv.flatMap((part) => [...part.matchAll(/\{(input|output):([^}]+)\}/gu)]) : []
    for (const reference of references) {
      const direction = reference[1]
      const referenced = reference[2] ?? ""
      if (direction === "input" && !preparationInputs(preparation).some((input) => input.toString() === referenced)) {
        throw new GraphLinkError({ kind: "reference", value: referenced, reason: "Command input reference is undeclared." })
      }
      if (direction === "output" && !preparationOutputs(preparation).some((output) => output.id.toString() === referenced)) {
        throw new GraphLinkError({ kind: "reference", value: referenced, reason: "Command output reference is undeclared." })
      }
    }
    if (preparation._tag === "GraphCommandCheck" || preparation._tag === "GraphCommandArtifact") {
      for (const part of preparation.argv) {
        for (const token of part.matchAll(/\{([^}]+)\}/gu)) {
          const value = token[1] ?? ""
          if (!value.startsWith("input:") && !value.startsWith("output:")) throw new GraphLinkError({
            kind: "reference", value, reason: "Command paths only support {input:<id>} and {output:<id>} references."
          })
        }
      }
    }
  }
  const publications = contributions.flatMap((item) => item.publications).sort(byId)
  for (const publication of publications) {
    if (publication._tag === "GraphGitHubPublication" && publication.body !== undefined && publication.bodyArtifact !== undefined) {
      throw new GraphLinkError({ kind: "reference", value: publication.id.toString(), reason: "GitHub body must be inline text or one text artifact, not both." })
    }
    const ids = publication._tag === "GraphGitHubPublication"
      ? [...publication.assetIds, ...(publication.bodyArtifact === undefined ? [] : [publication.bodyArtifact])]
      : publication.artifactIds
    for (const id of ids) if (!artifactIds.has(id.toString()) && !producers.has(id.toString())) {
      throw new GraphLinkError({ kind: "missing", value: id.toString(), reason: "Publication references no artifact." })
    }
    if (publication._tag === "GraphGitHubPublication" && publication.bodyArtifact !== undefined) {
      const body = artifacts.find((artifact) => artifact.id.toString() === publication.bodyArtifact!.toString())
      if (body !== undefined && (body.mediaType === undefined || !body.mediaType.startsWith("text/"))) throw new GraphLinkError({
        kind: "reference", value: publication.bodyArtifact.toString(), reason: "GitHub body artifacts must declare a text/* media type."
      })
    }
  }
  const dependencies = new Map<string, Set<string>>(
    preparations.map((preparation) => [preparation.id.toString(), new Set(
      preparationInputs(preparation).map((input) => producers.get(input.toString())).filter(
        (value): value is string => value !== undefined
      ))])
  )
  const ordered: GraphPreparation[] = []
  const pending = new Map(preparations.map((preparation) => [preparation.id.toString(), preparation]))
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((preparation) =>
      [...dependencies.get(preparation.id.toString())!].every((dependency) =>
        !pending.has(dependency)
      )).sort(byId)
    if (ready.length === 0) throw new GraphLinkError({
      kind: "cycle", value: [...pending.keys()].sort().join(","), reason: "Preparation dependency cycle."
    })
    for (const preparation of ready) {
      pending.delete(preparation.id.toString())
      ordered.push(preparation)
    }
  }
  return ReleaseGraph.make({ artifacts, preparations: ordered, publications })
}
