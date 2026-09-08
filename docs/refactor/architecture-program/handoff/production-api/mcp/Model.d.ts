import { Effect, Schema } from "effect";
import { canonical } from "@mannyc1/ts-release/http";
export { canonical };
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
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    name: Schema.String;
    variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>>>;
}>, Input> & Pick<{}, never>;
export declare class NamedInput extends NamedInput_base {
}
declare const PositionalArgument_base: Schema.Class<PositionalArgument, Schema.Struct<{
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    type: Schema.Literal<"positional">;
    variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>>>;
    valueHint: Schema.optionalKey<Schema.String>;
    isRepeated: Schema.optionalKey<Schema.Boolean>;
}>, Input> & Pick<{}, never>;
export declare class PositionalArgument extends PositionalArgument_base {
}
declare const NamedArgument_base: Schema.Class<NamedArgument, Schema.Struct<{
    readonly description: Schema.optionalKey<Schema.String>;
    readonly isRequired: Schema.optionalKey<Schema.Boolean>;
    readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
    readonly value: Schema.optionalKey<Schema.String>;
    readonly isSecret: Schema.optionalKey<Schema.Boolean>;
    readonly default: Schema.optionalKey<Schema.String>;
    readonly placeholder: Schema.optionalKey<Schema.String>;
    readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    type: Schema.Literal<"named">;
    name: Schema.String;
    variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>>>;
    isRepeated: Schema.optionalKey<Schema.Boolean>;
}>, Input> & Pick<{}, never>;
export declare class NamedArgument extends NamedArgument_base {
}
export type Argument = PositionalArgument | NamedArgument;
export declare const Argument: Schema.Codec<Argument, unknown>;
declare const Stdio_base: Schema.Class<Stdio, Schema.Struct<{
    readonly type: Schema.Literal<"stdio">;
}>, {}>;
export declare class Stdio extends Stdio_base {
}
declare const StreamableHttp_base: Schema.Class<StreamableHttp, Schema.Struct<{
    readonly url: Schema.String;
    readonly headers: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly type: Schema.Literal<"streamable-http">;
}>, {}>;
export declare class StreamableHttp extends StreamableHttp_base {
}
declare const Sse_base: Schema.Class<Sse, Schema.Struct<{
    readonly url: Schema.String;
    readonly headers: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly type: Schema.Literal<"sse">;
}>, {}>;
export declare class Sse extends Sse_base {
}
export type Transport = Stdio | StreamableHttp | Sse;
export declare const Transport: Schema.Codec<Transport, unknown>;
declare const RemoteHttp_base: Schema.Class<RemoteHttp, Schema.Struct<{
    readonly url: Schema.String;
    readonly headers: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly type: Schema.Literal<"streamable-http">;
    variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>>>;
}>, StreamableHttp> & Pick<{}, never>;
export declare class RemoteHttp extends RemoteHttp_base {
}
declare const RemoteSse_base: Schema.Class<RemoteSse, Schema.Struct<{
    readonly url: Schema.String;
    readonly headers: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly type: Schema.Literal<"sse">;
    variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>], {
        readonly default?: string;
        readonly format?: "string" | "number" | "boolean" | "filepath";
        readonly value?: string;
        readonly description?: string;
        readonly isRequired?: boolean;
        readonly isSecret?: boolean;
        readonly placeholder?: string;
        readonly choices?: readonly string[];
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, never, never>>>;
}>, Sse> & Pick<{}, never>;
export declare class RemoteSse extends RemoteSse_base {
}
export type Remote = RemoteHttp | RemoteSse;
export declare const Remote: Schema.Codec<Remote, unknown>;
declare const NpmPackage_base: Schema.Class<NpmPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Codec<Transport, unknown, never, never>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly identifier: Schema.Codec<string, string, never, never>;
    readonly version: Schema.String;
    readonly registryType: Schema.Literal<"npm">;
    readonly registryBaseUrl: Schema.Literal<"https://registry.npmjs.org">;
}>, {}>;
export declare class NpmPackage extends NpmPackage_base {
}
declare const PyPiPackage_base: Schema.Class<PyPiPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Codec<Transport, unknown, never, never>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly identifier: Schema.Codec<string, string, never, never>;
    readonly version: Schema.String;
    readonly registryType: Schema.Literal<"pypi">;
    readonly registryBaseUrl: Schema.Literal<"https://pypi.org">;
}>, {}>;
export declare class PyPiPackage extends PyPiPackage_base {
}
declare const NugetPackage_base: Schema.Class<NugetPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Codec<Transport, unknown, never, never>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly identifier: Schema.Codec<string, string, never, never>;
    readonly version: Schema.String;
    readonly registryType: Schema.Literal<"nuget">;
    readonly registryBaseUrl: Schema.Literal<"https://api.nuget.org/v3/index.json">;
}>, {}>;
export declare class NugetPackage extends NugetPackage_base {
}
declare const OciPackage_base: Schema.Class<OciPackage, Schema.Struct<{
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Codec<Transport, unknown, never, never>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly identifier: Schema.Codec<string, string, never, never>;
    readonly registryType: Schema.Literal<"oci">;
}>, {}>;
export declare class OciPackage extends OciPackage_base {
}
declare const McpbPackage_base: Schema.Class<McpbPackage, Schema.Struct<{
    readonly version: Schema.optionalKey<Schema.String>;
    readonly fileSha256: Schema.String;
    readonly runtimeHint: Schema.optionalKey<Schema.String>;
    readonly transport: Schema.Codec<Transport, unknown, never, never>;
    readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Codec<Argument, unknown, never, never>>>;
    readonly environmentVariables: Schema.optionalKey<Schema.$Array<Schema.decodeTo<Schema.declareConstructor<NamedInput, {
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
    }, readonly [Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>], {
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
    }>, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        name: Schema.String;
        variables: Schema.optionalKey<Schema.$Record<Schema.String, Schema.decodeTo<Schema.declareConstructor<Input, {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }, readonly [Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>], {
            readonly default?: string;
            readonly format?: "string" | "number" | "boolean" | "filepath";
            readonly value?: string;
            readonly description?: string;
            readonly isRequired?: boolean;
            readonly isSecret?: boolean;
            readonly placeholder?: string;
            readonly choices?: readonly string[];
        }>, Schema.Struct<{
            readonly description: Schema.optionalKey<Schema.String>;
            readonly isRequired: Schema.optionalKey<Schema.Boolean>;
            readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
            readonly value: Schema.optionalKey<Schema.String>;
            readonly isSecret: Schema.optionalKey<Schema.Boolean>;
            readonly default: Schema.optionalKey<Schema.String>;
            readonly placeholder: Schema.optionalKey<Schema.String>;
            readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
        }>, never, never>>>;
    }>, never, never>>>;
    readonly identifier: Schema.Codec<string, string, never, never>;
    readonly registryType: Schema.Literal<"mcpb">;
}>, {}>;
export declare class McpbPackage extends McpbPackage_base {
}
export type Package = NpmPackage | PyPiPackage | OciPackage | NugetPackage | McpbPackage;
export declare const Package: Schema.Codec<Package, unknown>;
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
    readonly packages: Schema.optionalKey<Schema.NonEmptyArray<Schema.Codec<Package, unknown, never, never>>>;
    readonly remotes: Schema.optionalKey<Schema.NonEmptyArray<Schema.Codec<Remote, unknown, never, never>>>;
    readonly _meta: Schema.optionalKey<Schema.Struct<{
        readonly "io.modelcontextprotocol.registry/publisher-provided": Schema.$Record<Schema.String, Schema.Codec<Schema.Json, Schema.Json, never, never>>;
    }>>;
}>, {}>;
export declare class Manifest extends Manifest_base {
}
export declare const ManifestCodec: Schema.Codec<Manifest, unknown>;
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
export type Authorization = TokenAuthorization | OidcAuthorization;
export declare const Authorization: Schema.Codec<Authorization, unknown>;
declare const PublishIntent_base: Schema.Class<PublishIntent, Schema.Struct<{
    readonly registry: Schema.Literals<readonly ["https://registry.modelcontextprotocol.io", "https://staging.registry.modelcontextprotocol.io"]>;
    readonly manifest: Schema.Codec<Manifest, unknown, never, never>;
    readonly authorization: Schema.Codec<Authorization, unknown, never, never>;
}>, {}>;
export declare class PublishIntent extends PublishIntent_base {
}
export declare const PublishIntentCodec: Schema.Codec<PublishIntent, unknown>;
export declare const failure: (code: string, message: string) => import("@mannyc1/ts-release").ReleaseError, reject: (code: string, message: string) => Effect.Effect<never, import("@mannyc1/ts-release").ReleaseError>, attempt: <A>(code: string, body: () => A) => Effect.Effect<A, import("@mannyc1/ts-release").ReleaseError, never>, own: <A, I>(codec: Schema.Codec<A, I>, input: unknown) => A, ownOperation: <A, I>(codec: Schema.Codec<A, I>, descriptor: Pick<import("@mannyc1/ts-release").ProviderDescriptor, "definitionId" | "intentVersion">, operation: import("@mannyc1/ts-release").Operation) => A, ownRequest: (request: import("@mannyc1/ts-release").PreparedRequest) => import("@mannyc1/ts-release").PreparedRequest, matches: (body: () => boolean) => boolean;
export declare const manifest: (input: unknown) => Manifest;
export declare const intent: (input: unknown) => PublishIntent;
export declare const validate: (input: unknown) => Effect.Effect<Manifest, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const render: (input: Manifest) => Effect.Effect<Uint8Array<ArrayBuffer>, import("@mannyc1/ts-release").ReleaseError, never>;
