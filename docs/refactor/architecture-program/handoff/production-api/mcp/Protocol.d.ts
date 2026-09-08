import * as Core from "@mannyc1/ts-release";
import type { HttpProviderDefinition, HttpRead } from "@mannyc1/ts-release/http";
import * as Model from "./Model.js";
export declare const publish: Core.Author<Model.PublishIntent>;
export declare const readScope: (value: string) => Model.PublishIntent;
export declare const publishUrl: (value: Model.PublishIntent) => string;
export declare const observationUrl: (value: Model.PublishIntent) => string;
export declare const definitions: (dependencies: {
    readonly read: HttpRead;
}) => readonly HttpProviderDefinition[];
