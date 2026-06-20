import { describe, expect, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { validatePlan } from "../src/planner/executor.js"
import { renderPlanText } from "../src/planner/render-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { expectTaggedError, minimalConfig } from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
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

const trustedPublishingConfig = minimalConfig.replace(
  "\"tokenEnv\":\"NPM_TOKEN\",",
  "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
)

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
  layer(TestLayer)((it) => {
    it.effect("records first-class target capabilities in the plan", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan()

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
      }))

    it.effect("records trusted publishing setup in target capabilities", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(trustedPublishingConfig)
        const npm = plan.targetCapabilities.find((capability) => capability.targetId === "npm")

        expect(npm?.authRequirement).toBe("trusted-publishing")
        expect(npm?.authSetup).toEqual({
          runsIn: "ci",
          provider: "github-actions",
          workflow: "release.yml",
          requiredPermissions: [{ name: "id-token", value: "write" }],
          prerequisites: ["npm-package-exists"]
        })
      }))

    it.effect("records skipped dry-run validators in non-strict evidence", () =>
      Effect.gen(function*() {
        const nonStrictNoDryRunConfig = minimalConfig
          .replaceAll("\"dryRunSupport\":\"native\"", "\"dryRunSupport\":\"none\"")
          .replace("\"dryRunSupport\":\"simulated\"", "\"dryRunSupport\":\"none\"")
          .replace("\"strict\":true", "\"strict\":false")

        const plan = yield* createPlan(nonStrictNoDryRunConfig)
        const evidence = yield* validatePlan(plan)

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
      }))

    it.effect("strict mode rejects targets without dry-run support", () =>
      Effect.gen(function*() {
        const strictNoDryRunConfig = minimalConfig
          .replaceAll("\"dryRunSupport\":\"native\"", "\"dryRunSupport\":\"none\"")
          .replace("\"dryRunSupport\":\"simulated\"", "\"dryRunSupport\":\"none\"")
        const error = yield* createPlan(strictNoDryRunConfig).pipe(Effect.flip)

        expectTaggedError(error, "PlanConstructionError")
      }))

    it.effect("rejects unsafe artifact and package paths", () =>
      Effect.gen(function*() {
        const unsafeArtifactConfig = minimalConfig
          .replace("\"path\":\".\"", "\"path\":\"../release.tgz\"")
          .replace("\"format\":\"directory\"", "\"format\":\"tarball\"")
        const unsafePackageConfig = minimalConfig.replace("\"packagePath\":\".\"", "\"packagePath\":\"../pkg\"")

        const artifactError = yield* createPlan(unsafeArtifactConfig).pipe(Effect.flip)
        const packageError = yield* createPlan(unsafePackageConfig).pipe(Effect.flip)

        expect(artifactError._tag).toBe("ReleaseNormalizationError")
        expect(packageError._tag).toBe("ReleaseNormalizationError")
        if (artifactError._tag === "ReleaseNormalizationError") {
          expect(artifactError.field).toBe("artifacts.package.path")
        }
        if (packageError._tag === "ReleaseNormalizationError") {
          expect(packageError.field).toBe("targets.npm.packagePath")
        }
      }))

    it.effect("renders review-critical details in text plans", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(trustedPublishingConfig)
        const text = renderPlanText(plan)

        expect(text).toContain("evidence: .release/evidence")
        expect(text).toContain("checksum=none")
        expect(text).toContain("auth=trusted-publishing")
        expect(text).toContain("runs-in=ci")
        expect(text).toContain("provider=github-actions")
        expect(text).toContain("workflow=release.yml")
        expect(text).toContain("required-permission=id-token:write")
        expect(text).toContain("package-prerequisite=exists")
        expect(text).toContain("dry-run=simulated")
        expect(text).toContain("strategy=simulated-plan")
        expect(text).toContain("recovery=delete-and-recreate")
        expect(text).toContain("note: GitHub release dry-run validation is simulated")
      }))
  })
})
