import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson, hashCanonical } from "../model/canonical.js"
import { ArtifactRef, type ArtifactBundle } from "../release/artifact-bundle.js"
import {
  AuthorizationIdentity,
  DispatchId,
  DispatchRejectedBeforeCommit,
  DispatchStarted,
  EndpointIdentity,
  JournalRevisionMismatch,
  JournalStore,
  ObservationRecorded,
  ReceiptAccepted,
  RequestFingerprint,
  TransportId,
  type CanonicalJson,
  type JournalEvent,
  type ReleaseJournal
} from "../release/journal.js"
import {
  deriveReleaseReport,
  type ObservationClassifier,
  type ObservationConclusion
} from "../release/release-report.js"
import {
  OperationId,
  ProviderDefinitionId,
  decodeProviderIntent,
  encodeReleasePlan,
  type PlannedOperationV1,
  type ReleasePlanV1
} from "../release/release-plan.js"
import {
  NpmCliExitUnsuccessful,
  NpmCliReportedPackage,
  NpmDispatchRejectedBeforeStart,
  NpmDispatchResultUnavailable,
  NpmObservationFailed,
  NpmObservationInconclusive,
  NpmNotObserved,
  NpmPublishDefinition,
  NpmPublishIntent,
  NpmPublishReceipt,
  NpmPublishedDifferent,
  NpmPublishedExact,
  NpmPublicationObservation,
  dispatchNpm,
  npmCliVersion,
  npmPublishArgv,
  observeNpm,
  prepareNpmDispatch,
  prepareNpmPublishRequest,
  type NpmDispatchError,
  type PreparedNpmDispatch,
  type PreparedNpmPublishRequest
} from "./npm-native.js"

const NpmPossibleDispatchError = Schema.Union([
  NpmDispatchResultUnavailable,
  NpmCliExitUnsuccessful
])
type NpmPossibleDispatchError = typeof NpmPossibleDispatchError.Type

/** Provider-native evidence captured when dispatch truth was already uncertain. */
export class NpmAmbiguousDispatchObserved
  extends Schema.TaggedClass<NpmAmbiguousDispatchObserved>()("NpmAmbiguousDispatchObserved", {
    schemaVersion: Schema.Literal("npm-ambiguous-dispatch/v1"),
    dispatchError: NpmPossibleDispatchError,
    observation: NpmPublicationObservation
  }) {}

export class NpmAmbiguousDispatchObservationFailed
  extends Schema.TaggedClass<NpmAmbiguousDispatchObservationFailed>()(
    "NpmAmbiguousDispatchObservationFailed",
    {
      schemaVersion: Schema.Literal("npm-ambiguous-dispatch/v1"),
      dispatchError: NpmPossibleDispatchError,
      observationError: NpmObservationFailed
    }
  ) {}

export class NpmOperationInputError
  extends Schema.TaggedErrorClass<NpmOperationInputError>()("NpmOperationInputError", {
    reason: Schema.NonEmptyString
  }) {}

export interface ExecuteNpmOperationInput {
  readonly bundle: ArtifactBundle
  readonly plan: ReleasePlanV1
  readonly operationId: OperationId
  /** Caller-owned durable identity and clock facts; no ambient random/clock reads occur. */
  readonly dispatchId: DispatchId
  readonly startedAtEpochMillis: number
  readonly recordedAtEpochMillis: number
}

export type NpmJournalAction =
  | "dispatch"
  | "observe"
  | "complete"
  | "conflict"
  | "stop"

type DecodedNpmObservation =
  | typeof NpmPublicationObservation.Type
  | NpmAmbiguousDispatchObserved
  | NpmAmbiguousDispatchObservationFailed
  | NpmObservationFailed

const observationDecoders: ReadonlyArray<(value: CanonicalJson) => DecodedNpmObservation> = [
  (value) => Schema.decodeUnknownSync(NpmPublicationObservation, { onExcessProperty: "error" })(value),
  (value) => Schema.decodeUnknownSync(NpmAmbiguousDispatchObserved, { onExcessProperty: "error" })(value),
  (value) => Schema.decodeUnknownSync(NpmAmbiguousDispatchObservationFailed, { onExcessProperty: "error" })(value),
  (value) => Schema.decodeUnknownSync(NpmObservationFailed, { onExcessProperty: "error" })(value)
]

const decodeObservation = (value: CanonicalJson): DecodedNpmObservation | undefined => {
  for (const decode of observationDecoders) {
    try {
      return decode(value)
    } catch {
      // Each provider owns its durable values; only npm codecs are accepted here.
    }
  }
  return undefined
}

const underlyingObservation = (
  value: DecodedNpmObservation
): typeof NpmPublicationObservation.Type | NpmObservationFailed =>
  value instanceof NpmAmbiguousDispatchObserved
    ? value.observation
    : value instanceof NpmAmbiguousDispatchObservationFailed
    ? value.observationError
    : value

const assertObservationCorrespondence = (
  request: PreparedNpmPublishRequest,
  decoded: DecodedNpmObservation
): void => {
  const observation = underlyingObservation(decoded)
  if (observation instanceof NpmPublishedExact) {
    if (observation.integrity !== request.tarball.integrity ||
        observation.shasum !== request.tarball.shasum ||
        observation.distTagVersion !== request.intent.version) {
      throw new Error("The exact npm observation does not correspond to the admitted request.")
    }
    return
  }
  if (observation instanceof NpmPublishedDifferent) {
    const expected = {
      name: request.intent.packageName.toString(),
      version: request.intent.version.toString(),
      integrity: request.tarball.integrity.toString(),
      shasum: request.tarball.shasum.toString(),
      "dist-tag": request.intent.version.toString()
    } as const
    for (const item of observation.differences) {
      if (item.expected !== expected[item.field]) {
        throw new Error(`The npm ${item.field} difference does not correspond to the admitted request.`)
      }
    }
  }
}

const observationConclusion = (
  value: CanonicalJson,
  request: PreparedNpmPublishRequest
): ObservationConclusion | undefined => {
  const decoded = decodeObservation(value)
  if (decoded === undefined) return undefined
  try {
    assertObservationCorrespondence(request, decoded)
  } catch {
    return undefined
  }
  const observation = underlyingObservation(decoded)
  if (observation instanceof NpmPublishedExact) return "satisfied"
  if (observation instanceof NpmPublishedDifferent) {
    return observation.differences.some((item) => item.field !== "dist-tag")
      ? "conflict"
      : "inconclusive"
  }
  if (observation instanceof NpmNotObserved ||
      observation instanceof NpmObservationInconclusive ||
      observation instanceof NpmObservationFailed) return "inconclusive"
  return undefined
}

/** Provider-local pure projection bound to the exact admitted request. */
export const makeNpmObservationClassifier = (
  request: PreparedNpmPublishRequest
): ObservationClassifier => ({ operation, observation }) =>
    operation.intent.providerDefinitionId === NpmPublishDefinition.definitionId &&
      operation.intent.intentSchemaVersion === NpmPublishDefinition.intentSchemaVersion
      ? observationConclusion(observation.observation, request)
      : undefined

const operationHistory = (
  journal: ReleaseJournal,
  operationId: OperationId
) => journal.entries.filter((entry) =>
  entry.event._tag !== "PlanSuperseded" && entry.event.operationId === operationId)

/** Pure journal fold. Absence and inconclusive reads are an honest stop, never replay authority. */
export const decideNpmJournalAction = (
  journal: ReleaseJournal,
  operationId: OperationId,
  request: PreparedNpmPublishRequest
): NpmJournalAction => {
  const history = operationHistory(journal, operationId)
  const starts = history.filter((entry) => entry.event instanceof DispatchStarted)
  if (starts.length === 0) {
    return journal.entries.some((entry) => entry.event._tag === "PlanSuperseded") ? "stop" : "dispatch"
  }
  if (starts.length > 1) return "stop"
  if (history.some((entry) => entry.event instanceof ReceiptAccepted)) return "complete"
  if (history.some((entry) => entry.event instanceof DispatchRejectedBeforeCommit)) return "stop"
  const latestObservation = [...history].reverse()
    .find((entry) => entry.event instanceof ObservationRecorded)
  if (latestObservation?.event instanceof ObservationRecorded) {
    const conclusion = observationConclusion(latestObservation.event.observation, request)
    if (conclusion === "satisfied") return "complete"
    if (conclusion === "conflict") return "conflict"
    const priorConclusive = [...history].reverse()
      .filter((entry) => entry.revision < latestObservation.revision)
      .map((entry) => entry.event instanceof ObservationRecorded
        ? observationConclusion(entry.event.observation, request)
        : undefined)
      .find((candidate) => candidate === "satisfied" || candidate === "conflict")
    if (priorConclusive === "satisfied") return "complete"
    if (priorConclusive === "conflict") return "conflict"
    return "stop"
  }
  return "observe"
}

const encodedReceipt = (receipt: NpmPublishReceipt): CanonicalJson =>
  Schema.encodeSync(NpmPublishReceipt)(receipt) as CanonicalJson

const encodedRejection = (rejection: NpmDispatchRejectedBeforeStart): CanonicalJson =>
  Schema.encodeSync(NpmDispatchRejectedBeforeStart)(rejection) as CanonicalJson

const encodedObservation = (
  observation:
    | typeof NpmPublicationObservation.Type
    | NpmAmbiguousDispatchObserved
    | NpmAmbiguousDispatchObservationFailed
    | NpmObservationFailed
): CanonicalJson => {
  if (observation instanceof NpmAmbiguousDispatchObserved) {
    return Schema.encodeSync(NpmAmbiguousDispatchObserved)(observation) as CanonicalJson
  }
  if (observation instanceof NpmAmbiguousDispatchObservationFailed) {
    return Schema.encodeSync(NpmAmbiguousDispatchObservationFailed)(observation) as CanonicalJson
  }
  if (observation instanceof NpmObservationFailed) {
    return Schema.encodeSync(NpmObservationFailed)(observation) as CanonicalJson
  }
  return Schema.encodeSync(NpmPublicationObservation)(observation) as CanonicalJson
}

const requestFingerprint = (
  operation: PlannedOperationV1,
  request: PreparedNpmPublishRequest
): RequestFingerprint => RequestFingerprint.make(hashCanonical("ts-release/npm-prepared-request/1", {
  operationId: operation.operationId,
  providerDefinitionId: operation.intent.providerDefinitionId,
  intentSchemaVersion: operation.intent.intentSchemaVersion,
  npmCliVersion,
  intent: Schema.encodeSync(NpmPublishIntent)(request.intent),
  argv: npmPublishArgv(request.intent, "<scoped-tarball>", "<scoped-userconfig>"),
  tarball: {
    artifact: Schema.encodeSync(ArtifactRef)(request.intent.artifact),
    byteLength: request.tarball.byteLength,
    filename: request.tarball.filename,
    shasum: request.tarball.shasum,
    integrity: request.tarball.integrity
  }
}))

const prepareOperation = Effect.fn("NpmOperation.prepare")(function*(input: ExecuteNpmOperationInput) {
  yield* encodeReleasePlan({ plan: input.plan, bundle: input.bundle })
  const operation = input.plan.operations.find((candidate) => candidate.operationId === input.operationId)
  if (operation === undefined) {
    return yield* new NpmOperationInputError({
      reason: `Plan ${input.plan.planId} has no operation ${input.operationId}.`
    })
  }
  const intent = yield* decodeProviderIntent({
    definition: NpmPublishDefinition,
    intent: operation.intent
  })
  const artifact = yield* input.bundle.resolve(intent.artifact)
  const request = yield* prepareNpmPublishRequest(intent, {
    artifact: intent.artifact,
    bytes: artifact.bytes
  })
  return { operation, request, artifactBytes: artifact.bytes }
})

const assertReceiptCorrespondence = (
  request: PreparedNpmPublishRequest,
  value: CanonicalJson
): void => {
  const receipt = Schema.decodeUnknownSync(NpmPublishReceipt, { onExcessProperty: "error" })(value)
  const accepted = receipt.acceptedIntentFacts
  const reported = receipt.cliReportedFacts
  if (accepted.origin !== request.intent.registryUrl ||
      accepted.packageName !== request.intent.packageName ||
      accepted.version !== request.intent.version ||
      accepted.initialTag !== request.intent.distTag ||
      accepted.access !== request.intent.access ||
      (reported instanceof NpmCliReportedPackage && (
        reported.name !== request.intent.packageName ||
        reported.version !== request.intent.version ||
        reported.id !== `${request.intent.packageName}@${request.intent.version}` ||
        reported.size !== request.tarball.byteLength ||
        reported.filename !== request.tarball.filename ||
        reported.shasum !== request.tarball.shasum ||
        reported.integrity !== request.tarball.integrity
      ))) {
    throw new Error("The durable npm receipt does not correspond to the current prepared request.")
  }
}

const assertDispatchCorrespondence = (
  dispatch: DispatchStarted,
  operation: PlannedOperationV1,
  request: PreparedNpmPublishRequest
): void => {
  if (dispatch.operationId !== operation.operationId ||
      dispatch.providerDefinitionId !== NpmPublishDefinition.definitionId ||
      dispatch.transportId !== `npm-cli/${npmCliVersion}` ||
      dispatch.endpointIdentity.toString() !== request.intent.registryUrl.toString() ||
      dispatch.authorizationIdentity.toString() !== request.intent.authorization.identity.toString() ||
      dispatch.requestFingerprint !== requestFingerprint(operation, request) ||
      dispatch.attempt !== 1 ||
      encodeCanonicalJson(dispatch.replayProtection) !==
        encodeCanonicalJson({ scheme: "replay.none/1" }) ||
      encodeCanonicalJson(dispatch.replayBasis) !==
        encodeCanonicalJson({ reason: "npm publish has no trusted automatic replay law" })) {
    throw new Error("The durable npm dispatch does not correspond to the current plan and prepared request.")
  }
}

const validateNpmHistory = (
  journal: ReleaseJournal,
  operation: PlannedOperationV1,
  request: PreparedNpmPublishRequest
): void => {
  const history = operationHistory(journal, operation.operationId)
  const dispatches = history.filter((entry) => entry.event instanceof DispatchStarted)
  if (dispatches.length > 1) throw new Error("npm replay.none/1 permits at most one durable dispatch.")
  for (const entry of history) {
    const event = entry.event
    if (event instanceof DispatchStarted) {
      assertDispatchCorrespondence(event, operation, request)
    } else if (event instanceof ReceiptAccepted) {
      assertReceiptCorrespondence(request, event.receipt)
    } else if (event instanceof DispatchRejectedBeforeCommit) {
      Schema.decodeUnknownSync(NpmDispatchRejectedBeforeStart, { onExcessProperty: "error" })(event.rejection)
    } else if (event instanceof ObservationRecorded) {
      if (event.dispatchId === undefined) {
        throw new Error("npm journal v1 observations must be linked to a durable dispatch.")
      }
      const observation = decodeObservation(event.observation)
      if (observation === undefined) {
        throw new Error("The npm operation journal contains an observation with no npm v1 codec.")
      }
      assertObservationCorrespondence(request, observation)
    }
  }
}

const validateJournal = Effect.fn("NpmOperation.validateJournal")(function*(input: {
  readonly bundle: ArtifactBundle
  readonly plan: ReleasePlanV1
  readonly journal: ReleaseJournal
  readonly operation: PlannedOperationV1
  readonly request: PreparedNpmPublishRequest
}) {
  yield* deriveReleaseReport({
    bundle: input.bundle,
    plan: input.plan,
    journal: input.journal,
    classifyObservation: makeNpmObservationClassifier(input.request)
  })
  yield* Effect.try({
    try: () => validateNpmHistory(input.journal, input.operation, input.request),
    catch: (cause) => new NpmOperationInputError({
      reason: cause instanceof Error ? cause.message : String(cause)
    })
  })
})

type EvidenceKind = "receipt" | "rejection" | "observation"

/** CAS-loops only local evidence. It never repeats or authorizes a provider mutation. */
const appendEvidence = Effect.fn("NpmOperation.appendEvidence")(function*(input: {
  readonly plan: ReleasePlanV1
  readonly bundle: ArtifactBundle
  readonly operation: PlannedOperationV1
  readonly request: PreparedNpmPublishRequest
  readonly dispatchId: DispatchId
  readonly kind: EvidenceKind
  readonly event: JournalEvent
}) {
  const store = yield* JournalStore
  while (true) {
    const current = yield* store.read(input.plan.planId)
    yield* validateJournal({ ...input, journal: current })
    const history = operationHistory(current, input.operation.operationId)
    const dispatch = history.find((entry) =>
      entry.event instanceof DispatchStarted && entry.event.dispatchId === input.dispatchId)?.event
    if (!(dispatch instanceof DispatchStarted)) {
      return yield* new NpmOperationInputError({
        reason: `Cannot append npm evidence for unknown dispatch ${input.dispatchId}.`
      })
    }
    const receipt = history.find((entry) =>
      entry.event instanceof ReceiptAccepted && entry.event.dispatchId === input.dispatchId)
    const rejection = history.find((entry) =>
      entry.event instanceof DispatchRejectedBeforeCommit && entry.event.dispatchId === input.dispatchId)
    if (input.kind === "observation" && (receipt !== undefined || rejection !== undefined)) {
      return current
    }
    if (input.kind === "receipt" && receipt !== undefined) return current
    if (input.kind === "rejection" && rejection !== undefined) return current
    if ((input.kind === "receipt" && rejection !== undefined) ||
        (input.kind === "rejection" && receipt !== undefined)) {
      return yield* new NpmOperationInputError({
        reason: `Dispatch ${input.dispatchId} already has contradictory terminal evidence.`
      })
    }

    const appended = yield* Effect.result(
      store.appendIfRevision(input.plan.planId, current.revision, input.event)
    )
    if (Result.isSuccess(appended)) return yield* store.read(input.plan.planId)
    if (appended.failure instanceof JournalRevisionMismatch) continue
    return yield* appended.failure
  }
})

const observeAndAppend = Effect.fn("NpmOperation.observeAndAppend")(function*(input: {
  readonly bundle: ArtifactBundle
  readonly plan: ReleasePlanV1
  readonly operation: PlannedOperationV1
  readonly dispatchId: DispatchId
  readonly recordedAtEpochMillis: number
  readonly request: PreparedNpmPublishRequest
  readonly dispatchError?: NpmPossibleDispatchError
}) {
  const result = yield* Effect.result(observeNpm(input.request))
  const evidence = Result.isSuccess(result)
    ? input.dispatchError === undefined
      ? result.success
      : NpmAmbiguousDispatchObserved.make({
        schemaVersion: "npm-ambiguous-dispatch/v1",
        dispatchError: input.dispatchError,
        observation: result.success
      })
    : input.dispatchError === undefined
    ? result.failure
    : NpmAmbiguousDispatchObservationFailed.make({
      schemaVersion: "npm-ambiguous-dispatch/v1",
      dispatchError: input.dispatchError,
      observationError: result.failure
    })
  return yield* appendEvidence({
    ...input,
    kind: "observation",
    event: ObservationRecorded.make({
      schemaVersion: 1,
      operationId: input.operation.operationId,
      dispatchId: input.dispatchId,
      observation: encodedObservation(evidence),
      recordedAtEpochMillis: input.recordedAtEpochMillis
    })
  })
})

const appendDispatchResult = Effect.fn("NpmOperation.appendDispatchResult")(function*(input: {
  readonly bundle: ArtifactBundle
  readonly plan: ReleasePlanV1
  readonly operation: PlannedOperationV1
  readonly dispatchId: DispatchId
  readonly recordedAtEpochMillis: number
  readonly request: PreparedNpmPublishRequest
  readonly preparedDispatch: PreparedNpmDispatch
}) {
  const result = yield* Effect.result(dispatchNpm(input.preparedDispatch))
  if (Result.isSuccess(result)) {
    return yield* appendEvidence({
      ...input,
      kind: "receipt",
      event: ReceiptAccepted.make({
        schemaVersion: 1,
        operationId: input.operation.operationId,
        dispatchId: input.dispatchId,
        receipt: encodedReceipt(result.success),
        recordedAtEpochMillis: input.recordedAtEpochMillis
      })
    })
  }

  const error: NpmDispatchError = result.failure
  if (error instanceof NpmDispatchRejectedBeforeStart) {
    return yield* appendEvidence({
      ...input,
      kind: "rejection",
      event: DispatchRejectedBeforeCommit.make({
        schemaVersion: 1,
        operationId: input.operation.operationId,
        dispatchId: input.dispatchId,
        rejection: encodedRejection(error),
        recordedAtEpochMillis: input.recordedAtEpochMillis
      })
    })
  }

  return yield* observeAndAppend({ ...input, dispatchError: error })
})

/**
 * Explicit approval boundary for one npm operation. Planning never calls it.
 * A durable DispatchStarted CAS wins before the client can run; every later
 * invocation observes once or returns existing history and never resends.
 */
export const executeNpmOperation = Effect.fn("NpmOperation.execute")(function*(
  input: ExecuteNpmOperationInput
) {
  const prepared = yield* prepareOperation(input)
  const store = yield* JournalStore
  const journal = yield* store.read(input.plan.planId)
  yield* validateJournal({ ...prepared, ...input, journal })
  const action = decideNpmJournalAction(journal, input.operationId, prepared.request)
  if (action === "complete" || action === "conflict" || action === "stop") return journal

  if (action === "observe") {
    const dispatch = [...operationHistory(journal, input.operationId)].reverse()
      .find((entry) => entry.event instanceof DispatchStarted)?.event
    if (!(dispatch instanceof DispatchStarted)) {
      return yield* new NpmOperationInputError({ reason: "npm observation has no durable dispatch." })
    }
    return yield* observeAndAppend({
      bundle: input.bundle,
      plan: input.plan,
      operation: prepared.operation,
      dispatchId: dispatch.dispatchId,
      recordedAtEpochMillis: input.recordedAtEpochMillis,
      request: prepared.request
    })
  }

  return yield* Effect.scoped(Effect.gen(function*() {
    // Version, authorization identity, userconfig, and exact owned bytes are
    // preflighted and materialized before the durable admission record.
    const preparedDispatch = yield* prepareNpmDispatch(prepared.request, prepared.artifactBytes)
    const started = DispatchStarted.make({
      schemaVersion: 1,
      operationId: input.operationId,
      dispatchId: input.dispatchId,
      attempt: 1,
      providerDefinitionId: ProviderDefinitionId.make(NpmPublishDefinition.definitionId),
      transportId: TransportId.make(`npm-cli/${npmCliVersion}`),
      endpointIdentity: EndpointIdentity.make(prepared.request.intent.registryUrl.toString()),
      requestFingerprint: requestFingerprint(prepared.operation, prepared.request),
      authorizationIdentity: AuthorizationIdentity.make(
        prepared.request.intent.authorization.identity.toString()
      ),
      replayProtection: { scheme: "replay.none/1" },
      replayBasis: { reason: "npm publish has no trusted automatic replay law" },
      startedAtEpochMillis: input.startedAtEpochMillis
    })

    while (true) {
      const latest = yield* store.read(input.plan.planId)
      yield* validateJournal({ ...prepared, ...input, journal: latest })
      if (decideNpmJournalAction(latest, input.operationId, prepared.request) !== "dispatch") return latest

      if (latest.entries.some((entry) =>
        entry.event instanceof DispatchStarted && entry.event.dispatchId === input.dispatchId)) {
        return yield* new NpmOperationInputError({
          reason: `Journal already contains dispatch id ${input.dispatchId}.`
        })
      }

      const admitted = yield* Effect.result(
        store.appendIfRevision(input.plan.planId, latest.revision, started)
      )
      if (Result.isSuccess(admitted)) break
      if (admitted.failure instanceof JournalRevisionMismatch) continue
      return yield* admitted.failure
    }

    return yield* appendDispatchResult({
      bundle: input.bundle,
      plan: input.plan,
      operation: prepared.operation,
      dispatchId: input.dispatchId,
      recordedAtEpochMillis: input.recordedAtEpochMillis,
      request: prepared.request,
      preparedDispatch
    })
  }))
})
