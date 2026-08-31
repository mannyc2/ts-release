import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { Effect, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import { checkSourceCoordinate } from "./check-source-coordinate.js"
import {
  decodeOwnershipDecisions,
  encodeOwnershipDecisions,
  ownershipDecisionsReferenceDocument,
  type OwnershipDecisionsV1
} from "./schema/ownership-decisions.js"
import { sourceCoordinateKey, type SourceCoordinate } from "./schema/source-coordinate.js"

export const ownershipDecisionsInputPath =
  "docs/refactor/architecture-program/inputs/ownership-decisions.json"

export class OwnershipDecisionsCheckError extends Schema.TaggedError<OwnershipDecisionsCheckError>()(
  "OwnershipDecisionsCheckError",
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

const collectCoordinates = (
  document: OwnershipDecisionsV1
): ReadonlyArray<SourceCoordinate> => [
  ...document.decisions.flatMap(({ sourceCoordinates }) => sourceCoordinates),
  ...document.blockers.flatMap(({ sourceCoordinates }) => sourceCoordinates),
  ...document.hardCutPartitions.map(({ sourceCoordinate }) => sourceCoordinate),
  ...document.externalCopyInventory.sourceCoordinates,
  ...document.productJournalByteLimit.sourceCoordinates
]

export const checkOwnershipDecisions = Effect.fn("OwnershipDecisionsV1.check")(
  function* (repositoryRoot: string) {
    const inputBytes = yield* Effect.tryPromise({
      try: () => readFile(resolve(repositoryRoot, ownershipDecisionsInputPath)),
      catch: (cause) => new OwnershipDecisionsCheckError(`read ${ownershipDecisionsInputPath}`, cause)
    })
    const parsed = yield* Effect.try({
      try: () => parseCanonicalJsonBytes(inputBytes),
      catch: (cause) => new OwnershipDecisionsCheckError(`parse ${ownershipDecisionsInputPath}`, cause)
    })
    const document = yield* decodeOwnershipDecisions(parsed)
    const encodedBytes = yield* Effect.try({
      try: () => canonicalJsonBytes(encodeOwnershipDecisions(document)),
      catch: (cause) => new OwnershipDecisionsCheckError("encode ownership decisions", cause)
    })
    if (!equalBytes(encodedBytes, inputBytes)) {
      return yield* Effect.fail(new OwnershipDecisionsCheckError(
        `validate ${ownershipDecisionsInputPath}`,
        "schema encode changed the canonical input bytes"
      ))
    }

    const reference = yield* decodeOwnershipDecisions(ownershipDecisionsReferenceDocument)
    const referenceBytes = canonicalJsonBytes(encodeOwnershipDecisions(reference))
    if (!equalBytes(referenceBytes, inputBytes)) {
      return yield* Effect.fail(new OwnershipDecisionsCheckError(
        `validate ${ownershipDecisionsInputPath}`,
        "committed ownership decisions do not match the checked reference contract"
      ))
    }

    const coordinates = new Map<string, SourceCoordinate>()
    for (const coordinate of collectCoordinates(document)) {
      coordinates.set(sourceCoordinateKey(coordinate), coordinate)
    }
    for (const coordinate of coordinates.values()) {
      yield* checkSourceCoordinate(repositoryRoot, coordinate)
    }

    return { document, checkedSourceCoordinates: coordinates.size }
  }
)
