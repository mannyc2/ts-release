import { describe, expect, test } from "bun:test"
import { mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { apply, plan } from "../src/index.js"

const config = {
  project: { name: "api-contract", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
  publish: {}
}

describe("public plan API", () => {
  test("returns canonical bytes and matching identity from an in-memory value", async () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "release-api-")))
    const result = await plan({ config, workspace })
    expect(JSON.parse(result.bytes)).toEqual(JSON.parse(JSON.stringify(result.plan)))
    expect(result.planId.length).toBe(64)
  })

  test("a config without a commit is refused instead of planning an invented identity", async () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "release-api-")))
    const { commit: _observed, ...project } = config.project
    await expect(plan({ config: { ...config, project }, workspace })).rejects.toMatchObject({
      _tag: "ReleaseApiError",
      phase: "plan",
      reason: expect.stringContaining("--from-git")
    })
  })

  test("runtime rejects configPath as an excess outer field", async () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "release-api-")))
    // @ts-expect-error configPath is intentionally absent from the public input.
    await expect(plan({ config, workspace, configPath: "release.json" })).rejects.toMatchObject({
      _tag: "ReleaseApiError",
      phase: "plan"
    })
  })

  test("the apply boundary decodes once: excess, malformed, and XOR refuse", async () => {
    const base = {
      planBytes: "{}",
      expectedPlanId: "a".repeat(64),
      workspace: "/tmp"
    }
    await expect(apply({ ...base, resumeRunPath: "runs", extra: 1 } as never))
      .rejects.toThrow(/extra/)
    // The case the Action previously admitted: a malformed operator override.
    await expect(apply({
      ...base,
      resumeRunPath: "runs",
      resolutions: [{ operationId: "x", outcome: "maybe", operator: "o", reason: "r" }]
    } as never)).rejects.toMatchObject({ _tag: "ReleaseApiError", phase: "apply" })
    await expect(apply({
      ...base,
      resumeRunPath: "runs",
      newRun: {
        path: "runs",
        scope: "all",
        executionReviewId: "e".repeat(64),
        reviewer: "reviewer"
      }
    } as never)).rejects.toThrow(/Choose exactly one of newRun or resumeRunPath/)
  })
})
