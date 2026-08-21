import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson, hashCanonical, parseStrictJson } from "../model/canonical.js"
import { Sha256Hex } from "../model/digest.js"
import {
  ArtifactBundle,
  ArtifactRef,
  BundleId
} from "./artifact-bundle.js"

const canonicalIdentifier = <const Name extends string>(name: Name) =>
  Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
    value === value.normalize("NFC")
      ? undefined
      : `${name} must use Unicode NFC.`
  )).pipe(Schema.brand(name))

export const ProviderDefinitionId = canonicalIdentifier("ProviderDefinitionId")
export type ProviderDefinitionId = typeof ProviderDefinitionId.Type

export const IntentSchemaVersion = canonicalIdentifier("IntentSchemaVersion")
export type IntentSchemaVersion = typeof IntentSchemaVersion.Type

export const OperationId = Sha256Hex.pipe(Schema.brand("OperationId"))
export type OperationId = typeof OperationId.Type

export const PlanId = Sha256Hex.pipe(Schema.brand("PlanId"))
export type PlanId = typeof PlanId.Type

export interface ProviderDefinition<Intent, Encoded extends Schema.Json = Schema.Json> {
  readonly definitionId: string
  readonly intentSchemaVersion: string
  readonly intentSchema: Schema.Codec<Intent, Encoded, never, never>
}

export class DurableIntentV1 extends Schema.Class<DurableIntentV1>("DurableIntentV1")({
  providerDefinitionId: ProviderDefinitionId,
  intentSchemaVersion: IntentSchemaVersion,
  canonicalIntent: Schema.Json
}) {}

export class PlannedOperationV1 extends Schema.Class<PlannedOperationV1>("PlannedOperationV1")({
  operationId: OperationId,
  intent: DurableIntentV1
}) {}

export class ReleasePlanV1 extends Schema.Class<ReleasePlanV1>("ReleasePlanV1")({
  schemaVersion: Schema.Literal("release-plan/v1"),
  planId: PlanId,
  bundleId: BundleId,
  operations: Schema.Array(PlannedOperationV1)
}) {}

export class OperationKey extends Schema.Class<OperationKey>("OperationKey")({
  planId: PlanId,
  operationId: OperationId
}) {}

export class ReleasePlanError
  extends Schema.TaggedErrorClass<ReleasePlanError>()("ReleasePlanError", {
    reason: Schema.NonEmptyString
  }) {}

const reason = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

const freezeJson = (value: Schema.Json): Schema.Json => {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeJson))
  if (value !== null && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeJson(item)])))
  }
  return value
}

const normalizeJson = (value: unknown): Schema.Json =>
  freezeJson(parseStrictJson(encodeCanonicalJson(value)))

const freezeIntent = (intent: DurableIntentV1): DurableIntentV1 =>
  Object.freeze(DurableIntentV1.make({
    providerDefinitionId: intent.providerDefinitionId,
    intentSchemaVersion: intent.intentSchemaVersion,
    canonicalIntent: freezeJson(intent.canonicalIntent)
  }))

const freezePlan = (plan: ReleasePlanV1): ReleasePlanV1 => {
  const operations = Object.freeze(plan.operations.map((operation) => Object.freeze(PlannedOperationV1.make({
    operationId: operation.operationId,
    intent: freezeIntent(operation.intent)
  }))))
  return Object.freeze(ReleasePlanV1.make({
    schemaVersion: "release-plan/v1",
    planId: plan.planId,
    bundleId: plan.bundleId,
    operations
  }))
}

const encodedIntent = (intent: DurableIntentV1): Schema.Json =>
  Schema.encodeSync(DurableIntentV1)(intent) as Schema.Json

const encodedOperation = (operation: PlannedOperationV1): Schema.Json =>
  Schema.encodeSync(PlannedOperationV1)(operation) as Schema.Json

const encodedPlan = (plan: ReleasePlanV1): Schema.Json =>
  Schema.encodeSync(ReleasePlanV1)(plan) as Schema.Json

export const deriveOperationId = (intent: DurableIntentV1): OperationId =>
  OperationId.make(hashCanonical("ts-release/operation/1", {
    providerDefinitionId: intent.providerDefinitionId,
    intentSchemaVersion: intent.intentSchemaVersion,
    canonicalIntent: intent.canonicalIntent
  }))

export const derivePlanId = (input: {
  readonly bundleId: BundleId
  readonly operations: ReadonlyArray<PlannedOperationV1>
}): PlanId => PlanId.make(hashCanonical("ts-release/release-plan/1", {
  schemaVersion: "release-plan/v1",
  bundleId: input.bundleId,
  operations: input.operations.map(encodedOperation)
}))

export const deriveOperationKey = (
  planId: PlanId,
  operationId: OperationId
): OperationKey => OperationKey.make({ planId, operationId })

const normalizeDurableIntent = (intent: DurableIntentV1): DurableIntentV1 => {
  const encoded = normalizeJson(encodedIntent(intent))
  const normalized = Schema.decodeUnknownSync(DurableIntentV1, {
    onExcessProperty: "error"
  })(encoded)
  return freezeIntent(normalized)
}

const collectArtifactRefs = (value: Schema.Json, refs: Array<ArtifactRef>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectArtifactRefs(item, refs)
    return
  }
  if (value === null || typeof value !== "object") return
  const object = value as Schema.JsonObject
  if (object._tag === "ArtifactRef") {
    refs.push(Schema.decodeUnknownSync(ArtifactRef, { onExcessProperty: "error" })(object))
    return
  }
  for (const item of Object.values(object)) collectArtifactRefs(item, refs)
}

const assertPlan = (plan: ReleasePlanV1, bundle: ArtifactBundle): void => {
  if (plan.bundleId !== bundle.bundleId) {
    throw new Error(`Plan bundle ${plan.bundleId} does not match loaded bundle ${bundle.bundleId}.`)
  }
  const operationIds = new Set<string>()
  let previous: string | undefined
  for (const operation of plan.operations) {
    const expected = deriveOperationId(operation.intent)
    if (operation.operationId !== expected) {
      throw new Error(`Operation ${operation.operationId} does not match its canonical Intent.`)
    }
    const operationId = operation.operationId.toString()
    if (operationIds.has(operationId)) throw new Error(`Plan repeats operation ${operationId}.`)
    if (previous !== undefined && previous >= operationId) {
      throw new Error("Plan operations must be ordered by operationId.")
    }
    operationIds.add(operationId)
    previous = operationId

    const refs: Array<ArtifactRef> = []
    collectArtifactRefs(operation.intent.canonicalIntent, refs)
    for (const ref of refs) {
      if (!bundle.hasArtifact(ref.artifactId)) {
        throw new Error(`Operation ${operationId} references missing artifact ${ref.artifactId}.`)
      }
    }
  }
  const expectedPlanId = derivePlanId(plan)
  if (plan.planId !== expectedPlanId) {
    throw new Error(`Plan id ${plan.planId} does not match its canonical contents.`)
  }
}

export const encodeProviderIntent = Effect.fn("ReleasePlan.encodeProviderIntent")(function*<
  Intent,
  Encoded extends Schema.Json
>(input: {
  readonly definition: ProviderDefinition<Intent, Encoded>
  readonly intent: Intent
}) {
  const canonicalIntent = yield* Schema.encodeUnknownEffect(input.definition.intentSchema, {
    onExcessProperty: "error"
  })(input.intent).pipe(Effect.mapError((cause) => ReleasePlanError.make({
    reason: `Provider Intent encoding failed: ${cause.message}`
  })))
  try {
    return freezeIntent(DurableIntentV1.make({
      providerDefinitionId: Schema.decodeUnknownSync(ProviderDefinitionId)(input.definition.definitionId),
      intentSchemaVersion: Schema.decodeUnknownSync(IntentSchemaVersion)(input.definition.intentSchemaVersion),
      canonicalIntent: normalizeJson(canonicalIntent)
    }))
  } catch (cause) {
    return yield* ReleasePlanError.make({ reason: reason(cause) })
  }
})

export const decodeProviderIntent = Effect.fn("ReleasePlan.decodeProviderIntent")(function*<
  Intent,
  Encoded extends Schema.Json
>(input: {
  readonly definition: ProviderDefinition<Intent, Encoded>
  readonly intent: DurableIntentV1
}) {
  let definitionId: ProviderDefinitionId
  let intentSchemaVersion: IntentSchemaVersion
  try {
    definitionId = Schema.decodeUnknownSync(ProviderDefinitionId)(input.definition.definitionId)
    intentSchemaVersion = Schema.decodeUnknownSync(IntentSchemaVersion)(input.definition.intentSchemaVersion)
  } catch (cause) {
    return yield* ReleasePlanError.make({ reason: reason(cause) })
  }
  if (definitionId !== input.intent.providerDefinitionId ||
      intentSchemaVersion !== input.intent.intentSchemaVersion) {
    return yield* ReleasePlanError.make({
      reason: `Provider definition ${input.definition.definitionId}@${input.definition.intentSchemaVersion} does not decode ${input.intent.providerDefinitionId}@${input.intent.intentSchemaVersion}.`
    })
  }
  const decoded = yield* Schema.decodeUnknownEffect(input.definition.intentSchema, {
    onExcessProperty: "error"
  })(input.intent.canonicalIntent).pipe(Effect.mapError((cause) => ReleasePlanError.make({
    reason: `Provider Intent decoding failed: ${cause.message}`
  })))
  const roundTrip = yield* encodeProviderIntent({ definition: input.definition, intent: decoded })
  if (encodeCanonicalJson(roundTrip.canonicalIntent) !== encodeCanonicalJson(input.intent.canonicalIntent)) {
    return yield* ReleasePlanError.make({
      reason: `Provider Intent ${input.intent.providerDefinitionId}@${input.intent.intentSchemaVersion} is not a canonical codec round trip.`
    })
  }
  return decoded
})

export const makeReleasePlan = Effect.fn("ReleasePlan.make")(function*(input: {
  readonly bundle: ArtifactBundle
  readonly intents: ReadonlyArray<DurableIntentV1>
}) {
  try {
    const operations = input.intents.map((intent) => {
      const normalized = normalizeDurableIntent(intent)
      return PlannedOperationV1.make({
        operationId: deriveOperationId(normalized),
        intent: normalized
      })
    }).sort((left, right) => left.operationId < right.operationId ? -1 : left.operationId > right.operationId ? 1 : 0)
    const plan = ReleasePlanV1.make({
      schemaVersion: "release-plan/v1",
      planId: derivePlanId({ bundleId: input.bundle.bundleId, operations }),
      bundleId: input.bundle.bundleId,
      operations
    })
    assertPlan(plan, input.bundle)
    return freezePlan(plan)
  } catch (cause) {
    return yield* ReleasePlanError.make({ reason: reason(cause) })
  }
})

export const encodeReleasePlan = Effect.fn("ReleasePlan.encode")(function*(input: {
  readonly plan: ReleasePlanV1
  readonly bundle: ArtifactBundle
}) {
  try {
    assertPlan(input.plan, input.bundle)
  } catch (cause) {
    return yield* ReleasePlanError.make({ reason: reason(cause) })
  }
  try {
    return new TextEncoder().encode(encodeCanonicalJson(encodedPlan(input.plan)))
  } catch (cause) {
    return yield* ReleasePlanError.make({ reason: reason(cause) })
  }
})

export const decodeReleasePlan = Effect.fn("ReleasePlan.decode")(function*(input: {
  readonly bytes: Uint8Array
  readonly bundle: ArtifactBundle
}) {
  let plan: ReleasePlanV1
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)
    plan = Schema.decodeUnknownSync(ReleasePlanV1, {
      onExcessProperty: "error"
    })(parseStrictJson(text))
    assertPlan(plan, input.bundle)
    const canonical = new TextEncoder().encode(encodeCanonicalJson(encodedPlan(plan)))
    if (!equalBytes(canonical, input.bytes)) throw new Error("Release plan bytes are not canonical.")
  } catch (cause) {
    return yield* ReleasePlanError.make({ reason: reason(cause) })
  }
  return freezePlan(plan)
})
