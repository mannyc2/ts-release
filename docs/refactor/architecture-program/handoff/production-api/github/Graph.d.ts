import * as Effect from "effect/Effect";
import { type Operation } from "@mannyc1/ts-release";
import * as Model from "./Model.js";
export declare const descriptors: {
    readonly lightweight: {
        definitionId: "github.lightweight-tag";
        intentVersion: "1";
        intentCodec: import("effect/Schema").Codec<Model.LightweightTag, {
            readonly repository: {
                readonly apiUrl: "https://api.github.com";
                readonly owner: string;
                readonly name: string;
            };
            readonly tag: string;
            readonly commit: string;
            readonly principal: string;
        }, never, never>;
    };
    readonly object: {
        definitionId: "github.annotated-tag";
        intentVersion: "1";
        intentCodec: import("effect/Schema").Codec<Model.AnnotatedTag, {
            readonly message: string;
            readonly tagger: {
                readonly name: string;
                readonly email: string;
                readonly date: string;
            };
            readonly repository: {
                readonly apiUrl: "https://api.github.com";
                readonly owner: string;
                readonly name: string;
            };
            readonly tag: string;
            readonly commit: string;
            readonly principal: string;
        }, never, never>;
    };
    readonly ref: {
        definitionId: "github.annotated-ref";
        intentVersion: "1";
        intentCodec: import("effect/Schema").Codec<Model.AnnotatedRef, {
            readonly repository: {
                readonly apiUrl: "https://api.github.com";
                readonly owner: string;
                readonly name: string;
            };
            readonly tag: string;
            readonly annotatedTagOperation: string;
            readonly principal: string;
        }, never, never>;
    };
    readonly draft: {
        definitionId: "github.draft";
        intentVersion: "1";
        intentCodec: import("effect/Schema").Codec<Model.DraftIntent, {
            readonly repository: {
                readonly apiUrl: "https://api.github.com";
                readonly owner: string;
                readonly name: string;
            };
            readonly tag: string;
            readonly tagSource: {
                readonly _tag: "ManagedTag";
                readonly operationId: string;
            } | {
                readonly _tag: "ExistingTag";
                readonly commit: string;
            };
            readonly title: string;
            readonly body: string;
            readonly prerelease: boolean;
            readonly principal: string;
        }, never, never>;
    };
    readonly asset: {
        definitionId: "github.asset";
        intentVersion: "1";
        intentCodec: import("effect/Schema").Codec<Model.AssetIntent, {
            readonly repository: {
                readonly apiUrl: "https://api.github.com";
                readonly owner: string;
                readonly name: string;
            };
            readonly draftOperation: string;
            readonly file: {
                readonly _tag: "OwnedFile";
                readonly logicalName: string;
                readonly content: {
                    readonly bytes: string;
                    readonly sha256: string;
                };
                readonly deliveryMode: import("effect-build/Artifact").FileMode;
                readonly executable: {
                    readonly nativeFormat: "elf" | "mach-o" | "pe";
                    readonly runtime: {
                        readonly name: string;
                        readonly version: string;
                    };
                    readonly target: "macos-x64" | "macos-aarch64" | "linux-x64-gnu" | "linux-x64-musl" | "linux-aarch64-gnu" | "linux-aarch64-musl" | "windows-x64" | "windows-aarch64";
                } | null;
                readonly provenance: import("effect-build/Artifact").Provenance;
            };
            readonly publicName: string;
            readonly mediaType: string;
            readonly principal: string;
        }, never, never>;
    };
    readonly publish: {
        definitionId: "github.publish";
        intentVersion: "1";
        intentCodec: import("effect/Schema").Codec<Model.PublishIntent, {
            readonly repository: {
                readonly apiUrl: "https://api.github.com";
                readonly owner: string;
                readonly name: string;
            };
            readonly draftOperation: string;
            readonly assetOperations: readonly string[];
            readonly principal: string;
        }, never, never>;
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
