import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Operation } from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import { TargetCapabilities, TargetConfig, targetCapabilitiesOrder } from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"

export type * from "../types/effect-internal.js"

export class MissingTargetAdapterError extends Schema.TaggedErrorClass<MissingTargetAdapterError>()(
  "MissingTargetAdapterError",
  {
    targetTag: Schema.String
  }
) {}

export interface TargetRegistryShape {
  readonly targetCapabilities: (target: TargetConfig) => TargetCapabilities
  readonly planTargetOperations: (
    target: TargetConfig,
    model: ReleaseModel
  ) => Effect.Effect<ReadonlyArray<Operation>, MissingTargetAdapterError | PlanConstructionError>
}

export class TargetRegistry extends Context.Service<TargetRegistry, TargetRegistryShape>()("TargetRegistry") {}

export const targetCapabilities = Effect.fn("targetCapabilities")(function*(target: TargetConfig) {
  const registry = yield* TargetRegistry
  return registry.targetCapabilities(target)
})

export const allTargetCapabilities = Effect.fn("allTargetCapabilities")(function*(model: ReleaseModel) {
  const capabilities: Array<TargetCapabilities> = []
  for (const target of model.targets) {
    capabilities.push(yield* targetCapabilities(target))
  }
  return capabilities.sort(targetCapabilitiesOrder)
})

export const planTargetOperations = Effect.fn("planTargetOperations")(function*(target: TargetConfig, model: ReleaseModel) {
  const registry = yield* TargetRegistry
  return yield* registry.planTargetOperations(target, model)
})

export const planAllTargetOperations = Effect.fn("planAllTargetOperations")(function*(
  model: ReleaseModel
) {
  const operations: Array<Operation> = []
  for (const target of model.targets) {
    const targetOperations = yield* planTargetOperations(target, model)
    operations.push(...targetOperations)
  }
  return operations
})
