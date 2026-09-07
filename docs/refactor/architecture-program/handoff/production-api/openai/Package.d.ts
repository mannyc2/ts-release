import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ReleaseError } from "@mannyc1/ts-release";
import { Content, Tree, type ReadContent } from "@mannyc1/ts-release/bundle";
declare const SkillFile_base: Schema.Class<SkillFile, Schema.Struct<{
    readonly path: Schema.String;
    readonly content: typeof Content;
    readonly mode: Schema.Literals<readonly [420, 493]>;
}>, {}>;
export declare class SkillFile extends SkillFile_base {
}
declare const Skill_base: Schema.Class<Skill, Schema.Struct<{
    readonly name: Schema.String;
    readonly description: Schema.String;
    readonly instructions: Schema.String;
    readonly files: Schema.$Array<typeof SkillFile>;
}>, {}>;
export declare class Skill extends Skill_base {
}
declare const Manifest_base: Schema.Class<Manifest, Schema.Struct<{
    readonly name: Schema.String;
    readonly version: Schema.String;
    readonly description: Schema.String;
    readonly skills: Schema.Literal<"./skills/">;
}>, {}>;
export declare class Manifest extends Manifest_base {
}
declare const PluginInput_base: Schema.Class<PluginInput, Schema.Struct<{
    readonly manifest: typeof Manifest;
    readonly skill: typeof Skill;
}>, {}>;
export declare class PluginInput extends PluginInput_base {
}
export interface RenderedFile {
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly mode: 0o644 | 0o755;
}
export declare const containsSecret: (value: string | Uint8Array) => boolean;
export declare const publicText: (value: string, maximum?: number) => boolean;
export declare const name: (value: string) => boolean;
export declare const safePath: (value: string) => boolean;
export declare const compare: (left: string, right: string) => number;
export declare const canonical: (input: unknown) => string;
export declare const freeze: <A>(value: A) => A;
export declare const own: <A, I>(codec: Schema.Codec<A, I>, input: unknown) => A;
export declare const attempt: <A>(code: string, body: () => A) => Effect.Effect<A, ReleaseError>;
export declare const files: (input: PluginInput, readContent: ReadContent) => Effect.Effect<readonly Readonly<{
    bytes: Uint8Array<ArrayBuffer>;
    path: string;
    mode: 420 | 493;
}>[], ReleaseError, never>;
export declare const inspectPackage: (input: Tree, readContent: ReadContent) => Effect.Effect<Readonly<{
    tree: Tree;
    manifest: Manifest;
    skillName: string;
    contents: Map<string, Uint8Array<ArrayBufferLike>>;
}>, ReleaseError, never>;
export declare const validatePackage: (tree: Tree, readContent: ReadContent) => Effect.Effect<Tree, ReleaseError, never>;
export {};
