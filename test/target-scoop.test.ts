import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { ExecutionApproval } from "../src/domain/operation.js"
import { makeTestReleaseHostLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { renderPlan, validatePlan } from "../src/planner/executor.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { releaseConfig, runEffect, scoopConfig } from "./helpers.js"

const ScoopLayer = Layer.mergeAll(
  makeTestReleaseHostLayer({
    files: new Map([["artifacts/release-0.1.0.zip", "scoop archive"]]),
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

describe("Scoop target", () => {
  test("plans Scoop bucket capabilities and manifest rendering", async () => {
    const plan = await runEffect(createPlan(scoopConfig({ bucketDirectory: "bucket" })), ScoopLayer)
    const scoop = plan.targetCapabilities.find((capability) => capability.targetId === "scoop")
    const render = plan.operations.find((operation) => operation.id === "scoop:scoop-render-manifest")
    const publish = plan.operations.find((operation) => operation.id === "scoop:scoop-push")

    expect(scoop?.targetTag).toBe("ScoopBucketTarget")
    expect(scoop?.authRequirement).toBe("cli-auth")
    expect(scoop?.mutability).toBe("mutable-index")
    expect(scoop?.validationStrategy).toBe("simulated-plan")
    expect(render?._tag).toBe("RenderFileOperation")
    expect(publish?._tag).toBe("PublishCommandOperation")
    if (render?._tag === "RenderFileOperation") {
      expect(render.path).toBe(".release/generated/release.json")
      expect(render.contents).toContain("\"version\": \"0.1.0\"")
      expect(render.contents).toContain("\"description\": \"Example Scoop release\"")
      expect(render.contents).toContain("\"homepage\": \"https://github.com/owner/release\"")
      expect(render.contents).toContain("\"license\": \"MIT\"")
      expect(render.contents).toContain("\"url\": \"https://github.com/owner/release/releases/download/v0.1.0/release-0.1.0.zip\"")
      expect(render.contents).toContain("\"hash\": \"sha256:13:artifacts/release-0.1.0.zip\"")
      expect(render.contents).toContain("\"bin\": \"release.exe\"")
    }
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.risk).toBe("externally-visible")
      expect(publish.command.args).toEqual(["-C", "bucket", "push"])
      expect(publish.command.requiredEnv).toEqual([])
      expect(publish.command.redactedEnv).toEqual([])
    }
  })

  test("rejects Scoop tokenEnv because bucket pushes use Git credentials", async () => {
    const error = await runEffect(createPlan(scoopConfig({ tokenEnv: "GH_TOKEN" })).pipe(Effect.flip), ScoopLayer)

    expect(error._tag).toBe("PlanConstructionError")
    if (error._tag === "PlanConstructionError") {
      expect(error.reason).toContain("plain git push")
      expect(error.reason).toContain("Git credentials")
    }
  })

  test("records simulated validation note evidence with current adapter severities", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(scoopConfig())
        return yield* validatePlan(plan)
      }),
      ScoopLayer
    )

    expectValidationRecord(evidence.records, "scoop:scoop-manifest-validation:validation", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
  })

  test("renders Scoop manifest evidence through the render workflow", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(scoopConfig())
        return yield* renderPlan(plan, ExecutionApproval.make({ execute: true, approveIrreversible: false }))
      }),
      ScoopLayer
    )

    expect(evidence.records.map((record) => record.id)).toEqual(["scoop:scoop-render-manifest:execution"])
  })

  test("records skipped Scoop validation in non-strict mode", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(scoopConfig({ dryRunSupport: "none" }).replace("\"strict\":true", "\"strict\":false"))
        return yield* validatePlan(plan)
      }),
      ScoopLayer
    )

    expect(evidence.records.filter((record) => record.status === "skipped").map((record) => record.id)).toEqual([
      "scoop:scoop-manifest-validation:validation"
    ])
    expectValidationRecord(evidence.records, "scoop:scoop-manifest-validation:validation", {
      status: "skipped",
      skipped: true,
      severity: "warning"
    })
  })

  test("rejects unsafe Scoop target shapes", async () => {
    const noDryRun = await runEffect(createPlan(scoopConfig({ dryRunSupport: "none" })).pipe(Effect.flip), ScoopLayer)
    const nativeDryRun = await runEffect(createPlan(scoopConfig({ dryRunSupport: "native" })).pipe(Effect.flip), ScoopLayer)
    const missingArtifact = await runEffect(
      createPlan(scoopConfig({ artifactId: "missing" })).pipe(Effect.flip),
      ScoopLayer
    )
    const directoryConfig = releaseConfig({
      artifacts: [
        {
          id: "archive",
          path: ".",
          format: "directory",
          consumers: ["scoop"]
        }
      ],
      targets: [
        {
          _tag: "ScoopBucketTarget",
          id: "scoop",
          repository: "owner/scoop-bucket",
          manifestName: "release",
          manifestPath: ".release/generated/release.json",
          artifactId: "archive",
          dryRunSupport: "simulated",
          mutability: "mutable-index",
          recovery: "manual"
        }
      ]
    })
    const directoryArtifact = await runEffect(createPlan(directoryConfig).pipe(Effect.flip), ScoopLayer)
    const nonSha256Checksum = await runEffect(
      createPlan(
        scoopConfig({
          artifactId: "archive"
        }).replace(
          "\"consumers\":[\"scoop\"]",
          "\"consumers\":[\"scoop\"],\"checksum\":{\"algorithm\":\"sha512\",\"value\":\"sha512:manual\"}"
        )
      ).pipe(Effect.flip),
      ScoopLayer
    )

    expect(noDryRun._tag).toBe("PlanConstructionError")
    expect(nativeDryRun._tag).toBe("PlanConstructionError")
    expect(missingArtifact._tag).toBe("PlanConstructionError")
    expect(directoryArtifact._tag).toBe("PlanConstructionError")
    expect(nonSha256Checksum._tag).toBe("PlanConstructionError")
    if (missingArtifact._tag === "PlanConstructionError") {
      expect(missingArtifact.reason).toBe("Scoop target references missing artifact missing.")
    }
    if (directoryArtifact._tag === "PlanConstructionError") {
      expect(directoryArtifact.reason).toBe("Scoop manifest artifacts must be file-like, not directories.")
    }
    if (nonSha256Checksum._tag === "PlanConstructionError") {
      expect(nonSha256Checksum.reason).toBe("Scoop manifest rendering requires a sha256 artifact checksum.")
    }
  })
})
