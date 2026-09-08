import { Effect, Schema } from "effect";
import type { Tree, ReadContent } from "@mannyc1/ts-release/bundle";
export declare const sourcePath: (value: string) => boolean;
declare const MarketplaceEntry_base: Schema.Class<MarketplaceEntry, Schema.Struct<{
    readonly name: Schema.String;
    readonly source: Schema.Struct<{
        readonly source: Schema.Literal<"local">;
        readonly path: Schema.String;
    }>;
    readonly policy: Schema.Struct<{
        readonly installation: Schema.Literals<readonly ["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"]>;
        readonly authentication: Schema.Literals<readonly ["ON_INSTALL", "ON_FIRST_USE"]>;
    }>;
    readonly category: Schema.String;
}>, {}>;
export declare class MarketplaceEntry extends MarketplaceEntry_base {
}
declare const Marketplace_base: Schema.Class<Marketplace, Schema.Struct<{
    readonly name: Schema.String;
    readonly interface: Schema.Struct<{
        readonly displayName: Schema.String;
    }>;
    readonly plugins: Schema.$Array<typeof MarketplaceEntry>;
}>, {}>;
export declare class Marketplace extends Marketplace_base {
}
export declare const marketplaceDocument: (input: unknown) => Marketplace;
export declare const marketplace: (input: {
    readonly plugin: Tree;
    readonly existing: Marketplace | null;
    readonly marketplaceName: string;
    readonly displayName: string;
    readonly sourcePath: string;
    readonly category: string;
}, readContent: ReadContent) => Effect.Effect<Readonly<{
    path: ".agents/plugins/marketplace.json";
    document: Marketplace;
    bytes: Uint8Array<ArrayBuffer>;
}>, import("@mannyc1/ts-release").ReleaseError, never>;
export {};
