import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Encoding from "effect/Encoding"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import {
  ArtifactIntent,
  ArtifactInventoryItem,
  Checksum
} from "../domain/artifact.js"
import { ReleaseNormalizationError } from "./errors.js"

export type * from "../types/effect-internal.js"

type ArtifactKind = "file" | "directory" | "other"

const artifactPath = (path: Path.Path, root: string, pathName: string): string =>
  path.isAbsolute(pathName) ? pathName : path.resolve(root, pathName)

const artifactKind = (info: FileSystem.File.Info): ArtifactKind =>
  info.type === "Directory" ? "directory" : info.type === "File" ? "file" : "other"

const normalizationPlatformError = (field: string, reason: string) => (cause: unknown) =>
  ReleaseNormalizationError.make({
    field,
    reason,
    cause
  })

const validateArtifactFormat = (
  artifact: ArtifactIntent,
  kind: ArtifactKind
): Effect.Effect<void, ReleaseNormalizationError> => {
  if (artifact.format === "directory" && kind !== "directory") {
    return Effect.fail(
      ReleaseNormalizationError.make({
        field: `artifacts.${artifact.id}.format`,
        reason: `Expected directory artifact at ${artifact.path}`
      })
    )
  }
  if (artifact.format !== "directory" && kind === "directory") {
    return Effect.fail(
      ReleaseNormalizationError.make({
        field: `artifacts.${artifact.id}.format`,
        reason: `Expected file-like artifact at ${artifact.path}`
      })
    )
  }
  return Effect.void
}

const checksumArtifact = Effect.fn("checksumArtifact")(function*(
  artifact: ArtifactIntent,
  targetPath: string,
  fileType: FileSystem.File.Type
) {
  if (fileType !== "File") {
    return yield* Effect.fail(
      ReleaseNormalizationError.make({
        field: `artifacts.${artifact.id}.checksum`,
        reason: "Only file artifacts can be hashed"
      })
    )
  }

  const fs = yield* FileSystem.FileSystem
  const crypto = yield* Crypto.Crypto
  const bytes = yield* fs.readFile(targetPath).pipe(
    Effect.mapError(normalizationPlatformError(`artifacts.${artifact.id}.checksum`, "Unable to read artifact bytes."))
  )
  const digest = yield* crypto.digest("SHA-256", bytes).pipe(
    Effect.mapError(normalizationPlatformError(
      `artifacts.${artifact.id}.checksum`,
      "Unable to compute artifact checksum."
    ))
  )

  return Checksum.make({
    algorithm: "sha256",
    value: Encoding.encodeHex(digest)
  })
})

const verifiedChecksum = Effect.fn("verifiedChecksum")(function*(
  artifact: ArtifactIntent,
  targetPath: string,
  fileType: FileSystem.File.Type
) {
  if (artifact.checksum === undefined) {
    return artifact.format === "directory"
      ? undefined
      : yield* checksumArtifact(artifact, targetPath, fileType)
  }
  if (artifact.checksum.algorithm !== "sha256") {
    return yield* Effect.fail(
      ReleaseNormalizationError.make({
        field: `artifacts.${artifact.id}.checksum`,
        reason: "Only sha256 artifact checksums are supported."
      })
    )
  }
  const computed = yield* checksumArtifact(artifact, targetPath, fileType)
  if (artifact.checksum.value !== computed.value) {
    return yield* Effect.fail(
      ReleaseNormalizationError.make({
        field: `artifacts.${artifact.id}.checksum`,
        reason: "Artifact checksum does not match artifact bytes."
      })
    )
  }
  return artifact.checksum
})

export const inventoryArtifact = Effect.fn("inventoryArtifact")(function*(
  root: string,
  artifact: ArtifactIntent
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = artifactPath(path, root, artifact.path)
  const info = yield* fs.stat(targetPath).pipe(
    Effect.mapError(normalizationPlatformError(`artifacts.${artifact.id}.path`, "Unable to inspect artifact path."))
  )
  const kind = artifactKind(info)
  yield* validateArtifactFormat(artifact, kind)

  const checksum = yield* verifiedChecksum(artifact, targetPath, info.type)

  return ArtifactInventoryItem.make({
    id: artifact.id,
    path: artifact.path,
    ...(artifact.downloadUrl === undefined ? {} : { downloadUrl: artifact.downloadUrl }),
    format: artifact.format,
    consumers: [...artifact.consumers].sort(),
    sizeBytes: Number(info.size),
    ...(checksum === undefined ? {} : { checksum }),
    ...(artifact.variant === undefined ? {} : { variant: artifact.variant })
  })
})
