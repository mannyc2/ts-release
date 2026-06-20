import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { ExecutionApproval } from "../src/domain/operation.js"
import { makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { renderPlan, validatePlan } from "../src/planner/executor.js"
import { releaseConfig, homebrewConfig, runEffect } from "./helpers.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"

const HomebrewLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    files: new Map([["artifacts/release-0.1.0.tgz", "homebrew archive"]]),
    directories: new Set(["."])
  }),
  LiveTargetRegistryLayer
)

const createPlan = (config: string) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config)
    return yield* createReleasePlan(intent)
  })

const expectValidationRecord = (
  records: ReadonlyArray<{ readonly id: string; readonly status: string; readonly severity?: string; readonly skipped?: boolean }>,
  id: string,
  expected: { readonly status: string; readonly severity: string; readonly skipped: boolean }
) => {
  const record = records.find((item) => item.id === id)
  expect(record?.status).toBe(expected.status)
  expect(record?.severity).toBe(expected.severity)
  if (record !== undefined && "skipped" in record) {
    expect(record.skipped).toBe(expected.skipped)
  }
}

describe("Homebrew target", () => {
  test("plans Homebrew tap capabilities and formula rendering", async () => {
    const plan = await runEffect(createPlan(homebrewConfig()), HomebrewLayer)
    const homebrew = plan.targetCapabilities.find((capability) => capability.targetId === "homebrew")
    const render = plan.operations.find((operation) => operation.id === "homebrew:homebrew-render-formula")
    const publish = plan.operations.find((operation) => operation.id === "homebrew:homebrew-push")

    expect(homebrew?.targetTag).toBe("HomebrewTapTarget")
    expect(homebrew?.authRequirement).toBe("cli-auth")
    expect(homebrew?.mutability).toBe("mutable-index")
    expect(homebrew?.validationStrategy).toBe("simulated-plan")
    expect(render?._tag).toBe("RenderFileOperation")
    expect(publish?._tag).toBe("PublishCommandOperation")
    if (render?._tag === "RenderFileOperation") {
      expect(render.description).toContain("release.rb")
      expect(render.path).toBe(".release/generated/release.rb")
      expect(render.contents).toContain("class Release < Formula")
      expect(render.contents).toContain("sha256 \"686f6d65627265772061726368697665\"")
      expect(render.contents).toContain("bin.install \"bin/release\" => \"release\"")
    }
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.risk).toBe("externally-visible")
      expect(publish.command.args).toEqual(["-C", ".", "push"])
      expect(publish.command.requiredEnv).toEqual([])
      expect(publish.command.redactedEnv).toEqual([])
    }
  })

  test("marks immutable Homebrew tap pushes as irreversible", async () => {
    const plan = await runEffect(createPlan(homebrewConfig({ mutability: "immutable" })), HomebrewLayer)
    const publish = plan.operations.find((operation) => operation.id === "homebrew:homebrew-push")

    expect(publish?._tag).toBe("PublishCommandOperation")
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.risk).toBe("irreversible")
      expect(publish.gate.requiresIrreversibleApproval).toBe(true)
      expect(publish.gate.reason).toBe("Pushing a Homebrew tap update is configured as irreversible.")
    }
  })

  test("rejects Homebrew tokenEnv because tap pushes use Git credentials", async () => {
    const error = await runEffect(createPlan(homebrewConfig({ tokenEnv: "GH_TOKEN" })).pipe(Effect.flip), HomebrewLayer)

    expect(error._tag).toBe("PlanConstructionError")
    if (error._tag === "PlanConstructionError") {
      expect(error.reason).toContain("Homebrew tap targets")
      expect(error.reason).toContain("plain git push")
      expect(error.reason).toContain("Git credentials")
    }
  })

  test("records simulated validation note evidence with current adapter severities", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(homebrewConfig())
        return yield* validatePlan(plan)
      }),
      HomebrewLayer
    )

    expectValidationRecord(evidence.records, "homebrew:brew-audit:validation", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
  })

  test("renders Homebrew formula evidence through the render workflow", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(homebrewConfig())
        return yield* renderPlan(plan, ExecutionApproval.make({ execute: true, approveIrreversible: false }))
      }),
      HomebrewLayer
    )

    expect(evidence.records.map((record) => record.id)).toEqual(["homebrew:homebrew-render-formula:execution"])
  })

  test("rejects Homebrew targets that reference missing artifacts", async () => {
    const error = await runEffect(
      createPlan(homebrewConfig({ artifactId: "missing" })).pipe(Effect.flip),
      HomebrewLayer
    )

    expect(error._tag).toBe("PlanConstructionError")
    if (error._tag === "PlanConstructionError") {
      expect(error.reason).toBe("Homebrew target references missing artifact missing.")
    }
  })

  test("rejects directory artifacts for Homebrew formulas", async () => {
    const directoryConfig = releaseConfig({
      artifacts: [
        {
          id: "archive",
          path: ".",
          format: "directory",
          consumers: ["homebrew"]
        }
      ],
      targets: [
        {
          _tag: "HomebrewTapTarget",
          id: "homebrew",
          repository: "owner/homebrew-tap",
          formulaName: "release",
          formulaPath: ".release/generated/release.rb",
          artifactId: "archive",
          dryRunSupport: "simulated",
          mutability: "mutable-index",
          recovery: "manual"
        }
      ]
    })
    const error = await runEffect(createPlan(directoryConfig).pipe(Effect.flip), HomebrewLayer)

    expect(error._tag).toBe("PlanConstructionError")
    if (error._tag === "PlanConstructionError") {
      expect(error.reason).toBe("Homebrew formula artifacts must be file-like, not directories.")
    }
  })

  test("rejects non-sha256 checksums during artifact inventory", async () => {
    const error = await runEffect(
      createPlan(
        homebrewConfig().replace(
          "\"consumers\":[\"homebrew\"]",
          "\"consumers\":[\"homebrew\"],\"checksum\":{\"algorithm\":\"sha512\",\"value\":\"sha512:manual\"}"
        )
      ).pipe(Effect.flip),
      HomebrewLayer
    )

    expect(error._tag).toBe("ReleaseNormalizationError")
    if (error._tag === "ReleaseNormalizationError") {
      expect(error.field).toBe("artifacts.archive.checksum")
    }
  })

  test("rejects mismatched manual sha256 checksums before formula rendering", async () => {
    const error = await runEffect(
      createPlan(
        homebrewConfig().replace(
          "\"consumers\":[\"homebrew\"]",
          "\"consumers\":[\"homebrew\"],\"checksum\":{\"algorithm\":\"sha256\",\"value\":\"00\"}"
        )
      ).pipe(Effect.flip),
      HomebrewLayer
    )

    expect(error._tag).toBe("ReleaseNormalizationError")
    if (error._tag === "ReleaseNormalizationError") {
      expect(error.field).toBe("artifacts.archive.checksum")
    }
  })

  test("records skipped Homebrew validation in non-strict mode", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(homebrewConfig({ dryRunSupport: "none" }).replace("\"strict\":true", "\"strict\":false"))
        return yield* validatePlan(plan)
      }),
      HomebrewLayer
    )

    expect(evidence.records.filter((record) => record.status === "skipped").map((record) => record.id)).toEqual([
      "homebrew:brew-audit:validation"
    ])
    expectValidationRecord(evidence.records, "homebrew:brew-audit:validation", {
      status: "skipped",
      skipped: true,
      severity: "warning"
    })
  })
})
