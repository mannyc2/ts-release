import { RequestFacts, type PreparedRequest } from "@mannyc1/ts-release";
import type { UploadIntent } from "./Model.js";
export declare const multipart: (intent: UploadIntent, bytes: Uint8Array) => {
    body: Uint8Array<ArrayBuffer>;
    headers: readonly [readonly ["accept", "text/plain, application/json;q=0.1"], readonly ["content-type", `multipart/form-data; boundary=${string}`]];
};
export declare const ownsFacts: (facts: RequestFacts) => boolean;
export declare const ownsRequest: (request: PreparedRequest) => boolean;
export declare const requestMatches: (intent: UploadIntent, facts: RequestFacts) => boolean;
