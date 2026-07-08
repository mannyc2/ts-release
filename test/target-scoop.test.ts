import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ExecutionApproval } from "../src/pipeline/operation.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { releaseConfig, runEffect, scoopConfig } from "./helpers.js"
import { createTestPlan, renderTestPlan, validateTestPlan } from "./plan-helpers.js"

const ScoopLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    files: new Map([["artifacts/release-0.1.0.zip", "scoop archive"]]),
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

describe("Scoop target", () => {
  test("plans Scoop bucket capabilities and manifest rendering", async () => {
    const plan = await runEffect(createPlan(scoopConfig({ bucketDirectory: "bucket" })), ScoopLayer)
    const render = plan.operations.find((operation) => operation.id === "scoop:scoop-render-manifest")
    const publish = plan.operations.find((operation) => operation.id === "scoop:scoop-push")

    expect(plan.surfaceIds).toEqual(["scoop"])
    expect(render?.action._tag).toBe("write-file")
    expect(publish?.action._tag).toBe("command")
    if (render?.action._tag === "write-file") {
      expect(render.description).toContain("release.json")
      expect(render.action.path).toBe(".release/generated/release.json")
      expect(typeof render.action.contents).toBe("object")
      if (typeof render.action.contents === "object" && render.action.contents._tag === "scoop-manifest") {
        expect(render.action.contents._tag).toBe("scoop-manifest")
        expect(render.action.contents.version).toBe("0.1.0")
        expect(render.action.contents.artifactId).toBe("archive")
        expect(render.action.contents.bin).toBe("release.exe")
      }
    }
    if (publish?.action._tag === "command") {
      expect(publish.risk).toBe("externally-visible")
      expect(publish.action.command.args).toEqual(["-C", "bucket", "push"])
      expect(publish.action.command.requiredEnv).toEqual([])
      expect(publish.action.command.redactedEnv).toEqual([])
    }
  })

  test("rejects Scoop tokenEnv because bucket pushes use Git credentials", async () => {
    const error = await runEffect(createPlan(scoopConfig({ tokenEnv: "GH_TOKEN" })).pipe(Effect.flip), ScoopLayer)

    expect(error._tag).toBe("PlanError")
    if (error._tag === "PlanError") {
      expect(error.reason).toContain("Scoop bucket targets")
      expect(error.reason).toContain("plain git push")
      expect(error.reason).toContain("Git credentials")
    }
  })

  test("records simulated validation note evidence with current adapter severities", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(scoopConfig())
        return yield* validateTestPlan(plan)
      }),
      ScoopLayer
    )

    expectValidationRecord(evidence.records, "scoop:scoop-manifest-validation", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
  })

  test("renders Scoop manifest evidence through the render workflow", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(scoopConfig())
        return yield* renderTestPlan(plan, ExecutionApproval.make({ execute: true, approveIrreversible: false }))
      }),
      ScoopLayer
    )

    expect(evidence.records.map((record) => record.operationId)).toEqual(["scoop:scoop-render-manifest"])
  })

  test("rejects unsafe Scoop target shapes", async () => {
    const missingArtifact = await runEffect(
      createPlan(scoopConfig({ artifactId: "missing" })).pipe(Effect.flip),
      ScoopLayer
    )
    const directoryConfig = releaseConfig({
      artifacts: [
        {
          id: "archive",
          path: ".",
          format: "directory"
        }
      ],
      publish: {
        scoop: {
          repository: "owner/scoop-bucket",
          manifestName: "release",
          manifestPath: ".release/generated/release.json",
          artifactId: "archive"
        }
      }
    })
    const directoryArtifact = await runEffect(createPlan(directoryConfig).pipe(Effect.flip), ScoopLayer)
    const nonSha256Checksum = await runEffect(
      createPlan(
        scoopConfig({
          artifactId: "archive"
        }).replace(
          "\"format\":\"zip\"",
          "\"format\":\"zip\",\"checksum\":{\"algorithm\":\"sha512\",\"value\":\"sha512:manual\"}"
        )
      ).pipe(Effect.flip),
      ScoopLayer
    )
    const mismatchedSha256Plan = await runEffect(
      createPlan(
        scoopConfig({
          artifactId: "archive"
        }).replace(
          "\"format\":\"zip\"",
          "\"format\":\"zip\",\"checksum\":{\"algorithm\":\"sha256\",\"value\":\"00\"}"
        )
      ),
      ScoopLayer
    )

    expect(missingArtifact._tag).toBe("PlanError")
    expect(directoryArtifact._tag).toBe("PlanError")
    expect(nonSha256Checksum._tag).toBe("PlanError")
    expect(mismatchedSha256Plan.operations.map((operation) => operation.id)).toContain("scoop:scoop-render-manifest")
    if (missingArtifact._tag === "PlanError") {
      expect(missingArtifact.reason).toBe("Scoop target references missing artifact missing.")
    }
    if (directoryArtifact._tag === "PlanError") {
      expect(directoryArtifact.reason).toBe("Scoop manifest artifacts must be file-like, not directories.")
    }
    if (nonSha256Checksum._tag === "PlanError") {
      expect(nonSha256Checksum.field).toBe("artifacts.archive.checksum")
    }
  })
})
