import * as Effect from "effect/Effect"
import { operationOrder } from "../domain/operation.js"
import { PlannerMetadata, ReleaseIntent, ReleasePlan } from "../domain/release.js"
import { allTargetCapabilities, planAllTargetOperations } from "../targets/registry.js"
import { normalizeReleaseIntent } from "./normalize-release.js"

export type * from "../types/effect-internal.js"

export const createReleasePlan = Effect.fn("createReleasePlan")(function*(
  intent: ReleaseIntent,
  root: string = ".",
  configPath: string | undefined = undefined
) {
  const model = yield* normalizeReleaseIntent(intent, root, configPath)
  const targetCapabilities = yield* allTargetCapabilities(model)
  const operations = yield* planAllTargetOperations(model)

  return ReleasePlan.make({
    schemaVersion: "release-plan/v1",
    identity: model.identity,
    source: model.source,
    artifacts: model.artifacts,
    targets: model.targets,
    targetCapabilities,
    operations: [...operations].sort(operationOrder),
    evidenceDirectory: model.evidenceDirectory,
    metadata: PlannerMetadata.make({
      createdBy: "release",
      planSchemaVersion: "release-plan/v1"
    })
  })
})
