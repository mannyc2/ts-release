import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ExecutionApproval } from "../src/grammar/approval.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { homebrewConfig, releaseConfig, releaseIdentity, runEffect } from "./helpers.js"
import { createTestPlan, renderTestPlan, validateTestPlan } from "./plan-helpers.js"

const HomebrewLayer = Layer.mergeAll(makeTestCommandRunnerLayer({
  files: new Map([["artifacts/release-0.1.0.tgz", "homebrew archive"]]),
  directories: new Set(["."])
}))
const plan = (config: string) => createTestPlan(config)

describe("Homebrew target", () => {
  test("plans the tap, formula parts, and git push", async () => {
    const release = await runEffect(plan(homebrewConfig()), HomebrewLayer)
    const render = release.operations.find(({ id }) => id === "catalog:homebrew:render")
    const publish = release.operations.find(({ id }) => id === "catalog:homebrew:push")
    expect(release.surfaceIds).toEqual(["catalog", "file"])
    expect(release.artifacts).toContainEqual(expect.objectContaining({
      id: "catalog-file-homebrew", producedBy: "catalog:file"
    }))
    expect(render?.pipeId).toBe("catalog:file")
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
    expect(publish?.pipeId).toBe("publish:catalog")
  })

  test("rejects removed tokenEnv with its migration hint", async () => {
    const error = await runEffect(plan(homebrewConfig({ tokenEnv: "GH_TOKEN" })).pipe(Effect.flip), HomebrewLayer)
    expect(error).toMatchObject({ _tag: "ConfigError", kind: "validation" })
    if (error._tag === "ConfigError") expect(error.reason).toContain("ambient git credentials; tokenEnv was removed")
  })

  test("requires project.description and project.homepage for the formula", async () => {
    const section = {
      repository: "owner/homebrew-tap", formulaName: "release",
      formulaPath: ".release/generated/release.rb", ids: ["archive"]
    }
    const archive = [{ id: "archive", path: "artifacts/release-0.1.0.tgz", format: "tarball" }]
    const [missingDescription, missingHomepage] = await Promise.all([
      runEffect(plan(releaseConfig({
        identity: releaseIdentity({ homepage: "https://github.com/owner/release" }),
        artifacts: archive, publish: { homebrew: section }
      })).pipe(Effect.flip), HomebrewLayer),
      runEffect(plan(releaseConfig({
        identity: releaseIdentity({ description: "Example Homebrew release" }),
        artifacts: archive, publish: { homebrew: section }
      })).pipe(Effect.flip), HomebrewLayer)
    ])
    expect(missingDescription).toMatchObject({ _tag: "PlanError", pipeId: "catalog:homebrew",
      field: "project.description", reason: "Homebrew publishing requires project.description." })
    expect(missingHomepage).toMatchObject({ _tag: "PlanError", pipeId: "catalog:homebrew",
      field: "project.homepage", reason: "Homebrew publishing requires project.homepage or publish.github.repository." })
  })

  test("derives the formula homepage from the GitHub repository", async () => {
    const release = await runEffect(plan(releaseConfig({
      identity: releaseIdentity({ description: "Example Homebrew release" }),
      artifacts: [{ id: "archive", path: "artifacts/release-0.1.0.tgz", format: "tarball" }],
      publish: {
        github: { repository: "owner/derived" },
        homebrew: { repository: "owner/homebrew-tap", formulaName: "release",
          formulaPath: ".release/generated/release.rb", ids: ["archive"] }
      }
    })), HomebrewLayer)
    const render = release.operations.find(({ id }) => id === "catalog:homebrew:render")
    if (render?.action._tag === "write-file" && typeof render.action.contents !== "string") {
      expect(render.action.contents.parts.filter((part) => typeof part === "string").join(""))
        .toContain("homepage \"https://github.com/owner/derived\"")
    } else {
      throw new Error("expected rendered formula parts")
    }
  })

  test("keeps configured validation and render workflows visible", async () => {
    const result = await runEffect(Effect.gen(function*() {
      const release = yield* plan(homebrewConfig({ validate: ["brew", "audit", "--version", "{version}"] }))
      const validation = yield* validateTestPlan(release)
      const rendered = yield* renderTestPlan(
        release,
        ExecutionApproval.make({ execute: true, approveIrreversible: false })
      )
      return { validation, rendered }
    }), HomebrewLayer)
    expect(result.validation.records.find(({ operationId }) => operationId === "catalog:homebrew:validate")?.status)
      .toBe("passed")
    expect(result.rendered.records.map(({ operationId }) => operationId))
      .toEqual(["catalog:homebrew:render"])
  })

  test("supports pull-request submission", async () => {
    const release = await runEffect(plan(homebrewConfig({ submit: "pull-request" })), HomebrewLayer)
    expect(release.operations.filter(({ id }) => id.startsWith("catalog:homebrew:"))
      .map(({ id }) => id)).toEqual([
      "catalog:homebrew:render",
      "catalog:homebrew:checkout",
      "catalog:homebrew:push:add",
      "catalog:homebrew:push:commit",
      "catalog:homebrew:push",
      "catalog:homebrew:pull-request"
    ])
    expect(release.operations.find(({ id }) => id === "catalog:homebrew:pull-request")?.action)
      .toMatchObject({ _tag: "command", command: { executable: "gh", args: expect.arrayContaining([
        "pr", "create", "--repo", "owner/homebrew-tap", "--title", "Update release to 0.1.0"
      ]) } })
  })

  test("preserves reference, file-shape, and checksum safeguards", async () => {
    const directory = releaseConfig({ artifacts: [{ id: "archive", path: ".", format: "directory" }],
      publish: { homebrew: { repository: "owner/homebrew-tap", formulaName: "release",
        formulaPath: ".release/generated/release.rb", ids: ["archive"] } } })
    const nonSha256 = homebrewConfig().replace(
      "\"format\":\"tarball\"",
      "\"format\":\"tarball\",\"checksum\":{\"algorithm\":\"sha512\",\"value\":\"sha512:manual\"}"
    )
    const [missing, directoryArtifact, checksum] = await Promise.all([
      runEffect(plan(homebrewConfig({ ids: ["missing"] })).pipe(Effect.flip), HomebrewLayer),
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
    expect(manual.operations.map(({ id }) => id).includes("catalog:homebrew:render")).toBe(true)
  })
})
