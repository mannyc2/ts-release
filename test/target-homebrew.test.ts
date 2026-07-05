import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ExecutionApproval } from "../src/pipeline/operation.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { releaseConfig, homebrewConfig, runEffect } from "./helpers.js"
import { createTestPlan, renderTestPlan, validateTestPlan } from "./plan-helpers.js"

const HomebrewLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    files: new Map([["artifacts/release-0.1.0.tgz", "homebrew archive"]]),
    directories: new Set(["."])
  }),
)

const createPlan = (config: string) =>
  createTestPlan(config)

const expectValidationRecord = (
  records: ReadonlyArray<{ readonly operationId: string; readonly status: string }>,
  id: string,
  expected: { readonly status: string; readonly severity: string; readonly skipped: boolean }
) => {
  const record = records.find((item) => item.operationId === id)
  expect(record?.status).toBe(expected.status)
}

describe("Homebrew target", () => {
  test("plans Homebrew tap capabilities and formula rendering", async () => {
    const plan = await runEffect(createPlan(homebrewConfig()), HomebrewLayer)
    const render = plan.operations.find((operation) => operation.id === "homebrew:homebrew-render-formula")
    const publish = plan.operations.find((operation) => operation.id === "homebrew:homebrew-push")

    expect(plan.surfaceIds).toEqual(["homebrew"])
    expect(render?.action._tag).toBe("write-file")
    expect(publish?.action._tag).toBe("command")
    if (render?.action._tag === "write-file") {
      expect(render.description).toContain("release.rb")
      expect(render.action.path).toBe(".release/generated/release.rb")
      expect(typeof render.action.contents).toBe("object")
      if (typeof render.action.contents === "object" && render.action.contents._tag === "homebrew-formula") {
        expect(render.action.contents._tag).toBe("homebrew-formula")
        expect(render.action.contents.formulaName).toBe("release")
        expect(render.action.contents.entries.map((entry) => entry.artifactId)).toEqual(["archive"])
      }
    }
    if (publish?.action._tag === "command") {
      expect(publish.risk).toBe("externally-visible")
      expect(publish.action.command.args).toEqual(["-C", ".", "push"])
      expect(publish.action.command.requiredEnv).toEqual([])
      expect(publish.action.command.redactedEnv).toEqual([])
    }
  })

  test("rejects Homebrew tokenEnv because tap pushes use Git credentials", async () => {
    const error = await runEffect(createPlan(homebrewConfig({ tokenEnv: "GH_TOKEN" })).pipe(Effect.flip), HomebrewLayer)

    expect(error._tag).toBe("PlanError")
    if (error._tag === "PlanError") {
      expect(error.reason).toContain("Homebrew tap targets")
      expect(error.reason).toContain("plain git push")
      expect(error.reason).toContain("Git credentials")
    }
  })

  test("records simulated validation note evidence with current adapter severities", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(homebrewConfig())
        return yield* validateTestPlan(plan)
      }),
      HomebrewLayer
    )

    expectValidationRecord(evidence.records, "homebrew:brew-audit", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
  })

  test("renders Homebrew formula evidence through the render workflow", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(homebrewConfig())
        return yield* renderTestPlan(plan, ExecutionApproval.make({ execute: true, approveIrreversible: false }))
      }),
      HomebrewLayer
    )

    expect(evidence.records.map((record) => record.operationId)).toEqual(["homebrew:homebrew-render-formula"])
  })

  test("rejects Homebrew targets that reference missing artifacts", async () => {
    const error = await runEffect(
      createPlan(homebrewConfig({ artifactId: "missing" })).pipe(Effect.flip),
      HomebrewLayer
    )

    expect(error._tag).toBe("PlanError")
    if (error._tag === "PlanError") {
      expect(error.reason).toBe("Homebrew target references missing artifact missing.")
    }
  })

  test("rejects directory artifacts for Homebrew formulas", async () => {
    const directoryConfig = releaseConfig({
      artifacts: [
        {
          id: "archive",
          path: ".",
          format: "directory"
        }
      ],
      publish: {
        homebrew: {
          repository: "owner/homebrew-tap",
          formulaName: "release",
          formulaPath: ".release/generated/release.rb",
          artifactId: "archive"
        }
      }
    })
    const error = await runEffect(createPlan(directoryConfig).pipe(Effect.flip), HomebrewLayer)

    expect(error._tag).toBe("PlanError")
    if (error._tag === "PlanError") {
      expect(error.reason).toBe("Homebrew formula artifacts must be file-like, not directories.")
    }
  })

  test("rejects non-sha256 checksums for formula artifacts", async () => {
    const error = await runEffect(
      createPlan(
        homebrewConfig().replace(
          "\"format\":\"tarball\"",
          "\"format\":\"tarball\",\"checksum\":{\"algorithm\":\"sha512\",\"value\":\"sha512:manual\"}"
        )
      ).pipe(Effect.flip),
      HomebrewLayer
    )

    expect(error._tag).toBe("PlanError")
    if (error._tag === "PlanError") {
      expect(error.field).toBe("artifacts.archive.checksum")
    }
  })

  test("keeps manual sha256 checksums as execution-time artifact checks", async () => {
    const plan = await runEffect(
      createPlan(
        homebrewConfig().replace(
          "\"format\":\"tarball\"",
          "\"format\":\"tarball\",\"checksum\":{\"algorithm\":\"sha256\",\"value\":\"00\"}"
        )
      ),
      HomebrewLayer
    )

    const render = plan.operations.find((operation) => operation.id === "homebrew:homebrew-render-formula")
    expect(render?.action._tag).toBe("write-file")
  })

})
