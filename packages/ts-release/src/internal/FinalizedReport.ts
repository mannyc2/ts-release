import { Effect, Schema } from "effect"
import { OwnedBundle } from "./ArtifactModel.js"
import { encodeBundle } from "./BundleCodec.js"
import { currentHost, read } from "./Host.js"
import { JournalEvent, ObservationStatus, Plan } from "./ReleaseModel.js"
import { attempt, reject } from "./Error.js"
import { decodeOwned, sha256 } from "./Identity.js"
import { loadPlan } from "../Plan.js"
import { finalize } from "./BundleFinalize.js"

const visibilityStatus = Schema.Literals(["Pending", "Conflict", "Satisfied"])
const milliseconds = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const visibility = Schema.Struct({
  status: visibilityStatus,
  elapsedMilliseconds: milliseconds,
  budgetMilliseconds: milliseconds,
  operations: Schema.Array(
    Schema.Struct({
      operationId: Schema.String,
      status: visibilityStatus,
      lastObservation: Schema.optionalKey(
        Schema.Struct({
          eventId: Schema.String,
          status: ObservationStatus,
          observedAt: Schema.Finite,
        }),
      ),
    }),
  ),
})

/** The machine's status projection is ephemeral. The application emits this
 * complete derived view, retaining canonical inputs rather than another model. */
export class FinalizedReport extends Schema.Class<FinalizedReport>("ts-release/FinalizedReport")({
  format: Schema.Literal("ts-release/report/1"),
  bundle: OwnedBundle,
  plan: Plan,
  preparations: Schema.Array(Plan),
  supersededPlans: Schema.optionalKey(Schema.Array(Plan)),
  journal: Schema.Struct({
    journalId: Schema.String,
    revision: Schema.Finite,
    events: Schema.Array(JournalEvent),
  }),
  superseded: Schema.Boolean,
  /** Latest native observations, independent of acknowledgement or authority.
   * Present only for explicitly bounded observation invocations. */
  visibility: Schema.optionalKey(visibility),
  operations: Schema.Array(
    Schema.Struct({
      operationId: Schema.String,
      status: Schema.Literals([
        "Unattempted",
        "Satisfied",
        "Conflict",
        "Pending",
        "Inconclusive",
        "Rejected",
        "Superseded",
      ]),
      dispatches: Schema.Finite,
      receipts: Schema.Finite,
      observations: Schema.Finite,
    }),
  ),
}) {}

/** No permission is derived from this report, and no report is a journal reader. */
export const reportFinalizedRelease = Effect.fn("ts-release.reportFinalizedRelease")(function* (
  bundle: OwnedBundle,
  input: Plan,
) {
  const host = yield* currentHost
  const admitted = yield* attempt(() => decodeOwned(OwnedBundle, bundle))
  const owned = yield* finalize(admitted.artifacts)
  const plan = yield* loadPlan(input, host.providers)
  if (plan.bundleId !== (yield* sha256(encodeBundle(owned))))
    return yield* reject("report-bundle", "Report Bundle differs from its immutable Plan")
  const current = yield* read(host, plan)
  const report = current.report()
  return yield* attempt(() =>
    decodeOwned(FinalizedReport, {
      format: "ts-release/report/1",
      bundle: owned,
      plan,
      preparations: current.plans.filter((item) => item.planId !== plan.planId),
      ...(current.supersededPlans.length ? { supersededPlans: current.supersededPlans } : {}),
      journal: { journalId: plan.journalId, ...current.snapshot },
      superseded: report.superseded,
      operations: report.operations,
    }),
  )
})
