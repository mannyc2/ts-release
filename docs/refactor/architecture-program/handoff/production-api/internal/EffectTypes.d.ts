declare module "effect/SchemaAST" {
    interface Sentinel {
        readonly key: PropertyKey;
        readonly literal: LiteralValue | symbol;
    }
}
export {};
