/** Research P09 only: reviewed one-shot import, never a dual runtime reader. */
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { EventBody, JournalEvent, LabError, type Plan, type ProviderDefinition } from "./contracts.js"
import { attempt, canonical, fail, hashCanonical, loadPlan, verifyEvents, verifyNativeEvidence } from "./identity.js"
import { historyMachine } from "./m1-history.js"

class LegacyEvent extends Schema.Class<LegacyEvent>("LegacyRecoveryEvent")({
  format: Schema.Literal("architecture-lab/event/1"), eventId: Schema.String,
  journalId: Schema.String, planId: Schema.String, body: EventBody
}) {}

export const migrateRecoveryHistory = Effect.fn("lab.reviewedRecoveryImport")(function*(options: {
  readonly plan: Plan
  readonly providers: ReadonlyArray<ProviderDefinition>
  readonly source: unknown
  readonly reviewedSourceSha256: string
  readonly authorize: boolean
}) {
  if (!options.authorize) return yield* Effect.fail(new LabError({ code: "migration-approval", message: "One-shot import requires explicit approval of the exact source hash" }))
  const plan = yield* loadPlan(options.plan, options.providers)
  const source = yield* attempt(() => Schema.decodeUnknownSync(Schema.Array(LegacyEvent), { onExcessProperty: "error" })(options.source))
  const digest = yield* hashCanonical("architecture-lab/recovery-import-source/1", source)
  if (digest !== options.reviewedSourceSha256) return yield* Effect.fail(new LabError({ code: "migration-source", message: "Reviewed source hash differs from the exact input" }))
  yield* attempt(() => {
    if (canonical(source) !== canonical(options.source)) fail("migration-canonical", "Migration source must already be canonical data")
    let closed = false
    for (const event of source) {
      if (closed) fail("legacy-closed", "Legacy input contains facts its closed recovery rule could not represent")
      closed = event.body._tag === "PlanSuperseded"
    }
  })
  // Identity, request facts and authority are preserved byte-for-byte. Only the
  // format discriminator changes; no started fact, receipt, or permit is inferred.
  const converted = source.map((event) => new JournalEvent({ ...event, format: "architecture-lab/event/2" }))
  const verified = yield* verifyEvents(plan, converted, plan.journalId)
  yield* attempt(() => {
    verifyNativeEvidence(plan, verified, options.providers)
    historyMachine(plan, verified)
  })
  return verified
})
