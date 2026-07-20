import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ExecutionApproval } from "../src/grammar/approval.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { releaseConfig, runEffect, scoopConfig } from "./helpers.js"
import { createTestPlan, renderTestPlan, validateTestPlan } from "./plan-helpers.js"

const ScoopLayer = Layer.mergeAll(makeTestCommandRunnerLayer({
  files: new Map([["artifacts/release-0.1.0.zip", "scoop archive"]]),
  directories: new Set(["."])
}))
const plan = (config: string) => createTestPlan(config)

describe("Scoop target", () => {
  test("plans the bucket, manifest parts, and git push", async () => {
    const release = await runEffect(plan(scoopConfig({ bucketDirectory: "bucket" })), ScoopLayer)
    const render = release.operations.find(({ id }) => id === "catalog:scoop:render")
    const publish = release.operations.find(({ id }) => id === "catalog:scoop:push")
    expect(release.surfaceIds).toEqual(["catalog", "file"])
    expect(release.artifacts).toContainEqual(expect.objectContaining({
      id: "catalog-file-scoop", producedBy: "catalog:file"
    }))
    expect(render).toMatchObject({ description: expect.stringContaining("release.json"), action: {
      _tag: "write-file", path: "bucket/.release/generated/release.json", contents: { _tag: "file-parts" }
    } })
    expect(render?.pipeId).toBe("catalog:file")
    if (render?.action._tag === "write-file" && typeof render.action.contents !== "string") {
      expect(render.action.contents.parts.flatMap((part) =>
        typeof part === "string" ? [] : [part.artifactId]
      )).toEqual(["archive"])
      const literals = render.action.contents.parts.filter((part) => typeof part === "string").join("")
      expect(literals).toContain('"version": "0.1.0"')
      expect(literals).toContain('"bin": "release.exe"')
    }
    expect(publish).toMatchObject({ risk: "externally-visible", action: { _tag: "command", command: {
      args: ["-C", "bucket", "push"], requiredEnv: [], redactedEnv: []
    } } })
    expect(publish?.pipeId).toBe("publish:catalog")
  })

  test("rejects removed tokenEnv with its migration hint", async () => {
    const error = await runEffect(plan(scoopConfig({ tokenEnv: "GH_TOKEN" })).pipe(Effect.flip), ScoopLayer)
    expect(error).toMatchObject({ _tag: "ConfigError", kind: "validation" })
    if (error._tag === "ConfigError") expect(error.reason).toContain("ambient git credentials; tokenEnv was removed")
  })

  test("keeps configured validation and render workflows visible", async () => {
    const result = await runEffect(Effect.gen(function*() {
      const release = yield* plan(scoopConfig({ validate: ["scoop-check", "--version", "{version}"] }))
      const validation = yield* validateTestPlan(release)
      const rendered = yield* renderTestPlan(
        release,
        ExecutionApproval.make({ execute: true, approveIrreversible: false })
      )
      return { validation, rendered }
    }), ScoopLayer)
    expect(result.validation.records.find(({ operationId }) =>
      operationId === "catalog:scoop:validate")?.status).toBe("passed")
    expect(result.rendered.records.map(({ operationId }) => operationId))
      .toEqual(["catalog:scoop:render"])
  })

  test("supports pull-request submission", async () => {
    const release = await runEffect(plan(scoopConfig({ submit: "pull-request" })), ScoopLayer)
    expect(release.operations.filter(({ id }) => id.startsWith("catalog:scoop:"))
      .map(({ id }) => id)).toEqual([
      "catalog:scoop:render",
      "catalog:scoop:checkout",
      "catalog:scoop:push:add",
      "catalog:scoop:push:commit",
      "catalog:scoop:push",
      "catalog:scoop:pull-request"
    ])
    expect(release.operations.find(({ id }) => id === "catalog:scoop:pull-request")?.action)
      .toMatchObject({ _tag: "command", command: { executable: "gh", args: expect.arrayContaining([
        "pr", "create", "--repo", "owner/scoop-bucket", "--title", "Update release to 0.1.0"
      ]) } })
  })

  test("preserves reference, file-shape, and checksum safeguards", async () => {
    const directory = releaseConfig({ artifacts: [{ id: "archive", path: ".", format: "directory" }],
      publish: { scoop: { repository: "owner/scoop-bucket", manifestName: "release",
        manifestPath: ".release/generated/release.json", artifactId: "archive" } } })
    const nonSha256 = scoopConfig({ artifactId: "archive" }).replace(
      "\"format\":\"zip\"",
      "\"format\":\"zip\",\"checksum\":{\"algorithm\":\"sha512\",\"value\":\"sha512:manual\"}"
    )
    const [missing, directoryArtifact, checksum] = await Promise.all([
      runEffect(plan(scoopConfig({ artifactId: "missing" })).pipe(Effect.flip), ScoopLayer),
      runEffect(plan(directory).pipe(Effect.flip), ScoopLayer),
      runEffect(plan(nonSha256).pipe(Effect.flip), ScoopLayer)
    ])
    expect(missing).toMatchObject({ _tag: "PlanError",
      reason: "Scoop target references missing artifact missing." })
    expect(directoryArtifact).toMatchObject({ _tag: "PlanError",
      reason: "Scoop manifest artifacts must be file-like, not directories." })
    expect(checksum).toMatchObject({ _tag: "PlanError", field: "artifacts.archive.checksum" })

    const manual = await runEffect(plan(scoopConfig({ artifactId: "archive" }).replace(
      "\"format\":\"zip\"",
      "\"format\":\"zip\",\"checksum\":{\"algorithm\":\"sha256\",\"value\":\"00\"}"
    )), ScoopLayer)
    expect(manual.operations.map(({ id }) => id).includes("catalog:scoop:render")).toBe(true)
  })
})
