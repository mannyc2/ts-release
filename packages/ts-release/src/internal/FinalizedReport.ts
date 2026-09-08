import { Effect, Schema } from "effect"
import { OwnedBundle } from "./ArtifactModel.js"
import { encodeBundle } from "./BundleCodec.js"
import { currentHost, read } from "./Host.js"
import { JournalEvent, Plan } from "./ReleaseModel.js"
import { attempt, reject } from "./Error.js"
import { decodeOwned, sha256 } from "./Identity.js"
import { loadPlan } from "../Plan.js"
import { finalize } from "./BundleFinalize.js"

/** The machine's status projection is ephemeral. The application emits this
 * complete derived view, retaining canonical inputs rather than another model. */
export class FinalizedReport extends Schema.Class<FinalizedReport>("ts-release/FinalizedReport")({
  format: Schema.Literal("ts-release/report/1"),
  bundle: OwnedBundle,
  plan: Plan,
  preparations: Schema.Array(Plan),
  journal: Schema.Struct({
    journalId: Schema.String,
    revision: Schema.Number,
    events: Schema.Array(JournalEvent),
  }),
  superseded: Schema.Boolean,
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
      dispatches: Schema.Number,
      receipts: Schema.Number,
      observations: Schema.Number,
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
      journal: { journalId: plan.journalId, ...current.snapshot },
      superseded: report.superseded,
      operations: report.operations,
    }),
  )
})
