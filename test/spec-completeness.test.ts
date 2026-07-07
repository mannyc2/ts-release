import { describe, expect, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { expectTaggedError, minimalConfig } from "./helpers.js"
import { createTestPlan, renderTestPlanText, validateTestPlan } from "./plan-helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
)

const createPlan = (config: string = minimalConfig) =>
  createTestPlan(config)

const trustedPublishingConfig = minimalConfig.replace(
  "\"tokenEnv\":\"NPM_TOKEN\"",
  "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true}"
)

const expectValidationRecord = (
  records: ReadonlyArray<{ readonly operationId: string; readonly status: string }>,
  id: string,
  expected: { readonly status: string; readonly severity: string; readonly skipped: boolean }
) => {
  const record = records.find((item) => item.operationId === id)
  expect(record?.status).toBe(expected.status)
}

describe("SPEC completeness", () => {
  layer(TestLayer)((it) => {
    it.effect("records publish surfaces as first-class operations in the plan", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan()

        const npmPublish = plan.operations.find((operation) => operation.id === "npm:npm-publish")
        const githubCreate = plan.operations.find((operation) => operation.id === "github:github-release-create")
        const githubDryRun = plan.operations.find((operation) => operation.id === "github:github-release-dry-run")

        expect(plan.surfaceIds).toEqual(["github", "npm"])
        expect(npmPublish?.risk).toBe("irreversible")
        expect(githubCreate?.risk).toBe("externally-visible")
        expect(githubDryRun?.action._tag).toBe("note")
      }))

    it.effect("records trusted publishing setup in operation data", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(trustedPublishingConfig)
        const npmAuth = plan.operations.find((operation) => operation.id === "npm:npm-trusted-publishing-auth")
        const npmPublish = plan.operations.find((operation) => operation.id === "npm:npm-publish")

        expect(npmAuth?.action._tag).toBe("note")
        if (npmAuth?.action._tag === "note") {
          expect(npmAuth.action.message).toContain("provider github-actions")
          expect(npmAuth.action.message).toContain("workflow release.yml")
          expect(npmAuth.action.message).toContain("id-token: write")
        }
        expect(npmPublish?.action._tag).toBe("command")
        if (npmPublish?.action._tag === "command") {
          expect(npmPublish.action.command.requiredEnv).toEqual([
            "ACTIONS_ID_TOKEN_REQUEST_URL",
            "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
          ])
        }
      }))

    it.effect("records compact policy validators in evidence", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const evidence = yield* validateTestPlan(plan)

        expect(evidence.records.filter((record) => record.status === "skipped")).toEqual([])
        expectValidationRecord(evidence.records, "github:github-release-dry-run", {
          status: "passed",
          skipped: false,
          severity: "info"
        })
        expectValidationRecord(evidence.records, "npm:npm-pack-dry-run", {
          status: "passed",
          skipped: false,
          severity: "info"
        })
      }))

    it.effect("rejects removed target policy knobs at the config boundary", () =>
      Effect.gen(function*() {
        const removedPolicyConfig = minimalConfig.replace(
          "\"publish\":{\"npm\":{",
          "\"publish\":{\"npm\":{\"dryRunSupport\":\"none\","
        )
        const error = yield* createPlan(removedPolicyConfig).pipe(Effect.flip)

        expectTaggedError(error, "ConfigValidationError")
      }))

    it.effect("rejects unsafe artifact and package paths", () =>
      Effect.gen(function*() {
        const unsafeArtifactConfig = minimalConfig
          .replace("\"path\":\".\"", "\"path\":\"../release.tgz\"")
          .replace("\"format\":\"directory\"", "\"format\":\"tarball\"")
        const unsafePackageConfig = minimalConfig.replace("\"packagePath\":\".\"", "\"packagePath\":\"../pkg\"")

        const artifactError = yield* createPlan(unsafeArtifactConfig).pipe(Effect.flip)
        const packageError = yield* createPlan(unsafePackageConfig).pipe(Effect.flip)

        expect(artifactError._tag).toBe("ConfigValidationError")
        expect(packageError._tag).toBe("ConfigValidationError")
        if (artifactError._tag === "ConfigValidationError") {
          expect(artifactError.reason).toContain(`["npmPackage"]["path"]`)
        }
        if (packageError._tag === "ConfigValidationError") {
          expect(packageError.reason).toContain(`["publish"]["npm"]["packagePath"]`)
        }
      }))

    it.effect("renders review-critical details in text plans", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(trustedPublishingConfig)
        const text = renderTestPlanText(plan)

        expect(text).toContain("evidence: .release/evidence")
        expect(text).toContain("checksum=none")
        expect(text).toContain("surfaces: 2")
        expect(text).toContain("note: NPM trusted publishing authenticates")
        expect(text).toContain("note: GitHub release dry-run validation is simulated")
      }))
  })
})
