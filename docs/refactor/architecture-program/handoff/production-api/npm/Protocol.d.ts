import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ReleaseError, type Operation } from "@mannyc1/ts-release";
import { File, type ArtifactAccess } from "@mannyc1/ts-release/bundle";
import type { HttpRead, HttpProviderDefinition } from "@mannyc1/ts-release/http";
import { PublishIntent, DistTagIntent, PackageCandidate, PrivatePackage, PackageMetadata, type VerifyProvenance } from "./Model.js";
export declare const publishDescriptor: {
    definitionId: string;
    intentVersion: string;
    intentCodec: Schema.decodeTo<Schema.declareConstructor<PublishIntent, {
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
        readonly name: Schema.NonEmptyString;
        readonly version: Schema.NonEmptyString;
        readonly tarball: typeof File;
        readonly integrity: Schema.String;
        readonly shasum: Schema.String;
        readonly initialTag: Schema.NonEmptyString;
        readonly access: Schema.Literal<"public">;
        readonly authorization: Schema.Union<readonly [typeof import("./Model.js").TokenAuthorization, typeof import("./Model.js").TrustedAuthorization]>;
        readonly provenance: Schema.Union<readonly [typeof import("./Model.js").NoProvenance, typeof import("./Model.js").GitHubActionsProvenance]>;
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
        readonly name: Schema.NonEmptyString;
        readonly version: Schema.NonEmptyString;
        readonly tarball: typeof File;
        readonly integrity: Schema.String;
        readonly shasum: Schema.String;
        readonly initialTag: Schema.NonEmptyString;
        readonly access: Schema.Literal<"public">;
        readonly authorization: Schema.Union<readonly [typeof import("./Model.js").TokenAuthorization, typeof import("./Model.js").TrustedAuthorization]>;
        readonly provenance: Schema.Union<readonly [typeof import("./Model.js").NoProvenance, typeof import("./Model.js").GitHubActionsProvenance]>;
    }>, never, never>;
};
export declare const tagDescriptor: {
    definitionId: string;
    intentVersion: string;
    intentCodec: typeof DistTagIntent;
};
export declare const publish: (input: PublishIntent, dependsOn?: readonly string[]) => Effect.Effect<Operation, ReleaseError, never>;
export declare const distTag: (input: DistTagIntent, dependsOn?: readonly string[]) => Effect.Effect<Operation, ReleaseError, never>;
export declare const author: (input: {
    readonly packages: readonly PackageCandidate[];
    readonly tagMoves: readonly DistTagIntent[];
}) => Effect.Effect<{
    operations: Operation[];
    omittedPrivate: PrivatePackage[];
}, ReleaseError, never>;
/** Explicit provider composition. Artifact membership is admitted with every
 * Plan before reads; exact bytes and native metadata are checked before sends. */
export declare const definitions: (dependencies: ArtifactAccess & {
    readonly read: HttpRead;
    readonly verifyProvenance?: VerifyProvenance;
}) => readonly HttpProviderDefinition[];
/** Read exact owned bytes once to author immutable native package coordinates. */
export declare const inspectTarball: (file: File, dependencies: ArtifactAccess) => Effect.Effect<PackageMetadata, ReleaseError, never>;
