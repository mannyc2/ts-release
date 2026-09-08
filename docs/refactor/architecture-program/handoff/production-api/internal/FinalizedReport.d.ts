import { Effect, Schema } from "effect";
import { OwnedBundle } from "./ArtifactModel.js";
import { JournalEvent, Plan } from "./ReleaseModel.js";
declare const FinalizedReport_base: Schema.Class<FinalizedReport, Schema.Struct<{
    readonly format: Schema.Literal<"ts-release/report/1">;
    readonly bundle: typeof OwnedBundle;
    readonly plan: typeof Plan;
    readonly preparations: Schema.$Array<typeof Plan>;
    readonly journal: Schema.Struct<{
        readonly journalId: Schema.String;
        readonly revision: Schema.Number;
        readonly events: Schema.$Array<typeof JournalEvent>;
    }>;
    readonly superseded: Schema.Boolean;
    readonly operations: Schema.$Array<Schema.Struct<{
        readonly operationId: Schema.String;
        readonly status: Schema.Literals<readonly ["Unattempted", "Satisfied", "Conflict", "Pending", "Inconclusive", "Rejected", "Superseded"]>;
        readonly dispatches: Schema.Number;
        readonly receipts: Schema.Number;
        readonly observations: Schema.Number;
    }>>;
}>, {}>;
/** The machine's status projection is ephemeral. The application emits this
 * complete derived view, retaining canonical inputs rather than another model. */
export declare class FinalizedReport extends FinalizedReport_base {
}
/** No permission is derived from this report, and no report is a journal reader. */
export declare const reportFinalizedRelease: (bundle: OwnedBundle, input: Plan) => Effect.Effect<FinalizedReport, import("./ArtifactModel.js").AdoptionError | import("./Error.js").ReleaseError, import("./Host.js").Host>;
export {};
