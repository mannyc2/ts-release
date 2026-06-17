import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestReleaseHostLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { validatePlan } from "../src/planner/executor.js"
import { renderPlanText } from "../src/planner/render-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig, runEffect } from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestReleaseHostLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
  LiveTargetRegistryLayer
)

const createPlan = (config: string = minimalConfig) =>
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

describe("SPEC completeness", () => {
  test("records first-class target capabilities in the plan", async () => {
    const plan = await runEffect(createPlan(), TestLayer)

    const npm = plan.targetCapabilities.find((capability) => capability.targetId === "npm")
    const github = plan.targetCapabilities.find((capability) => capability.targetId === "github")

    expect(npm?.authRequirement).toBe("env-token")
    expect(npm?.dryRunSupport).toBe("native")
    expect(npm?.validationStrategy).toBe("native-command")
    expect(npm?.recovery).toBe("publish-new-version")

    expect(github?.authRequirement).toBe("env-token")
    expect(github?.dryRunSupport).toBe("simulated")
    expect(github?.validationStrategy).toBe("simulated-plan")
    expect(github?.recovery).toBe("delete-and-recreate")
  })

  test("records skipped dry-run validators in non-strict evidence", async () => {
    const nonStrictNoDryRunConfig = minimalConfig
      .replaceAll("\"dryRunSupport\":\"native\"", "\"dryRunSupport\":\"none\"")
      .replace("\"dryRunSupport\":\"simulated\"", "\"dryRunSupport\":\"none\"")
      .replace("\"strict\":true", "\"strict\":false")

    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(nonStrictNoDryRunConfig)
        return yield* validatePlan(plan)
      }),
      TestLayer
    )

    expect(evidence.records.filter((record) => record.status === "skipped").map((record) => record.id).sort()).toEqual([
      "github:gh-release-dry-run:validation",
      "npm:npm-pack-dry-run:validation"
    ])
    expectValidationRecord(evidence.records, "github:gh-release-dry-run:validation", {
      status: "skipped",
      skipped: true,
      severity: "warning"
    })
    expectValidationRecord(evidence.records, "npm:npm-pack-dry-run:validation", {
      status: "skipped",
      skipped: true,
      severity: "warning"
    })
  })

  test("strict mode rejects targets without dry-run support", async () => {
    const strictNoDryRunConfig = minimalConfig
      .replaceAll("\"dryRunSupport\":\"native\"", "\"dryRunSupport\":\"none\"")
      .replace("\"dryRunSupport\":\"simulated\"", "\"dryRunSupport\":\"none\"")
    const exit = await Effect.runPromiseExit(createPlan(strictNoDryRunConfig).pipe(Effect.provide(TestLayer)))

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("PlanConstructionError")
    }
  })

  test("rejects unsafe artifact and package paths", async () => {
    const unsafeArtifactConfig = minimalConfig
      .replace("\"path\":\".\"", "\"path\":\"../release.tgz\"")
      .replace("\"format\":\"directory\"", "\"format\":\"tarball\"")
    const unsafePackageConfig = minimalConfig.replace("\"packagePath\":\".\"", "\"packagePath\":\"../pkg\"")

    const artifactError = await runEffect(createPlan(unsafeArtifactConfig).pipe(Effect.flip), TestLayer)
    const packageError = await runEffect(createPlan(unsafePackageConfig).pipe(Effect.flip), TestLayer)

    expect(artifactError._tag).toBe("ReleaseNormalizationError")
    expect(packageError._tag).toBe("ReleaseNormalizationError")
    if (artifactError._tag === "ReleaseNormalizationError") {
      expect(artifactError.field).toBe("artifacts.package.path")
    }
    if (packageError._tag === "ReleaseNormalizationError") {
      expect(packageError.field).toBe("targets.npm.packagePath")
    }
  })

  test("renders review-critical details in text plans", async () => {
    const plan = await runEffect(createPlan(), TestLayer)
    const text = renderPlanText(plan)

    expect(text).toContain("evidence: .release/evidence")
    expect(text).toContain("checksum=none")
    expect(text).toContain("auth=env-token")
    expect(text).toContain("dry-run=simulated")
    expect(text).toContain("strategy=simulated-plan")
    expect(text).toContain("recovery=delete-and-recreate")
    expect(text).toContain("note: GitHub release dry-run validation is simulated")
  })
})
