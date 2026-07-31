import * as Effect from "effect/Effect"
import { PlanningFactsError } from "../model/errors.js"
import { type PlanId } from "../model/primitives.js"
import { acceptPlan } from "./accepted.js"

const encoder = new TextEncoder()
export type { AcceptedPlan } from "./accepted.js"

export const acceptExpected = (bytes: string, expected: PlanId) => Effect.gen(function*() {
  const value = yield* acceptPlan(encoder.encode(bytes))
  if (value.planId !== expected) {
    return yield* PlanningFactsError.make({
      reason: "Expected PlanId does not match canonical bytes."
    })
  }
  return value
})
