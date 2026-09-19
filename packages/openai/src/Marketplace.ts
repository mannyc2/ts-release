import { Effect, Schema } from "effect"
import type { Tree, ReadContent } from "@mannyc1/ts-release/bundle"
import { isPublicText as publicText, PublicText, publicUrl } from "@mannyc1/ts-release/http"
import { attempt, canonical, compare, inspectPackage, name, own, safePath } from "./Package.js"

export const sourcePath = (value: string): boolean =>
  value.startsWith("./") && value.length > 2 && safePath(value.slice(2))
const Public = PublicText
const GitUrl = Schema.String.check(
  Schema.makeFilter((value) =>
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/u.test(value),
  ),
)
const Sha = Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/u))
const LocalSource = Schema.Struct({
  source: Schema.Literal("local"),
  path: Schema.String.check(Schema.makeFilter(sourcePath)),
})
const GitSource = Schema.Struct({
  source: Schema.Literal("url"),
  url: GitUrl,
  sha: Schema.optional(Sha),
  ref: Schema.optional(PublicText(256)),
})
const GitSubdirSource = Schema.Struct({
  source: Schema.Literal("git-subdir"),
  url: GitUrl,
  path: Schema.String.check(Schema.makeFilter(sourcePath)),
  sha: Schema.optional(Sha),
  ref: Schema.optional(PublicText(256)),
})
export const MarketplaceSource = Schema.Union([LocalSource, GitSource, GitSubdirSource])
export type MarketplaceSource = typeof MarketplaceSource.Type
// Existing catalogs may also contain npm or shorthand local entries. Preserve
// these when releasing another plugin; new releases below select local or pinned Git.
const ExistingSource = Schema.Union([
  MarketplaceSource,
  Schema.String.check(Schema.makeFilter(sourcePath)),
  Schema.Struct({
    source: Schema.Literal("npm"),
    package: PublicText(214),
    version: Schema.optional(PublicText(256)),
    registry: Schema.optional(
      Schema.String.check(
        Schema.makeFilter((value) => {
          const url = publicUrl(value)
          return url !== null && !url.search && !url.hash
        }),
      ),
    ),
  }),
])
export class MarketplaceEntry extends Schema.Class<MarketplaceEntry>("OpenAi.MarketplaceEntry")({
  name: Schema.String.check(Schema.makeFilter(name)),
  source: ExistingSource,
  pluginId: Schema.optional(PublicText(128)),
  policy: Schema.optional(
    Schema.Struct({
      installation: Schema.Literals(["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"]),
      authentication: Schema.Literals(["ON_INSTALL", "ON_FIRST_USE", "ON_USE"]),
      products: Schema.optional(Schema.Array(PublicText(64))),
    }),
  ),
  category: Schema.optional(Public(64)),
}) {}
export class Marketplace extends Schema.Class<Marketplace>("OpenAi.Marketplace")({
  name: Public(128),
  interface: Schema.optional(Schema.Struct({ displayName: Public(128) })),
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
    readonly sourcePath?: string
    readonly source?: MarketplaceSource
    readonly category: string
  },
  readContent: ReadContent,
) {
  const plugin = yield* inspectPackage(input.plugin, readContent)
  const selected = yield* attempt("openai-marketplace", () => {
    if (
      !publicText(input.marketplaceName, 128) ||
      !publicText(input.displayName, 128) ||
      !publicText(input.category, 64)
    )
      throw new Error("OpenAI marketplace input is invalid")
    if ((input.source === undefined) === (input.sourcePath === undefined))
      throw new Error("Choose exactly one marketplace source or local sourcePath")
    const source = own(
      MarketplaceSource,
      input.source ?? { source: "local", path: input.sourcePath },
    )
    if (source.source !== "local" && (!source.sha || source.ref !== undefined))
      throw new Error("New Git marketplace references require an exact commit sha, without ref")
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
        ...entries.get(plugin.manifest.name),
        source,
        policy: entries.get(plugin.manifest.name)?.policy ?? {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
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
