import { REQUIRED_CASE_EXECUTIONS, REQUIRED_PROBE_ACTION_IDS } from "./schema/trial-contract.js"
import {
  type V2CaseId,
  type V2ProbeId,
  V2_CASE_IDS,
  V2_PROBE_IDS
} from "./schema/v2-ids.js"
import { hashCanonicalValue } from "./trial-hash.js"

type TerminalOutcome = "Succeeded" | "Rejected" | "Inconclusive" | "SafeStop"

type EvidenceValue =
  | { readonly _tag: "Boolean"; readonly value: boolean }
  | { readonly _tag: "Integer"; readonly value: number }
  | { readonly _tag: "Sha256"; readonly value: string }
  | { readonly _tag: "Text"; readonly value: string }

interface EvidenceEntry {
  readonly sequence: number
  readonly name: string
  readonly value: EvidenceValue
}

interface FaultScheduleEntry {
  readonly sequence: number
  readonly actionId: string
  readonly occurrence: number
  readonly faultId: string
  readonly parameters: ReadonlyArray<EvidenceEntry>
}

interface TraceStep {
  readonly sequence: number
  readonly actionId: string
  readonly facts: ReadonlyArray<EvidenceEntry>
}

const codePointCompare = (left: string, right: string): number => {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!
    if (difference !== 0) return difference
  }
  return leftPoints.length - rightPoints.length
}

const evidence = (
  entries: ReadonlyArray<readonly [string, EvidenceValue]>
): ReadonlyArray<EvidenceEntry> => [...entries]
  .sort(([left], [right]) => codePointCompare(left, right))
  .map(([name, value], index) => ({ sequence: index + 1, name, value }))

const booleanValue = (value: boolean): EvidenceValue => ({ _tag: "Boolean", value })
const integerValue = (value: number): EvidenceValue => ({ _tag: "Integer", value })
const sha256Value = (value: string): EvidenceValue => ({ _tag: "Sha256", value })
const textValue = (value: string): EvidenceValue => ({ _tag: "Text", value })

export const REQUIRED_CASE_TERMINAL_OUTCOMES: Readonly<Record<V2CaseId, TerminalOutcome>> = {
  "C01-initial-success": "Succeeded",
  "C02-rejection-before-commit": "Rejected",
  "C03-response-loss-satisfied-observation": "Succeeded",
  "C04-response-loss-inconclusive-stop": "Inconclusive",
  "C05-core-git-cas-protected-replay": "Succeeded",
  "C06-explicit-risk-acceptance": "Succeeded",
  "C07-concurrent-runners-single-cas-winner": "Succeeded",
  "C08-request-endpoint-mismatch": "Rejected",
  "C09-supersession-late-evidence": "SafeStop",
  "C10-ambiguous-append-readback": "SafeStop",
  "C11-malformed-provider-graph": "Rejected",
  "C12-external-provider-two-instances": "Succeeded",
  "C13-apple-commit-before-id-loss": "Inconclusive",
  "C14-finalized-file-tree-adoption": "Succeeded",
  "C15-host-dependency-shadowing": "Rejected",
  "C16-journal-bound-symmetry": "SafeStop"
}

const FAULT_ACTIONS: Readonly<Record<string, string>> = {
  "fault.provider-precommit-rejection": "action.prepare-operation",
  "fault.dispatch-response-loss": "action.dispatch-operation",
  "fault.observation-absence": "action.observe-operation",
  "fault.prior-dispatch-response-loss": "action.initialize-operation",
  "fault.prior-inconclusive-operation": "action.initialize-operation",
  "fault.concurrent-cas-contenders": "action.contend-append-cas",
  "fault.request-endpoint-mismatch": "action.verify-request-correspondence",
  "fault.supersession-during-dispatch": "action.dispatch-operation",
  "fault.append-outcome-unknown": "action.append-dispatch-authority",
  "fault.malformed-provider-graph": "action.validate-provider-graph",
  "fault.apple-submission-id-loss": "action.submit-apple-operation",
  "fault.duplicate-artifact-name": "action.adopt-finalized-artifacts",
  "fault.mutable-producer-path": "action.adopt-finalized-artifacts",
  "fault.symlink-traversal": "action.adopt-finalized-artifacts",
  "fault.consumer-host-shadow": "action.attempt-host-shadow",
  "fault.journal-one-byte-over-limit": "action.reject-journal-write-over-limit"
}

const CASE_PROVIDER_KINDS: Partial<Readonly<Record<V2CaseId, string>>> = {
  "C05-core-git-cas-protected-replay": "core-git",
  "C12-external-provider-two-instances": "packed-external",
  "C13-apple-commit-before-id-loss": "apple",
  "C14-finalized-file-tree-adoption": "effect-build",
  "C15-host-dependency-shadowing": "consumer-host"
}

const JOURNAL_APPEND_ACTIONS: ReadonlySet<string> = new Set([
  "action.append-dispatch-authority",
  "action.record-provider-receipt",
  "action.record-precommit-rejection",
  "action.append-risk-acceptance",
  "action.append-supersession",
  "action.append-late-evidence",
  "action.reconcile-ambiguous-append",
  "action.adopt-finalized-artifacts",
  "action.write-journal-at-limit"
])

const DISPATCH_ACTIONS: ReadonlySet<string> = new Set([
  "action.dispatch-operation",
  "action.submit-apple-operation"
])

const successfulObservation = (caseId: V2CaseId): boolean =>
  caseId !== "C04-response-loss-inconclusive-stop" &&
  caseId !== "C13-apple-commit-before-id-loss"

const makeFaultSchedule = (caseId: V2CaseId): ReadonlyArray<FaultScheduleEntry> =>
  REQUIRED_CASE_EXECUTIONS[caseId].faultIds.map((faultId, index) => {
    const actionId = FAULT_ACTIONS[faultId]
    if (actionId === undefined) throw new Error(`Missing injection action for ${faultId}`)
    return {
      sequence: index + 1,
      actionId,
      occurrence: 1,
      faultId,
      parameters: evidence([
        ["fault.inject-once", booleanValue(true)],
        ["fault.seed", sha256Value(hashCanonicalValue(
          "ts-release/architecture-case-fault-seed/v2",
          { caseId, faultId }
        ))]
      ])
    }
  })

const makeExpectedTrace = (caseId: V2CaseId): ReadonlyArray<TraceStep> => {
  const execution = REQUIRED_CASE_EXECUTIONS[caseId]
  const faultSchedule = makeFaultSchedule(caseId)
  let journalRevision = 0
  let providerDispatchCount = 0
  let observationCount = 0
  let resumedFreshRunner = false

  return execution.actionIds.map((actionId, index) => {
    if (JOURNAL_APPEND_ACTIONS.has(actionId)) journalRevision += 1
    if (actionId === "action.observe-operation" && successfulObservation(caseId)) {
      observationCount += 1
      journalRevision += 1
    }
    if (DISPATCH_ACTIONS.has(actionId)) providerDispatchCount += 1
    if (actionId === "action.resume-fresh-runner") resumedFreshRunner = true
    const appliedFaults = faultSchedule.filter((fault) => fault.actionId === actionId)
    const facts: Array<readonly [string, EvidenceValue]> = [
      ["trace.fresh-runner", booleanValue(resumedFreshRunner)],
      ["trace.journal-revision", integerValue(journalRevision)],
      ["trace.observation-count", integerValue(observationCount)],
      ["trace.provider-dispatch-count", integerValue(providerDispatchCount)]
    ]
    for (const fault of appliedFaults) {
      facts.push([`trace.${fault.faultId}`, booleanValue(true)])
    }
    if (index === execution.actionIds.length - 1) {
      facts.push(["trace.terminal-outcome", textValue(REQUIRED_CASE_TERMINAL_OUTCOMES[caseId])])
    }
    return { sequence: index + 1, actionId, facts: evidence(facts) }
  })
}

const makeCaseFixture = (caseId: V2CaseId) => {
  const ordinal = caseId.slice(0, 3).toLowerCase()
  const requestFingerprint = hashCanonicalValue(
    "ts-release/architecture-case-request/v2",
    { caseId, releaseId: `release.${ordinal}`, operationId: `operation.${ordinal}` }
  )
  const inputFacts: Array<readonly [string, EvidenceValue]> = [
    ["fixture.provider-kind", textValue(CASE_PROVIDER_KINDS[caseId] ?? "generic-provider")],
    ["fixture.request-fingerprint", sha256Value(requestFingerprint)],
    ["fixture.start-state", textValue("empty-journal")]
  ]
  if (caseId === "C16-journal-bound-symmetry") {
    inputFacts.push(
      ["journal.has-product-authority", booleanValue(false)],
      ["journal.limit-bytes", integerValue(64)],
      ["journal.limit-source", textValue("trial-fixture")]
    )
  }
  return {
    schemaVersion: "architecture-case-fixture-v2" as const,
    caseId,
    deterministicSeed: hashCanonicalValue("ts-release/architecture-case-seed/v2", caseId),
    releaseId: `release.${ordinal}`,
    operationId: `operation.${ordinal}`,
    requestId: `request.${ordinal}`,
    endpointId: caseId === "C12-external-provider-two-instances"
      ? "external-provider-primary"
      : caseId === "C13-apple-commit-before-id-loss"
        ? "apple-primary"
        : "provider-a-staging",
    initialRevision: 0,
    inputFacts: evidence(inputFacts),
    faultSchedule: makeFaultSchedule(caseId)
  }
}

const makeExpectedEvidence = (caseId: V2CaseId) => {
  const trace = makeExpectedTrace(caseId)
  const finalFacts = trace.at(-1)?.facts ?? []
  const value = (name: string): EvidenceValue => {
    const entry = finalFacts.find((fact) => fact.name === name)
    if (entry === undefined) throw new Error(`Missing final trace fact ${name} for ${caseId}`)
    return entry.value
  }
  return {
    schemaVersion: "architecture-expected-case-evidence-v2" as const,
    caseId,
    trace,
    terminalOutcome: REQUIRED_CASE_TERMINAL_OUTCOMES[caseId],
    facts: evidence([
      ["summary.action-count", integerValue(trace.length)],
      ["summary.fault-count", integerValue(REQUIRED_CASE_EXECUTIONS[caseId].faultIds.length)],
      ["summary.final-journal-revision", value("trace.journal-revision")],
      ["summary.observation-count", value("trace.observation-count")],
      ["summary.provider-dispatch-count", value("trace.provider-dispatch-count")]
    ])
  }
}

export const REQUIRED_CASE_FIXTURES = Object.fromEntries(
  V2_CASE_IDS.map((caseId) => [caseId, makeCaseFixture(caseId)])
) as Readonly<Record<V2CaseId, ReturnType<typeof makeCaseFixture>>>

export const REQUIRED_EXPECTED_CASE_EVIDENCE = Object.fromEntries(
  V2_CASE_IDS.map((caseId) => [caseId, makeExpectedEvidence(caseId)])
) as Readonly<Record<V2CaseId, ReturnType<typeof makeExpectedEvidence>>>

const PROBE_PARAMETERS: Readonly<Record<V2ProbeId, ReadonlyArray<readonly [string, EvidenceValue]>>> = {
  "P01-second-provider-instance": [
    ["change.endpoint-class", textValue("canary")],
    ["change.instance-id", textValue("provider-a-canary")],
    ["change.provider-id", textValue("role-first-party-provider-a")]
  ],
  "P02-packed-external-provider": [
    ["change.instance-id", textValue("external-provider-secondary")],
    ["change.loading", textValue("ordinary-import-and-layer")],
    ["change.provider-id", textValue("role-packed-external-provider")]
  ],
  "P03-new-first-party-provider": [
    ["change.instance-id", textValue("provider-c-primary")],
    ["change.provider-id", textValue("role-first-party-provider-c")]
  ],
  "P04-new-commitment-mechanism": [
    ["change.mechanism-id", textValue("delayed-remote-commitment")],
    ["change.required-authority", textValue("dispatch-authority-event")]
  ],
  "P05-existing-provider-operation": [
    ["change.operation-id", textValue("provider-a.operation.reconcile")],
    ["change.provider-id", textValue("role-first-party-provider-a")]
  ],
  "P06-journal-store-backend": [
    ["change.backend-id", textValue("journal-store.memory-cas")],
    ["change.owner-id", textValue("role-node-host")]
  ],
  "P07-file-tree-producer-adapter": [
    ["change.adapter-id", textValue("effect-build.finalized-tree-v2")],
    ["change.artifact-kind", textValue("finalized-file-and-tree")]
  ],
  "P08-deliberate-public-export": [
    ["change.export-id", textValue("public.trial-deliberate-export")],
    ["change.surface-kind", textValue("runtime-declaration-and-emitted")]
  ],
  "P09-difficult-recovery-transition": [
    ["change.format-id", textValue("format.recovery-transition-v2")],
    ["change.migration-kind", textValue("one-shot-reviewed")]
  ]
}

export const REQUIRED_PROBE_PARAMETER_ENTRIES = Object.fromEntries(
  V2_PROBE_IDS.map((probeId) => [probeId, evidence(PROBE_PARAMETERS[probeId])])
) as Readonly<Record<V2ProbeId, ReadonlyArray<EvidenceEntry>>>

export const REQUIRED_PROBE_CHANGE_IDS = Object.fromEntries(
  V2_PROBE_IDS.map((probeId) => [probeId, `${probeId}-runner-owned-change`])
) as Readonly<Record<V2ProbeId, string>>

export const requiredProbeActionId = (probeId: V2ProbeId): string =>
  REQUIRED_PROBE_ACTION_IDS[probeId]
