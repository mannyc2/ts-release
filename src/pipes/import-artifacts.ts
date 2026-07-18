import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  Artifact,
  ArtifactFormat,
  ArchiveExtra,
  Checksum,
  ExecutableExtra,
  ImportedFileExtra,
  InstallableArtifactVariant,
  SafeRelativePath
} from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import { CheckFileAction, Operation } from "../pipeline/operation.js"
import { optionalField } from "../pipeline/optional-field.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import { renderArtifactNameEffect } from "../pipeline/template.js"

export class ReleaseConfigManualArtifact extends Schema.Class<ReleaseConfigManualArtifact>(
  "ReleaseConfigManualArtifact"
)({
  id: Schema.NonEmptyString,
  path: SafeRelativePath,
  format: ArtifactFormat,
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

export type ResolvedManualArtifact = ReleaseConfigManualArtifact

export const resolveManualArtifacts = (
  raw: ReadonlyArray<ReleaseConfigManualArtifact> | undefined
): Option.Option<ReadonlyArray<ResolvedManualArtifact>> =>
  raw === undefined ? Option.none() : Option.some(raw)

const artifactKind = (format: ReleaseConfigManualArtifact["format"]): Artifact["kind"] => {
  switch (format) {
    case "tarball":
    case "zip":
      return "archive"
    case "directory":
      return "file"
    case "executable":
      return "executable"
    case "file":
    case "oci-image":
      return "file"
  }
}

export const importArtifactsPlanner: FeaturePlanner<ReadonlyArray<ResolvedManualArtifact>> = {
  id: "import-artifacts",
  plan: (section, state) =>
    Effect.gen(function*() {
      const artifacts = []
      const operations = []
      for (const artifact of section) {
        if (artifact.variant?.libc !== undefined && artifact.variant.os !== "linux") {
          return yield* Effect.fail(PlanError.make({
            pipeId: "import-artifacts",
            field: `artifacts.${artifact.id}.variant.libc`,
            reason: "libc is only valid for linux artifacts."
          }))
        }
        const path = yield* renderArtifactNameEffect(artifact.path, { identity: state.identity }, {
          pipeId: "import-artifacts",
          field: `artifacts.${artifact.id}.path`
        })
        const kind = artifactKind(artifact.format)
        artifacts.push(Artifact.make({
          id: artifact.id,
          kind,
          path,
          producedBy: "import-artifacts",
          ...optionalField(artifact.checksum, (checksum) => ({ checksum })),
          ...optionalField(artifact.variant, (platform) => ({ platform })),
          ...(kind === "archive"
            ? {
              extra: ArchiveExtra.make({
                format: artifact.format,
                binaries: [],
                files: []
              })
            }
            : {}),
          ...(kind === "executable"
            ? {
              extra: ExecutableExtra.make({
                binary: artifact.variant?.binaryName ?? artifact.id,
                extension: artifact.variant?.executableExtension ?? "",
                builderId: "import-artifacts"
              })
            }
            : {}),
          ...(kind === "file"
            ? {
              extra: ImportedFileExtra.make({
                format: artifact.format
              })
            }
            : {})
        }))
        operations.push(Operation.make({
          id: `import-artifacts:${artifact.id}:exists`,
          pipeId: "import-artifacts",
          phase: "build",
          risk: "read-only",
          description: `Verify imported artifact ${artifact.id} exists.`,
          action: CheckFileAction.make({
            path,
            checksum: artifact.checksum
          })
        }))
      }
      return {
        ...emptyContribution,
        artifacts,
        operations
      }
    })
}
