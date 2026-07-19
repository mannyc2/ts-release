import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ExecutionApproval } from "../src/grammar/operation.js"
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
    const render = release.operations.find(({ id }) => id === "scoop:scoop-render-manifest")
    const publish = release.operations.find(({ id }) => id === "scoop:scoop-push")
    expect(release.surfaceIds).toEqual(["scoop"])
    expect(render).toMatchObject({ description: expect.stringContaining("release.json"), action: {
      _tag: "write-file", path: ".release/generated/release.json", contents: { _tag: "file-parts" }
    } })
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
  })

  test("rejects tokenEnv because bucket pushes use Git credentials", async () => {
    const error = await runEffect(plan(scoopConfig({ tokenEnv: "GH_TOKEN" })).pipe(Effect.flip), ScoopLayer)
    expect(error).toMatchObject({ _tag: "PlanError" })
    if (error._tag === "PlanError") {
      for (const text of ["Scoop bucket targets", "plain git push", "Git credentials"])
        expect(error.reason).toContain(text)
    }
  })

  test("keeps validation and render workflows visible", async () => {
    const result = await runEffect(Effect.gen(function*() {
      const release = yield* plan(scoopConfig())
      const validation = yield* validateTestPlan(release)
      const rendered = yield* renderTestPlan(
        release,
        ExecutionApproval.make({ execute: true, approveIrreversible: false })
      )
      return { validation, rendered }
    }), ScoopLayer)
    expect(result.validation.records.find(({ operationId }) =>
      operationId === "scoop:scoop-manifest-validation")?.status).toBe("passed")
    expect(result.rendered.records.map(({ operationId }) => operationId))
      .toEqual(["scoop:scoop-render-manifest"])
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
    expect(manual.operations.map(({ id }) => id).includes("scoop:scoop-render-manifest")).toBe(true)
  })
})
