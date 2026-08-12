import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { makeReleaseApi } from "../src/index.js"
import { ReleaseInputError } from "../src/api/errors.js"
import { fixtureConfig, runtimeLayer } from "./core/runtime-fixture.js"

const workspace = (): string => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-api-"))
  mkdirSync(join(root, "src"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }))
  writeFileSync(join(root, "payload.txt"), "payload\n")
  return root
}

describe("public lifecycle API", () => {
  test("exposes inspect, prepare, publish, release, and correct", async () => {
    const root = workspace()
    const api = makeReleaseApi(runtimeLayer())
    try {
      const inspection = await api.inspect({ config: fixtureConfig, workspace: root })
      expect(inspection.source.commit.toString()).toBe("abc123")
      const prepared = await api.prepare({ config: fixtureConfig, workspace: root })
      expect(prepared.manifest.schemaVersion).toBe("prepared-release/v1")
      const published = await api.publish({ prepared: prepared.directory })
      expect(published).toEqual([])
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("release composes preparation and publication automatically", async () => {
    const root = workspace()
    const api = makeReleaseApi(runtimeLayer())
    try {
      const result = await api.release({ config: fixtureConfig, workspace: root })
      expect(result.prepared.manifest.schemaVersion).toBe("prepared-release/v1")
      expect(result.publications).toEqual([])
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("release refuses an accidental empty graph unless diagnostics opt in", async () => {
    const root = workspace()
    const api = makeReleaseApi(runtimeLayer())
    const config = {
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
      publish: {}
    }
    try {
      await expect(api.release({ config, workspace: root })).rejects.toBeInstanceOf(ReleaseInputError)
      const diagnostic = await api.release({ config, workspace: root, allowEmpty: true })
      expect(diagnostic.prepared.manifest.artifacts).toEqual([])
      expect(diagnostic.publications).toEqual([])
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("inspect has one exclusive input boundary", async () => {
    const api = makeReleaseApi(runtimeLayer())
    try {
      await expect(api.inspect({ config: fixtureConfig, prepared: "/tmp/bundle", workspace: "/tmp" })).rejects.toBeInstanceOf(ReleaseInputError)
      await expect(api.inspect({ workspace: "/tmp" })).rejects.toBeInstanceOf(ReleaseInputError)
    } finally {
      await api.dispose()
    }
  })
})
