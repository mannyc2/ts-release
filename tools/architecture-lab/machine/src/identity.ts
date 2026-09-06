import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  CoreDispatchError, JournalEvent, LabError, Operation, Plan, RequestFacts,
  type ObservationRecorded, type ProviderDescriptor,
  type PreparedRequest, type ProviderDefinition, type Scope
} from "./contracts.js"

export function fail(code: string, message: string): never { throw new LabError({ code, message }) }
export const attempt = <A>(body: () => A): Effect.Effect<A, LabError> => Effect.try({
  try: body,
  catch: (error) => error instanceof LabError ? error : new LabError({ code: "invalid-data", message: String(error) })
})

/** Deliberately accepts only strict canonical JSON; normalizing changes intent. */
export const canonical = (input: unknown): string => {
  const visit = (value: unknown): string => {
    if (value === null || typeof value === "boolean") return JSON.stringify(value)
    if (typeof value === "string") {
      if (value !== value.normalize("NFC")) fail("noncanonical-string", "Strings must already be NFC")
      if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) fail("invalid-string", "Unpaired surrogate")
      return JSON.stringify(value)
    }
    if (typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0)) return String(value)
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) fail("invalid-json-array", "Sparse arrays and extra array properties are forbidden")
      return `[${Array.from(value, visit).join(",")}]`
    }
    if (typeof value === "object" && value !== null) {
      const prototype: unknown = Object.getPrototypeOf(value)
      const schemaInstance = Object.getOwnPropertyNames(Object.getPrototypeOf(value) ?? {}).some((key) => key.startsWith("~effect/Schema/Class/")) ||
        Reflect.ownKeys(value).some((key) => typeof key === "string" && key.startsWith("~effect/Schema/Class/"))
      if (prototype !== Object.prototype && prototype !== null && !schemaInstance) {
        // Schema classes inherit the marker, rather than always owning it.
        let parent = Object.getPrototypeOf(value)
        let found = false
        while (parent && parent !== Object.prototype) {
          if (Reflect.ownKeys(parent).some((key) => typeof key === "string" && key.startsWith("~effect/Schema/Class/"))) found = true
          parent = Object.getPrototypeOf(parent)
        }
        if (!found) fail("invalid-json-object", "Only plain records and Schema classes are canonical data")
      }
      const entries = Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      return `{${entries.map(([key, item]) => `${visit(key)}:${visit(item)}`).join(",")}}`
    }
    return fail("invalid-json", "Only canonical JSON values and safe integers are allowed")
  }
  return visit(input)
}

export const parseCanonical = (text: string): unknown => {
  const value: unknown = JSON.parse(text)
  if (canonical(value) !== text) fail("noncanonical-json", "Input must be exact canonical JSON, without duplicate keys")
  return value
}

export const sha256 = Effect.fn("lab.sha256")(function*(bytes: Uint8Array) {
  const digest = yield* Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    catch: () => new LabError({ code: "digest-failed", message: "Host WebCrypto SHA-256 failed" })
  })
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
})

export const hashCanonical = Effect.fn("lab.hashCanonical")(function*(domain: string, value: unknown) {
  const encoded = yield* attempt(() => canonical(value))
  const utf8 = new TextEncoder()
  const domainBytes = utf8.encode(domain)
  const payloadBytes = utf8.encode(encoded)
  const prefix = utf8.encode(`${domainBytes.length}:`)
  const middle = utf8.encode(`${payloadBytes.length}:`)
  const bytes = new Uint8Array(prefix.length + domainBytes.length + middle.length + payloadBytes.length)
  bytes.set(prefix)
  bytes.set(domainBytes, prefix.length)
  bytes.set(middle, prefix.length + domainBytes.length)
  bytes.set(payloadBytes, prefix.length + domainBytes.length + middle.length)
  return yield* sha256(bytes)
})

const operationValue = (operation: Pick<Operation, "definitionId" | "intentVersion" | "intent">) => ({
  definitionId: operation.definitionId, intentVersion: operation.intentVersion, intent: operation.intent
})

export const createOperation = Effect.fn("lab.createOperation")(function*(
  provider: ProviderDescriptor, intent: unknown, dependsOn: ReadonlyArray<string> = []
) {
  const encoded = yield* attempt(() => {
    const decoded = Schema.decodeUnknownSync(provider.intentCodec, { onExcessProperty: "error" })(intent)
    return Schema.encodeSync(provider.intentCodec)(decoded)
  })
  const value = { definitionId: provider.definitionId, intentVersion: provider.intentVersion, intent: encoded }
  const operationId = yield* hashCanonical("architecture-lab/operation/1", value)
  return new Operation({ operationId, ...value, dependsOn: [...dependsOn].sort() })
})

export const validateDag = (operations: ReadonlyArray<Operation>): void => {
  const index = new Map<string, Operation>()
  for (const operation of operations) {
    if (index.has(operation.operationId)) fail("duplicate-operation", "Operation IDs must be unique")
    if (operation.dependsOn.length !== new Set(operation.dependsOn).size) fail("duplicate-dependency", "Dependencies must be unique")
    if (canonical(operation.dependsOn) !== canonical([...operation.dependsOn].sort())) fail("dependency-order", "Dependencies must be sorted")
    index.set(operation.operationId, operation)
  }
  const active = new Set<string>()
  const done = new Set<string>()
  const visit = (id: string): void => {
    if (active.has(id)) fail("cyclic-plan", "Plan dependencies contain a cycle")
    if (done.has(id)) return
    const operation = index.get(id)
    if (!operation) fail("missing-dependency", "Plan has a dangling dependency")
    active.add(id)
    for (const dependency of operation.dependsOn) visit(dependency)
    active.delete(id)
    done.add(id)
  }
  for (const id of index.keys()) visit(id)
}

const planValue = (bundleId: string, operations: ReadonlyArray<Operation>) => ({
  format: "architecture-lab/plan/1" as const, bundleId,
  operations: [...operations].sort((a, b) => a.operationId < b.operationId ? -1 : 1)
})
export const createPlan = Effect.fn("lab.createPlan")(function*(bundleId: string, operations: ReadonlyArray<Operation>, journalId?: string) {
  yield* attempt(() => validateDag(operations))
  const content = planValue(bundleId, operations)
  const value = { ...content, journalId: journalId ?? (yield* hashCanonical("architecture-lab/journal/1", content)) }
  const planId = yield* hashCanonical("architecture-lab/plan/1", value)
  return new Plan({ planId, ...value })
})

export const createPreparationScope = Effect.fn("lab.createPreparationScope")(function*(provider: ProviderDescriptor, input: unknown, journalId?: string) {
  const operation = yield* createOperation(provider, input)
  const plan = yield* createPlan(`preparation:${operation.operationId}`, [operation], journalId)
  return { _tag: "PreparationScope", plan } as const satisfies Scope
})

export const loadPlan = Effect.fn("lab.loadPlan")(function*(input: unknown, providers: ReadonlyArray<ProviderDescriptor>) {
  const plan = yield* attempt(() => Schema.decodeUnknownSync(Plan, { onExcessProperty: "error" })(input))
  const definitions = new Map<string, ProviderDescriptor>()
  yield* attempt(() => {
    for (const provider of providers) {
      if (definitions.has(provider.definitionId)) fail("duplicate-provider", "Provider definition IDs must be unique")
      definitions.set(provider.definitionId, provider)
    }
    validateDag(plan.operations)
    if (canonical(plan.operations) !== canonical(planValue(plan.bundleId, plan.operations).operations)) fail("operation-order", "Operations must be sorted")
  })
  for (const operation of plan.operations) {
    const provider = definitions.get(operation.definitionId)
    if (!provider || provider.intentVersion !== operation.intentVersion) return yield* Effect.fail(new LabError({ code: "unknown-provider-codec", message: "Provider or intent version is unavailable" }))
    const rebuilt = yield* createOperation(provider, operation.intent, operation.dependsOn)
    if (rebuilt.operationId !== operation.operationId || canonical(rebuilt.intent) !== canonical(operation.intent)) return yield* Effect.fail(new LabError({ code: "operation-identity", message: "Operation does not match its canonical intent" }))
  }
  const rebuilt = yield* createPlan(plan.bundleId, plan.operations, plan.journalId)
  if (rebuilt.planId !== plan.planId) return yield* Effect.fail(new LabError({ code: "plan-identity", message: "Plan ID mismatch" }))
  return plan
})

export const requestFingerprint = (facts: RequestFacts) => hashCanonical("architecture-lab/request/1", facts)
export const makeRequest = Effect.fn("lab.makeRequest")(function*(
  input: Omit<typeof RequestFacts.Type, "bodyDigest" | "byteLength"> & { readonly body: Uint8Array }
) {
  const body = input.body.slice()
  const { body: _, ...fields } = input
  const bodyDigest = yield* sha256(body)
  const facts = yield* attempt(() => Schema.decodeUnknownSync(RequestFacts, { onExcessProperty: "error" })({
    ...fields, bodyDigest, byteLength: String(body.byteLength)
  }))
  yield* attempt(() => canonical(facts))
  return { facts, body } satisfies PreparedRequest
})

export const verifyRequest = Effect.fn("lab.verifyRequest")(function*(request: PreparedRequest) {
  const facts = yield* attempt(() => Schema.decodeUnknownSync(RequestFacts, { onExcessProperty: "error" })(request.facts))
  const body = request.body.slice()
  if (facts.byteLength !== String(body.byteLength) || facts.bodyDigest !== (yield* sha256(body))) return yield* Effect.fail(new LabError({ code: "request-bytes", message: "Prepared bytes do not match recorded facts" }))
  yield* attempt(() => {
    canonical(facts)
    for (const [name] of facts.headers) {
      if (/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token)$/iu.test(name)) fail("secret-header", "Authentication header bytes must remain in the host transport closure")
    }
    if (facts.replay._tag === "GitCas" && (facts.transport !== "core.git/1" || facts.method !== "update-ref")) fail("untrusted-replay", "Only core conditional Git updates can carry structural replay protection")
  })
  return { facts, body } satisfies PreparedRequest
})

export const verifyEvents = Effect.fn("lab.verifyEvents")(function*(plan: Plan, input: ReadonlyArray<JournalEvent>, journalId: string = plan.journalId) {
  const ids = new Set<string>()
  const events: JournalEvent[] = []
  for (const unknown of input) {
    const event = yield* attempt(() => Schema.decodeUnknownSync(JournalEvent, { onExcessProperty: "error" })(unknown))
    yield* attempt(() => {
      canonical(event)
      if (event.journalId !== journalId || event.planId !== plan.planId || ids.has(event.eventId)) fail("journal-envelope", "Wrong journal, plan or repeated event ID")
      ids.add(event.eventId)
    })
    if (event.body._tag === "DispatchStarted" && event.body.fingerprint !== (yield* requestFingerprint(event.body.request))) return yield* Effect.fail(new LabError({ code: "request-fingerprint", message: "Historical request fingerprint mismatch" }))
    events.push(event)
  }
  return events
})

export const verifyProviderContracts = (providers: ReadonlyArray<ProviderDefinition>): void => {
  for (const provider of providers) {
    if (!provider.receiptVersion || !provider.receiptCodec || typeof provider.receiptCorresponds !== "function" || typeof provider.classifyReceipt !== "function" || typeof provider.prepare !== "function") fail("missing-receipt-codec", "Native receipt codec, classification, correspondence and prepare are mandatory")
    if (provider.observe && (!provider.observationVersion || !provider.observationCodec || !provider.classifyObservation)) fail("missing-observation-codec", "Observation requires a native codec and classifier")
    for (const boundary of [provider.dispatchError, provider.rejection]) {
      if (boundary && (!boundary.version || !boundary.codec || !boundary.corresponds || boundary.version === "core-dispatch-error/1")) fail("failure-codec", "Native failure boundaries require their own complete versioned codec")
    }
  }
}

export const decodeObservationEvidence = (provider: ProviderDefinition, body: ObservationRecorded): unknown => {
  if (body.evidenceKind === "DispatchError") {
    if (!body.dispatchId || body.status !== "Inconclusive") fail("dispatch-error-shape", "Dispatch error must be inconclusive and identify its dispatch")
    const codec = body.evidenceVersion === "core-dispatch-error/1" ? CoreDispatchError : provider.dispatchError?.version === body.evidenceVersion ? provider.dispatchError.codec : undefined
    if (!codec) fail("unknown-error-codec", "Native dispatch error version is unavailable")
    return nativeEvidence(codec, body.evidence)
  }
  if (body.dispatchId !== undefined) fail("observation-shape", "Ordinary observation cannot assert a dispatch identity")
  if (!provider.observationCodec || !provider.classifyObservation || body.evidenceVersion !== provider.observationVersion) fail("unknown-observation-codec", "Native observation version is unavailable")
  return nativeEvidence(provider.observationCodec, body.evidence)
}

export const nativeEvidence = (codec: Schema.Codec<unknown, unknown>, input: unknown): unknown => {
  const value = Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(input)
  const encoded = Schema.encodeSync(codec)(value)
  if (canonical(encoded) !== canonical(input)) fail("native-evidence-canonical", "Evidence must use its exact native encoding")
  return value
}

/** Native correspondence is provider protocol knowledge; it grants no replay authority. */
export const verifyNativeEvidence = (plan: Plan, events: ReadonlyArray<JournalEvent>, providers: ReadonlyArray<ProviderDefinition>): void => {
  const starts = new Map<string, Extract<JournalEvent["body"], { readonly _tag: "DispatchStarted" }>>()
  const receipts = new Map<string, unknown[]>()
  for (const { body } of events) {
    if (body._tag === "DispatchStarted") starts.set(body.dispatchId, body)
    if (body._tag === "ReceiptAccepted") {
      const start = starts.get(body.dispatchId)
      const operation = plan.operations.find((item) => item.operationId === start?.operationId)
      if (!start || !operation) fail("unassociated-receipt", "Receipt has no preceding dispatch")
      const provider = providers.find((item) => item.definitionId === operation.definitionId)!
      if (body.receiptVersion !== provider.receiptVersion) fail("unknown-receipt-codec", "Native receipt version is unavailable")
      const receipt = nativeEvidence(provider.receiptCodec, body.receipt)
      if (!provider.receiptCorresponds(operation, start.request, receipt)) fail("receipt-correspondence", "Native receipt does not identify the exact dispatched request")
      if (provider.classifyReceipt(operation, start.request, receipt) !== body.status) fail("receipt-classification", "Stored completion differs from native acceptance")
      receipts.set(operation.operationId, [...(receipts.get(operation.operationId) ?? []), receipt])
    }
    if (body._tag === "DispatchRejectedBeforeCommit") {
      const start = starts.get(body.dispatchId)
      const operation = plan.operations.find((item) => item.operationId === start?.operationId)
      if (!start || !operation) fail("unassociated-rejection", "Rejection has no preceding dispatch")
      const boundary = providers.find((item) => item.definitionId === operation.definitionId)!.rejection
      if (!boundary || boundary.version !== body.proofVersion) fail("unknown-rejection-codec", "Native terminal noncommit proof version is unavailable")
      const proof = nativeEvidence(boundary.codec, body.proof)
      if (!boundary.corresponds(operation, start.request, proof)) fail("rejection-correspondence", "Terminal noncommit proof does not match the exact dispatch")
    }
    if (body._tag === "ObservationRecorded") {
      const operation = plan.operations.find((item) => item.operationId === body.operationId)
      if (!operation) fail("unknown-operation", "Observation references an unknown operation")
      const provider = providers.find((item) => item.definitionId === operation.definitionId)!
      const evidence = decodeObservationEvidence(provider, body)
      if (body.evidenceKind === "DispatchError") {
        const start = starts.get(body.dispatchId!)
        if (!start || start.operationId !== operation.operationId) fail("error-correspondence", "Dispatch error does not identify a preceding dispatch for this operation")
        if (body.evidenceVersion !== "core-dispatch-error/1" && !provider.dispatchError!.corresponds(operation, start.request, evidence)) fail("error-correspondence", "Native dispatch error differs from the exact request")
      } else if (provider.classifyObservation!(operation, evidence, receipts.get(operation.operationId) ?? []) !== body.status) fail("observation-classification", "Stored classification differs from native evidence and associated receipts")
    }
  }
}
