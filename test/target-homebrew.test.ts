import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ExecutionApproval } from "../src/pipeline/operation.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { homebrewConfig, releaseConfig, runEffect } from "./helpers.js"
import { createTestPlan, renderTestPlan, validateTestPlan } from "./plan-helpers.js"

const HomebrewLayer = Layer.mergeAll(makeTestCommandRunnerLayer({
  files: new Map([["artifacts/release-0.1.0.tgz", "homebrew archive"]]),
  directories: new Set(["."])
}))
const plan = (config: string) => createTestPlan(config)

describe("Homebrew target", () => {
  test("plans the tap, formula parts, and git push", async () => {
    const release = await runEffect(plan(homebrewConfig()), HomebrewLayer)
    const render = release.operations.find(({ id }) => id === "homebrew:homebrew-render-formula")
    const publish = release.operations.find(({ id }) => id === "homebrew:homebrew-push")
    expect(release.surfaceIds).toEqual(["homebrew"])
    expect(render).toMatchObject({ description: expect.stringContaining("release.rb"), action: {
      _tag: "write-file", path: ".release/generated/release.rb", contents: { _tag: "file-parts" }
    } })
    if (render?.action._tag === "write-file" && typeof render.action.contents !== "string") {
      expect(render.action.contents.parts.flatMap((part) =>
        typeof part === "string" ? [] : [part.artifactId]
      )).toEqual(["archive"])
      expect(render.action.contents.parts.filter((part) => typeof part === "string").join(""))
        .toContain("class Release < Formula")
    }
    expect(publish).toMatchObject({ risk: "externally-visible", action: { _tag: "command", command: {
      args: ["-C", ".", "push"], requiredEnv: [], redactedEnv: []
    } } })
  })

  test("rejects tokenEnv because tap pushes use Git credentials", async () => {
    const error = await runEffect(plan(homebrewConfig({ tokenEnv: "GH_TOKEN" })).pipe(Effect.flip), HomebrewLayer)
    expect(error).toMatchObject({ _tag: "PlanError" })
    if (error._tag === "PlanError") {
      for (const text of ["Homebrew tap targets", "plain git push", "Git credentials"])
        expect(error.reason).toContain(text)
    }
  })

  test("keeps validation and render workflows visible", async () => {
    const result = await runEffect(Effect.gen(function*() {
      const release = yield* plan(homebrewConfig())
      const validation = yield* validateTestPlan(release)
      const rendered = yield* renderTestPlan(
        release,
        ExecutionApproval.make({ execute: true, approveIrreversible: false })
      )
      return { validation, rendered }
    }), HomebrewLayer)
    expect(result.validation.records.find(({ operationId }) => operationId === "homebrew:brew-audit")?.status)
      .toBe("passed")
    expect(result.rendered.records.map(({ operationId }) => operationId))
      .toEqual(["homebrew:homebrew-render-formula"])
  })

  test("preserves reference, file-shape, and checksum safeguards", async () => {
    const directory = releaseConfig({ artifacts: [{ id: "archive", path: ".", format: "directory" }],
      publish: { homebrew: { repository: "owner/homebrew-tap", formulaName: "release",
        formulaPath: ".release/generated/release.rb", artifactIds: ["archive"] } } })
    const nonSha256 = homebrewConfig().replace(
      "\"format\":\"tarball\"",
      "\"format\":\"tarball\",\"checksum\":{\"algorithm\":\"sha512\",\"value\":\"sha512:manual\"}"
    )
    const [missing, directoryArtifact, checksum] = await Promise.all([
      runEffect(plan(homebrewConfig({ artifactIds: ["missing"] })).pipe(Effect.flip), HomebrewLayer),
      runEffect(plan(directory).pipe(Effect.flip), HomebrewLayer),
      runEffect(plan(nonSha256).pipe(Effect.flip), HomebrewLayer)
    ])
    expect(missing).toMatchObject({ _tag: "PlanError",
      reason: "Homebrew target references missing artifact missing." })
    expect(directoryArtifact).toMatchObject({ _tag: "PlanError",
      reason: "Homebrew formula artifacts must be file-like, not directories." })
    expect(checksum).toMatchObject({ _tag: "PlanError", field: "artifacts.archive.checksum" })

    const manual = await runEffect(plan(homebrewConfig().replace(
      "\"format\":\"tarball\"",
      "\"format\":\"tarball\",\"checksum\":{\"algorithm\":\"sha256\",\"value\":\"00\"}"
    )), HomebrewLayer)
    expect(manual.operations.map(({ id }) => id).includes("homebrew:homebrew-render-formula")).toBe(true)
  })
})
