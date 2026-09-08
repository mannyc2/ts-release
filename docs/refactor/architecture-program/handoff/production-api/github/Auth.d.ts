import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { Repository } from "./Model.js";
/** Repository/API routes are validated before the redacted token is opened.
 * Asset redirect reads have an explicit public principal and receive no token. */
export declare const authorizeToken: (input: {
    readonly repository: Repository;
    readonly binding: Readonly<{
        endpoint: string;
        principal: string;
        scope: string;
    }>;
    readonly token: Redacted.Redacted<string>;
}) => Effect.Effect<Readonly<Record<string, string>>, import("@mannyc1/ts-release").ReleaseError, never>;
