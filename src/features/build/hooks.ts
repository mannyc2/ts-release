// Invariant: every hook is one argv-only command operation, and ungated risk is unrepresentable.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SafeRelativePath } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { CommandAction, CommandSpec, type OperationPhase } from "../../grammar/operation.js"
import { featureOperation, featurePlanner } from "../../grammar/planner.js"
import type { ReleaseIdentity } from "../../grammar/state.js"
import { renderCommandTemplateEffect } from "../../grammar/template.js"
import { defaulted } from "../../grammar/defaulted.js"

const hookFields = {
  id: Schema.NonEmptyString,
  run: Schema.NonEmptyArray(Schema.NonEmptyString),
  cwd: Schema.optionalKey(SafeRelativePath),
  env: Schema.optionalKey(Schema.Array(Schema.NonEmptyString))
}

export class ReleaseConfigHook extends Schema.Class<ReleaseConfigHook>("ReleaseConfigHook")(hookFields) {}

export const HookRisk = Schema.Literals(["writes-local", "externally-visible", "irreversible"])
export type HookRisk = typeof HookRisk.Type

export class ReleaseConfigAfterHook extends Schema.Class<ReleaseConfigAfterHook>("ReleaseConfigAfterHook")({
  ...hookFields,
  risk: defaulted(HookRisk, "writes-local")
}) {}

export class ReleaseConfigCustomPublish extends Schema.Class<ReleaseConfigCustomPublish>(
  "ReleaseConfigCustomPublish"
)({ ...hookFields, risk: defaulted(HookRisk, "externally-visible") }) {}

export type ReleaseConfigRiskHook = ReleaseConfigAfterHook | ReleaseConfigCustomPublish

export const hookOperation = Effect.fn("hooks.operation")(function*(
  entry: ReleaseConfigHook,
  options: {
    readonly idPrefix: string
    readonly pipeId: string
    readonly field: string
    readonly phase: OperationPhase
    readonly risk: HookRisk
    readonly identity: ReleaseIdentity
    readonly description: string
  }
) {
  const rendered = yield* Effect.forEach(entry.run, (part) => renderCommandTemplateEffect(
    part,
    { identity: options.identity },
    { pipeId: options.pipeId, field: options.field }
  ))
  const executable = rendered[0]
  if (executable === undefined || executable.length === 0) return yield* Effect.fail(PlanError.make({
    pipeId: options.pipeId,
    field: options.field,
    reason: "Hook run must render to at least one non-empty argv entry."
  }))
  const env = entry.env ?? []
  return featureOperation({
    id: `${options.idPrefix}:${entry.id}`,
    phase: options.phase,
    risk: options.risk,
    description: options.description,
    action: CommandAction.make({ command: CommandSpec.make({
      executable,
      args: rendered.slice(1),
      ...(entry.cwd === undefined ? {} : { cwd: entry.cwd }),
      requiredEnv: env,
      redactedEnv: env
    }) })
  })
})

export const hooksBeforePlanner = featurePlanner<ReadonlyArray<ReleaseConfigHook>>(
  "hooks:before",
  (entries, state) => Effect.forEach(entries, (entry) => hookOperation(entry, {
    idPrefix: "hook:before",
    pipeId: "hooks:before",
    field: "hooks.before[].run",
    phase: "build",
    risk: "writes-local",
    identity: state.identity,
    description: `Run ${entry.id} hook.`
  })).pipe(Effect.map((operations) => ({ operations })))
)
