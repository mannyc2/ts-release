import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import { checkArchitectureBaseline } from "./check-baseline.js"
import { checkOwnershipDecisions } from "./check-ownership-decisions.js"
import { checkResearchTraceability } from "./check-research-traceability.js"
import { checkTrialContractOracle } from "./check-trial-contract.js"
import type { SourceCoordinateGitAuthority } from "./check-source-coordinate.js"
import { readStableContainedRegularFile } from "./stable-contained-file.js"
import {
  type ArchitectureTrialSpecV2,
  type SourceAnchor,
  WholeFileSourceAnchor,
  decodeArchitectureTrialSpec,
  encodeArchitectureTrialSpec
} from "./schema/trial-spec.js"

const moduleDirectory = typeof import.meta.dir === "string"
  ? import.meta.dir
  : dirname(fileURLToPath(import.meta.url))

export const defaultRepositoryRoot = resolve(moduleDirectory, "../../..")
export const trialSpecInputPath = "docs/refactor/architecture-program/inputs/trial-spec.json"

export class InputCheckError extends Schema.TaggedError<InputCheckError>()("InputCheckError", {
  operation: Schema.String,
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(
    operation: string,
    sourceCause: unknown
  ) {
    const reason = sourceCause instanceof Error ? sourceCause.message : String(sourceCause)
    super({ operation, reason, message: `${operation}: ${reason}` })
  }
}

const tryPromise = <A>(operation: string, evaluate: () => Promise<A>) =>
  Effect.tryPromise({
    try: evaluate,
    catch: (cause) => new InputCheckError(operation, cause)
  })

const trySync = <A>(operation: string, evaluate: () => A) =>
  Effect.try({
    try: evaluate,
    catch: (cause) => new InputCheckError(operation, cause)
  })

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const lineCount = (bytes: Uint8Array): number => {
  if (bytes.length === 0) return 0
  let lines = 0
  for (const byte of bytes) {
    if (byte === 0x0a) lines += 1
  }
  return bytes[bytes.length - 1] === 0x0a ? lines : lines + 1
}

export const checkSourceAnchor = Effect.fn("ArchitectureTrialSpecV2.checkSourceAnchor")(
  function* (repositoryRoot: string, sourceAnchor: SourceAnchor) {
    const bytes = yield* tryPromise(`read source anchor ${sourceAnchor.path}`, () =>
      readStableContainedRegularFile(repositoryRoot, sourceAnchor.path))
    const actualSha256 = createHash("sha256").update(bytes).digest("hex")
    if (actualSha256 !== sourceAnchor.sha256) {
      return yield* Effect.fail(new InputCheckError(
        `validate source anchor ${sourceAnchor.path}`,
        `sha256 mismatch (expected ${sourceAnchor.sha256}, received ${actualSha256})`
      ))
    }

    if (sourceAnchor._tag === "LineRangeSourceAnchor") {
      const actualLineCount = lineCount(bytes)
      if (sourceAnchor.startLine > sourceAnchor.endLine) {
        return yield* Effect.fail(new InputCheckError(
          `validate source anchor ${sourceAnchor.path}`,
          `line range ${sourceAnchor.startLine}-${sourceAnchor.endLine} is reversed`
        ))
      }
      if (sourceAnchor.endLine > actualLineCount) {
        return yield* Effect.fail(new InputCheckError(
          `validate source anchor ${sourceAnchor.path}`,
          `line range ends at ${sourceAnchor.endLine}, but the file has ${actualLineCount} lines`
        ))
      }
    }
  }
)

export const checkSourceAnchors = Effect.fn("ArchitectureTrialSpecV2.checkSourceAnchors")(
  function* (repositoryRoot: string, spec: ArchitectureTrialSpecV2) {
    for (const authority of spec.authorities) {
      yield* checkSourceAnchor(repositoryRoot, authority.sourceAnchor)
    }
  }
)

export const checkInputBindings = Effect.fn("ArchitectureTrialSpecV2.checkInputBindings")(
  function* (repositoryRoot: string, spec: ArchitectureTrialSpecV2) {
    for (const binding of spec.inputBindings) {
      yield* checkSourceAnchor(repositoryRoot, new WholeFileSourceAnchor({
        path: binding.path,
        sha256: binding.sha256
      }))
    }
  }
)

export const checkInputs = Effect.fn("ArchitectureTrialSpecV2.checkInputs")(
  function* (
    repositoryRoot: string = defaultRepositoryRoot,
    gitAuthority?: SourceCoordinateGitAuthority
  ) {
    const inputPath = resolve(repositoryRoot, trialSpecInputPath)
    const inputBytes = yield* tryPromise(`read ${trialSpecInputPath}`, () => readFile(inputPath))
    const parsed = yield* trySync(`parse ${trialSpecInputPath}`, () => parseCanonicalJsonBytes(inputBytes))
    const spec = yield* decodeArchitectureTrialSpec(parsed)

    yield* checkSourceAnchors(repositoryRoot, spec)
    yield* checkInputBindings(repositoryRoot, spec)

    const encoded = yield* trySync("encode decoded trial specification", () =>
      canonicalJsonBytes(encodeArchitectureTrialSpec(spec)))
    if (!equalBytes(encoded, inputBytes)) {
      return yield* Effect.fail(new InputCheckError(
        `validate ${trialSpecInputPath}`,
        "schema encode changed the canonical input bytes"
      ))
    }

    const trialContract = yield* checkTrialContractOracle(
      repositoryRoot,
      spec,
      encodeArchitectureTrialSpec(spec),
      inputBytes
    )

    const traceability = yield* checkResearchTraceability(repositoryRoot, gitAuthority)
    const ownership = yield* checkOwnershipDecisions(repositoryRoot, gitAuthority)
    const baseline = yield* checkArchitectureBaseline(repositoryRoot, gitAuthority)

    return { trialSpec: spec, trialContract, traceability, ownership, baseline }
  }
)

if (import.meta.main) {
  const cliProgram = checkInputs().pipe(Effect.match({
    onFailure: (error) => ({ _tag: "Failure" as const, error }),
    onSuccess: (spec) => ({ _tag: "Success" as const, spec })
  }))
  Effect.runPromise(cliProgram).then(
    (result) => {
      if (result._tag === "Success") {
        const { baseline, ownership, traceability, trialContract, trialSpec } = result.spec
        console.log(
          `architecture program inputs valid (${trialSpec.authorities.length} trial anchors, ` +
          `${traceability.document.propositions.length} propositions, ` +
          `${traceability.checkedSourceCoordinates} traceability anchors, ` +
          `${ownership.document.decisions.length} ownership decisions, ` +
          `${ownership.document.freezeBlockerIds.length} freeze blockers, ` +
          `${baseline.document.baselines.length} immutable baselines, ` +
          `${baseline.document.candidateBaselines.length} pending candidate baselines, ` +
          `${trialContract.checkedCaseDefinitions} executable cases, ` +
          `${trialContract.checkedProbeDefinitions} executable probes)`
        )
        return
      }
      const rendered = result.error instanceof Error ? result.error.message : String(result.error)
      console.error(`architecture trial inputs invalid: ${rendered.split("\n", 1)[0]}`)
      process.exitCode = 1
    },
    (defect: unknown) => {
      const rendered = defect instanceof Error ? defect.message : String(defect)
      console.error(`architecture trial inputs invalid: ${rendered.split("\n", 1)[0]}`)
      process.exitCode = 1
    }
  )
}
