import { describe, expect, test } from "@effect/bun-test"
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
    files: new Map([
      ["artifacts/release-0.1.0.tgz", "fake archive"]
    ]),
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
  test("records simulated validation note evidence with current adapter severities", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan()
        return yield* validatePlan(plan)
      }),
      TestLayer
    )

    expectValidationRecord(evidence.records, "github:github-release-dry-run:validation", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
  })

  test("covers GitHub API release operation data for flags and assets", async () => {
    const githubConfig = releaseConfig({
      identity: releaseIdentity({ notes: "ship it" }),
      artifacts: [
        {
          id: "github-asset",
          path: "artifacts/release-0.1.0.tgz",
          format: "tarball",
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
    const publish = plan.operations.find((operation) => operation.id === "github:github-release-create")
    const verify = plan.operations.find((operation) => operation.id === "github:github-release-verify-api")
    const text = renderPlanText(plan)

    expect(publish?._tag).toBe("PublishGitHubReleaseOperation")
    if (publish?._tag === "PublishGitHubReleaseOperation") {
      expect(publish.repository).toBe("owner/repo")
      expect(publish.tokenEnv).toBe("GH_TOKEN")
      expect(publish.tag).toBe("v0.1.0")
      expect(publish.title).toBe("release 0.1.0")
      expect(publish.draft).toBe(true)
      expect(publish.prerelease).toBe(true)
      expect(publish.notes).toBe("ship it")
      expect(publish.assets).toEqual([
        {
          artifactId: "github-asset",
          path: "artifacts/release-0.1.0.tgz",
          name: "release-0.1.0.tgz",
          contentType: "application/octet-stream"
        }
      ])
    }
    expect(verify?._tag).toBe("VerifyGitHubReleaseOperation")
    if (verify?._tag === "VerifyGitHubReleaseOperation") {
      expect(verify.repository).toBe("owner/repo")
      expect(verify.tokenEnv).toBe("GH_TOKEN")
      expect(verify.tag).toBe("v0.1.0")
      expect(verify.title).toBe("release 0.1.0")
      expect(verify.draft).toBe(true)
      expect(verify.prerelease).toBe(true)
      expect(verify.assetNames).toEqual(["release-0.1.0.tgz"])
    }
    expect(text).toContain("github-api: create release owner/repo v0.1.0 assets=1")
    expect(text).toContain("github-api: verify release owner/repo v0.1.0 assets=1")
    expect(text).not.toContain("argv: [\"gh\"")
  })

  test("uses API verification for non-draft GitHub releases", async () => {
    const githubConfig = releaseConfig({
      artifacts: [
        {
          id: "github-asset",
          path: "artifacts/release-0.1.0.tgz",
          format: "tarball",
          consumers: ["github"]
        }
      ],
      targets: [
        {
          _tag: "GitHubReleaseTarget",
          id: "github",
          repository: "owner/repo",
          tokenEnv: "GH_TOKEN",
          draft: false,
          prerelease: true,
          dryRunSupport: "simulated",
          mutability: "mutable-release",
          recovery: "delete-and-recreate"
        }
      ]
    })

    const plan = await runEffect(createPlan(githubConfig), TestLayer)
    const verify = plan.operations.find((operation) => operation.id === "github:github-release-verify-api")
    const text = renderPlanText(plan)

    expect(verify?._tag).toBe("VerifyGitHubReleaseOperation")
    if (verify?._tag === "VerifyGitHubReleaseOperation") {
      expect(verify.repository).toBe("owner/repo")
      expect(verify.tokenEnv).toBe("GH_TOKEN")
      expect(verify.tag).toBe("v0.1.0")
      expect(verify.title).toBe("release 0.1.0")
      expect(verify.draft).toBe(false)
      expect(verify.prerelease).toBe(true)
      expect(verify.assetNames).toEqual(["release-0.1.0.tgz"])
    }
    expect(text).toContain("github-api: verify release owner/repo v0.1.0 assets=1")
  })

  test("rejects directory artifacts consumed by GitHub releases", async () => {
    const githubConfig = releaseConfig({
      artifacts: [
        {
          id: "github-asset",
          path: ".",
          format: "directory",
          consumers: ["github"]
        }
      ],
      targets: [
        {
          _tag: "GitHubReleaseTarget",
          id: "github",
          repository: "owner/repo",
          tokenEnv: "GH_TOKEN",
          draft: true,
          prerelease: false,
          dryRunSupport: "simulated",
          mutability: "mutable-release",
          recovery: "delete-and-recreate"
        }
      ]
    })

    const error = await runEffect(createPlan(githubConfig).pipe(Effect.flip), TestLayer)

    expect(error._tag).toBe("PlanConstructionError")
    if (error._tag === "PlanConstructionError") {
      expect(error.reason).toBe("GitHub release assets must be file-like, not directories.")
    }
  })

})
