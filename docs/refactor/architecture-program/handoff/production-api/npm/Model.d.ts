import * as Schema from "effect/Schema";
import type * as Effect from "effect/Effect";
import { File } from "@mannyc1/ts-release/bundle";
import type { ReleaseError } from "@mannyc1/ts-release";
export declare const name: Schema.NonEmptyString;
export declare const version: Schema.NonEmptyString;
export declare const integrity: Schema.String;
export declare const shasum: Schema.String;
export declare const tag: Schema.NonEmptyString;
export declare const repository: Schema.NonEmptyString;
export declare const workflow: Schema.NonEmptyString;
export declare const ref: Schema.NonEmptyString;
export declare const principal: Schema.NonEmptyString;
declare const TokenAuthorization_base: Schema.Class<TokenAuthorization, Schema.TaggedStruct<"TokenAuthorization", {
    readonly principal: Schema.NonEmptyString;
}>, {}>;
export declare class TokenAuthorization extends TokenAuthorization_base {
}
declare const TrustedAuthorization_base: Schema.Class<TrustedAuthorization, Schema.TaggedStruct<"TrustedAuthorization", {
    readonly principal: Schema.NonEmptyString;
    readonly repository: Schema.NonEmptyString;
    readonly workflow: Schema.NonEmptyString;
    readonly workflowRef: Schema.NonEmptyString;
    readonly issuer: Schema.Literal<"https://token.actions.githubusercontent.com">;
    readonly audience: Schema.Literal<"npm:registry.npmjs.org">;
}>, {}>;
export declare class TrustedAuthorization extends TrustedAuthorization_base {
}
export declare const Authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof TrustedAuthorization]>;
export type Authorization = typeof Authorization.Type;
declare const ProvenanceSource_base: Schema.Class<ProvenanceSource, Schema.Struct<{
    readonly format: Schema.Literal<"npm-github-actions-provenance-source/v1">;
    readonly serverUrl: Schema.Literal<"https://github.com">;
    readonly repository: Schema.NonEmptyString;
    readonly workflow: Schema.NonEmptyString;
    readonly workflowRef: Schema.NonEmptyString;
    readonly sourceRef: Schema.NonEmptyString;
    readonly sourceCommit: Schema.NonEmptyString;
    readonly eventName: Schema.NonEmptyString;
    readonly repositoryId: Schema.NonEmptyString;
    readonly repositoryOwnerId: Schema.NonEmptyString;
    readonly runnerEnvironment: Schema.NonEmptyString;
    readonly runId: Schema.NonEmptyString;
    readonly runAttempt: Schema.NonEmptyString;
    readonly repositoryVisibility: Schema.Literal<"public">;
}>, {}>;
export declare class ProvenanceSource extends ProvenanceSource_base {
}
declare const NoProvenance_base: Schema.Class<NoProvenance, Schema.TaggedStruct<"NoProvenance", {}>, {}>;
export declare class NoProvenance extends NoProvenance_base {
}
declare const GitHubActionsProvenance_base: Schema.Class<GitHubActionsProvenance, Schema.TaggedStruct<"GitHubActionsProvenance", {
    readonly source: typeof ProvenanceSource;
    readonly bundle: typeof File;
    readonly mediaType: Schema.Literal<"application/vnd.dev.sigstore.bundle.v0.3+json">;
}>, {}>;
export declare class GitHubActionsProvenance extends GitHubActionsProvenance_base {
}
export declare const Provenance: Schema.Union<readonly [typeof NoProvenance, typeof GitHubActionsProvenance]>;
export type Provenance = typeof Provenance.Type;
export declare const registry: Schema.Literal<"https://registry.npmjs.org/">;
declare const PublishIntent_base: Schema.Class<PublishIntent, Schema.Struct<{
    readonly registry: Schema.Literal<"https://registry.npmjs.org/">;
    readonly name: Schema.NonEmptyString;
    readonly version: Schema.NonEmptyString;
    readonly tarball: typeof File;
    readonly integrity: Schema.String;
    readonly shasum: Schema.String;
    readonly initialTag: Schema.NonEmptyString;
    readonly access: Schema.Literal<"public">;
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof TrustedAuthorization]>;
    readonly provenance: Schema.Union<readonly [typeof NoProvenance, typeof GitHubActionsProvenance]>;
}>, {}>;
export declare class PublishIntent extends PublishIntent_base {
}
declare const DistTagIntent_base: Schema.Class<DistTagIntent, Schema.Struct<{
    readonly registry: Schema.Literal<"https://registry.npmjs.org/">;
    readonly name: Schema.NonEmptyString;
    readonly version: Schema.NonEmptyString;
    readonly tag: Schema.NonEmptyString;
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof TrustedAuthorization]>;
}>, {}>;
export declare class DistTagIntent extends DistTagIntent_base {
}
declare const PrivatePackage_base: Schema.Class<PrivatePackage, Schema.TaggedStruct<"PrivatePackage", {
    readonly name: Schema.NonEmptyString;
    readonly version: Schema.NonEmptyString;
    readonly tarball: typeof File;
}>, {}>;
export declare class PrivatePackage extends PrivatePackage_base {
}
declare const PublicPackage_base: Schema.Class<PublicPackage, Schema.TaggedStruct<"PublicPackage", {
    readonly publication: typeof PublishIntent;
}>, {}>;
export declare class PublicPackage extends PublicPackage_base {
}
export declare const PackageCandidate: Schema.Union<readonly [typeof PrivatePackage, typeof PublicPackage]>;
export type PackageCandidate = typeof PackageCandidate.Type;
export interface AttestationRequest {
    readonly payloadType: "application/vnd.in-toto+json";
    readonly payload: Uint8Array;
}
export type Attest = (request: AttestationRequest) => Effect.Effect<{
    readonly bundleBytes: Uint8Array;
}, ReleaseError>;
export type VerifyProvenance = (input: {
    readonly source: ProvenanceSource;
    readonly bundleBytes: Uint8Array;
}) => Effect.Effect<void, ReleaseError>;
declare const PackageMetadata_base: Schema.Class<PackageMetadata, Schema.Struct<{
    readonly name: Schema.NonEmptyString;
    readonly version: Schema.NonEmptyString;
    readonly private: Schema.Boolean;
    readonly integrity: Schema.String;
    readonly shasum: Schema.String;
}>, {}>;
export declare class PackageMetadata extends PackageMetadata_base {
}
export declare const publishCodec: Schema.decodeTo<Schema.declareConstructor<PublishIntent, {
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
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof TrustedAuthorization]>;
    readonly provenance: Schema.Union<readonly [typeof NoProvenance, typeof GitHubActionsProvenance]>;
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
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof TrustedAuthorization]>;
    readonly provenance: Schema.Union<readonly [typeof NoProvenance, typeof GitHubActionsProvenance]>;
}>, never, never>;
export {};
