// Restore the exact type stripped from official Effect beta.107 declarations.
// Source: effect/src/SchemaAST.ts:2515; no runtime implementation is replaced.
import type {} from "effect/SchemaAST"

declare module "effect/SchemaAST" {
  interface Sentinel {
    readonly key: PropertyKey
    readonly literal: LiteralValue | symbol
  }
}
