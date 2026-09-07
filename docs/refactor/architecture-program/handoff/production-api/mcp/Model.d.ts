import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ReleaseError } from "@mannyc1/ts-release";
export declare const schemaUrl: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
declare const Input_base: Schema.Class<Input, Schema.Struct<{
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
}>, {}>;
export declare class Input extends Input_base {
}
declare const NamedInput_base: Schema.Class<NamedInput, Schema.Struct<{
    readonly name: Schema.String;
    readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
}>, {}>;
export declare class NamedInput extends NamedInput_base {
}
declare const PositionalArgument_base: Schema.Class<PositionalArgument, Schema.Struct<{
    readonly type: Schema.Literal<"positional">;
    readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
    readonly valueHint: Schema.optionalKey<Schema.String>;
    readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
}>, {}>;
export declare class PositionalArgument extends PositionalArgument_base {
}
declare const NamedArgument_base: Schema.Class<NamedArgument, Schema.Struct<{
    readonly type: Schema.Literal<"named">;
    readonly name: Schema.String;
    readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
    readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
}>, {}>;
export declare class NamedArgument extends NamedArgument_base {
}
export declare const Argument: Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
    readonly type: "positional";
    readonly default?: string;
    readonly format?: "string" | "number" | "boolean" | "filepath";
    readonly value?: string;
    readonly description?: string;
    readonly isRequired?: boolean;
    readonly isSecret?: boolean;
    readonly placeholder?: string;
    readonly choices?: readonly string[];
    readonly variables?: {
        readonly [x: string]: {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        };
    };
    readonly valueHint?: string;
    readonly isRepeated?: boolean;
}, readonly [Schema.Struct<{
    readonly type: Schema.Literal<"positional">;
    readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
    readonly valueHint: Schema.optionalKey<Schema.String>;
    readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
}>], {
    readonly type: "positional";
    readonly default?: string;
    readonly format?: "string" | "number" | "boolean" | "filepath";
    readonly value?: string;
    readonly description?: string;
    readonly isRequired?: boolean;
    readonly isSecret?: boolean;
    readonly placeholder?: string;
    readonly choices?: readonly string[];
    readonly variables?: {
        readonly [x: string]: {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        };
    };
    readonly valueHint?: string;
    readonly isRepeated?: boolean;
}>, Schema.Struct<{
    readonly type: Schema.Literal<"positional">;
    readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
    readonly valueHint: Schema.optionalKey<Schema.String>;
    readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
}>, never, never>, typeof NamedArgument]>;
export type Argument = typeof Argument.Type;
declare const Stdio_base: Schema.Class<Stdio, Schema.Struct<{
    readonly type: Schema.Literal<"stdio">;
}>, {}>;
export declare class Stdio extends Stdio_base {
}
declare const StreamableHttp_base: Schema.Class<StreamableHttp, Schema.Struct<{
    readonly type: Schema.Literal<"streamable-http">;
    readonly url: Schema.String;
    readonly headers: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
}>, {}>;
export declare class StreamableHttp extends StreamableHttp_base {
}
declare const Sse_base: Schema.Class<Sse, Schema.Struct<{
    readonly type: Schema.Literal<"sse">;
    readonly url: Schema.String;
    readonly headers: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
}>, {}>;
export declare class Sse extends Sse_base {
}
export declare const Transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
export type Transport = typeof Transport.Type;
declare const RemoteHttp_base: Schema.Class<RemoteHttp, Schema.Struct<{
    readonly type: Schema.Literal<"streamable-http">;
    readonly url: Schema.String;
    readonly headers: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
}>, {}>;
export declare class RemoteHttp extends RemoteHttp_base {
}
declare const RemoteSse_base: Schema.Class<RemoteSse, Schema.Struct<{
    readonly type: Schema.Literal<"sse">;
    readonly url: Schema.String;
    readonly headers: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
}>, {}>;
export declare class RemoteSse extends RemoteSse_base {
}
export declare const Remote: Schema.Union<readonly [typeof RemoteHttp, typeof RemoteSse]>;
export type Remote = typeof Remote.Type;
declare const NpmPackage_base: Schema.Class<NpmPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    readonly registryType: Schema.Literal<"npm">;
    readonly registryBaseUrl: Schema.Literal<"https://registry.npmjs.org">;
    readonly identifier: Schema.String;
    readonly version: Schema.String;
}>, {}>;
export declare class NpmPackage extends NpmPackage_base {
}
declare const PyPiPackage_base: Schema.Class<PyPiPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    readonly registryType: Schema.Literal<"pypi">;
    readonly registryBaseUrl: Schema.Literal<"https://pypi.org">;
    readonly identifier: Schema.String;
    readonly version: Schema.String;
}>, {}>;
export declare class PyPiPackage extends PyPiPackage_base {
}
declare const NugetPackage_base: Schema.Class<NugetPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    readonly registryType: Schema.Literal<"nuget">;
    readonly registryBaseUrl: Schema.Literal<"https://api.nuget.org/v3/index.json">;
    readonly identifier: Schema.String;
    readonly version: Schema.String;
}>, {}>;
export declare class NugetPackage extends NugetPackage_base {
}
declare const OciPackage_base: Schema.Class<OciPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    readonly registryType: Schema.Literal<"oci">;
    readonly identifier: Schema.String;
}>, {}>;
export declare class OciPackage extends OciPackage_base {
}
declare const McpbPackage_base: Schema.Class<McpbPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [Schema.decodeTo<Schema.declareConstructor<PositionalArgument, {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }, readonly [Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly type: "positional";
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
        readonly valueHint?: string;
        readonly isRepeated?: boolean;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>, typeof NamedArgument]>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    readonly registryType: Schema.Literal<"mcpb">;
    readonly identifier: Schema.String;
    readonly version: Schema.optionalKey<Schema.String>;
    readonly fileSha256: Schema.String;
}>, {}>;
export declare class McpbPackage extends McpbPackage_base {
}
export declare const Package: Schema.Union<readonly [typeof NpmPackage, typeof PyPiPackage, typeof OciPackage, typeof NugetPackage, typeof McpbPackage]>;
export type Package = typeof Package.Type;
declare const Repository_base: Schema.Class<Repository, Schema.Struct<{
    readonly url: Schema.String;
    readonly source: Schema.String;
    readonly id: Schema.optionalKey<Schema.String>;
    readonly subfolder: Schema.optionalKey<Schema.String>;
}>, {}>;
export declare class Repository extends Repository_base {
}
declare const Icon_base: Schema.Class<Icon, Schema.Struct<{
    readonly src: Schema.String;
    readonly mimeType: Schema.optionalKey<Schema.Literals<readonly ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]>>;
    readonly sizes: Schema.optionalKey<Schema.$Array<Schema.String>>;
    readonly theme: Schema.optionalKey<Schema.Literals<readonly ["light", "dark"]>>;
}>, {}>;
export declare class Icon extends Icon_base {
}
declare const Manifest_base: Schema.Class<Manifest, Schema.Struct<{
    readonly $schema: Schema.Literal<"https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json">;
    readonly name: Schema.String;
    readonly description: Schema.String;
    readonly version: Schema.String;
    readonly title: Schema.optionalKey<Schema.String>;
    readonly repository: Schema.optionalKey<typeof Repository>;
    readonly websiteUrl: Schema.optionalKey<Schema.String>;
    readonly icons: Schema.optionalKey<Schema.$Array<typeof Icon>>;
    readonly packages: Schema.optionalKey<Schema.NonEmptyArray<Schema.Union<readonly [typeof NpmPackage, typeof PyPiPackage, typeof OciPackage, typeof NugetPackage, typeof McpbPackage]>>>;
    readonly remotes: Schema.optionalKey<Schema.NonEmptyArray<Schema.Union<readonly [typeof RemoteHttp, typeof RemoteSse]>>>;
    readonly _meta: Schema.optionalKey<Schema.Struct<{
        readonly "io.modelcontextprotocol.registry/publisher-provided": Schema.$Record<Schema.String, Schema.Codec<Schema.Json, Schema.Json, never, never>>;
    }>>;
}>, {}>;
export declare class Manifest extends Manifest_base {
}
declare const TokenAuthorization_base: Schema.Class<TokenAuthorization, Schema.TaggedStruct<"TokenAuthorization", {
    readonly principal: Schema.String;
    readonly namespace: Schema.String;
}>, {}>;
export declare class TokenAuthorization extends TokenAuthorization_base {
}
declare const OidcAuthorization_base: Schema.Class<OidcAuthorization, Schema.TaggedStruct<"OidcAuthorization", {
    readonly principal: Schema.String;
    readonly issuer: Schema.Literal<"https://token.actions.githubusercontent.com">;
    readonly audience: Schema.String;
    readonly repository: Schema.String;
    readonly workflow: Schema.String;
    readonly workflowRef: Schema.String;
}>, {}>;
export declare class OidcAuthorization extends OidcAuthorization_base {
}
export declare const Authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof OidcAuthorization]>;
export type Authorization = typeof Authorization.Type;
declare const PublishIntent_base: Schema.Class<PublishIntent, Schema.Struct<{
    readonly registry: Schema.Literals<readonly ["https://registry.modelcontextprotocol.io", "https://staging.registry.modelcontextprotocol.io"]>;
    readonly manifest: typeof Manifest;
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof OidcAuthorization]>;
}>, {}>;
export declare class PublishIntent extends PublishIntent_base {
}
export declare const ManifestCodec: Schema.decodeTo<Schema.declareConstructor<Manifest, {
    readonly name: string;
    readonly description: string;
    readonly version: string;
    readonly $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
    readonly title?: string;
    readonly repository?: {
        readonly source: string;
        readonly url: string;
        readonly id?: string;
        readonly subfolder?: string;
    };
    readonly websiteUrl?: string;
    readonly icons?: readonly {
        readonly src: string;
        readonly mimeType?: "image/svg+xml" | "image/png" | "image/jpeg" | "image/jpg" | "image/webp";
        readonly sizes?: readonly string[];
        readonly theme?: "light" | "dark";
    }[];
    readonly packages?: readonly [{
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "npm";
        readonly registryBaseUrl: "https://registry.npmjs.org";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "pypi";
        readonly registryBaseUrl: "https://pypi.org";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "nuget";
        readonly registryBaseUrl: "https://api.nuget.org/v3/index.json";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly identifier: string;
        readonly registryType: "oci";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly identifier: string;
        readonly registryType: "mcpb";
        readonly fileSha256: string;
        readonly version?: string;
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    }, ...({
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "npm";
        readonly registryBaseUrl: "https://registry.npmjs.org";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "pypi";
        readonly registryBaseUrl: "https://pypi.org";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "nuget";
        readonly registryBaseUrl: "https://api.nuget.org/v3/index.json";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly identifier: string;
        readonly registryType: "oci";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly identifier: string;
        readonly registryType: "mcpb";
        readonly fileSha256: string;
        readonly version?: string;
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    })[]];
    readonly remotes?: readonly [{
        readonly type: "streamable-http";
        readonly url: string;
        readonly headers?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
    } | {
        readonly type: "sse";
        readonly url: string;
        readonly headers?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
    }, ...({
        readonly type: "streamable-http";
        readonly url: string;
        readonly headers?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
    } | {
        readonly type: "sse";
        readonly url: string;
        readonly headers?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
    })[]];
    readonly _meta?: {
        readonly "io.modelcontextprotocol.registry/publisher-provided": {
            readonly [x: string]: Schema.Json;
        };
    };
}, readonly [Schema.Struct<{
    readonly $schema: Schema.Literal<"https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json">;
    readonly name: Schema.String;
    readonly description: Schema.String;
    readonly version: Schema.String;
    readonly title: Schema.optionalKey<Schema.String>;
    readonly repository: Schema.optionalKey<typeof Repository>;
    readonly websiteUrl: Schema.optionalKey<Schema.String>;
    readonly icons: Schema.optionalKey<Schema.$Array<typeof Icon>>;
    readonly packages: Schema.optionalKey<Schema.NonEmptyArray<Schema.Union<readonly [typeof NpmPackage, typeof PyPiPackage, typeof OciPackage, typeof NugetPackage, typeof McpbPackage]>>>;
    readonly remotes: Schema.optionalKey<Schema.NonEmptyArray<Schema.Union<readonly [typeof RemoteHttp, typeof RemoteSse]>>>;
    readonly _meta: Schema.optionalKey<Schema.Struct<{
        readonly "io.modelcontextprotocol.registry/publisher-provided": Schema.$Record<Schema.String, Schema.Codec<Schema.Json, Schema.Json, never, never>>;
    }>>;
}>], {
    readonly name: string;
    readonly description: string;
    readonly version: string;
    readonly $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
    readonly title?: string;
    readonly repository?: {
        readonly source: string;
        readonly url: string;
        readonly id?: string;
        readonly subfolder?: string;
    };
    readonly websiteUrl?: string;
    readonly icons?: readonly {
        readonly src: string;
        readonly mimeType?: "image/svg+xml" | "image/png" | "image/jpeg" | "image/jpg" | "image/webp";
        readonly sizes?: readonly string[];
        readonly theme?: "light" | "dark";
    }[];
    readonly packages?: readonly [{
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "npm";
        readonly registryBaseUrl: "https://registry.npmjs.org";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "pypi";
        readonly registryBaseUrl: "https://pypi.org";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "nuget";
        readonly registryBaseUrl: "https://api.nuget.org/v3/index.json";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly identifier: string;
        readonly registryType: "oci";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly identifier: string;
        readonly registryType: "mcpb";
        readonly fileSha256: string;
        readonly version?: string;
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    }, ...({
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "npm";
        readonly registryBaseUrl: "https://registry.npmjs.org";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "pypi";
        readonly registryBaseUrl: "https://pypi.org";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly version: string;
        readonly identifier: string;
        readonly registryType: "nuget";
        readonly registryBaseUrl: "https://api.nuget.org/v3/index.json";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly identifier: string;
        readonly registryType: "oci";
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    } | {
        readonly transport: {
            readonly type: "stdio";
        } | {
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        };
        readonly identifier: string;
        readonly registryType: "mcpb";
        readonly fileSha256: string;
        readonly version?: string;
        readonly runtimeHint?: string;
        readonly runtimeArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly packageArguments?: readonly ({
            readonly type: "positional";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly valueHint?: string;
            readonly isRepeated?: boolean;
        } | {
            readonly name: string;
            readonly type: "named";
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
            readonly isRepeated?: boolean;
        })[];
        readonly environmentVariables?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
    })[]];
    readonly remotes?: readonly [{
        readonly type: "streamable-http";
        readonly url: string;
        readonly headers?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
    } | {
        readonly type: "sse";
        readonly url: string;
        readonly headers?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
    }, ...({
        readonly type: "streamable-http";
        readonly url: string;
        readonly headers?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
    } | {
        readonly type: "sse";
        readonly url: string;
        readonly headers?: readonly {
            readonly name: string;
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }[];
        readonly variables?: {
            readonly [x: string]: {
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
            };
        };
    })[]];
    readonly _meta?: {
        readonly "io.modelcontextprotocol.registry/publisher-provided": {
            readonly [x: string]: unknown;
        };
    };
}>, Schema.Struct<{
    readonly $schema: Schema.Literal<"https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json">;
    readonly name: Schema.String;
    readonly description: Schema.String;
    readonly version: Schema.String;
    readonly title: Schema.optionalKey<Schema.String>;
    readonly repository: Schema.optionalKey<typeof Repository>;
    readonly websiteUrl: Schema.optionalKey<Schema.String>;
    readonly icons: Schema.optionalKey<Schema.$Array<typeof Icon>>;
    readonly packages: Schema.optionalKey<Schema.NonEmptyArray<Schema.Union<readonly [typeof NpmPackage, typeof PyPiPackage, typeof OciPackage, typeof NugetPackage, typeof McpbPackage]>>>;
    readonly remotes: Schema.optionalKey<Schema.NonEmptyArray<Schema.Union<readonly [typeof RemoteHttp, typeof RemoteSse]>>>;
    readonly _meta: Schema.optionalKey<Schema.Struct<{
        readonly "io.modelcontextprotocol.registry/publisher-provided": Schema.$Record<Schema.String, Schema.Codec<Schema.Json, Schema.Json, never, never>>;
    }>>;
}>, never, never>;
export declare const PublishIntentCodec: Schema.decodeTo<Schema.declareConstructor<PublishIntent, {
    readonly registry: "https://registry.modelcontextprotocol.io" | "https://staging.registry.modelcontextprotocol.io";
    readonly manifest: {
        readonly name: string;
        readonly description: string;
        readonly version: string;
        readonly $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
        readonly title?: string;
        readonly repository?: {
            readonly source: string;
            readonly url: string;
            readonly id?: string;
            readonly subfolder?: string;
        };
        readonly websiteUrl?: string;
        readonly icons?: readonly {
            readonly src: string;
            readonly mimeType?: "image/svg+xml" | "image/png" | "image/jpeg" | "image/jpg" | "image/webp";
            readonly sizes?: readonly string[];
            readonly theme?: "light" | "dark";
        }[];
        readonly packages?: readonly [{
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "npm";
            readonly registryBaseUrl: "https://registry.npmjs.org";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "pypi";
            readonly registryBaseUrl: "https://pypi.org";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "nuget";
            readonly registryBaseUrl: "https://api.nuget.org/v3/index.json";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly identifier: string;
            readonly registryType: "oci";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly identifier: string;
            readonly registryType: "mcpb";
            readonly fileSha256: string;
            readonly version?: string;
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        }, ...({
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "npm";
            readonly registryBaseUrl: "https://registry.npmjs.org";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "pypi";
            readonly registryBaseUrl: "https://pypi.org";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "nuget";
            readonly registryBaseUrl: "https://api.nuget.org/v3/index.json";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly identifier: string;
            readonly registryType: "oci";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly identifier: string;
            readonly registryType: "mcpb";
            readonly fileSha256: string;
            readonly version?: string;
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        })[]];
        readonly remotes?: readonly [{
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }, ...({
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        })[]];
        readonly _meta?: {
            readonly "io.modelcontextprotocol.registry/publisher-provided": {
                readonly [x: string]: Schema.Json;
            };
        };
    };
    readonly authorization: {
        readonly _tag: "TokenAuthorization";
        readonly principal: string;
        readonly namespace: string;
    } | {
        readonly _tag: "OidcAuthorization";
        readonly principal: string;
        readonly issuer: "https://token.actions.githubusercontent.com";
        readonly audience: string;
        readonly repository: string;
        readonly workflow: string;
        readonly workflowRef: string;
    };
}, readonly [Schema.Struct<{
    readonly registry: Schema.Literals<readonly ["https://registry.modelcontextprotocol.io", "https://staging.registry.modelcontextprotocol.io"]>;
    readonly manifest: typeof Manifest;
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof OidcAuthorization]>;
}>], {
    readonly registry: "https://registry.modelcontextprotocol.io" | "https://staging.registry.modelcontextprotocol.io";
    readonly manifest: {
        readonly name: string;
        readonly description: string;
        readonly version: string;
        readonly $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
        readonly title?: string;
        readonly repository?: {
            readonly source: string;
            readonly url: string;
            readonly id?: string;
            readonly subfolder?: string;
        };
        readonly websiteUrl?: string;
        readonly icons?: readonly {
            readonly src: string;
            readonly mimeType?: "image/svg+xml" | "image/png" | "image/jpeg" | "image/jpg" | "image/webp";
            readonly sizes?: readonly string[];
            readonly theme?: "light" | "dark";
        }[];
        readonly packages?: readonly [{
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "npm";
            readonly registryBaseUrl: "https://registry.npmjs.org";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "pypi";
            readonly registryBaseUrl: "https://pypi.org";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "nuget";
            readonly registryBaseUrl: "https://api.nuget.org/v3/index.json";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly identifier: string;
            readonly registryType: "oci";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly identifier: string;
            readonly registryType: "mcpb";
            readonly fileSha256: string;
            readonly version?: string;
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        }, ...({
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "npm";
            readonly registryBaseUrl: "https://registry.npmjs.org";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "pypi";
            readonly registryBaseUrl: "https://pypi.org";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly version: string;
            readonly identifier: string;
            readonly registryType: "nuget";
            readonly registryBaseUrl: "https://api.nuget.org/v3/index.json";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly identifier: string;
            readonly registryType: "oci";
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        } | {
            readonly transport: {
                readonly type: "stdio";
            } | {
                readonly type: "streamable-http";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            } | {
                readonly type: "sse";
                readonly url: string;
                readonly headers?: readonly {
                    readonly name: string;
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                    readonly variables?: {
                        readonly [x: string]: {
                            readonly default?: string;
                            readonly format?: "string" | "number" | "boolean" | "filepath";
                            readonly value?: string;
                            readonly description?: string;
                            readonly isRequired?: boolean;
                            readonly isSecret?: boolean;
                            readonly placeholder?: string;
                            readonly choices?: readonly string[];
                        };
                    };
                }[];
            };
            readonly identifier: string;
            readonly registryType: "mcpb";
            readonly fileSha256: string;
            readonly version?: string;
            readonly runtimeHint?: string;
            readonly runtimeArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly packageArguments?: readonly ({
                readonly type: "positional";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly valueHint?: string;
                readonly isRepeated?: boolean;
            } | {
                readonly name: string;
                readonly type: "named";
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
                readonly isRepeated?: boolean;
            })[];
            readonly environmentVariables?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
        })[]];
        readonly remotes?: readonly [{
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        }, ...({
            readonly type: "streamable-http";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        } | {
            readonly type: "sse";
            readonly url: string;
            readonly headers?: readonly {
                readonly name: string;
                readonly default?: string;
                readonly format?: "string" | "number" | "boolean" | "filepath";
                readonly value?: string;
                readonly description?: string;
                readonly isRequired?: boolean;
                readonly isSecret?: boolean;
                readonly placeholder?: string;
                readonly choices?: readonly string[];
                readonly variables?: {
                    readonly [x: string]: {
                        readonly default?: string;
                        readonly format?: "string" | "number" | "boolean" | "filepath";
                        readonly value?: string;
                        readonly description?: string;
                        readonly isRequired?: boolean;
                        readonly isSecret?: boolean;
                        readonly placeholder?: string;
                        readonly choices?: readonly string[];
                    };
                };
            }[];
            readonly variables?: {
                readonly [x: string]: {
                    readonly default?: string;
                    readonly format?: "string" | "number" | "boolean" | "filepath";
                    readonly value?: string;
                    readonly description?: string;
                    readonly isRequired?: boolean;
                    readonly isSecret?: boolean;
                    readonly placeholder?: string;
                    readonly choices?: readonly string[];
                };
            };
        })[]];
        readonly _meta?: {
            readonly "io.modelcontextprotocol.registry/publisher-provided": {
                readonly [x: string]: unknown;
            };
        };
    };
    readonly authorization: {
        readonly _tag: "TokenAuthorization";
        readonly principal: string;
        readonly namespace: string;
    } | {
        readonly _tag: "OidcAuthorization";
        readonly principal: string;
        readonly issuer: "https://token.actions.githubusercontent.com";
        readonly audience: string;
        readonly repository: string;
        readonly workflow: string;
        readonly workflowRef: string;
    };
}>, Schema.Struct<{
    readonly registry: Schema.Literals<readonly ["https://registry.modelcontextprotocol.io", "https://staging.registry.modelcontextprotocol.io"]>;
    readonly manifest: typeof Manifest;
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof OidcAuthorization]>;
}>, never, never>;
export declare const canonical: (input: unknown) => string;
export declare const deepFreeze: <A>(value: A) => A;
export declare const own: <A, I>(codec: Schema.Codec<A, I>, input: unknown) => A;
export declare const attempt: <A>(code: string, body: () => A) => Effect.Effect<A, ReleaseError>;
export declare const manifest: (input: unknown) => Manifest;
export declare const intent: (input: unknown) => PublishIntent;
export declare const validate: (input: unknown) => Effect.Effect<Manifest, ReleaseError, never>;
export declare const render: (input: Manifest) => Effect.Effect<Uint8Array<ArrayBuffer>, ReleaseError, never>;
export {};
