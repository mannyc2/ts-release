// Invariant: checksum input order is basename-sorted and excludes every directory-shaped or prior checksum artifact.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { artifactIsDirectoryLike, artifactPathBaseName, ChecksumFileExtra, makeArtifact } from "../../grammar/artifact.js"
import { WriteFileAction } from "../../grammar/operation.js"
import { FilePartsContent, Sha256Hole } from "../../grammar/content.js"
import { featureOperation, featurePlanner } from "../../grammar/planner.js"
import { renderArtifactNameEffect } from "../../grammar/template.js"
import { defaulted } from "../../grammar/defaulted.js"

export class ReleaseConfigChecksum extends Schema.Class<ReleaseConfigChecksum>("ReleaseConfigChecksum")({
  algorithm: defaulted(Schema.Literals(["sha256", "sha512"]), "sha256"),
  nameTemplate: defaulted(Schema.NonEmptyString, "{name}_{version}_checksums.txt")
}) {}

export const checksumPlanner = featurePlanner<ReleaseConfigChecksum>("checksum", (section, state) => Effect.gen(function*() {
    const inputs = state.artifacts.filter((artifact) =>
      artifact.kind !== "checksum-file" && !artifactIsDirectoryLike(artifact)
    ).sort((left, right) => artifactPathBaseName(left.path).localeCompare(artifactPathBaseName(right.path)))
    const fileName = yield* renderArtifactNameEffect(section.nameTemplate, { identity: state.identity }, {
      pipeId: "checksum", field: "checksum.nameTemplate"
    })
    const path = `.release/artifacts/${fileName}`
    return {
      artifacts: [makeArtifact({
        id: "checksum",
        path,
        producedBy: "checksum",
        extra: ChecksumFileExtra.make({
          algorithm: section.algorithm, coversArtifactIds: inputs.map(({ id }) => id)
        })
      })],
      operations: [featureOperation({
        id: "checksum:write",
        phase: "process",
        risk: "writes-local",
        description: `Write ${section.algorithm} checksum file ${fileName}.`,
        action: WriteFileAction.make({
          path,
          contents: FilePartsContent.make({ parts: inputs.flatMap((input) => [
            Sha256Hole.make({ artifactId: input.id }), `  ${artifactPathBaseName(input.path)}\n`
          ]) })
        })
      })]
    }
  }))
