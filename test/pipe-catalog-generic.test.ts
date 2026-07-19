import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { Artifact } from "../src/grammar/artifact.js"
import { catalogGenericPlanner, ReleaseConfigCatalogEntry, ReleaseConfigCatalogFactHole,
  resolveCatalogs, type ResolvedCatalogEntry } from "../src/features/catalog-generic.js"
import { makePipelineIdentity } from "./helpers.js"

const identity = makePipelineIdentity()
const asset = Artifact.make({ id: "asset", kind: "archive", path: "dist/tool.zip", producedBy: "archive" })
const hole = (fact: "sha256" | "downloadUrl" | "assetName", artifact = "asset") =>
  ReleaseConfigCatalogFactHole.make({ fact, artifact })
const raw = (values: Partial<ReleaseConfigCatalogEntry> = {}) => ReleaseConfigCatalogEntry.make({
  id: "market", repository: "owner/catalog", file: "catalog.json", content: "{name}", ...values
})
const entry = (values: Partial<ReleaseConfigCatalogEntry> = {}, github: string | undefined = "owner/source") =>
  resolveCatalogs([raw(values)], github)?.[0] as ResolvedCatalogEntry
const plan = (entries: ReadonlyArray<ResolvedCatalogEntry>, artifacts = [asset]) =>
  catalogGenericPlanner(entries, { identity, artifacts })

describe("generic catalog pipe", () => {
  it.effect("resolves defaults and plans plain literal content without a directory", () => Effect.gen(function*() {
    const resolved = entry({ content: "{name}:{sha256:x}" })
    const contribution = yield* plan([resolved])
    expect(resolved).toMatchObject({ commitMessage: "Update {name} to {version}", submit: "push" })
    expect(contribution).toMatchObject({
      artifacts: [{ id: "catalog-file-market", path: "catalog.json", producedBy: "catalog:file",
        extra: { _tag: "catalog-file", catalog: "market", repository: "owner/catalog" } }],
      operations: [{ id: "catalog:market:render", action: { _tag: "write-file", contents: "release:{sha256:x}" } }]
    })
  }))
  it.effect("renders plan-time holes and derives a directory-prefixed path", () => Effect.gen(function*() {
    const contribution = yield* plan([entry({ directory: "checkout", content: [hole("assetName"), "@", hole("downloadUrl")] })])
    expect(contribution.artifacts[0]?.path).toBe("checkout/catalog.json")
    expect(contribution.operations[0]?.action).toMatchObject({ contents:
      "tool.zip@https://github.com/owner/source/releases/download/v0.1.0/tool.zip" })
  }))
  it.effect("keeps only sha256 holes and merges adjacent strings", () => Effect.gen(function*() {
    const contribution = yield* plan([entry({ content: ["a", "b", hole("sha256"), "c", "d"] })])
    expect(contribution.operations[0]?.action).toMatchObject({ contents: {
      _tag: "file-parts", parts: ["ab", { artifactId: "asset" }, "cd"]
    } })
  }))
  it.effect("rejects missing artifacts, repositories, and duplicate ids", () => Effect.gen(function*() {
    const errors = yield* Effect.all([
      plan([entry({ content: [hole("sha256", "missing")] })], []).pipe(Effect.flip),
      plan([entry({ content: [hole("downloadUrl")] }, "")]).pipe(Effect.flip),
      plan([entry(), entry()]).pipe(Effect.flip)
    ])
    expect(errors.map((error) => error._tag)).toEqual(["PlanError", "PlanError", "PlanError"])
    expect(errors.map((error) => error.reason)).toEqual(["Catalog entry market references missing artifact missing.",
      "Catalog entry market downloadUrl requires publish.github.repository or project.repository.", "Duplicate catalog id: market"])
  }))
})
