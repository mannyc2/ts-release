import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { validatePlan } from "../src/planner/executor.js"
import { renderPlanText } from "../src/planner/render-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig, releaseConfig, releaseIdentity, runEffect } from "./helpers.js"

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

describe("GitHub target", () => {
  test("rejects GitHub targets that claim native dry-run support", async () => {
    const nativeGithubDryRunConfig = minimalConfig.replace("\"dryRunSupport\":\"simulated\"", "\"dryRunSupport\":\"native\"")
    const error = await runEffect(createPlan(nativeGithubDryRunConfig).pipe(Effect.flip), TestLayer)

    expect(error._tag).toBe("PlanConstructionError")
    if (error._tag === "PlanConstructionError") {
      expect(error.reason).toContain("GitHub release targets do not support native dry-run")
    }
  })

  test("records simulated validation note evidence with current adapter severities", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan()
        return yield* validatePlan(plan)
      }),
      TestLayer
    )

    expectValidationRecord(evidence.records, "github:gh-release-dry-run:validation", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
  })

  test("covers GitHub command construction for release flags and assets", async () => {
    const githubConfig = releaseConfig({
      identity: releaseIdentity({ notes: "ship it" }),
      artifacts: [
        {
          id: "github-asset",
          path: ".",
          format: "directory",
          consumers: ["github"]
        },
        {
          id: "npm-only",
          path: ".",
          format: "directory",
          consumers: ["npm"]
        }
      ],
      targets: [
        {
          _tag: "GitHubReleaseTarget",
          id: "github",
          repository: "owner/repo",
          tokenEnv: "GH_TOKEN",
          draft: true,
          prerelease: true,
          dryRunSupport: "simulated",
          mutability: "mutable-release",
          recovery: "delete-and-recreate"
        }
      ]
    })

    const plan = await runEffect(createPlan(githubConfig), TestLayer)
    const publish = plan.operations.find((operation) => operation.id === "github:gh-release-create")
    const verify = plan.operations.find((operation) => operation.id === "github:github-release-verify-http")
    const legacyVerify = plan.operations.find((operation) =>
      operation.id === "github:gh-release-view" || operation.id.startsWith("github:gh-release-verify-")
    )
    const npmOnlyAsset = plan.operations.find((operation) => operation.id === "github:gh-release-verify-asset-npm-only")
    const text = renderPlanText(plan)

    expect(publish?._tag).toBe("PublishCommandOperation")
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.command.args).toEqual([
        "release",
        "create",
        "v0.1.0",
        "--repo",
        "owner/repo",
        "--title",
        "release 0.1.0",
        "--draft",
        "--prerelease",
        "--notes",
        "ship it",
        "."
      ])
    }
    expect(text).toContain(
      `argv: ${JSON.stringify([
        "gh",
        "release",
        "create",
        "v0.1.0",
        "--repo",
        "owner/repo",
        "--title",
        "release 0.1.0",
        "--draft",
        "--prerelease",
        "--notes",
        "ship it",
        "."
      ])}`
    )
    expect(npmOnlyAsset).toBeUndefined()
    expect(legacyVerify).toBeUndefined()
    expect(verify?._tag).toBe("VerifyHttpOperation")
    if (verify?._tag === "VerifyHttpOperation") {
      expect(verify.request.method).toBe("GET")
      expect(verify.request.url).toBe("https://api.github.com/repos/owner/repo/releases/tags/v0.1.0")
      expect(verify.request.requiredEnv).toEqual(["GH_TOKEN"])
      expect(verify.request.redactedEnv).toEqual(["GH_TOKEN"])
      expect(verify.request.envHeaders).toEqual([
        { name: "Authorization", valueEnv: "GH_TOKEN", prefix: "Bearer " }
      ])
      expect(verify.checks).toContainEqual({
        _tag: "HttpJsonEqualsCheck",
        path: ["tag_name"],
        expected: "v0.1.0"
      })
      expect(verify.checks).toContainEqual({
        _tag: "HttpJsonEqualsCheck",
        path: ["name"],
        expected: "release 0.1.0"
      })
      expect(verify.checks).toContainEqual({
        _tag: "HttpJsonEqualsCheck",
        path: ["draft"],
        expected: true
      })
      expect(verify.checks).toContainEqual({
        _tag: "HttpJsonEqualsCheck",
        path: ["prerelease"],
        expected: true
      })
      expect(verify.checks).toContainEqual({
        _tag: "HttpJsonArrayObjectFieldEqualsCheck",
        path: ["assets"],
        field: "name",
        expected: "."
      })
    }
    expect(text).toContain("http: GET https://api.github.com/repos/owner/repo/releases/tags/v0.1.0")
    expect(text).toContain("expect: status 200, checks 5")
    expect(text).not.toContain("gh release view")
  })
})
