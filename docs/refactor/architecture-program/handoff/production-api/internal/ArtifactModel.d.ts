import * as Schema from "effect/Schema";
import * as Artifact from "effect-build/Artifact";
declare const AdoptionError_base: Schema.Class<AdoptionError, Schema.TaggedStruct<"AdoptionError", {
    readonly reason: Schema.String;
}>, import("effect/Cause").YieldableError>;
export declare class AdoptionError extends AdoptionError_base {
    get message(): string;
}
declare const Content_base: Schema.Class<Content, Schema.Struct<{
    readonly bytes: Schema.String;
    readonly sha256: Schema.String;
}>, {}>;
export declare class Content extends Content_base {
}
declare const OwnedFile_base: Schema.Class<OwnedFile, Schema.TaggedStruct<"OwnedFile", {
    readonly logicalName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly content: typeof Content;
    readonly deliveryMode: Schema.declare<Artifact.FileMode, Artifact.FileMode>;
    readonly executable: Schema.NullOr<Schema.Struct<{
        readonly nativeFormat: Schema.Literals<readonly ["elf", "mach-o", "pe"]>;
        readonly runtime: Schema.Struct<{
            readonly name: Schema.NonEmptyString;
            readonly version: Schema.NonEmptyString;
        }>;
        readonly target: Schema.Literals<readonly ["macos-x64", "macos-aarch64", "linux-x64-gnu", "linux-x64-musl", "linux-aarch64-gnu", "linux-aarch64-musl", "windows-x64", "windows-aarch64"]>;
    }>>;
    readonly provenance: Schema.declare<Artifact.Provenance, Artifact.Provenance>;
}>, {}>;
export declare class OwnedFile extends OwnedFile_base {
}
declare const TreeFile_base: Schema.Class<TreeFile, Schema.TaggedStruct<"TreeFile", {
    readonly relativePath: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly mode: Schema.declare<Artifact.FileMode, Artifact.FileMode>;
    readonly content: typeof Content;
}>, {}>;
export declare class TreeFile extends TreeFile_base {
}
declare const TreeDirectory_base: Schema.Class<TreeDirectory, Schema.TaggedStruct<"TreeDirectory", {
    readonly relativePath: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly mode: Schema.declare<Artifact.FileMode, Artifact.FileMode>;
}>, {}>;
export declare class TreeDirectory extends TreeDirectory_base {
}
declare const TreeLink_base: Schema.Class<TreeLink, Schema.TaggedStruct<"TreeLink", {
    readonly relativePath: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly target: Schema.String;
}>, {}>;
export declare class TreeLink extends TreeLink_base {
}
export declare const MAX_BUFFERED_TREE_BYTES: bigint;
export declare const MAX_TREE_ENTRIES = 100000;
declare const OwnedTree_base: Schema.Class<OwnedTree, Schema.TaggedStruct<"OwnedTree", {
    readonly logicalName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly rootMode: Schema.declare<Artifact.FileMode, Artifact.FileMode>;
    readonly totalBytes: Schema.String;
    readonly upstreamManifestSha256: Schema.String;
    readonly entries: Schema.$Array<Schema.Union<readonly [typeof TreeFile, typeof TreeDirectory, typeof TreeLink]>>;
    readonly provenance: Schema.declare<Artifact.Provenance, Artifact.Provenance>;
}>, {}>;
export declare class OwnedTree extends OwnedTree_base {
}
export declare const OwnedArtifact: Schema.Union<readonly [typeof OwnedFile, typeof OwnedTree]>;
export type OwnedArtifact = typeof OwnedArtifact.Type;
declare const OwnedBundle_base: Schema.Class<OwnedBundle, Schema.Struct<{
    readonly format: Schema.Literal<"ts-release/bundle/1">;
    readonly artifacts: Schema.$Array<Schema.Union<readonly [typeof OwnedFile, typeof OwnedTree]>>;
}>, {}>;
export declare class OwnedBundle extends OwnedBundle_base {
}
export {};
