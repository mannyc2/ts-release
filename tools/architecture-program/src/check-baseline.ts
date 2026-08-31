import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { Effect, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import { checkSourceCoordinate } from "./check-source-coordinate.js"
import {
  decodeArchitectureBaseline,
  encodeArchitectureBaseline
} from "./schema/baseline.js"
import { sourceCoordinateKey } from "./schema/source-coordinate.js"

export const architectureBaselineInputPath =
  "docs/refactor/architecture-program/inputs/baseline.json"

export class ArchitectureBaselineCheckError extends Schema.TaggedError<ArchitectureBaselineCheckError>()(
  "ArchitectureBaselineCheckError",
  {
    operation: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(operation: string, sourceCause: unknown) {
    const reason = sourceCause instanceof Error ? sourceCause.message : String(sourceCause)
    super({ operation, reason, message: `${operation}: ${reason}` })
  }
}

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const checkArchitectureBaseline = Effect.fn("ArchitectureBaselineV1.check")(
  function* (repositoryRoot: string) {
    const inputBytes = yield* Effect.tryPromise({
      try: () => readFile(resolve(repositoryRoot, architectureBaselineInputPath)),
      catch: (cause) => new ArchitectureBaselineCheckError(
        `read ${architectureBaselineInputPath}`,
        cause
      )
    })
    const parsed = yield* Effect.try({
      try: () => parseCanonicalJsonBytes(inputBytes),
      catch: (cause) => new ArchitectureBaselineCheckError(
        `parse ${architectureBaselineInputPath}`,
        cause
      )
    })
    const document = yield* decodeArchitectureBaseline(parsed)
    const encodedBytes = yield* Effect.try({
      try: () => canonicalJsonBytes(encodeArchitectureBaseline(document)),
      catch: (cause) => new ArchitectureBaselineCheckError("encode architecture baseline", cause)
    })
    if (!equalBytes(encodedBytes, inputBytes)) {
      return yield* Effect.fail(new ArchitectureBaselineCheckError(
        `validate ${architectureBaselineInputPath}`,
        "schema encode changed the canonical input bytes"
      ))
    }

    const checkedCoordinates = new Set<string>()
    for (const evidence of document.evidenceSources) {
      if (evidence._tag !== "SourceFileEvidence") continue
      // Cross-repository coordinates are exact, schema-bound attestations. The
      // architecture checker must remain runnable from a clean ts-release
      // checkout without cloning another repository or using the network.
      if (evidence.coordinate.repositoryId !== "ts-release") continue
      const key = sourceCoordinateKey(evidence.coordinate)
      if (checkedCoordinates.has(key)) continue
      yield* checkSourceCoordinate(repositoryRoot, evidence.coordinate)
      checkedCoordinates.add(key)
    }

    return { document, checkedSourceCoordinates: checkedCoordinates.size }
  }
)
