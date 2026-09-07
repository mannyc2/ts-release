import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { ReleaseError } from "@mannyc1/ts-release"
import type { Tree, ReadContent } from "@mannyc1/ts-release/bundle"
import {
  attempt,
  canonical,
  compare,
  inspectPackage,
  name,
  own,
  publicText,
  safePath,
} from "./Package.js"

export class MarketplaceEntry extends Schema.Class<MarketplaceEntry>("OpenAi.MarketplaceEntry")({
  name: Schema.String,
  source: Schema.Struct({ source: Schema.Literal("local"), path: Schema.String }),
  policy: Schema.Struct({
    installation: Schema.Literals(["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"]),
    authentication: Schema.Literals(["ON_INSTALL", "ON_FIRST_USE"]),
  }),
  category: Schema.String,
}) {}
export class Marketplace extends Schema.Class<Marketplace>("OpenAi.Marketplace")({
  name: Schema.String,
  interface: Schema.Struct({ displayName: Schema.String }),
  plugins: Schema.Array(MarketplaceEntry),
}) {}

export const sourcePath = (value: string): boolean =>
  value.startsWith("./") && value.length > 2 && safePath(value.slice(2))
const validateEntry = (value: MarketplaceEntry): void => {
  if (!name(value.name) || !sourcePath(value.source.path) || !publicText(value.category, 64))
    throw new Error("OpenAI marketplace entry is invalid")
}
export const marketplaceDocument = (input: unknown): Marketplace => {
  const value = own(Marketplace, input), names = new Set<string>()
  if (!publicText(value.name, 128) || !publicText(value.interface.displayName, 128))
    throw new Error("OpenAI marketplace identity is invalid")
  for (const entry of value.plugins) {
    validateEntry(entry)
    if (names.has(entry.name)) throw new Error("OpenAI marketplace repeats a plugin")
    names.add(entry.name)
  }
  return value
}

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
    const entries = new Map<string, MarketplaceEntry>()
    for (const entry of input.existing === null ? [] : marketplaceDocument(input.existing).plugins) {
      if (entries.has(entry.name)) throw new Error("OpenAI marketplace repeats a plugin")
      entries.set(entry.name, entry)
    }
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
