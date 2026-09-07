import { type Author } from "@mannyc1/ts-release";
import { type HttpProviderDefinition, type HttpRead } from "@mannyc1/ts-release/http";
import { PublishIntent } from "./Model.js";
export declare const publish: Author<PublishIntent>;
export declare const readScope: (value: string) => PublishIntent;
export declare const publishUrl: (value: PublishIntent) => string;
export declare const observationUrl: (value: PublishIntent) => string;
export declare const definitions: (dependencies: {
    readonly read: HttpRead;
}) => readonly HttpProviderDefinition[];
