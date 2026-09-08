import { NoReplay, RequestFacts, type Operation } from "@mannyc1/ts-release";
import type { PreparedRequest, ProviderContext } from "@mannyc1/ts-release";
import { BoundScope } from "./Binding.js";
export declare const sha256: (bytes: Uint8Array) => string;
export declare const nativeRequest: (scope: BoundScope, bytes?: Uint8Array) => {
    transport: "core.http/1";
    endpoint: string;
    method: string;
    principal: string;
    scope: string;
    replay: NoReplay;
    headers: (readonly ["accept", "application/vnd.github+json"] | readonly ["x-github-api-version", "2022-11-28"] | readonly ["user-agent", "ts-release"] | readonly ["content-type", string])[];
    body: Uint8Array<ArrayBufferLike>;
};
export declare const requestMatches: (scope: BoundScope, request: RequestFacts) => boolean;
export declare const ownsRequest: (request: PreparedRequest) => boolean;
export declare const requestCorresponds: (operation: Operation, request: RequestFacts, context: ProviderContext) => boolean;
