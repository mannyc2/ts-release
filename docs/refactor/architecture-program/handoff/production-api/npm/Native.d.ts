import * as Schema from "effect/Schema";
import * as Model from "./Model.js";
import { type ArtifactAccess } from "@mannyc1/ts-release/bundle";
export declare const failure: (code: string, message: string) => import("@mannyc1/ts-release").ReleaseError, invalid: (code: string) => never, reject: (code: string, message: string) => import("effect/Effect").Effect<never, import("@mannyc1/ts-release").ReleaseError>, attempt: <A>(body: () => A) => import("effect/Effect").Effect<A, import("@mannyc1/ts-release").ReleaseError, never>, matches: (body: () => boolean) => boolean, object: (value: unknown) => Record<string, unknown>, own: <A, I>(codec: Schema.Codec<A, I>, input: unknown) => A, ownOperation: <A, I>(codec: Schema.Codec<A, I>, descriptor: Pick<import("@mannyc1/ts-release").ProviderDescriptor, "definitionId" | "intentVersion">, operation: import("@mannyc1/ts-release").Operation) => A, ownRequest: (request: import("@mannyc1/ts-release").PreparedRequest) => import("@mannyc1/ts-release").PreparedRequest;
export declare const digest: (algorithm: string, bytes: Uint8Array) => string;
export declare const encode: (input: unknown) => Uint8Array<ArrayBuffer>;
export { decodeJson as parseJson } from "@mannyc1/ts-release/http";
/** Native package metadata is extracted from the exact bounded owned tarball. */
export declare const readManifest: (bytes: Uint8Array) => Record<string, unknown>;
export declare const captureArtifacts: (access: ArtifactAccess) => Readonly<{
    has: (input: import("@mannyc1/ts-release/bundle").Artifact) => boolean;
    read: (input: import("@mannyc1/ts-release/bundle").File) => import("effect/Effect").Effect<Uint8Array<ArrayBuffer>, import("@mannyc1/ts-release").ReleaseError, never>;
}>;
export declare const metadataUrl: (packageName: string) => string;
declare const NativeScope_base: Schema.Class<NativeScope, Schema.Struct<{
    readonly definitionId: Schema.Literals<readonly ["npm.publish", "npm.dist-tag"]>;
    readonly intent: Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<Model.PublishIntent, {
        readonly registry: "https://registry.npmjs.org/";
        readonly name: string;
        readonly version: string;
        readonly tarball: {
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
        readonly integrity: string;
        readonly shasum: string;
        readonly initialTag: string;
        readonly access: "public";
        readonly authorization: {
            readonly _tag: "TokenAuthorization";
            readonly principal: string;
        } | {
            readonly _tag: "TrustedAuthorization";
            readonly principal: string;
            readonly repository: string;
            readonly workflow: string;
            readonly workflowRef: string;
            readonly issuer: "https://token.actions.githubusercontent.com";
            readonly audience: "npm:registry.npmjs.org";
        };
        readonly provenance: {
            readonly _tag: "NoProvenance";
        } | {
            readonly _tag: "GitHubActionsProvenance";
            readonly source: {
                readonly format: "npm-github-actions-provenance-source/v1";
                readonly serverUrl: "https://github.com";
                readonly repository: string;
                readonly workflow: string;
                readonly workflowRef: string;
                readonly sourceRef: string;
                readonly sourceCommit: string;
                readonly eventName: string;
                readonly repositoryId: string;
                readonly repositoryOwnerId: string;
                readonly runnerEnvironment: string;
                readonly runId: string;
                readonly runAttempt: string;
                readonly repositoryVisibility: "public";
            };
            readonly bundle: {
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
            readonly mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json";
        };
    }, readonly [Schema.Struct<{
        readonly registry: Schema.Literal<"https://registry.npmjs.org/">;
        readonly name: Schema.String;
        readonly version: Schema.String;
        readonly tarball: typeof import("@mannyc1/ts-release/bundle").File;
        readonly integrity: Schema.String;
        readonly shasum: Schema.String;
        readonly initialTag: Schema.String;
        readonly access: Schema.Literal<"public">;
        readonly authorization: Schema.Union<readonly [typeof Model.TokenAuthorization, typeof Model.TrustedAuthorization]>;
        readonly provenance: Schema.Union<readonly [typeof Model.NoProvenance, typeof Model.GitHubActionsProvenance]>;
    }>], {
        readonly registry: "https://registry.npmjs.org/";
        readonly name: string;
        readonly version: string;
        readonly tarball: {
            readonly _tag: "OwnedFile";
            readonly logicalName: string & import("effect/Brand").Brand<"effect-build/Artifact/PortableRelativePath">;
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
        readonly integrity: string;
        readonly shasum: string;
        readonly initialTag: string;
        readonly access: "public";
        readonly authorization: {
            readonly _tag: "TokenAuthorization";
            readonly principal: string;
        } | {
            readonly _tag: "TrustedAuthorization";
            readonly principal: string;
            readonly repository: string;
            readonly workflow: string;
            readonly workflowRef: string;
            readonly issuer: "https://token.actions.githubusercontent.com";
            readonly audience: "npm:registry.npmjs.org";
        };
        readonly provenance: {
            readonly _tag: "NoProvenance";
        } | {
            readonly _tag: "GitHubActionsProvenance";
            readonly source: {
                readonly format: "npm-github-actions-provenance-source/v1";
                readonly serverUrl: "https://github.com";
                readonly repository: string;
                readonly workflow: string;
                readonly workflowRef: string;
                readonly sourceRef: string;
                readonly sourceCommit: string;
                readonly eventName: string;
                readonly repositoryId: string;
                readonly repositoryOwnerId: string;
                readonly runnerEnvironment: string;
                readonly runId: string;
                readonly runAttempt: string;
                readonly repositoryVisibility: "public";
            };
            readonly bundle: {
                readonly _tag: "OwnedFile";
                readonly logicalName: string & import("effect/Brand").Brand<"effect-build/Artifact/PortableRelativePath">;
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
            readonly mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json";
        };
    }>, Schema.Struct<{
        readonly registry: Schema.Literal<"https://registry.npmjs.org/">;
        readonly name: Schema.String;
        readonly version: Schema.String;
        readonly tarball: typeof import("@mannyc1/ts-release/bundle").File;
        readonly integrity: Schema.String;
        readonly shasum: Schema.String;
        readonly initialTag: Schema.String;
        readonly access: Schema.Literal<"public">;
        readonly authorization: Schema.Union<readonly [typeof Model.TokenAuthorization, typeof Model.TrustedAuthorization]>;
        readonly provenance: Schema.Union<readonly [typeof Model.NoProvenance, typeof Model.GitHubActionsProvenance]>;
    }>, never, never>, typeof Model.DistTagIntent]>;
}>, {}>;
export declare class NativeScope extends NativeScope_base {
}
export declare const scopeFor: (input: Model.PublishIntent | Model.DistTagIntent) => string;
export declare const readScope: (scope: string) => NativeScope;
export declare const endpointFor: (scope: NativeScope, read?: boolean) => string;
