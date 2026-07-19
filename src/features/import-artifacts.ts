// Invariant: each manual artifact is decoded once, rendered once, and paired with one existence check.
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
  SafeRelativePath,
  type ArtifactExtra
} from "../grammar/artifact.js"
import { PlanError } from "../grammar/errors.js"
import { CheckFileAction, Operation } from "../grammar/operation.js"
import { featurePlanner } from "../grammar/pipe.js"
import { renderArtifactNameEffect } from "../grammar/template.js"

export class ReleaseConfigManualArtifact extends Schema.Class<ReleaseConfigManualArtifact>(
  "ReleaseConfigManualArtifact"
)({
  id: Schema.NonEmptyString,
  path: SafeRelativePath,
  format: ArtifactFormat,
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

export const resolveManualArtifacts = (raw: ReadonlyArray<ReleaseConfigManualArtifact> | undefined) =>
  raw === undefined ? Option.none<ReadonlyArray<ReleaseConfigManualArtifact>>() : Option.some(raw)

const kinds: Record<ReleaseConfigManualArtifact["format"], Artifact["kind"]> = {
  tarball: "archive", zip: "archive", directory: "file",
  executable: "executable", file: "file", "oci-image": "file"
}

const extra = (artifact: ReleaseConfigManualArtifact, kind: Artifact["kind"]): ArtifactExtra =>
  kind === "archive"
    ? ArchiveExtra.make({ format: artifact.format, binaries: [], files: [] })
    : kind === "executable"
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
    const kind = kinds[input.format]
    return {
      artifact: Artifact.make({
        id: input.id,
        kind,
        path,
        producedBy: "import-artifacts",
        ...(input.checksum === undefined ? {} : { checksum: input.checksum }),
        ...(input.variant === undefined ? {} : { platform: input.variant }),
        extra: extra(input, kind)
      }),
      operation: Operation.make({
        id: `import-artifacts:${input.id}:exists`,
        pipeId: "import-artifacts",
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
