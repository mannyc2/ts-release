import * as Effect from "effect/Effect";
import { type Operation } from "@mannyc1/ts-release";
import * as Model from "./Model.js";
export declare const descriptors: {
    readonly lightweight: {
        readonly definitionId: "github.lightweight-tag";
        readonly intentVersion: "1";
        readonly intentCodec: typeof Model.LightweightTag;
    };
    readonly object: {
        readonly definitionId: "github.annotated-tag";
        readonly intentVersion: "1";
        readonly intentCodec: typeof Model.AnnotatedTag;
    };
    readonly ref: {
        readonly definitionId: "github.annotated-ref";
        readonly intentVersion: "1";
        readonly intentCodec: typeof Model.AnnotatedRef;
    };
    readonly draft: {
        readonly definitionId: "github.draft";
        readonly intentVersion: "1";
        readonly intentCodec: typeof Model.DraftIntent;
    };
    readonly asset: {
        readonly definitionId: "github.asset";
        readonly intentVersion: "1";
        readonly intentCodec: typeof Model.AssetIntent;
    };
    readonly publish: {
        readonly definitionId: "github.publish";
        readonly intentVersion: "1";
        readonly intentCodec: typeof Model.PublishIntent;
    };
};
export type Kind = keyof typeof descriptors;
export type Intent = Model.LightweightTag | Model.AnnotatedTag | Model.AnnotatedRef | Model.DraftIntent | Model.AssetIntent | Model.PublishIntent;
export declare const kindOf: (operation: Operation) => Kind;
export declare const intentOf: (operation: Operation) => Intent;
export declare const lightweightTag: (input: Model.LightweightTag, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const annotatedTag: (input: Model.AnnotatedTag, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const annotatedRef: (input: Model.AnnotatedRef, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const draft: (input: Model.DraftIntent, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const uploadAsset: (input: Model.AssetIntent, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const publish: (input: Model.PublishIntent, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, import("@mannyc1/ts-release").ReleaseError, never>;
/** All selected native relationships are admitted before the first provider effect. */
export declare const validatePlan: (operations: readonly Operation[]) => void;
