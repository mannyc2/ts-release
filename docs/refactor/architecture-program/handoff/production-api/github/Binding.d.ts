import * as Schema from "effect/Schema";
import { Operation, type ProviderContext } from "@mannyc1/ts-release";
import * as Model from "./Model.js";
import { type Kind } from "./Graph.js";
export declare const NativeFacts: Schema.Union<readonly [typeof Model.AnnotatedTagFacts, typeof Model.RefFacts, typeof Model.ReleaseFacts, typeof Model.AssetFacts]>;
export type NativeFacts = typeof NativeFacts.Type;
declare const Parent_base: Schema.Class<Parent, Schema.Struct<{
    readonly operationId: Schema.String;
    readonly targetCommit: Schema.String;
    readonly facts: Schema.Union<readonly [typeof Model.AnnotatedTagFacts, typeof Model.RefFacts, typeof Model.ReleaseFacts, typeof Model.AssetFacts]>;
}>, {}>;
export declare class Parent extends Parent_base {
}
declare const BoundScope_base: Schema.Class<BoundScope, Schema.Struct<{
    readonly operation: typeof Operation;
    readonly targetCommit: Schema.String;
    readonly parents: Schema.$Array<typeof Parent>;
}>, {}>;
export declare class BoundScope extends BoundScope_base {
}
export declare const encodeScope: (scope: BoundScope) => string;
export declare const readScope: (text: string) => BoundScope;
export declare const bindScope: (operation: Operation, context: ProviderContext) => BoundScope;
export declare const parentFacts: <K extends Kind>(scope: BoundScope, id: string, kind: K) => NativeFacts;
export {};
