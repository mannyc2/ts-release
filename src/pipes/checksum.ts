import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  Artifact,
  artifactPathBaseName,
  ChecksumFileExtra
} from "../pipeline/artifact.js"
import { FilePartsContent, Operation, Sha256Hole, WriteFileAction } from "../pipeline/operation.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import { renderArtifactNameEffect, validateSafeRelativePathEffect } from "../pipeline/template.js"

export class ReleaseConfigChecksum extends Schema.Class<ReleaseConfigChecksum>("ReleaseConfigChecksum")({
  algorithm: Schema.optionalKey(Schema.Literals(["sha256", "sha512"])),
  nameTemplate: Schema.optionalKey(Schema.NonEmptyString)
}) {}

const defaultChecksumNameTemplate = "{name}_{version}_checksums.txt"

export interface ResolvedChecksum {
  readonly algorithm: "sha256" | "sha512"
  readonly nameTemplate: string
}

export const resolveChecksum = (
  raw: ReleaseConfigChecksum | undefined
): Option.Option<ResolvedChecksum> =>
  raw === undefined
    ? Option.none()
    : Option.some({
      algorithm: raw.algorithm ?? "sha256",
      nameTemplate: raw.nameTemplate ?? defaultChecksumNameTemplate
    })

const isChecksumFileInput = (artifact: Artifact): boolean => {
  if (artifact.kind === "package" || artifact.kind === "checksum-file") {
    return false
  }
  if (artifact.extra?._tag === "file" && artifact.extra.format === "directory") {
    return false
  }
  return true
}

const checksumInputs = (artifacts: ReadonlyArray<Artifact>): ReadonlyArray<Artifact> =>
  artifacts
    .filter(isChecksumFileInput)
    .sort((left, right) => artifactPathBaseName(left.path).localeCompare(artifactPathBaseName(right.path)))

export const checksumPlanner: FeaturePlanner<ResolvedChecksum> = {
  id: "checksum",
  plan: (section, state) =>
    Effect.gen(function*() {
      const { algorithm, nameTemplate } = section
      // Catalog-file artifacts are contributed by later catalog-phase pipes,
      // so process-phase checksums only see build/import/archive artifacts.
      const inputs = checksumInputs(state.artifacts)
      const fileName = yield* renderArtifactNameEffect(nameTemplate, { identity: state.identity }, { pipeId: "checksum", field: "checksum.nameTemplate" })
      const path = yield* validateSafeRelativePathEffect(
        `.release/artifacts/${fileName}`,
        { pipeId: "checksum", field: "checksum.nameTemplate" }
      )
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
              contents: FilePartsContent.make({
                parts: inputs.flatMap((input) => [
                  Sha256Hole.make({ artifactId: input.id }),
                  `  ${artifactPathBaseName(input.path)}\n`
                ])
              })
            })
          })
        ]
      }
    })
}
