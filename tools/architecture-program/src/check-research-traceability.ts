import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { Effect, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import {
  checkSourceCoordinate,
  type SourceCoordinateGitAuthority
} from "./check-source-coordinate.js"
import {
  decodeResearchTraceability,
  encodeResearchTraceability
} from "./schema/research-traceability.js"
import { sourceCoordinateKey } from "./schema/source-coordinate.js"
import { buildResearchTraceabilityDocument } from "./traceability-normalization.js"

export const researchTraceabilityInputPath =
  "docs/refactor/architecture-program/inputs/research-traceability.json"

export class ResearchTraceabilityCheckError extends Schema.TaggedError<ResearchTraceabilityCheckError>()(
  "ResearchTraceabilityCheckError",
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

export const checkResearchTraceability = Effect.fn("ResearchTraceabilityV1.check")(
  function* (repositoryRoot: string, gitAuthority?: SourceCoordinateGitAuthority) {
    const normalizerSource = yield* Effect.tryPromise({
      try: () => readFile(resolve(
        repositoryRoot,
        "tools/architecture-program/src/traceability-normalization.ts"
      ), "utf8"),
      catch: (cause) => new ResearchTraceabilityCheckError("read traceability normalizer", cause)
    })
    if (/from\s+["'][^"']*research-traceability-oracle/u.test(normalizerSource)) {
      return yield* Effect.fail(new ResearchTraceabilityCheckError(
        "validate traceability oracle independence",
        "traceability-normalization.ts must not import the independent audit oracle"
      ))
    }

    const inputBytes = yield* Effect.tryPromise({
      try: () => readFile(resolve(repositoryRoot, researchTraceabilityInputPath)),
      catch: (cause) => new ResearchTraceabilityCheckError(`read ${researchTraceabilityInputPath}`, cause)
    })
    const parsed = yield* Effect.try({
      try: () => parseCanonicalJsonBytes(inputBytes),
      catch: (cause) => new ResearchTraceabilityCheckError(`parse ${researchTraceabilityInputPath}`, cause)
    })
    const document = yield* decodeResearchTraceability(parsed)

    const encodedBytes = yield* Effect.try({
      try: () => canonicalJsonBytes(encodeResearchTraceability(document)),
      catch: (cause) => new ResearchTraceabilityCheckError("encode research traceability", cause)
    })
    if (!equalBytes(encodedBytes, inputBytes)) {
      return yield* Effect.fail(new ResearchTraceabilityCheckError(
        `validate ${researchTraceabilityInputPath}`,
        "schema encode changed the canonical input bytes"
      ))
    }

    const scorecard = yield* Effect.tryPromise({
      try: () => readFile(resolve(repositoryRoot, "docs/refactor/research/launch-scorecard.md"), "utf8"),
      catch: (cause) => new ResearchTraceabilityCheckError("read launch scorecard", cause)
    })
    const normalized = yield* decodeResearchTraceability(buildResearchTraceabilityDocument(scorecard))
    const normalizedBytes = yield* Effect.try({
      try: () => canonicalJsonBytes(encodeResearchTraceability(normalized)),
      catch: (cause) => new ResearchTraceabilityCheckError("encode normalized research traceability", cause)
    })
    if (!equalBytes(normalizedBytes, inputBytes)) {
      return yield* Effect.fail(new ResearchTraceabilityCheckError(
        `validate ${researchTraceabilityInputPath}`,
        "committed traceability does not exactly match the source-ledger normalization"
      ))
    }

    const scorecardLines = scorecard.split("\n")
    for (const proposition of document.propositions) {
      if (proposition.sourceRecordId === null) continue
      const coordinate = proposition.sourceCoordinates[0]
      if (coordinate === undefined || !("startLine" in coordinate)) {
        return yield* Effect.fail(new ResearchTraceabilityCheckError(
          `validate ${proposition.id} scorecard anchor`,
          "product row has no line-range coordinate"
        ))
      }
      const sourceLine = scorecardLines[coordinate.startLine - 1]
      const anchoredSourceId = proposition.id.startsWith("pr21.census.")
        ? /^\| `([^`]+)` \|/u.exec(sourceLine ?? "")?.[1]
        : sourceLine?.split("|", 1)[0]
      if (anchoredSourceId !== proposition.sourceRecordId) {
        return yield* Effect.fail(new ResearchTraceabilityCheckError(
          `validate ${proposition.id} scorecard anchor`,
          `line ${coordinate.startLine} identifies ${anchoredSourceId ?? "no source record"}, expected ${proposition.sourceRecordId}`
        ))
      }
    }

    const checkedCoordinates = new Set<string>()
    for (const proposition of document.propositions) {
      for (const coordinate of proposition.sourceCoordinates) {
        const key = sourceCoordinateKey(coordinate)
        if (checkedCoordinates.has(key)) continue
        yield* checkSourceCoordinate(repositoryRoot, coordinate, gitAuthority)
        checkedCoordinates.add(key)
      }
    }

    return { document, checkedSourceCoordinates: checkedCoordinates.size }
  }
)
