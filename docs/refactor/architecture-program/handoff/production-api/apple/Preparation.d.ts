import { Effect } from "effect";
import * as Notary from "effect-build-apple/Notary";
import { Content } from "../internal/ArtifactModel.js";
import { type ContentOwner } from "../internal/Content.js";
import { Host } from "../internal/Host.js";
import { ReleaseError } from "../internal/Error.js";
import { Plan, type JournalEvent, type RunOptions } from "../internal/ReleaseModel.js";
import { ApplePreparations, ReadyToPlan } from "./Model.js";
import type { AppleEvidence } from "./Model.js";
export declare const preparationScopes: (input: ApplePreparations) => Effect.Effect<{
    readonly _tag: "PreparationScope";
    readonly plan: Plan;
}[], ReleaseError, never>;
/** Dispatch and native completion both pass through the common history laws.
 * An accepted submission is the sole polling handle; no missing ID is guessed. */
export declare const runPreparation: (inputs: ApplePreparations, preparationId: string, options: Omit<RunOptions, "plan">, complete: (submission: Notary.Submission, preparationId: string) => Effect.Effect<AppleEvidence, ReleaseError>) => Effect.Effect<undefined, ReleaseError, Host>;
export declare const validateApplePublication: (inputs: ApplePreparations, publication: Plan, finalBundleContent: Content, owner: ContentOwner) => Effect.Effect<ReadyToPlan[], import("../internal/ArtifactModel.js").AdoptionError | ReleaseError, Host>;
export declare const reportAppleContext: (inputs: ApplePreparations, owner: ContentOwner, publication?: {
    readonly plan: Plan;
    readonly finalBundleContent: Content;
} | undefined) => Effect.Effect<{
    publication?: {
        revision: number;
        planId: string;
        superseded: boolean;
        operations: {
            operationId: string;
            status: import("../internal/ReleaseModel.js").OperationStatus;
            dispatches: number;
            receipts: number;
            observations: number;
        }[];
    };
    journalId: string;
    revision: number;
    preparations: {
        revision: number;
        planId: string;
        superseded: boolean;
        operations: {
            operationId: string;
            status: import("../internal/ReleaseModel.js").OperationStatus;
            dispatches: number;
            receipts: number;
            observations: number;
        }[];
    }[];
    nativeFacts: JournalEvent[];
}, import("../internal/ArtifactModel.js").AdoptionError | ReleaseError, Host>;
