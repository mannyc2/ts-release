import { describe, expect, test } from "@effect/bun-test"
import { readFileSync } from "node:fs"
import { makeReleaseApi } from "../src/index.js"
import { runtimeLayer } from "./core/runtime-fixture.js"

const preparationConfig = (): unknown => {
  const source = readFileSync(new URL("../docs/preparation.md", import.meta.url), "utf8")
  const block = /```json\n([\s\S]*?)\n```/u.exec(source)?.[1]
  if (block === undefined) throw new Error("docs/preparation.md has no JSON configuration example")
  return JSON.parse(block) as unknown
}

describe("native preparation documentation", () => {
  test("the documented check, artifact, transform, and GitHub body flow compiles through the public API", async () => {
    const api = makeReleaseApi(runtimeLayer())
    try {
      const inspection = await api.inspect({ config: preparationConfig(), workspace: process.cwd() })
      if (!("preparations" in inspection)) throw new Error("configuration inspection did not return the graph projection")
      const preparations = inspection.preparations.map((item) => item.id.toString())
      expect(preparations).toEqual([
        "preparation:release-notes",
        "preparation:release-notes-check",
        "preparation:release-notes-transform"
      ])
      expect(inspection.artifacts.map((item) => item.id.toString())).toContain("release-notes-transform")
      expect(inspection.publications[0]?.destination).toBe("github")
    } finally {
      await api.dispose()
    }
  })
})
