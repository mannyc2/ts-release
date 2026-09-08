import * as Effect from "effect/Effect";
import type { Operation, ProviderContext } from "@mannyc1/ts-release";
import type { HttpRead } from "@mannyc1/ts-release/http";
import { Missing, Present, Unavailable } from "./Evidence.js";
export declare const PUBLIC_DOWNLOAD = "github:public-download";
export declare const publicDownload: (value: string) => boolean;
export declare const observations: (read: HttpRead) => {
    observe: (operation: Operation, context: ProviderContext) => Effect.Effect<{
        evidence: Present | Missing | Unavailable;
        status: "Satisfied" | "Pending" | "Conflict" | "Inconclusive" | "Absent";
    }, import("@mannyc1/ts-release").ReleaseError, never>;
    preflight: (operation: Operation, context: ProviderContext) => Effect.Effect<undefined, import("@mannyc1/ts-release").ReleaseError, never>;
};
