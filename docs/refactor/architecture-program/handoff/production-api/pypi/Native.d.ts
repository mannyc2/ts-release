import { UploadIntent } from "./Model.js";
export declare const invalid: (code: string) => never, attempt: <A>(body: () => A) => import("effect/Effect").Effect<A, import("@mannyc1/ts-release").ReleaseError, never>, matches: (body: () => boolean) => boolean, object: (value: unknown) => Record<string, unknown>, own: <A, I>(codec: import("effect/Schema").Codec<A, I>, input: unknown) => A, ownOperation: <A, I>(codec: import("effect/Schema").Codec<A, I>, descriptor: Pick<import("@mannyc1/ts-release").ProviderDescriptor, "definitionId" | "intentVersion">, operation: import("@mannyc1/ts-release").Operation) => A, ownRequest: (request: import("@mannyc1/ts-release").PreparedRequest) => import("@mannyc1/ts-release").PreparedRequest;
export declare const encode: (input: unknown) => Uint8Array<ArrayBuffer>;
export declare const digest: (bytes: Uint8Array) => string;
export declare const scopeFor: (intent: UploadIntent) => string;
export declare const readScope: (scope: string) => import("./Model.js").WheelUpload | import("./Model.js").SdistUpload;
export declare const MAX_BYTES: number;
