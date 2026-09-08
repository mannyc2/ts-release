import { Effect } from "effect";
import { type Operation } from "@mannyc1/ts-release";
import { File, type ArtifactAccess } from "@mannyc1/ts-release/bundle";
import type { HttpProviderDefinition, HttpRead } from "@mannyc1/ts-release/http";
import { UploadIntent } from "./Model.js";
export declare const upload: (input: UploadIntent, dependsOn?: readonly string[]) => Effect.Effect<Operation, import("@mannyc1/ts-release").ReleaseError, never>;
/** Validate the complete selected per-file set before creating its independent operations. */
export declare const author: (input: readonly (import("./Model.js").WheelUpload | import("./Model.js").SdistUpload)[]) => Effect.Effect<Operation[], import("@mannyc1/ts-release").ReleaseError, never>;
export declare const inspectDistribution: (file: File, filename: string, dependencies: ArtifactAccess) => Effect.Effect<import("./Model.js").DistributionMetadata, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const definitions: (dependencies: ArtifactAccess & {
    readonly read: HttpRead;
}) => readonly HttpProviderDefinition[];
