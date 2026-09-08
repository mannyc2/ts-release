import { Effect, Schema } from "effect"
import type { Tree, ReadContent } from "@mannyc1/ts-release/bundle"
import { isPublicText as publicText, PublicText } from "@mannyc1/ts-release/http"
import { attempt, canonical, compare, inspectPackage, name, own, safePath } from "./Package.js"

export const sourcePath = (value: string): boolean =>
  value.startsWith("./") && value.length > 2 && safePath(value.slice(2))
const Public = PublicText
export class MarketplaceEntry extends Schema.Class<MarketplaceEntry>("OpenAi.MarketplaceEntry")({
  name: Schema.String.check(Schema.makeFilter(name)),
  source: Schema.Struct({
    source: Schema.Literal("local"),
    path: Schema.String.check(Schema.makeFilter(sourcePath)),
  }),
  policy: Schema.Struct({
    installation: Schema.Literals(["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"]),
    authentication: Schema.Literals(["ON_INSTALL", "ON_FIRST_USE"]),
  }),
  category: Public(64),
}) {}
export class Marketplace extends Schema.Class<Marketplace>("OpenAi.Marketplace")({
  name: Public(128),
  interface: Schema.Struct({ displayName: Public(128) }),
  plugins: Schema.Array(MarketplaceEntry),
}) {}
const MarketplaceCodec = Marketplace.check(
  Schema.makeFilter(
    (value) => new Set(value.plugins.map((entry) => entry.name)).size === value.plugins.length,
  ),
)
export const marketplaceDocument = (input: unknown): Marketplace => own(MarketplaceCodec, input)

export const marketplace = Effect.fn("openai.marketplace")(function* (
  input: {
    readonly plugin: Tree
    readonly existing: Marketplace | null
    readonly marketplaceName: string
    readonly displayName: string
    readonly sourcePath: string
    readonly category: string
  },
  readContent: ReadContent,
) {
  const plugin = yield* inspectPackage(input.plugin, readContent)
  const selected = yield* attempt("openai-marketplace", () => {
    if (
      !publicText(input.marketplaceName, 128) ||
      !publicText(input.displayName, 128) ||
      !sourcePath(input.sourcePath) ||
      !publicText(input.category, 64)
    )
      throw new Error("OpenAI marketplace input is invalid")
    const entries = new Map(
      (input.existing === null ? [] : marketplaceDocument(input.existing).plugins).map((entry) => [
        entry.name,
        entry,
      ]),
    )
    entries.set(
      plugin.manifest.name,
      new MarketplaceEntry({
        name: plugin.manifest.name,
        source: { source: "local", path: input.sourcePath },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: input.category,
      }),
    )
    const document = new Marketplace({
      name: input.marketplaceName,
      interface: { displayName: input.displayName },
      plugins: [...entries.values()].sort((left, right) => compare(left.name, right.name)),
    })
    return marketplaceDocument(document)
  })
  return Object.freeze({
    path: ".agents/plugins/marketplace.json" as const,
    document: selected,
    bytes: new TextEncoder().encode(`${canonical(Schema.encodeSync(Marketplace)(selected))}\n`),
  })
})
