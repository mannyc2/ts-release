import * as Model from "./Model.js";
export declare const inspect: (filename: string, bytes: Uint8Array) => {
    metadata: Model.DistributionMetadata;
    fields: (readonly [string, string])[];
};
