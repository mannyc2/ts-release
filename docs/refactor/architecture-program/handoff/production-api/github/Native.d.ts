import { type HttpResponse } from "@mannyc1/ts-release/http";
import * as Model from "./Model.js";
export declare const invalid: (code: string) => never, attempt: <A>(body: () => A) => import("effect/Effect").Effect<A, import("@mannyc1/ts-release").ReleaseError, never>, matches: (body: () => boolean) => boolean, object: (value: unknown) => Record<string, unknown>, own: <A, I>(codec: import("effect/Schema").Codec<A, I>, input: unknown) => A, ownOperation: <A, I>(codec: import("effect/Schema").Codec<A, I>, descriptor: Pick<import("@mannyc1/ts-release").ProviderDescriptor, "definitionId" | "intentVersion">, operation: import("@mannyc1/ts-release").Operation) => A, ownRequest: (request: import("@mannyc1/ts-release").PreparedRequest) => import("@mannyc1/ts-release").PreparedRequest;
export declare const api: (repository: Model.Repository) => string;
export declare const uploadTemplate: (repository: Model.Repository, id: string) => string;
/** GitHub repository coordinates are case-insensitive; native resource suffixes are exact. */
export declare const sameUrl: (actual: unknown, expected: string, repository: Model.Repository) => boolean;
export declare const id: (value: unknown) => string;
export declare const headers: readonly [readonly ["accept", "application/vnd.github+json"], readonly ["x-github-api-version", "2022-11-28"], readonly ["user-agent", "ts-release"]];
export declare const responseJson: (response: HttpResponse) => unknown;
export declare const responseObject: (response: HttpResponse) => Record<string, unknown>;
export declare const refFacts: (value: unknown, repository: Model.Repository) => Model.RefFacts;
export declare const tagFacts: (value: unknown, repository: Model.Repository) => Model.AnnotatedTagFacts;
export declare const releaseFacts: (value: unknown, repository: Model.Repository) => Model.ReleaseFacts;
export declare const assetFacts: (value: unknown, repository: Model.Repository, tag: string) => Model.AssetFacts;
export declare const assetUrls: (facts: Model.AssetFacts, repository: Model.Repository, tag: string) => boolean;
