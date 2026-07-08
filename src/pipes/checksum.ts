import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  artifactPathBaseName,
  ChecksumFileExtra
} from "../pipeline/artifact.js"
import { ChecksumFileContent, Operation, WriteFileAction } from "../pipeline/operation.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import { renderArtifactNameEffect } from "../pipeline/template.js"

export class ReleaseConfigChecksum extends Schema.Class<ReleaseConfigChecksum>("ReleaseConfigChecksum")({
  algorithm: Schema.optionalKey(Schema.Literals(["sha256", "sha512"])),
  nameTemplate: Schema.optionalKey(Schema.NonEmptyString)
}) {}

const defaultChecksumNameTemplate = "{name}_{version}_checksums.txt"

const checksumInputs = (artifacts: ReadonlyArray<Artifact>): ReadonlyArray<Artifact> =>
  artifacts
    .filter((artifact) => artifact.kind !== "checksum-file" && artifact.kind !== "signature")
    .sort((left, right) => artifactPathBaseName(left.path).localeCompare(artifactPathBaseName(right.path)))

export const checksumPipe: Pipe<ReleaseConfigChecksum> = {
  id: "checksum",
  phase: "process",
  section: (config) => config.checksum,
  defaults: (section) => ({
    algorithm: section.algorithm ?? "sha256",
    nameTemplate: section.nameTemplate ?? defaultChecksumNameTemplate
  }),
  plan: (section, state) =>
    Effect.gen(function*() {
      const algorithm = section.algorithm ?? "sha256"
      const nameTemplate = section.nameTemplate ?? defaultChecksumNameTemplate
      // Catalog-file artifacts are contributed by later catalog-phase pipes,
      // so process-phase checksums only see build/import/archive artifacts.
      const inputs = checksumInputs(state.artifacts.artifacts)
      const entries = inputs.map((artifact) => ({
        artifactId: artifact.id,
        baseName: artifactPathBaseName(artifact.path)
      }))
      const fileName = yield* renderArtifactNameEffect(nameTemplate, { identity: state.identity }, { pipeId: "checksum", field: "checksum.nameTemplate" })
      const path = `.release/artifacts/${fileName}`
      const artifact = Artifact.make({
        id: "checksum",
        kind: "checksum-file",
        path,
        producedBy: "checksum",
        extra: ChecksumFileExtra.make({
          algorithm,
          coversArtifactIds: inputs.map((input) => input.id)
        })
      })
      return {
        ...emptyContribution,
        artifacts: [artifact],
        operations: [
          Operation.make({
            id: "checksum:write",
            pipeId: "checksum",
            phase: "process",
            risk: "writes-local",
            description: `Write ${algorithm} checksum file ${fileName}.`,
            action: WriteFileAction.make({
              path,
              contents: ChecksumFileContent.make({
                algorithm,
                entries
              })
            })
          })
        ]
      }
    })
}
