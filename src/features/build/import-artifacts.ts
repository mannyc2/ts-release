// Invariant: each manual artifact is decoded once, rendered once, and paired with one existence check.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  ArtifactFormat,
  ArchiveExtra,
  Checksum,
  ExecutableExtra,
  ImportedFileExtra,
  InstallableArtifactVariant,
  SafeRelativePath,
  type ArtifactExtra
} from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { CheckFileAction } from "../../grammar/operation.js"
import { featureOperation, featurePlanner } from "../../grammar/planner.js"
import { renderArtifactNameEffect } from "../../grammar/template.js"

export class ReleaseConfigManualArtifact extends Schema.Class<ReleaseConfigManualArtifact>(
  "ReleaseConfigManualArtifact"
)({
  id: Schema.NonEmptyString,
  path: SafeRelativePath,
  format: ArtifactFormat,
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

const extra = (artifact: ReleaseConfigManualArtifact): ArtifactExtra =>
  artifact.format === "tarball" || artifact.format === "zip"
    ? ArchiveExtra.make({ format: artifact.format, binaries: [], files: [] })
    : artifact.format === "executable"
    ? ExecutableExtra.make({
      binary: artifact.variant?.binaryName ?? artifact.id,
      extension: artifact.variant?.executableExtension ?? "",
      builderId: "import-artifacts"
    })
    : ImportedFileExtra.make({ format: artifact.format })

export const importArtifactsPlanner = featurePlanner<ReadonlyArray<ReleaseConfigManualArtifact>>(
  "import-artifacts", (section, state) => Effect.forEach(section, (input) => Effect.gen(function*() {
    if (input.variant?.libc !== undefined && input.variant.os !== "linux") return yield* Effect.fail(PlanError.make({
      pipeId: "import-artifacts",
      field: `artifacts.${input.id}.variant.libc`,
      reason: "libc is only valid for linux artifacts."
    }))
    const path = yield* renderArtifactNameEffect(input.path, { identity: state.identity }, {
      pipeId: "import-artifacts", field: `artifacts.${input.id}.path`
    })
    return {
      artifact: Artifact.make({
        id: input.id,
        path,
        producedBy: "import-artifacts",
        ...(input.checksum === undefined ? {} : { checksum: input.checksum }),
        ...(input.variant === undefined ? {} : { platform: input.variant }),
        extra: extra(input)
      }),
      operation: featureOperation({
        id: `import-artifacts:${input.id}:exists`,
        phase: "build",
        risk: "read-only",
        description: `Verify imported artifact ${input.id} exists.`,
        action: CheckFileAction.make({
          path,
          ...(input.checksum === undefined ? {} : { checksum: input.checksum })
        })
      })
    }
  })).pipe(Effect.map((planned) => ({
    artifacts: planned.map(({ artifact }) => artifact),
    operations: planned.map(({ operation }) => operation)
  }))))
