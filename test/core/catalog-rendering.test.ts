import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { makeReleaseApi } from "../../src/api/api.js"
import { compareCatalogVersions, decodeCatalogManagedState } from "../../src/model/catalog.js"
import { makeLocalPreparedReleaseStore } from "../../src/release/prepared-store.js"
import { runtimeLayer } from "./runtime-fixture.js"

const temporaryWorkspace = (): string => {
  const root = mkdtempSync("/tmp/ts-release-catalog-render-")
  mkdirSync(join(root, "dist"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.2.3" }))
  writeFileSync(join(root, "dist", "fixture-darwin-arm64.tar.gz"), "darwin archive\n")
  writeFileSync(join(root, "dist", "fixture-windows-x64.zip"), "windows archive\n")
  return root
}

const config = {
  project: {
    name: "fixture",
    version: "1.2.3",
    tag: "v1.2.3",
    repository: "owner/fixture"
  },
  artifacts: [
    { id: "darwin-arm64", path: "dist/fixture-darwin-arm64.tar.gz", format: "tarball" },
    { id: "windows-x64", path: "dist/fixture-windows-x64.zip", format: "zip" }
  ],
  catalogs: {
    homebrew: [{
      id: "homebrew",
      formulaName: "fixture",
      description: "Fixture command",
      homepage: "https://example.test/fixture",
      license: "MIT",
      installPath: "fixture",
      sources: [{ artifact: "darwin-arm64", architecture: "arm64" }]
    }],
    scoop: [{
      id: "scoop",
      manifestName: "fixture",
      description: "Fixture command",
      homepage: "https://example.test/fixture",
      license: "MIT",
      bin: "fixture.exe",
      sources: [{ artifact: "windows-x64", architecture: "x64" }]
    }]
  },
  publish: {
    github: { repository: "owner/fixture", ids: ["darwin-arm64", "windows-x64"] },
    catalogGit: [
      {
        catalog: "homebrew",
        repository: "owner/homebrew-tap",
        branch: "main",
        targetPath: "Formula/fixture.rb",
        statePath: ".ts-release/homebrew.json",
        tokenEnv: "GITHUB_TOKEN"
      },
      {
        catalog: "scoop",
        repository: "owner/scoop-bucket",
        branch: "main",
        targetPath: "bucket/fixture.json",
        statePath: ".ts-release/scoop.json",
        tokenEnv: "GITHUB_TOKEN"
      }
    ]
  }
} as const

describe("typed catalog rendering", () => {
  test("renders Homebrew and Scoop from exact prepared GitHub asset digests", async () => {
    const root = temporaryWorkspace()
    const store = makeLocalPreparedReleaseStore(join(root, "prepared-store"))
    const api = makeReleaseApi(runtimeLayer(undefined, store))
    try {
      const graph = await api.inspect({ workspace: root, config })
      expect("preparations" in graph ? graph.preparations.map((item) => item.kind) : []).toEqual([
        "CatalogRender",
        "CatalogRender"
      ])
      expect("publications" in graph ? graph.publications.map((item) => item.destination) : []).toEqual([
        "github", "catalog-git", "catalog-git"
      ])

      const reference = await api.prepare({ workspace: root, config })
      const prepared = await Effect.runPromise(store.load(reference))
      const publications = prepared.manifest.publications.filter((item) => item._tag === "PreparedCatalogPublication")
      expect(publications).toHaveLength(2)

      const homebrew = publications.find((item) => item.catalogId === "homebrew")!
      const scoop = publications.find((item) => item.catalogId === "scoop")!
      const homebrewText = new TextDecoder().decode(prepared.blobs.get(homebrew.targetArtifactId)!)
      const scoopText = new TextDecoder().decode(prepared.blobs.get(scoop.targetArtifactId)!)
      expect(homebrewText).toContain('version "1.2.3"')
      expect(homebrewText).toContain("https://github.com/owner/fixture/releases/download/v1.2.3/fixture-darwin-arm64.tar.gz")
      expect(homebrewText).toContain('sha256 "')
      expect(JSON.parse(scoopText)).toMatchObject({
        version: "1.2.3",
        bin: "fixture.exe",
        url: "https://github.com/owner/fixture/releases/download/v1.2.3/fixture-windows-x64.zip"
      })

      for (const publication of publications) {
        const state = decodeCatalogManagedState(prepared.blobs.get(publication.stateArtifactId)!)
        expect(state).toMatchObject({
          schemaVersion: "ts-release/catalog-state/v2",
          catalogId: publication.catalogId,
          generation: "1.2.3",
          status: "active",
          sourceRepository: "owner/fixture",
          sourceTag: "v1.2.3"
        })
        expect(state?.targetDigest.hex).toBe(publication.targetDigest.hex)
      }
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("uses real SemVer ordering instead of lexical ordering", () => {
    expect(compareCatalogVersions("1.0.0-beta.2", "1.0.0-beta.10")).toBeLessThan(0)
  })
})
