import { Effect, Schema } from "effect";
import { Content, Tree, type ReadContent } from "@mannyc1/ts-release/bundle";
import { canonical, compareText as compare } from "@mannyc1/ts-release/http";
export { canonical, compare };
export declare const name: (value: string) => boolean;
export declare const safePath: (value: string) => boolean;
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
export type RenderedFile = Readonly<{
    path: string;
    bytes: Uint8Array;
    mode: 0o644 | 0o755;
}>;
export declare const failure: (code: string, message: string) => import("@mannyc1/ts-release").ReleaseError, reject: (code: string, message: string) => Effect.Effect<never, import("@mannyc1/ts-release").ReleaseError>, attempt: <A>(code: string, body: () => A) => Effect.Effect<A, import("@mannyc1/ts-release").ReleaseError, never>, own: <A, I>(codec: Schema.Codec<A, I>, input: unknown) => A;
export declare const files: (input: PluginInput, readContent: ReadContent) => Effect.Effect<readonly Readonly<{
    bytes: Uint8Array<ArrayBuffer>;
    path: string;
    mode: 420 | 493;
}>[], import("@mannyc1/ts-release").ReleaseError, never>;
export declare const inspectPackage: (input: Tree, readContent: ReadContent) => Effect.Effect<Readonly<{
    tree: Tree;
    manifest: Manifest;
    skillName: string;
    contents: Map<string, Uint8Array<ArrayBufferLike>>;
}>, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const validatePackage: (tree: Tree, read: ReadContent) => Effect.Effect<Tree, import("@mannyc1/ts-release").ReleaseError, never>;
