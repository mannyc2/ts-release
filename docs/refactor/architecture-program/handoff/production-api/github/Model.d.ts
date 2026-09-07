import * as Schema from "effect/Schema";
import { File } from "@mannyc1/ts-release/bundle";
export declare const text: Schema.String;
export declare const oid: Schema.String;
export declare const nativeId: Schema.String;
export declare const tagName: Schema.String;
declare const Repository_base: Schema.Class<Repository, Schema.Struct<{
    readonly apiUrl: Schema.Literal<"https://api.github.com">;
    readonly owner: Schema.String;
    readonly name: Schema.String;
}>, {}>;
export declare class Repository extends Repository_base {
}
declare const Tagger_base: Schema.Class<Tagger, Schema.Struct<{
    readonly name: Schema.String;
    readonly email: Schema.String;
    readonly date: Schema.String;
}>, {}>;
export declare class Tagger extends Tagger_base {
}
declare const LightweightTag_base: Schema.Class<LightweightTag, Schema.Struct<{
    repository: typeof Repository;
    tag: Schema.String;
    commit: Schema.String;
    principal: Schema.String;
}>, {}>;
export declare class LightweightTag extends LightweightTag_base {
}
declare const AnnotatedTag_base: Schema.Class<AnnotatedTag, Schema.Struct<{
    readonly message: Schema.String;
    readonly tagger: typeof Tagger;
    readonly repository: typeof Repository;
    readonly tag: Schema.String;
    readonly commit: Schema.String;
    readonly principal: Schema.String;
}>, {}>;
export declare class AnnotatedTag extends AnnotatedTag_base {
}
declare const AnnotatedRef_base: Schema.Class<AnnotatedRef, Schema.Struct<{
    readonly repository: typeof Repository;
    readonly tag: Schema.String;
    readonly annotatedTagOperation: Schema.String;
    readonly principal: Schema.String;
}>, {}>;
export declare class AnnotatedRef extends AnnotatedRef_base {
}
declare const ManagedTag_base: Schema.Class<ManagedTag, Schema.TaggedStruct<"ManagedTag", {
    readonly operationId: Schema.String;
}>, {}>;
export declare class ManagedTag extends ManagedTag_base {
}
declare const ExistingTag_base: Schema.Class<ExistingTag, Schema.TaggedStruct<"ExistingTag", {
    readonly commit: Schema.String;
}>, {}>;
export declare class ExistingTag extends ExistingTag_base {
}
export declare const TagSource: Schema.Union<readonly [typeof ManagedTag, typeof ExistingTag]>;
export type TagSource = typeof TagSource.Type;
declare const DraftIntent_base: Schema.Class<DraftIntent, Schema.Struct<{
    readonly repository: typeof Repository;
    readonly tag: Schema.String;
    readonly tagSource: Schema.Union<readonly [typeof ManagedTag, typeof ExistingTag]>;
    readonly title: Schema.String;
    readonly body: Schema.String;
    readonly prerelease: Schema.Boolean;
    readonly principal: Schema.String;
}>, {}>;
export declare class DraftIntent extends DraftIntent_base {
}
declare const AssetIntent_base: Schema.Class<AssetIntent, Schema.Struct<{
    readonly repository: typeof Repository;
    readonly draftOperation: Schema.String;
    readonly file: typeof File;
    readonly publicName: Schema.String;
    readonly mediaType: Schema.String;
    readonly principal: Schema.String;
}>, {}>;
export declare class AssetIntent extends AssetIntent_base {
}
declare const PublishIntent_base: Schema.Class<PublishIntent, Schema.Struct<{
    readonly repository: typeof Repository;
    readonly draftOperation: Schema.String;
    readonly assetOperations: Schema.$Array<Schema.String>;
    readonly principal: Schema.String;
}>, {}>;
export declare class PublishIntent extends PublishIntent_base {
}
declare const AnnotatedTagFacts_base: Schema.Class<AnnotatedTagFacts, Schema.Struct<{
    readonly objectOid: Schema.String;
    readonly tag: Schema.String;
    readonly message: Schema.String;
    readonly tagger: typeof Tagger;
    readonly targetOid: Schema.String;
    readonly targetType: Schema.Literal<"commit">;
}>, {}>;
export declare class AnnotatedTagFacts extends AnnotatedTagFacts_base {
}
declare const RefFacts_base: Schema.Class<RefFacts, Schema.Struct<{
    readonly ref: Schema.String;
    readonly objectOid: Schema.String;
    readonly objectType: Schema.Literals<readonly ["commit", "tag"]>;
}>, {}>;
export declare class RefFacts extends RefFacts_base {
}
declare const ReleaseFacts_base: Schema.Class<ReleaseFacts, Schema.Struct<{
    readonly releaseId: Schema.String;
    readonly tag: Schema.String;
    readonly title: Schema.String;
    readonly body: Schema.String;
    readonly prerelease: Schema.Boolean;
    readonly draft: Schema.Boolean;
    readonly uploadUrlTemplate: Schema.String;
}>, {}>;
export declare class ReleaseFacts extends ReleaseFacts_base {
}
declare const AssetFacts_base: Schema.Class<AssetFacts, Schema.Struct<{
    readonly assetId: Schema.String;
    readonly storedName: Schema.String;
    readonly state: Schema.Literals<readonly ["uploaded", "starter"]>;
    readonly contentType: Schema.String;
    readonly bytes: Schema.String;
    readonly sha256: Schema.NullOr<Schema.String>;
    readonly apiUrl: Schema.String;
    readonly downloadUrl: Schema.String;
}>, {}>;
export declare class AssetFacts extends AssetFacts_base {
}
export {};
