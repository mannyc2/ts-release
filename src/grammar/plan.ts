// Invariant: release-plan/v5 is the sole strict durable plan; machine-local facts and transient accumulator state are never encoded here.
import { createHash } from "node:crypto"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, SafeRelativePath } from "./artifact.js"
import { PlanIntegrityError } from "./errors.js"
import { parseJsonAs } from "./json.js"
import { Operation } from "./operation.js"
import { validateReleasePlan } from "./plan-rules.js"
import { ReleaseIdentity } from "./state.js"

export class ReleasePlan extends Schema.Class<ReleasePlan>("ReleasePlan")({
  schemaVersion: Schema.Literal("release-plan/v5"),
  identity: ReleaseIdentity,
  artifacts: Schema.Array(Artifact),
  operations: Schema.Array(Operation),
  evidenceDirectory: SafeRelativePath
}) {}

const releasePlanDecodeOptions = { onExcessProperty: "error" } as const

export const decodeReleasePlan = Schema.decodeUnknownEffect(ReleasePlan, releasePlanDecodeOptions)
export const decodeReleasePlanSync = Schema.decodeUnknownSync(ReleasePlan, releasePlanDecodeOptions)

// The one durable-read entry: unparseable text, a non-v5 document, and a contradictory plan all
// fail here, so no caller can reach an unvalidated plan by decoding directly (plan 169, D4).
export const readReleasePlan = (
  text: string
): Effect.Effect<ReleasePlan, PlanIntegrityError | Schema.SchemaError> =>
  parseJsonAs(Schema.Unknown, text, (cause) =>
    PlanIntegrityError.make({
      rule: "plan.json",
      reason: `Plan is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`
    })).pipe(
      Effect.flatMap(decodeReleasePlan),
      Effect.flatMap(validateReleasePlan)
    )

// v5 has no machine-local fields left, so the fingerprint covers the whole canonical
// document with no stripping (plan 169, D2). It lives here rather than in run/ so that
// render/ can import it as a value without crossing the render -> run layering rule.
export const planFingerprint = (plan: ReleasePlan): string =>
  createHash("sha256").update(JSON.stringify(Schema.encodeSync(ReleasePlan)(plan))).digest("hex")
