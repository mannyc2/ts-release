// Invariant: after hooks and custom publishers reuse the hook command grammar with approval-bearing risks.
import * as Effect from "effect/Effect"
import { featurePlanner } from "../../grammar/planner.js"
import { hookOperation, type ReleaseConfigRiskHook } from "../build/hooks.js"

const planner = (
  pipeId: "hooks:after" | "publish:custom",
  idPrefix: "hook:after" | "custom",
  field: string,
  description: (id: string) => string
) => featurePlanner<ReadonlyArray<ReleaseConfigRiskHook>>(pipeId, (entries, state) =>
  Effect.forEach(entries, (entry) => hookOperation(entry, {
    idPrefix,
    pipeId,
    field,
    phase: "publish",
    risk: entry.risk,
    identity: state.identity,
    description: description(entry.id)
  })).pipe(Effect.map((operations) => ({ operations }))))

export const hooksAfterPlanner = planner(
  "hooks:after", "hook:after", "hooks.after[].run", (id) => `Run ${id} hook.`
)

export const publishCustomPlanner = planner(
  "publish:custom", "custom", "publish.custom[].run",
  (id) => `Run ${id} custom publish command.`
)
