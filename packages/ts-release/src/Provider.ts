import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  CoreDispatchError,
  CoreUndecodableReceipt,
  ObservationRecorded,
  ObservationStatus,
  Operation,
  type JournalEvent,
  type Plan,
  RequestFacts,
} from "./internal/ReleaseModel.js"
import { ReleaseError, attempt, fail } from "./internal/Error.js"
import { canonical, decodeOwned, freeze, hashCanonical, sha256 } from "./internal/Identity.js"

/** Provider contract version spoken by this kernel. A definition built against another contract is rejected at Host verification, whatever the installer resolved. */
export const PROVIDER_CONTRACT = "ts-release/provider/1" as const
/** Transport owns actual sends; prepare and durable values contain no callback. */
export interface PreparedRequest {
  readonly facts: RequestFacts
  readonly body: Uint8Array
}
export type SendResult =
  | {
      readonly _tag: "Accepted"
      readonly receipt: unknown
    }
  | {
      readonly _tag: "RejectedBeforeCommit"
      readonly proof: unknown
    }
  | {
      readonly _tag: "Unknown"
      readonly reason: string
      readonly nativeError?: unknown
    }
export interface Transport {
  readonly send: (request: PreparedRequest) => Effect.Effect<SendResult, ReleaseError>
  /** Resolve ephemeral credentials before the journal uncertainty boundary.
   * The returned send has no dispatch permission; only fresh core CAS grants it. */
  readonly prepare?: (request: PreparedRequest) => Effect.Effect<Transport["send"], ReleaseError>
}
export interface Observation {
  readonly status: ObservationStatus
  readonly evidence: unknown
}
export interface OperationEvidence {
  readonly operation: Operation
  readonly receipts: ReadonlyArray<unknown>
  readonly observations: ReadonlyArray<Observation>
}
export interface ProviderContext {
  readonly own: OperationEvidence
  readonly dependencies: ReadonlyArray<OperationEvidence>
}
export interface NativeFailureBoundary {
  readonly version: string
  readonly codec: Schema.Codec<unknown, unknown>
  readonly corresponds: (operation: Operation, request: RequestFacts, evidence: unknown) => boolean
}
export interface ProviderDefinition {
  readonly contract: typeof PROVIDER_CONTRACT
  readonly definitionId: string
  readonly intentVersion: string
  readonly intentCodec: Schema.Codec<unknown, unknown>
  /** Pure complete-graph admission, before storage, reads, credentials or sends. */
  readonly validatePlan?: (operations: ReadonlyArray<Operation>) => void
  /** Pure binding to already-validated declared dependency evidence. No dispatch permission. */
  readonly requestCorresponds?: (
    operation: Operation,
    request: RequestFacts,
    context: ProviderContext,
  ) => boolean
  readonly receiptVersion: string
  readonly receiptCodec: Schema.Codec<unknown, unknown>
  readonly receiptCorresponds: (
    operation: Operation,
    request: RequestFacts,
    receipt: unknown,
  ) => boolean
  readonly classifyReceipt: (
    operation: Operation,
    request: RequestFacts,
    receipt: unknown,
  ) => "Satisfied" | "Pending"
  readonly dispatchError?: NativeFailureBoundary
  readonly rejection?: NativeFailureBoundary
  readonly observationVersion?: string
  readonly observationCodec?: Schema.Codec<unknown, unknown>
  readonly classifyObservation?: (
    operation: Operation,
    evidence: unknown,
    acceptedReceipts: ReadonlyArray<unknown>,
    context: ProviderContext,
  ) => ObservationStatus
  readonly prepare: (
    operation: Operation,
    context: ProviderContext,
  ) => Effect.Effect<PreparedRequest, ReleaseError>
  readonly observe?: (
    operation: Operation,
    context: ProviderContext,
  ) => Effect.Effect<Observation, ReleaseError>
}
export type ProviderDescriptor = Pick<
  ProviderDefinition,
  "definitionId" | "intentVersion" | "intentCodec" | "validatePlan"
>
/** A projection of a validated prefix only; later events cannot justify earlier requests. */
export const evidenceContext = (
  plan: Plan,
  operation: Operation,
  history: ReadonlyArray<JournalEvent>,
): ProviderContext => {
  const events = history.filter((event) => event.planId === plan.planId)
  const evidenceFor = (operation: Operation): OperationEvidence => {
    const starts = new Set(
      events.flatMap(({ body }) =>
        body._tag === "DispatchStarted" && body.operationId === operation.operationId
          ? [body.dispatchId]
          : [],
      ),
    )
    return {
      operation,
      receipts: events.flatMap(({ body }) =>
        body._tag === "ReceiptAccepted" && starts.has(body.dispatchId) ? [body.receipt] : [],
      ),
      observations: events.flatMap(({ body }) =>
        body._tag === "ObservationRecorded" && body.operationId === operation.operationId
          ? [{ status: body.status, evidence: body.evidence }]
          : [],
      ),
    }
  }
  return freeze({
    own: evidenceFor(operation),
    dependencies: operation.dependsOn.map((id) => {
      const dependency = plan.operations.find((item) => item.operationId === id)
      if (!dependency) fail("missing-dependency", "Evidence dependency is not in this plan")
      return evidenceFor(dependency)
    }),
  })
}
export type Json = Schema.Json
export type OperationId = string
export type Author<A> = (
  input: A,
  dependsOn?: readonly OperationId[],
) => Effect.Effect<Operation, ReleaseError>
export const requestFingerprint = (facts: RequestFacts) =>
  hashCanonical("ts-release/request/1", facts)
export const makeRequest = Effect.fn("ts-release.makeRequest")(function* (
  input: Omit<typeof RequestFacts.Type, "bodyDigest" | "byteLength"> & {
    readonly body: Uint8Array
  },
) {
  const { body, fields } = yield* attempt(() => {
    const body = new Uint8Array(input.body)
    const { body: _, ...fields } = input
    return {
      body,
      fields: decodeOwned(RequestFacts, {
        ...fields,
        bodyDigest: "",
        byteLength: String(body.byteLength),
      }),
    }
  })
  const bodyDigest = yield* sha256(body)
  const facts = yield* attempt(() =>
    decodeOwned(RequestFacts, {
      ...fields,
      bodyDigest,
      byteLength: String(body.byteLength),
    }),
  )
  return { facts, body } satisfies PreparedRequest
})
export const verifyRequest = Effect.fn("ts-release.verifyRequest")(function* (
  request: PreparedRequest,
) {
  const { facts, body } = yield* attempt(() => ({
    facts: decodeOwned(RequestFacts, request.facts),
    body: new Uint8Array(request.body),
  }))
  if (facts.byteLength !== String(body.byteLength) || facts.bodyDigest !== (yield* sha256(body)))
    return yield* new ReleaseError({
      code: "request-bytes",
      message: "Prepared bytes do not match recorded facts",
    })
  yield* attempt(() => {
    canonical(facts)
    for (const [name] of facts.headers) {
      if (
        /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token)$/iu.test(
          name,
        )
      )
        fail(
          "secret-header",
          "Authentication header bytes must remain in the host transport closure",
        )
    }
    if (
      facts.replay._tag === "GitCas" &&
      (facts.transport !== "core.git/1" || facts.method !== "update-ref")
    )
      fail(
        "untrusted-replay",
        "Only core conditional Git updates can carry structural replay protection",
      )
  })
  return { facts, body } satisfies PreparedRequest
})
export const CORE_ERROR_VERSIONS = new Set<string>([
  "core-dispatch-error/1",
  "core-undecodable-receipt/1",
])
export const isCoreErrorVersion = (version: string): boolean => CORE_ERROR_VERSIONS.has(version)
export const verifyDescriptor = (provider: ProviderDescriptor): void => {
  if (
    typeof provider.definitionId !== "string" ||
    !provider.definitionId ||
    typeof provider.intentVersion !== "string" ||
    !provider.intentVersion ||
    !Schema.isSchema(provider.intentCodec) ||
    (provider.validatePlan !== undefined && typeof provider.validatePlan !== "function")
  )
    fail("intent-codec", "Provider identity and intent codec are required")
  canonical([provider.definitionId, provider.intentVersion])
}

export const verifyProviderContracts = (providers: ReadonlyArray<ProviderDefinition>): void => {
  for (const provider of providers) {
    if (provider.contract !== PROVIDER_CONTRACT)
      fail("provider-contract", "Provider and kernel contract versions differ")
    verifyDescriptor(provider)
    if (
      typeof provider.receiptVersion !== "string" ||
      !provider.receiptVersion ||
      !Schema.isSchema(provider.receiptCodec) ||
      typeof provider.receiptCorresponds !== "function" ||
      typeof provider.classifyReceipt !== "function" ||
      typeof provider.prepare !== "function" ||
      (provider.requestCorresponds !== undefined &&
        typeof provider.requestCorresponds !== "function")
    )
      fail(
        "missing-receipt-codec",
        "Native receipt codec, classification, correspondence and prepare are mandatory",
      )
    canonical(provider.receiptVersion)
    const observation = [
      provider.observe,
      provider.observationVersion,
      provider.observationCodec,
      provider.classifyObservation,
    ]
    if (
      observation.some((value) => value !== undefined) &&
      (typeof provider.observe !== "function" ||
        typeof provider.observationVersion !== "string" ||
        !provider.observationVersion ||
        !Schema.isSchema(provider.observationCodec) ||
        typeof provider.classifyObservation !== "function")
    )
      fail(
        "missing-observation-codec",
        "Observation requires a complete callable operation, native codec and classifier",
      )
    if (provider.observationVersion !== undefined) canonical(provider.observationVersion)
    for (const boundary of [provider.dispatchError, provider.rejection]) {
      if (
        boundary !== undefined &&
        (!boundary ||
          typeof boundary.version !== "string" ||
          !boundary.version ||
          !Schema.isSchema(boundary.codec) ||
          typeof boundary.corresponds !== "function" ||
          isCoreErrorVersion(boundary.version))
      )
        fail(
          "failure-codec",
          "Native failure boundaries require their own complete versioned codec",
        )
      if (boundary !== undefined) canonical(boundary.version)
    }
  }
}
export const decodeObservationEvidence = (
  provider: ProviderDefinition,
  body: ObservationRecorded,
): unknown => {
  if (body.evidenceKind === "DispatchError") {
    if (!body.dispatchId || body.status !== "Inconclusive")
      fail("dispatch-error-shape", "Dispatch error must be inconclusive and identify its dispatch")
    const codec =
      body.evidenceVersion === "core-dispatch-error/1"
        ? CoreDispatchError
        : body.evidenceVersion === "core-undecodable-receipt/1"
          ? CoreUndecodableReceipt
          : provider.dispatchError?.version === body.evidenceVersion
            ? provider.dispatchError.codec
            : undefined
    if (!codec) fail("unknown-error-codec", "Native dispatch error version is unavailable")
    return nativeEvidence(codec, body.evidence)
  }
  if (body.dispatchId !== undefined)
    fail("observation-shape", "Ordinary observation cannot assert a dispatch identity")
  if (
    !provider.observationCodec ||
    !provider.classifyObservation ||
    body.evidenceVersion !== provider.observationVersion
  )
    fail("unknown-observation-codec", "Native observation version is unavailable")
  return nativeEvidence(provider.observationCodec, body.evidence)
}
export const nativeEvidence = (codec: Schema.Codec<unknown, unknown>, input: unknown): unknown => {
  const value = Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(input)
  const encoded = Schema.encodeSync(codec)(value)
  if (canonical(encoded) !== canonical(input))
    fail("native-evidence-canonical", "Evidence must use its exact native encoding")
  return value
}
