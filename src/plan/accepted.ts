import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson, hashFramed, parseStrictJson } from "../model/canonical.js"
import { NonCanonicalPlanError, PlanDecodeError } from "../model/errors.js"
import { ReleasePlanV6 } from "../model/plan.js"
import { PlanId } from "../model/primitives.js"
import {
  isValidationFailure, validatePlan, type Dependency, type DerivedOutput, type ValidatedPlanProjection
} from "../model/validate.js"

const decoder = new TextDecoder("utf-8", { fatal: true })
const encoder = new TextEncoder()

const freeze = (value: unknown): void => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return
  for (const item of Object.values(value)) freeze(item)
  Object.freeze(value)
}

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

export class AcceptedPlan {
  readonly plan: ReleasePlanV6
  readonly planId: PlanId
  readonly outputs: ReadonlyArray<DerivedOutput>
  readonly dependencies: ReadonlyArray<Dependency>
  readonly operationHashes: ReadonlyArray<{
    readonly operationId: string
    readonly hash: string
  }>
  readonly #bytes: Uint8Array

  private constructor(
    plan: ReleasePlanV6,
    bytes: Uint8Array,
    planId: PlanId,
    projection: ValidatedPlanProjection
  ) {
    freeze(plan)
    this.plan = plan
    this.#bytes = new Uint8Array(bytes)
    this.planId = planId
    this.outputs = Object.freeze([...projection.outputs])
    this.dependencies = Object.freeze([...projection.dependencies])
    this.operationHashes = Object.freeze([...projection.operationHashes])
    Object.freeze(this)
  }

  get bytes(): Uint8Array {
    return new Uint8Array(this.#bytes)
  }

  static readonly accept = Effect.fn("rewrite.acceptPlan")(function*(bytes: Uint8Array) {
    const plan = yield* Effect.try({
      try: () => {
        const value = parseStrictJson(decoder.decode(bytes))
        return Schema.decodeUnknownSync(ReleasePlanV6, {
          onExcessProperty: "error"
        })(value)
      },
      catch: (cause) => PlanDecodeError.make({ reason: String(cause) })
    })
    const canonical = encoder.encode(
      encodeCanonicalJson(Schema.encodeSync(ReleasePlanV6)(plan))
    )
    if (!equalBytes(bytes, canonical)) {
      return yield* NonCanonicalPlanError.make({
        reason: "Plan bytes differ from CanonicalJsonV1."
      })
    }
    const projection = validatePlan(plan)
    if (isValidationFailure(projection)) return yield* projection
    const digest = hashFramed("ts-release/plan-id/v1", [canonical])
    return new AcceptedPlan(plan, canonical, PlanId.make(digest), projection)
  })
}

export const acceptPlan = AcceptedPlan.accept

export const encodePlanBytes = (plan: ReleasePlanV6): Uint8Array =>
  encoder.encode(encodeCanonicalJson(Schema.encodeSync(ReleasePlanV6)(plan)))
