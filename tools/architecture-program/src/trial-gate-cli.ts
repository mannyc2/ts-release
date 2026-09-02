import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { Effect, Result, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import {
  ArchitectureGateObservationV2,
  decodeGateInvocation,
  gateObservationStructureCodec
} from "./schema/harness-protocol.js"
import { ArtifactId } from "./schema/primitives.js"
import { codePointCompare } from "./schema/trial-evidence.js"
import {
  GateCommandInputV2,
  computeGateCommandInputSha256,
  makeGateCommandInput
} from "./schema/trial-result.js"
import {
  decodeArchitectureTrialSpec,
  gateDefinitionSha256
} from "./schema/trial-spec.js"
import {
  TRIAL_GATE_SANDBOX_CANDIDATE_ROOT,
  TRIAL_GATE_SANDBOX_REPOSITORY_ROOT,
  TrialGateContractError,
  inspectGateCandidate,
  invocationMatchesGate,
  loadMachineSourceBudgetAuthority,
  trialGateInspectionFacts
} from "./trial-gate-contract.js"

const TrialGateCommandEnvelope = Schema.Struct({
  commandInput: GateCommandInputV2,
  executionLocal: Schema.Struct({
    inspectionRoot: Schema.Literal(TRIAL_GATE_SANDBOX_CANDIDATE_ROOT)
  })
})
const decodeEnvelopeStructure = Schema.decodeUnknownEffect(
  TrialGateCommandEnvelope,
  { errors: "all", onExcessProperty: "error" }
)

export interface TrialGateCliResult {
  readonly exitCode: number
  readonly stdout: Uint8Array
  readonly stderr: Uint8Array
}

const empty = new Uint8Array()

const failureBytes = (failureIds: ReadonlyArray<string>): Uint8Array => canonicalJsonBytes({
  schemaVersion: "architecture-gate-command-failure-v1",
  failureIds: [...new Set(failureIds)].sort(codePointCompare)
})

const failed = (...failureIds: ReadonlyArray<string>): TrialGateCliResult => ({
  exitCode: 1,
  stdout: empty,
  stderr: failureBytes(failureIds.length === 0
    ? ["gate.command-cli-failed"]
    : failureIds)
})

const exactInput = (
  input: typeof GateCommandInputV2.Type
): boolean => {
  const expected = makeGateCommandInput(input.invocation, input.inspectedTreeSha256)
  return input.inspectedTreeSha256 === input.invocation.candidateTreeSha256 &&
    input.invocationSha256 === expected.invocationSha256 &&
    computeGateCommandInputSha256(input) === computeGateCommandInputSha256(expected)
}

/** Runs the deterministic gate command without reading ambient configuration. */
export const runTrialGateCli = Effect.fn("TrialGateCli.run")(function* (input: {
  readonly argv: ReadonlyArray<string>
  readonly stdin: Uint8Array
  readonly repositoryRoot?: string
  /** Test seam; the live process always uses the envelope's fixed /candidate mount. */
  readonly inspectionRoot?: string
}) {
  if (input.argv.length !== 2 || input.argv[0] !== "--gate") {
    return failed("gate.command-cli-arguments")
  }
  const parsed = yield* Effect.result(Effect.try({
    try: () => parseCanonicalJsonBytes(input.stdin),
    catch: () => new Error("invalid canonical stdin")
  }))
  if (Result.isFailure(parsed)) return failed("gate.command-cli-input-canonical")
  const envelope = yield* Effect.result(decodeEnvelopeStructure(parsed.success))
  if (Result.isFailure(envelope)) return failed("gate.command-cli-input-schema")
  const invocation = yield* Effect.result(decodeGateInvocation(
    envelope.success.commandInput.invocation
  ))
  if (Result.isFailure(invocation) || !exactInput(envelope.success.commandInput)) {
    return failed("gate.command-cli-input-binding")
  }
  if (input.argv[1] !== invocation.success.gateId) {
    return failed("gate.command-cli-gate-mismatch")
  }

  const repositoryRoot = input.repositoryRoot ?? TRIAL_GATE_SANDBOX_REPOSITORY_ROOT
  const trialSpecPath = resolve(
    repositoryRoot,
    "docs/refactor/architecture-program/inputs/trial-spec.json"
  )
  const trialSpec = yield* Effect.result(Effect.gen(function* () {
    const bytes = new Uint8Array(yield* Effect.tryPromise(() => readFile(trialSpecPath)))
    const value = yield* Effect.try({
      try: () => parseCanonicalJsonBytes(bytes),
      catch: () => new Error("invalid canonical trial specification")
    })
    return yield* decodeArchitectureTrialSpec(value)
  }))
  if (Result.isFailure(trialSpec)) return failed("gate.command-cli-trial-spec")
  const gate = trialSpec.success.gateRequirements.find(({ id }) => id === invocation.success.gateId)
  if (gate === undefined || gateDefinitionSha256(gate) !== invocation.success.definitionSha256 ||
    !invocationMatchesGate(invocation.success, gate)) {
    return failed("gate.command-cli-definition")
  }

  const sourceBudgetAuthority = gate.id === "GM05-machine-source-budget"
    ? yield* Effect.result(loadMachineSourceBudgetAuthority(repositoryRoot, trialSpec.success))
    : null
  if (sourceBudgetAuthority !== null && Result.isFailure(sourceBudgetAuthority)) {
    return failed(...(sourceBudgetAuthority.failure instanceof TrialGateContractError
      ? sourceBudgetAuthority.failure.failureIds
      : [ArtifactId.make("gate.runner-source-budget-denominator-unavailable")]))
  }

  const inspection = yield* Effect.result(inspectGateCandidate({
    gate,
    candidateId: invocation.success.candidateId,
    candidateTreeSha256: invocation.success.candidateTreeSha256,
    inspectionRoot: input.inspectionRoot ?? envelope.success.executionLocal.inspectionRoot,
    sourceBudgetAuthority: sourceBudgetAuthority !== null && Result.isSuccess(sourceBudgetAuthority)
      ? sourceBudgetAuthority.success
      : null
  }))
  if (Result.isFailure(inspection)) {
    return failed(...(inspection.failure instanceof TrialGateContractError
      ? inspection.failure.failureIds
      : [ArtifactId.make("gate.command-cli-inspection")]))
  }
  const observation = new ArchitectureGateObservationV2({
    schemaVersion: "architecture-gate-observation-v2",
    runContextSha256: invocation.success.runContextSha256,
    candidateId: invocation.success.candidateId,
    candidateTreeSha256: invocation.success.candidateTreeSha256,
    definitionSha256: invocation.success.definitionSha256,
    gateId: invocation.success.gateId,
    facts: trialGateInspectionFacts(inspection.success)
  })
  return {
    exitCode: 0,
    stdout: canonicalJsonBytes(gateObservationStructureCodec.encode(observation)),
    stderr: empty
  } satisfies TrialGateCliResult
})

if (import.meta.main) {
  const result = await Effect.runPromise(runTrialGateCli({
    argv: process.argv.slice(2),
    stdin: new Uint8Array(await Bun.stdin.arrayBuffer())
  }))
  if (result.stdout.byteLength > 0) process.stdout.write(result.stdout)
  if (result.stderr.byteLength > 0) process.stderr.write(result.stderr)
  process.exit(result.exitCode)
}
