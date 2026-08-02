import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { existsSync, realpathSync, statSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { contained } from "../drivers/contain.js"
import type { ReleaseApiServices } from "./types.js"
import type { ReleaseApiPhase } from "./errors.js"
import { ReleaseApiError } from "./errors.js"
import {
  ExecutionReviewId,
  ExecutionTopologyHash,
  OperationId,
  PlanId,
  PublishReviewId,
  WorkspaceRoot
} from "../model/primitives.js"
import { ExecutionScope, Stage } from "../model/run.js"
import type { ExecutionScopeInput } from "./types.js"

export type ApiRun = <A, E>(
  phase: ReleaseApiPhase,
  effect: Effect.Effect<A, E, ReleaseApiServices>
) => Promise<A>

// The one untrusted boundary decodes with the same dialect as durable data:
// Effect Schema, excess properties rejected, values validated. There is no
// hand-rolled key checker to drift from.
const ScopeInputSchema = Schema.Union([
  Schema.Literal("all"),
  Schema.Struct({ operationIds: Schema.NonEmptyArray(Schema.String) })
])
export const PlanInputSchema = Schema.Struct({
  config: Schema.Unknown,
  workspace: Schema.String
})
export const ReviewExecutionInputSchema = Schema.Struct({
  planBytes: Schema.String,
  expectedPlanId: PlanId,
  scope: ScopeInputSchema
})
const OperatorResolutionSchema = Schema.Struct({
  operationId: Schema.String,
  outcome: Schema.Literals(["committed", "absent"]),
  operator: Schema.NonEmptyString,
  reason: Schema.NonEmptyString
})
const NewRunSchema = Schema.Struct({
  path: Schema.String,
  scope: ScopeInputSchema,
  executionReviewId: ExecutionReviewId,
  reviewer: Schema.String,
  reason: Schema.optionalKey(Schema.String)
})
const PublishConfirmationSchema = Schema.Struct({
  publishReviewId: PublishReviewId,
  reviewer: Schema.String
})
export const ApplyInputSchema = Schema.Struct({
  planBytes: Schema.String,
  expectedPlanId: PlanId,
  workspace: Schema.String,
  newRun: Schema.optionalKey(NewRunSchema),
  resumeRunPath: Schema.optionalKey(Schema.String),
  through: Schema.optionalKey(Stage),
  publishConfirmation: Schema.optionalKey(PublishConfirmationSchema),
  reconcile: Schema.optionalKey(Schema.Array(Schema.String)),
  resolutions: Schema.optionalKey(Schema.Array(OperatorResolutionSchema)),
  retry: Schema.optionalKey(Schema.Array(Schema.String))
}).check(Schema.makeFilter((value: {
  readonly newRun?: unknown
  readonly resumeRunPath?: unknown
}) =>
  (value.newRun === undefined) === (value.resumeRunPath === undefined)
    ? "Choose exactly one of newRun or resumeRunPath."
    : undefined))
export type DecodedApplyInput = typeof ApplyInputSchema.Type

export const decodeInput = <S extends Schema.Top & Schema.Decoder<unknown>>(
  phase: ReleaseApiPhase,
  schema: S,
  value: unknown
): S["Type"] => {
  try {
    return Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(value) as S["Type"]
  } catch (cause) {
    // Bounded: decode errors echo offending values, never whole documents.
    throw new ReleaseApiError(
      phase,
      String(cause).split("\n").slice(0, 8).join("\n").slice(0, 500)
    )
  }
}

export const workspace = (phase: ReleaseApiPhase, value: string): WorkspaceRoot => {
  if (!isAbsolute(value) || value.length === 0) {
    throw new ReleaseApiError(phase, "Workspace must be a nonempty absolute path.")
  }
  const canonical = realpathSync(value)
  if (!statSync(canonical).isDirectory()) {
    throw new ReleaseApiError(phase, "Workspace must be a directory.")
  }
  return WorkspaceRoot.make(canonical)
}

export const within = (root: string, value: string): string => {
  const path = isAbsolute(value) ? resolve(value) : resolve(root, value)
  const child = relative(root, path)
  if (child === ".." || child.startsWith(`..${sep}`)) {
    throw new ReleaseApiError("apply", "Run path must remain inside the workspace.")
  }
  // A symlinked directory component must not relocate run state outside the
  // workspace: canonicalize the nearest existing ancestor (the final
  // components may not exist yet) and re-check against the realpathed root.
  let ancestor = dirname(path)
  while (!existsSync(ancestor)) ancestor = dirname(ancestor)
  if (!contained(root, realpathSync(ancestor))) {
    throw new ReleaseApiError("apply", "Run path must remain inside the workspace.")
  }
  return path
}

// The single-machine constant keeps one home; there is no topology input.
export const topology = (): ExecutionTopologyHash =>
  ExecutionTopologyHash.make("single-machine/v1")

export const selectScope = (
  accepted: {
    readonly operationHashes: ReadonlyArray<{ readonly operationId: string }>
    readonly dependencies: ReadonlyArray<{
      readonly operationId: string
      readonly producerId: string
    }>
  },
  input: ExecutionScopeInput
): ExecutionScope => {
  const available = accepted.operationHashes.map(({ operationId }) => operationId)
  const requested = input === "all" ? available : input.operationIds
  if (requested.length === 0) {
    throw new ReleaseApiError("review", "Execution scope must be nonempty.")
  }
  const ids = [...new Set(requested.map(String))]
  if (ids.some((id) => !available.includes(id))) {
    throw new ReleaseApiError("review", "Execution scope names an unknown operation.")
  }
  const selected = new Set(ids)
  if (accepted.dependencies.some((edge) =>
    selected.has(edge.operationId) && !selected.has(edge.producerId))) {
    throw new ReleaseApiError("review", "Execution scope is not dependency-closed.")
  }
  return ExecutionScope.make({
    operationIds: available.filter((id) => selected.has(id)).map((id) => OperationId.make(id))
  })
}
