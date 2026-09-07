import { type ArtifactAccess } from "@mannyc1/ts-release/bundle";
import type { HttpProviderDefinition, HttpRead } from "@mannyc1/ts-release/http";
export declare const definitions: (dependencies: ArtifactAccess & {
    readonly read: HttpRead;
}) => readonly HttpProviderDefinition[];
