import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import { type HostShape } from "../internal/Host.js";
import { type OwnedBundle } from "../internal/ArtifactModel.js";
import { ReleaseError } from "../internal/Error.js";
import { type RunOptions } from "../internal/ReleaseModel.js";
import { FinalizedReport } from "../internal/FinalizedReport.js";
export { FinalizedReport };
export interface Application {
    readonly bundle: OwnedBundle;
    readonly host: HostShape;
    readonly options: RunOptions;
}
export type CreateApplication = (input: unknown) => Effect.Effect<Application, ReleaseError, Scope.Scope>;
/** This explicit path selects trusted application code. Neither Plan nor Journal
 * data can choose an import. The application supplies its complete host layers. */
export declare const runApplication: (applicationPath: string, input: unknown, signal?: AbortSignal) => Promise<FinalizedReport>;
