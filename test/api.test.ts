import { describe, expect, test } from "bun:test"
import { mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { plan } from "../src/index.js"

const config = {
  project: { name: "api-contract", version: "1.0.0", tag: "v1.0.0" },
  publish: {}
}

describe("public plan API", () => {
  test("returns canonical bytes and matching identity from an in-memory value", async () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "release-api-")))
    const result = await plan({ config, workspace })
    expect(JSON.parse(result.bytes)).toEqual(JSON.parse(JSON.stringify(result.plan)))
    expect(result.planId.length).toBe(64)
  })

  test("runtime rejects configPath as an excess outer field", async () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "release-api-")))
    // @ts-expect-error configPath is intentionally absent from the public input.
    await expect(plan({ config, workspace, configPath: "release.json" })).rejects.toMatchObject({
      _tag: "ReleaseApiError",
      phase: "plan"
    })
  })
})
