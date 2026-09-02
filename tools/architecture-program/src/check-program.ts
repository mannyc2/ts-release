import { lstat } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import { checkFreezeBundle } from "./freeze-checker.js"
import {
  FREEZE_ARTIFACT_PATHS,
  type FreezeAuthorityFile,
  type FreezeGenerationRequest
} from "./freeze-generator.js"
import {
  assessFreezeReadiness,
  BlockedFreezeReadinessV1,
  encodeFreezeReadinessReport,
  FreezeReadinessReportV1
} from "./freeze-readiness.js"
import { decodeArchitectureBaseline } from "./schema/baseline.js"
import { decodeFreezeFactSet } from "./schema/freeze-contract.js"
import { decodeOwnershipDecisions } from "./schema/ownership-decisions.js"
import { decodeResearchTraceability } from "./schema/research-traceability.js"
import { decodeTrialResultsAggregate } from "./schema/trial-results-aggregate.js"
import { decodeArchitectureTrialSpec } from "./schema/trial-spec.js"
import { readStableContainedRegularFile } from "./stable-contained-file.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
export const defaultArchitectureProgramRepositoryRoot = resolve(moduleDirectory, "../../..")

const INPUT_PATHS = {
  baseline: "docs/refactor/architecture-program/inputs/baseline.json",
  ownership: "docs/refactor/architecture-program/inputs/ownership-decisions.json",
  traceability: "docs/refactor/architecture-program/inputs/research-traceability.json",
  trialSpec: "docs/refactor/architecture-program/inputs/trial-spec.json",
  trialResults: "docs/refactor/architecture-program/results/trial-results.json"
} as const

export interface CheckArchitectureProgramOptions {
  /**
   * Versioned in-memory authority only. It is deliberately not discovered from
   * an invented repository input path.
   */
  readonly generationRequest?: FreezeGenerationRequest
}

export class ArchitectureProgramCheckError extends Schema.TaggedError<
  ArchitectureProgramCheckError
>()("ArchitectureProgramCheckError", {
  operation: Schema.String,
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(operation: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    super({ operation, reason, message: `${operation}: ${reason}` })
  }
}

export class ArchitectureProgramBlockedError extends Schema.TaggedError<
  ArchitectureProgramBlockedError
>()("ArchitectureProgramBlockedError", {
  report: FreezeReadinessReportV1,
  message: Schema.String
}) {
  constructor(report: BlockedFreezeReadinessV1) {
    super({
      report,
      message: `Architecture program freeze is blocked by ${report.blockers.length} prerequisites`
    })
  }
}

const isMissing = (cause: unknown): boolean =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT"

const readRequired = Effect.fn("ArchitectureProgram.readRequired")(
  function* (repositoryRoot: string, path: string) {
    return yield* Effect.tryPromise({
      try: () => readStableContainedRegularFile(repositoryRoot, path),
      catch: (cause) => new ArchitectureProgramCheckError(`read ${path}`, cause)
    })
  }
)

const readOptional = Effect.fn("ArchitectureProgram.readOptional")(
  function* (repositoryRoot: string, path: string) {
    const exists = yield* Effect.tryPromise({
      try: async () => {
        try {
          await lstat(resolve(repositoryRoot, path))
          return true
        } catch (cause) {
          if (isMissing(cause)) return false
          throw cause
        }
      },
      catch: (cause) => new ArchitectureProgramCheckError(`inspect ${path}`, cause)
    })
    return exists ? yield* readRequired(repositoryRoot, path) : null
  }
)

const decodeCanonical = Effect.fn("ArchitectureProgram.decodeCanonical")(
  function* <A, E>(
    path: string,
    bytes: Uint8Array,
    decode: (input: unknown) => Effect.Effect<A, E>
  ) {
    const input = yield* Effect.try({
      try: () => parseCanonicalJsonBytes(bytes),
      catch: (cause) => new ArchitectureProgramCheckError(`parse ${path}`, cause)
    })
    return yield* decode(input).pipe(Effect.mapError((cause) =>
      new ArchitectureProgramCheckError(`validate ${path}`, cause)))
  }
)

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index])

/** Read-only Step 6 boundary. It reports blockers and never writes a freeze. */
export const checkArchitectureProgram = Effect.fn("ArchitectureProgram.check")(
  function* (
    repositoryRoot: string = defaultArchitectureProgramRepositoryRoot,
    options: CheckArchitectureProgramOptions = {}
  ) {
    const trialSpecBytes = yield* readRequired(repositoryRoot, INPUT_PATHS.trialSpec)
    const baselineBytes = yield* readRequired(repositoryRoot, INPUT_PATHS.baseline)
    const ownershipBytes = yield* readRequired(repositoryRoot, INPUT_PATHS.ownership)
    const traceabilityBytes = yield* readRequired(repositoryRoot, INPUT_PATHS.traceability)
    const resultsBytes = yield* readOptional(repositoryRoot, INPUT_PATHS.trialResults)

    const trialSpec = yield* decodeCanonical(
      INPUT_PATHS.trialSpec,
      trialSpecBytes,
      decodeArchitectureTrialSpec
    )
    const baseline = yield* decodeCanonical(
      INPUT_PATHS.baseline,
      baselineBytes,
      decodeArchitectureBaseline
    )
    const ownership = yield* decodeCanonical(
      INPUT_PATHS.ownership,
      ownershipBytes,
      decodeOwnershipDecisions
    )
    const traceability = yield* decodeCanonical(
      INPUT_PATHS.traceability,
      traceabilityBytes,
      decodeResearchTraceability
    )
    const trialResults = resultsBytes === null
      ? null
      : yield* decodeCanonical(
        INPUT_PATHS.trialResults,
        resultsBytes,
        (input) => decodeTrialResultsAggregate(input, trialSpec)
      )
    if (options.generationRequest !== undefined &&
      (!equalBytes(options.generationRequest.trialSpecBytes, trialSpecBytes) ||
        resultsBytes === null ||
        !equalBytes(options.generationRequest.trialResultsBytes, resultsBytes))) {
      return yield* new ArchitectureProgramCheckError(
        "bind in-memory freeze authority",
        "generation request does not use the exact repository trial spec/results bytes"
      )
    }
    const factSet = options.generationRequest === undefined
      ? null
      : yield* decodeCanonical(
        "in-memory freeze fact set",
        options.generationRequest.factSetBytes,
        decodeFreezeFactSet
      )
    const readiness = assessFreezeReadiness({ baseline, ownership, trialResults, factSet })
    if (readiness._tag === "Blocked") {
      return yield* new ArchitectureProgramBlockedError(readiness)
    }
    if (options.generationRequest === undefined) {
      return yield* new ArchitectureProgramCheckError(
        "check generated freeze",
        "ready authority requires the exact in-memory generation request"
      )
    }
    const freezeFiles: Array<FreezeAuthorityFile> = []
    for (const path of FREEZE_ARTIFACT_PATHS) {
      freezeFiles.push({ path, bytes: yield* readRequired(repositoryRoot, path) })
    }
    const freeze = yield* checkFreezeBundle(options.generationRequest, freezeFiles).pipe(
      Effect.mapError((cause) => new ArchitectureProgramCheckError(
        "check generated freeze",
        cause
      ))
    )
    return { baseline, ownership, traceability, trialSpec, trialResults, readiness, freeze }
  }
)

if (import.meta.main) {
  const outcome = await Effect.runPromise(checkArchitectureProgram().pipe(Effect.match({
    onFailure: (error) => ({ _tag: "Failure" as const, error }),
    onSuccess: (value) => ({ _tag: "Success" as const, value })
  })))
  if (outcome._tag === "Success") {
    console.log(`architecture program valid (${outcome.value.freeze.contractId})`)
  } else if (outcome.error instanceof ArchitectureProgramBlockedError) {
    process.stdout.write(canonicalJsonBytes(encodeFreezeReadinessReport(outcome.error.report)))
    process.exitCode = 1
  } else {
    const rendered = outcome.error instanceof Error
      ? outcome.error.message
      : String(outcome.error)
    console.error(`architecture program invalid: ${rendered.split("\n", 1)[0]}`)
    process.exitCode = 1
  }
}
