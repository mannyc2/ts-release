import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Encoding from "effect/Encoding"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import {
  ArtifactIntent,
  ArtifactInventoryItem,
  Checksum,
  ChecksumAlgorithm
} from "../domain/artifact.js"
import { ReleaseNormalizationError } from "./errors.js"

export type * from "../types/effect-internal.js"

type ArtifactKind = "file" | "directory" | "other"

const checksumName = (algorithm: ChecksumAlgorithm): Crypto.DigestAlgorithm =>
  algorithm === "sha256" ? "SHA-256" : "SHA-512"

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const artifactPath = (path: Path.Path, root: string, pathName: string): string =>
  path.isAbsolute(pathName) ? pathName : path.resolve(root, pathName)

const artifactKind = (info: FileSystem.File.Info): ArtifactKind =>
  info.type === "Directory" ? "directory" : info.type === "File" ? "file" : "other"

const normalizationPlatformError = (field: string) => (cause: unknown) =>
  ReleaseNormalizationError.make({
    field,
    reason: formatUnknown(cause)
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
    Effect.mapError(normalizationPlatformError(`artifacts.${artifact.id}.checksum`))
  )
  const digest = yield* crypto.digest(checksumName("sha256"), bytes).pipe(
    Effect.mapError(normalizationPlatformError(`artifacts.${artifact.id}.checksum`))
  )

  return Checksum.make({
    algorithm: "sha256",
    value: Encoding.encodeHex(digest)
  })
})

export const inventoryArtifact = Effect.fn("inventoryArtifact")(function*(
  root: string,
  artifact: ArtifactIntent
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = artifactPath(path, root, artifact.path)
  const info = yield* fs.stat(targetPath).pipe(
    Effect.mapError(normalizationPlatformError(`artifacts.${artifact.id}.path`))
  )
  const kind = artifactKind(info)
  yield* validateArtifactFormat(artifact, kind)

  const checksum = artifact.checksum ?? (artifact.format === "directory"
    ? undefined
    : yield* checksumArtifact(artifact, targetPath, info.type))

  return ArtifactInventoryItem.make({
    id: artifact.id,
    path: artifact.path,
    format: artifact.format,
    consumers: [...artifact.consumers].sort(),
    sizeBytes: Number(info.size),
    ...(checksum === undefined ? {} : { checksum })
  })
})
