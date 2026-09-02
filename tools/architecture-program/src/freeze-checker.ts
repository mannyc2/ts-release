import { Effect, Schema } from "effect"
import { parseCanonicalJsonBytes } from "./canonical-document.js"
import {
  FREEZE_ARTIFACT_PATHS,
  generateFreezeBundle,
  type FreezeAuthorityFile,
  type FreezeGenerationRequest,
  type GeneratedFreezeBundle
} from "./freeze-generator.js"
import {
  decodeGatesFreeze,
  decodeMigrationFreeze,
  decodeSurfaceFreeze,
  decodeSystemFreeze,
  decodeWavesFreeze
} from "./schema/freeze-contract.js"
import { sha256Bytes } from "./trial-hash.js"

export class FreezeCheckError extends Schema.TaggedError<FreezeCheckError>()(
  "FreezeCheckError",
  {
    issues: Schema.NonEmptyArray(Schema.String),
    message: Schema.String
  }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({ issues, message: `Architecture freeze check failed: ${issues.join("; ")}` })
  }
}

const causeMessage = (cause: unknown): string => cause instanceof Error
  ? cause.message
  : String(cause)

const codePointCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0
const exactOrdered = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])
const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index])

const exactFileMap = (
  files: ReadonlyArray<FreezeAuthorityFile>
): Map<string, Uint8Array> => {
  const map = new Map<string, Uint8Array>()
  for (const file of files) {
    if (map.has(file.path)) {
      throw new FreezeCheckError([`freeze artifacts contain duplicate path ${file.path}`])
    }
    map.set(file.path, file.bytes)
  }
  return map
}

const decodeCanonicalArtifact = Effect.fn("FreezeChecker.decodeCanonicalArtifact")(
  function* <A, E>(
    path: string,
    bytes: Uint8Array,
    decode: (input: unknown) => Effect.Effect<A, E>
  ) {
    const input = yield* Effect.try({
      try: () => parseCanonicalJsonBytes(bytes),
      catch: (cause) => new FreezeCheckError([
        `${path} is not CanonicalJsonV1: ${causeMessage(cause)}`
      ])
    })
    return yield* decode(input).pipe(Effect.mapError((cause) => new FreezeCheckError([
      `${path} schema or invariant validation failed: ${causeMessage(cause)}`
    ])))
  }
)

/**
 * Checks both the durable schemas/hash links and byte-for-byte regeneration.
 * The latter makes any hand edit, including a schema-valid one, invalid.
 */
export const checkFreezeBundle = Effect.fn("FreezeChecker.checkBundle")(
  function* (
    request: FreezeGenerationRequest,
    actualFiles: ReadonlyArray<FreezeAuthorityFile>
  ) {
    const expected = yield* generateFreezeBundle(request).pipe(
      Effect.mapError((cause) => new FreezeCheckError([
        `freeze authority is not generatable: ${causeMessage(cause)}`
      ]))
    )
    const actual = yield* Effect.try({
      try: () => exactFileMap(actualFiles),
      catch: (cause) => cause instanceof FreezeCheckError
        ? cause
        : new FreezeCheckError([causeMessage(cause)])
    })
    if (!exactOrdered(
      [...actual.keys()].sort(codePointCompare),
      [...FREEZE_ARTIFACT_PATHS].sort(codePointCompare)
    )) {
      return yield* new FreezeCheckError([
        "freeze artifacts must equal the exact five JSON/four Markdown path set"
      ])
    }

    const surfaceBytes = actual.get(FREEZE_ARTIFACT_PATHS[0])!
    const migrationBytes = actual.get(FREEZE_ARTIFACT_PATHS[2])!
    const wavesBytes = actual.get(FREEZE_ARTIFACT_PATHS[4])!
    const gatesBytes = actual.get(FREEZE_ARTIFACT_PATHS[6])!
    const systemBytes = actual.get(FREEZE_ARTIFACT_PATHS[8])!
    const surface = yield* decodeCanonicalArtifact(
      FREEZE_ARTIFACT_PATHS[0],
      surfaceBytes,
      (input) => decodeSurfaceFreeze(input, expected.contractId)
    )
    const migration = yield* decodeCanonicalArtifact(
      FREEZE_ARTIFACT_PATHS[2],
      migrationBytes,
      (input) => decodeMigrationFreeze(input, expected.contractId)
    )
    const waves = yield* decodeCanonicalArtifact(
      FREEZE_ARTIFACT_PATHS[4],
      wavesBytes,
      (input) => decodeWavesFreeze(input, expected.contractId)
    )
    const gates = yield* decodeCanonicalArtifact(
      FREEZE_ARTIFACT_PATHS[6],
      gatesBytes,
      (input) => decodeGatesFreeze(input, expected.contractId)
    )
    const system = yield* decodeCanonicalArtifact(
      FREEZE_ARTIFACT_PATHS[8],
      systemBytes,
      (input) => decodeSystemFreeze(input, expected.contractId)
    )
    const expectedBindings = [
      {
        artifact: "SURFACE",
        jsonPath: FREEZE_ARTIFACT_PATHS[0],
        jsonSha256: sha256Bytes(surfaceBytes),
        documentId: surface.documentId,
        markdownPath: FREEZE_ARTIFACT_PATHS[1],
        markdownSha256: sha256Bytes(actual.get(FREEZE_ARTIFACT_PATHS[1])!)
      },
      {
        artifact: "MIGRATION",
        jsonPath: FREEZE_ARTIFACT_PATHS[2],
        jsonSha256: sha256Bytes(migrationBytes),
        documentId: migration.documentId,
        markdownPath: FREEZE_ARTIFACT_PATHS[3],
        markdownSha256: sha256Bytes(actual.get(FREEZE_ARTIFACT_PATHS[3])!)
      },
      {
        artifact: "WAVES",
        jsonPath: FREEZE_ARTIFACT_PATHS[4],
        jsonSha256: sha256Bytes(wavesBytes),
        documentId: waves.documentId,
        markdownPath: FREEZE_ARTIFACT_PATHS[5],
        markdownSha256: sha256Bytes(actual.get(FREEZE_ARTIFACT_PATHS[5])!)
      },
      {
        artifact: "GATES",
        jsonPath: FREEZE_ARTIFACT_PATHS[6],
        jsonSha256: sha256Bytes(gatesBytes),
        documentId: gates.documentId,
        markdownPath: FREEZE_ARTIFACT_PATHS[7],
        markdownSha256: sha256Bytes(actual.get(FREEZE_ARTIFACT_PATHS[7])!)
      }
    ]
    if (!exactOrdered(
      system.projectionBindings.map((binding) => JSON.stringify(binding)),
      expectedBindings.map((binding) => JSON.stringify(binding))
    )) {
      return yield* new FreezeCheckError([
        "SYSTEM projection bindings do not match the exact JSON and Markdown bytes"
      ])
    }

    const drift = expected.artifacts.flatMap((artifact) => {
      const bytes = actual.get(artifact.path)
      return bytes !== undefined && equalBytes(bytes, artifact.bytes)
        ? []
        : [artifact.path]
    })
    if (drift.length > 0) {
      return yield* new FreezeCheckError([
        `freeze artifacts do not regenerate byte-for-byte: ${drift.join(", ")}`
      ])
    }
    return expected satisfies GeneratedFreezeBundle
  }
)
