import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  GitHubReleaseDraft,
  GitHubReleaseMissing,
  GitHubReleasePublished
} from "../src/domain/remote-state.js"
import { HttpHeader } from "../src/domain/operation.js"
import { ReleasePlan } from "../src/domain/release.js"
import { GitHubReleaseTarget } from "../src/domain/target.js"
import { httpRequestKey, makeTestReleaseHttpLayer } from "../src/host/http.js"
import { makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { validatePlan } from "../src/planner/executor.js"
import {
  decideGitHubReleaseReconciliation,
  inspectGitHubReleaseState
} from "../src/planner/reconcile.js"
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

const findGitHubTarget = (plan: ReleasePlan): GitHubReleaseTarget => {
  const target = plan.targets.find((item) => item._tag === "GitHubReleaseTarget")
  if (target === undefined || target._tag !== "GitHubReleaseTarget") {
    throw new Error("expected GitHub target")
  }
  return target
}

const githubReleaseRequestKey = (target: GitHubReleaseTarget, tag: string): string =>
  httpRequestKey({
    method: "GET",
    url: `https://api.github.com/repos/${target.repository}/releases/tags/${encodeURIComponent(tag)}`,
    headers: [
      { name: "Accept", value: "application/vnd.github+json" },
      { name: "X-GitHub-Api-Version", value: "2022-11-28" }
    ],
    envHeaders: target.tokenEnv === undefined
      ? []
      : [{ name: "Authorization", valueEnv: target.tokenEnv, prefix: "Bearer " }],
    requiredEnv: target.tokenEnv === undefined ? [] : [target.tokenEnv],
    redactedEnv: target.tokenEnv === undefined ? [] : [target.tokenEnv]
  })

const githubReleaseListUrl = (target: GitHubReleaseTarget, page: number | undefined = undefined): string => {
  const url = `https://api.github.com/repos/${target.repository}/releases?per_page=100`
  return page === undefined ? url : `${url}&page=${page}`
}

const githubReleaseListRequestKey = (
  target: GitHubReleaseTarget,
  url: string = githubReleaseListUrl(target)
): string =>
  httpRequestKey({
    method: "GET",
    url,
    headers: [
      { name: "Accept", value: "application/vnd.github+json" },
      { name: "X-GitHub-Api-Version", value: "2022-11-28" }
    ],
    envHeaders: target.tokenEnv === undefined
      ? []
      : [{ name: "Authorization", valueEnv: target.tokenEnv, prefix: "Bearer " }],
    requiredEnv: target.tokenEnv === undefined ? [] : [target.tokenEnv],
    redactedEnv: target.tokenEnv === undefined ? [] : [target.tokenEnv]
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
        "artifacts/release-0.1.0.tgz"
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
        "artifacts/release-0.1.0.tgz"
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
        expected: "release-0.1.0.tgz"
      })
    }
    expect(text).toContain("http: GET https://api.github.com/repos/owner/repo/releases/tags/v0.1.0")
    expect(text).toContain("expect: status 200, checks 5")
    expect(text).not.toContain("gh release view")
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

  test("inspects GitHub remote state through HTTP responses", async () => {
    const plan = await runEffect(createPlan(), TestLayer)
    const target = findGitHubTarget(plan)
    const responseKey = githubReleaseRequestKey(target, "v0.1.0")
    const layer = Layer.mergeAll(
      TestLayer,
      makeTestReleaseHttpLayer({
        responses: new Map([
          [responseKey, {
            status: 200,
            json: {
              tag_name: "v0.1.0",
              name: "release 0.1.0",
              draft: true,
              prerelease: false,
              assets: [{ name: "." }]
            }
          }]
        ])
      })
    )

    const state = await runEffect(inspectGitHubReleaseState(target, plan), layer)

    expect(state._tag).toBe("GitHubReleaseDraft")
    if (state._tag === "GitHubReleaseDraft") {
      expect(state.assetNames).toEqual(["."])
      expect(state.draft).toBe(true)
    }
  })

  test("finds draft GitHub releases from the authenticated release list after tag lookup misses", async () => {
    const plan = await runEffect(createPlan(), TestLayer)
    const target = findGitHubTarget(plan)
    const state = await runEffect(
      inspectGitHubReleaseState(target, plan),
      Layer.mergeAll(
        TestLayer,
        makeTestReleaseHttpLayer({
          responses: new Map([
            [githubReleaseRequestKey(target, "v0.1.0"), {
              status: 404,
              json: {
                message: "Not Found"
              }
            }],
            [githubReleaseListRequestKey(target), {
              status: 200,
              json: [
                {
                  tag_name: "v0.1.0",
                  name: "release 0.1.0",
                  draft: true,
                  prerelease: false,
                  assets: [{ name: "." }]
                }
              ]
            }]
          ])
        })
      )
    )

    expect(state._tag).toBe("GitHubReleaseDraft")
    if (state._tag === "GitHubReleaseDraft") {
      expect(state.assetNames).toEqual(["."])
      expect(state.draft).toBe(true)
    }
  })

  test("follows paginated GitHub release lists to find draft releases", async () => {
    const plan = await runEffect(createPlan(), TestLayer)
    const target = findGitHubTarget(plan)
    const secondPageUrl = githubReleaseListUrl(target, 2)
    const state = await runEffect(
      inspectGitHubReleaseState(target, plan),
      Layer.mergeAll(
        TestLayer,
        makeTestReleaseHttpLayer({
          responses: new Map([
            [githubReleaseRequestKey(target, "v0.1.0"), {
              status: 404,
              json: {
                message: "Not Found"
              }
            }],
            [githubReleaseListRequestKey(target), {
              status: 200,
              responseHeaders: [
                HttpHeader.make({
                  name: "Link",
                  value: `<${secondPageUrl}>; rel="next"`
                })
              ],
              json: [
                {
                  tag_name: "v0.0.9",
                  name: "release 0.0.9",
                  draft: true,
                  prerelease: false,
                  assets: []
                }
              ]
            }],
            [githubReleaseListRequestKey(target, secondPageUrl), {
              status: 200,
              json: [
                {
                  tag_name: "v0.1.0",
                  name: "release 0.1.0",
                  draft: true,
                  prerelease: false,
                  assets: [{ name: "." }]
                }
              ]
            }]
          ])
        })
      )
    )

    expect(state._tag).toBe("GitHubReleaseDraft")
    if (state._tag === "GitHubReleaseDraft") {
      expect(state.assetNames).toEqual(["."])
      expect(state.draft).toBe(true)
    }
  })

  test("classifies missing GitHub releases from 404 responses and empty release lists", async () => {
    const plan = await runEffect(createPlan(), TestLayer)
    const target = findGitHubTarget(plan)
    const state = await runEffect(
      inspectGitHubReleaseState(target, plan),
      Layer.mergeAll(
        TestLayer,
        makeTestReleaseHttpLayer({
          responses: new Map([
            [githubReleaseRequestKey(target, "v0.1.0"), {
              status: 404,
              json: {
                message: "Not Found"
              }
            }],
            [githubReleaseListRequestKey(target), {
              status: 200,
              json: []
            }]
          ])
        })
      )
    )

    expect(state._tag).toBe("GitHubReleaseMissing")
  })

  test("rejects GitHub release list next links outside the releases endpoint", async () => {
    const plan = await runEffect(createPlan(), TestLayer)
    const target = findGitHubTarget(plan)
    const error = await runEffect(
      inspectGitHubReleaseState(target, plan).pipe(Effect.flip),
      Layer.mergeAll(
        TestLayer,
        makeTestReleaseHttpLayer({
          responses: new Map([
            [githubReleaseRequestKey(target, "v0.1.0"), {
              status: 404,
              json: {
                message: "Not Found"
              }
            }],
            [githubReleaseListRequestKey(target), {
              status: 200,
              responseHeaders: [
                HttpHeader.make({
                  name: "Link",
                  value: "<https://api.github.com/repos/owner/repo/issues?page=2>; rel=\"next\""
                })
              ],
              json: []
            }]
          ])
        })
      )
    )

    expect(error._tag).toBe("RemoteStateInspectionError")
    if (error._tag === "RemoteStateInspectionError") {
      expect(error.reason).toContain("expected releases endpoint")
    }
  })

  test("decides GitHub reconciliation actions for matching and mismatched states", async () => {
    const publicGithubConfig = minimalConfig.replace("\"draft\":true", "\"draft\":false")
    const plan = await runEffect(createPlan(publicGithubConfig), TestLayer)
    const target = findGitHubTarget(plan)
    const published = GitHubReleasePublished.make({
      targetId: "github",
      repository: "owner/repo",
      tag: "v0.1.0",
      title: "release 0.1.0",
      draft: false,
      prerelease: false,
      assetNames: []
    })
    const draft = GitHubReleaseDraft.make({
      targetId: "github",
      repository: "owner/repo",
      tag: "v0.1.0",
      title: "release 0.1.0",
      draft: true,
      prerelease: false,
      assetNames: []
    })
    const mismatchedAssets = GitHubReleaseDraft.make({
      targetId: "github",
      repository: "owner/repo",
      tag: "v0.1.0",
      title: "release 0.1.0",
      draft: true,
      prerelease: false,
      assetNames: ["other.tgz"]
    })
    const missing = GitHubReleaseMissing.make({
      targetId: "github",
      repository: "owner/repo",
      tag: "v0.1.0"
    })

    expect(decideGitHubReleaseReconciliation(target, plan, published)._tag).toBe("GitHubReconcileSkip")
    expect(decideGitHubReleaseReconciliation(target, plan, draft)._tag).toBe("GitHubReconcilePublishDraft")
    expect(decideGitHubReleaseReconciliation(target, plan, mismatchedAssets)._tag).toBe("GitHubReconcileBlock")
    expect(decideGitHubReleaseReconciliation(target, plan, missing)._tag).toBe("GitHubReconcileCreateRelease")
  })
})
