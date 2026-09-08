import { Effect, Schema } from "effect";
import * as Core from "@mannyc1/ts-release";
import * as Bundle from "@mannyc1/ts-release/bundle";
import type { HttpRead, HttpProviderDefinition } from "@mannyc1/ts-release/http";
import * as Model from "./Model.js";
export declare const publishDescriptor: {
    definitionId: "npm.publish";
    intentVersion: "1";
    intentCodec: Schema.Codec<Model.PublishIntent, {
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
    }, never, never>;
};
export declare const tagDescriptor: {
    definitionId: "npm.dist-tag";
    intentVersion: "1";
    intentCodec: Schema.Codec<Model.DistTagIntent, {
        readonly registry: "https://registry.npmjs.org/";
        readonly name: string;
        readonly version: string;
        readonly tag: string;
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
    }, never, never>;
};
export declare const publish: (input: Model.PublishIntent, dependsOn?: readonly string[]) => Effect.Effect<Core.Operation, Core.ReleaseError, never>;
export declare const distTag: (input: Model.DistTagIntent, dependsOn?: readonly string[]) => Effect.Effect<Core.Operation, Core.ReleaseError, never>;
export declare const author: (input: {
    readonly packages: readonly Model.PackageCandidate[];
    readonly tagMoves: readonly Model.DistTagIntent[];
}) => Effect.Effect<{
    operations: Core.Operation[];
    omittedPrivate: Model.PrivatePackage[];
}, Core.ReleaseError, never>;
/** Explicit provider composition. Artifact membership is admitted with every
 * Plan before reads; exact bytes and native metadata are checked before sends. */
export declare const definitions: (dependencies: Bundle.ArtifactAccess & {
    readonly read: HttpRead;
    readonly verifyProvenance?: Model.VerifyProvenance;
}) => readonly HttpProviderDefinition[];
/** Read exact owned bytes once to author immutable native package coordinates. */
export declare const inspectTarball: (file: Bundle.File, dependencies: Bundle.ArtifactAccess) => Effect.Effect<Model.PackageMetadata, Core.ReleaseError, never>;
