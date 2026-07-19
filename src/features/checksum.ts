// Invariant: checksum input order is basename-sorted and excludes every directory-shaped or prior checksum artifact.
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Artifact, artifactPathBaseName, ChecksumFileExtra } from "../grammar/artifact.js"
import { FilePartsContent, Operation, Sha256Hole, WriteFileAction } from "../grammar/operation.js"
import { featurePlanner } from "../grammar/pipe.js"
import { renderArtifactNameEffect } from "../grammar/template.js"

export class ReleaseConfigChecksum extends Schema.Class<ReleaseConfigChecksum>("ReleaseConfigChecksum")({
  algorithm: Schema.optionalKey(Schema.Literals(["sha256", "sha512"])),
  nameTemplate: Schema.optionalKey(Schema.NonEmptyString)
}) {}
export interface ResolvedChecksum { readonly algorithm: "sha256" | "sha512"; readonly nameTemplate: string }
export const resolveChecksum = (raw: ReleaseConfigChecksum | undefined): Option.Option<ResolvedChecksum> =>
  raw === undefined ? Option.none() : Option.some({
    algorithm: raw.algorithm ?? "sha256",
    nameTemplate: raw.nameTemplate ?? "{name}_{version}_checksums.txt"
  })

export const checksumPlanner = featurePlanner<ResolvedChecksum>("checksum", (section, state) => Effect.gen(function*() {
    const inputs = state.artifacts.filter((artifact) =>
      artifact.kind !== "package" && artifact.kind !== "checksum-file"
      && !(artifact.extra?._tag === "file" && artifact.extra.format === "directory")
    ).sort((left, right) => artifactPathBaseName(left.path).localeCompare(artifactPathBaseName(right.path)))
    const fileName = yield* renderArtifactNameEffect(section.nameTemplate, { identity: state.identity }, {
      pipeId: "checksum", field: "checksum.nameTemplate"
    })
    const path = `.release/artifacts/${fileName}`
    return {
      artifacts: [Artifact.make({
        id: "checksum",
        kind: "checksum-file",
        path,
        producedBy: "checksum",
        extra: ChecksumFileExtra.make({
          algorithm: section.algorithm, coversArtifactIds: inputs.map(({ id }) => id)
        })
      })],
      operations: [Operation.make({
        id: "checksum:write",
        pipeId: "checksum",
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
